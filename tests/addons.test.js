// CAF AI · اختبار تكامل: تثبيت محرك إضافي (مثل Pyodide) من خادم محلي، تقدّم المهمة، والخدمة عبر ‎/runtime‎، والـ Canvas.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
const { startServer, parseNdjson, tmpHome } = require('./helpers/server');

function tgz(files) {
  const blocks = [];
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text); const h = Buffer.alloc(512);
    h.write(name, 0); h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136); h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257);
    let s = 0; for (const b of h) s += b; h.write(s.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

let S; let asset;
test.before(async () => {
  const pkg = tgz({ 'package/pyodide.mjs': 'export const loadPyodide = 1;', 'package/python_stdlib.zip': 'zip', 'package/secret.txt': 'should not be extracted' });
  asset = await new Promise((r) => { const srv = http.createServer((q, s) => { s.writeHead(200, { 'Content-Length': pkg.length }); s.end(pkg); }); srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port })); });
  const home = tmpHome();
  const cat = path.join(home, 'addons-test.json');
  fs.writeFileSync(cat, JSON.stringify({ schema: 1, engines: { pyodide: { name: 'Pyodide', version: '9.9.9', license: 'MPL-2.0', capability: 'code-run', check: 'pyodide.mjs', assets: { any: { url: `http://127.0.0.1:${asset.port}/p.tgz`, size: pkg.length, hash: 'sha512-' + crypto.createHash('sha512').update(pkg).digest('base64'), type: 'tgz', strip: 1, include: ['pyodide.mjs', 'python_stdlib.zip'] } } } }, models: {} }));
  S = await startServer({ home, env: { CAF_ADDONS_CATALOG: cat } });
});
test.after(async () => { await S.stop(); asset.srv.close(); });

test('install an engine as a job, stream progress, then serve its files', async () => {
  let list = await S.api('GET', '/api/addons');
  assert.equal(list.json.engines[0].installed, false);
  assert.equal((await S.raw('GET', '/runtime/pyodide/pyodide.mjs')).status, 404);
  const job = await S.api('POST', '/api/addons/pyodide/install');
  assert.equal(job.status, 202);
  const st = await S.api('GET', `/api/jobs/${job.json.id}/stream`);
  const events = parseNdjson(st.text);
  assert.equal(events.at(-1).status, 'done', JSON.stringify(events.at(-1)));
  list = await S.api('GET', '/api/addons');
  assert.equal(list.json.engines[0].installed, true);
  assert.equal(list.json.engines[0].installedVersion, '9.9.9');
  const js = await S.raw('GET', '/runtime/pyodide/pyodide.mjs');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
  assert.equal((await S.raw('GET', '/runtime/pyodide/secret.txt')).status, 404, 'files outside the include list are not extracted');
  assert.equal((await S.raw('GET', '/runtime/pyodide/..%2F..%2Fsettings.json')).status, 404);
  const prov = await S.api('GET', '/api/providers');
  assert.equal(prov.json.providers.find((p) => p.id === 'pyodide').installed, true);
  assert.equal((await S.api('DELETE', '/api/addons/pyodide')).status, 200);
  assert.equal((await S.raw('GET', '/runtime/pyodide/pyodide.mjs')).status, 404);
});

test('canvas keeps a version history', async () => {
  const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  await S.api('PUT', '/api/canvas/' + id, { body: { name: 'a.js', lang: 'javascript', versions: [{ content: 'let a=1', note: 'v1' }] } });
  await S.api('PUT', '/api/canvas/' + id, { body: { append: { content: 'let a=2', note: 'edit' } } });
  await S.api('PUT', '/api/canvas/' + id, { body: { append: { content: 'let a=2', note: 'same' } } });
  const d = await S.api('GET', '/api/canvas/' + id);
  assert.deepEqual(d.json.versions.map((v) => v.content), ['let a=1', 'let a=2'], 'identical versions are not duplicated');
  assert.equal((await S.api('GET', '/api/canvas')).json.docs.length, 1);
});

test('workers and the preview frame get their own strict CSP', async () => {
  const js = await S.raw('GET', '/js/workers/js-runner.js');
  assert.match(js.headers['content-security-policy'], /connect-src 'none'/);
  const py = await S.raw('GET', '/js/workers/py-runner.js');
  assert.match(py.headers['content-security-policy'], new RegExp(`connect-src http://127.0.0.1:${S.port}/runtime/$`));
  const fr = await S.raw('GET', '/sandbox/frame.html');
  assert.match(fr.headers['content-security-policy'], /^sandbox allow-scripts/);
  assert.match(fr.headers['content-security-policy'], /connect-src 'none'/);
  assert.equal(fr.headers['x-frame-options'], undefined);
});
