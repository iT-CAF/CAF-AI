/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// عامل Python (Pyodide): وحدة ES تُحمَّل من ‎/runtime/pyodide/‎ (CAF_HOME) فقط. لا شبكة خارج هذا المسار (CSP).
let py = null;
let loading = null;
const post = (type, text = '') => self.postMessage({ type, text });

async function ensure() {
  if (py) return py;
  if (!loading) {
    loading = (async () => {
      post('status', 'loading');
      const { loadPyodide } = await import('/runtime/pyodide/pyodide.mjs');
      const p = await loadPyodide({ indexURL: '/runtime/pyodide/', stdout: (s) => post('out', s), stderr: (s) => post('err', s) });
      // input() غير متاح في العامل: نعيد سلسلة فارغة بدل التجمّد
      p.setStdin({ stdin: () => '' });
      py = p; post('status', 'ready');
      return p;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

self.onmessage = async (e) => {
  const { code, warm } = e.data || {};
  const t0 = performance.now();
  try {
    const p = await ensure();
    if (warm) return post('status', 'ready');
    const result = await p.runPythonAsync(code);
    if (result !== undefined && result !== null) {
      let r = result; try { r = result.toString(); if (result.destroy) result.destroy(); } catch { /* */ }
      post('result', String(r));
    }
    self.postMessage({ type: 'done', ms: Math.round(performance.now() - t0) });
  } catch (err) {
    const msg = String(err && err.message || err);
    // نعرض آخر سطر مفيد من traceback
    post('err', /ModuleNotFoundError/.test(msg) ? msg + '\n(المكتبات القياسية فقط متاحة بدون إنترنت · Only the standard library is available offline)' : msg);
    self.postMessage({ type: 'done', ms: Math.round(performance.now() - t0), failed: true });
  }
};
