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
const skills = require('./skills');

const CODE_PROMPT_AR = [
  'أنت مساعد برمجة خبير داخل «كآف AI». أجب بلغة المستخدم (العربية افتراضيًا) واكتب الكود دائمًا داخل كتل ``` مع اسم اللغة.',
  'عند كتابة ملف كامل ضع اسمه المقترح في سطر قبل الكتلة بصيغة: **الملف:** `name.ext`.',
  'اشرح باختصار ودقة، واذكر الافتراضات، ولا تخترع مكتبات أو دوال غير موجودة. التعليقات داخل الكود بلغة المستخدم إن طلب ذلك.',
  'أسماء المتغيرات والدوال والملفات بالإنجليزية دائمًا (حتى لو كان الشرح بالعربية)، أما النصوص الظاهرة للمستخدم والتعليقات فبلغته.',
  'برامج Python وJavaScript تُشغَّل في بيئة معزولة بلا إنترنت ولا إدخال من لوحة المفاتيح: لا تستخدم input() ولا prompt() ولا مكتبات غير قياسية؛ ضع قيمًا تجريبية في الكود واطبع النتائج.',
  'كآف AI يعمل دون إنترنت: في صفحات HTML لا تستخدم روابط CDN ولا خطوطًا أو صورًا من الإنترنت؛ اكتب CSS وJavaScript داخل الملف نفسه، واستخدم SVG مضمّنًا أو تدرجات CSS بدل الصور. اجعل صفحة HTML ملفًا واحدًا كاملًا يبدأ بـ <!DOCTYPE html>.',
].join('\n');

// ---------- قفل لغة الرد ----------
// العربية تُكتب بالعربية فقط (الكود والمصطلحات التقنية مسموحة بالإنجليزية). أي حروف صينية/يابانية/كورية/سيريلية/تايلاندية
// خارج كتل الكود تعني أن النموذج خلط اللغات: نعيد التوليد مرة بتعليمات أشد، ثم نحذف تلك الحروف كحل أخير.
const AR_LETTERS = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const FOREIGN = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\u1100-\u11FF\u0400-\u04FF\u0E00-\u0E7F\uFF00-\uFF60]/;
const FOREIGN_G = new RegExp(FOREIGN.source, 'g');
function detectLang(text) {
  const s = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
  const ar = (s.match(AR_LETTERS) || []).length;
  const lat = (s.match(/[A-Za-z]/g) || []).length;
  if (ar >= 2 && ar * 2 >= lat * 0.5) return 'ar';
  if (lat >= 3) return 'en';
  return null;
}
const LANG_RULE = {
  ar: 'قاعدة اللغة: أجب دائمًا باللغة العربية الفصحى الواضحة فقط. ممنوع منعًا باتًا استخدام الصينية أو أي لغة أخرى في الشرح. أسماء التقنيات والكود يمكن أن تبقى بالإنجليزية.',
  en: 'Language rule: always answer in clear English only. Never switch to Chinese or any other language.',
};
const LANG_REMINDER = { ar: '\n\n(أجب بالعربية فقط.)', en: '\n\n(Answer in English only.)' };
const outsideCode = (s) => String(s).replace(/```[\s\S]*?(```|$)/g, ' ');

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

// الصور المرفقة: تُحمَّل من مجلد المحادثة كـ base64 (آخر 4 رسائل فيها صور فقط لتوفير السياق)
const MAX_IMAGE_TURNS = 4;
function mapMessages(raw, { chatId, vision }) {
  let imageTurns = 0;
  const out = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    const m = raw[i];
    const msg = { role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user', content: String(m.content ?? '') };
    const ids = Array.isArray(m.images) ? m.images.filter((x) => typeof x === 'string') : [];
    if (ids.length && m.role === 'user') {
      if (vision && imageTurns < MAX_IMAGE_TURNS && chatId) {
        const imgs = ids.map((id) => store.attachmentBase64(chatId, id)).filter(Boolean);
        if (imgs.length) { msg.images = imgs; imageTurns++; }
      } else {
        msg.content = `[${ids.length} صورة مرفقة]\n` + msg.content;
      }
    }
    out.unshift(msg);
  }
  return out;
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

    const messages = hooks.mapMessages ? await hooks.mapMessages(raw, { body, caps }) : mapMessages(raw, { chatId: body.chatId, vision: hasCap(caps, 'vision') });
    const lang = detectLang(text) || (settings.lang === 'ar' && !text ? 'ar' : null);
    if (lang) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') { messages[i] = { ...messages[i], content: String(messages[i].content) + LANG_REMINDER[lang] }; break; }
      }
    }
    const sysParts = [];
    if (lang) sysParts.push(LANG_RULE[lang]);
    const userSys = String(body.systemPrompt ?? settings.systemPrompt ?? '').trim();
    if (route === 'code' || body.workspace === 'code') sysParts.push(String(settings.codeSystemPrompt || '').trim() || CODE_PROMPT_AR);
    if (userSys) sysParts.push(userSys);
    const numCtx = parseInt(body.numCtx ?? settings.numCtx, 10);
    // المهارات: يدويًا من الواجهة (body.skills) أو تلقائيًا حسب الطلب
    const sk = skills.select({ text, explicit: body.skills, workspace: body.workspace === 'code' || route === 'code' ? 'code' : (body.workspace || 'chat') });
    const skPrompt = skills.promptFor(sk.list, { numCtx, lang: lang || settings.lang });
    if (skPrompt) sysParts.push(skPrompt);
    const extra = hooks.extraContext ? await hooks.extraContext({ body, text, settings }) : null;
    if (extra?.system) sysParts.push(extra.system);

    const thinkSetting = String(body.think ?? settings.think ?? 'auto');
    // «تلقائي» مع صورة: وصف الصور لا يحتاج تفكيرًا مطوّلًا (قد يستغرق دقائق على نماذج الرؤية)، فنطفئه ما لم يطلبه المستخدم
    const think = route === 'vision' && thinkSetting === 'auto' && !catalog.find(model)?.thinkLevels && hasCap(caps, 'thinking') ? false : thinkValue(thinkSetting, caps, catalog.find(model));
    const payload = {
      model,
      messages: sysParts.length ? [{ role: 'system', content: sysParts.join('\n\n') }, ...messages] : messages,
      options: { temperature: Number(body.temperature ?? settings.temperature), num_ctx: numCtx },
    };
    if (think !== undefined) payload.think = think;
    return {
      payload,
      meta: { model, route, auto, reason: intent.reason, why, think: think ?? null, caps, lang, skills: sk.list.map((x) => ({ id: x.id, name: (lang || settings.lang) === 'en' ? x.nameEn : x.nameAr, emoji: x.emoji, auto: sk.auto })), ...(extra?.meta || {}) },
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
    let closed = false;
    c.res.on('close', () => { closed = true; });
    try {
      await streamGuarded(built, out, () => closed);
      out.end();
    } catch (e) {
      if (e.name === 'AbortError' || closed) return;
      log.warn('chat failed', { model: built.payload.model, err: e.message });
      out.end({ error: mapChatError(e) });
    }
  }
  return { handle, build };
}

// بث مع حارس اللغة: إعادة واحدة بتعليمات أشد وحرارة أقل، ثم حذف الحروف الأجنبية
async function streamGuarded(built, out, isClosed) {
  const lang = built.meta.lang;
  const payload = built.payload;
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController();
    const poll = setInterval(() => { if (isClosed()) ac.abort(); }, 250);
    let content = ''; let tripped = false;
    const strip = !!lang && attempt >= 1;
    try {
      await ollama.chatStream(payload, {
        signal: ac.signal,
        onLine: (j) => {
          if (lang && j.message?.content) {
            if (strip) j.message.content = j.message.content.replace(FOREIGN_G, '');
            else {
              content += j.message.content;
              if (FOREIGN.test(outsideCode(content))) { tripped = true; ac.abort(); return; }
            }
          }
          out.write(j);
        },
      });
    } catch (e) {
      if (!tripped) throw e;
    } finally { clearInterval(poll); }
    if (!tripped || isClosed()) return;
    log.info('language guard: regenerating', { model: payload.model, lang });
    out.write({ reset: true, reason: 'language' });
    payload.options = { ...payload.options, temperature: Math.min(Number(payload.options?.temperature) || 0.7, 0.3) };
    const sys = payload.messages[0]?.role === 'system' ? payload.messages[0] : null;
    const strict = lang === 'ar' ? 'تنبيه مهم: كتبتَ بلغة غير العربية في محاولة سابقة. اكتب الرد كاملًا بالعربية فقط، كلمة بكلمة، دون أي حرف صيني.' : 'Important: write the whole answer in English only, with no Chinese characters.';
    if (sys) sys.content += '\n' + strict; else payload.messages.unshift({ role: 'system', content: strict });
  }
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

module.exports = { createChat, mapChatError, thinkValue, ChatError, CODE_PROMPT_AR, detectLang, FOREIGN, mapMessages };
