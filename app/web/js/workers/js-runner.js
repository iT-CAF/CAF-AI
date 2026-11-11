/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// عامل تشغيل JavaScript معزول: بلا DOM، بلا شبكة (CSP: connect-src 'none')، ويُنهى من الواجهة عند تجاوز المهلة.
'use strict';
const fmt = (v) => {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try { return JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() + 'n' : typeof x === 'function' ? `[Function ${x.name || 'anonymous'}]` : x), 2) ?? String(v); } catch { return String(v); }
};
const send = (type, args) => self.postMessage({ type, text: args.map(fmt).join(' ') });
for (const k of ['log', 'info', 'debug']) console[k] = (...a) => send('out', a);
console.warn = (...a) => send('warn', a);
console.error = (...a) => send('err', a);
console.table = (d) => send('out', [d]);
// قطع أي وسيلة اتصال متبقية (احتياط فوق CSP)
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches']) { try { Object.defineProperty(self, k, { value: undefined, configurable: false }); } catch { /* */ } }

self.onmessage = async (e) => {
  const { code } = e.data || {};
  const t0 = performance.now();
  try {
    // async لدعم await في المستوى الأعلى
    const fn = new Function(`return (async () => {\n${code}\n})()`);
    const result = await fn();
    if (result !== undefined) send('result', [result]);
    self.postMessage({ type: 'done', ms: Math.round(performance.now() - t0) });
  } catch (err) {
    send('err', [err]);
    self.postMessage({ type: 'done', ms: Math.round(performance.now() - t0), failed: true });
  }
};
