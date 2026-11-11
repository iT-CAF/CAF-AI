// CAF AI · يشغّل خادم كآف AI حقيقيًا في CAF_HOME مؤقت مع Ollama وهمي، ويعيد عميل HTTP مُصادَق.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { startMock } = require('./mock-ollama');

const ROOT = path.resolve(__dirname, '..', '..');

function tmpHome(prefix = 'caf-test-') { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

function request(port, method, p, { body, headers = {}, raw = false } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const h = { Host: `127.0.0.1:${port}`, ...headers };
    if (data) { h['Content-Length'] = data.length; if (!h['Content-Type']) h['Content-Type'] = 'application/json'; }
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers: h }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks); const text = buf.toString('utf8');
        let json = null; if (!raw) { try { json = JSON.parse(text); } catch { /* */ } }
        resolve({ status: res.statusCode, headers: res.headers, text, json, buf });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function startServer({ home = tmpHome(), mockOpts, env = {}, before } = {}) {
  const mock = await startMock(mockOpts);
  if (before) await before(home);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(ROOT, 'app', 'server.js'), '--no-open'], {
    env: { ...process.env, CAF_HOME: home, CAF_MODELS: path.join(home, 'models'), CAF_ENGINE_URL: `http://127.0.0.1:${mock.port}`, CAF_PORT: String(port), CAF_NO_BROWSER: '1', NO_COLOR: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', (c) => { out += c; }); child.stderr.on('data', (c) => { out += c; });
  const stateFile = path.join(home, 'data', 'server.json');
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(stateFile)) break;
    if (child.exitCode !== null) throw new Error('server exited: ' + out);
    await new Promise((r) => setTimeout(r, 100));
  }
  const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const auth = { 'X-CAF-Token': st.token };
  const api = (method, p, opts = {}) => request(st.port, method, p, { ...opts, headers: { ...auth, ...(opts.headers || {}) } });
  const stop = async () => { child.kill('SIGTERM'); await new Promise((r) => child.once('exit', r)); await mock.close(); };
  return { home, port: st.port, token: st.token, api, raw: (m, p, o) => request(st.port, m, p, o), mock, child, stop, log: () => out };
}

// يقرأ بث NDJSON إلى مصفوفة
const parseNdjson = (text) => text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

module.exports = { startServer, request, tmpHome, parseNdjson, ROOT };
