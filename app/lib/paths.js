// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');

// كل ما يُنزَّل أو يُحفظ يعيش خارج مجلد المشروع: ‎~/.caf-ai‎ (ويندوز: ‎%LOCALAPPDATA%\CAF-AI‎)
const CAF_HOME = process.env.CAF_HOME || (process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'CAF-AI')
  : path.join(os.homedir(), '.caf-ai'));

function hasModels(dir) {
  const walk = (d, depth) => {
    if (depth > 5) return false;
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return false; }
    return list.some((e) => ((e.isFile() || e.isSymbolicLink()) && !e.name.startsWith('.')) || (e.isDirectory() && walk(path.join(d, e.name), depth + 1)));
  };
  // Ollama الحديث يحفظ النماذج في manifests-v2
  return walk(path.join(dir, 'manifests-v2'), 0) || walk(path.join(dir, 'manifests'), 0);
}

// إن كان عندك نماذج في Ollama أصلًا ولا نماذج في كآف، نستخدمها بدل تنزيلها مرة ثانية
function pickModelsDir() {
  if (process.env.CAF_MODELS) return process.env.CAF_MODELS;
  const own = path.join(CAF_HOME, 'models');
  const system = path.join(os.homedir(), '.ollama', 'models');
  if (!hasModels(own) && hasModels(system)) return system;
  return own;
}

const P = {
  root: ROOT,
  home: CAF_HOME,
  app: path.join(ROOT, 'app'),
  web: path.join(ROOT, 'app', 'web'),
  engine: path.join(CAF_HOME, 'engine'),
  runtime: path.join(CAF_HOME, 'runtime'),
  models: pickModelsDir(),
  data: path.join(CAF_HOME, 'data'),
  chats: path.join(CAF_HOME, 'data', 'chats'),
  engineHome: path.join(CAF_HOME, 'data', 'engine-home'),
  settings: path.join(CAF_HOME, 'data', 'settings.json'),
  state: path.join(CAF_HOME, 'data', 'server.json'),
  tmp: path.join(CAF_HOME, 'data', 'tmp'),
};

const VERSION = require('../../package.json').version;

function ensureDirs() {
  for (const d of [P.engine, P.models, P.data, P.chats, P.engineHome, P.tmp]) fs.mkdirSync(d, { recursive: true });
}

// ترتيب البحث عن Ollama: متغير CAF_OLLAMA_BIN ← مجلد كآف ← النسخة المثبّتة في النظام
function findOllama() {
  if (process.env.CAF_OLLAMA_BIN && fs.existsSync(process.env.CAF_OLLAMA_BIN)) return process.env.CAF_OLLAMA_BIN;
  const want = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  let best = null;
  (function walk(dir, depth) {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === want) { if (!best || full.length < best.length) best = full; }
      else if (e.isDirectory()) walk(full, depth + 1);
    }
  })(P.engine, 0);
  if (best) return best;
  const extra = process.platform === 'darwin' ? ['/Applications/Ollama.app/Contents/Resources/ollama', '/opt/homebrew/bin/ollama', '/usr/local/bin/ollama']
    : process.platform === 'win32' ? [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe')]
      : ['/usr/local/bin/ollama', '/usr/bin/ollama'];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean).map((d) => path.join(d, want));
  const usable = [...dirs, ...extra].filter((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } });
  // نسخة على قرص خارجي (‎/Volumes‎) قد تختفي أثناء التشغيل فيتجمّد المحرك: نفضّل النسخة الثابتة
  const removable = (f) => { try { return /^\/(Volumes|media|mnt|run\/media)\//.test(fs.realpathSync(f)); } catch { return true; } };
  return usable.find((f) => !removable(f)) || usable[0] || null;
}

module.exports = { P, VERSION, ensureDirs, findOllama, hasModels, CAF_HOME };
