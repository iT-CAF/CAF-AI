// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// ملف تعريف الجهاز: الرام، المعالج، كرت الشاشة (Metal/CUDA)، المساحة وسرعة القرص — يُحفظ في data/hardware.json.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic, freeSpace } = require('./fsx');

const GB = 1024 ** 3;

function run(cmd, args, timeout = 4000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => resolve(err ? '' : String(stdout)));
  });
}

// الذاكرة المتاحة فعليًا (وليس free فقط: macOS وLinux يحتفظان بذاكرة قابلة للتحرير)
async function availableMemory() {
  if (process.platform === 'linux') {
    try { const m = fs.readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/); if (m) return Number(m[1]) * 1024; } catch { /* */ }
  }
  if (process.platform === 'darwin') {
    const out = await run('vm_stat', []);
    const page = Number((out.match(/page size of (\d+)/) || [])[1]) || 16384;
    const n = (k) => Number((out.match(new RegExp(`${k}:\\s+(\\d+)`)) || [])[1]) || 0;
    const avail = (n('Pages free') + n('Pages inactive') + n('Pages speculative') + n('Pages purgeable')) * page;
    if (avail > 0) return Math.min(avail, os.totalmem());
  }
  return os.freemem();
}

async function cpuInfo() {
  const cpus = os.cpus() || [];
  const info = { model: (cpus[0]?.model || '').trim(), cores: cpus.length, arch: process.arch, avx2: null };
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    const brand = (await run('sysctl', ['-n', 'machdep.cpu.brand_string'])).trim();
    if (brand) info.model = brand;
    const perf = parseInt(await run('sysctl', ['-n', 'hw.perflevel0.physicalcpu']), 10);
    if (perf) info.performanceCores = perf;
  } else if (process.platform === 'linux') {
    try { info.avx2 = /\bavx2\b/.test(fs.readFileSync('/proc/cpuinfo', 'utf8')); } catch { /* */ }
  } else if (process.platform === 'darwin') {
    info.avx2 = /AVX2/.test(await run('sysctl', ['-n', 'machdep.cpu.leaf7_features']));
  }
  return info;
}

async function gpuInfo(totalMem) {
  // Apple Silicon: ذاكرة موحّدة يستخدمها Metal (Ollama يستفيد منها مباشرة)
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return { kind: 'metal', name: 'Apple GPU (Metal)', vramGB: +(totalMem / GB).toFixed(1), unified: true, usable: true };
  }
  if (process.platform === 'darwin') {
    const out = await run('system_profiler', ['SPDisplaysDataType', '-json'], 8000);
    let name = '';
    try { name = JSON.parse(out).SPDisplaysDataType?.[0]?.sppci_model || ''; } catch { /* */ }
    // Ollama لا يستخدم Metal على Macs بمعالج Intel: التشغيل على المعالج
    return { kind: 'none', name: name || 'Intel Mac GPU', vramGB: 0, unified: false, usable: false, note: 'intel_mac_cpu_only' };
  }
  const smi = await run('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'], 5000);
  if (smi.trim()) {
    const rows = smi.trim().split('\n').map((l) => l.split(',').map((s) => s.trim()));
    const vram = rows.reduce((a, r) => a + (Number(r[1]) || 0), 0) / 1024;
    return { kind: 'cuda', name: rows.map((r) => r[0]).join(' + '), vramGB: +vram.toFixed(1), driver: rows[0][2] || '', unified: false, usable: true };
  }
  if (process.platform === 'linux') {
    const rocm = await run('rocm-smi', ['--showproductname'], 4000);
    if (/GPU/.test(rocm)) return { kind: 'rocm', name: (rocm.match(/Card series:\s*(.+)/) || [])[1] || 'AMD GPU', vramGB: 0, unified: false, usable: true };
  }
  if (process.platform === 'win32') {
    const out = await run('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name'], 8000);
    const names = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    return { kind: 'none', name: names.join(' + '), vramGB: 0, unified: false, usable: false };
  }
  return { kind: 'none', name: '', vramGB: 0, unified: false, usable: false };
}

async function isRemovable(dir) {
  let real = dir;
  try { real = fs.realpathSync(dir); } catch { /* */ }
  if (process.platform === 'darwin') {
    if (!real.startsWith('/Volumes/')) return false;
    const mount = '/Volumes/' + real.split('/')[2];
    const out = await run('diskutil', ['info', mount]);
    if (/Removable Media:\s+Removable|Device Location:\s+External|Protocol:\s+USB/i.test(out)) return true;
    return /Internal:\s+No/i.test(out) || !out;
  }
  if (process.platform === 'linux') return /^\/(media|run\/media|mnt)\//.test(real);
  if (process.platform === 'win32') {
    const letter = (real.match(/^([A-Za-z]):/) || [])[1];
    if (!letter) return false;
    const t = (await run('powershell', ['-NoProfile', '-Command', `(Get-Volume -DriveLetter ${letter}).DriveType`], 6000)).trim();
    return /Removable/i.test(t);
  }
  return false;
}

// اختبار سرعة تقريبي (مهم للفلاشة): كتابة ثم قراءة ملف مؤقت داخل CAF_HOME
function diskSpeed(dir, mb = 48) {
  const file = path.join(dir, `.caf-speed-${process.pid}.bin`);
  const buf = Buffer.alloc(1024 * 1024, 7);
  try {
    fs.mkdirSync(dir, { recursive: true });
    let t0 = process.hrtime.bigint();
    const fd = fs.openSync(file, 'w');
    for (let i = 0; i < mb; i++) fs.writeSync(fd, buf);
    fs.fsyncSync(fd); fs.closeSync(fd);
    const w = Number(process.hrtime.bigint() - t0) / 1e9;
    t0 = process.hrtime.bigint();
    const rfd = fs.openSync(file, 'r'); const rb = Buffer.alloc(1024 * 1024);
    while (fs.readSync(rfd, rb, 0, rb.length, null) > 0) { /* قراءة */ }
    fs.closeSync(rfd);
    const r = Number(process.hrtime.bigint() - t0) / 1e9;
    return { writeMBs: Math.round(mb / Math.max(w, 1e-3)), readMBs: Math.round(mb / Math.max(r, 1e-3)), sampleMB: mb };
  } catch (e) {
    return { writeMBs: null, readMBs: null, error: e.code || e.message };
  } finally { try { fs.unlinkSync(file); } catch { /* */ } }
}

async function measure({ diskTest = true } = {}) {
  const total = os.totalmem();
  const [available, cpu, gpu, removable] = await Promise.all([availableMemory(), cpuInfo(), gpuInfo(total), isRemovable(P.home)]);
  const space = freeSpace(fs.existsSync(P.home) ? P.home : path.dirname(P.home));
  const modelsSpace = freeSpace(fs.existsSync(P.models) ? P.models : P.home);
  const hw = {
    measuredAt: new Date().toISOString(),
    os: { platform: process.platform, release: os.release(), arch: process.arch, version: typeof os.version === 'function' ? os.version() : '' },
    cpu,
    ram: { totalGB: +(total / GB).toFixed(1), availableGB: +(available / GB).toFixed(1) },
    gpu,
    disk: {
      home: P.home, freeGB: space.free === null ? null : +(space.free / GB).toFixed(1), totalGB: space.total === null ? null : +(space.total / GB).toFixed(1),
      modelsDir: P.models, modelsFreeGB: modelsSpace.free === null ? null : +(modelsSpace.free / GB).toFixed(1),
      removable, ...(diskTest ? diskSpeed(P.tmp) : {}),
    },
    node: process.version,
  };
  hw.tier = tierOf(hw);
  try { writeJsonAtomic(P.hardware, hw); } catch { /* */ }
  return hw;
}

// فئة الجهاز: تُستخدم في التوصيات والتحذيرات
function tierOf(hw) {
  const ram = hw.ram.totalGB;
  const gpu = hw.gpu.usable;
  if (ram < 6) return 'low';
  if (ram < 12) return gpu ? 'mid' : 'low-mid';
  if (ram < 24) return gpu ? 'high' : 'mid';
  return gpu ? 'ultra' : 'high';
}

function cached() { return readJsonFile(P.hardware); }

async function get({ refresh = false } = {}) {
  const c = cached();
  if (c && !refresh) {
    // الذاكرة المتاحة تتغير: نحدّثها دائمًا بدون إعادة اختبار القرص
    c.ram.availableGB = +((await availableMemory()) / GB).toFixed(1);
    const s = freeSpace(P.home); if (s.free !== null) c.disk.freeGB = +(s.free / GB).toFixed(1);
    return c;
  }
  return measure();
}

module.exports = { measure, get, cached, tierOf, availableMemory };
