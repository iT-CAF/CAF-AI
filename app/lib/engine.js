// CAF AI · © 2026 iT CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const http = require('http');
const { P, findOllama } = require('./paths');

let child = null;
let enginePort = null;

function freePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const s = net.createServer();
      s.once('error', () => tryPort(p + 1));
      s.once('listening', () => s.close(() => resolve(p)));
      s.listen(p, '127.0.0.1');
    };
    tryPort(start);
  });
}

function ping(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/version', timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function startEngine() {
  if (child) return enginePort;
  const bin = findOllama();
  if (!bin) throw new Error('ENGINE_MISSING');
  enginePort = await freePort(11500);
  const env = {
    ...process.env,
    OLLAMA_HOST: `127.0.0.1:${enginePort}`,
    OLLAMA_MODELS: P.models,
    OLLAMA_KEEP_ALIVE: '15m',
    OLLAMA_NOHISTORY: '1',
    // يبقي ملفات المحرك المؤقتة داخل مجلد CAF AI بدل مجلد المستخدم
    HOME: P.engineHome,
    USERPROFILE: P.engineHome,
  };
  const c = spawn(bin, ['serve'], { env, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true });
  child = c;
  c.on('exit', () => { if (child === c) child = null; });
  for (let i = 0; i < 200; i++) {
    if (await ping(enginePort)) return enginePort;
    if (!child) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('ENGINE_START_FAILED');
}

function stopEngine(force = false) {
  if (!child) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill(force ? 'SIGKILL' : 'SIGTERM');
  } catch { /* تجاهل */ }
  child = null;
}

const getPort = () => enginePort;

// يتأكد أن المحرك حيّ ويستجيب، وإلا يعيد تشغيله (توقّف أو تجمّد بعد فصل قرص مثلًا)
let healing = null;
async function ensureEngine() {
  if (child && enginePort && await ping(enginePort)) return enginePort;
  if (!healing) {
    healing = (async () => { stopEngine(true); return startEngine(); })().finally(() => { healing = null; });
  }
  return healing;
}

// طلب JSON إلى المحرك
function engineJson(method, path, body, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request({
      host: '127.0.0.1', port: enginePort, path, method, timeout,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {},
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, json: txt ? JSON.parse(txt) : {} }); }
        catch { resolve({ status: res.statusCode, json: { raw: txt } }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('ENGINE_TIMEOUT')));
    if (data) req.write(data);
    req.end();
  });
}

module.exports = { startEngine, stopEngine, ensureEngine, getPort, engineJson };
