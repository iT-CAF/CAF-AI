// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// المحركات والنماذج الإضافية (تُنزَّل عند الطلب فقط إلى CAF_HOME/extras) — app/catalog/addons.json
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic, dirSize, within } = require('./fsx');
const { download, DownloadError } = require('./downloads');
const { extractTar, extractZip } = require('./archive');
const hardware = require('./hardware');

const MARK = '.caf-installed.json';
// CAF_ADDONS_CATALOG: للاختبارات فقط (كتالوج يشير إلى خادم ملفات محلي)
const loadCatalog = () => readJsonFile(process.env.CAF_ADDONS_CATALOG || path.join(P.catalogDir, 'addons.json')) || { engines: {}, models: {} };

const engineDir = (id) => path.join(P.extraEngines, id);
const modelDir = (id) => path.join(P.extraModels, id);

// مفتاح المنصة: darwin-arm64 · linux-x64 · win32-x64 (+ ‎-cuda‎ إن وُجد كرت NVIDIA)
function platformKeys() {
  const base = `${process.platform}-${process.arch}`;
  const hw = hardware.cached();
  const keys = [];
  if (hw?.gpu?.kind === 'cuda') keys.push(base + '-cuda');
  if (hw?.gpu?.kind === 'rocm') keys.push(base + '-rocm');
  keys.push(base, 'any');
  return keys;
}
function assetFor(entry) {
  for (const k of platformKeys()) if (entry.assets?.[k]) return { key: k, ...entry.assets[k] };
  return null;
}

function engineStatus(id) {
  const cat = loadCatalog(); const e = cat.engines[id];
  if (!e) return null;
  const dir = engineDir(id);
  const mark = readJsonFile(path.join(dir, MARK));
  const asset = assetFor(e);
  const installed = !!mark && (!e.check || fs.existsSync(path.join(dir, mark.binDir || '', e.check)));
  return {
    id, kind: 'engine', name: e.name, version: e.version, license: e.license, homepage: e.homepage, capability: e.capability,
    installed, installedVersion: mark?.version || null, updateAvailable: !!mark && mark.version !== e.version,
    supported: !!asset || !!e.systemBinary, variant: asset?.key || null, downloadSize: asset?.size || 0,
    path: dir, size: installed ? dirSize(dir).bytes : 0, binDir: mark?.binDir || '',
  };
}

function modelStatus(id) {
  const cat = loadCatalog(); const m = cat.models[id];
  if (!m) return null;
  const dir = modelDir(id);
  const installed = (m.files || []).every((f) => fs.existsSync(path.join(dir, f.name)));
  return { id, kind: 'model', ...m, files: undefined, fileCount: (m.files || []).length, downloadSize: (m.files || []).reduce((a, f) => a + (f.size || 0), 0), installed, path: dir, size: installed ? dirSize(dir).bytes : 0 };
}

function listAll() {
  const cat = loadCatalog();
  return { engines: Object.keys(cat.engines).map(engineStatus), models: Object.keys(cat.models).map(modelStatus) };
}

// يجد مجلد الملف التنفيذي بعد فك الضغط (بعض الأرشيفات فيها مجلد فرعي)
function findBinDir(root, check) {
  if (!check) return '';
  let found = null;
  (function walk(d, depth) {
    if (found || depth > 4) return;
    let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) { if (e.isFile() && e.name === check) { found = d; return; } }
    for (const e of list) if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
  })(root, 0);
  return found ? path.relative(root, found) : null;
}

async function installEngine(id, { update = () => {}, signal } = {}) {
  const cat = loadCatalog(); const e = cat.engines[id];
  if (!e) throw new DownloadError('UNKNOWN_ADDON', id);
  const asset = assetFor(e);
  if (!asset) throw new DownloadError('UNSUPPORTED_PLATFORM', `${process.platform}-${process.arch}`);
  const archive = path.join(P.tmp, `${id}-${e.version}-${path.basename(new URL(asset.url).pathname)}`);
  update({ text: 'download', completed: 0, total: asset.size });
  await download({ url: asset.url, dest: archive, size: asset.size, hash: asset.hash, signal, onProgress: (p) => update({ text: 'download', ...p }) });
  update({ text: 'extract' });
  const dir = engineDir(id); const stage = dir + '.new';
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  const filter = asset.include ? (rel) => asset.include.includes(rel) : () => true;
  if (asset.type === 'tgz' || asset.type === 'tar') extractTar(archive, stage, { strip: asset.strip || 0, filter });
  else if (asset.type === 'zip') extractZip(archive, stage, { strip: asset.strip || 0, filter });
  else fs.copyFileSync(archive, path.join(stage, asset.bin || path.basename(archive)));
  const binDir = findBinDir(stage, e.check);
  if (binDir === null) { fs.rmSync(stage, { recursive: true, force: true }); throw new DownloadError('EXTRACT_FAILED', `${e.check} not found`); }
  if (process.platform === 'darwin') { try { require('child_process').spawnSync('xattr', ['-dr', 'com.apple.quarantine', stage], { stdio: 'ignore' }); } catch { /* */ } }
  writeJsonAtomic(path.join(stage, MARK), { id, version: e.version, variant: asset.key, binDir, installedAt: new Date().toISOString() });
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(stage, dir);
  fs.rmSync(archive, { force: true });
  return engineStatus(id);
}

async function installModel(id, { update = () => {}, signal } = {}) {
  const cat = loadCatalog(); const m = cat.models[id];
  if (!m) throw new DownloadError('UNKNOWN_ADDON', id);
  const dir = modelDir(id);
  const total = m.files.reduce((a, f) => a + f.size, 0);
  let base = 0;
  for (const f of m.files) {
    const dest = within(dir, f.name);
    if (!dest) throw new DownloadError('BAD_NAME', f.name);
    await download({ url: f.url, dest, size: f.size, hash: f.hash, signal, onProgress: (p) => update({ text: f.name, completed: base + p.completed, total, speed: p.speed }) });
    base += f.size;
  }
  return modelStatus(id);
}

function uninstall(id) {
  const cat = loadCatalog();
  if (cat.engines[id]) { fs.rmSync(engineDir(id), { recursive: true, force: true }); return true; }
  if (cat.models[id]) { fs.rmSync(modelDir(id), { recursive: true, force: true }); return true; }
  return false;
}

// المسار الكامل لملف تنفيذي لمحرك مثبّت
function binPath(id, name) {
  const s = engineStatus(id);
  if (!s || !s.installed) return null;
  const exe = process.platform === 'win32' && !name.endsWith('.exe') ? name + '.exe' : name;
  const f = path.join(engineDir(id), s.binDir || '', exe);
  return fs.existsSync(f) ? f : null;
}

module.exports = { loadCatalog, engineStatus, modelStatus, listAll, installEngine, installModel, uninstall, engineDir, modelDir, binPath, assetFor, platformKeys };
