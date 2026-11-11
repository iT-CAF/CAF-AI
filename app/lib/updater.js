// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// التحديث المباشر من GitHub (iT-CAF/CAF-AI): آخر إصدار منشور ← ملف ZIP مرفق بالإصدار ← تحقق SHA-256 (بصمة GitHub)
// ← فك في مجلد مؤقت ← استبدال مجلد البرنامج مع نسخة احتياطية ← إعادة التشغيل. بيانات CAF_HOME لا تُلمس إطلاقًا.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { P, VERSION } = require('./paths');
const { download } = require('./downloads');
const { extractZip } = require('./archive');
const log = require('./log');

const REPO = 'iT-CAF/CAF-AI';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'caf-ai-updater', Accept: 'application/vnd.github+json' }, timeout: 15000 }, (res) => {
      if (res.statusCode === 404) { res.resume(); return resolve(null); }
      if (res.statusCode !== 200) { res.resume(); return reject(Object.assign(new Error('HTTP ' + res.statusCode), { code: 'NETWORK' })); }
      let s = ''; res.setEncoding('utf8'); res.on('data', (c) => { s += c; if (s.length > 4e6) req.destroy(); });
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch { reject(Object.assign(new Error('bad json'), { code: 'NETWORK' })); } });
    });
    req.on('error', (e) => reject(Object.assign(e, { code: 'NETWORK' })));
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// مقارنة إصدارات semver بسيطة: 1.10.0 > 1.9.3
function newer(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}

// لماذا لا يمكن التحديث تلقائيًا هنا؟
function blocker() {
  if (fs.existsSync(path.join(P.root, '.git'))) return 'git';
  try { fs.accessSync(P.root, fs.constants.W_OK); fs.accessSync(path.dirname(P.root), fs.constants.W_OK); } catch { return 'readonly'; }
  return null;
}

async function check() {
  const rel = await getJson(API);
  if (!rel || !rel.tag_name) return { current: VERSION, latest: null, available: false };
  const latest = rel.tag_name.replace(/^v/, '');
  const asset = (rel.assets || []).find((a) => /\.zip$/i.test(a.name) && /^sha256:[a-f0-9]{64}$/.test(a.digest || ''));
  const available = newer(latest, VERSION);
  const reason = !asset ? 'no_asset' : blocker();
  return {
    current: VERSION, latest, available, notes: String(rel.body || '').slice(0, 20000), publishedAt: rel.published_at, url: rel.html_url,
    canApply: available && !reason, reason: available ? reason : null,
    asset: asset ? { name: asset.name, size: asset.size, url: asset.browser_download_url, digest: asset.digest } : null,
  };
}

async function apply({ update = () => {}, signal } = {}) {
  const info = await check();
  if (!info.available) throw Object.assign(new Error('up to date'), { code: 'UP_TO_DATE' });
  if (!info.canApply) throw Object.assign(new Error(info.reason || 'cannot apply'), { code: String(info.reason || 'CANNOT_APPLY').toUpperCase() });
  const u = new URL(info.asset.url);
  if (u.hostname !== 'github.com' || !u.pathname.startsWith(`/${REPO}/releases/download/`)) throw Object.assign(new Error('unexpected asset url'), { code: 'BAD_ASSET' });
  const zip = path.join(P.tmp, `caf-ai-update-${info.latest}.zip`);
  update({ text: 'download', completed: 0, total: info.asset.size });
  await download({ url: info.asset.url, dest: zip, size: info.asset.size, hash: info.asset.digest, signal, onProgress: (p) => update({ text: 'download', ...p }) });
  update({ text: 'extract' });
  const stage = `${P.root}.update-${info.latest}`;
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  // الأرشيف يحوي مجلدًا علويًا واحدًا (CAF-AI/…): نزيله
  extractZip(zip, stage, { strip: 1 });
  const pkg = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
  if (pkg.name !== 'caf-ai' || pkg.version !== info.latest || !fs.existsSync(path.join(stage, 'app', 'server.js'))) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw Object.assign(new Error('bad package'), { code: 'BAD_PACKAGE' });
  }
  update({ text: 'swap' });
  const backup = `${P.root}.backup-${VERSION}`;
  fs.rmSync(backup, { recursive: true, force: true });
  try {
    fs.renameSync(P.root, backup);
    fs.renameSync(stage, P.root);
    // أي مجلد أو ملف علوي ليس جزءًا من الإصدار (مثل بيانات محمولة CAF_HOME داخل مجلد البرنامج، أو engine/ و models/ و data/)
    // يعود إلى مكانه كما هو — التحديث يستبدل ملفات البرنامج فقط ولا يمس بيانات المستخدم
    for (const e of fs.readdirSync(backup)) {
      if (e.startsWith('.update-') || fs.existsSync(path.join(P.root, e))) continue;
      try { fs.renameSync(path.join(backup, e), path.join(P.root, e)); } catch (err) { log.warn('update: could not carry over', { entry: e, err: err.message }); }
    }
  } catch (e) {
    // ويندوز قد يرفض إعادة تسمية مجلد قيد الاستخدام: ننسخ فوق الملفات بدلًا من ذلك
    if (!fs.existsSync(P.root) && fs.existsSync(backup)) fs.renameSync(backup, P.root);
    fs.cpSync(stage, P.root, { recursive: true, force: true });
    fs.rmSync(stage, { recursive: true, force: true });
  }
  for (const f of ['bin/startcaf', 'app/bootstrap.sh', 'install-caf-ai.sh']) { try { fs.chmodSync(path.join(P.root, f), 0o755); } catch { /* */ } }
  fs.rmSync(zip, { force: true });
  log.info('updated', { from: VERSION, to: info.latest });
  return { from: VERSION, to: info.latest, backup };
}

// إعادة التشغيل بعد التحديث: عملية جديدة منفصلة على نفس المنفذ ثم إغلاق الحالية
function restart(shutdown) {
  const child = spawn(process.execPath, [path.join(P.root, 'app', 'server.js'), '--no-open'], {
    detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, CAF_RESTART_DELAY: '1500' },
  });
  child.unref();
  setTimeout(() => shutdown(0), 300);
}

module.exports = { check, apply, restart, newer, blocker, REPO };
