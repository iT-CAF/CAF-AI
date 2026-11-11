// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// مزوّد Ollama: المحادثة، الرؤية، التضمين (embeddings)، وإدارة النماذج. المحرك عملية فرعية يديرها engine.js.
'use strict';
const engine = require('../engine');
const { P } = require('../paths');
const { readJsonFile, writeJsonAtomic } = require('../fsx');

const id = 'ollama';
const name = 'Ollama';
const capabilities = ['chat', 'vision', 'embeddings', 'thinking', 'tools'];

let capsCache = null;
const loadCaps = () => { if (!capsCache) capsCache = readJsonFile(P.modelCaps, {}) || {}; return capsCache; };
const saveCaps = () => { try { writeJsonAtomic(P.modelCaps, capsCache); } catch { /* القرص للقراءة فقط مثلًا */ } };

async function version() {
  const r = await engine.engineJson('GET', '/api/version', null, 4000);
  return r.json.version || '';
}

// معلومات النموذج: القدرات (vision/thinking/tools/embedding/audio/image) وطول السياق، مخزّنة حسب digest
async function show(model, digest) {
  const cache = loadCaps();
  const hit = cache[model];
  if (hit && (!digest || hit.digest === digest)) return hit;
  const r = await engine.engineJson('POST', '/api/show', { model }, 20000);
  if (r.status !== 200) return { capabilities: [], error: r.json.error || `HTTP ${r.status}` };
  const info = r.json.model_info || {};
  const ctxKey = Object.keys(info).find((k) => k.endsWith('.context_length'));
  const entry = {
    digest: digest || '',
    capabilities: Array.isArray(r.json.capabilities) ? r.json.capabilities : [],
    family: r.json.details?.family || '',
    params: r.json.details?.parameter_size || '',
    quant: r.json.details?.quantization_level || '',
    contextLength: ctxKey ? Number(info[ctxKey]) || 0 : 0,
    expertCount: Number(Object.entries(info).find(([k]) => k.endsWith('.expert_count'))?.[1]) || 0,
  };
  cache[model] = entry; saveCaps();
  return entry;
}

async function listModels({ withCaps = true } = {}) {
  const r = await engine.engineJson('GET', '/api/tags');
  const list = (r.json.models || []).map((x) => ({ name: x.name, size: x.size, modified: x.modified_at, digest: x.digest, family: x.details?.family || '', params: x.details?.parameter_size || '' }));
  if (withCaps) {
    await Promise.all(list.map(async (m) => {
      try { const s = await show(m.name, m.digest); m.capabilities = s.capabilities; m.contextLength = s.contextLength; m.moe = s.expertCount > 0; } catch { m.capabilities = []; }
    }));
  }
  return list;
}

function chatStream(payload, opts) { return engine.engineStream('/api/chat', { ...payload, stream: true }, opts); }

// محادثة بلا بث (للموجّه وتحسين الوصف والـ API)
async function chatOnce(payload, { signal, timeout = 0 } = {}) {
  let content = ''; let thinking = ''; let last = null;
  await engine.engineStream('/api/chat', { ...payload, stream: true }, {
    signal, timeout,
    onLine: (j) => {
      if (j.error) throw Object.assign(new Error(j.error), { engine: true });
      if (j.message?.content) content += j.message.content;
      if (j.message?.thinking) thinking += j.message.thinking;
      if (j.done) last = j;
    },
  });
  return { content, thinking, done: last };
}

async function embed(model, input) {
  const r = await engine.engineJson('POST', '/api/embed', { model, input, truncate: true }, 300000);
  if (r.status !== 200) throw Object.assign(new Error(r.json.error || `HTTP ${r.status}`), { code: 'EMBED_FAILED' });
  return r.json.embeddings || [];
}

function pullStream(model, opts) { return engine.engineStream('/api/pull', { model, name: model, stream: true }, opts); }

async function remove(model) {
  const r = await engine.engineJson('DELETE', '/api/delete', { model, name: model });
  if (capsCache) { delete capsCache[model]; saveCaps(); }
  return r.status === 200;
}

async function status() {
  const out = { id, name, capabilities, kind: 'process', installed: !!require('../paths').findOllama() || engine.isExternal(), running: engine.isRunning(), healthy: false, version: '', external: engine.isExternal() };
  try { if (engine.getPort()) { out.healthy = await engine.ping(engine.getPort()); if (out.healthy) out.version = await version(); } } catch { /* */ }
  return out;
}

module.exports = { id, name, capabilities, version, show, listModels, chatStream, chatOnce, embed, pullStream, remove, status, _resetCache: () => { capsCache = null; } };
