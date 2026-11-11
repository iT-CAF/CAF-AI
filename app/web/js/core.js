/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// الأساسيات المشتركة: الحالة، الترجمة، الاتصال بالخادم، أدوات DOM.

export const state = {
  settings: null, info: null, models: [], chats: [], chat: null, streaming: false, abort: null, filter: '',
  workspace: 'chat', view: 'chat', hardware: null, catalog: null, providers: [], pending: [],
};

export const $ = (id) => document.getElementById(id);
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export const lang = () => state.settings?.lang || 'ar';
export const t = (k, vars) => {
  let s = window.I18N[lang()][k] ?? window.I18N.ar[k] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(b);
  return s;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ic = (name, cls = '') => `<span class="ic ${cls}" style="--i:url(/brand/icons/${name}.svg)" aria-hidden="true"></span>`;
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2)).toLowerCase();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const TOKEN = document.querySelector('meta[name="caf-token"]')?.content || '';
export const authHeaders = (extra) => ({ 'X-CAF-Token': TOKEN, ...(extra || {}) });

// أُعيد تشغيل كآف AI (رمز جلسة جديد): نحدّث الصفحة مرة واحدة تلقائيًا
function sessionExpired() {
  const last = Number(sessionStorage.getItem('caf-reload') || 0);
  if (Date.now() - last < 15000) return;
  sessionStorage.setItem('caf-reload', String(Date.now()));
  setTimeout(() => location.reload(), 300);
}

export class ApiError extends Error {
  constructor(code, status, data) { super(code); this.code = code; this.status = status; this.data = data || {}; }
}

export async function api(method, url, body, { signal, raw } = {}) {
  const isBin = body instanceof Blob || body instanceof ArrayBuffer;
  const r = await fetch(url, {
    method, signal,
    headers: authHeaders(body && !isBin ? { 'Content-Type': 'application/json' } : body instanceof Blob ? { 'Content-Type': body.type || 'application/octet-stream' } : {}),
    body: body === undefined ? undefined : isBin ? body : JSON.stringify(body),
  });
  if (r.status === 401) sessionExpired();
  if (raw) return r;
  let data = null;
  try { data = await r.json(); } catch { /* */ }
  if (!r.ok) throw new ApiError(data?.error || `http_${r.status}`, r.status, data);
  return data;
}

// قراءة بث NDJSON سطرًا سطرًا
export async function readNdjson(response, onLine) {
  const reader = response.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (line.trim()) onLine(JSON.parse(line));
    }
  }
  buf += dec.decode();
  if (buf.trim()) onLine(JSON.parse(buf));
}

// رسالة خطأ مفهومة بلغة الواجهة من رمز الخطأ
export function errText(e) {
  const code = typeof e === 'string' ? e : e?.code || e?.message || '';
  const k = 'err_' + code;
  const msg = t(k);
  if (msg !== k) return msg;
  if (e?.name === 'TypeError' || /Failed to fetch|NetworkError/i.test(String(e?.message))) return t('err_server_down');
  return code ? `${t('err_generic')} (${code})` : t('err_generic');
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const el = $('toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

export const fmtBytes = (n) => {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 3 ? 1 : 0)} ${u[i]}`;
};
export const fmtGB = (n) => `${Number(n).toFixed(1)} GB`;

// ناشر أحداث بسيط بين الوحدات
const bus = new Map();
export const on = (ev, fn) => { if (!bus.has(ev)) bus.set(ev, new Set()); bus.get(ev).add(fn); };
export const emit = (ev, ...a) => { for (const fn of bus.get(ev) || []) { try { fn(...a); } catch (e) { console.error(e); } } };

// تحميل سكربت/وحدة محلية مرة واحدة (المكتبات في /vendor)
const loaded = new Map();
export function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => resolve(); s.onerror = () => { loaded.delete(src); reject(new Error('load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return loaded.get(src);
}
export function loadCss(href) {
  if (loaded.has(href)) return loaded.get(href);
  const p = new Promise((resolve) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = resolve; l.onerror = resolve; document.head.appendChild(l); });
  loaded.set(href, p); return p;
}
export const VER = () => state.info?.version || '';

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// نافذة تأكيد بنفس هوية الواجهة (بديل confirm)
export function confirmBox(message, { ok = t('ok'), cancel = t('cancel'), danger = false } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'mini-dlg';
    d.innerHTML = `<form method="dialog"><p>${esc(message)}</p><div class="row end"><button value="0" class="btn">${esc(cancel)}</button><button value="1" class="btn ${danger ? 'danger' : 'primary'}" autofocus>${esc(ok)}</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { resolve(d.returnValue === '1'); d.remove(); });
    d.showModal();
  });
}
export function promptBox(message, value = '') {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'mini-dlg';
    d.innerHTML = `<form method="dialog"><label class="field"><span>${esc(message)}</span><input name="v" dir="auto" value="${esc(value)}" autocomplete="off"></label><div class="row end"><button value="0" class="btn" formnovalidate>${esc(t('cancel'))}</button><button value="1" class="btn primary">${esc(t('ok'))}</button></div></form>`;
    document.body.appendChild(d);
    const input = d.querySelector('input');
    d.addEventListener('close', () => { resolve(d.returnValue === '1' ? input.value : null); d.remove(); });
    d.showModal(); input.select();
  });
}
