// CAF AI · Ollama وهمي للاختبارات: يحاكي /api/version و/api/tags و/api/show و/api/chat و/api/embed و/api/pull و/api/delete.
'use strict';
const http = require('http');

const DEFAULT_MODELS = [
  { name: 'qwen3.5:4b', caps: ['completion', 'vision', 'tools', 'thinking'], family: 'qwen35', size: 3.3e9 },
  { name: 'qwen2.5-coder:7b', caps: ['completion', 'tools', 'insert'], family: 'qwen2', size: 4.7e9 },
  { name: 'qwen2.5:7b', caps: ['completion', 'tools'], family: 'qwen2', size: 4.7e9 },
  { name: 'qwen3-embedding:0.6b', caps: ['embedding'], family: 'qwen3', size: 6.4e8 },
];

function vec(text, dim = 16) {
  // متجه حتمي بسيط من الحروف (يكفي لاختبار الترتيب بالتشابه)
  const v = new Array(dim).fill(0);
  for (const w of String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    let h = 0; for (const ch of w) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    v[h % dim] += 1;
  }
  const n = Math.hypot(...v) || 1; return v.map((x) => x / n);
}

const MULTIFILE = [
  'إليك آلة حاسبة من ثلاثة ملفات.', '', '**الملف: `index.html`**', '```html', '<!DOCTYPE html>', '<html lang="ar" dir="rtl">', '<head>', '  <meta charset="UTF-8">', '  <title>آلة حاسبة</title>',
  '  <link rel="stylesheet" href="style.css">', '</head>', '<body>', '  <div class="calc"><input id="d" readonly><div class="keys">', '    <button>1</button><button>2</button><button>+</button><button>=</button>', '  </div></div>',
  '  <script src="script.js"></script>', '</body>', '</html>', '```', '', '**الملف: `style.css`**', '```css', 'body { display: grid; place-items: center; min-height: 100vh; margin: 0; background: #101418; }',
  '.calc { background: #1b2229; padding: 18px; border-radius: 16px; }', '#d { width: 100%; font-size: 28px; text-align: left; }', '.keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }',
  'button { font-size: 20px; padding: 14px; border-radius: 10px; border: 0; background: #e8a33d; }', '.ok { color: green; }', '```', '', '**الملف: `script.js`**', '```javascript', "const d = document.getElementById('d');", 'let expr = "";',
  "document.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {", "  if (b.textContent === '=') { expr = String(eval(expr)); } else { expr += b.textContent; }", '  d.value = expr;', '}));', "console.log('ready');", '```', '', 'افتح المعاينة لتجربتها.',
].join('\n');

function startMock({ models = DEFAULT_MODELS, port = 0 } = {}) {
  const calls = [];
  const state = { models: [...models] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let j = {}; try { j = body ? JSON.parse(body) : {}; } catch { /* */ }
      calls.push({ method: req.method, path: req.url, body: j });
      const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url === '/api/version') return json(200, { version: '0.33.3-mock' });
      if (req.url === '/api/tags') return json(200, { models: state.models.map((m) => ({ name: m.name, model: m.name, size: m.size, digest: 'sha256:' + m.name.replace(/\W/g, ''), modified_at: '2026-11-01T00:00:00Z', details: { family: m.family, parameter_size: '4B' } })) });
      if (req.url === '/api/show') {
        const m = state.models.find((x) => x.name === j.model);
        if (!m) return json(404, { error: `model '${j.model}' not found` });
        return json(200, { capabilities: m.caps, details: { family: m.family, parameter_size: '4B', quantization_level: 'Q4_K_M' }, model_info: { [`${m.family}.context_length`]: 32768 } });
      }
      if (req.url === '/api/embed') {
        const input = Array.isArray(j.input) ? j.input : [j.input];
        return json(200, { model: j.model, embeddings: input.map((t) => vec(t)) });
      }
      if (req.url === '/api/delete') { state.models = state.models.filter((m) => m.name !== j.model); return json(200, {}); }
      if (req.url === '/api/pull') {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        if (j.model === 'missing:model') { res.end(JSON.stringify({ error: 'pull model manifest: file does not exist' }) + '\n'); return; }
        res.write(JSON.stringify({ status: 'pulling manifest' }) + '\n');
        res.write(JSON.stringify({ status: 'downloading', total: 100, completed: 50 }) + '\n');
        res.write(JSON.stringify({ status: 'success' }) + '\n');
        state.models.push({ name: j.model, caps: ['completion'], family: 'mock', size: 1e9 });
        return res.end();
      }
      if (req.url === '/api/chat') {
        const m = state.models.find((x) => x.name === j.model);
        if (!m) return json(404, { error: `model "${j.model}" not found, try pulling it first` });
        const last = [...(j.messages || [])].reverse().find((x) => x.role === 'user') || { content: '' };
        if (last.images && !m.caps.includes('vision')) return json(400, { error: `${j.model} does not support images` });
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        const thinkOn = j.think && j.think !== false && m.caps.includes('thinking');
        if (thinkOn) res.write(JSON.stringify({ model: j.model, message: { role: 'assistant', content: '', thinking: 'أفكر… ' }, done: false }) + '\n');
        const reply = /CJK/.test(last.content) ? 'هذه إجابة 这是中文 بالعربية' : /MULTIFILE/.test(last.content) ? MULTIFILE : `echo(${j.model}): ${last.content}${last.images ? ` [images:${last.images.length}]` : ''}`;
        const parts = reply.match(/.{1,8}/gs) || [];
        const end = () => res.end(JSON.stringify({ model: j.model, message: { role: 'assistant', content: '' }, done: true, eval_count: 20, eval_duration: 1e9, prompt_eval_count: 10 }) + '\n');
        // MULTIFILE يُبث ببطء (للاختبار البصري لكتابة الملفات حيًا في اللوحة)
        const slow = /MULTIFILE/.test(last.content) ? 12 : 0;
        if (!slow) { for (const part of parts) res.write(JSON.stringify({ model: j.model, message: { role: 'assistant', content: part }, done: false }) + '\n'); end(); return; }
        let k = 0; const tick = () => { if (k >= parts.length) return end(); res.write(JSON.stringify({ model: j.model, message: { role: 'assistant', content: parts[k++] }, done: false }) + '\n'); setTimeout(tick, slow); }; tick();
        return;
      }
      // واجهة Ollama المتوافقة مع OpenAI (‎/v1‎)
      if (req.url === '/v1/chat/completions') {
        const m = state.models.find((x) => x.name === j.model);
        if (!m) return json(404, { error: { message: `model "${j.model}" not found`, type: 'api_error' } });
        const lastU = [...(j.messages || [])].reverse().find((x) => x.role === 'user') || {};
        const text = `v1(${j.model}): ${typeof lastU.content === 'string' ? lastU.content : (lastU.content || []).map((p) => p.type).join('+')}`;
        if (!j.stream) return json(200, { id: 'chatcmpl-1', object: 'chat.completion', created: 1, model: j.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 } });
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        for (const part of text.match(/.{1,6}/gs)) res.write(`data: ${JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model: j.model, choices: [{ index: 0, delta: { content: part }, finish_reason: null }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', created: 1, model: j.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
        return res.end('data: [DONE]\n\n');
      }
      if (req.url === '/v1/embeddings') {
        const input = Array.isArray(j.input) ? j.input : [j.input];
        return json(200, { object: 'list', model: j.model, data: input.map((t, i) => ({ object: 'embedding', index: i, embedding: vec(t) })), usage: { prompt_tokens: 3, total_tokens: 3 } });
      }
      json(404, { error: 'not found' });
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, calls, state, close: () => new Promise((r) => server.close(r)) })));
}

module.exports = { startMock, vec, DEFAULT_MODELS };
