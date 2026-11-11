// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// واجهة برمجية محلية متوافقة مع OpenAI على ‎http://127.0.0.1:<port>/v1‎ — لتطبيقاتك وأدواتك على الجهاز نفسه فقط.
// الحماية: مفعّلة من الإعدادات فقط + مفتاح محلي (Authorization: Bearer caf-…) + الاستماع على 127.0.0.1 + رفض طلبات المواقع الأخرى (Origin).
//   GET  /v1/models                 النماذج المثبّتة (+ «auto»)
//   POST /v1/chat/completions       محادثة (بث SSE أو دفعة واحدة، صور image_url بصيغة data:) — يمرّر إلى محرك Ollama المحلي
//   POST /v1/embeddings             تضمين نصوص (model: auto = نموذج التضمين المثبّت)
//   POST /v1/images/generations     توليد صور (b64_json) عبر stable-diffusion.cpp
//   POST /v1/audio/transcriptions   تفريغ صوت (multipart) عبر نموذج صوتي في Ollama
'use strict';
const http = require('http');
const { send, readBody } = require('../http');
const sec = require('../security');
const store = require('../store');
const engine = require('../engine');
const ollama = require('../providers/ollama');
const sd = require('../providers/sdcpp');
const hardware = require('../hardware');
const jobs = require('../jobs');
const catalog = require('../catalog');
const { detectIntent, pickModel } = require('../autoroute');
const { embedModel } = require('./docs');
const log = require('../log');

// ينتظر انتهاء مهمة (توليد صورة) ويعيد نتيجتها
const waitJob = (job) => new Promise((resolve, reject) => {
  const check = (j) => {
    if (j.status === 'done') { off(); resolve(j.result); }
    else if (j.status === 'error' || j.status === 'canceled') { off(); reject(Object.assign(new Error(j.error?.detail || j.status), { code: String(j.error?.code || j.status).toUpperCase() })); }
  };
  const off = jobs.subscribe(job.id, check); check(job);
});
const oaiErr = (res, status, message, type, code) => send(res, status, { error: { message, type, code: code || type, param: null } });
const AUTO = new Set(['', 'auto', 'caf-auto', 'caf']);

function guard(c) {
  if (!store.readSettings().apiEnabled) { oaiErr(c.res, 403, 'The CAF AI local API is disabled. Enable it in CAF AI › Settings › Local API.', 'api_disabled'); return false; }
  if (!sec.bearerOk(c.req)) { oaiErr(c.res, 401, 'Invalid or missing API key. Send: Authorization: Bearer caf-…', 'invalid_api_key'); return false; }
  return true;
}
async function readJsonBody(c, limit) {
  const b = await readBody(c.req, limit);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch { const e = new Error('bad json'); e.code = 'BAD_JSON'; throw e; }
}
const hasImages = (messages) => (messages || []).some((m) => Array.isArray(m.content) && m.content.some((p) => p?.type === 'image_url'));
const lastUserText = (messages) => {
  const m = [...(messages || [])].reverse().find((x) => x.role === 'user'); if (!m) return '';
  return typeof m.content === 'string' ? m.content : (m.content || []).filter((p) => p?.type === 'text').map((p) => p.text).join('\n');
};

// «auto» يختار النموذج المثبّت الأنسب للطلب (رؤية/برمجة/عام) كما في التطبيق
async function resolveModel(name, messages) {
  const installed = await ollama.listModels();
  const want = String(name || '').trim();
  if (!AUTO.has(want.toLowerCase())) {
    const m = installed.find((x) => catalog.sameModel(x.name, want));
    return m ? { model: m.name } : { error: `The model '${want}' is not installed. GET /v1/models lists installed models.` };
  }
  const route = hasImages(messages) ? 'vision' : detectIntent({ text: lastUserText(messages) }).route === 'code' ? 'code' : 'chat';
  const pick = pickModel(route, { installed, settings: store.readSettings(), hw: hardware.cached() });
  return pick.model ? { model: pick.model, route } : { error: 'No suitable model is installed. Install one from CAF AI › Installed tools.' };
}

// يمرّر الطلب إلى واجهة Ollama المتوافقة مع OpenAI ويعيد البث كما هو (SSE أو JSON)
function proxy(c, path, payload, { raw, contentType } = {}) {
  const data = raw || Buffer.from(JSON.stringify(payload));
  const up = http.request({ host: engine.getHost(), port: engine.getPort(), path, method: 'POST', agent: new http.Agent({ keepAlive: false }),
    headers: { 'Content-Type': contentType || 'application/json', 'Content-Length': data.length } }, (r) => {
    c.res.writeHead(r.statusCode, { 'Content-Type': r.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    r.pipe(c.res);
  });
  up.on('error', (e) => { if (!c.res.headersSent) oaiErr(c.res, 502, 'Local engine error: ' + e.message, 'engine_error'); else c.res.end(); });
  c.res.on('close', () => { if (!c.res.writableFinished) up.destroy(); });
  up.end(data);
}

module.exports = function routes(r) {
  // للواجهة (رمز الجلسة): عرض المفتاح وتدويره
  r.add('GET', '/api/apikey', (c) => send(c.res, 200, { key: sec.apiKey(), baseUrl: `http://127.0.0.1:${sec.getPort()}/v1`, enabled: !!store.readSettings().apiEnabled }));
  r.add('POST', '/api/apikey/rotate', (c) => { const key = sec.rotateApiKey(); log.info('api key rotated'); send(c.res, 200, { key }); });
  const opt = { apiKey: true, engine: true };
  r.add('GET', '/v1/models', async (c) => {
    if (!guard(c)) return;
    const list = await ollama.listModels();
    const created = Math.floor(Date.now() / 1000);
    send(c.res, 200, { object: 'list', data: [{ id: 'auto', object: 'model', created, owned_by: 'caf-ai', capabilities: ['auto-router'] },
      ...list.map((m) => ({ id: m.name, object: 'model', created: m.modified ? Math.floor(Date.parse(m.modified) / 1000) || created : created, owned_by: 'local', capabilities: m.capabilities || [] }))] });
  }, opt);

  r.add('POST', '/v1/chat/completions', async (c) => {
    if (!guard(c)) return;
    const body = await readJsonBody(c, 48 * 1024 * 1024);
    if (!Array.isArray(body.messages) || !body.messages.length) return oaiErr(c.res, 400, "'messages' must be a non-empty array.", 'invalid_request_error');
    const m = await resolveModel(body.model, body.messages);
    if (m.error) return oaiErr(c.res, 404, m.error, 'invalid_request_error', 'model_not_found');
    log.info('api chat', { model: m.model, stream: !!body.stream });
    proxy(c, '/v1/chat/completions', { ...body, model: m.model });
  }, opt);

  r.add('POST', '/v1/embeddings', async (c) => {
    if (!guard(c)) return;
    const body = await readJsonBody(c, 16 * 1024 * 1024);
    if (body.input == null || body.input === '') return oaiErr(c.res, 400, "'input' is required.", 'invalid_request_error');
    let model = body.model;
    if (AUTO.has(String(model || '').toLowerCase())) { model = await embedModel(); if (!model) return oaiErr(c.res, 404, 'No embedding model is installed (e.g. qwen3-embedding:0.6b).', 'invalid_request_error', 'model_not_found'); }
    proxy(c, '/v1/embeddings', { ...body, model });
  }, opt);

  r.add('POST', '/v1/images/generations', async (c) => {
    if (!guard(c)) return;
    const body = await readJsonBody(c, 1024 * 1024);
    if (!String(body.prompt || '').trim()) return oaiErr(c.res, 400, "'prompt' is required.", 'invalid_request_error');
    if (body.response_format && body.response_format !== 'b64_json') return oaiErr(c.res, 400, "Only response_format 'b64_json' is supported (the API never serves files to other apps).", 'invalid_request_error');
    if (jobs.running('image')) return oaiErr(c.res, 429, 'Another image is being generated. Try again when it finishes.', 'rate_limit_error', 'image_busy');
    const [w, h] = String(body.size || '1024x1024').split('x').map((x) => parseInt(x, 10));
    const hw = hardware.cached();
    const cap = hw?.gpu?.usable ? 1024 : 512; // على المعالج فقط نصغّر الحجم تلقائيًا
    const scale = Math.min(1, cap / Math.max(w || 1024, h || 1024));
    const job = jobs.create('image', String(body.prompt).slice(0, 80), ({ update, signal }) => sd.generate({ prompt: body.prompt, negative: body.negative_prompt, width: Math.round((w || 1024) * scale), height: Math.round((h || 1024) * scale), count: Math.min(4, Math.max(1, parseInt(body.n, 10) || 1)), seed: Number.isInteger(body.seed) ? body.seed : undefined, steps: body.steps, model: AUTO.has(String(body.model || '').toLowerCase()) ? undefined : body.model }, { update, signal }));
    c.res.on('close', () => { if (!c.res.writableFinished) jobs.cancel(job.id); });
    try {
      const out = await waitJob(job);
      const fs = require('fs');
      send(c.res, 200, { created: Math.floor(Date.now() / 1000), data: out.images.map((im) => ({ b64_json: fs.readFileSync(sd.filePath(im.id)).toString('base64'), revised_prompt: im.prompt, seed: im.seed })) });
    } catch (e) {
      const code = e.code === 'NO_IMAGE_MODEL' || e.code === 'NO_IMAGE_ENGINE' ? 404 : e.code === 'CANCELED' ? 499 : 500;
      if (!c.res.headersSent) oaiErr(c.res, code, e.code === 'NO_IMAGE_ENGINE' || e.code === 'NO_IMAGE_MODEL' ? 'Image generation is not installed. Install it from CAF AI › Images.' : String(e.message || e.code), code === 404 ? 'invalid_request_error' : 'server_error', String(e.code || 'image_failed').toLowerCase());
    }
  }, opt);

  r.add('POST', '/v1/audio/transcriptions', async (c) => {
    if (!guard(c)) return;
    const ct = c.req.headers['content-type'] || '';
    if (!/^multipart\/form-data;\s*boundary=/i.test(ct)) return oaiErr(c.res, 400, 'Send multipart/form-data with a file field.', 'invalid_request_error');
    const raw = await readBody(c.req, 30 * 1024 * 1024);
    const audio = (await ollama.listModels()).find((m) => (m.capabilities || []).includes('audio'));
    if (!audio) return oaiErr(c.res, 404, 'No audio-capable model is installed (e.g. gemma4:e2b).', 'invalid_request_error', 'model_not_found');
    // نستبدل حقل model بالنموذج الصوتي المثبّت
    const b = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct); const boundary = (b[1] || b[2]).trim();
    let text = raw.toString('latin1');
    if (/name="model"\r\n\r\n/.test(text)) text = text.replace(/(name="model"\r\n\r\n)[^\r]*/, `$1${audio.name}`);
    else text = `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${audio.name}\r\n` + text;
    proxy(c, '/v1/audio/transcriptions', null, { raw: Buffer.from(text, 'latin1'), contentType: `multipart/form-data; boundary=${boundary}` });
  }, opt);
};
