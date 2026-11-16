// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// الوصول من الشبكة المحلية: فتح كآف AI من الجوال أو أي جهاز على نفس شبكة Wi-Fi.
//
// التصميم:
//  - الخادم الرئيسي يبقى على 127.0.0.1 كما هو. عند التفعيل فقط نفتح مستمعًا إضافيًا على كل عنوان شبكة خاص
//    (10.x · 172.16–31.x · 192.168.x · 100.64/10) بنفس المنفذ، ونغلقه فورًا عند الإيقاف. لا استماع على عنوان عام.
//  - أي جهاز من الشبكة «ضيف» حتى يُقرَن: بمسح رمز QR متجدد يظهر على هذا الجهاز، أو بطلب وصول يوافق عليه المالك.
//  - الجهاز المقترن يحمل Cookie ‏HttpOnly; SameSite=Strict فيه معرّف + سر؛ نحفظ بصمة SHA-256 للسر فقط.
//    الإلغاء فوري: كل طلب يُتحقق منه مقابل القائمة.
//  - إدارة الوصول (التشغيل/الإيقاف، الموافقة، إزالة الأجهزة) وإيقاف كآف AI من هذا الجهاز فقط.
'use strict';
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { P } = require('./paths');
const { readJsonFile, writeJsonAtomic } = require('./fsx');
const log = require('./log');

const CODE_TTL = 5 * 60_000;      // رمز QR يتجدد كل 5 دقائق وبعد كل استخدام
const REQ_TTL = 3 * 60_000;       // طلب الوصول ينتهي بعد 3 دقائق
const ONLINE_MS = 45_000;         // «متصل الآن» إن ظهر خلال 45 ثانية
const MAX_DEVICES = 24;
const MAX_PENDING = 6;
const COOKIE = 'caf_d';
const RESCAN_MS = 5000;           // تغيّر الشبكة (Wi-Fi آخر، نقطة اتصال) يُكتشف تلقائيًا

const st = {
  enabled: false, port: 0, handler: null, servers: new Map(), timer: null,
  devices: [], code: '', codeExp: 0, pending: new Map(), fails: new Map(),
  saveTimer: null, labels: {}, firewall: null,
};

// ---------- التخزين ----------
function load() {
  const j = readJsonFile(P.lan, {}) || {};
  st.enabled = j.enabled === true;
  st.devices = (Array.isArray(j.devices) ? j.devices : []).filter((d) => d && /^[a-f0-9]{16}$/.test(d.id) && /^[a-f0-9]{64}$/.test(d.hash)).slice(0, MAX_DEVICES);
}
function save() {
  clearTimeout(st.saveTimer); st.saveTimer = null;
  try { writeJsonAtomic(P.lan, { v: 1, enabled: st.enabled, devices: st.devices }); } catch (e) { log.error('lan save failed', { err: String(e) }); }
}
const saveSoon = () => { if (!st.saveTimer) { st.saveTimer = setTimeout(save, 30_000); st.saveTimer.unref?.(); } };

// ---------- عناوين الشبكة ----------
function isPrivateV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
const v4 = (ip) => String(ip || '').replace(/^::ffff:/i, '');
function kindOf(iface) {
  const label = (st.labels[iface] || iface).toLowerCase();
  if (/wi-?fi|wlan|wireless|airport|^wl/.test(label)) return 'wifi';
  if (/bridge|hotspot|ap\d|sharing/.test(label)) return 'hotspot';
  if (/utun|tun|tap|wg|tailscale|zerotier|vpn|ppp/.test(label)) return 'vpn';
  if (/ethernet|^en|^eth|lan|thunderbolt|usb/.test(label)) return 'ethernet';
  return 'other';
}
// كل عناوين IPv4 الحقيقية لهذا الجهاز (عدا الحلقة المحلية وعناوين 169.254 التلقائية)
function interfaces() {
  const out = [];
  for (const [iface, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal || a.address.startsWith('169.254.')) continue;
      out.push({ address: a.address, iface, label: st.labels[iface] || iface, kind: kindOf(iface), private: isPrivateV4(a.address) });
    }
  }
  const rank = { wifi: 0, ethernet: 1, hotspot: 2, other: 3, vpn: 4 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.iface.localeCompare(b.iface));
}
// العناوين التي نستمع عليها: الخاصة فقط (CAF_LAN_ADDRS للاختبارات)
function addresses() {
  if (process.env.CAF_LAN_ADDRS) return process.env.CAF_LAN_ADDRS.split(',').map((s) => s.trim()).filter(Boolean).map((address) => ({ address, iface: 'test', label: 'test', kind: 'other', private: true }));
  return interfaces().filter((a) => a.private);
}
let ownCache = { at: 0, set: new Set() };
function ownAddresses() {
  if (Date.now() - ownCache.at > 3000) ownCache = { at: Date.now(), set: new Set(interfaces().map((a) => a.address)) };
  return ownCache.set;
}
const lanPort = () => parseInt(process.env.CAF_LAN_PORT, 10) || st.port;

// أسماء المنافذ المفهومة على macOS (en1 → Wi-Fi) — مرة واحدة عند التشغيل
function loadLabels() {
  if (process.platform !== 'darwin') return;
  execFile('networksetup', ['-listallhardwareports'], { timeout: 4000 }, (err, out) => {
    if (err || !out) return;
    for (const m of String(out).matchAll(/Hardware Port:\s*(.+)\n\s*Device:\s*(\S+)/g)) st.labels[m[2]] = m[1].trim();
  });
}
// جدار حماية macOS قد يمنع الاتصالات الواردة لـ node حتى يوافق المستخدم
function checkFirewall() {
  if (process.platform !== 'darwin') return;
  execFile('/usr/libexec/ApplicationFirewall/socketfilterfw', ['--getglobalstate'], { timeout: 3000 }, (err, out) => {
    if (!err) st.firewall = { enabled: /enabled|State = [12]/i.test(String(out)) };
  });
}

// ---------- المستمعات ----------
function closeServer(addr) {
  const s = st.servers.get(addr); if (!s) return;
  st.servers.delete(addr);
  try { s.server.close(); s.server.closeAllConnections?.(); } catch { /* */ }
}
function sync() {
  if (!st.enabled || !st.port || !st.handler) { for (const a of [...st.servers.keys()]) closeServer(a); return Promise.resolve(); }
  const want = new Map(addresses().map((a) => [a.address, a]));
  for (const a of [...st.servers.keys()]) if (!want.has(a)) closeServer(a);
  const waits = [];
  for (const addr of want.keys()) {
    const cur = st.servers.get(addr);
    if (cur && (cur.listening || Date.now() - cur.at < 30_000)) continue; // خطأ سابق: نعيد المحاولة كل 30 ثانية
    if (cur) closeServer(addr);
    const server = http.createServer((req, res) => { req.cafLan = true; st.handler(req, res); });
    server.requestTimeout = 0; server.headersTimeout = 60000; server.keepAliveTimeout = 5000;
    const entry = { server, listening: false, error: null, at: Date.now() };
    st.servers.set(addr, entry);
    waits.push(new Promise((resolve) => {
      server.once('error', (e) => { entry.error = e.code || String(e.message); log.warn('lan listen failed', { addr, err: entry.error }); resolve(); });
      server.listen(lanPort(), addr, () => { entry.listening = true; log.info('lan listening', { url: `http://${addr}:${lanPort()}` }); resolve(); });
    }));
  }
  return Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 2500))]);
}
function startTimer() {
  if (st.timer) return;
  st.timer = setInterval(() => { sync(); prune(); }, RESCAN_MS); st.timer.unref?.();
}
function stopTimer() { clearInterval(st.timer); st.timer = null; }

async function init({ port, handler }) {
  st.port = port; st.handler = handler;
  load(); loadLabels(); checkFirewall();
  if (st.enabled) { await sync(); startTimer(); }
}
async function setEnabled(on) {
  st.enabled = !!on;
  if (!st.enabled) { st.pending.clear(); st.code = ''; }
  save();
  await sync();
  if (st.enabled) { startTimer(); checkFirewall(); } else stopTimer();
}
function stop() { stopTimer(); for (const a of [...st.servers.keys()]) closeServer(a); if (st.saveTimer) save(); }
// روابط الشبكة الفعّالة (للطرفية والواجهة)
const urls = () => [...st.servers.entries()].filter(([, s]) => s.listening).map(([a]) => `http://${a}:${lanPort()}`);

// ---------- التحقق من الطلبات ----------
// المضيف على مستمع الشبكة يجب أن يكون أحد عناويننا الفعلية بالمنفذ نفسه (حماية من DNS rebinding)
function hostOk(req) {
  if (!req.cafLan) return false;
  const h = String(req.headers.host || '').toLowerCase();
  const m = h.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
  return !!m && Number(m[2]) === lanPort() && !!st.servers.get(m[1])?.listening;
}
const safeEqual = (a, b) => { const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function cookieValue(req) {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{16})\\.([A-Za-z0-9_-]{43})`));
  return m ? { id: m[1], secret: m[2] } : null;
}
const hasCookie = (req) => new RegExp(`(?:^|;\\s*)${COOKIE}=`).test(String(req.headers.cookie || ''));
function deviceOf(req) {
  const c = cookieValue(req); if (!c) return null;
  const d = st.devices.find((x) => x.id === c.id);
  return d && safeEqual(d.hash, sha(c.secret)) ? d : null;
}
// owner: هذا الجهاز (الحلقة المحلية أو أحد عناوينه) · device: جهاز مقترن · guest: غير مقترن
function classify(req) {
  if (!req.cafLan) return 'owner';
  const ip = v4(req.socket.remoteAddress);
  if (ownAddresses().has(ip)) return 'owner';
  const d = deviceOf(req);
  if (d) {
    req.cafDevice = d;
    const now = Date.now();
    if (d.ip !== ip || now - (d.lastSeen || 0) > 60_000) saveSoon();
    d.lastSeen = now; d.ip = ip;
    return 'device';
  }
  return 'guest';
}

// ---------- الاقتران ----------
const cookieFor = (id, secret) => `${COOKIE}=${id}.${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`;
const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

function cleanName(s, fallback) {
  const n = String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return n || fallback;
}
// اسم مقترح ونوع الجهاز من User-Agent
function guess(ua = '') {
  let name = 'Device'; let kind = 'other';
  if (/iPad/.test(ua)) { name = 'iPad'; kind = 'tablet'; }
  else if (/iPhone|iPod/.test(ua)) { name = 'iPhone'; kind = 'mobile'; }
  else if (/Android/.test(ua)) { name = 'Android'; kind = /Mobile/.test(ua) ? 'mobile' : 'tablet'; }
  else if (/Macintosh/.test(ua)) { name = 'Mac'; kind = /Mobile\//.test(ua) ? 'tablet' : 'desktop'; }
  else if (/Windows/.test(ua)) { name = 'Windows'; kind = 'desktop'; }
  else if (/CrOS/.test(ua)) { name = 'Chromebook'; kind = 'desktop'; }
  else if (/Linux/.test(ua)) { name = 'Linux'; kind = 'desktop'; }
  const br = /EdgiOS|Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return { name: br ? `${name} · ${br}` : name, kind };
}
function addDevice({ name, ua, ip }) {
  const g = guess(ua);
  const id = crypto.randomBytes(8).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const d = { id, name: cleanName(name, g.name), kind: g.kind, hash: sha(secret), created: Date.now(), lastSeen: Date.now(), ip };
  st.devices.unshift(d);
  if (st.devices.length > MAX_DEVICES) st.devices.length = MAX_DEVICES; // الأقدم يُزال
  save();
  log.info('lan device paired', { id, name: d.name, ip });
  return { device: d, cookie: cookieFor(id, secret) };
}
function currentCode() {
  if (!st.code || Date.now() > st.codeExp) rotateCode();
  return { code: st.code, expires: st.codeExp };
}
function rotateCode() { st.code = crypto.randomBytes(12).toString('base64url'); st.codeExp = Date.now() + CODE_TTL; }

// محاولات خاطئة كثيرة من نفس العنوان: إيقاف مؤقت
function limited(ip) { const f = st.fails.get(ip); return !!f && f.n >= 8 && Date.now() < f.until; }
function failed(ip) { const f = st.fails.get(ip) || { n: 0, until: 0 }; if (Date.now() > f.until) f.n = 0; f.n++; f.until = Date.now() + 5 * 60_000; st.fails.set(ip, f); }

function pairWithCode(req, { code, name }) {
  const ip = v4(req.socket.remoteAddress);
  if (!st.enabled) return { error: 'lan_disabled', status: 403 };
  if (limited(ip)) return { error: 'rate_limited', status: 429 };
  if (!st.code || Date.now() > st.codeExp || !safeEqual(code, st.code)) { failed(ip); return { error: 'bad_code', status: 403 }; }
  rotateCode(); // رمز لمرة واحدة: صورة الشاشة لا تكفي لجهاز ثانٍ
  return addDevice({ name, ua: req.headers['user-agent'], ip });
}
function createRequest(req, { name }) {
  const ip = v4(req.socket.remoteAddress);
  if (!st.enabled) return { error: 'lan_disabled', status: 403 };
  prune();
  for (const r of st.pending.values()) if (r.ip === ip && r.status === 'pending') st.pending.delete(r.id); // طلب واحد لكل جهاز
  if ([...st.pending.values()].filter((r) => r.status === 'pending').length >= MAX_PENDING) return { error: 'too_many_requests', status: 429 };
  const g = guess(req.headers['user-agent']);
  const r = { id: crypto.randomBytes(8).toString('hex'), secret: crypto.randomBytes(24).toString('base64url'), name: cleanName(name, g.name), kind: g.kind, ip, ua: String(req.headers['user-agent'] || '').slice(0, 200), created: Date.now(), status: 'pending' };
  st.pending.set(r.id, r);
  log.info('lan access requested', { id: r.id, name: r.name, ip });
  return { id: r.id, secret: r.secret, name: r.name };
}
function pollRequest(req, id, secret) {
  prune();
  const r = st.pending.get(id);
  if (!r || !safeEqual(r.secret, secret)) return { status: 'expired' };
  if (r.status === 'approved') {
    st.pending.delete(id);
    const out = addDevice({ name: r.name, ua: req.headers['user-agent'], ip: v4(req.socket.remoteAddress) });
    return { status: 'approved', cookie: out.cookie };
  }
  if (r.status === 'denied') { st.pending.delete(id); return { status: 'denied' }; }
  return { status: 'pending' };
}
function decide(id, approve) {
  const r = st.pending.get(id);
  if (!r || r.status !== 'pending') return false;
  r.status = approve ? 'approved' : 'denied'; r.decided = Date.now();
  log.info(approve ? 'lan request approved' : 'lan request denied', { id, name: r.name });
  return true;
}
function prune() {
  const now = Date.now();
  for (const [id, r] of st.pending) if (now - r.created > REQ_TTL && now - (r.decided || r.created) > 60_000) st.pending.delete(id);
  for (const [ip, f] of st.fails) if (now > f.until) st.fails.delete(ip);
}

// ---------- الأجهزة ----------
const publicDevice = (d, now = Date.now()) => ({ id: d.id, name: d.name, kind: d.kind, ip: d.ip, created: d.created, lastSeen: d.lastSeen, online: now - (d.lastSeen || 0) < ONLINE_MS });
function revoke(id) { const n = st.devices.length; st.devices = st.devices.filter((d) => d.id !== id); if (st.devices.length !== n) { save(); log.info('lan device removed', { id }); return true; } return false; }
function revokeAll() { st.devices = []; save(); log.info('lan devices cleared'); }
function rename(id, name) { const d = st.devices.find((x) => x.id === id); if (!d) return false; d.name = cleanName(name, d.name); save(); return true; }
const pendingList = () => [...st.pending.values()].filter((r) => r.status === 'pending').map((r) => ({ id: r.id, name: r.name, kind: r.kind, ip: r.ip, created: r.created }));

function status(req) {
  const role = req.cafRole || classify(req);
  if (role === 'device') {
    const d = req.cafDevice;
    return { role, enabled: st.enabled, port: lanPort(), host: String(req.headers.host || ''), me: d ? publicDevice(d) : null };
  }
  prune();
  const now = Date.now();
  const listen = addresses().map((a) => {
    const s = st.servers.get(a.address);
    return { ...a, url: `http://${a.address}:${lanPort()}`, listening: !!s?.listening, error: s?.error || null };
  });
  const all = interfaces();
  return {
    role, enabled: st.enabled, port: lanPort(), addresses: listen,
    // عناوين عامة لا نستمع عليها (لعرض السبب فقط)
    skipped: all.filter((a) => !a.private).map((a) => ({ address: a.address, iface: a.iface, label: a.label })),
    pair: st.enabled ? currentCode() : null, codeTtl: CODE_TTL,
    devices: st.devices.map((d) => publicDevice(d, now)), pending: pendingList(),
    firewall: st.firewall, platform: process.platform,
  };
}
// نبض خفيف للواجهة على هذا الجهاز: طلبات بانتظار الموافقة وعدد المتصلين
function pulse() {
  if (!st.enabled) return { enabled: false, pending: [], online: 0 };
  prune();
  const now = Date.now();
  return { enabled: true, pending: pendingList(), online: st.devices.filter((d) => now - (d.lastSeen || 0) < ONLINE_MS).length };
}

module.exports = {
  init, stop, setEnabled, sync, urls, hostOk, classify, hasCookie, status, pulse, currentCode, rotateCode,
  pairWithCode, createRequest, pollRequest, decide, revoke, revokeAll, rename, clearCookie, isPrivateV4, guess,
  enabled: () => st.enabled,
};
