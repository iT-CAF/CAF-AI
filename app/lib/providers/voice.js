// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// الصوت (اختياري، خلف إعداد): تحويل الكلام إلى نص وتحويل النص إلى كلام — محليًا بالكامل.
//   STT: whisper.cpp (مُنزَّل على ويندوز/لينكس، أو whisper-cli من النظام) ← نموذج صوتي في Ollama (مثل gemma4) عبر ‎/v1/audio/transcriptions‎
//   TTS: Piper + صوت عربي (ويندوز/لينكس) ← أصوات النظام المحلية في المتصفح (macOS: «ماجد») — بدون أي اتصال خارجي
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { P } = require('../paths');
const addons = require('../addons');
const engine = require('../engine');
const ollama = require('./ollama');
const { newId } = require('../fsx');

function systemBin(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const dirs = [...(process.env.PATH || '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin'];
  for (const d of dirs) { const f = path.join(d, exe); try { if (fs.statSync(f).isFile()) return f; } catch { /* */ } }
  return null;
}
const whisperBin = () => addons.binPath('whisper', 'whisper-cli') || systemBin('whisper-cli');
const whisperModel = () => {
  for (const id of ['whisper-turbo', 'whisper-small', 'whisper-base']) {
    const st = addons.modelStatus(id);
    if (st?.installed) return path.join(addons.modelDir(id), addons.loadCatalog().models[id].files[0].name);
  }
  return null;
};
async function audioModel() {
  try { await engine.ensureEngine(); return (await ollama.listModels()).find((m) => (m.capabilities || []).includes('audio'))?.name || null; } catch { return null; }
}
const piperBin = () => addons.binPath('piper', 'piper');
const piperVoice = () => (addons.modelStatus('voice-ar-kareem')?.installed ? path.join(addons.modelDir('voice-ar-kareem'), 'ar_JO-kareem-medium.onnx') : null);

async function status() {
  const wb = whisperBin(); const wm = whisperModel(); const am = await audioModel();
  const pb = piperBin(); const pv = piperVoice();
  const sttEngine = wb && wm ? 'whisper' : am ? 'ollama-audio' : null;
  return {
    stt: { engine: sttEngine, whisper: { binary: !!wb, system: !!wb && !addons.binPath('whisper', 'whisper-cli'), model: !!wm, supported: !!addons.engineStatus('whisper').supported || !!wb }, ollamaAudio: am },
    tts: { engine: pb && pv ? 'piper' : 'system', piper: { binary: !!pb, voice: !!pv, supported: !!addons.engineStatus('piper').supported } },
  };
}

// ---------- STT ----------
function runWhisper(wav, lang) {
  return new Promise((resolve, reject) => {
    const dir = path.join(P.tmp, 'stt-' + newId()); fs.mkdirSync(dir, { recursive: true });
    const inF = path.join(dir, 'in.wav'); fs.writeFileSync(inF, wav);
    const args = ['-m', whisperModel(), '-f', inF, '-l', lang || 'auto', '-nt', '-otxt', '-of', path.join(dir, 'out'), '-t', String(Math.max(2, Math.min(8, os.cpus().length - 1)))];
    const c = spawn(whisperBin(), args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let err = ''; c.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    const timer = setTimeout(() => c.kill('SIGKILL'), 180000);
    c.on('error', (e) => { clearTimeout(timer); fs.rmSync(dir, { recursive: true, force: true }); reject(e); });
    c.on('close', (code) => {
      clearTimeout(timer);
      let text = ''; try { text = fs.readFileSync(path.join(dir, 'out.txt'), 'utf8').trim(); } catch { /* */ }
      fs.rmSync(dir, { recursive: true, force: true });
      if (code !== 0 && !text) return reject(Object.assign(new Error(err.split('\n').slice(-2).join(' ')), { code: 'STT_FAILED' }));
      resolve(text.replace(/\s+/g, ' '));
    });
  });
}
// Ollama: ‎/v1/audio/transcriptions‎ (multipart) مع نموذج قدرته audio
function ollamaTranscribe(model, wav, lang) {
  return new Promise((resolve, reject) => {
    const b = '----caf' + newId().replace(/-/g, '');
    const part = (name, value) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
    const body = Buffer.concat([part('model', model), ...(lang && lang !== 'auto' ? [part('language', lang)] : []),
      Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`), wav, Buffer.from(`\r\n--${b}--\r\n`)]);
    const req = http.request({ host: engine.getHost(), port: engine.getPort(), path: '/v1/audio/transcriptions', method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${b}`, 'Content-Length': body.length }, timeout: 300000 }, (res) => {
      let s = ''; res.setEncoding('utf8'); res.on('data', (d) => { s += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(Object.assign(new Error(s.slice(0, 300)), { code: 'STT_FAILED' }));
        try { resolve(String(JSON.parse(s).text || '').trim()); } catch { reject(Object.assign(new Error('bad response'), { code: 'STT_FAILED' })); }
      });
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}
async function transcribe(wav, lang = 'ar') {
  if (wav.length < 44 || wav.subarray(0, 4).toString() !== 'RIFF') throw Object.assign(new Error('expected WAV'), { code: 'BAD_AUDIO' });
  if (whisperBin() && whisperModel()) return { text: await runWhisper(wav, lang), engine: 'whisper.cpp' };
  const am = await audioModel();
  if (am) return { text: await ollamaTranscribe(am, wav, lang), engine: am };
  throw Object.assign(new Error('no stt engine'), { code: 'NO_STT' });
}

// ---------- TTS ----------
function speak(text) {
  const bin = piperBin(); const voice = piperVoice();
  if (!bin || !voice) return Promise.resolve(null); // الواجهة تستخدم أصوات النظام المحلية
  return new Promise((resolve, reject) => {
    const out = path.join(P.tmp, `tts-${newId()}.wav`);
    const c = spawn(bin, ['--model', voice, '--config', voice + '.json', '--output_file', out], { cwd: path.dirname(bin), stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    let err = ''; c.stderr.on('data', (d) => { err = (err + d).slice(-1500); });
    c.on('error', reject);
    c.on('close', (code) => {
      try { const buf = fs.readFileSync(out); fs.rmSync(out, { force: true }); resolve(buf); }
      catch { reject(Object.assign(new Error(err || 'tts failed ' + code), { code: 'TTS_FAILED' })); }
    });
    c.stdin.end(String(text).slice(0, 5000));
  });
}

module.exports = { id: 'voice', name: 'Voice (whisper.cpp / Piper)', capabilities: ['stt', 'tts'], status: async () => { const s = await status(); return { kind: 'process', installed: !!s.stt.engine || s.tts.engine === 'piper', healthy: true, ready: !!s.stt.engine, ...s }; }, voiceStatus: status, transcribe, speak, systemBin };
