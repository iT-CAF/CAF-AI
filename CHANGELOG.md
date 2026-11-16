# سجل التغييرات · Changelog

## 1.2.1 — 2026-11-16

الوصول إلى كآف AI من الجوال وأي جهاز على نفس شبكة Wi-Fi.
Access CAF AI from your phone and any device on the same Wi-Fi.

### جديد · Added
- **الوصول من الجوال (صفحة «الوصول»):** افتح كآف AI من أي جهاز على نفس شبكة Wi-Fi. مفتاح تشغيل/إيقاف، عنوان الشبكة (مثل `http://192.168.1.5:3737`) مع رمز QR يُولَّد محليًا، اقتران فوري بمسح الرمز أو بطلب وصول توافق عليه من بطاقة تظهر على الكمبيوتر، قائمة الأجهزة المقترنة مع حالة الاتصال وإعادة التسمية والإزالة، ومزامنة المحادثات بين الأجهزة تلقائيًا.
  Access from your phone (the “Access” page): an on/off switch, the network address with a locally generated QR code, instant pairing by scanning or by an access request you approve on the computer, a paired-devices list with online status, rename and remove, and automatic chat sync between devices.
- **الأمان:** مطفأ افتراضيًا؛ يستمع على العناوين الخاصة فقط (10.x · 172.16–31.x · 192.168.x · 100.64/10) ويُغلق فورًا عند الإيقاف؛ رمز QR لمرة واحدة ويتجدد كل 5 دقائق؛ Cookie للجهاز `HttpOnly; SameSite=Strict` ونحفظ بصمته فقط؛ الإزالة فورية؛ فحص Host/Origin على مستمع الشبكة؛ إيقاف كآف AI وإدارة الوصول من الكمبيوتر فقط؛ و‎/v1‎ يبقى للكمبيوتر نفسه.
  Security: off by default; private addresses only and closed immediately when off; one-time QR codes renewed every 5 minutes; an HttpOnly SameSite=Strict device cookie with only its hash stored; instant removal; Host/Origin checks on the network listener; quitting and access management stay on the computer; /v1 stays local.
- النسخ يعمل على الجوال عبر الشبكة (بديل للحافظة خارج HTTPS)، ورسالة واضحة إن جُرّب الإدخال الصوتي عبر الشبكة.
  Copy works on the phone over the network (a clipboard fallback outside HTTPS), with a clear message for voice input over the network.

## 1.2.0 — 2026-11-11

إصدار كبير يحوّل كآف AI من دردشة محلية إلى مساعد شامل متعدد القدرات، مع الحفاظ على كل شيء محليًا وبلا إنترنت.
A major release that turns CAF AI from a local chat into a multi-capability assistant — still fully local and offline.

### جديد · Added
- **البنية:** طبقة مزوّدين (محادثة، رؤية، توليد صور، تضمين، تحويل الكلام، النطق، تشغيل الكود)، وتقسيم الخادم إلى وحدات، وترحيل البيانات تلقائيًا إلى الإصدار 2 مع نسخة احتياطية. انظر [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
  Architecture: a providers layer, a modular server, and automatic data migration to v2 with a backup.
- **جهازي والكتالوج:** قياس الذاكرة والمعالج الرسومي والقرص، وكتالوج نماذج قابل للتحديث بعلامات الملاءمة والرخص، ونماذج MoE.
  My device & catalog: hardware profile, an updatable model catalog with fit badges, licenses and MoE models.
- **الموجّه التلقائي «تلقائي»** يختار النموذج المثبّت الأنسب لكل طلب (محادثة/برمجة/رؤية/صور)، مع تحكم بالتفكير.
  The “Auto” router picks the best installed model per request, with thinking control.
- **قفل اللغة:** العربية تُجاب بالعربية فقط؛ أي خلط بلغات أخرى يُعاد توليده تلقائيًا.
  Language lock: Arabic in, Arabic out; mixed-language output is regenerated automatically.
- **البرمجة:** لوحة جانبية (CodeMirror 6) تُكتب فيها الملفات حيًا من المحادثة أو مساحة «كود»، بطاقات ملفات، تبويبات لملفات الرد، معاينة HTML معزولة بأحجام الأجهزة، تشغيل JavaScript وPython (Pyodide) في صندوق معزول، النسخ والفروق، «اطلب تعديلًا»، وإرفاق ملفات أو مجلد مشروع.
  Coding: a live side canvas, file cards, multi-file tabs, sandboxed HTML preview, sandboxed JS/Python runs, versions & diffs, ask-for-edit, project folders.
- **الرؤية:** إرفاق الصور ولصقها وسحبها مع ضغطها وحفظها مع المحادثة، وأوامر سريعة.
  Vision: attach, paste or drop images, compressed and saved with the chat.
- **توليد الصور** عبر stable-diffusion.cpp (Metal/Vulkan/CPU) مع FLUX.2 klein وZ-Image، تحسين الوصف، المعرض، و«ارسم لي…» من المحادثة.
  Image generation via stable-diffusion.cpp with FLUX.2 klein and Z-Image, prompt enhancement, gallery, and “draw me…” in chat.
- **المستندات:** PDF/DOCX/TXT/MD/CSV/XLSX، بحث هجين محلي مع المصادر، مكتبة معرفة، OCR للممسوح، وتعديل Excel وWord بنتيجة ملف جديد.
  Documents: extraction, local hybrid RAG with sources, a knowledge library, OCR, and Excel/Word editing that returns a new file.
- **المهارات:** 28 مهارة (13 عربية من كآف + 15 مجتمعية)، اختيار تلقائي، منتقٍ وقائمة «/»، استيراد مجموعات (مثل Agency Agents)، ونافذة عرض وتعديل وإنشاء.
  Skills: 28 bundled skills, auto-selection, picker and “/” menu, collection import, and a view/edit/create dialog.
- **الصوت (اختياري):** whisper.cpp أو نموذج صوتي في Ollama للتفريغ، وPiper أو أصوات النظام المحلية للنطق.
  Voice (optional): local speech-to-text and text-to-speech.
- **التصدير والنسخ الاحتياطي:** Markdown/HTML/PDF، ونسخة كاملة تُستعاد مع نسخة أمان.
  Export & backup: Markdown/HTML/PDF and a full backup with safe restore.
- **واجهة برمجية محلية متوافقة مع OpenAI** (‎/v1‎) بمفتاح محلي — [docs/API.md](docs/API.md).
  A local OpenAI-compatible API with a local key.
- **التحديث من داخل التطبيق** من إصدارات GitHub مع التحقق من البصمة ونسخة من الإصدار السابق.
  In-app updates from GitHub releases, hash-verified, keeping the previous version.
- **صفحة التعليمات** بصور متحركة حقيقية، وKaTeX وMermaid، واختصارات لوحة المفاتيح، وحركة الهوية البصرية.
  A help page with real animated captures, KaTeX & Mermaid, keyboard shortcuts and brand motion.

### تحسينات · Improved
- بث بلا ارتجاف (تحديث في المكان)، واتجاه نص صحيح لكل فقرة، وتفكير مطوي بشريط «يفكّر…».
  Flicker-free streaming, per-block text direction, and a collapsed “Thinking…” pill.
- إعدادات بتصميم جديد، وأيقونات حقيقية، وروابط it-caf.com وGitHub في التطبيق والطرفية.
  A redesigned settings dialog, real icons, and it-caf.com / GitHub links across the app and CLI.

### الأمان · Security
- رمز جلسة لكل تشغيل، وفحص Host وOrigin، وسياسات CSP مخصصة لكل مسار، وصندوق معزول بلا شبكة لتشغيل الكود والمعاينة. لا يُنفَّذ أي شيء من مخرجات النموذج على النظام.
  Per-run session token, Host/Origin checks, per-route CSP, and a network-less sandbox for code and previews.
- التنزيلات قابلة للاستئناف ويُتحقق من حجمها وبصمتها؛ لا نماذج داخل المستودع.
  Resumable, size- and hash-verified downloads; no models in the repository.
- التحديث يستبدل ملفات البرنامج فقط ويُبقي أي بيانات داخل مجلده.
  Updates replace program files only and keep any user data inside the app folder.

### الاختبارات · Tests
- 42 اختبارًا آليًا على Ollama وهمي، وخطة اختبار يدوي في [docs/TESTING.md](docs/TESTING.md).
  42 automated tests against a mock Ollama, plus a manual test plan.

## 1.0.x — 2026-10-27 → 2026-11-10
- قائمة `startcaf` تفاعلية بالأرقام وتشغيل في الخلفية، والمثبّت يفتحها مباشرة.
- إصلاح عدم تحميل النماذج: دعم manifests-v2 وإعادة تشغيل المحرك تلقائيًا.

## 1.0.0 — 2026-10-27
- الإصدار الأول: دردشة محلية عربية أولًا عبر Ollama، الأمر `startcaf`، وضع ليلي ونهاري.
  First release: Arabic-first local chat via Ollama, the `startcaf` command, dark & light themes.

---
كآف AI · برمجة وتصميم كآف · [it-caf.com](https://it-caf.com) · [github.com/iT-CAF/CAF-AI](https://github.com/iT-CAF/CAF-AI)
