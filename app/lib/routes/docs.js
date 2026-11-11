// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// المستندات: استخراج النص، مكتبة المعرفة (فهرسة وبحث)، ملفات النتائج المولّدة، وOCR عبر نموذج الرؤية.
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('../paths');
const { send, fail, readJson, readBody, sendFile } = require('../http');
const { isId, within, newId } = require('../fsx');
const { extract } = require('../extract');
const rag = require('../rag');
const jobs = require('../jobs');
const store = require('../store');
const catalog = require('../catalog');
const ollama = require('../providers/ollama');
const addons = require('../addons');
const engine = require('../engine');

// أفضل نموذج تضمين مثبّت (تثبيت المستخدم أولًا ثم ترتيب الكتالوج)
async function embedModel() {
  try {
    await engine.ensureEngine();
    const installed = (await ollama.listModels()).filter((m) => (m.capabilities || []).includes('embedding'));
    if (!installed.length) return null;
    const pin = store.readSettings().modelsByRole?.embed;
    if (pin && installed.some((m) => catalog.sameModel(m.name, pin))) return pin;
    installed.sort((a, b) => (catalog.find(b.name)?.rank?.embed || 1) - (catalog.find(a.name)?.rank?.embed || 1));
    return installed[0].name;
  } catch { return null; }
}
const embedFn = (model) => async (m, texts) => ollama.embed(m || model, texts);

const FILES = () => path.join(P.data, 'files');
const safeName = (n) => String(n || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 160);

module.exports = function routes(r) {
  r.add('POST', '/api/extract', async (c) => {
    const name = c.url.searchParams.get('name') || 'file';
    const buf = await readBody(c.req, 80 * 1024 * 1024);
    try {
      const out = extract(buf, name);
      if (out.text.length > 3_000_000) { out.text = out.text.slice(0, 3_000_000); out.truncated = true; }
      send(c.res, 200, out);
    } catch (e) { fail(c.res, 400, e.code === 'PDF_CLIENT' ? 'pdf_client' : e.code === 'UNSUPPORTED' ? 'unsupported_file' : 'extract_failed', e.message); }
  });

  // ---- مكتبة المعرفة ----
  r.add('GET', '/api/knowledge', async (c) => send(c.res, 200, { collections: rag.list({ includeChat: c.url.searchParams.get('all') === '1' }), embedModel: await embedModel() }));
  r.add('POST', '/api/knowledge', async (c) => { const b = await readJson(c.req); send(c.res, 200, rag.create(b.name, { scope: b.scope === 'chat' ? 'chat' : 'library', chatId: isId(b.chatId) ? b.chatId : null })); });
  r.add('GET', '/api/knowledge/:id', (c) => { const m = rag.metaOf(c.params.id); return m ? send(c.res, 200, m) : fail(c.res, 404, 'not_found'); });
  r.add('PUT', '/api/knowledge/:id', async (c) => { const m = rag.rename(c.params.id, (await readJson(c.req)).name || ''); return m ? send(c.res, 200, m) : fail(c.res, 404, 'not_found'); });
  r.add('DELETE', '/api/knowledge/:id', (c) => { rag.remove(c.params.id); send(c.res, 200, { ok: true }); });
  r.add('DELETE', '/api/knowledge/:id/docs/:doc', (c) => send(c.res, rag.removeDocument(c.params.id, c.params.doc) ? 200 : 404, { ok: true }));
  // إضافة مستند (نص مستخرج مسبقًا) ← مهمة فهرسة بالخلفية
  r.add('POST', '/api/knowledge/:id/docs', async (c) => {
    if (!rag.metaOf(c.params.id)) return fail(c.res, 404, 'not_found');
    const b = await readJson(c.req, 60 * 1024 * 1024);
    const sections = (Array.isArray(b.sections) ? b.sections : [{ text: b.text }]).map((s) => ({ text: String(s.text || ''), loc: String(s.loc || '').slice(0, 60) })).filter((s) => s.text.trim());
    if (!sections.length) return fail(c.res, 400, 'empty_doc');
    const model = await embedModel();
    const job = jobs.create('index', String(b.name || 'doc'), ({ update, signal }) => rag.addDocument(c.params.id, { name: b.name, kind: b.kind, sections }, { embed: model ? embedFn(model) : null, embedModel: model, update, signal }), { key: c.params.id });
    send(c.res, 202, { ...job, embedModel: model });
  });
  r.add('POST', '/api/knowledge/search', async (c) => {
    const b = await readJson(c.req);
    const ids = (Array.isArray(b.collections) ? b.collections : []).filter(isId);
    send(c.res, 200, { hits: await rag.search(ids, String(b.q || ''), { k: Math.min(20, Number(b.k) || 6), embed: embedFn() }) });
  });

  // ---- ملفات النتائج (تعديل Excel/Word…) محفوظة مع المحادثة ----
  r.add('POST', '/api/chats/:id/files', async (c) => {
    if (!isId(c.params.id)) return fail(c.res, 400, 'bad_id');
    const buf = await readBody(c.req, 100 * 1024 * 1024);
    const id = newId(); const name = safeName(c.url.searchParams.get('name'));
    const dir = path.join(FILES(), c.params.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${id}__${name}`), buf);
    send(c.res, 200, { id, name, size: buf.length });
  });
  r.add('GET', '/files/chat/:chat/:file', (c) => {
    if (!isId(c.params.chat) || !isId(c.params.file)) return fail(c.res, 400, 'bad_id');
    const dir = within(FILES(), c.params.chat); if (!dir || !fs.existsSync(dir)) return fail(c.res, 404, 'not_found');
    const f = fs.readdirSync(dir).find((x) => x.startsWith(c.params.file + '__'));
    if (!f) return fail(c.res, 404, 'not_found');
    const name = f.slice(c.params.file.length + 2);
    sendFile(c.req, c.res, path.join(dir, f), { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, 'Cache-Control': 'no-store' });
  }, { cookie: true });

  // ---- OCR لصفحة ممسوحة: نموذج رؤية مثبّت ----
  r.add('POST', '/api/ocr', async (c) => {
    const b = await readJson(c.req, 30 * 1024 * 1024);
    const buf = store.decodeDataUrl(b.image);
    if (!buf || !store.sniffImage(buf)) return fail(c.res, 400, 'bad_image');
    const installed = await ollama.listModels();
    const { pickModel } = require('../autoroute');
    const pick = pickModel('vision', { installed, settings: store.readSettings() });
    if (!pick.model) return fail(c.res, 400, 'no_vision_model');
    const prompt = 'استخرج كل النص الموجود في هذه الصفحة كما هو حرفيًا (عربي وإنجليزي) مع الحفاظ على ترتيب الأسطر والفقرات والجداول. لا تضف أي شرح أو تعليق.';
    try {
      const r2 = await ollama.chatOnce({ model: pick.model, messages: [{ role: 'user', content: prompt, images: [buf.toString('base64')] }], options: { temperature: 0 }, think: false });
      send(c.res, 200, { text: r2.content.trim(), model: pick.model });
    } catch (e) { fail(c.res, 500, 'ocr_failed', e.message); }
  }, { engine: true });

  // ---- أدوات المكتب لـ Pyodide (عجلات Python) ----
  r.add('GET', /^\/runtime\/office\/(?<file>[\w.+-]+\.whl)$/, (c) => {
    const f = within(addons.modelDir('office-py'), c.params.file);
    if (!f || !fs.existsSync(f)) return fail(c.res, 404, 'not_found');
    sendFile(c.req, c.res, f, { 'Content-Type': 'application/zip', 'Cache-Control': 'public, max-age=604800' });
  }, { public: true });
};

module.exports.embedModel = embedModel;
module.exports.embedFn = embedFn;
