// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// أدوات ملفات مشتركة: كتابة ذرّية، قراءة JSON آمنة، أحجام المجلدات، معرّفات.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readJsonFile(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// كتابة ذرّية: ملف مؤقت ثم إعادة تسمية (لا يبقى ملف نصف مكتوب عند انقطاع الكهرباء أو نزع الفلاشة)
function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* */ }
    throw e;
  }
}
const writeJsonAtomic = (file, obj) => writeFileAtomic(file, JSON.stringify(obj, null, 2));

function dirSize(dir, { maxDepth = 12 } = {}) {
  let total = 0; let files = 0;
  (function walk(d, depth) {
    if (depth > maxDepth) return;
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f, depth + 1);
      else if (e.isFile()) { try { total += fs.statSync(f).size; files++; } catch { /* */ } }
    }
  })(dir, 0);
  return { bytes: total, files };
}

function freeSpace(dir) {
  try {
    const s = fs.statfsSync(dir);
    return { free: Number(s.bavail) * Number(s.bsize), total: Number(s.blocks) * Number(s.bsize) };
  } catch { return { free: null, total: null }; }
}

const newId = () => crypto.randomUUID();
const ID_RE = /^[a-z0-9-]{6,64}$/;
const isId = (s) => typeof s === 'string' && ID_RE.test(s);

// يمنع الخروج من مجلد معيّن (path traversal)
function within(base, ...parts) {
  const full = path.resolve(base, ...parts);
  const b = path.resolve(base);
  if (full !== b && !full.startsWith(b + path.sep)) return null;
  return full;
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

module.exports = { readJsonFile, writeFileAtomic, writeJsonAtomic, dirSize, freeSpace, newId, isId, ID_RE, within, sha256File };
