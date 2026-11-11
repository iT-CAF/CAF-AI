// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// الحماية: المضيف والأصل، رمز الجلسة المحلي، مفتاح الـ API، وسياسات CSP لكل نوع من الصفحات.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const { P } = require('./paths');
const { writeFileAtomic } = require('./fsx');

const st = { port: 0 };
const setPort = (p) => { st.port = p; };

// رمز جلسة جديد في كل تشغيل: يُحقن في الصفحة ويُرسل في ترويسة X-CAF-Token مع كل طلب API.
// مواقع أخرى لا تستطيع قراءته (سياسة نفس الأصل) فلا تستطيع استدعاء الواجهة ولو كان الخادم محليًا.
const SESSION_TOKEN = crypto.randomBytes(24).toString('hex');
const COOKIE = 'caf_t';

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function cookieToken(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`));
  return m ? m[1] : '';
}
const headerTokenOk = (req) => safeEqual(req.headers['x-caf-token'], SESSION_TOKEN);
const cookieTokenOk = (req) => safeEqual(cookieToken(req), SESSION_TOKEN);
const sessionCookie = () => `${COOKIE}=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Strict`;

function hostOk(req) {
  const h = (req.headers.host || '').toLowerCase();
  return h === `127.0.0.1:${st.port}` || h === `localhost:${st.port}`;
}
function originOk(req) {
  const o = req.headers.origin;
  if (!o) return true;
  return o === `http://127.0.0.1:${st.port}` || o === `http://localhost:${st.port}`;
}

// مفتاح الـ API المحلي (‎/v1‎): يُولَّد مرة واحدة ويُحفظ في CAF_HOME
function apiKey() {
  try { const k = fs.readFileSync(P.apiKey, 'utf8').trim(); if (/^caf-[a-f0-9]{40}$/.test(k)) return k; } catch { /* */ }
  const k = 'caf-' + crypto.randomBytes(20).toString('hex');
  writeFileAtomic(P.apiKey, k + '\n');
  try { fs.chmodSync(P.apiKey, 0o600); } catch { /* ويندوز */ }
  return k;
}
function rotateApiKey() { try { fs.unlinkSync(P.apiKey); } catch { /* */ } return apiKey(); }
function bearerOk(req) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i);
  return !!m && safeEqual(m[1], apiKey());
}

// ---- سياسات CSP ----
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin' };

// الواجهة الرئيسية: لا سكربت مضمّن، لا شبكة خارجية، والإطارات من نفس الأصل فقط (المعاينة المعزولة)
const CSP_APP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; font-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// عامل تشغيل JavaScript: يُسمح بـ eval لتشغيل كود المستخدم فقط، وممنوع أي اتصال شبكة
const CSP_JS_WORKER = "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'";

// عامل Pyodide: يحمّل ملفاته من ‎/runtime/‎ فقط (Pyodide وأدوات المكتب)، ولا اتصال بأي مسار آخر
const cspPyWorker = (host) => `default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' http://${host}/runtime/; connect-src http://${host}/runtime/`;

// إطار المعاينة الحية: أصل معتم (sandbox بدون allow-same-origin)، بلا شبكة، ويُضمَّن من الواجهة فقط
const CSP_SANDBOX = "sandbox allow-scripts allow-modals; default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'unsafe-inline' blob: data:; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'";

const appHeaders = () => ({ ...BASE_HEADERS, 'X-Frame-Options': 'DENY', 'Content-Security-Policy': CSP_APP });

module.exports = {
  setPort, SESSION_TOKEN, sessionCookie, headerTokenOk, cookieTokenOk, hostOk, originOk,
  apiKey, rotateApiKey, bearerOk, BASE_HEADERS, CSP_APP, CSP_JS_WORKER, cspPyWorker, CSP_SANDBOX, appHeaders, getPort: () => st.port,
};
