// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const { send, fail, readBody, readJson } = require('../http');
const voice = require('../providers/voice');
const store = require('../store');

module.exports = function routes(r) {
  r.add('GET', '/api/voice/status', async (c) => send(c.res, 200, { enabled: store.readSettings().voiceEnabled, ...(await voice.voiceStatus()) }), { engine: true });
  r.add('POST', '/api/voice/stt', async (c) => {
    if (!store.readSettings().voiceEnabled) return fail(c.res, 403, 'voice_disabled');
    const wav = await readBody(c.req, 30 * 1024 * 1024);
    try { send(c.res, 200, await voice.transcribe(wav, c.url.searchParams.get('lang') || 'ar')); }
    catch (e) { fail(c.res, e.code === 'NO_STT' ? 409 : 500, String(e.code || 'stt_failed').toLowerCase(), e.message); }
  }, { engine: true });
  r.add('POST', '/api/voice/tts', async (c) => {
    if (!store.readSettings().voiceEnabled) return fail(c.res, 403, 'voice_disabled');
    const { text } = await readJson(c.req);
    try {
      const wav = await voice.speak(String(text || ''));
      if (!wav) return send(c.res, 409, { mode: 'system' });
      c.res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      c.res.end(wav);
    } catch (e) { fail(c.res, 500, 'tts_failed', e.message); }
  });
};
