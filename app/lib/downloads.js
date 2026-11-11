// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// تنزيل قابل للاستئناف: ملف ‎.part‎ + طلب Range، تحقق من الحجم والبصمة (sha256 أو sha512)، ورموز أخطاء واضحة.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { freeSpace } = require('./fsx');

class DownloadError extends Error { constructor(code, detail) { super(detail || code); this.code = code; } }

function hashFile(file, algo) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash(algo);
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => resolve(h)).on('error', reject);
  });
}
// يقبل: "sha256:hex" أو "hex" (64 حرفًا = sha256) أو "sha512-base64" (صيغة npm)
function parseHash(spec) {
  if (!spec) return null;
  let m = /^sha256:([a-f0-9]{64})$/i.exec(spec) || /^([a-f0-9]{64})$/i.exec(spec);
  if (m) return { algo: 'sha256', enc: 'hex', value: m[1].toLowerCase() };
  m = /^sha512-([A-Za-z0-9+/=]{80,})$/.exec(spec);
  if (m) return { algo: 'sha512', enc: 'base64', value: m[1] };
  throw new DownloadError('BAD_HASH_SPEC', spec);
}

// download({ url, dest, size, hash, onProgress({completed,total,speed}), signal })
async function download({ url, dest, size = 0, hash = null, onProgress = () => {}, signal, minFreeBytes = 256 * 1024 * 1024 }) {
  const want = parseHash(hash);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // موجود ومُتحقق منه مسبقًا
  if (fs.existsSync(dest)) {
    const st = fs.statSync(dest);
    if (!size || st.size === size) {
      if (!want || (await hashFile(dest, want.algo)).digest(want.enc) === want.value) { onProgress({ completed: st.size, total: st.size, speed: 0 }); return dest; }
    }
    fs.rmSync(dest, { force: true });
  }
  const part = dest + '.part';
  let have = 0;
  try { have = fs.statSync(part).size; } catch { have = 0; }
  if (size && have > size) { fs.rmSync(part, { force: true }); have = 0; }
  const fsp = freeSpace(path.dirname(dest));
  if (fsp.free !== null && size && fsp.free < (size - have) + minFreeBytes) throw new DownloadError('DISK_FULL', `need ${size - have} bytes, have ${fsp.free}`);

  // نكمل البصمة من الجزء الموجود (الاستئناف)
  const h = want ? (have ? await hashFile(part, want.algo) : crypto.createHash(want.algo)) : null;

  await new Promise((resolve, reject) => {
    let finished = false;
    const done = (err) => { if (finished) return; finished = true; err ? reject(err) : resolve(); };
    const go = (u, hops) => {
      if (hops > 10) return done(new DownloadError('NETWORK', 'too many redirects'));
      const lib = u.startsWith('https:') ? https : http;
      const headers = { 'User-Agent': 'caf-ai-downloader', ...(have ? { Range: `bytes=${have}-` } : {}) };
      const req = lib.get(u, { headers, timeout: 60000 }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) { res.resume(); return go(new URL(res.headers.location, u).toString(), hops + 1); }
        if (res.statusCode === 416 && size && have === size) { res.resume(); return done(); }
        // الخادم لا يدعم الاستئناف (200 بدل 206): نبدأ من الصفر ببصمة جديدة (hash2 أدناه)
        if (res.statusCode === 200 && have) { have = 0; fs.rmSync(part, { force: true }); }
        if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); return done(new DownloadError(res.statusCode === 404 ? 'NOT_FOUND' : 'NETWORK', 'HTTP ' + res.statusCode)); }
        const hash2 = res.statusCode === 200 && want ? crypto.createHash(want.algo) : h;
        const total = size || (res.statusCode === 206 ? have + Number(res.headers['content-length'] || 0) : Number(res.headers['content-length'] || 0));
        const out = fs.createWriteStream(part, { flags: res.statusCode === 206 ? 'a' : 'w' });
        let got = res.statusCode === 206 ? have : 0; let last = 0; const t0 = Date.now(); const start = got;
        res.on('data', (c) => {
          got += c.length; if (hash2) hash2.update(c);
          const now = Date.now();
          if (now - last > 250) { last = now; onProgress({ completed: got, total, speed: Math.round((got - start) / Math.max(0.25, (now - t0) / 1000)) }); }
        });
        res.on('error', (e) => done(new DownloadError('NETWORK', e.message)));
        out.on('error', (e) => done(new DownloadError(e.code === 'ENOSPC' ? 'DISK_FULL' : 'WRITE_FAILED', e.message)));
        out.on('finish', async () => {
          onProgress({ completed: got, total, speed: 0 });
          try {
            if (size && got !== size) return done(new DownloadError(got < size ? 'NETWORK' : 'SIZE_MISMATCH', `got ${got} of ${size}`));
            if (want && hash2.digest(want.enc) !== want.value) { fs.rmSync(part, { force: true }); return done(new DownloadError('HASH_MISMATCH')); }
            fs.renameSync(part, dest); done();
          } catch (e) { done(e); }
        });
        res.pipe(out);
        if (signal) signal.addEventListener('abort', () => { req.destroy(); out.destroy(); done(new DownloadError('CANCELED')); }, { once: true });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', (e) => done(new DownloadError(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|socket hang up/i.test(e.message) ? 'NETWORK' : 'NETWORK', e.message)));
    };
    if (signal?.aborted) return done(new DownloadError('CANCELED'));
    go(url, 0);
  });
  return dest;
}

module.exports = { download, DownloadError, parseHash, hashFile };
