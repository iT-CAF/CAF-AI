# إشعارات المكوّنات الخارجية · Third-Party Notices

كآف AI نفسه ملك لـ iT CAF ورخصته في [LICENSE](LICENSE). المكوّنات التالية **لا تُوزَّع داخل هذا المستودع**؛
يُنزّلها المثبّت من مصادرها الرسمية إلى جهازك، وتبقى لكل منها رخصتها:

CAF AI itself is owned by iT CAF and licensed under [LICENSE](LICENSE). The components below are **not distributed in this
repository**; the installer downloads them from their official sources and each keeps its own license.

| المكوّن · Component | الاستخدام · Use | الرخصة · License | المصدر · Source |
|---|---|---|---|
| Ollama | محرك تشغيل النماذج محليًا | MIT | https://github.com/ollama/ollama |
| llama.cpp (داخل Ollama) | تنفيذ النماذج | MIT | https://github.com/ggml-org/llama.cpp |
| Node.js | تشغيل الخادم المحلي (يُنزَّل إن لم يوجد) | MIT | https://nodejs.org |
| Qwen 2.5 | نموذج لغوي | Apache-2.0 (3B: Qwen Research License) | https://ollama.com/library/qwen2.5 |
| Gemma 3 | نموذج لغوي | Gemma Terms of Use | https://ollama.com/library/gemma3 |
| Llama 3.2 | نموذج لغوي | Llama 3.2 Community License | https://ollama.com/library/llama3.2 |

نسخ رخص Ollama وllama.cpp تُوضع تلقائيًا في مجلد `engine/` عند التثبيت.
الخطوط المضمّنة في `app/web/brand/fonts`: Thmanyah Serif Text (مرفقة مع الهوية البصرية لـ iT CAF)،
IBM Plex Sans Arabic وJetBrains Mono برخصة SIL OFL 1.1.

Always check the license of any model you choose to download; you are responsible for complying with it.
