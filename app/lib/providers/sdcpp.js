// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// مزوّد توليد الصور: stable-diffusion.cpp (Metal / CUDA-Vulkan / CPU) — عملية لكل طلب، تقدّم حقيقي بعدد الخطوات، وإلغاء.
// Ollama 0.33.3 يرفض نماذج الصور ("image generation models are not currently supported") فنستخدم sd.cpp.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { P } = require('../paths');
const addons = require('../addons');
const { newId, readJsonFile, writeJsonAtomic, isId } = require('../fsx');
const hardware = require('../hardware');

const id = 'sdcpp';
const name = 'stable-diffusion.cpp';
const capabilities = ['image-gen'];

const imageModels = () => Object.entries(addons.loadCatalog().models).filter(([, m]) => m.kind === 'image').map(([k, m]) => ({ id: k, ...m, installed: addons.modelStatus(k).installed }));

async function status() {
  const e = addons.engineStatus('sdcpp');
  const models = imageModels();
  let healthy = false;
  if (e.installed) { const bin = addons.binPath('sdcpp', 'sd-cli'); try { healthy = !!bin && spawnSync(bin, ['--help'], { timeout: 8000, stdio: 'ignore' }).status === 0; } catch { healthy = false; } }
  return { kind: 'process', installed: e.installed, supported: e.supported, healthy, ready: healthy && models.some((m) => m.installed), version: e.installedVersion || e.version, variant: e.variant, path: e.path, size: e.size, detail: !e.supported ? 'unsupported_platform' : !e.installed ? 'not_installed' : !models.some((m) => m.installed) ? 'no_model' : '' };
}

// تقدير الوقت: ثوانٍ لكل خطوة عند 512² (يكبر مع مساحة الصورة)
function estimate({ width = 512, height = 512, steps = 4, count = 1 }) {
  const hw = hardware.cached();
  const gpu = hw?.gpu?.usable;
  const perStep512 = gpu ? (hw.gpu.kind === 'metal' ? 5 : 2.5) : 40;
  const load = gpu ? 12 : 30;
  const area = (width * height) / (512 * 512);
  return Math.round(load + count * (steps * perStep512 * Math.pow(area, 1.1) + (gpu ? 6 : 25) * area));
}

const imgDir = () => P.images;
function list() {
  let files = []; try { files = fs.readdirSync(imgDir()).filter((f) => f.endsWith('.json')); } catch { return []; }
  return files.map((f) => readJsonFile(path.join(imgDir(), f))).filter(Boolean).sort((a, b) => b.created - a.created);
}
function remove(imageId) {
  if (!isId(imageId)) return false;
  for (const ext of ['.png', '.json']) { try { fs.unlinkSync(path.join(imgDir(), imageId + ext)); } catch { /* */ } }
  return true;
}
const filePath = (imageId) => (isId(imageId) ? path.join(imgDir(), imageId + '.png') : null);

// يولّد صورة أو أكثر. update({ stage, image, images, step, steps }) — signal للإلغاء
function generate(opts, { update = () => {}, signal } = {}) {
  const cat = addons.loadCatalog();
  const modelId = opts.model && cat.models[opts.model] ? opts.model : imageModels().find((m) => m.installed)?.id;
  const m = modelId && cat.models[modelId];
  if (!m || !addons.modelStatus(modelId).installed) return Promise.reject(Object.assign(new Error('no image model'), { code: 'NO_IMAGE_MODEL' }));
  const bin = addons.binPath('sdcpp', 'sd-cli');
  if (!bin) return Promise.reject(Object.assign(new Error('engine missing'), { code: 'NO_IMAGE_ENGINE' }));
  const dir = addons.modelDir(modelId);
  const W = Math.max(256, Math.min(1536, Math.round((Number(opts.width) || 512) / 16) * 16));
  const H = Math.max(256, Math.min(1536, Math.round((Number(opts.height) || 512) / 16) * 16));
  const steps = Math.max(1, Math.min(m.maxSteps || 30, parseInt(opts.steps, 10) || m.steps || 4));
  const count = Math.max(1, Math.min(4, parseInt(opts.count, 10) || 1));
  const seed = Number.isInteger(opts.seed) && opts.seed >= 0 ? opts.seed : Math.floor(Math.random() * 2 ** 31);
  const prompt = String(opts.prompt || '').slice(0, 2000);
  if (!prompt.trim()) return Promise.reject(Object.assign(new Error('empty prompt'), { code: 'EMPTY_PROMPT' }));
  const tmp = path.join(P.tmp, 'gen-' + newId());
  fs.mkdirSync(tmp, { recursive: true });
  const args = m.args.map((a) => a.replace(/\{([^}]+)\}/g, (_, k) => (k === 'cfg' ? String(m.cfg ?? 1) : path.join(dir, k))))
    .concat(['--steps', String(steps), '-W', String(W), '-H', String(H), '-s', String(seed), '-b', String(count), '-p', prompt, '-o', path.join(tmp, 'img_%d.png')]);
  if (opts.negative) args.push('-n', String(opts.negative).slice(0, 1000));
  if (!hardware.cached()?.gpu?.usable) args.push('-t', String(Math.max(1, (require('os').cpus().length || 4) - 1)));
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: path.dirname(bin), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let done = 0; let buf = ''; let tail = '';
    const onData = (c) => {
      const s = c.toString('utf8'); tail = (tail + s).slice(-3000); buf += s;
      const parts = buf.split(/[\r\n]/); buf = parts.pop();
      for (const line of parts) {
        const mm = /\|\s*(\d+)\/(\d+)\s*-\s*[\d.]+\s*(s\/it|it\/s)/.exec(line);
        if (mm) update({ stage: 'sampling', step: +mm[1], steps: +mm[2], image: done + 1, images: count, completed: done * steps + +mm[1], total: count * steps });
        else if (/sampling completed/.test(line)) done++;
        else if (/loading tensors|load .*model|loading model/i.test(line)) update({ stage: 'loading', image: done + 1, images: count, completed: done * steps, total: count * steps });
        else if (/decode_first_stage|decoding/i.test(line)) update({ stage: 'decoding', image: Math.max(1, done), images: count, completed: done * steps, total: count * steps });
      }
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    const kill = () => { try { child.kill('SIGKILL'); } catch { /* */ } };
    if (signal) signal.addEventListener('abort', kill, { once: true });
    child.on('error', (e) => { fs.rmSync(tmp, { recursive: true, force: true }); reject(Object.assign(e, { code: 'IMAGE_ENGINE_FAILED' })); });
    child.on('close', (code) => {
      if (signal?.aborted) { fs.rmSync(tmp, { recursive: true, force: true }); return reject(Object.assign(new Error('canceled'), { code: 'CANCELED' })); }
      const outs = fs.existsSync(tmp) ? fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort() : [];
      if (code !== 0 || !outs.length) {
        fs.rmSync(tmp, { recursive: true, force: true });
        const mem = /out of memory|failed to allocate|Cannot allocate|insufficient memory/i.test(tail);
        return reject(Object.assign(new Error(tail.split('\n').filter(Boolean).slice(-3).join(' | ')), { code: mem ? 'NOT_ENOUGH_RAM' : 'IMAGE_FAILED' }));
      }
      fs.mkdirSync(imgDir(), { recursive: true });
      const ms = Date.now() - t0;
      const images = outs.map((f, i) => {
        const iid = newId();
        fs.renameSync(path.join(tmp, f), path.join(imgDir(), iid + '.png'));
        const meta = { id: iid, prompt, prompt_ar: String(opts.promptAr || '').slice(0, 2000), negative: String(opts.negative || ''), seed: seed + i, steps, width: W, height: H, model: modelId, modelName: m.name, license: m.license, created: Date.now(), ms: Math.round(ms / outs.length), chatId: isId(opts.chatId) ? opts.chatId : null };
        writeJsonAtomic(path.join(imgDir(), iid + '.json'), meta);
        return meta;
      });
      fs.rmSync(tmp, { recursive: true, force: true });
      resolve({ images, ms });
    });
  });
}

module.exports = { id, name, capabilities, status, generate, list, remove, filePath, estimate, imageModels };
