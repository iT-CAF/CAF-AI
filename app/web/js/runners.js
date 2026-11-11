/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// تشغيل الكود بأمان داخل المتصفح فقط: JavaScript في Worker، Python في Pyodide داخل Worker، HTML في iframe معزول.
import { t, api, readNdjson, authHeaders, errText, confirmBox, fmtBytes, emit } from './core.js';
import { downloads } from './downloads.js';

export const LANG_KIND = (l) => (/^(js|javascript|mjs)$/i.test(l) ? 'js' : /^(py|python|python3)$/i.test(l) ? 'py' : /^(html|htm|svg|xml)$/i.test(l) ? 'html' : null);

// ---------- JavaScript ----------
export function runJS(code, { timeout = 8000, onLine } = {}) {
  return new Promise((resolve) => {
    const w = new Worker('/js/workers/js-runner.js');
    const lines = [];
    const push = (type, text) => { const l = { type, text }; lines.push(l); onLine?.(l); };
    const timer = setTimeout(() => { w.terminate(); push('err', t('runTimeout', { s: Math.round(timeout / 1000) })); resolve({ lines, timedOut: true }); }, timeout);
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'done') { clearTimeout(timer); w.terminate(); resolve({ lines, ms: m.ms, failed: m.failed }); return; }
      push(m.type, m.text);
    };
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); push('err', e.message || 'error'); resolve({ lines, failed: true }); };
    w.postMessage({ code });
  });
}

// ---------- Python (Pyodide) ----------
let pyWorker = null;
let pyBusy = null;
export async function pyodideStatus() {
  const r = await api('GET', '/api/addons');
  return r.engines.find((e) => e.id === 'pyodide');
}
export async function ensurePyodide() {
  const s = await pyodideStatus();
  if (s?.installed) return true;
  if (!(await confirmBox(t('pyInstallAsk', { size: fmtBytes(s?.downloadSize || 6.5e6) }), { ok: t('download') }))) return false;
  return installAddon('pyodide', 'Pyodide (Python)');
}

// تثبيت محرك/نموذج إضافي مع شريط تقدّم
export async function installAddon(id, label) {
  const job = await api('POST', `/api/addons/${id}/install`);
  const dlId = 'addon:' + id;
  downloads.start(dlId, label, () => api('POST', `/api/jobs/${job.id}/cancel`).catch(() => {}));
  try {
    const r = await fetch(`/api/jobs/${job.id}/stream`, { headers: authHeaders() });
    let final = null;
    await readNdjson(r, (j) => {
      final = j;
      if (j.status === 'running') downloads.update(dlId, { completed: j.progress.completed || 0, total: j.progress.total || 0, text: j.progress.text === 'extract' ? t('extracting') : t('downloading') });
    });
    if (final?.status === 'done') { downloads.done(dlId, t('installedOk')); emit('addons:changed', id); return true; }
    downloads.fail(dlId, final?.status === 'canceled' ? t('canceled') : errText(final?.error?.code || 'install_failed'));
    return false;
  } catch (e) { downloads.fail(dlId, errText(e)); return false; }
}

function getPyWorker() {
  if (!pyWorker) pyWorker = new Worker('/js/workers/py-runner.js', { type: 'module' });
  return pyWorker;
}
export async function runPython(code, { timeout = 30000, onLine, onStatus } = {}) {
  if (!(await ensurePyodide())) return { lines: [{ type: 'err', text: t('pyNotInstalled') }], failed: true };
  while (pyBusy) await pyBusy;
  let release; pyBusy = new Promise((r) => { release = r; });
  try {
    return await new Promise((resolve) => {
      const w = getPyWorker();
      const lines = [];
      const push = (type, text) => { const l = { type, text }; lines.push(l); onLine?.(l); };
      let timer = null;
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => { w.terminate(); pyWorker = null; push('err', t('runTimeout', { s: Math.round(timeout / 1000) })); resolve({ lines, timedOut: true }); }, timeout); };
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'status') { onStatus?.(m.text); if (m.text === 'ready') arm(); return; }
        if (m.type === 'done') { clearTimeout(timer); resolve({ lines, ms: m.ms, failed: m.failed }); return; }
        push(m.type, m.text);
      };
      w.onerror = (e) => { clearTimeout(timer); w.terminate(); pyWorker = null; push('err', e.message || 'error'); resolve({ lines, failed: true }); };
      // مهلة التحميل الأول أطول (فك WebAssembly)، ثم مهلة التشغيل
      timer = setTimeout(() => { w.terminate(); pyWorker = null; push('err', t('pyLoadFailed')); resolve({ lines, failed: true }); }, 120000);
      w.postMessage({ code });
    });
  } finally { pyBusy = null; release(); }
}

// ---------- المعاينة الحية (HTML/CSS/JS) ----------
// iframe بـ sandbox="allow-scripts" فقط: أصل معتم، لا وصول للصفحة الأم ولا لملفاتك ولا للشبكة.
export function mountPreview(container, html, { onConsole } = {}) {
  container.innerHTML = '';
  const f = document.createElement('iframe');
  f.className = 'preview-frame';
  f.setAttribute('sandbox', 'allow-scripts allow-modals');
  f.setAttribute('referrerpolicy', 'no-referrer');
  f.setAttribute('title', t('livePreview'));
  f.src = '/sandbox/frame.html';
  const onMsg = (e) => {
    if (e.source !== f.contentWindow || !e.data || e.data.caf !== 'preview') return;
    if (e.data.type === 'ready') f.contentWindow.postMessage({ caf: 'render', html }, '*');
    else onConsole?.({ type: e.data.type === 'error' ? 'err' : e.data.type === 'warn' ? 'warn' : 'out', text: e.data.text });
  };
  window.addEventListener('message', onMsg);
  container.appendChild(f);
  return { frame: f, update(next) { html = next; f.src = '/sandbox/frame.html?' + Date.now(); }, destroy() { window.removeEventListener('message', onMsg); f.remove(); } };
}

export { errText };
