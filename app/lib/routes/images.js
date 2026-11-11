// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// توليد الصور: المعرض، الحالة والنماذج، التوليد كمهمة بتقدّم حقيقي، تحسين الوصف العربي إلى برومبت إنجليزي.
'use strict';
const { send, fail, readJson, sendFile } = require('../http');
const sd = require('../providers/sdcpp');
const jobs = require('../jobs');
const store = require('../store');
const skills = require('../skills');
const ollama = require('../providers/ollama');
const { pickModel } = require('../autoroute');
const hardware = require('../hardware');

module.exports = function routes(r) {
  r.add('GET', '/api/images', (c) => send(c.res, 200, { images: sd.list() }));
  r.add('GET', '/api/images/status', async (c) => {
    const st = await sd.status(); const hw = hardware.cached();
    send(c.res, 200, { ...st, models: sd.imageModels(), gpu: !!hw?.gpu?.usable, ramGB: hw?.ram?.totalGB || null, running: jobs.running('image') });
  });
  r.add('POST', '/api/images/estimate', async (c) => send(c.res, 200, { seconds: sd.estimate(await readJson(c.req)) }));
  r.add('POST', '/api/images/generate', async (c) => {
    const b = await readJson(c.req);
    if (jobs.running('image')) return fail(c.res, 409, 'image_busy');
    const job = jobs.create('image', String(b.promptAr || b.prompt || '').slice(0, 80), ({ update, signal }) => sd.generate(b, { update, signal }));
    send(c.res, 202, { ...job, estimate: sd.estimate(b) });
  });
  r.add('DELETE', '/api/images/:id', (c) => send(c.res, sd.remove(c.params.id) ? 200 : 400, { ok: true }));
  r.add('GET', '/files/img/:id', (c) => {
    const f = sd.filePath(String(c.params.id).replace(/\.png$/, ''));
    return f ? sendFile(c.req, c.res, f, { 'Content-Type': 'image/png' }) : fail(c.res, 404, 'not_found');
  }, { cookie: true });

  // «حسّن الوصف»: نموذج المحادثة + مهارة مهندس الأوصاف يحوّل الفكرة العربية إلى برومبت إنجليزي مفصّل
  r.add('POST', '/api/images/enhance', async (c) => {
    const { text } = await readJson(c.req);
    if (!String(text || '').trim()) return fail(c.res, 400, 'empty_prompt');
    const settings = store.readSettings();
    const installed = await ollama.listModels();
    const pick = pickModel('chat', { installed, settings, hw: hardware.cached() });
    if (!pick.model) return fail(c.res, 400, 'no_model');
    const sk = skills.get('caf/image-prompter');
    const sys = (sk ? sk.body : 'Turn the idea into one detailed English image prompt.') + '\n\nOutput: one English line only, no quotes, no explanation.';
    try {
      const out = await ollama.chatOnce({ model: pick.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: String(text).slice(0, 2000) }], options: { temperature: 0.6 }, think: false });
      const prompt = out.content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^["'`\s]+|["'`\s]+$/g, '').split('\n').filter(Boolean).pop() || '';
      send(c.res, 200, { prompt: prompt.slice(0, 1500), model: pick.model });
    } catch (e) { fail(c.res, 500, 'enhance_failed', e.message); }
  }, { engine: true });
};
