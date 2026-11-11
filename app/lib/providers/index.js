// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// طبقة المزوّدين (Providers): لكل قدرة واجهة واحدة، وخلفها محرك أو أكثر بترتيب أفضلية.
//   chat / vision / embeddings → Ollama
//   image-gen                 → Ollama (إن دعمه رسميًا) ثم stable-diffusion.cpp
//   stt                       → whisper.cpp ثم نموذج صوتي في Ollama
//   tts                       → Piper
//   code-run (python)         → Pyodide في المتصفح (يُنزَّل إلى CAF_HOME)
// كل مزوّد يصدّر: id, name, capabilities, status() — والمحركات الإضافية: install(), uninstall(), health().
'use strict';

const registry = new Map();
const ORDER = {
  chat: ['ollama'], vision: ['ollama'], embeddings: ['ollama'],
  'image-gen': ['ollama-image', 'sdcpp'], stt: ['whisper', 'ollama-audio'], tts: ['piper'], 'code-run': ['pyodide'],
};

function register(p) { registry.set(p.id, p); return p; }
const get = (id) => registry.get(id) || null;
const all = () => [...registry.values()];

// أول مزوّد جاهز للقدرة المطلوبة (status().ready === true)، أو null مع الأسباب
async function resolve(capability) {
  const reasons = [];
  for (const id of ORDER[capability] || []) {
    const p = registry.get(id);
    if (!p) continue;
    let s;
    try { s = await p.status(); } catch (e) { s = { ready: false, detail: e.message }; }
    if (s.ready !== false && (s.ready || s.healthy || s.installed)) return { provider: p, status: s };
    reasons.push({ id, detail: s.detail || s.reason || 'not_installed' });
  }
  return { provider: null, reasons };
}

async function statusAll() {
  const out = [];
  for (const p of registry.values()) {
    try { out.push({ id: p.id, name: p.name, capabilities: p.capabilities, ...(await p.status()) }); }
    catch (e) { out.push({ id: p.id, name: p.name, capabilities: p.capabilities, installed: false, healthy: false, detail: String(e.message || e) }); }
  }
  return out;
}

register(require('./ollama'));
register(require('./pyodide'));

module.exports = { register, get, all, resolve, statusAll, ORDER };
