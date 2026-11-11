// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// الموجّه التلقائي: يقرأ الطلب ويختار الفئة (رؤية/صور/برمجة/عام) والنموذج المثبّت الأنسب لها.
'use strict';
const catalog = require('./catalog');

// «ارسم لي قطة» ← توليد صورة. لكن «ارسم مخططًا/جدولًا» ← ليس توليد صورة (Mermaid أو نص).
const IMAGE_AR = /(^|[\s،,.!؟?:«"'(])(ارسم|ارسمي|ارسموا|ارسملي|صمّم|صمم|صممي|ولّد|ولد|ولدي|أنشئ|انشئ|اصنع|اعمل|سوّ|سو)\s*(لي|لنا)?\s*(صورة|صوره|صورًا|صور|رسمة|رسمه|رسم(?!\s*بياني)|لوحة|لوحه|شعار|لوجو|ايقونة|أيقونة|خلفية|خلفيه|غلاف|بوستر|ملصق|منظر|بورتريه|كاريكاتير)/;
const IMAGE_AR_SHORT = /^\s*(ارسم|ارسمي|ارسملي)\s+(لي\s+)?(?!.*(مخطط|جدول|رسم\s*بياني|خريطة\s*ذهنية|diagram|chart|flowchart))/;
const IMAGE_EN = /\b(draw|paint|sketch|illustrate|render|generate|create|make|design)\b[^.?!\n]{0,40}\b(image|picture|photo|drawing|illustration|painting|logo|icon|wallpaper|poster|portrait|artwork|art)\b/i;
const IMAGE_EN_SHORT = /^\s*(please\s+)?(draw|paint|sketch|illustrate)\s+(me\s+)?(a|an|the|some|my)?\s*\w+/i;
const NOT_IMAGE = /(mermaid|flowchart|sequence diagram|diagram|chart|graph|مخطط|رسم\s*بياني|جدول|خريطة\s*ذهنية|svg\s*code|html|css)/i;

// إشارات قاطعة: وحدها تكفي لاعتبار الطلب برمجيًا
const CODE_STRONG = [
  /```/, /^\s*(def|function|class|fn|func|interface|struct)\s+\w+\s*[(:{<]/m, /#include\s*</, /<\?php/, /\bSELECT\b[\s\S]+\bFROM\b/i,
  /^\s*(import\s+[\w.{}, *]+(\s+from\s+['"][^'"]+['"])?|from\s+[\w.]+\s+import\s+\w+)/m, /\b(console\.log|System\.out\.println|printf|std::cout)\s*[(<]/,
  /\b\w*(Error|Exception):\s/, /Traceback \(most recent call last\)/,
];
// طلب «ابنِ/اكتب/سوّ لي» + شيء برمجي (تطبيق، موقع، صفحة، لعبة، أداة…) أو اسم ملف بامتداد كود
const CODE_BUILD_AR = /(^|[\s،,.!؟?:«"'(])(اكتب|اكتبي|اعمل|اعملي|سوّ|سوي|سو|ابن|ابني|ابنِ|أنشئ|انشئ|صمّم|صمم|برمج|برمجي|طوّر|طور|جهّز|جهز|اصنع)\s*(لي|لنا)?\s*(كود|برنامج|برنامجًا|تطبيق|تطبيقًا|موقع|موقعًا|صفحة|صفحه|لعبة|لعبه|أداة|اداة|آلة\s*حاسبة|اله\s*حاسبه|حاسبة|سكربت|سكريبت|بوت|واجهة|لوحة\s*تحكم|داشبورد|نموذج\s*تسجيل|فورم|استمارة|إضافة|اضافة|قالب|متجر\s*إلكتروني|api)/;
const CODE_BUILD_EN = /\b(build|create|make|write|code|develop|generate)\b[^.?!\n]{0,30}\b(app|application|website|web ?page|landing page|game|script|tool|calculator|dashboard|component|bot|api|extension|signup form|login form|todo)\b/i;
const CODE_FILE = /\b[\w-]+\.(html?|css|js|mjs|ts|tsx|jsx|py|php|java|go|rs|rb|sql|vue|svelte|swift|kt|cpp|cs|sh)\b/i;
const CODE_HINTS = [
  /```/, /\b(def|class|function|const|let|var|import|from|return|public|private|static|void|struct|enum|fn|func|package|namespace|async|await|lambda)\b\s*[\w({]/,
  /#include\s*</, /\bSELECT\b[\s\S]+\bFROM\b/i, /=>\s*[{(]/, /<\/?(div|span|html|body|script|style)\b/i, /\$\w+\s*=/, /\b\w+\.\w+\([^)]*\)\s*;/,
  /\b(python|javascript|typescript|java|kotlin|swift|golang|rust|c\+\+|c#|php|laravel|react|vue|angular|node\.?js|django|flask|sql|regex|bash|powershell|docker|kubernetes|git|npm|api|json|yaml|html|css|tailwind|flutter|dart)\b/i,
  /(كود|الكود|برمجة|برمج|برنامج|دالة|دوال|سكربت|سكريبت|خوارزمية|استعلام|متغير|مكتبة برمجية|خطأ برمجي|باغ|تصحيح الكود|ريفاكتور|إعادة هيكلة|اختبارات وحدة|كلاس|واجهة برمجية|قاعدة بيانات)/,
  /(بايثون|جافا\s?سكربت|جافاسكريبت|تايب\s?سكربت|جافا|بي\s?اتش\s?بي|لارافيل|رياكت|فيو جي اس|سي\s?شارب|سي\+\+|سويفت|كوتلن|روست|جو\s?لانج|اس\s?كيو\s?ال|اتش\s?تي\s?ام\s?ال|سي\s?اس\s?اس|فلاتر|دارت|نود\s?جي\s?اس|باش|ريجكس)/,
  /\b(bug|error|exception|traceback|stack trace|compile|refactor|unit test|debug|function|method|variable|algorithm|endpoint|script)\b/i,
  /\b[A-Z]\w*(Error|Exception)\b/, /\b(undefined|null pointer|segfault|NaN)\b/,
];

function detectIntent({ text = '', hasImages = false, workspace = 'chat', forced = '' } = {}) {
  if (forced === 'image' || /^\s*\/image\b/i.test(text)) return { route: 'image', reason: 'command' };
  if (forced === 'code' || /^\s*\/code\b/i.test(text)) return { route: 'code', reason: 'command' };
  if (hasImages) return { route: 'vision', reason: 'image_attached' };
  const t = String(text);
  if (!NOT_IMAGE.test(t) && (IMAGE_AR.test(t) || IMAGE_AR_SHORT.test(t) || IMAGE_EN.test(t) || IMAGE_EN_SHORT.test(t))) return { route: 'image', reason: 'image_request' };
  if (workspace === 'code') return { route: 'code', reason: 'code_workspace' };
  const hits = CODE_HINTS.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
  if (CODE_STRONG.some((re) => re.test(t)) || hits >= 2 || CODE_BUILD_AR.test(t) || CODE_BUILD_EN.test(t) || CODE_FILE.test(t)) return { route: 'code', reason: 'code_request' };
  return { route: 'chat', reason: 'general' };
}

const ROLE_OF = { chat: 'chat', code: 'code', vision: 'vision' };
const hasCap = (m, cap) => (m.capabilities || []).includes(cap);
const isChatModel = (m) => !hasCap(m, 'embedding') && (hasCap(m, 'completion') || !(m.capabilities || []).length);

// يختار نموذجًا مثبّتًا للفئة. installed: [{name, capabilities}] من Ollama
function pickModel(route, { installed = [], settings = {}, hw = null, cat = catalog.load() } = {}) {
  const role = ROLE_OF[route] || 'chat';
  const usable = installed.filter(isChatModel);
  const needVision = route === 'vision';
  const ok = (m) => (needVision ? hasCap(m, 'vision') : true);
  const byName = (n) => usable.find((m) => catalog.sameModel(m.name, n));

  // 1) تثبيت المستخدم لهذه الفئة
  const pinned = settings.modelsByRole?.[role];
  if (pinned) { const m = byName(pinned); if (m && ok(m)) return { model: m.name, why: 'pinned' }; }
  // 2) أفضل نموذج مثبّت حسب الكتالوج وملاءمته للجهاز
  const scored = usable.filter(ok).map((m) => {
    const c = catalog.find(m.name, cat);
    let score = c?.rank?.[role] ?? (role === 'chat' ? c?.rank?.chat ?? 10 : 0);
    if (!c && role === 'code' && /coder|code/i.test(m.name)) score = 45;
    if (!c && role === 'vision' && hasCap(m, 'vision')) score = 30;
    if (c && hw) { const f = catalog.fit(c, hw); if (f === 'tight') score -= 30; if (f === 'too_big') score -= 60; if (f === 'slow') score -= 15; }
    return { m, score };
  }).sort((a, b) => b.score - a.score);
  if (scored.length && scored[0].score > 0) return { model: scored[0].m.name, why: 'best_installed' };
  // 3) احتياط: نموذج المحادثة العام
  if (needVision) return { model: null, why: 'no_vision_model' };
  const general = byName(settings.modelsByRole?.chat) || byName(settings.model) || usable[0];
  return general ? { model: general.name, why: 'fallback' } : { model: null, why: 'no_model' };
}

module.exports = { detectIntent, pickModel, isChatModel };
