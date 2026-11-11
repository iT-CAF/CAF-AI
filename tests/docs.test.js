// CAF AI · اختبارات المستندات: الاستخراج، مكتبة المعرفة (فهرسة وبحث هجين)، المصادر في الرد، وملفات النتائج.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, parseNdjson } = require('./helpers/server');
const { makeXlsx } = require('./helpers/xlsx');
const rag = require('../app/lib/rag');

let S;
test.before(async () => { S = await startServer(); });
test.after(async () => { await S.stop(); });

test('Arabic normalization and chunking keep page locations', () => {
  assert.equal(rag.normalize('إدارةُ المُشْتَرَيات'), rag.normalize('ادارة المشتريات'));
  const chunks = rag.chunkSections([{ text: 'أ'.repeat(2000), loc: 'ص 1' }, { text: 'فقرة قصيرة', loc: 'ص 2' }]);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks.at(-1).loc, 'ص 2');
});

test('extract xlsx / csv / txt on the server; pdf is browser-side', async () => {
  const x = await S.api('POST', '/api/extract?name=sales.xlsx', { body: makeXlsx([['المنتج', 'السعر'], ['قهوة', 25]], 'المبيعات'), headers: { 'Content-Type': 'application/octet-stream' } });
  assert.equal(x.json.kind, 'xlsx');
  assert.deepEqual(x.json.sheets[0].rows, [['المنتج', 'السعر'], ['قهوة', '25']]);
  const c = await S.api('POST', '/api/extract?name=a.csv', { body: Buffer.from('اسم;عمر\nعلي;30\n'), headers: { 'Content-Type': 'text/csv' } });
  assert.deepEqual(c.json.sheets[0].rows[1], ['علي', '30']);
  const p = await S.api('POST', '/api/extract?name=a.pdf', { body: Buffer.from('%PDF-1.7 ...'), headers: { 'Content-Type': 'application/pdf' } });
  assert.equal(p.json.error, 'pdf_client');
});

test('knowledge: index with local embeddings, hybrid search, sources in chat', async () => {
  const col = (await S.api('POST', '/api/knowledge', { body: { name: 'سياسات الشركة' } })).json;
  const job = await S.api('POST', `/api/knowledge/${col.id}/docs`, { body: { name: 'دليل الموظف.pdf', kind: 'pdf', sections: [
    { text: 'سياسة الإجازات: يحصل الموظف على ثلاثين يومًا من الإجازة السنوية المدفوعة.', loc: 'ص 4' },
    { text: 'ساعات العمل من الأحد إلى الخميس من الثامنة صباحًا حتى الرابعة عصرًا.', loc: 'ص 7' },
  ] } });
  assert.equal(job.status, 202);
  assert.equal(job.json.embedModel, 'qwen3-embedding:0.6b');
  const done = parseNdjson((await S.api('GET', `/api/jobs/${job.json.id}/stream`)).text).at(-1);
  assert.equal(done.status, 'done');
  const hits = (await S.api('POST', '/api/knowledge/search', { body: { collections: [col.id], q: 'كم يوم الإجازة السنوية؟' } })).json.hits;
  assert.equal(hits[0].loc, 'ص 4');
  const r = await S.api('POST', '/api/chat', { body: { model: 'qwen2.5:7b', collections: [col.id], messages: [{ role: 'user', content: 'كم يوم الإجازة السنوية؟' }] } });
  const meta = parseNdjson(r.text)[0].meta;
  assert.equal(meta.sources[0].file, 'دليل الموظف.pdf');
  assert.equal(meta.sources[0].loc, 'ص 4');
  const sent = S.mock.calls.filter((c) => c.path === '/api/chat').at(-1).body;
  assert.match(sent.messages[0].content, /\[1\] \(دليل الموظف\.pdf · ص 4\)/);
  assert.equal((await S.api('DELETE', `/api/knowledge/${col.id}`)).status, 200);
});

test('generated result files are stored with the chat and downloadable with the cookie', async () => {
  const id = '12121212-2222-3333-4444-555555555555';
  const up = await S.api('POST', `/api/chats/${id}/files?name=${encodeURIComponent('مبيعات-معدل.xlsx')}`, { body: Buffer.from('PK test'), headers: { 'Content-Type': 'application/octet-stream' } });
  assert.equal(up.status, 200);
  assert.equal((await S.raw('GET', `/files/chat/${id}/${up.json.id}`)).status, 401);
  const dl = await S.raw('GET', `/files/chat/${id}/${up.json.id}`, { headers: { Cookie: `caf_t=${S.token}` } });
  assert.equal(dl.status, 200);
  assert.match(dl.headers['content-disposition'], /attachment; filename\*=UTF-8''/);
  await S.api('DELETE', '/api/chats/' + id);
  assert.equal((await S.raw('GET', `/files/chat/${id}/${up.json.id}`, { headers: { Cookie: `caf_t=${S.token}` } })).status, 404, 'deleting the chat removes its files');
});
