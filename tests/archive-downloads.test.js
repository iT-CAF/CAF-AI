// CAF AI · اختبارات: الأرشيفات (tar/zip) والتنزيل القابل للاستئناف والتحقق من البصمة.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
const { createZip, extractZip, zipGet, extractTar } = require('../app/lib/archive');
const { download } = require('../app/lib/downloads');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'caf-arc-'));

// tar بسيط للاختبار (ustar)
function tarOf(entries) {
  const blocks = [];
  for (const { name, data, mode = 0o644 } of entries) {
    const h = Buffer.alloc(512);
    h.write(name, 0, 100); h.write(mode.toString(8).padStart(7, '0') + '\0', 100);
    h.write('0000000\0', 108); h.write('0000000\0', 116);
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136);
    h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
    let sum = 0; for (const b of h) sum += b; h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

test('zip round trip, utf-8 names, and no path traversal', () => {
  const big = Buffer.from('كآف AI '.repeat(500));
  const z = createZip([{ name: 'a.txt', data: Buffer.from('hello') }, { name: 'مجلد/ملف.md', data: big }, { name: '../escape.txt', data: Buffer.from('x') }]);
  assert.equal(zipGet(z, 'a.txt').toString(), 'hello');
  assert.equal(zipGet(z, 'مجلد/ملف.md').toString(), big.toString());
  const d = tmp();
  const n = extractZip(z, path.join(d, 'out'));
  assert.equal(n, 2, 'the ../ entry is skipped');
  assert.ok(fs.existsSync(path.join(d, 'out', 'مجلد', 'ملف.md')));
  assert.ok(!fs.existsSync(path.join(d, 'escape.txt')));
});

test('tar.gz extraction with strip, include filter and traversal guard', () => {
  const d = tmp();
  const f = path.join(d, 'x.tgz');
  fs.writeFileSync(f, tarOf([{ name: 'package/pyodide.mjs', data: Buffer.from('export {}') }, { name: 'package/README.md', data: Buffer.from('r') }, { name: 'package/../../evil.sh', data: Buffer.from('rm -rf'), mode: 0o755 }]));
  const n = extractTar(f, path.join(d, 'o'), { strip: 1, filter: (rel) => rel === 'pyodide.mjs' });
  assert.equal(n, 1);
  assert.ok(fs.existsSync(path.join(d, 'o', 'pyodide.mjs')));
  assert.ok(!fs.existsSync(path.join(d, 'o', 'README.md')));
  assert.ok(!fs.existsSync(path.join(d, 'evil.sh')));
});

function fileServer(payload, { dropAt = 0, noRange = false } = {}) {
  let hits = 0;
  const srv = http.createServer((req, res) => {
    hits++;
    const range = !noRange && req.headers.range && /bytes=(\d+)-/.exec(req.headers.range);
    const start = range ? Number(range[1]) : 0;
    const body = payload.subarray(start);
    res.writeHead(range ? 206 : 200, { 'Content-Length': body.length, ...(range ? { 'Content-Range': `bytes ${start}-${payload.length - 1}/${payload.length}` } : {}) });
    if (dropAt && hits === 1) { res.write(body.subarray(0, dropAt)); setTimeout(() => res.destroy(), 30); return; }
    res.end(body);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ url: `http://127.0.0.1:${srv.address().port}/f.bin`, close: () => srv.close(), hits: () => hits })));
}

test('download resumes after a dropped connection and verifies sha256', async () => {
  const payload = crypto.randomBytes(300000);
  const sha = crypto.createHash('sha256').update(payload).digest('hex');
  const s = await fileServer(payload, { dropAt: 120000 });
  const dest = path.join(tmp(), 'f.bin');
  await assert.rejects(download({ url: s.url, dest, size: payload.length, hash: sha }), (e) => e.code === 'NETWORK');
  assert.ok(fs.statSync(dest + '.part').size >= 120000, 'partial file kept');
  await download({ url: s.url, dest, size: payload.length, hash: 'sha256:' + sha });
  assert.equal(Buffer.compare(fs.readFileSync(dest), payload), 0);
  assert.ok(!fs.existsSync(dest + '.part'));
  // ملف موجود وسليم: لا تنزيل جديد
  const before = s.hits();
  await download({ url: s.url, dest, size: payload.length, hash: sha });
  assert.equal(s.hits(), before);
  s.close();
});

test('download rejects a wrong hash and a wrong size, supports npm sha512', async () => {
  const payload = Buffer.from('caf'.repeat(1000));
  const s = await fileServer(payload, { noRange: true });
  const d = tmp();
  await assert.rejects(download({ url: s.url, dest: path.join(d, 'a'), size: payload.length, hash: 'a'.repeat(64) }), (e) => e.code === 'HASH_MISMATCH');
  assert.ok(!fs.existsSync(path.join(d, 'a')) && !fs.existsSync(path.join(d, 'a.part')), 'bad file removed');
  await assert.rejects(download({ url: s.url, dest: path.join(d, 'b'), size: payload.length + 5 }), (e) => e.code === 'NETWORK' || e.code === 'SIZE_MISMATCH');
  const sri = 'sha512-' + crypto.createHash('sha512').update(payload).digest('base64');
  await download({ url: s.url, dest: path.join(d, 'c'), size: payload.length, hash: sri });
  assert.ok(fs.existsSync(path.join(d, 'c')));
  s.close();
});
