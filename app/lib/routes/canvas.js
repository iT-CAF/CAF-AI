// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// لوحة الكود الجانبية (Canvas): ملفات قابلة للتعديل مع سجل نسخ لعرض الفروق.
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('../paths');
const { send, fail, readJson } = require('../http');
const { readJsonFile, writeJsonAtomic, isId } = require('../fsx');

const MAX_VERSIONS = 60;
const MAX_CONTENT = 2 * 1024 * 1024;
const file = (id) => path.join(P.canvas, id + '.json');
const clean = (s, n) => String(s ?? '').slice(0, n);

module.exports = function routes(r) {
  r.add('GET', '/api/canvas', (c) => {
    const chatId = c.url.searchParams.get('chat');
    const out = [];
    for (const f of fs.existsSync(P.canvas) ? fs.readdirSync(P.canvas) : []) {
      if (!f.endsWith('.json')) continue;
      const d = readJsonFile(path.join(P.canvas, f));
      if (d && (!chatId || d.chatId === chatId)) out.push({ id: d.id, chatId: d.chatId, name: d.name, lang: d.lang, updated: d.updated, versions: d.versions.length });
    }
    send(c.res, 200, { docs: out.sort((a, b) => b.updated - a.updated) });
  });
  r.add('GET', '/api/canvas/:id', (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    const d = readJsonFile(file(c.params.id));
    return d ? send(c.res, 200, d) : fail(c.res, 404, 'not_found');
  });
  // PUT: إنشاء/تحديث. versions تُرسل كاملة أو تُضاف نسخة واحدة عبر {append:{content,note}}
  r.add('PUT', '/api/canvas/:id', async (c) => {
    const id = c.params.id;
    if (!isId(id)) return fail(c.res, 400, 'bad_id');
    const body = await readJson(c.req, 8 * 1024 * 1024);
    const cur = readJsonFile(file(id)) || { id, versions: [], created: Date.now() };
    const doc = {
      ...cur, id,
      chatId: isId(body.chatId) ? body.chatId : cur.chatId || null,
      name: clean(body.name ?? cur.name ?? 'untitled', 200), lang: clean(body.lang ?? cur.lang ?? '', 30), updated: Date.now(),
    };
    if (Array.isArray(body.versions)) doc.versions = body.versions.slice(-MAX_VERSIONS).map((v) => ({ content: clean(v.content, MAX_CONTENT), note: clean(v.note, 300), at: Number(v.at) || Date.now() }));
    if (body.append) {
      const content = clean(body.append.content, MAX_CONTENT);
      const last = doc.versions[doc.versions.length - 1];
      if (!last || last.content !== content) doc.versions.push({ content, note: clean(body.append.note, 300), at: Date.now() });
      doc.versions = doc.versions.slice(-MAX_VERSIONS);
    }
    writeJsonAtomic(file(id), doc);
    send(c.res, 200, { ok: true, versions: doc.versions.length });
  });
  r.add('DELETE', '/api/canvas/:id', (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    try { fs.unlinkSync(file(c.params.id)); } catch { /* */ }
    send(c.res, 200, { ok: true });
  });
};
