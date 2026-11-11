// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// المهارات (Agent Skills): مجلدات SKILL.md حسب المعيار المفتوح (agentskills.io)، وملفات وكلاء ‎.md‎ بترويسة YAML
// (مثل مجموعة Agency Agents). المصادر: app/skills (مضمّنة) + CAF_HOME/skills (مستوردة). تُفعَّل تلقائيًا حسب الطلب
// أو يدويًا من الواجهة، وتُضاف تعليماتها لتعليمات النظام ضمن حدّ يناسب حجم السياق.
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic, within } = require('./fsx');
const rag = require('./rag');

const BUNDLED = path.join(P.root, 'app', 'skills');
const USER = path.join(P.home, 'skills');
const STATE = path.join(P.data, 'skills.json');
// تعديلات المستخدم على المهارات المدمجة تُحفظ هنا (لا تُمسّ ملفات البرنامج، فتبقى بعد التحديثات)
const OVR = path.join(USER, '.overrides');
const ID_OK = /^[\w-]{1,64}\/[\w-]{1,64}$/;
const ovrFile = (id) => (ID_OK.test(id) ? path.join(OVR, ...id.split('/')) + '.md' : null);
const MAX_FILE = 256 * 1024;

// ترويسة YAML مبسّطة: key: value، وخريطة متداخلة بمستوى واحد (metadata)
function parseFrontmatter(text) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {}; let parent = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const ind = /^(\s+)/.exec(line);
    const kv = /^\s*([\w.-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } } else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    if (ind && parent) { meta[parent][kv[1]] = v; continue; }
    if (v === '') { meta[kv[1]] = {}; parent = kv[1]; continue; }
    parent = null; meta[kv[1]] = v;
  }
  return { meta, body: text.slice(m[0].length) };
}

const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64);

function loadDir(root, source, rootCollection = '') {
  const out = [];
  if (!fs.existsSync(root)) return out;
  (function walk(dir, depth, collection) {
    if (depth > 6) return;
    let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    // مجلد مهارة قياسي
    const std = list.find((e) => e.isFile() && e.name === 'SKILL.md');
    if (std) { const s = loadFile(path.join(dir, 'SKILL.md'), { source, collection, folder: path.basename(dir) }); if (s) out.push(s); return; }
    for (const e of list) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') walk(full, depth + 1, collection || e.name);
      else if (e.isFile() && /\.md$/i.test(e.name) && !/^(README|CHANGELOG|CONTRIBUTING|LICENSE|CODE_OF_CONDUCT|SECURITY|AGENTS|CLAUDE)\b/i.test(e.name)) {
        const s = loadFile(full, { source, collection: collection || 'skills', folder: e.name.replace(/\.md$/i, '') });
        if (s) out.push(s);
      }
    }
  })(root, 0, rootCollection);
  return out;
}

function loadFile(file, { source, collection, folder }) {
  let st; try { st = fs.statSync(file); } catch { return null; }
  if (st.size > MAX_FILE) return null;
  const text = fs.readFileSync(file, 'utf8');
  const { meta, body } = parseFrontmatter(text);
  if (!meta.name || !meta.description) return null; // المعيار يشترط الاسم والوصف
  const md = typeof meta.metadata === 'object' ? meta.metadata : {};
  const id = `${slug(collection) || 'skills'}/${slug(meta.name) || slug(folder)}`;
  return {
    id, source, collection: collection || 'skills', file,
    nameAr: md['ar-name'] || meta.name, nameEn: md['en-name'] || meta.name,
    description: String(meta.description).slice(0, 1024),
    emoji: md.emoji || meta.emoji || '', license: meta.license || '',
    workspaces: String(md.workspaces || 'chat code docs images').split(/[\s,]+/).filter(Boolean),
    triggers: String(md.triggers || '').split('|').map((x) => x.trim()).filter(Boolean),
    command: slug(md.command || '') || null,
    vibe: meta.vibe || '', chars: body.length, body: body.trim(), topEmoji: !!meta.emoji, metaName: meta.name,
  };
}

let cache = null; let cacheAt = 0;
function all({ fresh = false } = {}) {
  if (!cache || fresh || Date.now() - cacheAt > 15000) {
    const seen = new Set(); cache = [];
    for (let s of [...loadDir(path.join(BUNDLED, 'caf'), 'caf', 'caf'), ...loadDir(path.join(BUNDLED, 'community'), 'community', 'community'), ...loadDir(USER, 'user')]) {
      if (seen.has(s.id)) continue; seen.add(s.id);
      if (s.source !== 'user') {
        const of = ovrFile(s.id);
        const o = of && fs.existsSync(of) ? loadFile(of, { source: s.source, collection: s.collection, folder: path.basename(of, '.md') }) : null;
        if (o) s = { ...o, id: s.id, origFile: s.file, edited: true };
      }
      cache.push(s);
    }
    cacheAt = Date.now();
  }
  return cache;
}
const state = () => ({ disabled: [], auto: true, ...(readJsonFile(STATE) || {}) });
function setState(patch) {
  const cur = state();
  const next = { ...cur, ...patch };
  next.disabled = [...new Set((next.disabled || []).filter((x) => typeof x === 'string'))].slice(0, 5000);
  next.auto = next.auto !== false;
  writeJsonAtomic(STATE, next); return next;
}
const enabled = () => { const d = new Set(state().disabled); return all().filter((s) => !d.has(s.id)); };
const get = (id) => all().find((s) => s.id === id) || null;

// اختيار تلقائي: كلمات التفعيل (عالية الدقة) ثم تطابق الكلمات مع الاسم والوصف
function autoSelect(text, workspace = 'chat') {
  if (!text || !state().auto) return [];
  const norm = rag.normalize(text);
  const qTok = new Set(rag.tokens(text));
  let best = null;
  for (const s of enabled()) {
    if (!s.workspaces.includes(workspace)) continue; // مهارة الكتابة لا تتدخل في طلب برمجي، والعكس
    let score = 0;
    for (const tr of s.triggers) { const n = rag.normalize(tr); if (n && norm.includes(n)) score += n.length > 3 ? 3 : 2; }
    if (s.source !== 'caf') {
      const words = new Set(rag.tokens(`${s.nameEn} ${s.description}`));
      let hit = 0; for (const w of qTok) if (words.has(w)) hit++;
      score += hit >= 2 ? hit * 0.8 : 0;
    }
    if (!score) continue;
    if (s.source === 'caf') score += 0.5; // المهارات العربية المدمجة أولًا عند التساوي
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= 3 ? [best.s] : [];
}

// النص المضاف لتعليمات النظام (مقصوص ليناسب السياق)
function promptFor(list, { numCtx = 4096, lang = 'ar' } = {}) {
  if (!list.length) return null;
  const budget = Math.max(1200, Math.min(9000, Math.round(numCtx * 3.5 * 0.3)));
  const per = Math.floor(budget / list.length);
  const parts = list.map((s) => {
    let body = s.body;
    if (body.length > per) body = body.slice(0, per).replace(/\n[^\n]*$/, '') + (lang === 'en' ? '\n… (trimmed to fit the context)' : '\n… (مختصر ليناسب حجم السياق)');
    return `### ${lang === 'en' ? 'Active skill' : 'المهارة المفعّلة'}: ${lang === 'en' ? s.nameEn : s.nameAr}\n${s.description}\n\n${body}`;
  });
  const lead = lang === 'en' ? 'Follow these skill instructions for this request (they do not override the language rule):' : 'اتبع تعليمات المهارة التالية في هذا الطلب (دون تجاوز قاعدة لغة الرد):';
  return `${lead}\n\n${parts.join('\n\n---\n\n')}`;
}

function select({ text, explicit = [], workspace = 'chat' }) {
  const chosen = (Array.isArray(explicit) ? explicit : []).map(get).filter(Boolean).slice(0, 3);
  if (chosen.length) return { list: chosen, auto: false };
  return { list: autoSelect(text, workspace), auto: true };
}

// استيراد مجلد مهارات من الجهاز (مثل ‎/Applications/Agency Agents.app/Contents/Resources‎): نسخ ملفات ‎.md‎ فقط
function importFolder(src, name) {
  const real = path.resolve(String(src || ''));
  if (!fs.existsSync(real) || !fs.statSync(real).isDirectory()) throw Object.assign(new Error('folder not found'), { code: 'NOT_FOUND' });
  const found = loadDir(real, 'user');
  if (!found.length) throw Object.assign(new Error('no skills found'), { code: 'NO_SKILLS' });
  const coll = slug(name || path.basename(real).replace(/\.app$/i, '')) || 'imported';
  const dest = path.join(USER, coll);
  let n = 0; let bytes = 0;
  for (const s of found) {
    const rel = path.relative(real, s.file);
    if (rel.startsWith('..')) continue;
    const target = path.join(dest, rel);
    bytes += fs.statSync(s.file).size;
    if (bytes > 64 * 1024 * 1024) break;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(s.file, target); n++;
  }
  all({ fresh: true });
  return { collection: coll, imported: n, path: dest };
}
// استيراد ملف واحد (رفع من المتصفح)
function importText(fileName, text, collection = 'uploaded') {
  const { meta } = parseFrontmatter(text);
  if (!meta.name || !meta.description) throw Object.assign(new Error('missing name/description'), { code: 'BAD_SKILL' });
  const dir = path.join(USER, slug(collection) || 'uploaded', slug(meta.name));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), text.slice(0, MAX_FILE));
  all({ fresh: true });
  return get(`${slug(collection) || 'uploaded'}/${slug(meta.name)}`);
}
function removeCollection(coll) {
  const dir = path.join(USER, slug(coll));
  if (!dir.startsWith(USER + path.sep)) return false;
  fs.rmSync(dir, { recursive: true, force: true }); all({ fresh: true }); return true;
}

// ---------- التعديل: حقول واضحة مع رسائل تحقق (لا قصّ صامت) ----------
const LIMITS = { name: 80, description: 1024, emoji: 16, trigger: 60, triggers: 40, command: 24, body: MAX_FILE - 16 * 1024 };
const WS_ALL = ['chat', 'code', 'docs', 'images'];
const oneLine = (v) => String(v ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim();
function validate(f, body) {
  const errors = {};
  const nameAr = oneLine(f.nameAr); const nameEn = oneLine(f.nameEn);
  if (!nameAr && !nameEn) errors.nameAr = 'required';
  if (nameAr.length > LIMITS.name) errors.nameAr = 'too_long';
  if (nameEn.length > LIMITS.name) errors.nameEn = 'too_long';
  const description = oneLine(f.description);
  if (!description) errors.description = 'required'; else if (description.length > LIMITS.description) errors.description = 'too_long';
  const emoji = oneLine(f.emoji); if ([...emoji].length > 4 || emoji.length > LIMITS.emoji) errors.emoji = 'too_long';
  const triggers = (Array.isArray(f.triggers) ? f.triggers : String(f.triggers || '').split(/[|،,\n]/)).map(oneLine).filter(Boolean);
  if (triggers.length > LIMITS.triggers) errors.triggers = 'too_many'; else if (triggers.some((x) => x.length > LIMITS.trigger || x.includes('|'))) errors.triggers = 'too_long';
  const command = String(f.command || '').trim().replace(/^\//, '');
  if (command && (!/^[a-z0-9][a-z0-9-]*$/.test(command) || command.length > LIMITS.command)) errors.command = 'bad_command';
  const workspaces = (Array.isArray(f.workspaces) ? f.workspaces : WS_ALL).filter((w) => WS_ALL.includes(w));
  if (!workspaces.length) errors.workspaces = 'required';
  const text = String(body ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) errors.body = 'required'; else if (Buffer.byteLength(text) > LIMITS.body) errors.body = 'too_long';
  if (Object.keys(errors).length) throw Object.assign(new Error('invalid skill'), { code: 'INVALID', errors });
  return { nameAr, nameEn, description, emoji, triggers, command, workspaces, body: text };
}
// قيمة YAML آمنة: نصّ بسيط كما هو، وغير ذلك بين علامتي تنصيص مزدوجتين (JSON صالح في YAML)
const yamlVal = (v) => { const s = String(v); return /^[^\s'"#&*!|>%@`{}\[\],?:-][^#:\n]*$/.test(s) && !/\s$/.test(s) && !/^(true|false|null|yes|no|on|off|~|[\d.+-]+)$/i.test(s) ? s : JSON.stringify(s); };
// يعدّل الترويسة نصيًّا: يغيّر المفاتيح المطلوبة فقط ويحفظ أي مفاتيح أخرى (vibe، color، tools…) كما هي
function patchFrontmatter(text, top, nested) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const lines = m ? m[1].split(/\r?\n/) : [];
  const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [k, v] of Object.entries(top)) {
    const i = lines.findIndex((l) => new RegExp(`^${esc(k)}\\s*:`).test(l));
    if (v === null || v === '') { if (i >= 0) lines.splice(i, 1); continue; }
    if (i >= 0) lines[i] = `${k}: ${yamlVal(v)}`; else lines.push(`${k}: ${yamlVal(v)}`);
  }
  let mi = lines.findIndex((l) => /^metadata\s*:\s*$/.test(l));
  const blockEnd = () => { let j = mi + 1; while (j < lines.length && (/^\s+\S/.test(lines[j]) || !lines[j].trim())) j++; return j; };
  for (const [k, v] of Object.entries(nested)) {
    const empty = v === null || v === '';
    if (mi < 0) { if (empty) continue; lines.push('metadata:'); mi = lines.length - 1; }
    const end = blockEnd();
    let i = -1; for (let j = mi + 1; j < end; j++) if (new RegExp(`^\\s+${esc(k)}\\s*:`).test(lines[j])) { i = j; break; }
    if (empty) { if (i >= 0) lines.splice(i, 1); continue; }
    const ind = (i >= 0 ? /^(\s+)/.exec(lines[i])[1] : lines[mi + 1] && /^(\s+)\S/.exec(lines[mi + 1])?.[1]) || '  ';
    const line = `${ind}${k}: ${yamlVal(v)}`;
    if (i >= 0) lines[i] = line; else lines.splice(end, 0, line);
  }
  if (mi >= 0 && blockEnd() === mi + 1) lines.splice(mi, 1); // metadata فارغة
  return { fm: lines.join('\n') };
}
function compose(raw, v, metaName) {
  const { meta } = parseFrontmatter(raw);
  const topEmoji = !!meta.emoji;
  const wsDefault = v.workspaces.length === WS_ALL.length;
  const top = { name: metaName, description: v.description, ...(topEmoji ? { emoji: v.emoji } : {}) };
  const nested = {
    'ar-name': v.nameAr && v.nameAr !== metaName ? v.nameAr : null,
    'en-name': v.nameEn && v.nameEn !== metaName ? v.nameEn : null,
    ...(topEmoji ? {} : { emoji: v.emoji || null }),
    workspaces: wsDefault ? null : v.workspaces.join(' '),
    triggers: v.triggers.length ? v.triggers.join(' | ') : null,
    command: v.command || null,
  };
  const { fm } = patchFrontmatter(raw, top, nested);
  return `---\n${fm}\n---\n\n${v.body}\n`;
}
const rawOf = (s) => { try { return fs.readFileSync(s.file, 'utf8'); } catch { return ''; } };
// حفظ: المستوردة تُكتب في ملفها داخل مجلد البيانات، والمدمجة نسخة معدّلة في ‎.overrides‎
function save(id, fields, body) {
  const s = get(id); if (!s) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
  const v = validate(fields, body);
  const out = compose(rawOf(s), v, s.metaName);
  let target;
  if (s.source === 'user') { target = within(USER, path.relative(USER, s.file)); if (!target || target.startsWith(OVR + path.sep)) throw Object.assign(new Error('bad path'), { code: 'FORBIDDEN' }); }
  else target = ovrFile(id);
  if (!target) throw Object.assign(new Error('bad id'), { code: 'FORBIDDEN' });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, out);
  all({ fresh: true });
  return get(id);
}
// مهارة جديدة من الصفر في مجموعة «my-skills»
function create(fields, body) {
  const v = validate(fields, body);
  let base = slug(v.nameEn) || slug(v.command) || 'skill-' + Date.now().toString(36);
  const root = path.join(USER, 'my-skills');
  let name = base; let n = 2;
  while (get(`my-skills/${name}`) || fs.existsSync(path.join(root, name))) name = `${base}-${n++}`;
  const raw = `---\nname: ${name}\ndescription: x\n---\n`;
  const dir = path.join(root, name); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), compose(raw, v, name));
  all({ fresh: true });
  return get(`my-skills/${name}`);
}
// المدمجة المعدّلة: استعادة الأصل. المستوردة: حذف ملفها (ومجلدها إن كان مجلد مهارة قياسيًا)
function removeSkill(id) {
  const s = get(id); if (!s) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
  if (s.source !== 'user') {
    if (!s.edited) throw Object.assign(new Error('bundled'), { code: 'BUNDLED' });
    fs.rmSync(ovrFile(id), { force: true }); all({ fresh: true }); return { reset: true, skill: get(id) };
  }
  const f = within(USER, path.relative(USER, s.file)); if (!f) throw Object.assign(new Error('bad path'), { code: 'FORBIDDEN' });
  if (path.basename(f) === 'SKILL.md' && path.dirname(f) !== USER) fs.rmSync(path.dirname(f), { recursive: true, force: true }); else fs.rmSync(f, { force: true });
  all({ fresh: true }); return { removed: true };
}
const detail = (s, disabled) => ({ ...summary(s, disabled), body: s.body, triggers: s.triggers, vibe: s.vibe, edited: !!s.edited, raw: rawOf(s),
  file: s.source === 'user' ? path.relative(P.home, s.file) : s.edited ? path.relative(P.home, s.file) : path.relative(P.root, s.file),
  deletable: s.source === 'user', resettable: s.source !== 'user' && !!s.edited, limits: LIMITS });

const summary = (s, disabled) => ({ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, description: s.description, emoji: s.emoji, source: s.source, collection: s.collection, license: s.license, workspaces: s.workspaces, command: s.command, chars: s.chars, edited: !!s.edited, enabled: !disabled.has(s.id) });

module.exports = { parseFrontmatter, patchFrontmatter, all, get, enabled, select, autoSelect, promptFor, importFolder, importText, removeCollection, save, create, removeSkill, detail, state, setState, summary, USER, BUNDLED };
