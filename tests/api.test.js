// CAF AI · اختبارات الواجهة المحلية المتوافقة مع OpenAI (‎/v1‎): الإيقاف الافتراضي، المفتاح، Origin، المحادثة (دفعة/بث)، التضمين.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

let S; let KEY;
test.before(async () => { S = await startServer(); });
test.after(async () => { await S?.stop(); });
const v1 = (method, p, body, headers = {}) => S.raw(method, p, { body, headers: { Authorization: `Bearer ${KEY}`, ...headers } });

test('the API is off by default and needs the local key', async () => {
  KEY = (await S.api('GET', '/api/apikey')).json.key;
  assert.match(KEY, /^caf-[a-f0-9]{40}$/);
  assert.equal((await v1('GET', '/v1/models')).json.error.code, 'api_disabled');
  await S.api('PUT', '/api/settings', { body: { apiEnabled: true } });
  assert.equal((await S.raw('GET', '/v1/models')).status, 401, 'no key');
  assert.equal((await S.raw('GET', '/v1/models', { headers: { Authorization: 'Bearer caf-' + '0'.repeat(40) } })).status, 401, 'wrong key');
  assert.equal((await S.raw('GET', '/v1/models', { headers: { 'X-CAF-Token': S.token } })).status, 401, 'session token is not an API key');
  assert.equal((await v1('POST', '/v1/chat/completions', { messages: [{ role: 'user', content: 'x' }] }, { Origin: 'https://evil.example' })).json.error, 'bad_origin');
});

test('models, chat (auto / named / stream), embeddings', async () => {
  const models = (await v1('GET', '/v1/models')).json;
  assert.equal(models.object, 'list'); assert.equal(models.data[0].id, 'auto');
  assert.ok(models.data.some((m) => m.id === 'qwen2.5:7b'));
  const r = await v1('POST', '/v1/chat/completions', { model: 'auto', messages: [{ role: 'user', content: 'مرحبا' }] });
  assert.equal(r.status, 200, r.text); assert.match(r.json.choices[0].message.content, /^v1\(.+\): مرحبا$/);
  const code = await v1('POST', '/v1/chat/completions', { messages: [{ role: 'user', content: 'اكتب دالة بايثون تعكس نصًا' }] });
  assert.match(code.json.choices[0].message.content, /^v1\(qwen2\.5-coder:7b\)/, 'auto routes code requests to the coder model');
  const named = await v1('POST', '/v1/chat/completions', { model: 'qwen2.5:7b', messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(named.json.model, 'qwen2.5:7b');
  const vision = await v1('POST', '/v1/chat/completions', { messages: [{ role: 'user', content: [{ type: 'text', text: 'صف' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } }] }] });
  assert.match(vision.json.choices[0].message.content, /^v1\(qwen3\.5:4b\): text\+image_url/, 'images go to a vision model');
  const st = await v1('POST', '/v1/chat/completions', { stream: true, messages: [{ role: 'user', content: 'بث' }] });
  assert.match(st.headers['content-type'], /event-stream/); assert.match(st.text, /data: \[DONE\]/);
  const bad = await v1('POST', '/v1/chat/completions', { model: 'nope:1b', messages: [{ role: 'user', content: 'x' }] });
  assert.equal(bad.status, 404); assert.equal(bad.json.error.code, 'model_not_found');
  assert.equal((await v1('POST', '/v1/chat/completions', { messages: [] })).status, 400);
  const emb = await v1('POST', '/v1/embeddings', { model: 'auto', input: ['نص أول', 'second'] });
  assert.equal(emb.json.data.length, 2); assert.equal(emb.json.model, 'qwen3-embedding:0.6b');
  const img = await v1('POST', '/v1/images/generations', { prompt: 'a cat' });
  assert.equal(img.status, 404); assert.match(img.json.error.message, /not installed/);
});

test('rotating the key revokes the old one', async () => {
  const old = KEY;
  KEY = (await S.api('POST', '/api/apikey/rotate')).json.key;
  assert.notEqual(KEY, old);
  assert.equal((await S.raw('GET', '/v1/models', { headers: { Authorization: `Bearer ${old}` } })).status, 401);
  assert.equal((await v1('GET', '/v1/models')).status, 200);
});
