// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { P, VERSION, ensureDirs, findOllama } = require('./lib/paths');
const engine = require('./lib/engine');
const ui = require('./lib/ui');
const { openTarget } = require('./lib/open');
const { tr, say, ok, info, step, fail, amber } = ui;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const DEFAULT_SETTINGS = {
  lang: 'ar', theme: 'system', model: '', systemPrompt: '', temperature: 0.7, numCtx: 4096,
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};

let httpPort = 0;
const ID_RE = /^[a-z0-9-]{6,64}$/;

function send(res, code, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, {
    ...SECURITY_HEADERS,
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const readJson = async (req) => { const t = await readBody(req); return t ? JSON.parse(t) : {}; };

function readSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(P.settings, 'utf8')) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
function writeJsonAtomic(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

// ---- الحماية: المضيف والأصل ----
function hostOk(req) {
  const h = (req.headers.host || '').toLowerCase();
  return h === `127.0.0.1:${httpPort}` || h === `localhost:${httpPort}`;
}
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  return o === `http://127.0.0.1:${httpPort}` || o === `http://localhost:${httpPort}`;
}

// ---- المحادثات ----
function chatFile(id) { return path.join(P.chats, id + '.json'); }
function listChats() {
  const out = [];
  for (const f of fs.readdirSync(P.chats)) {
    if (!f.endsWith('.json')) continue;
    try {
      const c = JSON.parse(fs.readFileSync(path.join(P.chats, f), 'utf8'));
      out.push({ id: c.id, title: c.title, model: c.model, created: c.created, updated: c.updated });
    } catch { /* ملف تالف */ }
  }
  return out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

// ---- تمرير البث إلى المحرك ----
function proxyStream(req, res, enginePath, bodyObj) {
  const data = Buffer.from(JSON.stringify(bodyObj));
  const up = http.request({
    host: '127.0.0.1', port: engine.getPort(), path: enginePath, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
  }, (ur) => {
    res.writeHead(ur.statusCode, { ...SECURITY_HEADERS, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
    ur.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) send(res, 502, { error: 'engine_unreachable' }); else res.end(); });
  res.on('close', () => up.destroy());
  up.write(data); up.end();
}

async function api(req, res, url) {
  const m = req.method;
  const p = url.pathname;

  if (p === '/api/info' && m === 'GET') {
    return send(res, 200, { name: 'CAF AI', version: VERSION, owner: 'iT CAF', year: new Date().getFullYear() });
  }
  if (p === '/api/settings') {
    if (m === 'GET') return send(res, 200, readSettings());
    if (m === 'PUT') {
      const incoming = await readJson(req);
      const next = { ...readSettings() };
      for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in incoming) next[k] = incoming[k];
      if (!['ar', 'en'].includes(next.lang)) next.lang = 'ar';
      if (!['dark', 'light', 'system'].includes(next.theme)) next.theme = 'system';
      next.temperature = Math.min(2, Math.max(0, Number(next.temperature) || 0.7));
      next.numCtx = Math.min(131072, Math.max(512, parseInt(next.numCtx, 10) || 4096));
      next.systemPrompt = String(next.systemPrompt || '').slice(0, 8000);
      next.model = String(next.model || '');
      writeJsonAtomic(P.settings, next);
      return send(res, 200, next);
    }
  }
  if (p === '/api/models' && m === 'GET') {
    const r = await engine.engineJson('GET', '/api/tags');
    return send(res, 200, { models: (r.json.models || []).map((x) => ({ name: x.name, size: x.size, modified: x.modified_at })) });
  }
  if (p === '/api/models/pull' && m === 'POST') {
    const { name } = await readJson(req);
    if (!/^[\w.\-:/]{1,120}$/.test(name || '')) return send(res, 400, { error: 'bad_name' });
    return proxyStream(req, res, '/api/pull', { name, stream: true });
  }
  if (p === '/api/models' && m === 'DELETE') {
    const { name } = await readJson(req);
    if (!/^[\w.\-:/]{1,120}$/.test(name || '')) return send(res, 400, { error: 'bad_name' });
    const r = await engine.engineJson('DELETE', '/api/delete', { name });
    return send(res, r.status === 200 ? 200 : 500, { ok: r.status === 200 });
  }
  if (p === '/api/chat' && m === 'POST') {
    const body = await readJson(req);
    const s = readSettings();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const sys = (body.systemPrompt ?? s.systemPrompt ?? '').trim();
    const payload = {
      model: String(body.model || s.model),
      messages: sys ? [{ role: 'system', content: sys }, ...messages] : messages,
      stream: true,
      options: { temperature: Number(body.temperature ?? s.temperature), num_ctx: parseInt(body.numCtx ?? s.numCtx, 10) },
    };
    return proxyStream(req, res, '/api/chat', payload);
  }
  if (p === '/api/chats') {
    if (m === 'GET') return send(res, 200, { chats: listChats() });
    if (m === 'DELETE') {            // حذف الكل
      for (const f of fs.readdirSync(P.chats)) if (f.endsWith('.json')) fs.unlinkSync(path.join(P.chats, f));
      return send(res, 200, { ok: true });
    }
  }
  const cm = p.match(/^\/api\/chats\/([^/]+)$/);
  if (cm) {
    const id = cm[1];
    if (!ID_RE.test(id)) return send(res, 400, { error: 'bad_id' });
    if (m === 'GET') {
      try { return send(res, 200, JSON.parse(fs.readFileSync(chatFile(id), 'utf8'))); }
      catch { return send(res, 404, { error: 'not_found' }); }
    }
    if (m === 'PUT') {
      const c = await readJson(req);
      const now = Date.now();
      const chat = {
        id,
        title: String(c.title || '').slice(0, 120),
        model: String(c.model || ''),
        created: Number(c.created) || now,
        updated: now,
        messages: (Array.isArray(c.messages) ? c.messages : []).map((x) => ({
          role: ['user', 'assistant', 'system'].includes(x.role) ? x.role : 'user',
          content: String(x.content || ''),
        })),
      };
      writeJsonAtomic(chatFile(id), chat);
      return send(res, 200, { ok: true });
    }
    if (m === 'DELETE') {
      try { fs.unlinkSync(chatFile(id)); } catch { /* غير موجود */ }
      return send(res, 200, { ok: true });
    }
  }
  if (p === '/api/quit' && m === 'POST') {
    send(res, 200, { ok: true });
    setTimeout(() => shutdown(0), 200);
    return;
  }
  return send(res, 404, { error: 'not_found' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(P.web, rel));
  if (file !== P.web && !file.startsWith(P.web + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    send(res, 200, buf, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' || ext === '.svg' || ext === '.png' ? 'public, max-age=86400' : 'no-store',
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!hostOk(req)) return send(res, 403, 'Forbidden');
    const url = new URL(req.url, `http://127.0.0.1:${httpPort}`);
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && !originOk(req)) return send(res, 403, { error: 'bad_origin' });
      return await api(req, res, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) send(res, 500, { error: 'server_error' });
    else res.end();
  }
});

const openBrowser = openTarget;

function shutdown(code) {
  engine.stopEngine();
  server.close();
  process.exit(code);
}

async function main() {
  ensureDirs();
  const noOpen = process.argv.includes('--no-open') || process.env.CAF_NO_BROWSER;
  const preferred = parseInt(process.env.CAF_PORT, 10) || 3737;

  // إن كان كآف AI يعمل أصلًا فنفتح الدردشة فقط
  const running = await new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: preferred, path: '/api/info', timeout: 1200 }, (r) => {
      let b = ''; r.on('data', (c) => { b += c; });
      r.on('end', () => { try { resolve(JSON.parse(b).name === 'CAF AI'); } catch { resolve(false); } });
    });
    req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); });
  });
  ui.banner();
  say('');
  if (running) {
    const url = `http://127.0.0.1:${preferred}`;
    ok(tr('كآف AI يعمل أصلًا', 'CAF AI is already running') + `  ${amber(url)}`);
    if (!noOpen) { step(tr('فتح الدردشة في المتصفح…', 'Opening the chat in your browser…')); openBrowser(url); }
    say('');
    process.exit(0);
  }
  if (!findOllama()) fail(tr('المحرك غير مثبّت. شغّل: startcaf', 'Engine not installed. Run: startcaf'));
  step(tr('تشغيل المحرك المحلي…', 'Starting local engine…'));
  try { await engine.startEngine(); }
  catch (e) { fail(tr(`تعذّر تشغيل المحرك (${e.message})`, `Could not start the engine (${e.message})`)); }
  ok(tr('المحرك جاهز', 'Engine ready'));
  httpPort = await new Promise((resolve) => {
    const tryListen = (port) => {
      const onErr = () => tryListen(port + 1);
      server.once('error', onErr);
      server.listen(port, '127.0.0.1', () => { server.off('error', onErr); resolve(port); });
    };
    tryListen(preferred);
  });
  const url = `http://127.0.0.1:${httpPort}`;
  try { fs.writeFileSync(P.state, JSON.stringify({ port: httpPort, pid: process.pid, started: Date.now() })); ownsState = true; } catch { /* */ }
  ok(`${tr('كآف AI يعمل', 'CAF AI is running')}  ${amber(url)}`);
  if (!noOpen) { step(tr('فتح الدردشة في المتصفح…', 'Opening the chat in your browser…')); openBrowser(url); }
  say('');
  info(tr('محادثاتك محفوظة على جهازك فقط · للإيقاف اضغط Ctrl+C أو شغّل: startcaf stop', 'Your chats stay on this device · Press Ctrl+C or run: startcaf stop'));
  say('');
}

let ownsState = false;
function cleanup() { if (ownsState) { try { fs.unlinkSync(P.state); } catch { /* */ } } }
process.on('SIGINT', () => { cleanup(); shutdown(0); });
process.on('SIGTERM', () => { cleanup(); shutdown(0); });
process.on('exit', () => { cleanup(); engine.stopEngine(); });
main();
