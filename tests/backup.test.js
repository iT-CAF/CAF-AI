// CAF AI · اختبارات تصدير المحادثة والنسخ الاحتياطي والاستعادة (مع نسخة أمان) ورفض الملفات المريبة.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer } = require('./helpers/server');
const { createZip, zipEntries, zipGet } = require('../app/lib/archive');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let S;
test.before(async () => { S = await startServer({ env: { CAF_NO_RESTART: '1' } }); });
test.after(async () => { await S?.stop(); });

test('export a chat as Markdown, and as zip when it has images', async () => {
  const id = 'chat-export-0001';
  await S.api('PUT', `/api/chats/${id}`, { body: { title: 'خطة: المشروع/الأول', messages: [{ role: 'user', content: 'مرحبا' }, { role: 'assistant', content: '<think>x</think>أهلًا **بك**', model: 'qwen2.5:7b' }] } });
  const md = await S.api('GET', `/api/chats/${id}/export`, { raw: true });
  assert.equal(md.status, 200); assert.match(md.headers['content-type'], /markdown/);
  assert.match(md.headers['content-disposition'], /filename\*=UTF-8''/);
  assert.match(md.text, /# خطة: المشروع\/الأول/); assert.match(md.text, /أهلًا \*\*بك\*\*/); assert.doesNotMatch(md.text, /<think>/);
  const att = await S.api('POST', `/api/chats/${id}/attachments?name=a.png`, { body: PNG, headers: { 'Content-Type': 'image/png' } });
  await S.api('PUT', `/api/chats/${id}`, { body: { title: 'صور', messages: [{ role: 'user', content: 'صف الصورة', images: [{ id: att.json.id, name: 'a.png' }] }] } });
  const z = await S.api('GET', `/api/chats/${id}/export`, { raw: true });
  assert.match(z.headers['content-type'], /zip/);
  const names = zipEntries(z.buf).map((e) => e.name);
  assert.ok(names.includes('chat.md') && names.some((n) => n.startsWith('images/')), names.join(','));
  assert.match(zipGet(z.buf, 'chat.md').toString(), /!\[a\.png\]\(images\//);
});

test('backup → restore round trip keeps a safety copy; bad archives are rejected', async () => {
  await S.api('PUT', '/api/chats/chat-keep-0001', { body: { title: 'قبل النسخة', messages: [{ role: 'user', content: 'أ' }] } });
  const sum = await S.api('GET', '/api/backup/summary');
  assert.ok(sum.json.chats >= 1);
  const b = await S.api('GET', '/api/backup', { raw: true });
  assert.equal(b.status, 200);
  const names = zipEntries(b.buf).map((e) => e.name);
  assert.ok(names.includes('caf-backup.json') && names.includes('data/chats/chat-keep-0001.json'));
  assert.ok(!names.some((n) => /server\.json|api-key|hardware\.json|backups\//.test(n)), 'no secrets or device files');
  // تغيير بعد النسخة ثم استعادة
  await S.api('DELETE', '/api/chats/chat-keep-0001');
  await S.api('PUT', '/api/chats/chat-new-00001', { body: { title: 'بعد النسخة', messages: [] } });
  const chk = await S.api('POST', '/api/backup/restore?check=1', { body: b.buf, headers: { 'Content-Type': 'application/zip' } });
  assert.equal(chk.json.ok, true);
  const r = await S.api('POST', '/api/backup/restore', { body: b.buf, headers: { 'Content-Type': 'application/zip' } });
  assert.equal(r.status, 200, r.text); assert.equal(r.json.restart, true);
  assert.ok(fs.existsSync(path.join(S.home, 'data', 'chats', 'chat-keep-0001.json')), 'restored');
  assert.ok(!fs.existsSync(path.join(S.home, 'data', 'chats', 'chat-new-00001.json')), 'replaced');
  assert.ok(fs.existsSync(path.join(S.home, r.json.safetyCopy, 'data', 'chats', 'chat-new-00001.json')), 'safety copy kept');
  // ملف خارج المسارات المسموحة أو بلا manifest
  const evil = createZip([{ name: 'caf-backup.json', data: Buffer.from(JSON.stringify({ app: 'CAF AI', format: 1, dataVersion: 2 })) }, { name: 'data/../../evil.txt', data: Buffer.from('x') }]);
  assert.equal((await S.api('POST', '/api/backup/restore', { body: evil, headers: { 'Content-Type': 'application/zip' } })).json.error, 'bad_backup');
  const noMan = createZip([{ name: 'data/chats/x.json', data: Buffer.from('{}') }]);
  assert.equal((await S.api('POST', '/api/backup/restore', { body: noMan, headers: { 'Content-Type': 'application/zip' } })).json.error, 'bad_backup');
  const appCode = createZip([{ name: 'caf-backup.json', data: Buffer.from(JSON.stringify({ app: 'CAF AI', format: 1, dataVersion: 2 })) }, { name: 'app/server.js', data: Buffer.from('x') }]);
  assert.equal((await S.api('POST', '/api/backup/restore', { body: appCode, headers: { 'Content-Type': 'application/zip' } })).json.error, 'bad_backup');
});
