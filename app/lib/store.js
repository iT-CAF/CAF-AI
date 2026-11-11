// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// طبقة البيانات: الإعدادات والمحادثات (صيغة v2 مع قراءة v1) والمرفقات.
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic, writeFileAtomic, isId, within, newId } = require('./fsx');

const CHAT_VERSION = 2;

// ---------- الإعدادات ----------
const ROLES = ['chat', 'code', 'vision', 'embed', 'image', 'stt', 'tts'];
const DEFAULT_SETTINGS = {
  lang: 'ar', theme: 'system', model: '', systemPrompt: '', temperature: 0.7, numCtx: 4096,
  // v2
  modelsByRole: { chat: '', code: '', vision: '', embed: '', image: '', stt: '', tts: '' },
  think: 'auto', codeSystemPrompt: '', imageMaxDim: 1536, imageQuality: 0.85,
  voiceEnabled: false, apiEnabled: true, wrapCode: false, ragTopK: 6, showThinking: true,
};
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = (v, max) => String(v ?? '').slice(0, max);

function sanitizeSettings(s) {
  const o = { ...DEFAULT_SETTINGS, ...s };
  if (!['ar', 'en'].includes(o.lang)) o.lang = 'ar';
  if (!['dark', 'light', 'system'].includes(o.theme)) o.theme = 'system';
  o.temperature = clamp(o.temperature, 0, 2, 0.7);
  o.numCtx = Math.round(clamp(parseInt(o.numCtx, 10), 512, 262144, 4096));
  o.systemPrompt = str(o.systemPrompt, 8000);
  o.codeSystemPrompt = str(o.codeSystemPrompt, 8000);
  o.model = str(o.model, 200);
  const mbr = {};
  for (const r of ROLES) mbr[r] = str((o.modelsByRole || {})[r], 200);
  o.modelsByRole = mbr;
  if (!['auto', 'on', 'off', 'low', 'medium', 'high'].includes(o.think)) o.think = 'auto';
  o.imageMaxDim = Math.round(clamp(o.imageMaxDim, 256, 4096, 1536));
  o.imageQuality = clamp(o.imageQuality, 0.3, 1, 0.85);
  o.ragTopK = Math.round(clamp(o.ragTopK, 1, 20, 6));
  for (const k of ['voiceEnabled', 'apiEnabled', 'wrapCode', 'showThinking']) o[k] = !!o[k];
  for (const k of Object.keys(o)) if (!(k in DEFAULT_SETTINGS)) delete o[k];
  return o;
}
const readSettings = () => sanitizeSettings(readJsonFile(P.settings, {}) || {});
function writeSettings(patch) {
  const cur = readSettings();
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (patch && k in patch) next[k] = patch[k];
  if (patch && patch.modelsByRole) next.modelsByRole = { ...cur.modelsByRole, ...patch.modelsByRole };
  const clean = sanitizeSettings(next);
  writeJsonAtomic(P.settings, clean);
  return clean;
}

// ---------- المحادثات ----------
const chatFile = (id) => path.join(P.chats, id + '.json');

function cleanImages(list) {
  return (Array.isArray(list) ? list : []).slice(0, 16).filter((x) => x && isId(x.id)).map((x) => ({
    id: x.id, name: str(x.name, 200), type: str(x.type, 40), w: Number(x.w) || 0, h: Number(x.h) || 0,
  }));
}
function cleanMessage(x) {
  const m = {
    role: ['user', 'assistant', 'system'].includes(x.role) ? x.role : 'user',
    content: String(x.content ?? ''),
  };
  if (x.model) m.model = str(x.model, 200);
  if (x.route) m.route = str(x.route, 20);
  if (x.thinking) m.thinking = String(x.thinking);
  if (x.thinkMs) m.thinkMs = Math.max(0, Math.round(Number(x.thinkMs) || 0));
  if (x.stat) m.stat = str(x.stat, 80);
  if (x.err) m.err = true;
  const imgs = cleanImages(x.images); if (imgs.length) m.images = imgs;
  if (Array.isArray(x.files) && x.files.length) {
    m.files = x.files.slice(0, 50).map((f) => ({ name: str(f.name, 300), size: Number(f.size) || 0, kind: str(f.kind, 20), chars: Number(f.chars) || 0, ...(f.collection && isId(f.collection) ? { collection: f.collection } : {}) }));
  }
  if (Array.isArray(x.sources) && x.sources.length) {
    m.sources = x.sources.slice(0, 30).map((s) => ({ n: Number(s.n) || 0, file: str(s.file, 300), loc: str(s.loc, 80), doc: str(s.doc, 64) }));
  }
  if (x.gen && Array.isArray(x.gen.images)) {
    m.gen = { images: x.gen.images.filter(isId).slice(0, 8), prompt: str(x.gen.prompt, 4000), status: str(x.gen.status, 20) };
  }
  if (Array.isArray(x.skills) && x.skills.length) m.skills = x.skills.slice(0, 3).map((k) => ({ id: str(k.id, 140), name: str(k.name, 120), emoji: str(k.emoji, 8), auto: !!k.auto }));
  if (x.context) m.context = String(x.context).slice(0, 2_000_000); // نص مستند مُرفق صغير أُدخل في السياق
  return m;
}

// يقبل صيغة v1 ({id,title,model,created,updated,messages:[{role,content}]}) ويرفعها إلى v2
function normalizeChat(c, id) {
  const now = Date.now();
  return {
    v: CHAT_VERSION,
    id: id || c.id,
    title: str(c.title, 120),
    model: str(c.model, 200),
    workspace: c.workspace === 'code' ? 'code' : 'chat',
    created: Number(c.created) || now,
    updated: Number(c.updated) || now,
    collections: (Array.isArray(c.collections) ? c.collections : []).filter(isId).slice(0, 20),
    messages: (Array.isArray(c.messages) ? c.messages : []).map(cleanMessage),
  };
}

function listChats() {
  const out = [];
  let files = [];
  try { files = fs.readdirSync(P.chats); } catch { return out; }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const c = readJsonFile(path.join(P.chats, f));
    if (!c || !c.id) continue; // ملف تالف: يُتجاهل ولا يُحذف
    out.push({ id: c.id, title: c.title, model: c.model, workspace: c.workspace || 'chat', created: c.created, updated: c.updated });
  }
  return out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
function getChat(id) {
  if (!isId(id)) return null;
  const c = readJsonFile(chatFile(id));
  return c ? normalizeChat(c, id) : null;
}
function saveChat(id, c) {
  const chat = normalizeChat({ ...c, updated: Date.now() }, id);
  writeJsonAtomic(chatFile(id), chat);
  return chat;
}
function deleteChat(id) {
  try { fs.unlinkSync(chatFile(id)); } catch { /* غير موجود */ }
  const dir = within(P.attachments, id);
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}
function deleteAllChats() {
  for (const f of fs.readdirSync(P.chats)) if (f.endsWith('.json')) deleteChat(f.slice(0, -5));
}

// ---------- المرفقات (صور المحادثة) ----------
const IMG_SIG = [
  { type: 'image/png', ext: '.png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: 'image/jpeg', ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/webp', ext: '.webp', test: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
  { type: 'image/gif', ext: '.gif', test: (b) => b.slice(0, 3).toString() === 'GIF' },
];
const sniffImage = (buf) => IMG_SIG.find((s) => buf.length > 12 && s.test(buf)) || null;

function decodeDataUrl(s) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(s || ''));
  return m ? Buffer.from(m[2], 'base64') : null;
}

function saveAttachment(chatId, buf, name) {
  if (!isId(chatId)) throw Object.assign(new Error('bad id'), { code: 'BAD_ID' });
  const sig = sniffImage(buf);
  if (!sig) throw Object.assign(new Error('not an image'), { code: 'BAD_IMAGE' });
  const id = newId();
  const dir = path.join(P.attachments, chatId);
  writeFileAtomic(path.join(dir, id + sig.ext), buf);
  return { id, name: str(name || 'image', 200), type: sig.type, size: buf.length };
}
function attachmentPath(chatId, attId) {
  if (!isId(chatId) || !isId(attId)) return null;
  const dir = within(P.attachments, chatId);
  if (!dir) return null;
  for (const s of IMG_SIG) { const f = path.join(dir, attId + s.ext); if (fs.existsSync(f)) return f; }
  return null;
}
function attachmentBase64(chatId, attId) {
  const f = attachmentPath(chatId, attId);
  return f ? fs.readFileSync(f).toString('base64') : null;
}

// صيانة عند التشغيل: مرفقات محادثات لم تُحفظ أبدًا (أُرفقت ثم أُغلقت الصفحة) وعمرها أكثر من يومين
function cleanOrphanAttachments(maxAgeMs = 2 * 86400000) {
  let removed = 0;
  let dirs = [];
  try { dirs = fs.readdirSync(P.attachments, { withFileTypes: true }); } catch { return 0; }
  for (const d of dirs) {
    if (!d.isDirectory() || !isId(d.name) || fs.existsSync(chatFile(d.name))) continue;
    const full = path.join(P.attachments, d.name);
    try { if (Date.now() - fs.statSync(full).mtimeMs > maxAgeMs) { fs.rmSync(full, { recursive: true, force: true }); removed++; } } catch { /* */ }
  }
  return removed;
}

module.exports = {
  cleanOrphanAttachments,
  CHAT_VERSION, ROLES, DEFAULT_SETTINGS, sanitizeSettings, readSettings, writeSettings,
  normalizeChat, listChats, getChat, saveChat, deleteChat, deleteAllChats, chatFile,
  sniffImage, decodeDataUrl, saveAttachment, attachmentPath, attachmentBase64,
};
