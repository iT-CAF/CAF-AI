// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { P, VERSION, ensureDirs, findOllama } = require('./lib/paths');
const engine = require('./lib/engine');
const ui = require('./lib/ui');
const { openTarget } = require('./lib/open');
const sec = require('./lib/security');
const { send, fail, mimeOf } = require('./lib/http');
const { createRouter } = require('./lib/router');
const { migrate } = require('./lib/migrate');
const { createChat } = require('./lib/chat');
const log = require('./lib/log');
const { tr, say, ok, info, step, amber } = ui;

let httpPort = 0;
const router = createRouter();
// السياق من مكتبة المعرفة (RAG) للمحادثات المرتبطة بمجموعات مستندات
const rag = require('./lib/rag');
const { isId } = require('./lib/fsx');
async function knowledgeContext({ body, text, settings }) {
  const ids = (Array.isArray(body.collections) ? body.collections : []).filter(isId);
  if (!ids.length || !String(text).trim()) return null;
  const hits = await rag.search(ids, text, { k: settings.ragTopK, embed: require('./lib/routes/docs').embedFn() });
  if (!hits.length) return { meta: { sources: [] } };
  return { system: rag.contextBlock(hits, settings.lang), meta: { sources: hits.map((h, i) => ({ n: i + 1, file: h.docName, loc: h.loc, doc: h.docId, text: h.text.slice(0, 400) })) } };
}
const ctx = { chat: createChat({ extraContext: knowledgeContext }), shutdown: (code) => shutdown(code), router };

// تسجيل المسارات (كل وحدة تضيف مساراتها)
for (const mod of ['core', 'hardware', 'addons', 'canvas', 'skills', 'update', 'docs', 'images', 'voice']) require(`./lib/routes/${mod}`)(router, ctx);

// ---------- الملفات الثابتة ----------
const STATIC_CACHE = new Set(['.woff2', '.svg', '.png', '.wasm']);
let indexTemplate = null;
function serveIndex(req, res) {
  if (!indexTemplate || process.env.CAF_DEV) indexTemplate = fs.readFileSync(path.join(P.web, 'index.html'), 'utf8');
  const html = indexTemplate.replace('</head>', `  <meta name="caf-token" content="${sec.SESSION_TOKEN}">\n</head>`).replace(/__CAF_VERSION__/g, VERSION);
  res.writeHead(200, { ...sec.appHeaders(), 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': sec.sessionCookie() });
  res.end(req.method === 'HEAD' ? undefined : html);
}

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel === '/' || rel === '/index.html') return serveIndex(req, res);
  const file = path.normalize(path.join(P.web, rel));
  if (file !== P.web && !file.startsWith(P.web + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const headers = { ...sec.appHeaders(), 'Content-Type': mimeOf(file) };
    // سياسات خاصة: عمّال تشغيل الكود وإطار المعاينة المعزول
    if (rel === '/js/workers/js-runner.js') headers['Content-Security-Policy'] = sec.CSP_JS_WORKER;
    else if (rel === '/js/workers/py-runner.js') headers['Content-Security-Policy'] = sec.cspPyWorker(req.headers.host);
    else if (rel === '/sandbox/frame.html') { headers['Content-Security-Policy'] = sec.CSP_SANDBOX; delete headers['X-Frame-Options']; delete headers['Cross-Origin-Resource-Policy']; }
    headers['Cache-Control'] = rel.startsWith('/vendor/') ? 'public, max-age=604800' : STATIC_CACHE.has(ext) ? 'public, max-age=86400' : 'no-store';
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

// ---------- الخادم ----------
const server = http.createServer(async (req, res) => {
  try {
    if (!sec.hostOk(req)) return send(res, 403, 'Forbidden');
    const url = new URL(req.url, `http://127.0.0.1:${httpPort}`);
    const hit = router.match(req.method, url.pathname);
    if (hit && hit.methodNotAllowed) return fail(res, 405, 'method_not_allowed');
    if (hit) {
      const o = hit.route.opts;
      if (!o.public) {
        if (o.apiKey) {
          if (!sec.originOk(req)) return fail(res, 403, 'bad_origin');
        } else {
          if (req.method !== 'GET' && req.method !== 'HEAD' && !sec.originOk(req)) return fail(res, 403, 'bad_origin');
          const authed = sec.headerTokenOk(req) || (o.cookie && sec.cookieTokenOk(req));
          if (!authed) return fail(res, 401, 'unauthorized');
        }
      }
      if (o.engine) {
        try { await engine.ensureEngine(); }
        catch (e) { return fail(res, 503, 'engine_unavailable', e.message); }
      }
      return await hit.route.handler({ req, res, url, params: hit.params });
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/') || url.pathname.startsWith('/files/')) return fail(res, 404, 'not_found');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url);
  } catch (e) {
    const code = e.code === 'TOO_LARGE' ? 413 : e.code === 'BAD_JSON' ? 400 : 500;
    if (code === 500) log.error('request failed', { path: req.url, err: String(e.stack || e).slice(0, 600) });
    if (!res.headersSent) fail(res, code, code === 413 ? 'too_large' : code === 400 ? 'bad_json' : 'server_error');
    else res.end();
  }
});
server.requestTimeout = 0; // التوليد قد يطول على الأجهزة بدون GPU
server.headersTimeout = 60000;

function shutdown(code) {
  for (const fn of ctx.onShutdown || []) { try { fn(); } catch { /* */ } }
  engine.stopEngine();
  server.close();
  process.exit(code);
}

async function main() {
  ensureDirs();
  try {
    const m = migrate((s) => log.info(s));
    if (m.changed) log.info('data migrated', m);
  } catch (e) { log.error('migration failed', { err: String(e.stack || e) }); }
  try { const n = require('./lib/store').cleanOrphanAttachments(); if (n) log.info('orphan attachments removed', { n }); } catch { /* */ }
  // بعد التحديث: ننتظر حتى تغلق النسخة القديمة منفذها
  if (process.env.CAF_RESTART_DELAY) { await new Promise((r) => setTimeout(r, Math.min(10000, parseInt(process.env.CAF_RESTART_DELAY, 10) || 0))); delete process.env.CAF_RESTART_DELAY; }
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
    if (!noOpen) { step(tr('فتح الدردشة في المتصفح…', 'Opening the chat in your browser…')); openTarget(url); }
    say('');
    process.exit(0);
  }
  if (!findOllama() && !engine.isExternal()) ui.fail(tr('المحرك غير مثبّت. شغّل: startcaf', 'Engine not installed. Run: startcaf'));
  step(tr('تشغيل المحرك المحلي…', 'Starting local engine…'));
  try { await engine.startEngine(); }
  catch (e) { ui.fail(tr(`تعذّر تشغيل المحرك (${e.message})`, `Could not start the engine (${e.message})`)); }
  ok(tr('المحرك جاهز', 'Engine ready'));
  httpPort = await new Promise((resolve) => {
    const tryListen = (port) => {
      const onErr = () => tryListen(port + 1);
      server.once('error', onErr);
      server.listen(port, '127.0.0.1', () => { server.off('error', onErr); resolve(port); });
    };
    tryListen(preferred);
  });
  sec.setPort(httpPort);
  const url = `http://127.0.0.1:${httpPort}`;
  try {
    // الرمز محفوظ للطرفية (startcaf) فقط: الملف داخل CAF_HOME وبصلاحيات المالك
    fs.writeFileSync(P.state, JSON.stringify({ port: httpPort, pid: process.pid, started: Date.now(), token: sec.SESSION_TOKEN, version: VERSION }), { mode: 0o600 });
    ownsState = true;
  } catch { /* */ }
  log.info('server started', { port: httpPort, version: VERSION, home: P.home });
  ok(`${tr('كآف AI يعمل', 'CAF AI is running')}  ${amber(url)}`);
  if (!noOpen) { step(tr('فتح الدردشة في المتصفح…', 'Opening the chat in your browser…')); openTarget(url); }
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
