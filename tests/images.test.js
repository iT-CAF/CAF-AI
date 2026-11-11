// CAF AI · اختبار توليد الصور بمحرك وهمي يحاكي sd-cli (تقدّم الخطوات وكتابة PNG) — بلا تنزيل نماذج.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, parseNdjson, tmpHome } = require('./helpers/server');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let S;
test.before(async () => {
  const home = tmpHome();
  const eng = path.join(home, 'extras', 'engines', 'sdcpp');
  fs.mkdirSync(eng, { recursive: true });
  fs.writeFileSync(path.join(eng, '.caf-installed.json'), JSON.stringify({ id: 'sdcpp', version: 'test', binDir: '' }));
  // sd-cli وهمي: يطبع التقدّم ويكتب صورة لكل عنصر في الدفعة
  fs.writeFileSync(path.join(eng, 'sd-cli'), `#!/usr/bin/env node
const a=process.argv.slice(2); const o=a[a.indexOf('-o')+1]; const n=+a[a.indexOf('-b')+1]||1; const s=+a[a.indexOf('--steps')+1];
if (a.includes('--help')) process.exit(0);
for(let i=0;i<n;i++){ for(let k=1;k<=s;k++) process.stdout.write('  |====| '+k+'/'+s+' -  0.01s/it\\r'); console.log('sampling completed'); require('fs').writeFileSync(o.replace('%d',i),Buffer.from('${PNG}','base64')); }
`, { mode: 0o755 });
  const md = path.join(home, 'extras', 'models', 'flux2-klein-4b');
  fs.mkdirSync(md, { recursive: true });
  for (const f of ['flux-2-klein-4b-Q4_0.gguf', 'Qwen3-4B-Q4_K_M.gguf', 'flux2-vae.safetensors']) fs.writeFileSync(path.join(md, f), 'x');
  S = await startServer({ home });
});
test.after(async () => { await S.stop(); });

test('generate images as a job with real step progress, then gallery + delete', async () => {
  const st = await S.api('GET', '/api/images/status');
  assert.equal(st.json.ready, true);
  const job = await S.api('POST', '/api/images/generate', { body: { prompt: 'a cat by a rainy window', promptAr: 'قطة', model: 'flux2-klein-4b', steps: 4, count: 2, width: 500, height: 500, seed: 7 } });
  assert.equal(job.status, 202);
  const ev = parseNdjson((await S.api('GET', `/api/jobs/${job.json.id}/stream`)).text);
  assert.equal(ev.at(-1).status, 'done', JSON.stringify(ev.at(-1).error));
  const imgs = ev.at(-1).result.images;
  assert.equal(imgs.length, 2);
  assert.deepEqual(imgs.map((i) => i.seed), [7, 8], 'batch seeds are consecutive');
  assert.equal(imgs[0].width, 496, 'sizes snap to multiples of 16');
  const g = await S.api('GET', '/api/images');
  assert.equal(g.json.images.length, 2);
  assert.equal((await S.raw('GET', '/files/img/' + imgs[0].id, { headers: { Cookie: `caf_t=${S.token}` } })).headers['content-type'], 'image/png');
  assert.equal((await S.api('DELETE', '/api/images/' + imgs[0].id)).status, 200);
  assert.equal((await S.api('GET', '/api/images')).json.images.length, 1);
});

test('drawing requests in chat return an image route instead of a text reply', async () => {
  const r = await S.api('POST', '/api/chat', { body: { model: 'auto', messages: [{ role: 'user', content: 'ارسم لي قطة' }] } });
  const lines = parseNdjson(r.text);
  assert.equal(lines[0].meta.route, 'image');
  assert.ok(lines.at(-1).image);
});
