// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { P } = require('./paths');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readState = () => { try { return JSON.parse(fs.readFileSync(P.state, 'utf8')); } catch { return null; } };

function req(port, method, p, timeout = 1500) {
  return new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, timeout }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve(null); } });
    });
    r.on('error', () => resolve(null)); r.on('timeout', () => { r.destroy(); resolve(null); });
    r.end();
  });
}

// { running, port, models, model }
async function status() {
  const candidates = [];
  const s = readState(); if (s) candidates.push(s.port);
  const pref = parseInt(process.env.CAF_PORT, 10) || 3737;
  if (!candidates.includes(pref)) candidates.push(pref);
  for (const port of candidates) {
    const i = await req(port, 'GET', '/api/info', 900);
    if (i && i.name === 'CAF AI') {
      const m = await req(port, 'GET', '/api/models', 1500);
      const set = await req(port, 'GET', '/api/settings', 900);
      return { running: true, port, models: m?.models?.length ?? 0, model: set?.model || '' };
    }
  }
  return { running: false, port: pref, models: 0, model: '' };
}

// يشغّل الخادم في الخلفية ويعيد المنفذ عند الجاهزية
async function startDaemon() {
  fs.mkdirSync(P.data, { recursive: true });
  const log = fs.openSync(path.join(P.data, 'server.log'), 'w');
  const child = spawn(process.execPath, [path.join(P.app, 'server.js'), '--no-open'], {
    detached: true, stdio: ['ignore', log, log], windowsHide: true, env: { ...process.env, CAF_DAEMON: '1' },
  });
  let exited = false; child.on('exit', () => { exited = true; });
  child.unref();
  for (let i = 0; i < 300; i++) {
    const st = await status();
    if (st.running) return st;
    if (exited) break;
    await sleep(300);
  }
  let tail = ''; try { tail = fs.readFileSync(path.join(P.data, 'server.log'), 'utf8').split('\n').slice(-6).join('\n'); } catch { /* */ }
  throw new Error(tail || 'timeout');
}

async function stopDaemon() {
  const st = await status();
  if (!st.running) return false;
  const s = readState();
  await new Promise((resolve) => { const r = http.request({ host: '127.0.0.1', port: st.port, path: '/api/quit', method: 'POST', timeout: 2000 }, (res) => { res.resume(); res.on('end', resolve); }); r.on('error', resolve); r.on('timeout', () => { r.destroy(); resolve(); }); r.end(); });
  for (let i = 0; i < 40; i++) { if (!(await status()).running) return true; await sleep(250); }
  if (s && s.pid) { try { process.kill(s.pid); } catch { /* */ } }
  return true;
}

module.exports = { status, startDaemon, stopDaemon, readState, sleep };
