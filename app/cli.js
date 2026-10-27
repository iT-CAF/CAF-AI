// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');
const { P, VERSION, ensureDirs, findOllama, hasModels } = require('./lib/paths');
const engine = require('./lib/engine');
const ui = require('./lib/ui');
const { tr, say, ok, info, step, fail, amber, green, gray, bold, copper } = ui;

const MODELS = [
  { key: '1', name: 'qwen2.5:7b', size: '4.7 GB', ram: '8 GB', tag: tr('موصى به', 'recommended'), desc: tr('الأفضل للعربية والبرمجة', 'best for Arabic & code') },
  { key: '2', name: 'gemma3:4b', size: '3.3 GB', ram: '6 GB', tag: tr('متوازن', 'balanced'), desc: tr('خفيف وجيد بالعربية', 'light, good Arabic') },
  { key: '3', name: 'llama3.2:3b', size: '2.0 GB', ram: '4 GB', tag: tr('سريع', 'fast'), desc: tr('للأجهزة المتواضعة', 'for modest machines') },
  { key: '4', name: 'qwen2.5:3b', size: '1.9 GB', ram: '4 GB', tag: tr('سريع', 'fast'), desc: tr('صغير بدعم عربي مقبول', 'small, decent Arabic') },
  { key: '5', name: 'qwen2.5:14b', size: '9.0 GB', ram: '16 GB', tag: tr('أقوى', 'powerful'), desc: tr('جودة أعلى للأجهزة القوية', 'higher quality, strong PCs') },
];

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

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

function pullModel(name, port) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify({ name, stream: true }));
    const req = http.request({ host: '127.0.0.1', port, path: '/api/pull', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
      let buf = ''; let failed = null;
      res.on('data', (c) => {
        buf += c.toString('utf8');
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          try {
            const j = JSON.parse(line);
            if (j.error) failed = j.error;
            else if (j.total && j.completed && process.stdout.isTTY) {
              const pct = Math.floor((j.completed / j.total) * 100);
              process.stdout.write(`\r  ${bar(pct)} ${String(pct).padStart(3)}%  ${(j.completed / 1073741824).toFixed(2)}/${(j.total / 1073741824).toFixed(2)} GB   `);
            }
          } catch { /* */ }
        }
      });
      res.on('end', () => { if (process.stdout.isTTY) process.stdout.write('\n'); resolve(failed); });
    });
    req.on('error', (e) => resolve(e.message));
    req.write(data); req.end();
  });
}

async function chooseModels() {
  say('');
  step(tr('اختر النموذج الذي تريد تنزيله (يمكنك إضافة غيره لاحقًا من الإعدادات)', 'Pick a model to download (you can add more later in Settings)'));
  say('');
  for (const m of MODELS) say(`    ${amber(m.key)}  ${bold(m.name.padEnd(13))} ${gray(`${m.size.padEnd(7)} RAM ${m.ram.padEnd(5)} ${m.tag} — ${m.desc}`)}`);
  say(`    ${amber('C')}  ${tr('نموذج آخر من مكتبة Ollama (تكتب اسمه)', 'Another model from the Ollama library (type its name)')}`);
  say(`    ${amber('S')}  ${tr('تخطّي — سأضيف نموذجًا من التطبيق', 'Skip — I will add one from the app')}`);
  say('');
  const a = (await ask(`  ${amber('>')} ${tr('اختيارك (مثال: 1 أو 1,3) [1]: ', 'Your choice (e.g. 1 or 1,3) [1]: ')}`)) || '1';
  if (a.toLowerCase() === 's') return [];
  const picked = [];
  for (const part of a.split(/[,\s،]+/).filter(Boolean)) {
    if (part.toLowerCase() === 'c') {
      const n = await ask(`  ${amber('>')} ${tr('اسم النموذج (مثل mistral:7b): ', 'Model name (e.g. mistral:7b): ')}`);
      if (/^[\w.\-:/]{1,120}$/.test(n)) picked.push(n);
    } else { const m = MODELS.find((x) => x.key === part); if (m) picked.push(m.name); }
  }
  return picked;
}

async function installModels(names) {
  if (!names.length) return;
  const port = await engine.startEngine();
  for (const n of names) {
    step(tr(`تنزيل ${n}`, `Downloading ${n}`));
    const err = await pullModel(n, port);
    if (err) say(`  ${copper('✗ ' + n + ': ' + err)}`); else ok(tr(`تم تنزيل ${n}`, `${n} ready`));
  }
  engine.stopEngine();
}

// يُنفَّذ تلقائيًا في أول startcaf: المحرك ثم النموذج الأول
async function ensure() {
  ensureDirs();
  const asked = path.join(P.data, '.models-asked');
  const needEngine = !findOllama();
  const needModels = !hasModels(P.models) && !fs.existsSync(asked);
  if (!needEngine && !needModels) return;
  ui.banner();
  say('');
  say(`  ${bold(tr('إعداد أول مرة', 'First-time setup'))}`);
  await installEngine();
  if (needModels) {
    if (process.stdin.isTTY) { const m = await chooseModels(); await installModels(m); fs.writeFileSync(asked, new Date().toISOString()); }
    else info(tr('لا يوجد نموذج بعد: نزّله من الإعدادات داخل التطبيق.', 'No model yet: download one from Settings in the app.'));
  }
  say('');
}

// ---------- أوامر الإدارة ----------
function readState() { try { return JSON.parse(fs.readFileSync(P.state, 'utf8')); } catch { return null; } }
function getJson(port, p) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, timeout: 1500 }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null)); req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
async function status() {
  ui.banner();
  const s = readState(); const i = s && await getJson(s.port, '/api/info');
  if (i && i.name === 'CAF AI') { ok(tr('كآف AI يعمل', 'CAF AI is running') + `  ${amber('http://127.0.0.1:' + s.port)}`); }
  else info(tr('كآف AI متوقف. شغّله بالأمر: startcaf', 'CAF AI is not running. Start it with: startcaf'));
  say('');
}
async function stop() {
  ui.banner();
  const s = readState();
  if (!s) { info(tr('كآف AI غير مشغّل.', 'CAF AI is not running.')); return; }
  await new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: s.port, path: '/api/quit', method: 'POST', timeout: 2000 }, (r) => { r.resume(); r.on('end', resolve); });
    req.on('error', resolve); req.on('timeout', () => { req.destroy(); resolve(); }); req.end();
  });
  ok(tr('تم إيقاف كآف AI', 'CAF AI stopped')); say('');
}
function help() {
  ui.banner();
  say('');
  say(`  ${bold('startcaf')}            ${tr('تشغيل كآف AI وفتح الدردشة في المتصفح', 'Start CAF AI and open the chat in your browser')}`);
  say(`  ${bold('startcaf --no-open')}  ${tr('تشغيل بدون فتح المتصفح', 'Start without opening the browser')}`);
  say(`  ${bold('startcaf stop')}       ${tr('إيقاف كآف AI', 'Stop CAF AI')}`);
  say(`  ${bold('startcaf status')}     ${tr('حالة التشغيل', 'Show status')}`);
  say(`  ${bold('startcaf --lang en')}  ${tr('لغة الطرفية: ar أو en', 'Terminal language: ar or en')}`);
  say('');
  say(`  ${gray(tr('البيانات والمحرك في: ', 'Data & engine live in: ') + P.home)}`);
  say('');
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === 'ensure') await ensure();
  else if (cmd === 'install') { ui.banner(); say(''); await ensure(); ok(tr('اكتمل الإعداد. شغّل: startcaf', 'Setup complete. Run: startcaf')); say(''); }
  else if (cmd === 'stop') await stop();
  else if (cmd === 'status') await status();
  else if (cmd === 'version' || cmd === '--version' || cmd === '-v') say(`CAF AI v${VERSION} · by CAF · iT CAF`);
  else help();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
