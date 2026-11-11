// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// المهارات (Agent Skills): مجلدات SKILL.md حسب المعيار المفتوح (agentskills.io)، وملفات وكلاء ‎.md‎ بترويسة YAML
// (مثل مجموعة Agency Agents). المصادر: app/skills (مضمّنة) + CAF_HOME/skills (مستوردة). تُفعَّل تلقائيًا حسب الطلب
// أو يدويًا من الواجهة، وتُضاف تعليماتها لتعليمات النظام ضمن حدّ يناسب حجم السياق.
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic } = require('./fsx');
const rag = require('./rag');

const BUNDLED = path.join(P.root, 'app', 'skills');
const USER = path.join(P.home, 'skills');
const STATE = path.join(P.data, 'skills.json');
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
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
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
    vibe: meta.vibe || '', chars: body.length, body: body.trim(),
  };
}

let cache = null; let cacheAt = 0;
function all({ fresh = false } = {}) {
  if (!cache || fresh || Date.now() - cacheAt > 15000) {
    const seen = new Set(); cache = [];
    for (const s of [...loadDir(path.join(BUNDLED, 'caf'), 'caf', 'caf'), ...loadDir(path.join(BUNDLED, 'community'), 'community', 'community'), ...loadDir(USER, 'user')]) {
      if (seen.has(s.id)) continue; seen.add(s.id); cache.push(s);
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
    let score = 0;
    for (const tr of s.triggers) { const n = rag.normalize(tr); if (n && norm.includes(n)) score += n.length > 3 ? 3 : 2; }
    if (s.source !== 'caf') {
      const words = new Set(rag.tokens(`${s.nameEn} ${s.description}`));
      let hit = 0; for (const w of qTok) if (words.has(w)) hit++;
      score += hit >= 2 ? hit * 0.8 : 0;
    }
    if (!score) continue;
    if (s.workspaces.includes(workspace)) score += 1;
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

const summary = (s, disabled) => ({ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, description: s.description, emoji: s.emoji, source: s.source, collection: s.collection, license: s.license, workspaces: s.workspaces, command: s.command, chars: s.chars, enabled: !disabled.has(s.id) });

module.exports = { parseFrontmatter, all, get, enabled, select, autoSelect, promptFor, importFolder, importText, removeCollection, state, setState, summary, USER, BUNDLED };
