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

let office = null;
// أدوات المكتب (openpyxl, python-docx…) من ‎/runtime/office/‎ — تُحمَّل مرة واحدة
async function ensureOffice(p, wheels) {
  if (!office) office = p.loadPackage(wheels.map((w) => '/runtime/office/' + w), { messageCallback: () => {}, errorCallback: (m) => post('err', m) }).catch((e) => { office = null; throw e; });
  return office;
}

self.onmessage = async (e) => {
  const { code, warm, files = [], wheels = [] } = e.data || {};
  const t0 = performance.now();
  try {
    const p = await ensure();
    if (warm) return post('status', 'ready');
    if (wheels.length) { post('status', 'office'); await ensureOffice(p, wheels); post('status', 'ready'); }
    // ملفات المدخلات/المخرجات داخل نظام الملفات الافتراضي لـ Pyodide فقط
    const FS = p.FS;
    for (const d of ['/data', '/data/in', '/data/out']) { try { FS.mkdir(d); } catch { /* موجود */ } }
    for (const f of FS.readdir('/data/out')) if (f !== '.' && f !== '..') FS.unlink('/data/out/' + f);
    for (const f of files) FS.writeFile('/data/in/' + f.name, new Uint8Array(f.data));
    p.globals.set('__name__', '__main__');
    const result = await p.runPythonAsync(code);
    if (result !== undefined && result !== null) {
      let r = result; try { r = result.toString(); if (result.destroy) result.destroy(); } catch { /* */ }
      post('result', String(r));
    }
    const outputs = FS.readdir('/data/out').filter((f) => f !== '.' && f !== '..').map((name) => ({ name, data: FS.readFile('/data/out/' + name).buffer }));
    self.postMessage({ type: 'done', ms: Math.round(performance.now() - t0), outputs }, outputs.map((o) => o.data));
  } catch (err) {
    const msg = String(err && err.message || err);
    post('err', /ModuleNotFoundError/.test(msg) ? msg + '\n(المكتبات القياسية فقط متاحة بدون إنترنت · Only the standard library is available offline)' : msg);
    self.postMessage({ type: 'done', ms: Math.round(performance.now() - t0), failed: true, error: msg.split('\n').slice(-6).join('\n') });
  }
};
