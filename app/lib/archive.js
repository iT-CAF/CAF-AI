// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// قراءة وكتابة الأرشيفات بلا اعتماديات: tar(.gz) وzip (store/deflate). كل الاستخراج محمي من الخروج عن المجلد.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { within } = require('./fsx');

// ---------------- tar / tar.gz ----------------
// extractTar(file, destDir, { strip: 1, filter(name) }) → عدد الملفات
function extractTar(file, dest, { strip = 0, filter = () => true } = {}) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  let off = 0; let n = 0; let longName = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a, b) => h.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100);
    const prefix = str(345, 500);
    if (prefix && !longName) name = prefix + '/' + name;
    if (longName) { name = longName; longName = null; }
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    const mode = parseInt(str(100, 108).trim() || '644', 8);
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = body.toString('utf8').replace(/\0.*$/s, ''); continue; }
    if (type === 'x' || type === 'g') { const m = /\d+ path=([^\n]+)\n/.exec(body.toString('utf8')); if (m) longName = m[1]; continue; }
    const parts = name.split('/').filter(Boolean).slice(strip);
    if (!parts.length || parts.some((p) => p === '..')) continue;
    const rel = parts.join('/');
    if (!filter(rel)) continue;
    const target = within(dest, rel);
    if (!target) continue;
    if (type === '5') { fs.mkdirSync(target, { recursive: true }); continue; }
    if (type !== '0' && type !== '\0' && type !== '7') continue; // نتجاهل الروابط والأجهزة
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    if (process.platform !== 'win32' && mode & 0o111) fs.chmodSync(target, 0o755);
    n++;
  }
  return n;
}

// ---------------- zip ----------------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
function crc32(buf, crc = 0) { crc = ~crc >>> 0; for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8); return ~crc >>> 0; }

// يقرأ الدليل المركزي: [{ name, method, csize, size, offset, dir, mode }]
function zipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw Object.assign(new Error('not a zip'), { code: 'BAD_ZIP' });
  let count = buf.readUInt16LE(eocd + 10); let cdOff = buf.readUInt32LE(eocd + 16);
  // Zip64
  if (cdOff === 0xffffffff || count === 0xffff) {
    const loc = buf.readUInt32LE(eocd - 20) === 0x07064b50 ? Number(buf.readBigUInt64LE(eocd - 12)) : -1;
    if (loc >= 0 && buf.readUInt32LE(loc) === 0x06064b50) { count = Number(buf.readBigUInt64LE(loc + 32)); cdOff = Number(buf.readBigUInt64LE(loc + 48)); }
  }
  const out = []; let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw Object.assign(new Error('bad central dir'), { code: 'BAD_ZIP' });
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    let csize = buf.readUInt32LE(p + 20); let size = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const attr = buf.readUInt32LE(p + 38);
    let offset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nl).toString(flags & 0x800 ? 'utf8' : 'latin1');
    // حقول Zip64 الإضافية
    let x = p + 46 + nl; const xe = x + xl;
    while (x + 4 <= xe) {
      const id = buf.readUInt16LE(x), len = buf.readUInt16LE(x + 2); let q = x + 4;
      if (id === 1) { if (size === 0xffffffff) { size = Number(buf.readBigUInt64LE(q)); q += 8; } if (csize === 0xffffffff) { csize = Number(buf.readBigUInt64LE(q)); q += 8; } if (offset === 0xffffffff) { offset = Number(buf.readBigUInt64LE(q)); } }
      x += 4 + len;
    }
    out.push({ name, method, csize, size, offset, dir: name.endsWith('/'), mode: (attr >>> 16) & 0o777 });
    p += 46 + nl + xl + cl;
  }
  return out;
}
function zipRead(buf, e) {
  if (buf.readUInt32LE(e.offset) !== 0x04034b50) throw Object.assign(new Error('bad local header'), { code: 'BAD_ZIP' });
  const nl = buf.readUInt16LE(e.offset + 26), xl = buf.readUInt16LE(e.offset + 28);
  const start = e.offset + 30 + nl + xl;
  const data = buf.subarray(start, start + e.csize);
  if (e.method === 0) return Buffer.from(data);
  if (e.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: Math.max(e.size, 1) + 1024 });
  throw Object.assign(new Error('unsupported zip method ' + e.method), { code: 'BAD_ZIP' });
}
// قراءة ملف واحد من zip في الذاكرة (لـ DOCX/XLSX)
function zipGet(buf, name) { const e = zipEntries(buf).find((x) => x.name === name); return e ? zipRead(buf, e) : null; }

function extractZip(file, dest, { strip = 0, filter = () => true, maxBytes = 8 * 1024 ** 3 } = {}) {
  const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file);
  let n = 0; let total = 0;
  for (const e of zipEntries(buf)) {
    const parts = e.name.replace(/\\/g, '/').split('/').filter(Boolean).slice(strip);
    if (!parts.length || parts.some((p) => p === '..')) continue;
    const rel = parts.join('/');
    if (!filter(rel, e)) continue;
    const target = within(dest, rel);
    if (!target) continue;
    if (e.dir) { fs.mkdirSync(target, { recursive: true }); continue; }
    total += e.size; if (total > maxBytes) throw Object.assign(new Error('archive too large'), { code: 'TOO_LARGE' });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, zipRead(buf, e));
    if (process.platform !== 'win32' && e.mode & 0o111) fs.chmodSync(target, 0o755);
    n++;
  }
  return n;
}

// كتابة zip: files = [{ name, data:Buffer, mtime? }] → Buffer
function createZip(files) {
  const locals = []; const central = []; let offset = 0;
  const dosTime = (d) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });
  for (const f of files) {
    const name = Buffer.from(f.name.replace(/\\/g, '/'), 'utf8');
    const raw = f.data;
    const comp = raw.length > 64 ? zlib.deflateRawSync(raw, { level: 6 }) : null;
    const useDeflate = comp && comp.length < raw.length;
    const data = useDeflate ? comp : raw;
    const crc = crc32(raw); const { time, date } = dosTime(f.mtime || new Date());
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(useDeflate ? 8 : 0, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(useDeflate ? 8 : 0, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + data.length;
    if (offset > 0xfffffff0) throw Object.assign(new Error('backup too large for zip32'), { code: 'TOO_LARGE' });
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

module.exports = { extractTar, extractZip, zipEntries, zipRead, zipGet, createZip, crc32 };
