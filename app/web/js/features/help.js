/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// «التعليمات»: دليل شامل للمنصة بصور متحركة حقيقية مسجّلة من الواجهة، مع بحث وفهرس وأزرار «جرّبها الآن».
import { state, $, t, esc, ic, lang, pages, emit } from '../core.js';

window.I18N_ADD({
  ar: { help: 'التعليمات', helpSub: 'كل ما تحتاجه لاستخدام كآف AI باحتراف — بالصور المتحركة من المنصة نفسها.', helpSearch: 'ابحث في التعليمات…', helpToc: 'المحتويات', helpTry: 'جرّبها الآن', helpNoResults: 'لا نتائج — جرّب كلمة أخرى.', helpZoom: 'تكبير', helpQuick: 'البدء في 3 خطوات' },
  en: { help: 'Help', helpSub: 'Everything you need to use CAF AI like a pro — with animated captures from the app itself.', helpSearch: 'Search the guide…', helpToc: 'Contents', helpTry: 'Try it now', helpNoResults: 'No results — try another word.', helpZoom: 'Zoom', helpQuick: 'Get started in 3 steps' },
});

// المحتوى: { id, icon, title, intro, steps[], tips[], gif, try: {label, goto|ws|settings} }
const AR = {
  quick: [
    ['device', 'اعرف جهازك', 'صفحة «جهازي» تقيس الذاكرة والمعالج الرسومي وتقترح النماذج المناسبة لجهازك.'],
    ['download', 'نزّل نموذجًا', 'من «الأدوات المثبّتة» اختر نموذجًا مقترحًا (علامة «مناسب») — يُحفظ على جهازك ويعمل بلا إنترنت.'],
    ['chat', 'ابدأ المحادثة', 'اكتب بالعربية أو الإنجليزية. «تلقائي» يختار النموذج الأنسب لكل طلب: محادثة، برمجة، أو صور.'],
  ],
  sections: [
    { id: 'chat', icon: 'chat', title: 'المحادثة', gif: 'chat', intro: 'اكتب سؤالك واضغط Enter. يرد كآف AI بلغتك دائمًا — إذا كتبت بالعربية يرد بالعربية فقط.',
      steps: ['اختر «تلقائي» من قائمة النموذج (أعلى الصفحة) ليختار كآف AI النموذج الأنسب لكل طلب، أو ثبّت نموذجًا بعينه.', 'استخدم Shift+Enter لسطر جديد، و⌘K (أو Ctrl+K) لمحادثة جديدة.', 'النماذج التي «تفكر» تعرض شريط «يفكّر…»؛ اضغطه لرؤية خطوات التفكير، وتحكّم بالتفكير من زر «تفكير».', 'تحت كل رد: نسخ، وإعادة التوليد، والاستماع (إن فعّلت الصوت).'],
      tips: ['كل محادثاتك محفوظة على جهازك فقط، وتبحث فيها من الشريط الجانبي.', 'إذا خلط النموذج لغات أخرى يعيد كآف AI التوليد تلقائيًا بتعليمات أشد.'] },
    { id: 'code', icon: 'code', title: 'البرمجة واللوحة الجانبية', gif: 'code', try: { ws: 'code' }, intro: 'اطلب أي برنامج من مساحة «كود» أو من المحادثة مباشرة («اكتب لي صفحة…»، «سوّ لي آلة حاسبة…») — يُكتب كل ملف حيًا في اللوحة الجانبية.',
      steps: ['كل ملف يظهر في المحادثة كبطاقة: الاسم واللغة وعدد الأسطر، مع «المعاينة» أو «تشغيل» أو «افتح في اللوحة».', 'صفحات HTML تُعرض فورًا في معاينة معزولة بأحجام سطح المكتب والتابلت والجوال، مع Console للأخطاء.', 'JavaScript وPython تعمل داخل المتصفح في بيئة معزولة بلا إنترنت ولا وصول لملفاتك. Python يحتاج تنزيل Pyodide مرة واحدة.', 'ردّ فيه عدة ملفات؟ تظهر كتبويبات داخل اللوحة، وتُضمَّن CSS وJS تلقائيًا في معاينة الصفحة.', 'حدّد جزءًا من الكود واكتب في «اطلب تعديلًا» — يعدّله النموذج وتراجع الفروق، مع سجل نسخ كامل.', 'أرفق ملفات كود أو مجلد مشروع كامل من زر المرفقات، واستخدم الأوامر السريعة: اشرح، اكتشف الأخطاء، اكتب اختبارات…'],
      tips: ['لا يُنفَّذ أي كود على نظامك إطلاقًا — كل التشغيل داخل صندوق معزول.', 'نموذج qwen2.5-coder هو الأفضل للبرمجة وتعديل الملفات على أغلب الأجهزة.'] },
    { id: 'vision', icon: 'eye', title: 'فهم الصور', gif: 'vision', intro: 'أرفق صورة (زر المرفقات، أو اسحبها، أو ألصقها بـ ⌘V) واسأل عنها: وصف، قراءة نص، شرح مخطط، تحويل تصميم إلى كود.',
      steps: ['يتحول كآف AI تلقائيًا إلى نموذج يرى الصور (مثل qwen3-vl).', 'الأوامر السريعة تحت الصورة: «صف»، «استخرج النص»، «حوّل إلى كود»…', 'الصور تُضغط قبل الإرسال وتُحفظ مع المحادثة.'],
      tips: ['الأمر /describe يصف آخر صورة أرفقتها.', 'ملفات PDF الممسوحة ضوئيًا تُقرأ بالطريقة نفسها (OCR).'] },
    { id: 'images', icon: 'image', title: 'توليد الصور', img: 'images.png', try: { ws: 'images' }, intro: 'من مساحة «صور» اكتب وصفًا بالعربية، أو قل في المحادثة «ارسم لي…». يحسّن كآف AI الوصف ويولّد الصورة على جهازك.',
      steps: ['أول مرة: ثبّت محرك الصور ونموذجًا (FLUX.2 klein أو Z-Image) من الصفحة نفسها.', 'اختر الحجم (مربع، طولي، عرضي) والجودة وعدد الصور، ويظهر الوقت المتوقع قبل البدء.', 'من المعرض: تنزيل، نسخ، «البذرة نفسها» لنسخ مشابهة، أو «إلى الرؤية» لتسأل عن الصورة.'],
      tips: ['بدون معالج رسوميات يعمل التوليد على المعالج لكنه أبطأ بكثير — يحذرك كآف AI ويصغّر الحجم تلقائيًا.'] },
    { id: 'docs', icon: 'file', title: 'المستندات والملفات', img: 'docs.png', try: { ws: 'docs' }, intro: 'أرفق PDF أو Word أو Excel أو CSV أو نصًا واسأل عنه — مع ذكر المصدر لكل معلومة. وقل «عدّل عليه» لتستلم الملف معدّلًا.',
      steps: ['الملف الصغير يُقرأ كاملًا، والكبير يُفهرس محليًا (بحث دلالي) ويُستشهد بأجزائه [1] [2].', 'تعديل Excel وWord: «أضف عمود الإجمالي»، «لوّن الصفوف»، «صحّح الأخطاء الإملائية» ← ملف جديد جاهز للتنزيل مع معاينة.', 'مكتبة المعرفة (مساحة «مستندات»): اجمع ملفاتك في مجموعات واسأل عنها في أي محادثة.'],
      tips: ['الملف الأصلي لا يُمسّ أبدًا؛ النتيجة دائمًا نسخة جديدة.', 'التعديل يتم ببرنامج Python داخل المتصفح (openpyxl و python-docx) — بلا إنترنت.'] },
    { id: 'skills', icon: 'sparkle', title: 'المهارات وقائمة «/»', gif: 'skills', try: { goto: 'skills' }, intro: 'المهارات تحوّل النموذج إلى خبير: كاتب، مترجم، مراجع كود، محلل بيانات… تُفعَّل تلقائيًا حسب طلبك أو تختارها بنفسك.',
      steps: ['اكتب «/» في صندوق الكتابة لتظهر الأوامر والمهارات، وابحث بالعربية أو الإنجليزية.', 'زر ✦ بجانب المرفقات يفتح منتقي المهارات، والاختصارات تحت صندوق الكتابة.', 'صفحة «المهارات»: عرض كل مهارة، تعديلها (حتى المدمجة — تُحفظ نسخة ويمكن استعادة الأصل)، أو إنشاء مهارة جديدة.', 'استورد مجلد مهارات أو وكلاء (مثل Agency Agents) بلصق مساره، أو ارفع ملف SKILL.md.'],
      tips: ['أعطِ مهارتك «أمرًا مختصرًا» مثل /contract لتستدعيها مباشرة.', 'المهارات تتبع معيار Agent Skills المفتوح.'] },
    { id: 'voice', icon: 'mic', title: 'الصوت', try: { settings: 'voice' }, intro: 'فعّل الصوت من الإعدادات ← الصوت: تحدّث بدل الكتابة، واستمع للردود — محليًا بالكامل.',
      steps: ['زر الميكروفون في صندوق الكتابة: اضغطه وتحدّث ثم اضغطه مرة أخرى.', 'التفريغ بنموذج صوتي في Ollama (مثل gemma4) أو whisper.cpp.', 'زر «استمع» تحت الرد يقرأه بصوت النظام المحلي (مثل «ماجد» على ماك) أو Piper.'],
      tips: ['لا يُرسل أي صوت خارج جهازك.'] },
    { id: 'export', icon: 'filedown', title: 'التصدير والنسخ الاحتياطي', try: { settings: 'data' }, intro: 'صدّر أي محادثة من زر التصدير أعلى الصفحة، واحفظ نسخة احتياطية كاملة من الإعدادات ← البيانات.',
      steps: ['Markdown (مع الصور في ملف zip)، أو صفحة HTML مستقلة، أو PDF عبر نافذة الطباعة.', 'النسخة الاحتياطية تضم المحادثات والمرفقات والصور والمعرفة والإعدادات والمهارات — بدون النماذج.', 'عند الاستعادة تُنقل بياناتك الحالية أولًا إلى نسخة أمان، فلا يضيع شيء.'],
      tips: ['يمكنك نقل كآف AI كاملًا على فلاشة USB عبر متغير CAF_HOME.'] },
    { id: 'api', icon: 'terminal', title: 'الواجهة البرمجية المحلية', try: { settings: 'api' }, intro: 'اربط تطبيقاتك بكآف AI عبر واجهة متوافقة مع OpenAI على ‎127.0.0.1‎ — مفيدة لسكربتات PHP وJavaScript وPython.',
      steps: ['فعّلها من الإعدادات ← الواجهة البرمجية المحلية وانسخ المفتاح.', 'العنوان: ‎http://127.0.0.1:3737/v1‎ واستخدم model: "auto".', 'الدليل الكامل بأمثلة جاهزة في docs/API.md على GitHub.'],
      tips: ['معطّلة افتراضيًا، وتتطلب المفتاح، وترفض طلبات المواقع الأخرى.'] },
    { id: 'device', icon: 'device', title: 'جهازي والأدوات والتحديثات', try: { goto: 'hardware' }, intro: 'اعرف ما يناسب جهازك، ونزّل النماذج والمحركات، وحدّث كآف AI بنقرة.',
      steps: ['«جهازي»: الذاكرة المتاحة، المعالج الرسومي (Metal / CUDA / بدون)، وسرعة القرص.', '«الأدوات المثبّتة»: كل نموذج مع علامة ملاءمة (مناسب، بطيء، ضيّق، أكبر من جهازك) ورخصته.', 'الإعدادات ← التحديثات: تحقّق من GitHub وحدّث مباشرة — مع نسخة احتياطية من الإصدار السابق.'],
      tips: ['التنزيلات تُستأنف إذا انقطعت، ويُتحقق من حجمها وبصمتها.'] },
    { id: 'keys', icon: 'keyboard', title: 'اختصارات لوحة المفاتيح', intro: 'أسرع طريقة للعمل:',
      keys: [['Enter', 'إرسال'], ['Shift + Enter', 'سطر جديد'], ['⌘/Ctrl + K', 'محادثة جديدة'], ['⌘/Ctrl + ,', 'الإعدادات'], ['/', 'الأوامر والمهارات'], ['⌘/Ctrl + S', 'حفظ نسخة في اللوحة / حفظ المهارة'], ['⌘/Ctrl + V', 'لصق صورة'], ['Esc', 'إغلاق القوائم والنوافذ'], ['?', 'فتح التعليمات']] },
    { id: 'privacy', icon: 'shield', title: 'الخصوصية والأمان', intro: 'كآف AI يعمل على جهازك بالكامل: بلا حسابات، بلا تتبع، بلا سحابة.',
      steps: ['الخادم المحلي يستمع على 127.0.0.1 فقط، ومحمي برمز جلسة ويرفض طلبات المواقع الأخرى.', 'لا يُنفَّذ أي أمر نظام من مخرجات النموذج؛ كل تشغيل للكود داخل صندوق معزول بلا شبكة.', 'الإنترنت يُستخدم فقط عند تنزيل نموذج أو محرك، أو عند التحقق من التحديثات بطلبك.'] },
    { id: 'faq', icon: 'lifebuoy', title: 'حل المشكلات', faq: [
      ['الرد بطيء جدًا', 'اختر نموذجًا أصغر (مثل qwen3.5:4b) من «الأدوات المثبّتة»، أو قلّل حجم السياق من الإعدادات ← السلوك. علامة «بطيء» تعني أن النموذج يعمل على المعالج.'],
      ['الرد يخلط لغات', 'خفّض «الإبداع» (temperature) إلى 0.7 أو أقل من الإعدادات ← السلوك. كآف AI يعيد التوليد تلقائيًا عند الخلط.'],
      ['لا يظهر زر التشغيل للكود', 'التشغيل متاح لـ JavaScript وPython وHTML. اللغات الأخرى تُنسخ أو تُنزّل لتشغيلها في بيئتك.'],
      ['المعاينة بلا تنسيق', 'الصفحة تطلب ملفات من الإنترنت (CDN)، والمعاينة معزولة بلا شبكة. اطلب «نسخة مضمّنة بالكامل».'],
      ['فشل التحديث', 'إن كنت شغّلت كآف AI من نسخة git فحدّث بـ git pull. وإلا نزّل أحدث إصدار من صفحة GitHub.'],
    ] },
  ],
};
const EN = {
  quick: [
    ['device', 'Know your device', 'The “My device” page measures memory and GPU and suggests models that fit.'],
    ['download', 'Download a model', 'From “Installed tools” pick a recommended model (“fits” badge) — stored on your device, works offline.'],
    ['chat', 'Start chatting', 'Write in Arabic or English. “Auto” picks the best model per request: chat, code or images.'],
  ],
  sections: [
    { id: 'chat', icon: 'chat', title: 'Chat', gif: 'chat', intro: 'Type and press Enter. CAF AI always answers in your language — Arabic in, Arabic out.',
      steps: ['Pick “Auto” in the model menu to route each request to the best installed model, or pin one.', 'Shift+Enter for a new line, ⌘K (Ctrl+K) for a new chat.', 'Thinking models show a “Thinking…” pill; click it to see the reasoning. Control it with the Think button.', 'Under every reply: copy, regenerate, and listen (when voice is on).'],
      tips: ['All chats are stored on your device only; search them from the sidebar.', 'If a model mixes languages, CAF AI regenerates automatically with stricter instructions.'] },
    { id: 'code', icon: 'code', title: 'Coding & the side canvas', gif: 'code', try: { ws: 'code' }, intro: 'Ask for any program from the Code workspace or straight from chat (“build me a page…”, “make a calculator…”) — every file is written live in the side canvas.',
      steps: ['Each file appears in chat as a card — name, language, lines — with Preview, Run or Open in canvas.', 'HTML renders instantly in a sandboxed preview with desktop, tablet and phone sizes, plus a console.', 'JavaScript and Python run in the browser, sandboxed, with no network and no access to your files. Python downloads Pyodide once.', 'Multi-file answers become tabs in the canvas, and CSS/JS are bundled into the page preview automatically.', 'Select code and type in “Ask for an edit” — review the diff, with full version history.', 'Attach code files or a whole project folder, and use quick actions: explain, find bugs, write tests…'],
      tips: ['No code ever runs on your system — everything executes in an isolated sandbox.', 'qwen2.5-coder is the best coding and file-editing model on most devices.'] },
    { id: 'vision', icon: 'eye', title: 'Understanding images', gif: 'vision', intro: 'Attach an image (attach button, drag it, or paste with ⌘V) and ask: describe, read text, explain a chart, turn a design into code.',
      steps: ['CAF AI switches to a vision model automatically (e.g. qwen3-vl).', 'Quick commands under the image: Describe, Extract text, To code…', 'Images are compressed before sending and saved with the chat.'],
      tips: ['/describe describes the last attached image.', 'Scanned PDFs are read the same way (OCR).'] },
    { id: 'images', icon: 'image', title: 'Image generation', img: 'images.png', try: { ws: 'images' }, intro: 'In the Images workspace describe what you want (Arabic is fine), or say “draw me…” in chat. CAF AI enhances the prompt and generates on your device.',
      steps: ['First time: install the image engine and a model (FLUX.2 klein or Z-Image) from the same page.', 'Pick size, quality and count — the estimated time shows before you start.', 'From the gallery: download, copy, “same seed” for variations, or “to vision” to ask about it.'],
      tips: ['Without a GPU it runs on the CPU, much slower — CAF AI warns you and shrinks the size automatically.'] },
    { id: 'docs', icon: 'file', title: 'Documents & files', img: 'docs.png', try: { ws: 'docs' }, intro: 'Attach PDF, Word, Excel, CSV or text and ask about it — with a source for every fact. Say “edit it” to get the edited file back.',
      steps: ['Small files are read whole; large ones are indexed locally (semantic search) and cited [1] [2].', 'Editing Excel and Word: “add a total column”, “color the rows”, “fix spelling” → a new file to download, with a preview.', 'The knowledge library (Documents workspace): group files into collections and ask about them in any chat.'],
      tips: ['The original file is never touched; the result is always a new copy.', 'Edits run as Python in the browser (openpyxl, python-docx) — offline.'] },
    { id: 'skills', icon: 'sparkle', title: 'Skills & the “/” menu', gif: 'skills', try: { goto: 'skills' }, intro: 'Skills turn the model into an expert: writer, translator, code reviewer, data analyst… activated automatically or picked by you.',
      steps: ['Type “/” in the composer for commands and skills; search in Arabic or English.', 'The ✦ button next to attachments opens the skill picker; shortcuts sit under the composer.', 'The Skills page: view any skill, edit it (even built-ins — saved as a copy you can reset), or create a new one.', 'Import a folder of skills or agents (e.g. Agency Agents) by pasting its path, or upload a SKILL.md.'],
      tips: ['Give your skill a shortcut command like /contract to call it directly.', 'Skills follow the open Agent Skills standard.'] },
    { id: 'voice', icon: 'mic', title: 'Voice', try: { settings: 'voice' }, intro: 'Turn on voice in Settings → Voice: speak instead of typing and listen to replies — fully local.',
      steps: ['The mic button in the composer: press, speak, press again.', 'Transcription uses an audio model in Ollama (e.g. gemma4) or whisper.cpp.', '“Listen” under a reply reads it with the local system voice (e.g. Majed on macOS) or Piper.'],
      tips: ['No audio ever leaves your device.'] },
    { id: 'export', icon: 'filedown', title: 'Export & backup', try: { settings: 'data' }, intro: 'Export any chat from the export button at the top, and keep a full backup from Settings → Data.',
      steps: ['Markdown (zipped with images), a standalone HTML page, or PDF via the print dialog.', 'The backup holds chats, attachments, images, knowledge, settings and skills — not models.', 'Restoring first moves your current data to a safety copy, so nothing is lost.'],
      tips: ['Carry CAF AI on a USB drive with the CAF_HOME variable.'] },
    { id: 'api', icon: 'terminal', title: 'Local API', try: { settings: 'api' }, intro: 'Connect your apps through an OpenAI-compatible API on 127.0.0.1 — handy for PHP, JavaScript and Python scripts.',
      steps: ['Enable it in Settings → Local API and copy the key.', 'Base URL: http://127.0.0.1:3737/v1, and use model: "auto".', 'The full guide with ready examples is docs/API.md on GitHub.'],
      tips: ['Off by default, key required, requests from other websites rejected.'] },
    { id: 'device', icon: 'device', title: 'My device, tools & updates', try: { goto: 'hardware' }, intro: 'See what fits your device, download models and engines, and update CAF AI in one click.',
      steps: ['“My device”: available memory, GPU (Metal / CUDA / none) and disk speed.', '“Installed tools”: every model with a fit badge (fits, slow, tight, too big) and its license.', 'Settings → Updates: check GitHub and update directly — with a backup of the previous version.'],
      tips: ['Downloads resume after interruptions and are verified by size and hash.'] },
    { id: 'keys', icon: 'keyboard', title: 'Keyboard shortcuts', intro: 'The fastest way to work:',
      keys: [['Enter', 'Send'], ['Shift + Enter', 'New line'], ['⌘/Ctrl + K', 'New chat'], ['⌘/Ctrl + ,', 'Settings'], ['/', 'Commands & skills'], ['⌘/Ctrl + S', 'Save a canvas version / save a skill'], ['⌘/Ctrl + V', 'Paste an image'], ['Esc', 'Close menus and dialogs'], ['?', 'Open help']] },
    { id: 'privacy', icon: 'shield', title: 'Privacy & security', intro: 'CAF AI runs entirely on your device: no accounts, no tracking, no cloud.',
      steps: ['The local server listens on 127.0.0.1 only, uses a session token and rejects requests from other websites.', 'No system command is ever run from model output; all code runs in an isolated, network-less sandbox.', 'The internet is used only to download a model or engine, or to check for updates when you ask.'] },
    { id: 'faq', icon: 'lifebuoy', title: 'Troubleshooting', faq: [
      ['Replies are very slow', 'Pick a smaller model (e.g. qwen3.5:4b) in Installed tools, or lower the context size in Settings → Behavior. A “slow” badge means the model runs on the CPU.'],
      ['Replies mix languages', 'Lower the temperature to 0.7 or less in Settings → Behavior. CAF AI also regenerates automatically when it detects mixing.'],
      ['No Run button on code', 'Running is available for JavaScript, Python and HTML. Other languages can be copied or downloaded to run in your own environment.'],
      ['The preview looks unstyled', 'The page loads files from the internet (CDN) and the preview has no network. Ask for a fully self-contained version.'],
      ['The update failed', 'If you run CAF AI from a git clone, update with git pull. Otherwise download the latest release from GitHub.'],
    ] },
  ],
};

let query = '';
const content = () => (lang() === 'en' ? EN : AR);
function tryBtn(s) {
  if (!s.try) return '';
  const a = s.try.ws ? `data-help-ws="${s.try.ws}"` : s.try.goto ? `data-goto="${s.try.goto}"` : `data-help-set="${s.try.settings}"`;
  return `<button type="button" class="btn small" ${a}>${ic('rocket')}<span>${esc(t('helpTry'))}</span></button>`;
}
function sectionHtml(s) {
  const src = s.gif ? `/help/${s.gif}.gif` : s.img ? `/help/${s.img}` : '';
  const gif = src ? `<figure class="help-gif"><button type="button" class="gif-frame" data-zoom="${src}" aria-label="${esc(t('helpZoom'))}: ${esc(s.title)}"><span class="gif-bar"><i></i><i></i><i></i></span><img src="${src}" alt="${esc(s.title)}" loading="lazy" decoding="async"></button></figure>` : '';
  const steps = s.steps ? `<ol class="help-steps">${s.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
  const tips = s.tips ? `<ul class="help-tips">${s.tips.map((x) => `<li>${ic('bulb')}<span>${esc(x)}</span></li>`).join('')}</ul>` : '';
  const keys = s.keys ? `<div class="help-keys">${s.keys.map(([k, v]) => `<div><kbd dir="ltr">${esc(k)}</kbd><span>${esc(v)}</span></div>`).join('')}</div>` : '';
  const faq = s.faq ? s.faq.map(([q, a]) => `<details class="help-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('') : '';
  return `<article class="help-sec${gif ? ' has-gif' : ''}" id="help-${s.id}" data-text="${esc([s.title, s.intro, ...(s.steps || []), ...(s.tips || []), ...(s.faq || []).flat(), ...(s.keys || []).flat()].join(' ').toLowerCase())}">
    <header><span class="help-ic">${ic(s.icon)}</span><h2>${esc(s.title)}</h2><span class="spacer"></span>${tryBtn(s)}</header>
    <div class="help-body"><div class="help-text"><p class="help-intro">${esc(s.intro || '')}</p>${steps}${tips}${keys}${faq}</div>${gif}</div></article>`;
}
function render() {
  const v = $('viewHelp'); const c = content();
  const y = state.info?.year || new Date().getFullYear(); const ver = state.info?.version || '';
  v.innerHTML = `<div class="page help-page">
    <header class="page-head"><div><h1>${esc(t('help'))}</h1><p class="lead">${esc(t('helpSub'))}</p></div>
      <label class="search help-search">${ic('search')}<input type="search" id="helpQ" placeholder="${esc(t('helpSearch'))}" value="${esc(query)}" aria-label="${esc(t('helpSearch'))}"></label></header>
    <section class="help-quick" aria-label="${esc(t('helpQuick'))}"><h2 class="sec-title">${esc(t('helpQuick'))}</h2><div class="hq-grid">${c.quick.map(([i, a, b], n) => `<div class="hq"><span class="hq-n">${n + 1}</span>${ic(i)}<b>${esc(a)}</b><p>${esc(b)}</p></div>`).join('')}</div></section>
    <div class="help-layout">
      <nav class="help-toc" aria-label="${esc(t('helpToc'))}"><b>${esc(t('helpToc'))}</b>${c.sections.map((s) => `<a href="#help-${s.id}" data-toc="${s.id}">${ic(s.icon)}<span>${esc(s.title)}</span></a>`).join('')}</nav>
      <div class="help-main">${c.sections.map(sectionHtml).join('')}<p class="muted help-none" hidden>${esc(t('helpNoResults'))}</p></div>
    </div>
    <footer class="help-foot">
      <a class="promo-card" href="https://it-caf.com/" target="_blank" rel="noopener noreferrer">${ic('globe')}<span><b>${esc(t('promoSiteTitle'))}</b><small>${esc(t('promoSiteSub'))}</small></span><span class="url" dir="ltr">it-caf.com</span></a>
      <a class="promo-card" href="https://github.com/iT-CAF/CAF-AI" target="_blank" rel="noopener noreferrer">${ic('github')}<span><b>${esc(t('promoRepoTitle'))}</b><small>${esc(t('promoRepoSub'))}</small></span><span class="url" dir="ltr">github.com/iT-CAF/CAF-AI</span></a>
      <p class="rights">${esc(t('rightsShort').replace('{y}', y))} · v${esc(ver)}</p>
    </footer></div>`;
  const filter = () => {
    const q = query.trim().toLowerCase(); let n = 0;
    v.querySelectorAll('.help-sec').forEach((a) => { const show = !q || a.dataset.text.includes(q); a.hidden = !show; if (show) n++; v.querySelector(`[data-toc="${a.id.slice(5)}"]`).hidden = !show; });
    v.querySelector('.help-none').hidden = n > 0;
  };
  filter();
  $('helpQ').oninput = (e) => { query = e.target.value; filter(); };
  v.querySelector('.help-toc').onclick = (e) => { const a = e.target.closest('[data-toc]'); if (!a) return; e.preventDefault(); $('help-' + a.dataset.toc)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  v.querySelector('.help-main').onclick = async (e) => {
    const z = e.target.closest('[data-zoom]'); if (z) return zoom(z.dataset.zoom, z.querySelector('img').alt);
    const w = e.target.closest('[data-help-ws]'); if (w) return emit('workspace:set', w.dataset.helpWs);
    const s = e.target.closest('[data-help-set]'); if (s) { const { openSettings } = await import('../settings.js'); openSettings(s.dataset.helpSet); }
  };
  // تمييز القسم الظاهر في الفهرس
  const io = new IntersectionObserver((ents) => { for (const en of ents) if (en.isIntersecting) { v.querySelectorAll('[data-toc]').forEach((a) => a.classList.toggle('on', a.dataset.toc === en.target.id.slice(5))); } }, { root: v, rootMargin: '-20% 0px -70% 0px' });
  v.querySelectorAll('.help-sec').forEach((a) => io.observe(a));
}
function zoom(src, alt) {
  const d = document.createElement('dialog'); d.className = 'img-viewer help-zoom';
  d.innerHTML = `<form method="dialog"><button class="btn icon-only" aria-label="${esc(t('close'))}">${ic('close')}</button></form><img src="${esc(src)}" alt="${esc(alt)}">`;
  document.body.appendChild(d); d.addEventListener('close', () => d.remove()); d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.showModal();
}

export function init() {
  const view = document.createElement('section'); view.className = 'view'; view.dataset.view = 'help'; view.id = 'viewHelp'; view.hidden = true;
  document.querySelector('.views').appendChild(view);
  pages.help = render;
  const btn = document.createElement('button'); btn.className = 'btn ghost block'; btn.dataset.goto = 'help';
  btn.innerHTML = `${ic('help')}<span data-i18n="help">${esc(t('help'))}</span>`;
  (document.querySelector('.side-foot [data-goto="skills"]') || document.querySelector('.side-foot [data-goto="tools"]')).before(btn);
  // «?» يفتح التعليمات (خارج حقول الكتابة)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement; if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    e.preventDefault(); emit('view:set', 'help');
  });
}
