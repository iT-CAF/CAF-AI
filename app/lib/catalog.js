// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// كتالوج النماذج والتوصية حسب الجهاز. الملف المضمّن app/catalog/models.json، ونسخة أحدث اختيارية في data/catalog.json.
'use strict';
const path = require('path');
const https = require('https');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic } = require('./fsx');

const ROLES = ['chat', 'code', 'vision', 'embed', 'stt'];
const UPDATE_URL = 'https://raw.githubusercontent.com/iT-CAF/CAF-AI/main/app/catalog/models.json';

function validCatalog(c) {
  return c && c.schema === 1 && Array.isArray(c.models) && c.models.every((m) => typeof m.name === 'string' && /^[\w.\-:/]{1,120}$/.test(m.name) && Number.isFinite(m.sizeGB) && Number.isFinite(m.ramGB) && m.rank && typeof m.rank === 'object');
}

function load() {
  const bundled = readJsonFile(path.join(P.catalogDir, 'models.json'));
  const cached = readJsonFile(P.catalogCache);
  if (validCatalog(cached) && String(cached.version) > String(bundled?.version || '')) return { ...cached, origin: 'updated' };
  return { ...bundled, origin: 'bundled' };
}

const norm = (n) => (n && !n.includes(':') ? n + ':latest' : n);
const sameModel = (a, b) => norm(a) === norm(b);

// ميزانية الذاكرة للنموذج: ما يمكن تشغيله براحة مع ترك مساحة للنظام والمتصفح
function budget(hw) {
  const total = hw?.ram?.totalGB || 8;
  const gpu = hw?.gpu || {};
  if (gpu.unified) return { gb: +(total * 0.7).toFixed(1), cpuOnly: false };          // Apple Silicon: ~70% للـ GPU
  if (gpu.usable && gpu.vramGB) return { gb: +Math.max(gpu.vramGB * 0.95, total * 0.55).toFixed(1), cpuOnly: false, vramGB: gpu.vramGB };
  return { gb: +(total * 0.6).toFixed(1), cpuOnly: true };
}

// ملاءمة نموذج للجهاز: ok | tight | too_big
function fit(model, hw) {
  const b = budget(hw);
  const total = hw?.ram?.totalGB || 8;
  if (model.ramGB <= b.gb) {
    // على المعالج فقط: النماذج الكثيفة الكبيرة بطيئة جدًا رغم أنها تتسع
    if (b.cpuOnly && !model.moe && model.sizeGB > 6) return 'slow';
    return 'ok';
  }
  if (model.ramGB <= total * 0.85) return 'tight';
  return 'too_big';
}

function recommend(hw, installedNames = [], catalog = load()) {
  const out = {};
  const freeGB = hw?.disk?.modelsFreeGB ?? hw?.disk?.freeGB ?? Infinity;
  for (const role of ROLES) {
    const cands = catalog.models.filter((m) => m.rank && m.rank[role]);
    const scored = cands.map((m) => {
      const f = fit(m, hw);
      let score = m.rank[role];
      if (f === 'slow') score -= 25;
      if (f === 'tight') score -= 30;
      if (m.licenseWarn) score -= 12; // رخصة غير تجارية: لا نوصي بها افتراضيًا
      if (m.legacy) score -= 3;
      if (budget(hw).cpuOnly && m.moe) score += 6;
      if (role !== 'embed' && role !== 'code') score += (m.arabic - 3) * 3;
      const installed = installedNames.some((n) => sameModel(n, m.name));
      return { name: m.name, score, fit: f, installed, sizeGB: m.sizeGB, ramGB: m.ramGB, diskOk: installed || m.sizeGB < freeGB };
    }).filter((x) => x.fit !== 'too_big' && x.diskOk);
    scored.sort((a, b) => b.score - a.score);
    out[role] = { recommended: scored[0]?.name || null, installedBest: scored.find((x) => x.installed)?.name || null, options: scored.slice(0, 6) };
  }
  return out;
}

function annotate(catalog, hw, installedNames = []) {
  const rec = recommend(hw, installedNames, catalog);
  const recSet = new Set(Object.values(rec).map((r) => r.recommended).filter(Boolean));
  return catalog.models.map((m) => ({
    ...m, fit: fit(m, hw), installed: installedNames.some((n) => sameModel(n, m.name)),
    recommended: recSet.has(m.name), recommendedFor: Object.entries(rec).filter(([, r]) => r.recommended === m.name).map(([k]) => k),
  }));
}

const find = (name, catalog = load()) => catalog.models.find((m) => sameModel(m.name, name)) || null;

// تحديث اختياري للكتالوج من GitHub (يتطلب إنترنت، بطلب المستخدم فقط)
function update(url = UPDATE_URL) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'caf-ai' }, timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let s = ''; res.setEncoding('utf8'); res.on('data', (c) => { s += c; if (s.length > 2e6) req.destroy(); });
      res.on('end', () => {
        let c; try { c = JSON.parse(s); } catch { return reject(new Error('bad json')); }
        if (!validCatalog(c)) return reject(new Error('invalid catalog'));
        const cur = load();
        if (String(c.version) <= String(cur.version)) return resolve({ updated: false, version: cur.version });
        writeJsonAtomic(P.catalogCache, c);
        resolve({ updated: true, version: c.version });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

module.exports = { load, recommend, annotate, fit, budget, find, update, sameModel, validCatalog, ROLES };
