// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// معالج المحادثة: يبني الطلب للمحرك (النموذج، التعليمات، السياق) ويبث الرد إلى الواجهة كـ NDJSON.
// السطر الأول دائمًا {meta:{model,route,...}} ثم أسطر Ollama كما هي، ثم {done:true,...}.
'use strict';
const { fail, readJson, ndjson } = require('./http');
const store = require('./store');
const ollama = require('./providers/ollama');
const log = require('./log');

function createChat() {
  async function build(body, settings) {
    const messages = (Array.isArray(body.messages) ? body.messages : []).map((m) => ({
      role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
      content: String(m.content ?? ''),
    }));
    const model = String(body.model || settings.model || '');
    const sys = String(body.systemPrompt ?? settings.systemPrompt ?? '').trim();
    const payload = {
      model,
      messages: sys ? [{ role: 'system', content: sys }, ...messages] : messages,
      options: { temperature: Number(body.temperature ?? settings.temperature), num_ctx: parseInt(body.numCtx ?? settings.numCtx, 10) },
    };
    return { payload, meta: { model, route: 'manual' } };
  }

  async function handle(c) {
    const body = await readJson(c.req, 64 * 1024 * 1024);
    const settings = store.readSettings();
    let built;
    try { built = await build(body, settings); }
    catch (e) { return fail(c.res, e.status || 400, e.code || 'chat_failed', e.message); }
    if (!built.payload.model) return fail(c.res, 400, 'no_model');
    const out = ndjson(c.res);
    const ac = new AbortController();
    c.res.on('close', () => ac.abort());
    out.write({ meta: built.meta });
    try {
      await ollama.chatStream(built.payload, { signal: ac.signal, onLine: (j) => out.write(j) });
      out.end();
    } catch (e) {
      if (e.name === 'AbortError') return;
      log.warn('chat failed', { model: built.payload.model, err: e.message });
      out.end({ error: mapChatError(e) });
    }
  }
  return { handle, build };
}

function mapChatError(e) {
  const m = String(e.message || e);
  if (/not found|pull/i.test(m) && /model/i.test(m)) return 'model_not_installed';
  if (/memory|requires more system memory|out of memory|OOM/i.test(m)) return 'not_enough_ram';
  if (/ECONNREFUSED|ECONNRESET|socket hang up/i.test(m)) return 'engine_unreachable';
  if (/does not support images|vision/i.test(m)) return 'model_no_vision';
  if (/does not support thinking/i.test(m)) return 'model_no_thinking';
  return m;
}

module.exports = { createChat, mapChatError };
