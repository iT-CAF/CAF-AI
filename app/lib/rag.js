// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// مكتبة المعرفة (RAG) محليًا: تقسيم ← تضمين عبر Ollama ← بحث هجين (متجهات + كلمات مع تطبيع عربي) ← مصادر مرقّمة.
// التخزين: data/knowledge/<id>/{meta.json, chunks.jsonl, vectors.f32}
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic, writeFileAtomic, newId, isId, within } = require('./fsx');

const CHUNK = 900; const OVERLAP = 150;

// ---------- تطبيع النص العربي للبحث بالكلمات ----------
function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}
const STOP = new Set(['في', 'من', 'على', 'الى', 'الي', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'ما', 'هل', 'او', 'ثم', 'كل', 'كان', 'قد', 'لا', 'ان', 'انا', 'هو', 'هي', 'the', 'a', 'an', 'of', 'to', 'in', 'is', 'and', 'or', 'for', 'on', 'what', 'how', 'with']);
function tokens(s) {
  return normalize(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => (w.length > 4 && w.startsWith('ال') ? w.slice(2) : w));
}

// ---------- التقسيم ----------
// sections: [{ text, loc }] (صفحة PDF، ورقة Excel، أو المستند كاملًا) → قطع مع الحفاظ على الفقرات
function chunkSections(sections) {
  const out = [];
  for (const sec of sections) {
    const paras = String(sec.text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buf = '';
    const flush = () => { if (buf.trim()) out.push({ text: buf.trim(), loc: sec.loc || '' }); };
    for (const p of paras) {
      if (p.length > CHUNK * 1.5) {
        flush(); buf = '';
        for (let i = 0; i < p.length; i += CHUNK - OVERLAP) out.push({ text: p.slice(i, i + CHUNK), loc: sec.loc || '' });
        continue;
      }
      if ((buf + '\n\n' + p).length > CHUNK) { flush(); buf = buf.slice(-OVERLAP) + '\n\n' + p; }
      else buf = buf ? buf + '\n\n' + p : p;
    }
    flush();
  }
  return out;
}

// ---------- التخزين ----------
const dirOf = (id) => (isId(id) ? within(P.knowledge, id) : null);
const metaOf = (id) => { const d = dirOf(id); return d ? readJsonFile(path.join(d, 'meta.json')) : null; };
function list({ includeChat = true } = {}) {
  let ids = [];
  try { ids = fs.readdirSync(P.knowledge); } catch { return []; }
  return ids.map(metaOf).filter((m) => m && (includeChat || m.scope !== 'chat'))
    .map((m) => ({ id: m.id, name: m.name, scope: m.scope || 'library', chatId: m.chatId || null, created: m.created, updated: m.updated, docs: m.docs.length, chunks: m.docs.reduce((a, d) => a + d.chunks, 0), embedModel: m.embedModel || null }))
    .sort((a, b) => b.updated - a.updated);
}
function create(name, { scope = 'library', chatId = null } = {}) {
  const id = newId(); const d = path.join(P.knowledge, id);
  fs.mkdirSync(d, { recursive: true });
  const meta = { id, name: String(name || 'مكتبة').slice(0, 120), scope, chatId, created: Date.now(), updated: Date.now(), embedModel: null, dim: 0, docs: [] };
  writeJsonAtomic(path.join(d, 'meta.json'), meta);
  return meta;
}
function remove(id) { const d = dirOf(id); if (d) fs.rmSync(d, { recursive: true, force: true }); }
function rename(id, name) { const m = metaOf(id); if (!m) return null; m.name = String(name).slice(0, 120); m.updated = Date.now(); writeJsonAtomic(path.join(dirOf(id), 'meta.json'), m); return m; }

function readChunks(id) {
  const d = dirOf(id); if (!d) return [];
  try { return fs.readFileSync(path.join(d, 'chunks.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}
function readVectors(id, dim) {
  const d = dirOf(id); if (!d || !dim) return null;
  try { const b = fs.readFileSync(path.join(d, 'vectors.f32')); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); } catch { return null; }
}
function rewrite(id, chunks, vectors) {
  const d = dirOf(id);
  writeFileAtomic(path.join(d, 'chunks.jsonl'), chunks.map((c) => JSON.stringify(c)).join('\n') + (chunks.length ? '\n' : ''));
  if (vectors) writeFileAtomic(path.join(d, 'vectors.f32'), Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength));
  else fs.rmSync(path.join(d, 'vectors.f32'), { force: true });
}

const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); };

// إضافة مستند: sections = [{text, loc}] — embed(model, texts) دالة اختيارية (بدونها: بحث بالكلمات فقط)
async function addDocument(id, { name, kind, sections }, { embed = null, embedModel = null, update = () => {}, signal } = {}) {
  const meta = metaOf(id);
  if (!meta) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
  const pieces = chunkSections(sections);
  if (!pieces.length) throw Object.assign(new Error('empty document'), { code: 'EMPTY_DOC' });
  const docId = newId();
  const chunks = readChunks(id);
  let vectors = meta.dim ? readVectors(id, meta.dim) : null;
  // تغيّر نموذج التضمين؟ نعيد تضمين المكتبة كاملة لتبقى المتجهات متسقة
  const reembedAll = embed && embedModel && meta.embedModel && meta.embedModel !== embedModel;
  const newChunks = pieces.map((p, i) => ({ doc: docId, i, text: p.text, loc: p.loc }));
  const all = [...chunks, ...newChunks];
  let outVecs = null;
  if (embed && embedModel) {
    const toEmbed = reembedAll || !vectors ? all : newChunks;
    const B = 16; const embs = [];
    for (let i = 0; i < toEmbed.length; i += B) {
      if (signal?.aborted) throw Object.assign(new Error('canceled'), { code: 'CANCELED' });
      const batch = toEmbed.slice(i, i + B).map((c) => c.text);
      embs.push(...(await embed(embedModel, batch)));
      update({ text: 'embed', completed: Math.min(i + B, toEmbed.length), total: toEmbed.length });
    }
    const dim = embs[0]?.length || 0;
    const base = reembedAll || !vectors ? [] : [vectors];
    const flat = new Float32Array((base[0]?.length || 0) + embs.length * dim);
    if (base[0]) flat.set(base[0], 0);
    embs.forEach((v, k) => flat.set(norm(v), (base[0]?.length || 0) + k * dim));
    outVecs = flat; meta.dim = dim; meta.embedModel = embedModel;
  } else if (vectors && chunks.length) {
    // لا نموذج تضمين الآن لكن المكتبة مُضمَّنة: نعلّم المستند الجديد بلا متجهات بتقطيع البحث للكلمات
    outVecs = null; meta.dim = 0; meta.embedModel = null;
  }
  rewrite(id, all, outVecs);
  meta.docs.push({ id: docId, name: String(name).slice(0, 300), kind: kind || 'txt', chars: sections.reduce((a, s) => a + String(s.text || '').length, 0), chunks: newChunks.length, added: Date.now() });
  meta.updated = Date.now();
  writeJsonAtomic(path.join(dirOf(id), 'meta.json'), meta);
  return meta.docs[meta.docs.length - 1];
}

function removeDocument(id, docId) {
  const meta = metaOf(id); if (!meta) return false;
  const chunks = readChunks(id);
  const vectors = meta.dim ? readVectors(id, meta.dim) : null;
  const keep = []; const keepVec = [];
  chunks.forEach((c, k) => { if (c.doc !== docId) { keep.push(c); if (vectors) keepVec.push(vectors.subarray(k * meta.dim, (k + 1) * meta.dim)); } });
  let flat = null;
  if (vectors) { flat = new Float32Array(keepVec.length * meta.dim); keepVec.forEach((v, k) => flat.set(v, k * meta.dim)); }
  rewrite(id, keep, flat);
  meta.docs = meta.docs.filter((d) => d.id !== docId); meta.updated = Date.now();
  writeJsonAtomic(path.join(dirOf(id), 'meta.json'), meta);
  return true;
}

// بحث هجين في مجموعة أو أكثر → [{ score, text, loc, docName, docId, collection }]
async function search(ids, query, { k = 6, embed = null } = {}) {
  const qTok = tokens(query);
  const results = [];
  for (const id of ids) {
    const meta = metaOf(id); if (!meta) continue;
    const chunks = readChunks(id); if (!chunks.length) continue;
    const docName = Object.fromEntries(meta.docs.map((d) => [d.id, d.name]));
    // كلمات: BM25 مبسّط
    const N = chunks.length; const df = new Map();
    const toks = chunks.map((c) => { const t = tokens(c.text); for (const w of new Set(t)) df.set(w, (df.get(w) || 0) + 1); return t; });
    const avg = toks.reduce((a, t) => a + t.length, 0) / N || 1;
    const kw = toks.map((t) => {
      let s = 0; const tf = new Map(); for (const w of t) tf.set(w, (tf.get(w) || 0) + 1);
      for (const q of qTok) { const f = tf.get(q); if (!f) continue; const idf = Math.log(1 + (N - df.get(q) + 0.5) / (df.get(q) + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * t.length / avg)); }
      return s;
    });
    const kwMax = Math.max(...kw, 1e-9);
    // متجهات
    let vec = null;
    if (embed && meta.embedModel && meta.dim) {
      const vectors = readVectors(id, meta.dim);
      try {
        const [qv] = await embed(meta.embedModel, [query]);
        if (vectors && qv && qv.length === meta.dim) {
          const q = norm(qv); vec = new Float32Array(N);
          for (let i = 0; i < N; i++) { let s = 0; const o = i * meta.dim; for (let j = 0; j < meta.dim; j++) s += q[j] * vectors[o + j]; vec[i] = s; }
        }
      } catch { /* نموذج التضمين غير متاح: نكمل بالكلمات */ }
    }
    chunks.forEach((c, i) => {
      const score = vec ? 0.72 * vec[i] + 0.28 * (kw[i] / kwMax) : kw[i] / kwMax;
      if (score > 0) results.push({ score, text: c.text, loc: c.loc, docId: c.doc, docName: docName[c.doc] || '', collection: id });
    });
  }
  results.sort((a, b) => b.score - a.score);
  // تنويع: لا أكثر من 3 قطع من المستند نفسه
  const per = new Map(); const out = [];
  for (const r of results) { const n = per.get(r.docId) || 0; if (n >= 3) continue; per.set(r.docId, n + 1); out.push(r); if (out.length >= k) break; }
  return out;
}

// يبني سياق المصادر المرقّمة للنموذج
function contextBlock(hits, lang = 'ar') {
  if (!hits.length) return null;
  const head = lang === 'en'
    ? 'Excerpts from the user\'s knowledge library are below. Answer from them, and cite sources with [n] right after the information. If the answer is not in them, say so clearly.'
    : 'فيما يلي مقتطفات من مكتبة معرفة المستخدم. أجب اعتمادًا عليها، واذكر المصدر بصيغة [n] بعد المعلومة مباشرة. إن لم تجد الإجابة فيها فقل ذلك بوضوح ولا تخترع.';
  return head + '\n\n' + hits.map((h, i) => `[${i + 1}] (${h.docName}${h.loc ? ' · ' + h.loc : ''})\n${h.text}`).join('\n\n---\n\n');
}

module.exports = { normalize, tokens, chunkSections, list, create, remove, rename, metaOf, readChunks, addDocument, removeDocument, search, contextBlock };
