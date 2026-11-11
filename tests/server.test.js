// CAF AI · اختبارات تكامل الخادم: الحماية، المحادثة، المحادثات، المرفقات، والترحيل من v1.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, parseNdjson } = require('./helpers/server');

const V1_CHAT = { id: '0226cd13-d9d7-4eb1-96c9-902a9c8ca125', title: 'محادثة قديمة', model: 'qwen2.5:7b', created: 1761000000000, updated: 1761000005000, messages: [{ role: 'user', content: 'مرحبا' }, { role: 'assistant', content: 'أهلًا بك' }] };

let S;
test.before(async () => {
  S = await startServer({
    before: (home) => {
      // بيانات v1 كما يكتبها الإصدار 1.0.0
      fs.mkdirSync(path.join(home, 'data', 'chats'), { recursive: true });
      fs.writeFileSync(path.join(home, 'data', 'chats', V1_CHAT.id + '.json'), JSON.stringify(V1_CHAT));
      fs.writeFileSync(path.join(home, 'data', 'chats', 'broken-file-0001.json'), '{not json');
      fs.writeFileSync(path.join(home, 'data', 'settings.json'), JSON.stringify({ lang: 'en', theme: 'dark', model: 'qwen2.5:7b', systemPrompt: 'كن مختصرًا', temperature: 1.2, numCtx: 8192 }));
    },
  });
});
test.after(async () => { await S.stop(); });

test('info is public, everything else needs the session token', async () => {
  const info = await S.raw('GET', '/api/info');
  assert.equal(info.status, 200);
  assert.equal(info.json.name, 'CAF AI');
  assert.equal(info.json.site, 'https://it-caf.com');
  assert.equal(info.json.repo, 'https://github.com/iT-CAF/CAF-AI');
  assert.equal((await S.raw('GET', '/api/settings')).status, 401);
  assert.equal((await S.raw('GET', '/api/chats')).status, 401);
  assert.equal((await S.raw('GET', '/api/settings', { headers: { 'X-CAF-Token': 'nope' } })).status, 401);
  assert.equal((await S.api('GET', '/api/settings')).status, 200);
});

test('foreign Host and Origin are rejected (DNS rebinding / CSRF)', async () => {
  assert.equal((await S.raw('GET', '/', { headers: { Host: 'evil.example:80' } })).status, 403);
  const r = await S.api('PUT', '/api/settings', { body: { lang: 'ar' }, headers: { Origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
});

test('index.html carries the token meta, a strict cookie and a strict CSP', async () => {
  const r = await S.raw('GET', '/');
  assert.equal(r.status, 200);
  assert.match(r.text, new RegExp(`<meta name="caf-token" content="${S.token}">`));
  assert.match(r.headers['set-cookie'][0], /HttpOnly; SameSite=Strict/);
  assert.match(r.headers['content-security-policy'], /script-src 'self'/);
  assert.doesNotMatch(r.headers['content-security-policy'], / 'unsafe-eval'/, 'no JS eval in the app (wasm-only is fine)');
  assert.equal(r.headers['x-frame-options'], 'DENY');
});

test('v1 data is migrated with a backup, settings are preserved', async () => {
  const schema = JSON.parse(fs.readFileSync(path.join(S.home, 'data', 'schema.json'), 'utf8'));
  assert.equal(schema.version, 2);
  assert.equal(schema.history[0].from, 1);
  const backups = fs.readdirSync(path.join(S.home, 'data', 'backups'));
  assert.equal(backups.length, 1);
  const saved = JSON.parse(fs.readFileSync(path.join(S.home, 'data', 'backups', backups[0], 'chats', V1_CHAT.id + '.json'), 'utf8'));
  assert.deepEqual(saved, V1_CHAT, 'backup is byte-for-byte the v1 chat');
  // الملف التالف لا يُحذف
  assert.ok(fs.existsSync(path.join(S.home, 'data', 'chats', 'broken-file-0001.json')));
  const c = await S.api('GET', '/api/chats/' + V1_CHAT.id);
  assert.equal(c.status, 200);
  assert.equal(c.json.v, 2);
  assert.equal(c.json.title, 'محادثة قديمة');
  assert.equal(c.json.workspace, 'chat');
  assert.deepEqual(c.json.messages, V1_CHAT.messages);
  const list = await S.api('GET', '/api/chats');
  assert.equal(list.json.chats.length, 1);
  const s = await S.api('GET', '/api/settings');
  assert.equal(s.json.lang, 'en'); assert.equal(s.json.systemPrompt, 'كن مختصرًا'); assert.equal(s.json.numCtx, 8192); assert.equal(s.json.temperature, 1.2);
  assert.equal(s.json.think, 'auto');
});

test('chat streams NDJSON with a meta line first', async () => {
  const r = await S.api('POST', '/api/chat', { body: { model: 'qwen2.5:7b', messages: [{ role: 'user', content: 'سلام' }] } });
  assert.equal(r.status, 200);
  const lines = parseNdjson(r.text);
  assert.ok(lines[0].meta);
  assert.equal(lines[0].meta.model, 'qwen2.5:7b');
  const text = lines.map((l) => l.message?.content || '').join('');
  assert.equal(text, 'echo(qwen2.5:7b): سلام');
  assert.ok(lines.at(-1).done);
  // تعليمات النظام تُضاف أولًا
  const sent = S.mock.calls.filter((c) => c.path === '/api/chat').at(-1).body;
  assert.equal(sent.messages[0].role, 'system');
  assert.equal(sent.messages[0].content, 'كن مختصرًا');
});

test('missing model gives a stable error code', async () => {
  const r = await S.api('POST', '/api/chat', { body: { model: 'nope:1b', messages: [{ role: 'user', content: 'x' }] } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'model_not_installed');
});

test('chat CRUD keeps v2 fields', async () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const put = await S.api('PUT', '/api/chats/' + id, { body: { title: 'كود', workspace: 'code', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b', model: 'qwen2.5-coder:7b', route: 'code', stat: '12 tok/s', thinking: 'hmm' }] } });
  assert.equal(put.status, 200);
  const g = await S.api('GET', '/api/chats/' + id);
  assert.equal(g.json.workspace, 'code');
  assert.equal(g.json.messages[1].model, 'qwen2.5-coder:7b');
  assert.equal(g.json.messages[1].thinking, 'hmm');
  assert.equal((await S.api('GET', '/api/chats/..%2F..%2Fsettings')).status, 400);
  assert.equal((await S.api('DELETE', '/api/chats/' + id)).status, 200);
  assert.equal((await S.api('GET', '/api/chats/' + id)).status, 404);
});

test('attachments accept real images only and are served with the cookie', async () => {
  const id = '99999999-2222-3333-4444-555555555555';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const up = await S.api('POST', `/api/chats/${id}/attachments?name=dot.png`, { body: png, headers: { 'Content-Type': 'image/png' } });
  assert.equal(up.status, 200);
  assert.equal(up.json.type, 'image/png');
  const bad = await S.api('POST', `/api/chats/${id}/attachments`, { body: { dataUrl: 'data:image/png;base64,' + Buffer.from('<script>').toString('base64') } });
  assert.equal(bad.status, 400);
  assert.equal((await S.raw('GET', `/files/att/${id}/${up.json.id}`)).status, 401);
  const got = await S.raw('GET', `/files/att/${id}/${up.json.id}`, { headers: { Cookie: `caf_t=${S.token}` } });
  assert.equal(got.status, 200);
  assert.equal(got.headers['content-type'], 'image/png');
  assert.equal(Buffer.compare(got.buf, png), 0);
});

test('static files cannot escape the web root', async () => {
  assert.notEqual((await S.raw('GET', '/../package.json')).status, 200);
  assert.notEqual((await S.raw('GET', '/%2e%2e/package.json')).status, 200);
});
