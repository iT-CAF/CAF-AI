/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// صندوق الكتابة: النص، المرفقات المعلّقة (صور/ملفات)، والأوامر. وحدات أخرى تضيف أنواع مرفقات وأوامر.
import { state, $, t, esc, ic, emit } from './core.js';
import { send } from './chat.js';

// كل مرفق معلّق: { key, kind:'image'|'file'|'folder', label, thumb?, remove(), payload }
export const pending = [];
// معالجات قبل الإرسال: تحوّل المرفقات المعلّقة إلى خيارات send() (images/files/context)
export const beforeSend = [];
// أوامر «/»: { cmd, label, run(rest) → true إن استُهلك النص }
export const slashCommands = [];

export function addPending(item) { pending.push(item); renderTray(); }
export function removePending(key) {
  const i = pending.findIndex((p) => p.key === key);
  if (i >= 0) { const [p] = pending.splice(i, 1); p.remove?.(); }
  renderTray();
}
export function clearPending() { while (pending.length) pending.pop().remove?.(); renderTray(); }

export function renderTray() {
  const tray = $('tray'); if (!tray) return;
  tray.classList.toggle('hidden', !pending.length);
  tray.innerHTML = pending.map((p) => `<div class="att att-${p.kind}${p.busy ? ' busy' : ''}" data-key="${esc(p.key)}">${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : ic(p.kind === 'folder' ? 'folder' : 'file')}<span class="att-l" dir="auto" title="${esc(p.title || p.label)}">${esc(p.label)}</span>${p.note ? `<small class="att-n">${esc(p.note)}</small>` : ''}<button type="button" class="mini att-x" data-unpend="${esc(p.key)}" aria-label="${esc(t('remove'))} ${esc(p.label)}">${ic('close')}</button></div>`).join('');
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

export function bindComposer() {
  const input = $('input');
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
