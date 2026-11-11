// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// معالج المحادثة: يبني الطلب للمحرك (النموذج، التعليمات، التفكير، الصور، السياق) ويبث الرد كـ NDJSON.
// السطر الأول دائمًا {meta:{model,route,auto,...}} ثم أسطر Ollama كما هي، ثم سطر done.
'use strict';
const { fail, readJson, ndjson } = require('./http');
const store = require('./store');
const ollama = require('./providers/ollama');
const catalog = require('./catalog');
const hardware = require('./hardware');
const { detectIntent, pickModel } = require('./autoroute');
const log = require('./log');

const CODE_PROMPT_AR = [
  'أنت مساعد برمجة خبير داخل «كآف AI». أجب بلغة المستخدم (العربية افتراضيًا) واكتب الكود دائمًا داخل كتل ``` مع اسم اللغة.',
  'عند كتابة ملف كامل ضع اسمه المقترح في سطر قبل الكتلة بصيغة: **الملف:** `name.ext`.',
  'اشرح باختصار ودقة، واذكر الافتراضات، ولا تخترع مكتبات أو دوال غير موجودة. التعليقات داخل الكود بلغة المستخدم إن طلب ذلك.',
].join('\n');

class ChatError extends Error { constructor(code, status = 400, extra = {}) { super(code); this.code = code; this.status = status; Object.assign(this, extra); } }

const hasCap = (caps, c) => (caps || []).includes(c);

// قيمة think المرسلة للمحرك حسب الإعداد وقدرات النموذج
function thinkValue(setting, caps, catEntry) {
  if (!hasCap(caps, 'thinking')) return undefined;
  const levels = catEntry?.thinkLevels;
  if (levels) { // gpt-oss: مستويات فقط ولا يمكن إيقافه كليًا
    if (['low', 'medium', 'high'].includes(setting)) return setting;
    if (setting === 'off') return 'low';
    if (setting === 'on') return 'medium';
    return undefined;
  }
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  if (['low', 'medium', 'high'].includes(setting)) return setting;
  return undefined; // تلقائي: سلوك النموذج الافتراضي
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return String(messages[i].content || '');
  return '';
}

function createChat(hooks = {}) {
  async function build(body, settings) {
    const raw = Array.isArray(body.messages) ? body.messages : [];
    const text = lastUserText(raw);
    const lastUser = [...raw].reverse().find((m) => m.role === 'user');
    const hasImages = !!(lastUser && Array.isArray(lastUser.images) && lastUser.images.length);
    const requested = String(body.model || settings.model || '');
    const auto = !requested || requested === 'auto';
    const intent = detectIntent({ text, hasImages, workspace: body.workspace, forced: body.route });

    // طلب صورة: الواجهة تستدعي توليد الصور بدل المحادثة
    if (intent.route === 'image' && !body.noImageRoute) return { image: true, meta: { route: 'image', auto, reason: intent.reason, prompt: text.replace(/^\s*\/image\b\s*/i, '') } };

    let installed = [];
    try { installed = await ollama.listModels(); } catch { /* المحرك سيعيد خطأ أوضح لاحقًا */ }
    const route = intent.route;
    let model; let why = 'manual';
    if (auto) {
      const hw = hardware.cached();
      const pick = pickModel(route, { installed, settings, hw });
      if (!pick.model) throw new ChatError(pick.why === 'no_vision_model' ? 'no_vision_model' : 'no_model', 400, { suggest: suggestFor(route === 'vision' ? 'vision' : 'chat', installed) });
      model = pick.model; why = pick.why;
    } else {
      model = requested;
    }
    const info = installed.find((m) => catalog.sameModel(m.name, model));
    if (!auto && installed.length && !info) throw new ChatError('model_not_installed', 400, { model });
    const caps = info?.capabilities || [];
    if (hasImages && !hasCap(caps, 'vision')) {
      throw new ChatError('model_no_vision', 400, { model, alternatives: installed.filter((m) => hasCap(m.capabilities, 'vision')).map((m) => m.name), suggest: suggestFor('vision', installed) });
    }

    const messages = hooks.mapMessages ? await hooks.mapMessages(raw, { body, caps }) : raw.map((m) => ({ role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user', content: String(m.content ?? '') }));
    const sysParts = [];
    const userSys = String(body.systemPrompt ?? settings.systemPrompt ?? '').trim();
    if (route === 'code' || body.workspace === 'code') sysParts.push(String(settings.codeSystemPrompt || '').trim() || CODE_PROMPT_AR);
    if (userSys) sysParts.push(userSys);
    const extra = hooks.extraContext ? await hooks.extraContext({ body, text, settings }) : null;
    if (extra?.system) sysParts.push(extra.system);

    const think = thinkValue(String(body.think ?? settings.think ?? 'auto'), caps, catalog.find(model));
    const numCtx = parseInt(body.numCtx ?? settings.numCtx, 10);
    const payload = {
      model,
      messages: sysParts.length ? [{ role: 'system', content: sysParts.join('\n\n') }, ...messages] : messages,
      options: { temperature: Number(body.temperature ?? settings.temperature), num_ctx: numCtx },
    };
    if (think !== undefined) payload.think = think;
    return {
      payload,
      meta: { model, route, auto, reason: intent.reason, why, think: think ?? null, caps, ...(extra?.meta || {}) },
    };
  }

  async function handle(c) {
    const body = await readJson(c.req, 64 * 1024 * 1024);
    const settings = store.readSettings();
    let built;
    try { built = await build(body, settings); }
    catch (e) {
      if (e instanceof ChatError) return sendErr(c.res, e);
      return fail(c.res, 500, 'chat_failed', e.message);
    }
    const out = ndjson(c.res);
    out.write({ meta: built.meta });
    if (built.image) return out.end({ done: true, image: true });
    const ac = new AbortController();
    c.res.on('close', () => ac.abort());
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

function sendErr(res, e) {
  const { send } = require('./http');
  const extra = {};
  for (const k of ['model', 'alternatives', 'suggest']) if (e[k] !== undefined) extra[k] = e[k];
  send(res, e.status, { error: e.code, ...extra });
}

// اقتراح نموذج للتنزيل حسب الجهاز
function suggestFor(role, installed) {
  try {
    const hw = hardware.cached();
    const rec = catalog.recommend(hw, installed.map((m) => m.name));
    return rec[role]?.recommended || null;
  } catch { return null; }
}

function mapChatError(e) {
  const m = String(e.message || e);
  if (/not found|try pulling/i.test(m) && /model/i.test(m)) return 'model_not_installed';
  if (/memory|requires more system memory|out of memory|OOM/i.test(m)) return 'not_enough_ram';
  if (/ECONNREFUSED|ECONNRESET|socket hang up/i.test(m)) return 'engine_unreachable';
  if (/does not support images|vision/i.test(m)) return 'model_no_vision';
  if (/does not support thinking/i.test(m)) return 'model_no_thinking';
  if (/no space|ENOSPC/i.test(m)) return 'disk_full';
  return m;
}

module.exports = { createChat, mapChatError, thinkValue, ChatError, CODE_PROMPT_AR };
