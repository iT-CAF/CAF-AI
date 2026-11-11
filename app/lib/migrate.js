// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// ترحيل البيانات تلقائيًا عند التحديث، مع نسخة احتياطية قبل أي تعديل.
// v1 (1.0.0): chats/{id}.json = {id,title,model,created,updated,messages:[{role,content}]}
// v2 (2.0.0): نفس الملف + v, workspace, collections، ورسائل بحقول اختيارية (صور، مصادر، تفكير…)
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic } = require('./fsx');
const store = require('./store');

const DATA_VERSION = 2;

function currentVersion() {
  const s = readJsonFile(P.schema);
  if (s && Number.isInteger(s.version)) return s.version;
  // لا يوجد ملف schema: بيانات v1 (أو تثبيت جديد)
  return 1;
}

function backupDir(label) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(P.backups, `${label}-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ينسخ المحادثات والإعدادات كما هي قبل الترحيل
function backupV1(dir) {
  let n = 0;
  const chatsOut = path.join(dir, 'chats');
  fs.mkdirSync(chatsOut, { recursive: true });
  for (const f of fs.readdirSync(P.chats)) {
    if (!f.endsWith('.json')) continue;
    fs.copyFileSync(path.join(P.chats, f), path.join(chatsOut, f)); n++;
  }
  if (fs.existsSync(P.settings)) fs.copyFileSync(P.settings, path.join(dir, 'settings.json'));
  return n;
}

function migrateV1toV2(log) {
  const files = fs.readdirSync(P.chats).filter((f) => f.endsWith('.json'));
  let backup = null;
  if (files.length || fs.existsSync(P.settings)) {
    backup = backupDir('pre-v2');
    const n = backupV1(backup);
    log(`backup: ${n} chats → ${backup}`);
  }
  let ok = 0; let skipped = 0;
  for (const f of files) {
    const file = path.join(P.chats, f);
    const c = readJsonFile(file);
    if (!c || typeof c !== 'object' || !c.id) { skipped++; continue; } // تالف: يبقى كما هو، ونسخته في المجلد الاحتياطي
    if (c.v >= 2) { ok++; continue; }
    const id = f.slice(0, -5);
    writeJsonAtomic(file, store.normalizeChat(c, c.id === id ? id : c.id));
    ok++;
  }
  // الإعدادات: دمج القيم الجديدة الافتراضية مع الإبقاء على اختيارات المستخدم
  if (fs.existsSync(P.settings)) writeJsonAtomic(P.settings, store.sanitizeSettings(readJsonFile(P.settings, {}) || {}));
  return { ok, skipped, backup };
}

function migrate(log = () => {}) {
  fs.mkdirSync(P.chats, { recursive: true });
  const from = currentVersion();
  if (from >= DATA_VERSION) return { from, to: from, changed: false };
  const history = (readJsonFile(P.schema) || {}).history || [];
  const result = migrateV1toV2(log);
  history.push({ from, to: 2, at: new Date().toISOString(), ...result });
  writeJsonAtomic(P.schema, { version: DATA_VERSION, history });
  log(`migrated data v${from} → v${DATA_VERSION} (${result.ok} chats, ${result.skipped} skipped)`);
  return { from, to: DATA_VERSION, changed: true, ...result };
}

module.exports = { migrate, currentVersion, DATA_VERSION };
