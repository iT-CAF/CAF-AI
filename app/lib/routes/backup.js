// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// تصدير المحادثة (Markdown، أو zip مع صورها) + النسخ الاحتياطي والاستعادة.
'use strict';
const fs = require('fs');
const path = require('path');
const { send, fail, readBody } = require('../http');
const { isId } = require('../fsx');
const { P } = require('../paths');
const store = require('../store');
const backup = require('../backup');
const { createZip } = require('../archive');
const pkg = require('../../../package.json');

// اسم ملف آمن + ترويسة تدعم العربية (RFC 5987)
const fileName = (s, ext) => (String(s || 'chat').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'chat') + ext;
const disposition = (name) => `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;
const stamp = () => new Date().toISOString().slice(0, 10);

function chatMarkdown(chat, lang) {
  const ar = lang !== 'en';
  const imgs = []; const out = [];
  out.push(`# ${chat.title || (ar ? 'محادثة' : 'Chat')}`, '', `> ${ar ? 'صُدّرت من كآف AI' : 'Exported from CAF AI'} · ${new Date(chat.updated || chat.created || Date.now()).toLocaleString(ar ? 'ar' : 'en')} · https://it-caf.com`, '');
  for (const m of chat.messages || []) {
    if (m.role === 'system') continue;
    const who = m.role === 'user' ? (ar ? 'أنت' : 'You') : `${ar ? 'كآف AI' : 'CAF AI'}${m.model ? ` · \`${m.model}\`` : ''}`;
    out.push('---', '', `**${who}**`, '');
    let content = String(m.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (m.errCode) content = `> ⚠ ${m.errCode}`;
    out.push(content || '');
    for (const im of m.images || []) {
      const f = store.attachmentPath(chat.id, im.id);
      if (f) { const name = `images/${im.id}${path.extname(f)}`; imgs.push({ name, file: f }); out.push('', `![${im.name || im.id}](${name})`); }
    }
    for (const id of m.gen?.images || []) {
      const f = path.join(P.images, id + '.png');
      if (isId(id) && fs.existsSync(f)) { const name = `images/${id}.png`; imgs.push({ name, file: f }); out.push('', `![${(m.gen.prompt || '').slice(0, 80)}](${name})`); }
    }
    if (m.sources?.length) out.push('', (ar ? '**المصادر:** ' : '**Sources:** ') + m.sources.map((s) => `[${s.n}] ${s.file}${s.loc ? ` (${s.loc})` : ''}`).join(' · '));
    out.push('');
  }
  out.push('---', '', ar ? '_كآف AI — ذكاء اصطناعي محلي بالكامل · برمجة وتصميم كآف · https://it-caf.com · https://github.com/iT-CAF/CAF-AI_' : '_CAF AI — fully local AI · by CAF · https://it-caf.com · https://github.com/iT-CAF/CAF-AI_');
  return { md: out.join('\n'), imgs };
}

module.exports = function routes(r, ctx) {
  r.add('GET', '/api/chats/:id/export', (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    const chat = store.getChat(c.params.id); if (!chat) return fail(c.res, 404, 'not_found');
    const { md, imgs } = chatMarkdown(chat, store.readSettings().lang);
    const base = fileName(chat.title, '');
    if (!imgs.length) {
      c.res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': disposition(base + '.md'), 'Cache-Control': 'no-store' });
      return c.res.end(md);
    }
    const zip = createZip([{ name: 'chat.md', data: Buffer.from(md) }, ...imgs.map((i) => ({ name: i.name, data: fs.readFileSync(i.file) }))]);
    c.res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': disposition(base + '.zip'), 'Content-Length': zip.length, 'Cache-Control': 'no-store' });
    c.res.end(zip);
  });

  r.add('GET', '/api/backup/summary', (c) => send(c.res, 200, backup.summary()));
  r.add('GET', '/api/backup', (c) => {
    try {
      const { zip } = backup.create(pkg.version);
      c.res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': disposition(`CAF-AI-backup-${stamp()}.zip`), 'Content-Length': zip.length, 'Cache-Control': 'no-store' });
      c.res.end(zip);
    } catch (e) { fail(c.res, e.code === 'TOO_LARGE' ? 413 : 500, e.code === 'TOO_LARGE' ? 'backup_too_large' : 'backup_failed', e.message); }
  });
  // الاستعادة: تحقق → نقل الحالي إلى نسخة أمان → استخراج → إعادة تشغيل
  r.add('POST', '/api/backup/restore', async (c) => {
    let buf; try { buf = await readBody(c.req, backup.MAX_BYTES + 64 * 1024 * 1024); } catch (e) { return fail(c.res, 413, 'backup_too_large'); }
    const dry = c.url.searchParams.get('check') === '1';
    try {
      if (dry) { const { manifest, files, total } = backup.inspect(buf); return send(c.res, 200, { ok: true, manifest, files: files.length, bytes: total }); }
      const out = backup.restore(buf);
      send(c.res, 200, { ...out, restart: true });
      if (process.env.CAF_NO_RESTART !== '1') setTimeout(() => require('../updater').restart(ctx.shutdown), 600);
    } catch (e) { fail(c.res, 400, String(e.code || 'restore_failed').toLowerCase(), e.message); }
  });
};
