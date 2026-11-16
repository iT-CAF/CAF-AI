/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// صفحة الاقتران: تظهر لأي جهاز على الشبكة لم يُقرن بعد (جوال، جهاز لوحي، كمبيوتر آخر).
//  - فتحها من رمز QR (‎/pair?c=…‎): ربط فوري.
//  - فتح العنوان مباشرة: «طلب الوصول» ← يظهر الطلب على شاشة كآف AI بالكمبيوتر ← «سماح».
(function () {
  'use strict';
  const T = {
    ar: {
      host: 'كآف AI على', connecting: 'جارٍ ربط جهازك…', connectingSub: 'لحظة واحدة، نتحقق من الرمز.',
      title: 'افتح كآف AI من هذا الجهاز', sub: 'اطلب الوصول وسيظهر طلبك على شاشة الكمبيوتر الذي يعمل عليه كآف AI لتوافق عليه.',
      nameLbl: 'اسم هذا الجهاز', namePh: 'مثل: جوال علي', request: 'طلب الوصول', orScan: 'أو امسح رمز QR من صفحة «الوصول» على الكمبيوتر — بلا انتظار.',
      waitTitle: 'بانتظار الموافقة…', waitSub: 'تم إرسال الطلب. وافق عليه من الكمبيوتر.',
      s1: 'افتح كآف AI على الكمبيوتر', s2: 'ستظهر بطاقة «طلب وصول جديد» باسم {name}', s3: 'اضغط «سماح» — وسيفتح هنا تلقائيًا',
      expiresIn: 'ينتهي الطلب خلال {t}', cancel: 'إلغاء الطلب',
      okTitle: 'تم الاتصال', okSub: 'جارٍ فتح كآف AI…',
      deniedTitle: 'رُفض الطلب', deniedSub: 'لم يُسمح لهذا الجهاز بالوصول. اطلب من صاحب الكمبيوتر الموافقة، ثم حاول مرة أخرى.',
      expiredTitle: 'انتهت مهلة الطلب', expiredSub: 'لم تصل موافقة خلال 3 دقائق. يمكنك إرسال طلب جديد.',
      retry: 'إرسال طلب جديد',
      badCode: 'رمز QR منتهٍ أو استُخدم من قبل. اعرض رمزًا جديدًا على الكمبيوتر، أو أرسل طلب وصول.',
      revoked: 'أُزيل هذا الجهاز من الأجهزة المسموح بها. اطلب الوصول من جديد.',
      limited: 'محاولات كثيرة. انتظر بضع دقائق ثم حاول مرة أخرى.', tooMany: 'هناك طلبات كثيرة بانتظار الموافقة. حاول بعد قليل.',
      disabled: 'الوصول من الشبكة متوقف على الكمبيوتر.', offline: 'تعذّر الوصول إلى كآف AI. تأكد أن الجوال متصل بنفس شبكة Wi-Fi وأن كآف AI يعمل.',
      foot: 'اتصال داخل شبكتك المحلية فقط · محادثاتك تبقى على الكمبيوتر',
    },
    en: {
      host: 'CAF AI on', connecting: 'Connecting your device…', connectingSub: 'One moment, checking the code.',
      title: 'Open CAF AI on this device', sub: 'Request access and it will appear on the computer running CAF AI for approval.',
      nameLbl: 'Name this device', namePh: 'e.g. Ali’s phone', request: 'Request access', orScan: 'Or scan the QR code on the computer’s “Access” page — no waiting.',
      waitTitle: 'Waiting for approval…', waitSub: 'Request sent. Approve it on the computer.',
      s1: 'Open CAF AI on the computer', s2: 'A “New access request” card appears for {name}', s3: 'Click “Allow” — this page opens automatically',
      expiresIn: 'Request expires in {t}', cancel: 'Cancel request',
      okTitle: 'Connected', okSub: 'Opening CAF AI…',
      deniedTitle: 'Request declined', deniedSub: 'This device was not allowed. Ask the computer’s owner to approve it, then try again.',
      expiredTitle: 'Request expired', expiredSub: 'No approval within 3 minutes. You can send a new request.',
      retry: 'Send a new request',
      badCode: 'This QR code expired or was already used. Show a new one on the computer, or send an access request.',
      revoked: 'This device was removed from the allowed devices. Request access again.',
      limited: 'Too many attempts. Wait a few minutes and try again.', tooMany: 'Too many requests are waiting. Try again shortly.',
      disabled: 'Network access is turned off on the computer.', offline: 'Could not reach CAF AI. Make sure this device is on the same Wi-Fi and CAF AI is running.',
      foot: 'Stays inside your local network · your chats stay on the computer',
    },
  };
  const html = document.documentElement;
  const L = T[html.lang] || T.ar;
  const t = (k, v) => { let s = L[k] || k; for (const [a, b] of Object.entries(v || {})) s = s.split(`{${a}}`).join(b); return s; };
  const $ = (id) => document.getElementById(id);
  const ICON = (n) => `url(/brand/icons/ui/${n}.svg)`;

  // المظهر: نفس اختيار الكمبيوتر، و«النظام» يتبع الجهاز
  const pref = html.dataset.themePref;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    html.dataset.theme = pref === 'light' || pref === 'dark' ? pref : (mq.matches ? 'dark' : 'light');
    document.querySelector('meta[name=theme-color]').content = html.dataset.theme === 'dark' ? '#0E1113' : '#EDE8DF';
  };
  applyTheme(); mq.addEventListener?.('change', applyTheme);

  const ERR = { bad_code: 'badCode', rate_limited: 'limited', too_many_requests: 'tooMany', lan_disabled: 'disabled' };
  let req = null; let pollTimer = null; let tickTimer = null;

  function guessName() {
    const ua = navigator.userAgent;
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Macintosh/.test(ua)) return 'Mac';
    return '';
  }
  function view(state, { icon = 'wifi', title, sub, alert = '', spin = false } = {}) {
    $('card').dataset.state = state;
    $('orbIc').style.setProperty('--i', ICON(icon));
    $('orb').classList.toggle('spin', spin);
    $('title').textContent = title || '';
    $('sub').textContent = sub || '';
    $('alert').textContent = alert; $('alert').hidden = !alert;
    $('form').hidden = state !== 'form';
    $('wait').hidden = state !== 'wait';
    $('retryBtn').hidden = !(state === 'denied' || state === 'expired');
  }
  const showForm = (alert = '') => {
    stopTimers();
    view('form', { icon: 'smartphone', title: t('title'), sub: t('sub'), alert });
    setTimeout(() => $('name').focus({ preventScroll: true }), 50);
  };
  const stopTimers = () => { clearTimeout(pollTimer); clearInterval(tickTimer); pollTimer = null; tickTimer = null; };
  const done = () => { stopTimers(); view('ok', { icon: 'circle-check', title: t('okTitle'), sub: t('okSub') }); setTimeout(() => location.replace('/'), 600); };

  async function call(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    let j = {}; try { j = await r.json(); } catch { /* */ }
    if (!r.ok) throw Object.assign(new Error(j.error || 'http_' + r.status), { code: j.error });
    return j;
  }
  const errMsg = (e) => t(ERR[e.code] || 'offline');

  async function pairWithCode(code) {
    view('busy', { icon: 'loader-circle', title: t('connecting'), sub: t('connectingSub'), spin: true });
    history.replaceState(null, '', '/pair'); // الرمز لا يبقى في السجل
    try { await call('POST', '/api/lan/pair', { code, name: guessName() }); done(); }
    catch (e) { showForm(errMsg(e)); }
  }

  async function sendRequest(e) {
    e?.preventDefault();
    const name = $('name').value.trim() || guessName();
    $('reqBtn').disabled = true;
    try {
      req = await call('POST', '/api/lan/request', { name });
      req.started = Date.now();
      view('wait', { icon: 'wifi', title: t('waitTitle'), sub: t('waitSub') });
      $('card').classList.add('pulse');
      $('steps').innerHTML = '';
      for (const [i, k] of ['s1', 's2', 's3'].entries()) {
        const li = document.createElement('li');
        const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1);
        const tx = document.createElement('span'); tx.textContent = t(k, { name: `«${req.name}»` });
        li.append(n, tx); $('steps').appendChild(li);
      }
      tick(); tickTimer = setInterval(tick, 1000);
      poll();
    } catch (err) { showForm(errMsg(err)); }
    finally { $('reqBtn').disabled = false; }
  }
  function tick() {
    const left = Math.max(0, 180 - Math.floor((Date.now() - req.started) / 1000));
    $('timer').textContent = t('expiresIn', { t: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` });
  }
  async function poll() {
    if (!req) return;
    try {
      const r = await call('GET', `/api/lan/request/${req.id}?s=${encodeURIComponent(req.secret)}`);
      if (r.status === 'approved') { $('card').classList.remove('pulse'); return done(); }
      if (r.status === 'denied') { stopTimers(); $('card').classList.remove('pulse'); req = null; return view('denied', { icon: 'circle-x', title: t('deniedTitle'), sub: t('deniedSub') }); }
      if (r.status === 'expired') { stopTimers(); $('card').classList.remove('pulse'); req = null; return view('expired', { icon: 'clock', title: t('expiredTitle'), sub: t('expiredSub') }); }
    } catch { /* انقطاع لحظي في الشبكة: نعيد المحاولة */ }
    pollTimer = setTimeout(poll, 1500);
  }

  // ---- البداية ----
  $('host').textContent = `${t('host')} ${location.host}`;
  $('nameLbl').textContent = t('nameLbl'); $('name').placeholder = t('namePh'); $('name').value = guessName();
  $('reqBtn').textContent = t('request'); $('orScan').textContent = t('orScan');
  $('cancelBtn').textContent = t('cancel'); $('retryBtn').textContent = t('retry'); $('foot').textContent = t('foot');
  $('form').addEventListener('submit', sendRequest);
  $('cancelBtn').onclick = () => { req = null; $('card').classList.remove('pulse'); showForm(); };
  $('retryBtn').onclick = () => showForm();

  const q = new URLSearchParams(location.search);
  const code = q.get('c');
  if (code && /^[A-Za-z0-9_-]{8,64}$/.test(code)) pairWithCode(code);
  else showForm(q.get('e') === 'revoked' ? t('revoked') : '');
})();
