// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// النسخ الاحتياطي والاستعادة: ملف zip واحد يضم المحادثات والمرفقات والصور والمعرفة واللوحات والإعدادات والمهارات المستوردة.
// لا يضم النماذج ولا المحركات (تُنزَّل من جديد) ولا مفتاح الـAPI ولا رمز الجلسة. الاستعادة تنقل البيانات الحالية أولًا إلى
// data/backups/pre-restore-<الوقت>/ فلا يضيع شيء، ثم يُعاد تشغيل الخادم لتُطبَّق الترقية (migration) إن لزم.
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');
const { createZip, zipEntries, zipRead } = require('./archive');
const { within, freeSpace } = require('./fsx');
const { DATA_VERSION } = require('./migrate');

const FORMAT = 1;
const MANIFEST = 'caf-backup.json';
// ما يدخل النسخة (نسبةً إلى CAF_HOME)
const DIRS = ['data/chats', 'data/attachments', 'data/images', 'data/knowledge', 'data/canvas', 'data/files', 'skills'];
const FILES = ['data/settings.json', 'data/schema.json', 'data/skills.json'];
const MAX_BYTES = 1.5 * 1024 ** 3; // حد zip في الذاكرة؛ الأكبر يُنسخ يدويًا (المجلد نفسه)

function walk(rel, out) {
  const abs = path.join(P.home, rel);
  let st; try { st = fs.statSync(abs); } catch { return; }
  if (st.isFile()) { out.push({ rel, abs, size: st.size, mtime: st.mtime }); return; }
  if (!st.isDirectory()) return;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === '.DS_Store' || e.name.endsWith('.tmp')) continue;
    walk(path.posix.join(rel, e.name), out);
  }
}
function inventory() {
  const files = [];
  for (const d of DIRS) walk(d, files);
  for (const f of FILES) walk(f, files);
  return files;
}
function summary() {
  const files = inventory();
  const count = (prefix) => files.filter((f) => f.rel.startsWith(prefix)).length;
  return { bytes: files.reduce((a, f) => a + f.size, 0), files: files.length, chats: count('data/chats/'), images: count('data/images/') / 2 | 0, max: MAX_BYTES };
}

function create(version) {
  const files = inventory();
  const bytes = files.reduce((a, f) => a + f.size, 0);
  if (bytes > MAX_BYTES) throw Object.assign(new Error('backup too large'), { code: 'TOO_LARGE', bytes });
  const manifest = { app: 'CAF AI', format: FORMAT, version, dataVersion: DATA_VERSION, created: new Date().toISOString(), files: files.length, bytes, site: 'https://it-caf.com' };
  const entries = [{ name: MANIFEST, data: Buffer.from(JSON.stringify(manifest, null, 2)) }];
  for (const f of files) entries.push({ name: f.rel, data: fs.readFileSync(f.abs), mtime: f.mtime });
  return { zip: createZip(entries), manifest };
}

const allowed = (rel) => FILES.includes(rel) || DIRS.some((d) => rel.startsWith(d + '/'));
// يتحقق من النسخة ويعيد قائمة الملفات (بلا كتابة)
function inspect(buf) {
  let entries; try { entries = zipEntries(buf); } catch { throw Object.assign(new Error('not a zip'), { code: 'BAD_BACKUP' }); }
  const m = entries.find((e) => e.name === MANIFEST);
  if (!m) throw Object.assign(new Error('missing manifest'), { code: 'BAD_BACKUP' });
  let manifest; try { manifest = JSON.parse(zipRead(buf, m).toString('utf8')); } catch { throw Object.assign(new Error('bad manifest'), { code: 'BAD_BACKUP' }); }
  if (manifest.app !== 'CAF AI' || manifest.format !== FORMAT) throw Object.assign(new Error('unknown format'), { code: 'BAD_BACKUP' });
  if ((manifest.dataVersion || 1) > DATA_VERSION) throw Object.assign(new Error('backup from a newer version'), { code: 'BACKUP_NEWER' });
  const files = []; let total = 0;
  for (const e of entries) {
    if (e.name === MANIFEST || e.name.endsWith('/')) continue;
    const rel = e.name.replace(/\\/g, '/');
    if (rel.startsWith('/') || rel.split('/').includes('..') || !allowed(rel) || !within(P.home, rel)) throw Object.assign(new Error('unexpected path ' + rel), { code: 'BAD_BACKUP' });
    total += e.size; files.push({ e, rel });
  }
  return { manifest, files, total };
}

function restore(buf) {
  const { manifest, files, total } = inspect(buf);
  const { free } = freeSpace(P.data);
  if (free != null && free < total * 1.1 + 50 * 1024 * 1024) throw Object.assign(new Error('not enough space'), { code: 'DISK_FULL' });
  // 1) نقل البيانات الحالية جانبًا (نسخة أمان فورية)
  const safe = path.join(P.backups, 'pre-restore-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(safe, { recursive: true });
  for (const rel of [...DIRS, ...FILES]) {
    const src = path.join(P.home, rel); if (!fs.existsSync(src)) continue;
    const dst = path.join(safe, rel); fs.mkdirSync(path.dirname(dst), { recursive: true });
    try { fs.renameSync(src, dst); } catch { fs.cpSync(src, dst, { recursive: true }); fs.rmSync(src, { recursive: true, force: true }); }
  }
  // 2) الاستخراج؛ عند أي خطأ نعيد البيانات كما كانت
  try {
    for (const { e, rel } of files) {
      const dst = within(P.home, rel); fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, zipRead(buf, e));
    }
  } catch (err) {
    for (const rel of [...DIRS, ...FILES]) { fs.rmSync(path.join(P.home, rel), { recursive: true, force: true }); const s = path.join(safe, rel); if (fs.existsSync(s)) fs.renameSync(s, path.join(P.home, rel)); }
    throw Object.assign(err, { code: err.code || 'RESTORE_FAILED' });
  }
  return { ok: true, restored: files.length, manifest, safetyCopy: path.relative(P.home, safe) };
}

module.exports = { create, restore, inspect, summary, MAX_BYTES, MANIFEST };
