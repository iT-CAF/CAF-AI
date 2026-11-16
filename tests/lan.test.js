// CAF AI · اختبارات «الوصول من الشبكة»: الإيقاف الافتراضي، فحص المضيف والأصل، الاقتران برمز QR وبالموافقة،
// صلاحيات الجهاز المقترن، الإلغاء الفوري، المزامنة، وحماية ‎/v1‎ — مستمع الشبكة على 127.0.0.1 بمنفذ آخر (CAF_LAN_*).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, request } = require('./helpers/server');

const LAN_PORT = 41000 + Math.floor(Math.random() * 8000);
const HOST = `127.0.0.1:${LAN_PORT}`;
let S;
test.before(async () => { S = await startServer({ env: { CAF_LAN_ADDRS: '127.0.0.1', CAF_LAN_PORT: String(LAN_PORT) } }); });
test.after(async () => { await S?.stop(); });

// طلب من «جهاز في الشبكة»: يصل إلى مستمع الشبكة لا إلى الخادم المحلي
const lanReq = (method, p, { body, headers = {} } = {}) => request(LAN_PORT, method, p, { body, headers: { Host: HOST, ...headers } });
const cookieOf = (r) => (r.headers['set-cookie'] || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('caf_d=')) || '';
const reachable = () => lanReq('GET', '/api/info').then(() => true, () => false);

test('network access is off by default: nothing listens on the network', async () => {
  assert.equal(await reachable(), false);
  const st = (await S.api('GET', '/api/lan')).json;
  assert.equal(st.role, 'owner'); assert.equal(st.enabled, false); assert.equal(st.pair, null);
});

test('enabling opens the listener; guests only see the pairing page', async () => {
  const st = (await S.api('PUT', '/api/lan', { body: { enabled: true } })).json;
  assert.equal(st.enabled, true);
  assert.ok(st.addresses.some((a) => a.address === '127.0.0.1' && a.listening), JSON.stringify(st.addresses));
  assert.match(st.pair.code, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(await reachable(), true);

  const home = await lanReq('GET', '/');
  assert.equal(home.status, 302); assert.equal(home.headers.location, '/pair');
  const pair = await lanReq('GET', '/pair');
  assert.equal(pair.status, 200); assert.match(pair.text, /pair\.js/);
  assert.doesNotMatch(pair.text, /caf-token/, 'the pairing page never carries the session token');
  assert.equal((await lanReq('GET', '/api/chats')).json.error, 'device_unpaired');
  assert.equal((await lanReq('GET', '/api/chats', { headers: { 'X-CAF-Token': S.token } })).json.error, 'device_unpaired', 'the session token alone is not enough from the network');
  const info = (await lanReq('GET', '/api/info')).json;
  assert.equal(info.name, 'CAF AI'); assert.equal(info.home, undefined, 'the data path is hidden from guests');
  assert.ok(fs.existsSync(path.join(S.home, 'data', 'lan.json')));
});

test('host and origin are checked on the network listener', async () => {
  assert.equal((await lanReq('GET', '/pair', { headers: { Host: 'evil.example' } })).status, 403, 'DNS rebinding');
  assert.equal((await lanReq('GET', '/pair', { headers: { Host: `127.0.0.1:${S.port}` } })).status, 403, 'wrong port');
  const r = await lanReq('POST', '/api/lan/request', { body: { name: 'x' }, headers: { Origin: 'http://evil.example' } });
  assert.equal(r.json.error, 'bad_origin');
  assert.equal((await S.api('POST', '/api/lan/pair', { body: { code: 'x' } })).status, 404, 'pairing exists on the network listener only');
});

test('QR pairing: wrong code fails, right code pairs once, then rotates', async () => {
  const bad = await lanReq('POST', '/api/lan/pair', { body: { code: 'wrong-code-123' }, headers: { Origin: `http://${HOST}` } });
  assert.equal(bad.status, 403); assert.equal(bad.json.error, 'bad_code');
  const { code } = (await S.api('GET', '/api/lan')).json.pair;
  const ok = await lanReq('POST', '/api/lan/pair', { body: { code, name: 'جوال الاختبار' }, headers: { Origin: `http://${HOST}`, 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' } });
  assert.equal(ok.status, 200, ok.text); assert.equal(ok.json.name, 'جوال الاختبار');
  const cookie = cookieOf(ok);
  assert.match(cookie, /^caf_d=[a-f0-9]{16}\.[A-Za-z0-9_-]{43}$/);
  assert.match(ok.headers['set-cookie'].join(';'), /HttpOnly/); assert.match(ok.headers['set-cookie'].join(';'), /SameSite=Strict/);
  const again = await lanReq('POST', '/api/lan/pair', { body: { code }, headers: { Origin: `http://${HOST}` } });
  assert.equal(again.json.error, 'bad_code', 'a QR code works for one device only');

  // الجهاز المقترن: الصفحة برمز الجلسة، والواجهة بالرمز + Cookie
  const page = await lanReq('GET', '/', { headers: { Cookie: cookie } });
  assert.equal(page.status, 200); assert.match(page.text, /name="caf-client" content="device"/);
  const token = page.text.match(/name="caf-token" content="([a-f0-9]+)"/)[1];
  const dev = (m, p, o = {}) => lanReq(m, p, { ...o, headers: { Cookie: cookie, 'X-CAF-Token': token, Origin: `http://${HOST}`, ...(o.headers || {}) } });
  assert.equal((await dev('GET', '/api/chats')).status, 200);
  assert.equal((await lanReq('GET', '/api/chats', { headers: { Cookie: cookie } })).status, 401, 'cookie alone is not enough (CSRF)');
  assert.equal((await lanReq('GET', '/pair', { headers: { Cookie: cookie } })).headers.location, '/', 'paired devices skip the pairing page');
  const me = (await dev('GET', '/api/lan')).json;
  assert.equal(me.role, 'device'); assert.equal(me.me.name, 'جوال الاختبار'); assert.equal(me.me.kind, 'mobile'); assert.equal(me.devices, undefined, 'devices do not see the device list');

  // ما يبقى لهذا الكمبيوتر فقط
  assert.equal((await dev('POST', '/api/quit')).json.error, 'owner_only');
  assert.equal((await dev('PUT', '/api/lan', { body: { enabled: false } })).json.error, 'owner_only');
  assert.equal((await dev('DELETE', '/api/lan/devices')).json.error, 'owner_only');
  assert.equal((await dev('GET', '/v1/models')).json.error, 'lan_api_blocked');

  // المزامنة: حفظ محادثة من الجوال يغيّر رقم المراجعة على الكمبيوتر
  const rev0 = (await S.api('GET', '/api/sync')).json.rev;
  const save = await dev('PUT', '/api/chats/lan-chat-1', { body: { title: 'من الجوال', messages: [{ role: 'user', content: 'مرحبا' }] } });
  assert.equal(save.status, 200, save.text); assert.ok(save.json.rev > rev0);
  const owner = (await S.api('GET', '/api/sync')).json;
  assert.ok(owner.rev > rev0); assert.equal(owner.lan.online, 1);
  assert.ok((await S.api('GET', '/api/chats')).json.chats.some((c) => c.id === 'lan-chat-1'));

  // الإلغاء فوري
  const list = (await S.api('GET', '/api/lan')).json.devices;
  assert.equal(list.length, 1); assert.equal(list[0].online, true); assert.equal(list[0].hash, undefined);
  const stored = JSON.parse(fs.readFileSync(path.join(S.home, 'data', 'lan.json'), 'utf8'));
  assert.ok(!JSON.stringify(stored).includes(cookie.split('.')[1]), 'only a hash of the device secret is stored');
  assert.equal((await S.api('DELETE', `/api/lan/devices/${list[0].id}`)).status, 200);
  assert.equal((await dev('GET', '/api/chats')).json.error, 'device_unpaired');
  assert.equal((await lanReq('GET', '/', { headers: { Cookie: cookie } })).headers.location, '/pair?e=revoked');
});

test('approval pairing: request → owner allows or declines', async () => {
  const H = { Origin: `http://${HOST}`, 'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel) Chrome/130 Mobile Safari/537.36' };
  const req1 = (await lanReq('POST', '/api/lan/request', { body: { name: 'Pixel' }, headers: H })).json;
  assert.match(req1.id, /^[a-f0-9]{16}$/);
  const poll = (r) => lanReq('GET', `/api/lan/request/${r.id}?s=${encodeURIComponent(r.secret)}`);
  assert.equal((await poll(req1)).json.status, 'pending');
  assert.equal((await lanReq('GET', `/api/lan/request/${req1.id}?s=wrong`)).json.status, 'expired', 'polling needs the request secret');
  const pending = (await S.api('GET', '/api/sync')).json.lan.pending;
  assert.equal(pending.length, 1); assert.equal(pending[0].name, 'Pixel'); assert.equal(pending[0].kind, 'mobile');
  assert.equal((await S.api('POST', `/api/lan/requests/${req1.id}`, { body: { approve: true } })).status, 200);
  const done = await poll(req1);
  assert.equal(done.json.status, 'approved'); const cookie = cookieOf(done); assert.ok(cookie);
  assert.equal((await poll(req1)).json.status, 'expired', 'the approval is delivered once');
  assert.equal((await lanReq('GET', '/', { headers: { Cookie: cookie } })).status, 200);

  const req2 = (await lanReq('POST', '/api/lan/request', { body: { name: 'Other' }, headers: { ...H, 'User-Agent': 'x' } })).json;
  await S.api('POST', `/api/lan/requests/${req2.id}`, { body: { approve: false } });
  const denied = await poll(req2);
  assert.equal(denied.json.status, 'denied'); assert.equal(cookieOf(denied), '');
  assert.equal((await S.api('POST', `/api/lan/requests/${req2.id}`, { body: { approve: true } })).json.error, 'request_expired');

  // الجهاز يفصل نفسه
  const page = await lanReq('GET', '/', { headers: { Cookie: cookie } });
  const token = page.text.match(/name="caf-token" content="([a-f0-9]+)"/)[1];
  const bye = await lanReq('DELETE', '/api/lan/me', { headers: { Cookie: cookie, 'X-CAF-Token': token, Origin: `http://${HOST}` } });
  assert.equal(bye.status, 200); assert.match(bye.headers['set-cookie'][0], /Max-Age=0/);
  assert.equal((await S.api('GET', '/api/lan')).json.devices.length, 0);
});

test('disabling closes the network listener immediately', async () => {
  const st = (await S.api('PUT', '/api/lan', { body: { enabled: false } })).json;
  assert.equal(st.enabled, false);
  assert.equal(await reachable(), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(S.home, 'data', 'lan.json'), 'utf8')).enabled, false);
});
