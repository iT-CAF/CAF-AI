// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// مسارات «الوصول من الشبكة»:
//   للأجهزة غير المقترنة (lanPublic، عبر مستمع الشبكة فقط):
//     POST /api/lan/pair            { code, name }  ← رمز QR
//     POST /api/lan/request         { name }        ← طلب وصول ينتظر موافقة هذا الجهاز
//     GET  /api/lan/request/:id?s=  حالة الطلب (عند الموافقة يُضبط Cookie الجهاز)
//   للجميع بعد الاقتران:
//     GET  /api/lan                 الحالة (تفصيلية لهذا الجهاز، مختصرة للجوال)
//     GET  /api/sync                رقم مراجعة المحادثات (لتحديث القائمة بين الأجهزة) + طلبات الوصول لهذا الجهاز
//     DELETE /api/lan/me            الجوال يفصل نفسه
//   لهذا الجهاز فقط (owner):
//     PUT  /api/lan                 { enabled }
//     POST /api/lan/code            رمز QR جديد
//     POST /api/lan/requests/:id    { approve: true|false }
//     PATCH /api/lan/devices/:id    { name }
//     DELETE /api/lan/devices/:id · DELETE /api/lan/devices
'use strict';
const { send, fail, readJson } = require('../http');
const lan = require('../lan');
const store = require('../store');

const HEX16 = /^[a-f0-9]{16}$/;

module.exports = function lanRoutes(r) {
  r.add('POST', '/api/lan/pair', async (c) => {
    const b = await readJson(c.req, 4096);
    const out = lan.pairWithCode(c.req, { code: String(b.code || ''), name: b.name });
    if (out.error) return fail(c.res, out.status, out.error);
    send(c.res, 200, { ok: true, name: out.device.name }, { 'Set-Cookie': out.cookie });
  }, { lanPublic: true });

  r.add('POST', '/api/lan/request', async (c) => {
    const b = await readJson(c.req, 4096);
    const out = lan.createRequest(c.req, { name: b.name });
    if (out.error) return fail(c.res, out.status, out.error);
    send(c.res, 200, out);
  }, { lanPublic: true });

  r.add('GET', '/api/lan/request/:id', (c) => {
    if (!HEX16.test(c.params.id)) return fail(c.res, 400, 'bad_id');
    const out = lan.pollRequest(c.req, c.params.id, String(c.url.searchParams.get('s') || ''));
    send(c.res, 200, { status: out.status }, out.cookie ? { 'Set-Cookie': out.cookie } : {});
  }, { lanPublic: true });

  r.add('GET', '/api/lan', (c) => send(c.res, 200, lan.status(c.req)));
  r.add('GET', '/api/sync', (c) => send(c.res, 200, { rev: store.rev(), ...(c.req.cafRole === 'owner' ? { lan: lan.pulse() } : {}) }));
  r.add('DELETE', '/api/lan/me', (c) => {
    if (c.req.cafRole !== 'device') return fail(c.res, 400, 'not_a_device');
    lan.revoke(c.req.cafDevice.id);
    send(c.res, 200, { ok: true }, { 'Set-Cookie': lan.clearCookie() });
  });

  r.add('PUT', '/api/lan', async (c) => {
    const b = await readJson(c.req, 4096);
    await lan.setEnabled(b.enabled === true);
    send(c.res, 200, lan.status(c.req));
  }, { owner: true });
  r.add('POST', '/api/lan/code', (c) => { lan.rotateCode(); send(c.res, 200, lan.status(c.req)); }, { owner: true });
  r.add('POST', '/api/lan/requests/:id', async (c) => {
    if (!HEX16.test(c.params.id)) return fail(c.res, 400, 'bad_id');
    const b = await readJson(c.req, 4096);
    return lan.decide(c.params.id, b.approve === true) ? send(c.res, 200, { ok: true }) : fail(c.res, 404, 'request_expired');
  }, { owner: true });
  r.add('PATCH', '/api/lan/devices/:id', async (c) => {
    if (!HEX16.test(c.params.id)) return fail(c.res, 400, 'bad_id');
    const b = await readJson(c.req, 4096);
    return lan.rename(c.params.id, b.name) ? send(c.res, 200, { ok: true }) : fail(c.res, 404, 'not_found');
  }, { owner: true });
  r.add('DELETE', '/api/lan/devices/:id', (c) => {
    if (!HEX16.test(c.params.id)) return fail(c.res, 400, 'bad_id');
    return lan.revoke(c.params.id) ? send(c.res, 200, { ok: true }) : fail(c.res, 404, 'not_found');
  }, { owner: true });
  r.add('DELETE', '/api/lan/devices', (c) => { lan.revokeAll(); send(c.res, 200, { ok: true }); }, { owner: true });
};
