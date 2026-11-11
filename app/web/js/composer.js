/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// صندوق الكتابة: النص، المرفقات المعلّقة (صور/ملفات)، والأوامر. وحدات أخرى تضيف أنواع مرفقات وأوامر.
import { state, $, t, esc, ic, emit, on } from './core.js';
import { send } from './chat.js';

// كل مرفق معلّق: { key, kind:'image'|'file'|'folder', label, thumb?, remove(), payload }
export const pending = [];
// معالجات قبل الإرسال: تحوّل المرفقات المعلّقة إلى خيارات send() (images/files/context)
export const beforeSend = [];
// أوامر «/»: { cmd, label, hint?, icon?, run(rest) → true إن استُهلك النص }
export const slashCommands = [];
// مصادر إضافية لقائمة «/» (مثل المهارات): (query) → [{ id, group, icon?, emoji?, label, hint, pick() }]
export const slashProviders = [];

export function addPending(item) { pending.push(item); renderTray(); }
export function removePending(key) {
  const i = pending.findIndex((p) => p.key === key);
  if (i >= 0) { const [p] = pending.splice(i, 1); p.remove?.(); }
  renderTray();
}
export function clearPending() { while (pending.length) pending.pop().remove?.(); renderTray(); }

export function renderTray() {
  const tray = $('tray'); if (!tray) return;
  setTimeout(() => window.dispatchEvent(new Event('caf:pending')), 0);
  tray.classList.toggle('hidden', !pending.length);
  tray.innerHTML = pending.map((p) => `<div class="att att-${p.kind}${p.busy ? ' busy' : ''}" data-key="${esc(p.key)}">${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : ic(p.kind === 'folder' ? 'folder' : p.kind === 'skill' ? 'sparkle' : p.kind === 'sheet' ? 'sheet' : 'file')}<span class="att-l" dir="auto" title="${esc(p.title || p.label)}">${esc(p.label)}</span>${p.note ? `<small class="att-n">${esc(p.note)}</small>` : ''}<button type="button" class="mini att-x" data-unpend="${esc(p.key)}" aria-label="${esc(t('remove'))} ${esc(p.label)}">${ic('close')}</button></div>`).join('');
}

export const autoGrow = () => { const input = $('input'); input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 240) + 'px'; };

export async function submit() {
  const input = $('input');
  let text = input.value;
  if (pending.some((p) => p.busy)) { emit('toast', t('waitAttachments')); return; }
  // أوامر الشرطة المائلة
  const m = /^\/(\w+)\b\s*([\s\S]*)$/.exec(text.trim());
  if (m) {
    const c = slashCommands.find((x) => x.cmd === m[1].toLowerCase());
    if (c) { const used = await c.run(m[2], text); if (used) { input.value = ''; autoGrow(); return; } }
  }
  const opts = {};
  for (const fn of beforeSend) { try { await fn(opts, text); } catch (e) { emit('toast', e.message); return; } }
  if (!text.trim() && !(opts.images && opts.images.length) && !opts.context) return;
  input.value = ''; autoGrow();
  clearPending();
  return send(text, opts);
}

// قائمة الإرفاق (📎): كل وحدة تضيف عنصرًا { id, icon, label(), run(), visible?() }
export const attachItems = [];
function renderAttach() {
  const left = $('composerLeft');
  if (!attachItems.length) { left.innerHTML = ''; return; }
  left.innerHTML = `<button type="button" class="btn icon-only" id="attachBtn" aria-haspopup="menu" aria-expanded="false" title="${esc(t('attach'))}" aria-label="${esc(t('attach'))}">${ic('clip')}</button>`;
  $('attachBtn').onclick = (e) => {
    e.stopPropagation();
    let m = $('attachMenu');
    if (m) { m.remove(); $('attachBtn').setAttribute('aria-expanded', 'false'); return; }
    m = document.createElement('div'); m.id = 'attachMenu'; m.className = 'pop-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = attachItems.filter((a) => !a.visible || a.visible()).map((a) => `<button type="button" role="menuitem" data-att="${esc(a.id)}">${ic(a.icon)}<span>${esc(a.label())}</span></button>`).join('');
    $('composer').appendChild(m);
    $('attachBtn').setAttribute('aria-expanded', 'true');
    m.querySelector('button')?.focus();
    m.onclick = (ev) => { const b = ev.target.closest('[data-att]'); if (!b) return; m.remove(); $('attachBtn').setAttribute('aria-expanded', 'false'); attachItems.find((a) => a.id === b.dataset.att)?.run(); };
    m.onkeydown = (ev) => {
      const items = [...m.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (ev.key === 'Escape') { m.remove(); $('attachBtn').focus(); }
    };
    setTimeout(() => document.addEventListener('click', function close(ev) { if (!m.contains(ev.target)) { m.remove(); $('attachBtn')?.setAttribute('aria-expanded', 'false'); } document.removeEventListener('click', close); }), 0);
  };
}
export function addAttachItem(item) { attachItems.push(item); renderAttach(); }
on('ui:applied', renderAttach);

// اختيار ملفات من الجهاز (بدون رفعها لأي مكان: تُقرأ في المتصفح)
export function pickFiles({ accept = '', multiple = true, directory = false } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = multiple; if (accept) inp.accept = accept;
    if (directory) { inp.webkitdirectory = true; inp.setAttribute('webkitdirectory', ''); }
    inp.style.display = 'none';
    inp.onchange = () => { resolve([...inp.files]); inp.remove(); };
    inp.addEventListener('cancel', () => { resolve([]); inp.remove(); });
    document.body.appendChild(inp); inp.click();
  });
}

// ---------- قائمة «/» ----------
let slashItems = []; let slashSel = 0;
function slashQuery() {
  const v = $('input').value;
  const m = /^\/([^\s]*)$/.exec(v);
  return m ? m[1].toLowerCase() : null;
}
function closeSlash() { const el = $('slash'); el.classList.add('hidden'); el.innerHTML = ''; slashItems = []; $('input').setAttribute('aria-expanded', 'false'); }
function renderSlash() {
  const q = slashQuery();
  if (q === null) return closeSlash();
  const cmds = slashCommands.filter((c) => !c.hidden && (!q || c.cmd.startsWith(q) || String(c.label()).toLowerCase().includes(q)))
    .map((c) => ({ id: 'cmd:' + c.cmd, group: t('slashCommands'), icon: c.icon || 'slash', label: '/' + c.cmd, hint: c.label(), pick: () => { setInput('/' + c.cmd + ' '); } }));
  const extra = slashProviders.flatMap((fn) => { try { return fn(q) || []; } catch { return []; } });
  slashItems = [...cmds, ...extra].slice(0, 40);
  const el = $('slash');
  if (!slashItems.length) { el.innerHTML = `<p class="muted small sl-empty">${esc(t('slashNone'))}</p>`; el.classList.remove('hidden'); return; }
  slashSel = Math.min(slashSel, slashItems.length - 1);
  let last = '';
  el.innerHTML = slashItems.map((it, i) => {
    const head = it.group !== last ? `<div class="sl-group">${esc(it.group)}</div>` : ''; last = it.group;
    return `${head}<button type="button" role="option" id="sl-${i}" data-sl="${i}" aria-selected="${i === slashSel}">${it.emoji ? `<span class="sl-emo">${esc(it.emoji)}</span>` : ic(it.icon || 'slash')}<span class="sl-l" dir="auto">${esc(it.label)}</span><span class="sl-h" dir="auto">${esc(it.hint || '')}</span></button>`;
  }).join('') + `<div class="sl-foot">${esc(t('slashHelp'))}</div>`;
  el.classList.remove('hidden');
  $('input').setAttribute('aria-expanded', 'true'); $('input').setAttribute('aria-activedescendant', 'sl-' + slashSel);
  el.querySelector(`[data-sl="${slashSel}"]`)?.scrollIntoView({ block: 'nearest' });
}
function pickSlash(i) { const it = slashItems[i]; if (!it) return; closeSlash(); it.pick(); $('input').focus(); }

export function bindComposer() {
  const input = $('input');
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-controls', 'slash'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false');
  input.addEventListener('input', () => { slashSel = 0; renderSlash(); });
  input.addEventListener('keydown', (e) => {
    if ($('slash').classList.contains('hidden') || !slashItems.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); slashSel = (slashSel + (e.key === 'ArrowDown' ? 1 : -1) + slashItems.length) % slashItems.length; renderSlash(); }
    else if ((e.key === 'Enter' && !e.shiftKey && !e.isComposing) || e.key === 'Tab') { e.preventDefault(); pickSlash(slashSel); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSlash(); }
  });
  $('slash').addEventListener('mousedown', (e) => { const b = e.target.closest('[data-sl]'); if (b) { e.preventDefault(); pickSlash(+b.dataset.sl); } });
  input.addEventListener('blur', () => setTimeout(closeSlash, 150));
  input.addEventListener('input', () => { autoGrow(); emit('composer:input', input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
  });
  $('send').onclick = () => submit();
  $('tray').onclick = (e) => { const b = e.target.closest('[data-unpend]'); if (b) removePending(b.dataset.unpend); };
}

export const setInput = (text, { focus = true } = {}) => { const input = $('input'); input.value = text; autoGrow(); if (focus) { input.focus(); input.setSelectionRange(text.length, text.length); } };
export { state };
