// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// المسارات الأساسية: المعلومات، الإعدادات، النماذج، المحادثات، المرفقات، الإيقاف.
'use strict';
const { VERSION, P } = require('../paths');
const { send, fail, readJson, readBody, sendFile, ndjson } = require('../http');
const store = require('../store');
const providers = require('../providers');
const ollama = require('../providers/ollama');
const { isId } = require('../fsx');

const NAME_RE = /^[\w.\-:/]{1,120}$/;

module.exports = function core(r, ctx) {
  r.add('GET', '/api/info', (c) => send(c.res, 200, {
    name: 'CAF AI', version: VERSION, owner: 'iT CAF', year: new Date().getFullYear(),
    site: 'https://it-caf.com', repo: 'https://github.com/iT-CAF/CAF-AI', store: 'https://store.it-caf.com',
    platform: process.platform, arch: process.arch, home: P.home,
  }), { public: true });

  r.add('GET', '/api/settings', (c) => send(c.res, 200, store.readSettings()));
  r.add('PUT', '/api/settings', async (c) => send(c.res, 200, store.writeSettings(await readJson(c.req))));

  r.add('GET', '/api/providers', async (c) => send(c.res, 200, { providers: await providers.statusAll() }));

  // ---- النماذج ----
  r.add('GET', '/api/models', async (c) => send(c.res, 200, { models: await ollama.listModels() }), { engine: true });
  r.add('POST', '/api/models/pull', async (c) => {
    const { name } = await readJson(c.req);
    if (!NAME_RE.test(name || '')) return fail(c.res, 400, 'bad_name');
    const out = ndjson(c.res);
    const ac = new AbortController();
    c.res.on('close', () => ac.abort());
    try {
      await ollama.pullStream(name, { signal: ac.signal, onLine: (j) => out.write(j) });
      out.end();
    } catch (e) {
      if (e.name !== 'AbortError') out.end({ error: mapPullError(e.message) });
    }
  }, { engine: true });
  r.add('DELETE', '/api/models', async (c) => {
    const { name } = await readJson(c.req);
    if (!NAME_RE.test(name || '')) return fail(c.res, 400, 'bad_name');
    const ok = await ollama.remove(name);
    send(c.res, ok ? 200 : 500, { ok });
  }, { engine: true });
  r.add('POST', '/api/models/show', async (c) => {
    const { name } = await readJson(c.req);
    if (!NAME_RE.test(name || '')) return fail(c.res, 400, 'bad_name');
    send(c.res, 200, await ollama.show(name));
  }, { engine: true });

  // ---- المحادثة ----
  r.add('POST', '/api/chat', (c) => ctx.chat.handle(c), { engine: true });

  // ---- المحادثات المحفوظة ----
  r.add('GET', '/api/chats', (c) => send(c.res, 200, { chats: store.listChats() }));
  r.add('DELETE', '/api/chats', (c) => { store.deleteAllChats(); send(c.res, 200, { ok: true }); });
  r.add('GET', '/api/chats/:id', (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    const chat = store.getChat(c.params.id);
    return chat ? send(c.res, 200, chat) : fail(c.res, 404, 'not_found');
  });
  r.add('PUT', '/api/chats/:id', async (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    const chat = store.saveChat(c.params.id, await readJson(c.req));
    send(c.res, 200, { ok: true, updated: chat.updated });
  });
  r.add('DELETE', '/api/chats/:id', (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    store.deleteChat(c.params.id); send(c.res, 200, { ok: true });
  });

  // ---- المرفقات: صورة خام (image/*) أو dataURL في JSON ----
  r.add('POST', '/api/chats/:id/attachments', async (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    const type = (c.req.headers['content-type'] || '').split(';')[0];
    let buf; let name = String(c.url.searchParams.get('name') || 'image');
    if (type.startsWith('image/')) buf = await readBody(c.req, 25 * 1024 * 1024);
    else { const j = await readJson(c.req, 34 * 1024 * 1024); buf = store.decodeDataUrl(j.dataUrl); name = j.name || name; }
    if (!buf) return fail(c.res, 400, 'bad_image');
    try { send(c.res, 200, store.saveAttachment(c.params.id, buf, name)); }
    catch (e) { fail(c.res, 400, e.code === 'BAD_IMAGE' ? 'bad_image' : 'save_failed', e.message); }
  });
  r.add('GET', '/files/att/:chat/:att', (c) => {
    const f = store.attachmentPath(c.params.chat, String(c.params.att).replace(/\.\w+$/, ''));
    return f ? sendFile(c.req, c.res, f) : fail(c.res, 404, 'not_found');
  }, { cookie: true });

  r.add('POST', '/api/quit', (c) => { send(c.res, 200, { ok: true }); setTimeout(() => ctx.shutdown(0), 200); });
};

function mapPullError(msg) {
  const m = String(msg || '');
  if (/no space|ENOSPC|disk/i.test(m)) return 'disk_full';
  if (/not found|file does not exist|manifest unknown/i.test(m)) return 'model_not_found';
  if (/dial|connect|timeout|network|lookup|EAI_AGAIN|ENOTFOUND/i.test(m)) return 'network';
  return m || 'pull_failed';
}
module.exports.mapPullError = mapPullError;
