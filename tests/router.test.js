// CAF AI · اختبارات وحدة: الموجّه التلقائي والكتالوج والتوصية والتفكير.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectIntent, pickModel } = require('../app/lib/autoroute');
const catalog = require('../app/lib/catalog');
const { thinkValue } = require('../app/lib/chat');

test('intent: images, drawing requests, code and general chat', () => {
  assert.equal(detectIntent({ text: 'ما هذا؟', hasImages: true }).route, 'vision');
  for (const s of ['ارسم لي قطة تلعب في الحديقة', 'ارسم قطة', 'صمم لي شعار لمقهى', 'ولّد صورة لغروب الشمس', 'draw a cat on the moon', 'generate an image of a red car', '/image sunset']) {
    assert.equal(detectIntent({ text: s }).route, 'image', s);
  }
  for (const s of ['ارسم مخطط انسيابي لعملية التسجيل', 'ارسم لي رسم بياني للمبيعات', 'draw a flowchart of login', 'اشرح لي ما هي الصورة الرمزية']) {
    assert.notEqual(detectIntent({ text: s }).route, 'image', s);
  }
  for (const s of ['اكتب دالة بايثون تقرأ ملف CSV', 'عندي خطأ في الكود: TypeError undefined', '```js\nconsole.log(1)\n```', 'write a python function to parse json', 'def add(a, b): return a+b  — اشرحها']) {
    assert.equal(detectIntent({ text: s }).route, 'code', s);
  }
  for (const s of ['اشرح لي مفهوم الذكاء الاصطناعي ببساطة', 'ساعدني أصيغ رسالة بريد رسمية', 'ما عاصمة اليابان؟']) {
    assert.equal(detectIntent({ text: s }).route, 'chat', s);
  }
  assert.equal(detectIntent({ text: 'مرحبا', workspace: 'code' }).route, 'code');
});

const INSTALLED = [
  { name: 'qwen2.5:7b', capabilities: ['completion', 'tools'] },
  { name: 'qwen2.5-coder:7b', capabilities: ['completion', 'tools', 'insert'] },
  { name: 'qwen3-vl:4b', capabilities: ['completion', 'vision', 'tools', 'thinking'] },
  { name: 'qwen3-embedding:0.6b', capabilities: ['embedding'] },
];
const HW16 = { ram: { totalGB: 16 }, gpu: { kind: 'metal', unified: true, usable: true, vramGB: 16 }, disk: { freeGB: 100 } };
const HW8CPU = { ram: { totalGB: 8 }, gpu: { kind: 'none', usable: false }, disk: { freeGB: 100 } };

test('pickModel: best installed per route, pins win, embeddings never chat', () => {
  assert.equal(pickModel('code', { installed: INSTALLED, hw: HW16 }).model, 'qwen2.5-coder:7b');
  assert.equal(pickModel('vision', { installed: INSTALLED, hw: HW16 }).model, 'qwen3-vl:4b');
  assert.equal(pickModel('chat', { installed: INSTALLED, hw: HW16 }).model, 'qwen2.5:7b');
  assert.equal(pickModel('chat', { installed: INSTALLED, hw: HW16, settings: { modelsByRole: { chat: 'qwen3-vl:4b' } } }).model, 'qwen3-vl:4b');
  // تثبيت نموذج لا يرى الصور للرؤية يُتجاهل
  assert.equal(pickModel('vision', { installed: INSTALLED, settings: { modelsByRole: { vision: 'qwen2.5:7b' } } }).model, 'qwen3-vl:4b');
  assert.equal(pickModel('vision', { installed: INSTALLED.filter((m) => !m.capabilities.includes('vision')) }).why, 'no_vision_model');
  assert.equal(pickModel('chat', { installed: [INSTALLED[3]] }).model, null);
});

test('catalog: valid, fit and recommendations follow the hardware', () => {
  const c = catalog.load();
  assert.ok(catalog.validCatalog(c));
  const names = new Set(c.models.map((m) => m.name));
  assert.equal(names.size, c.models.length, 'no duplicates');
  const big = catalog.find('qwen3.5:27b');
  assert.equal(catalog.fit(big, HW16), 'too_big', '22 GB model on a 16 GB device');
  assert.equal(catalog.fit(catalog.find('qwen3.5:9b'), { ram: { totalGB: 12 }, gpu: { unified: true, usable: true } }), 'tight');
  assert.equal(catalog.fit(catalog.find('qwen3.5:9b'), HW16), 'ok');
  assert.equal(catalog.fit(catalog.find('qwen2.5:14b'), { ram: { totalGB: 32 }, gpu: { usable: false } }), 'slow');
  assert.equal(catalog.fit(catalog.find('qwen3:30b'), { ram: { totalGB: 48 }, gpu: { usable: false } }), 'ok', 'MoE is fine on CPU');
  const r16 = catalog.recommend(HW16, []);
  const r8 = catalog.recommend(HW8CPU, []);
  for (const role of ['chat', 'code', 'vision', 'embed']) {
    assert.ok(r16[role].recommended, role);
    assert.ok(catalog.find(r8[role].recommended).ramGB <= 8 * 0.6, `${role} fits 8GB CPU`);
  }
  assert.ok(catalog.find(r16.chat.recommended).sizeGB > catalog.find(r8.chat.recommended).sizeGB, 'bigger device gets a bigger model');
  const low = catalog.recommend({ ram: { totalGB: 4 }, gpu: { usable: false }, disk: { freeGB: 50 } }, []);
  assert.ok(catalog.find(low.chat.recommended).ramGB <= 4 * 0.85, 'a 4 GB device still gets something that runs');
  assert.ok(!catalog.find(r8.code.recommended).licenseWarn, 'non-commercial licenses are not the default pick');
});

test('thinking values follow model capabilities', () => {
  const caps = ['completion', 'thinking'];
  assert.equal(thinkValue('auto', caps), undefined);
  assert.equal(thinkValue('on', caps), true);
  assert.equal(thinkValue('off', caps), false);
  assert.equal(thinkValue('high', caps), 'high');
  assert.equal(thinkValue('on', ['completion']), undefined, 'non-thinking models get no think field');
  const oss = catalog.find('gpt-oss:20b');
  assert.equal(thinkValue('off', caps, oss), 'low', 'gpt-oss cannot disable thinking');
  assert.equal(thinkValue('on', caps, oss), 'medium');
});

test('build requests go to the code route (canvas), writing requests stay in chat', () => {
  for (const s of ['اكتب لي آلة حاسبة بسيطة: ملف index.html وملف style.css', 'سوي لي صفحة هبوط لمتجر', 'ابني لي موقع شخصي', 'write a todo app in react', 'اكتب كود يحسب المتوسط'])
    assert.equal(detectIntent({ text: s }).route, 'code', s);
  for (const s of ['اكتب لي مقال عن الصحة', 'اكتب رسالة لمديري', 'اعمل لي خطة مذاكرة', 'اشرح لي الذكاء الاصطناعي'])
    assert.equal(detectIntent({ text: s }).route, 'chat', s);
});
