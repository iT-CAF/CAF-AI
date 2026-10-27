// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { P, findOllama } = require('./paths');
const ui = require('./ui');
const { tr, ok, info, step, fail, amber, gray } = ui;

// ---------- التنزيل مع شريط تقدّم ----------
function bar(pct) { const n = Math.max(0, Math.min(25, Math.floor(pct / 4))); return amber('█'.repeat(n)) + gray('░'.repeat(25 - n)); }

function download(url, dest, label) {
  return new Promise((resolve, reject) => {
    const go = (u, hops) => {
      if (hops > 8) return reject(new Error('too many redirects'));
      https.get(u, { headers: { 'User-Agent': 'caf-ai-installer' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) { res.resume(); return go(new URL(res.headers.location, u).toString(), hops + 1); }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        const part = dest + '.part';
        const out = fs.createWriteStream(part);
        let got = 0; let last = 0; const t0 = Date.now();
        res.on('data', (c) => {
          got += c.length;
          const now = Date.now();
          if (now - last > 250 && process.stdout.isTTY) {
            last = now;
            const pct = total ? Math.floor((got / total) * 100) : 0;
            const speed = (got / 1048576 / ((now - t0) / 1000 || 1)).toFixed(1);
            process.stdout.write(`\r  ${bar(pct)} ${String(pct).padStart(3)}%  ${(got / 1048576).toFixed(0)} MB  ${speed} MB/s  ${gray(label)}   `);
          }
        });
        res.pipe(out);
        out.on('finish', () => { if (process.stdout.isTTY) process.stdout.write('\n'); fs.renameSync(part, dest); resolve(); });
        out.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    };
    go(url, 0);
  });
}

function engineAsset() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const base = 'https://github.com/ollama/ollama/releases/latest/download/';
  if (process.platform === 'darwin') return { file: 'ollama-darwin.tgz', url: base + 'ollama-darwin.tgz', kind: 'tgz' };
  if (process.platform === 'win32') return { file: `ollama-windows-${arch}.zip`, url: base + `ollama-windows-${arch}.zip`, kind: 'zip' };
  return { file: `ollama-linux-${arch}.tar.zst`, url: base + `ollama-linux-${arch}.tar.zst`, kind: 'zst' };
}

function extract(asset, archive) {
  fs.rmSync(P.engine, { recursive: true, force: true });
  fs.mkdirSync(P.engine, { recursive: true });
  return new Promise((resolve) => {
    const done = (code) => {
      if (code !== 0) fail(tr('فشل فك ضغط المحرك.', 'Failed to extract the engine.'));
      const bin = findOllama();
      if (!bin) fail(tr('لم أجد ملف المحرك بعد فك الضغط.', 'Engine binary not found after extraction.'));
      if (process.platform !== 'win32') { try { fs.chmodSync(bin, 0o755); } catch { /* */ } }
      resolve();
    };
    if (asset.kind === 'zst') {
      const hasZstd = spawnSync('zstd', ['--version'], { stdio: 'ignore' }).status === 0;
      if (hasZstd) return done(spawnSync('tar', ['--use-compress-program=unzstd', '-xf', archive, '-C', P.engine], { stdio: 'inherit' }).status);
      if (typeof zlib.createZstdDecompress !== 'function') fail(tr('ثبّت الأداة zstd (مثل: sudo apt install zstd) ثم أعد التشغيل.', 'Install zstd (e.g. sudo apt install zstd) and run again.'));
      const tar = spawn('tar', ['-xf', '-', '-C', P.engine], { stdio: ['pipe', 'inherit', 'inherit'] });
      tar.on('close', done);
      return fs.createReadStream(archive).pipe(zlib.createZstdDecompress()).pipe(tar.stdin);
    }
    const args = asset.kind === 'tgz' ? ['-xzf', archive, '-C', P.engine] : ['-xf', archive, '-C', P.engine]; // bsdtar يفك zip في ويندوز 10+
    done(spawnSync('tar', args, { stdio: 'inherit' }).status);
  });
}

async function installEngine() {
  if (findOllama()) { ok(tr('المحرك المحلي جاهز', 'Local engine ready')); return; }
  const asset = engineAsset();
  step(tr(`تنزيل المحرك المحلي (${asset.file}) — مرة واحدة`, `Downloading local engine (${asset.file}) — one time`));
  const archive = path.join(P.tmp, asset.file);
  try { await download(asset.url, archive, 'engine'); }
  catch (e) { fail(tr('فشل التنزيل: ', 'Download failed: ') + e.message); }
  info(tr('فك الضغط…', 'Extracting…'));
  await extract(asset, archive);
  fs.rmSync(archive, { force: true });
  ok(tr('تم تثبيت المحرك', 'Engine installed'));
}


module.exports = { installEngine, download };
