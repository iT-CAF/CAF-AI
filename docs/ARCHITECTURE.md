# بنية كآف AI · CAF AI Architecture

> هذا المستند للمطوّرين. يشرح البنية كما كانت في الإصدار 1.0.0، ثم البنية الجديدة في 2.0.0 وأسباب كل قرار.
> For developers: the 1.0.0 structure, the 2.0.0 structure, and why.

---

## 1. البنية في الإصدار 1.0.0 (نقطة البداية)

```
startcaf ─► app/bootstrap.sh|ps1 ─► Node.js (system or portable in CAF_HOME/runtime)
                                     └► app/cli.js  (menu 1-5, first-run, models)
                                          └► app/server.js (daemon, 127.0.0.1:3737)
                                               ├─ static: app/web/ (index.html, app.js, i18n.js, styles.css, brand/)
                                               ├─ /api/* (settings, models, chat, chats, quit)
                                               └─ engine.js ─► `ollama serve` on 127.0.0.1:115xx (child process)
```

| الجزء | الملف | الدور |
|---|---|---|
| المسارات | `app/lib/paths.js` | `CAF_HOME` (‎~/.caf-ai‎ أو ‎%LOCALAPPDATA%\CAF-AI‎)، اكتشاف Ollama، إعادة استخدام ‎~/.ollama/models‎ |
| المحرك | `app/lib/engine.js` | تشغيل `ollama serve` كعملية فرعية على منفذ حر، فحص الصحة، إعادة التشغيل الذاتي |
| الطرفية | `app/cli.js`, `term.js`, `ui.js`, `proc.js` | القائمة بالأرقام، التشغيل بالخلفية، الإيقاف عبر ‎/api/quit‎ |
| التثبيت | `install.js`, `install-caf-ai.*`, `bootstrap.*` | تنزيل Ollama وNode.js (مع SHA-256 لـ Node) |
| الخادم | `app/server.js` | ملف واحد: ملفات ثابتة + API + تمرير بث NDJSON من Ollama |
| الواجهة | `app/web/app.js` | ملف واحد: Markdown آمن، المحادثات، الإعدادات، تنزيل النماذج |

نقاط القوة التي حافظنا عليها: **صفر اعتماديات** في الخادم (وحدات Node المدمجة فقط)، الكتابة الذرّية للملفات، فحص `Host`
ضد DNS rebinding، فحص `Origin` لطلبات التعديل، CSP صارم بلا سكربت مضمّن، وواجهة عربية RTL بهوية iT CAF.

نقاط احتاجت تغييرًا: الخادم والواجهة في ملفين كبيرين؛ طلبات `GET` للبيانات غير محمية إلا بفحص المضيف؛
لا توجد طبقة تجريد للمحركات، فلا مكان لتوليد الصور أو الصوت؛ حفظ المحادثة يحذف أي حقل غير `role/content`.

---

## 2. البنية الجديدة (2.0.0)

```
                ┌───────────────────────── المتصفح (127.0.0.1 فقط) ─────────────────────────┐
                │ app/web/index.html + js/*.js (ES modules) + vendor/ (محلي، بلا CDN)        │
                │  مساحات العمل: محادثة · كود · صور · مستندات   |  الأدوات · جهازي · الإعدادات │
                │  Workers: js-runner (eval معزول, بلا شبكة) · py-runner (Pyodide)            │
                │  iframe معزول (sandbox بلا allow-same-origin) للمعاينة الحية                 │
                └──────────────┬────────────────────────────────────────────────────────────┘
                               │ X-CAF-Token (رمز جلسة) · Cookie SameSite=Strict للوسائط
                ┌──────────────▼──────────────── app/server.js ─────────────────────────────┐
                │ router.js ─ routes/{core,hardware,catalog,images,knowledge,voice,tools,     │
                │                     backup,v1}.js                                          │
                │ chat.js (الموجّه التلقائي، التفكير، الصور، RAG)                              │
                │ providers/  ← طبقة المزوّدين                                                 │
                │   ollama.js        chat · vision · embeddings · thinking · audio(STT)        │
                │   sdcpp.js         image-gen (stable-diffusion.cpp, عملية لكل توليد)          │
                │   whisper.js       stt (whisper.cpp)                                         │
                │   piper.js         tts                                                       │
                │   pyodide.js       code-run (ملفات تُخدَّم للمتصفح)                            │
                │ hardware.js · catalog.js · autoroute.js · downloads.js · jobs.js · rag.js     │
                │ extract.js · zip.js · tar.js · backup.js · migrate.js · store.js · security.js│
                └──────────────┬──────────────────────────────┬─────────────────────────────┘
                               │ child processes              │ files
                    ollama serve · sd-cli · whisper-cli · piper   CAF_HOME/
```

### 2.1 طبقة المزوّدين (Providers)

كل قدرة لها واجهة واحدة داخل الخادم، وخلفها محرك أو أكثر بترتيب أفضلية (`app/lib/providers/index.js`):

| القدرة | الترتيب | ملاحظات |
|---|---|---|
| `chat` | Ollama | ‎/api/chat‎ بالبث |
| `vision` | Ollama | حقل `images` في ‎/api/chat‎ لنماذج قدرتها `vision` |
| `embeddings` | Ollama | ‎/api/embed‎ |
| `image-gen` | Ollama ← stable-diffusion.cpp | Ollama 0.33.3 يرفض نماذج الصور صراحة (`image generation models are not currently supported` في `server/routes.go`) فيُستخدم sd.cpp |
| `stt` | whisper.cpp ← نموذج صوتي في Ollama | whisper.cpp لا ينشر ملفًا تنفيذيًا لـ macOS؛ البديل `/v1/audio/transcriptions` في Ollama مع نموذج قدرته `audio` (مثل gemma4) |
| `tts` | Piper | صوت عربي ar_JO-kareem |
| `code-run` | Pyodide (في المتصفح) | لا تنفيذ لأي كود على نظام المستخدم |

كل مزوّد يصدّر `id, name, capabilities, status()`، والمحركات الإضافية تصدّر أيضًا `install(onProgress)`,
`uninstall()`, `health()`. المحركات الإضافية **لا تعمل باستمرار**: تُشغَّل عملية لكل مهمة (توليد صورة، تفريغ صوت، نطق)
وتُقتل عند الإلغاء أو الإيقاف؛ `health()` يشغّل الملف التنفيذي بـ `--help` ويتحقق من خروجه. حالة الجميع في
‎/api/providers‎ وتظهر في صفحة «الأدوات المثبّتة».

### 2.2 البيانات في CAF_HOME

```
CAF_HOME/
  engine/            Ollama (إن لم يكن مثبّتًا في النظام)
  runtime/           Node.js المحمول (إن لزم)
  models/            نماذج Ollama (أو ‎~/.ollama/models‎ إن وُجدت)
  extras/engines/    sdcpp/ whisper/ piper/ pyodide/      ← تُنزَّل عند الطلب فقط
  extras/models/     image/ stt/ voices/                   ← نماذج غير Ollama
  data/
    settings.json  schema.json  hardware.json  catalog.json(تحديث اختياري)  model-caps.json  api-key.txt
    chats/<id>.json        attachments/<chatId>/<attId>.<ext>
    images/<id>.png+json   knowledge/<collectionId>/{meta.json,chunks.jsonl,vectors.f32}
    canvas/<id>.json       backups/<label>-<time>/      caf.log  server.json(المنفذ ورمز الجلسة)
```

لا مسار ثابت في الكود: كل شيء يُبنى من `CAF_HOME` (قابل للنقل إلى فلاشة USB). الاستثناء الوحيد هو ما يكتبه Ollama
نفسه، ونقلّله بتوجيه `HOME` الخاص به إلى `data/engine-home`.

### 2.3 الترحيل (Migration)

`data/schema.json` يحمل رقم صيغة البيانات. عند التشغيل، إن كان أقدم من 2: تُنسخ المحادثات والإعدادات كما هي إلى
`data/backups/pre-v2-<time>/`، ثم يُرفع كل ملف إلى v2 (`v`, `workspace`, `collections`) بكتابة ذرّية. الملفات التالفة
لا تُلمس. الترحيل قابل للتكرار بأمان (idempotent)، والقراءة تقبل v1 حتى لو لم يجرِ الترحيل.

### 2.4 الأمان

- الخادم يستمع على `127.0.0.1` فقط. يُرفض أي `Host` غير ‎127.0.0.1:port/localhost:port‎ (DNS rebinding).
- **رمز جلسة** عشوائي لكل تشغيل: يُحقن في `index.html` ويُرسل في `X-CAF-Token` مع كل طلب ‎/api‎. المواقع الأخرى لا
  تستطيع قراءته. الوسائط (‎/files‎) تقبل Cookie ‏`HttpOnly; SameSite=Strict`. الطرفية تقرأ الرمز من `server.json`.
- `Origin` أجنبي يُرفض لكل طلب تعديل. لا CORS.
- **لا تنفيذ لمخرجات النموذج على النظام إطلاقًا.** JavaScript في Worker بسياسة `connect-src 'none'` وحد زمني؛ Python في
  Pyodide داخل Worker لا يتصل إلا بمسار ملفاته؛ HTML في iframe بـ `sandbox="allow-scripts"` (أصل معتم) وCSP بلا شبكة.
- ‎/v1‎ (API للمطوّرين) محمي بمفتاح `Bearer` يُولَّد محليًا ويمكن إيقافه من الإعدادات.
- كل تنزيل يُتحقق من حجمه وSHA-256 المثبّت في `app/catalog/addons.json`.

### 2.5 الموجّه التلقائي واختيار النموذج

`hardware.js` يقيس الرام والمعالج وGPU (Metal/CUDA) والمساحة وسرعة القرص، ويحفظها في `hardware.json`.
`catalog.js` يقرأ `app/catalog/models.json` (أسماء موثّقة من مكتبة Ollama وسجلّها الرسمي) ويحسب «موصى به لجهازك»
لكل فئة. `autoroute.js` يختار لكل رسالة: رؤية إن وُجدت صورة، توليد صور لطلبات «ارسم…»، برمجة لطلبات الكود،
وإلا النموذج العام — ويُرسل اختياره في سطر `meta` ليظهر على الرد.

### 2.6 الواجهة

ES modules بلا أداة بناء (`app/web/js/`)، ونظام الترجمة نفسه (`i18n.js` + `data-i18n`). المكتبات الخارجية في
`app/web/vendor/` تُبنى مرة واحدة وقت التطوير (`tools/vendor/build.mjs`) وتُحمَّل عند الحاجة فقط (Mermaid وpdf.js وKaTeX
وCodeMirror). Pyodide وحده يُنزَّل إلى CAF_HOME عند أول تشغيل لكود Python لأن حجمه كبير.

### 2.7 الاختبارات

`node --test` (مدمج، بلا اعتماديات). `tests/helpers/mock-ollama.js` يحاكي Ollama، و`tests/helpers/server.js` يشغّل
الخادم الحقيقي في CAF_HOME مؤقت. اختبارات حقيقية مع نموذج صغير تعمل عند تعيين `CAF_TEST_REAL=1`.
