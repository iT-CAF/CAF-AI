# إشعارات المكوّنات الخارجية · Third-Party Notices

كآف AI نفسه ملك لـ iT CAF ورخصته في [LICENSE](LICENSE). تبقى لكل مكوّن خارجي رخصته الخاصة، ولا تغيّر رخصة كآف AI شروطها.

CAF AI itself is owned by iT CAF and licensed under [LICENSE](LICENSE). Every third-party component keeps its own license;
the CAF AI license does not change their terms.

## 1. مكتبات مضمّنة في المستودع (الواجهة) · Bundled in this repository (UI)

تُبنى مرة واحدة وقت التطوير عبر `tools/vendor/build.mjs` من حزم npm مثبّتة الإصدار، وتُخدَّم محليًا فقط (بلا CDN).
نسخ الرخص بجانب كل مكتبة في `app/web/vendor/<lib>/LICENSE`.

| المكتبة · Library | الإصدار · Version | الاستخدام · Use | الرخصة · License | المصدر · Source |
|---|---|---|---|---|
| highlight.js | 11.12.0 | تلوين الكود · syntax highlighting | BSD-3-Clause | https://github.com/highlightjs/highlight.js |
| KaTeX | 0.19.1 | الرياضيات · math rendering | MIT | https://github.com/KaTeX/KaTeX |
| Mermaid | 12.3.0 | المخططات · diagrams | MIT | https://github.com/mermaid-js/mermaid |
| pdf.js (pdfjs-dist) | 6.5.438 | قراءة PDF · PDF text extraction | Apache-2.0 | https://github.com/mozilla/pdf.js |
| pdf.js wasm decoders (OpenJPEG, JBIG2, qcms) | 6.5.438 | فك صور PDF · PDF image decoding | BSD-2-Clause / Apache-2.0 / MIT (see `app/web/vendor/pdfjs/wasm/LICENSE_*`) | https://github.com/mozilla/pdf.js |
| CodeMirror 6 (+ @codemirror/lang-*, @codemirror/merge, @lezer/*) | 6.0.2 / view 6.43.15 / merge 6.12.3 | محرر اللوحة الجانبية والفروق · canvas editor & diff | MIT | https://codemirror.net |

أيقونات الواجهة في `app/web/brand/icons/ui`: Lucide 1.71.0 (ISC، `LICENSE-lucide.txt`) وشعار GitHub من Octicons 19.42.0 (MIT، `LICENSE-octicons.txt`).
UI icons in `app/web/brand/icons/ui`: Lucide 1.71.0 (ISC) and the GitHub mark from Octicons 19.42.0 (MIT).

المهارات المجتمعية في `app/skills/community` منسوخة دون تعديل من awesome-ai-agent-skills (commit 75865a5) برخصة MIT — انظر `LICENSE` و`SOURCE.txt` في المجلد.
Community skills in `app/skills/community` are copied unmodified from seb1n/awesome-ai-agent-skills (commit 75865a5), MIT — see `LICENSE` and `SOURCE.txt` there.
المهارات المستوردة من المستخدم (مثل Agency Agents، MIT) تُنسخ إلى `CAF_HOME/skills` ولا تُوزَّع مع البرنامج.

الخطوط المضمّنة في `app/web/brand/fonts`: Thmanyah Serif Text (مرفقة مع الهوية البصرية لـ iT CAF)،
IBM Plex Sans Arabic وJetBrains Mono برخصة SIL OFL 1.1. خطوط KaTeX برخصة SIL OFL 1.1.

## 2. محركات تُنزَّل عند الطلب · Engines downloaded on demand

لا تُوزَّع داخل المستودع. يُنزّلها كآف AI من مصادرها الرسمية إلى `CAF_HOME` عند أول حاجة، مع التحقق من الحجم والبصمة.
Not distributed in this repository; CAF AI downloads them from official sources into `CAF_HOME` on first use, verifying size and hash.

| المكوّن · Component | الاستخدام · Use | الرخصة · License | المصدر · Source |
|---|---|---|---|
| Ollama | محرك تشغيل النماذج محليًا · local model engine | MIT | https://github.com/ollama/ollama |
| llama.cpp / ggml (داخل Ollama) | تنفيذ النماذج · inference | MIT | https://github.com/ggml-org/llama.cpp |
| Node.js | تشغيل الخادم المحلي (إن لم يوجد) · local server runtime | MIT | https://nodejs.org |
| Pyodide 314.0.7 | تشغيل Python في المتصفح · Python in the browser | MPL-2.0 (CPython: PSF License) | https://pyodide.org |
| stable-diffusion.cpp (master-1088-32d516c) | توليد الصور · image generation (Metal/Vulkan/CPU) | MIT | https://github.com/leejet/stable-diffusion.cpp |
| openpyxl 3.1.5 · et_xmlfile 2.0.0 | تعديل ملفات Excel · editing Excel files | MIT | https://pypi.org/project/openpyxl/ |
| python-docx 1.2.0 · typing_extensions 4.15.0 | تعديل ملفات Word · editing Word files | MIT · PSF-2.0 | https://pypi.org/project/python-docx/ |
| lxml 6.1.3 (Pyodide build) | معالجة XML لـ python-docx | BSD-3-Clause | https://lxml.de |

## 3. نماذج الذكاء الاصطناعي · AI models

لا يحتوي المستودع أي نموذج. كتالوج النماذج (`app/catalog/models.json`) يذكر رخصة كل نموذج كما هي في سجل Ollama الرسمي،
ويحذّر داخل التطبيق من الرخص غير التجارية قبل التنزيل. أنت مسؤول عن الالتزام برخصة أي نموذج تختار تنزيله.

The repository contains no models. The catalog lists each model's license as published in the official Ollama registry,
and the app warns before downloading anything with a non-commercial license.

| العائلة · Family | الرخصة · License |
|---|---|
| Qwen 3.5, Qwen 3, Qwen3-VL, Qwen3-Coder, Qwen3-Embedding, Qwen 2.5 (7B/14B), Qwen 2.5 Coder (1.5B/7B/14B) | Apache-2.0 |
| Qwen 2.5 3B, Qwen 2.5 Coder 3B | Qwen Research License (غير تجاري · non-commercial) |
| Gemma 4 | Apache-2.0 |
| Gemma 3, EmbeddingGemma | Gemma Terms of Use |
| gpt-oss | Apache-2.0 |
| Llama 3.2 | Llama 3.2 Community License |
| BGE-M3 | MIT |
| FLUX.2 klein 4B (GGUF: leejet) · FLUX.2 VAE (Comfy-Org) | Apache-2.0 |
| Z-Image Turbo (GGUF: leejet) · its VAE (Comfy-Org) | Apache-2.0 |
| Qwen3-4B / Qwen3-4B-Instruct-2507 GGUF (unsloth) — مشفّر النص لنماذج الصور | Apache-2.0 |
