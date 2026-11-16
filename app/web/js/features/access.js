/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// «الوصول»: افتح كآف AI من الجوال أو أي جهاز على نفس شبكة Wi-Fi.
//  - على هذا الكمبيوتر: تشغيل/إيقاف، العنوان ورمز QR، الموافقة على الطلبات، الأجهزة المقترنة.
//  - على الجوال: معلومات الاتصال وفصل الجهاز.
//  - في الحالتين: مزامنة قائمة المحادثات والمحادثة المفتوحة بين الأجهزة.
import { state, $, t, esc, ic, api, toast, confirmBox, promptBox, errText, pages, on, emit, lang, CLIENT } from '../core.js';
import { qrSvg } from '../qr.js';
import { loadChats, renderMessages } from '../chat.js';

window.I18N_ADD({
  ar: {
    access: 'الوصول', accessTitle: 'الوصول من الشبكة',
    accessSub: 'افتح كآف AI من جوالك أو أي جهاز على نفس شبكة Wi-Fi، وتحكّم بكل شيء من هناك — محادثاتك تبقى محفوظة على هذا الكمبيوتر.',
    acOn: 'متاح على الشبكة', acOff: 'متوقف',
    acToggle: 'السماح بالوصول من الشبكة المحلية', acToggleHint: 'عند الإيقاف لا يرى أي جهاز في الشبكة كآف AI إطلاقًا. كل جهاز جديد يحتاج موافقتك مرة واحدة.',
    acScan: 'امسح بكاميرا الجوال', acScanNote: 'الرمز يربط الجهاز مباشرة بلا انتظار، ويصلح لجهاز واحد فقط ثم يتجدد. لا تشاركه.',
    acCodeExp: 'يتجدد الرمز خلال {t}', acNewCode: 'رمز جديد',
    acAddress: 'عنوان كآف AI على الشبكة', acAddressHint: 'أو افتح هذا العنوان من متصفح أي جهاز متصل بنفس الشبكة.',
    acStep1: 'اتصل بنفس شبكة Wi-Fi التي يتصل بها هذا الكمبيوتر.', acStep2: 'امسح الرمز، أو افتح العنوان واضغط «طلب الوصول».', acStep3: 'وافق على الطلب هنا — ويفتح كآف AI على الجوال فورًا.',
    acNetworks: 'الشبكة', acKind_wifi: 'Wi-Fi', acKind_ethernet: 'شبكة سلكية', acKind_hotspot: 'نقطة اتصال', acKind_vpn: 'VPN', acKind_other: 'شبكة محلية',
    acListenErr: 'تعذّر فتح المنفذ ({code})', acNoNetTitle: 'لا توجد شبكة محلية', acNoNet: 'هذا الكمبيوتر غير متصل بشبكة Wi-Fi أو شبكة محلية الآن. اتصل بشبكة وسيظهر العنوان تلقائيًا.',
    acOffTitle: 'كآف AI يعمل على هذا الكمبيوتر فقط', acOffBody: 'فعّل الوصول بالأعلى ليظهر رمز QR والعنوان، ثم امسحه من جوالك.', acWillBe: 'العنوان على شبكتك',
    acDevices: 'الأجهزة المقترنة', acNoDevices: 'لا توجد أجهزة مقترنة بعد. أول جهاز يمسح الرمز أو توافق على طلبه سيظهر هنا.',
    acOnline: 'متصل الآن', acSeen: 'آخر ظهور {ago}', acSince: 'منذ {date}',
    acRename: 'إعادة التسمية', acRevoke: 'إزالة', acRevokeAll: 'إزالة الكل',
    acRevokeConfirm: 'إزالة «{name}»؟ سيُفصل فورًا ويحتاج موافقة جديدة للعودة.', acRevokeAllConfirm: 'إزالة كل الأجهزة المقترنة؟ ستُفصل جميعها فورًا.', acRevoked: 'تمت إزالة الجهاز',
    acSecurity: 'الأمان والخصوصية',
    acTip1: 'كل جهاز يحتاج مرة واحدة فقط: مسح الرمز أو موافقتك على طلبه. ويمكنك إزالته في أي وقت فيُفصل فورًا.',
    acTip2: 'استخدمه في شبكة تثق بها كالمنزل أو العمل؛ الاتصال داخل الشبكة عبر HTTP غير مشفّر.',
    acTip3: 'الجهاز المقترن يرى المحادثات ويستخدم كل المزايا. إيقاف كآف AI وإدارة الوصول من هذا الكمبيوتر فقط.',
    acTip4: 'على الجوال: الإدخال الصوتي يتطلب اتصالًا آمنًا (HTTPS) فلا يعمل عبر الشبكة؛ بقية المزايا كلها تعمل.',
    acFirewall: 'جدار حماية macOS مفعّل: إن سألك «هل تسمح لـ node باستقبال اتصالات واردة؟» فاختر «السماح». وإن لم يفتح الجوال الرابط فراجع: إعدادات النظام › الشبكة › جدار الحماية › الخيارات.',
    acFirewallWin: 'إن ظهرت نافذة جدار حماية Windows فاسمح لـ Node.js على «الشبكات الخاصة».',
    acReqTitle: 'طلب وصول جديد', acReqSub: 'يريد فتح كآف AI عبر الشبكة', acAllow: 'سماح', acDeny: 'رفض', acAllowed: 'تم السماح لـ {name}', acDenied: 'تم رفض الطلب',
    acEnabled: 'كآف AI متاح الآن على الشبكة', acDisabled: 'أُوقف الوصول من الشبكة',
    acConnected: 'متصل عبر الشبكة', acDevSub: 'أنت تستخدم كآف AI من هذا الجهاز عبر الشبكة المحلية. كل شيء يعمل ويُحفظ على الكمبيوتر الرئيسي.',
    acThisDevice: 'هذا الجهاز', acHost: 'الكمبيوتر الرئيسي', acDevCan: 'من هذا الجهاز',
    acDevCan1: 'كل المحادثات، والبرمجة والصور والمستندات — بنفس النماذج والإعدادات.', acDevCan2: 'ما تكتبه هنا يظهر على الكمبيوتر تلقائيًا، والعكس.', acDevCan3: 'إدارة الأجهزة وإيقاف كآف AI متاحة من الكمبيوتر الرئيسي فقط.',
    acLeave: 'فصل هذا الجهاز', acLeaveConfirm: 'فصل هذا الجهاز؟ ستحتاج مسح الرمز أو موافقة جديدة للعودة.',
    micInsecure: 'الإدخال الصوتي يحتاج اتصالًا آمنًا (HTTPS)، فلا يعمل عند فتح كآف AI عبر الشبكة. استخدمه من الكمبيوتر.',
    err_owner_only: 'هذا الإجراء متاح من الكمبيوتر الرئيسي فقط.', err_device_unpaired: 'هذا الجهاز غير مقترن.', err_request_expired: 'انتهت مهلة هذا الطلب.',
    err_lan_api_blocked: 'الواجهة البرمجية متاحة لتطبيقات هذا الكمبيوتر فقط.',
  },
  en: {
    access: 'Access', accessTitle: 'Network access',
    accessSub: 'Open CAF AI from your phone or any device on the same Wi-Fi and control everything from there — your chats stay on this computer.',
    acOn: 'On the network', acOff: 'Off',
    acToggle: 'Allow access from the local network', acToggleHint: 'When off, no device on the network can see CAF AI at all. Every new device needs your approval once.',
    acScan: 'Scan with your phone camera', acScanNote: 'The code pairs a device instantly, works for one device only, then renews. Don’t share it.',
    acCodeExp: 'Code renews in {t}', acNewCode: 'New code',
    acAddress: 'CAF AI’s network address', acAddressHint: 'Or open this address in the browser of any device on the same network.',
    acStep1: 'Join the same Wi-Fi network as this computer.', acStep2: 'Scan the code, or open the address and tap “Request access”.', acStep3: 'Approve the request here — CAF AI opens on the phone instantly.',
    acNetworks: 'Network', acKind_wifi: 'Wi-Fi', acKind_ethernet: 'Wired network', acKind_hotspot: 'Hotspot', acKind_vpn: 'VPN', acKind_other: 'Local network',
    acListenErr: 'Could not open the port ({code})', acNoNetTitle: 'No local network', acNoNet: 'This computer is not on a Wi-Fi or local network right now. Connect to one and the address appears automatically.',
    acOffTitle: 'CAF AI runs on this computer only', acOffBody: 'Turn access on above to show the QR code and address, then scan it with your phone.', acWillBe: 'Your network address',
    acDevices: 'Paired devices', acNoDevices: 'No paired devices yet. The first device that scans the code or that you approve appears here.',
    acOnline: 'Online now', acSeen: 'Last seen {ago}', acSince: 'since {date}',
    acRename: 'Rename', acRevoke: 'Remove', acRevokeAll: 'Remove all',
    acRevokeConfirm: 'Remove “{name}”? It is disconnected immediately and needs a new approval to come back.', acRevokeAllConfirm: 'Remove all paired devices? They are all disconnected immediately.', acRevoked: 'Device removed',
    acSecurity: 'Security & privacy',
    acTip1: 'Each device needs this only once: scan the code or get your approval. Remove it any time and it is disconnected immediately.',
    acTip2: 'Use it on a network you trust, like home or work; traffic inside the network is plain HTTP, not encrypted.',
    acTip3: 'A paired device sees your chats and uses every feature. Quitting CAF AI and managing access stay on this computer.',
    acTip4: 'On the phone: voice input needs a secure (HTTPS) connection, so it doesn’t work over the network; everything else does.',
    acFirewall: 'The macOS firewall is on: if asked “Do you want node to accept incoming network connections?”, choose Allow. If the phone can’t open the link, check System Settings › Network › Firewall › Options.',
    acFirewallWin: 'If a Windows Firewall prompt appears, allow Node.js on “Private networks”.',
    acReqTitle: 'New access request', acReqSub: 'wants to open CAF AI over the network', acAllow: 'Allow', acDeny: 'Decline', acAllowed: '{name} is allowed', acDenied: 'Request declined',
    acEnabled: 'CAF AI is now available on the network', acDisabled: 'Network access turned off',
    acConnected: 'Connected over the network', acDevSub: 'You are using CAF AI from this device over the local network. Everything runs and is saved on the main computer.',
    acThisDevice: 'This device', acHost: 'Main computer', acDevCan: 'From this device',
    acDevCan1: 'All chats, coding, images and documents — same models and settings.', acDevCan2: 'What you write here shows up on the computer automatically, and vice versa.', acDevCan3: 'Managing devices and quitting CAF AI stay on the main computer.',
    acLeave: 'Disconnect this device', acLeaveConfirm: 'Disconnect this device? You will need to scan the code or get a new approval to come back.',
    micInsecure: 'Voice input needs a secure (HTTPS) connection, so it doesn’t work when CAF AI is opened over the network. Use it on the computer.',
    err_owner_only: 'This action is only available on the main computer.', err_device_unpaired: 'This device is not paired.', err_request_expired: 'This request expired.',
    err_lan_api_blocked: 'The API is available to apps on this computer only.',
  },
});

const KIND_IC = { mobile: 'mobile', tablet: 'tablet', desktop: 'desktop', other: 'device' };
const NET_IC = { wifi: 'wifi', ethernet: 'globe', hotspot: 'wifi', vpn: 'lock', other: 'globe' };
const isDevice = CLIENT === 'device';

let st = null;          // آخر حالة من ‎/api/lan‎
let pick = '';          // العنوان المختار لرمز QR عند وجود أكثر من شبكة
let pageTimer = null; let tickTimer = null; let busy = false;
let syncTimer = null; let ticking = false; let rev = null; let lanOn = false;
const sig = {};         // آخر HTML لكل جزء: لا نعيد الرسم إلا عند التغيّر
const reqCards = new Map();

const loc = () => (lang() === 'ar' ? 'ar' : 'en');
function fmtAgo(ts) {
  const s = Math.round(((ts || 0) - Date.now()) / 1000); const a = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
  return a < 90 ? rtf.format(-1, 'minute') : a < 3600 ? rtf.format(Math.round(s / 60), 'minute') : a < 86400 ? rtf.format(Math.round(s / 3600), 'hour') : rtf.format(Math.round(s / 86400), 'day');
}
const fmtDate = (ts) => new Date(ts || Date.now()).toLocaleDateString(loc(), { day: 'numeric', month: 'short', year: 'numeric' });
const netLabel = (a) => (a.kind === 'wifi' ? 'Wi-Fi' : a.label && a.label !== a.iface ? a.label : t('acKind_' + a.kind));
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// ---------- صفحة الكمبيوتر الرئيسي ----------
function chosen() {
  const live = (st?.addresses || []).filter((a) => a.listening);
  return live.find((a) => a.address === pick) || live[0] || null;
}
function bodyHtml() {
  const addrs = st.addresses;
  if (!addrs.length) return `<section class="card ac-empty">${ic('wifioff')}<div><b>${esc(t('acNoNetTitle'))}</b><p>${esc(t('acNoNet'))}</p></div></section>`;
  if (!st.enabled) {
    return `<section class="card ac-off"><span class="ac-off-ic">${ic('wifioff')}</span><div><b>${esc(t('acOffTitle'))}</b><p>${esc(t('acOffBody'))}</p>
      <p class="ac-preview"><small>${esc(t('acWillBe'))}</small><code dir="ltr">${esc(addrs[0].url)}</code></p></div></section>`;
  }
  const a = chosen();
  if (!a) return `<section class="card ac-empty">${ic('alert')}<div><b>${esc(t('acNoNetTitle'))}</b>${addrs.map((x) => `<p><code dir="ltr">${esc(x.address)}</code> — ${esc(x.error ? t('acListenErr', { code: x.error }) : t('loading'))}</p>`).join('')}</div></section>`;
  const pairUrl = `${a.url}/pair?c=${encodeURIComponent(st.pair?.code || '')}`;
  const nets = addrs.length > 1
    ? `<div class="ac-nets" role="radiogroup" aria-label="${esc(t('acNetworks'))}">${addrs.map((x) => `<button type="button" role="radio" aria-checked="${x.address === a.address}" data-addr="${esc(x.address)}" ${x.listening ? '' : 'disabled'}>${ic(NET_IC[x.kind] || 'globe')}<span>${esc(netLabel(x))}</span><code dir="ltr">${esc(x.address)}</code>${x.error ? `<small class="err">${esc(t('acListenErr', { code: x.error }))}</small>` : ''}</button>`).join('')}</div>`
    : `<p class="ac-net">${ic(NET_IC[a.kind] || 'globe')}<span>${esc(netLabel(a))}</span><code dir="ltr">${esc(a.iface)}</code></p>`;
  return `<div class="ac-grid">
    <section class="card ac-qr"><h2>${ic('qr')}<span>${esc(t('acScan'))}</span></h2>
      <div class="qr-tile">${qrSvg(pairUrl, { label: t('acScan') })}</div>
      <div class="ac-exp"><span id="acExp"></span><button type="button" class="btn small ghost" id="acRotate">${ic('refresh')}<span>${esc(t('acNewCode'))}</span></button></div>
      <p class="note">${esc(t('acScanNote'))}</p></section>
    <section class="card ac-addr"><h2>${ic('globe')}<span>${esc(t('acAddress'))}</span></h2>
      <div class="ac-url"><code dir="ltr" id="acUrl">${esc(a.url)}</code><button type="button" class="btn small" id="acCopy">${ic('copy')}<span>${esc(t('copy'))}</span></button></div>
      <p class="muted small">${esc(t('acAddressHint'))}</p>
      ${nets}
      <ol class="ac-steps">${['acStep1', 'acStep2', 'acStep3'].map((k, i) => `<li><span class="n">${i + 1}</span><span>${esc(t(k))}</span></li>`).join('')}</ol>
    </section></div>`;
}
function bindBody(el) {
  el.querySelector('#acRotate')?.addEventListener('click', async () => { try { st = await api('POST', '/api/lan/code'); update(); } catch (e) { toast(errText(e)); } });
  el.querySelector('#acCopy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText($('acUrl').textContent); toast(t('copied')); } catch { toast(t('err_generic')); } });
  el.querySelector('.ac-nets')?.addEventListener('click', (e) => { const b = e.target.closest('[data-addr]'); if (!b || b.disabled) return; pick = b.dataset.addr; update(); });
}
function devicesHtml() {
  const ds = st.devices || [];
  const rows = ds.map((d) => `<li class="ac-dev${d.online ? ' online' : ''}">
      <span class="dv-ic">${ic(KIND_IC[d.kind] || 'device')}<i class="dot"></i></span>
      <div class="dv-t"><b><bdi>${esc(d.name)}</bdi></b><small>${d.online ? `<span class="on">${esc(t('acOnline'))}</span>` : esc(t('acSeen', { ago: fmtAgo(d.lastSeen) }))} · <span dir="ltr">${esc(d.ip || '—')}</span> · ${esc(t('acSince', { date: fmtDate(d.created) }))}</small></div>
      <div class="dv-a"><button type="button" class="mini" data-ren="${esc(d.id)}" title="${esc(t('acRename'))}" aria-label="${esc(t('acRename'))}">${ic('edit')}</button><button type="button" class="mini" data-rev="${esc(d.id)}" title="${esc(t('acRevoke'))}" aria-label="${esc(t('acRevoke'))}">${ic('trash')}</button></div></li>`).join('');
  return `<h2>${ic('device')}<span>${esc(t('acDevices'))}</span><span class="count">${ds.length}</span>${ds.length > 1 ? `<button type="button" class="btn small ghost ac-rall" id="acRevokeAll">${ic('trash')}<span>${esc(t('acRevokeAll'))}</span></button>` : ''}</h2>
    ${ds.length ? `<ul class="ac-dev-list">${rows}</ul>` : `<p class="muted ac-none">${esc(t('acNoDevices'))}</p>`}`;
}
function bindDevices(el) {
  el.onclick = async (e) => {
    const ren = e.target.closest('[data-ren]'); const rev_ = e.target.closest('[data-rev]');
    if (e.target.closest('#acRevokeAll')) {
      if (!(await confirmBox(t('acRevokeAllConfirm'), { danger: true, ok: t('acRevokeAll') }))) return;
      try { await api('DELETE', '/api/lan/devices'); toast(t('acRevoked')); } catch (err) { toast(errText(err)); }
      return refreshStatus();
    }
    const d = (st.devices || []).find((x) => x.id === (ren || rev_)?.dataset[ren ? 'ren' : 'rev']);
    if (!d) return;
    if (ren) {
      const name = await promptBox(t('acRename'), d.name); if (name === null || !name.trim()) return;
      try { await api('PATCH', '/api/lan/devices/' + d.id, { name }); } catch (err) { toast(errText(err)); }
    } else {
      if (!(await confirmBox(t('acRevokeConfirm', { name: d.name }), { danger: true, ok: t('acRevoke') }))) return;
      try { await api('DELETE', '/api/lan/devices/' + d.id); toast(t('acRevoked')); } catch (err) { toast(errText(err)); }
    }
    refreshStatus();
  };
}
function tipsHtml() {
  const fw = st.platform === 'darwin' && st.firewall?.enabled ? t('acFirewall') : st.platform === 'win32' ? t('acFirewallWin') : '';
  return `<h2>${ic('shield')}<span>${esc(t('acSecurity'))}</span></h2>
    ${fw && st.enabled ? `<p class="ac-fw">${ic('alert')}<span>${esc(fw)}</span></p>` : ''}
    <ul class="ac-tip-list">${['acTip1', 'acTip2', 'acTip3', 'acTip4'].map((k) => `<li>${ic('check')}<span>${esc(t(k))}</span></li>`).join('')}</ul>`;
}
function part(id, html, bind) {
  const el = $(id); if (!el || sig[id] === html) return;
  sig[id] = html; el.innerHTML = html; bind?.(el);
}
function update() {
  if (!st || !$('acOn')) return;
  const live = st.enabled && st.addresses.some((a) => a.listening);
  $('acOn').checked = st.enabled;
  $('acState').className = 'ac-state ' + (live ? 'on' : 'off');
  $('acState').innerHTML = `<i></i><span>${esc(t(live ? 'acOn' : 'acOff'))}</span>`;
  $('acHeroIc').innerHTML = ic(st.enabled ? 'wifi' : 'wifioff');
  $('acHeroIc').classList.toggle('on', st.enabled);
  part('acBody', bodyHtml(), bindBody);
  part('acDevices', devicesHtml(), bindDevices);
  part('acTips', tipsHtml());
  updateExpiry();
}
function updateExpiry() {
  const el = $('acExp'); if (!el || !st?.pair) return;
  const left = Math.max(0, Math.ceil((st.pair.expires - Date.now()) / 1000));
  el.textContent = t('acCodeExp', { t: mmss(left) });
  if (left === 0) refreshStatus(); // الخادم يولّد رمزًا جديدًا تلقائيًا
}
async function refreshStatus() {
  if (busy || state.view !== 'access') return;
  busy = true;
  try { st = await api('GET', '/api/lan'); if (st.role === 'owner') { lanOn = st.enabled; update(); } } catch { /* */ } finally { busy = false; }
}
async function toggle(e) {
  const box = e.target; const want = box.checked; box.disabled = true;
  try { st = await api('PUT', '/api/lan', { enabled: want }); lanOn = st.enabled; toast(t(want ? 'acEnabled' : 'acDisabled')); syncSchedule(); }
  catch (err) { box.checked = !want; toast(errText(err)); }
  finally { box.disabled = false; update(); }
}
function drawOwner(v) {
  v.innerHTML = `<div class="page access-page">
    <header class="page-head"><div><h1>${esc(t('accessTitle'))}</h1><p class="lead">${esc(t('accessSub'))}</p></div><span class="ac-state" id="acState"></span></header>
    <section class="card ac-hero"><span class="ac-hero-ic" id="acHeroIc"></span>
      <label class="ac-hero-t" for="acOn"><b>${esc(t('acToggle'))}</b><small>${esc(t('acToggleHint'))}</small></label>
      <label class="switch ac-switch"><input type="checkbox" id="acOn"><span class="sw"></span></label></section>
    <div id="acBody"></div>
    <section class="card ac-devices" id="acDevices"></section>
    <section class="card ac-tips" id="acTips"></section>
  </div>`;
  $('acOn').onchange = toggle;
  for (const k of Object.keys(sig)) delete sig[k];
  update();
}

// ---------- صفحة الجوال (جهاز مقترن) ----------
function drawDevice(v) {
  const me = st.me || {};
  v.innerHTML = `<div class="page access-page">
    <header class="page-head"><div><h1>${esc(t('access'))}</h1><p class="lead">${esc(t('acDevSub'))}</p></div><span class="ac-state on"><i></i><span>${esc(t('acConnected'))}</span></span></header>
    <div class="ac-grid">
      <section class="card ac-me"><span class="dv-ic big">${ic(KIND_IC[me.kind] || 'device')}</span><div class="dv-t"><small>${esc(t('acThisDevice'))}</small><b><bdi>${esc(me.name || '')}</bdi></b><small><span dir="ltr">${esc(me.ip || '')}</span> · ${esc(t('acSince', { date: fmtDate(me.created) }))}</small></div></section>
      <section class="card ac-me"><span class="dv-ic big">${ic('desktop')}</span><div class="dv-t"><small>${esc(t('acHost'))}</small><b><bdi dir="ltr">http://${esc(st.host || location.host)}</bdi></b><small>CAF AI v${esc(state.info?.version || '')}</small></div></section>
    </div>
    <section class="card ac-tips"><h2>${ic('info')}<span>${esc(t('acDevCan'))}</span></h2><ul class="ac-tip-list">${['acDevCan1', 'acDevCan2', 'acDevCan3'].map((k) => `<li>${ic('check')}<span>${esc(t(k))}</span></li>`).join('')}</ul></section>
    <button type="button" class="btn danger" id="acLeave">${ic('close')}<span>${esc(t('acLeave'))}</span></button>
  </div>`;
  $('acLeave').onclick = async () => {
    if (!(await confirmBox(t('acLeaveConfirm'), { danger: true, ok: t('acLeave') }))) return;
    try { await api('DELETE', '/api/lan/me'); } catch { /* */ }
    location.replace('/pair');
  };
}

async function render() {
  const v = $('viewAccess');
  if (!st) v.innerHTML = `<div class="page access-page"><div class="loading">${esc(t('loading'))}</div></div>`;
  try { st = await api('GET', '/api/lan'); } catch (e) { v.innerHTML = `<div class="page access-page"><p class="loading">${esc(errText(e))}</p></div>`; return; }
  if (st.role === 'device') return drawDevice(v);
  lanOn = st.enabled; syncSchedule();
  drawOwner(v);
  stopPagePoll();
  pageTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshStatus(); }, 3000);
  tickTimer = setInterval(updateExpiry, 1000);
}
function stopPagePoll() { clearInterval(pageTimer); clearInterval(tickTimer); pageTimer = null; tickTimer = null; }

// ---------- طلبات الوصول (بطاقات تظهر في أي صفحة على الكمبيوتر) ----------
const baseTitle = () => (lang() === 'ar' ? 'كآف AI · CAF AI' : 'CAF AI · iT CAF');
function showRequests(list) {
  const ids = new Set(list.map((r) => r.id));
  for (const [id, el] of reqCards) if (!ids.has(id)) { el.remove(); reqCards.delete(id); }
  for (const r of list) {
    if (reqCards.has(r.id)) continue;
    let box = $('lanReqs');
    if (!box) { box = document.createElement('div'); box.id = 'lanReqs'; box.className = 'lan-reqs'; box.setAttribute('aria-live', 'assertive'); document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'lan-req'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', t('acReqTitle'));
    el.innerHTML = `<span class="lr-ic">${ic(KIND_IC[r.kind] || 'device')}</span>
      <div class="lr-t"><small>${esc(t('acReqTitle'))}</small><b><bdi>${esc(r.name)}</bdi></b><span><span dir="ltr">${esc(r.ip)}</span> · ${esc(t('acReqSub'))}</span></div>
      <div class="lr-a"><button type="button" class="btn small" data-deny>${esc(t('acDeny'))}</button><button type="button" class="btn small primary" data-allow>${ic('check')}<span>${esc(t('acAllow'))}</span></button></div>`;
    el.onclick = async (e) => {
      const b = e.target.closest('[data-allow],[data-deny]'); if (!b) return;
      const approve = b.hasAttribute('data-allow');
      el.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      try { await api('POST', `/api/lan/requests/${r.id}`, { approve }); toast(approve ? t('acAllowed', { name: r.name }) : t('acDenied')); }
      catch (err) { toast(errText(err)); }
      el.remove(); reqCards.delete(r.id); setBadge(reqCards.size);
      if (state.view === 'access') setTimeout(refreshStatus, 1800); // يظهر الجهاز في القائمة بعد أن يكمل الجوال الاقتران
    };
    box.appendChild(el); reqCards.set(r.id, el);
  }
}
let lastOnline = 0;
function setBadge(pending, online = lastOnline) {
  lastOnline = online;
  const b = $('acBadge'); if (!b) return;
  b.hidden = !pending && !online;
  b.classList.toggle('pending', pending > 0); b.classList.toggle('online', !pending && online > 0);
  b.textContent = pending ? String(pending) : '';
  b.title = pending ? t('acReqTitle') : online ? t('acOnline') : '';
  document.title = (pending ? `(${pending}) ` : '') + baseTitle();
}

// ---------- المزامنة بين الأجهزة ----------
// كل جهاز يسأل الخادم عن «رقم المراجعة» كل 3 ثوانٍ؛ إن تغيّر تُحدَّث القائمة، والمحادثة المفتوحة إن عُدّلت من جهاز آخر.
async function refreshChats() {
  await loadChats();
  const cur = state.chat;
  if (!cur || !cur.messages?.length || state.streaming) return;
  const meta = state.chats.find((c) => c.id === cur.id);
  if (!meta || !(meta.updated > (cur.updated || 0))) return;
  try {
    const fresh = await api('GET', '/api/chats/' + encodeURIComponent(cur.id));
    if (state.streaming || state.chat !== cur) return;
    state.chat = fresh;
    if (state.view === 'chat') renderMessages(false);
    emit('chat:changed');
  } catch { /* */ }
}
async function tick() {
  if (ticking || document.visibilityState !== 'visible') return;
  ticking = true;
  try {
    const s = await api('GET', '/api/sync');
    if (s.lan) {
      showRequests(s.lan.pending || []); setBadge((s.lan.pending || []).length, s.lan.online);
      if (!s.lan.enabled && lanOn) { lanOn = false; syncSchedule(); }
    }
    if (rev === null) rev = s.rev;
    else if (s.rev !== rev && !state.streaming) { await refreshChats(); rev = s.rev; }
  } catch { /* الخادم يُعاد تشغيله أو الشبكة انقطعت لحظيًا */ }
  finally { ticking = false; }
}
function syncSchedule() {
  const want = isDevice || lanOn;
  if (want && !syncTimer) { syncTimer = setInterval(tick, 3000); tick(); }
  else if (!want && syncTimer) { clearInterval(syncTimer); syncTimer = null; showRequests([]); setBadge(0, 0); }
}

export function init() {
  const view = document.createElement('section'); view.className = 'view'; view.dataset.view = 'access'; view.id = 'viewAccess'; view.hidden = true;
  document.querySelector('.views').appendChild(view);
  pages.access = render;
  const btn = document.createElement('button'); btn.className = 'btn ghost block'; btn.dataset.goto = 'access';
  btn.innerHTML = `${ic('wifi')}<span data-i18n="access">${esc(t('access'))}</span><span class="nav-badge" id="acBadge" hidden></span>`;
  const help = document.querySelector('.side-foot [data-goto="help"]');
  if (help) help.after(btn); else document.querySelector('.side-foot [data-goto="tools"]').before(btn);
  if (isDevice) document.body.classList.add('is-device');
  on('view:changed', (v) => { if (v !== 'access') stopPagePoll(); });
  on('ui:applied', () => setBadge(reqCards.size));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && syncTimer) tick(); });
  if (isDevice) syncSchedule();
  else api('GET', '/api/lan').then((s) => { lanOn = !!s.enabled; syncSchedule(); }).catch(() => {});
}
