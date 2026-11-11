# الواجهة البرمجية المحلية · Local API

كآف AI يوفّر واجهة برمجية **متوافقة مع OpenAI** تعمل على جهازك فقط. اربط بها تطبيقاتك وسكربتاتك وإضافات المحررات
دون إنترنت ودون حسابات ودون إرسال أي بيانات خارج الجهاز.

CAF AI exposes an **OpenAI-compatible** API that runs only on your device. Point your apps, scripts and editor plugins at it —
no internet, no accounts, nothing leaves the machine.

| | |
|---|---|
| العنوان · Base URL | `http://127.0.0.1:3737/v1` (المنفذ الفعلي يظهر في الإعدادات · the actual port is shown in Settings) |
| المصادقة · Auth | `Authorization: Bearer caf-…` |
| التفعيل · Enable | الإعدادات ← الواجهة البرمجية المحلية · Settings → Local API |

## 1. التفعيل والمفتاح · Enabling and the key

1. افتح كآف AI ← **الإعدادات** ← **الواجهة البرمجية المحلية**، وفعّل المفتاح.
2. انسخ **المفتاح** (`caf-` متبوعًا بـ 40 حرفًا). يُحفظ في `CAF_HOME/data/api-key.txt` بصلاحيات المالك فقط.
3. زر **مفتاح جديد** يلغي المفتاح القديم فورًا.

1. Open CAF AI → **Settings** → **Local API** and turn it on.
2. Copy the **key** (`caf-` + 40 hex chars). It is stored in `CAF_HOME/data/api-key.txt`, readable by your user only.
3. **New key** revokes the old one immediately.

### الأمان · Security

- الخادم يستمع على `127.0.0.1` فقط؛ لا يصل إليه أي جهاز آخر في الشبكة.
- الواجهة **معطّلة افتراضيًا**، وكل طلب يحتاج المفتاح.
- طلبات المتصفح القادمة من مواقع أخرى (ترويسة `Origin` غريبة) تُرفض، فلا تستطيع صفحة ويب استغلال المفتاح.
- لا يُنفَّذ أي شيء من مخرجات النموذج على جهازك.

- The server listens on `127.0.0.1` only; no other machine on the network can reach it.
- The API is **off by default** and every request needs the key.
- Browser requests from other websites (foreign `Origin` header) are rejected, so a web page cannot abuse the key.
- Nothing from model output is ever executed on your machine.

## 2. النقاط المتاحة · Endpoints

| الطريقة · Method | المسار · Path | الوصف · Description |
|---|---|---|
| GET | `/v1/models` | النماذج المثبّتة + `auto` · installed models + `auto` |
| POST | `/v1/chat/completions` | محادثة، دفعة واحدة أو بث SSE، مع الصور · chat, single response or SSE stream, images supported |
| POST | `/v1/embeddings` | متجهات نصية · text embeddings |
| POST | `/v1/images/generations` | توليد صور (`b64_json`) · image generation (`b64_json`) |
| POST | `/v1/audio/transcriptions` | تفريغ صوت (multipart) · speech to text (multipart) |

### `model: "auto"`

اكتب `"auto"` (أو احذف `model`) ليختار كآف AI النموذج المثبّت الأنسب لكل طلب، بالموجّه نفسه الذي يستخدمه التطبيق:
طلب فيه صورة ← نموذج رؤية، وطلب برمجي ← نموذج برمجة، وغير ذلك ← نموذج المحادثة.

Send `"auto"` (or omit `model`) and CAF AI picks the best installed model per request, with the same router as the app:
image → vision model, code → coding model, anything else → chat model.

### الأخطاء · Errors

بصيغة OpenAI · OpenAI format: `{"error": {"message", "type", "code"}}`

| الحالة · Status | `code` | المعنى · Meaning |
|---|---|---|
| 401 | `invalid_api_key` | المفتاح مفقود أو خاطئ · missing or wrong key |
| 403 | `api_disabled` | الواجهة غير مفعّلة · the API is disabled |
| 403 | `bad_origin` | طلب من موقع آخر · request from another website |
| 404 | `model_not_found` | النموذج غير مثبّت · model not installed |
| 429 | `image_busy` | صورة أخرى قيد التوليد · another image is generating |

## 3. أمثلة · Examples

### curl

```bash
export CAF_KEY="caf-…"   # من الإعدادات · from Settings

# النماذج · models
curl http://127.0.0.1:3737/v1/models -H "Authorization: Bearer $CAF_KEY"

# محادثة · chat
curl http://127.0.0.1:3737/v1/chat/completions \
  -H "Authorization: Bearer $CAF_KEY" -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"اكتب تغريدة عن القهوة العربية"}]}'

# بث · streaming (SSE)
curl -N http://127.0.0.1:3737/v1/chat/completions \
  -H "Authorization: Bearer $CAF_KEY" -H "Content-Type: application/json" \
  -d '{"model":"auto","stream":true,"messages":[{"role":"user","content":"اشرح الذكاء الاصطناعي في 3 نقاط"}]}'

# صورة مع سؤال · image + question
IMG=$(base64 < photo.jpg | tr -d '\n')
curl http://127.0.0.1:3737/v1/chat/completions \
  -H "Authorization: Bearer $CAF_KEY" -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"ماذا في الصورة؟\"},{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/jpeg;base64,$IMG\"}}]}]}"

# تضمين · embeddings
curl http://127.0.0.1:3737/v1/embeddings \
  -H "Authorization: Bearer $CAF_KEY" -H "Content-Type: application/json" \
  -d '{"model":"auto","input":["الرياض عاصمة السعودية","Riyadh is the capital"]}'

# توليد صورة · image generation
curl http://127.0.0.1:3737/v1/images/generations \
  -H "Authorization: Bearer $CAF_KEY" -H "Content-Type: application/json" \
  -d '{"prompt":"a cozy Arabic coffee shop at sunset, watercolor","size":"768x768"}' \
  | python3 -c "import sys,json,base64;open('out.png','wb').write(base64.b64decode(json.load(sys.stdin)['data'][0]['b64_json']))"

# تفريغ صوت · transcription
curl http://127.0.0.1:3737/v1/audio/transcriptions \
  -H "Authorization: Bearer $CAF_KEY" -F file=@voice.wav -F model=auto -F language=ar
```

### PHP

```php
<?php
// CAF AI — محادثة عبر الواجهة المحلية · chat via the local API
$key = getenv('CAF_KEY'); // caf-…
$ch = curl_init('http://127.0.0.1:3737/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer $key", 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode([
        'model' => 'auto',
        'messages' => [
            ['role' => 'system', 'content' => 'أنت مساعد خدمة عملاء مهذب.'],
            ['role' => 'user', 'content' => 'متى يصل طلبي؟'],
        ],
        'temperature' => 0.4,
    ], JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 300,
]);
$res = json_decode(curl_exec($ch), true);
if (isset($res['error'])) { throw new RuntimeException($res['error']['message']); }
echo $res['choices'][0]['message']['content'];
```

### JavaScript (Node 18+ / Deno / Bun)

```js
// CAF AI — بث الرد كلمة كلمة · stream the reply token by token
const res = await fetch('http://127.0.0.1:3737/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.CAF_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'auto', stream: true, messages: [{ role: 'user', content: 'اكتب قصيدة قصيرة عن البحر' }] }),
});
const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
for (;;) {
  const { value, done } = await reader.read(); if (done) break;
  buf += dec.decode(value, { stream: true });
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const line = buf.slice(0, i).replace(/^data: /, ''); buf = buf.slice(i + 2);
    if (line === '[DONE]') continue;
    process.stdout.write(JSON.parse(line).choices[0]?.delta?.content || '');
  }
}
```

مع مكتبة OpenAI الرسمية · with the official OpenAI SDK:

```js
import OpenAI from 'openai';
const client = new OpenAI({ baseURL: 'http://127.0.0.1:3737/v1', apiKey: process.env.CAF_KEY });
const r = await client.chat.completions.create({ model: 'auto', messages: [{ role: 'user', content: 'لخّص: …' }] });
console.log(r.choices[0].message.content);
```

### Python

```python
from openai import OpenAI  # pip install openai
client = OpenAI(base_url="http://127.0.0.1:3737/v1", api_key="caf-…")

r = client.chat.completions.create(model="auto", messages=[{"role": "user", "content": "ترجم إلى الإنجليزية: صباح الخير"}])
print(r.choices[0].message.content)

for chunk in client.chat.completions.create(model="auto", stream=True, messages=[{"role": "user", "content": "عدّد 5 مدن عربية"}]):
    print(chunk.choices[0].delta.content or "", end="")

vec = client.embeddings.create(model="auto", input=["نص للبحث الدلالي"]).data[0].embedding
```

## 4. ملاحظات · Notes

- المحادثة تمرّ إلى محرك Ollama المحلي كما هي، فتعمل خيارات OpenAI المعتادة (`temperature` و`max_tokens` و`stop` و`response_format` و`tools`) حسب دعم النموذج.
- الصور في المحادثة بصيغة `data:` فقط (لا روابط إنترنت). الحد الأقصى لحجم الطلب 48 ميغابايت.
- توليد الصور يحتاج تثبيت محرك الصور ونموذجه من صفحة **الصور**. على الأجهزة بلا معالج رسوميات يُصغَّر الحجم إلى 512 تلقائيًا.
- التفريغ الصوتي يحتاج نموذجًا صوتيًا مثبّتًا في Ollama (مثل `gemma4:e2b`).

- Chat requests are passed to the local Ollama engine as-is, so the usual OpenAI options (`temperature`, `max_tokens`, `stop`, `response_format`, `tools`) work as far as the model supports them.
- Chat images must be `data:` URLs (no internet links). The request body limit is 48 MB.
- Image generation needs the image engine and a model installed from the **Images** page. Without a GPU, sizes are capped at 512 automatically.
- Transcription needs an audio-capable model installed in Ollama (e.g. `gemma4:e2b`).

---

كآف AI · برمجة وتصميم كآف · [it-caf.com](https://it-caf.com) · [github.com/iT-CAF/CAF-AI](https://github.com/iT-CAF/CAF-AI)
