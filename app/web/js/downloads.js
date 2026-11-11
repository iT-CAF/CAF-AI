/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// لوحة التنزيلات العائمة: تقدّم كل تنزيل (نماذج Ollama، المحركات الإضافية) مع إلغاء.
import { $, esc, t, ic, fmtBytes } from './core.js';

const items = new Map();

function ensurePanel() {
  let p = $('dlTray');
  if (!p) {
    p = document.createElement('section');
    p.id = 'dlTray'; p.className = 'dl-tray hidden'; p.setAttribute('aria-live', 'polite'); p.setAttribute('aria-label', t('downloads'));
    p.innerHTML = `<header><b>${esc(t('downloads'))}</b><button class="mini" data-hide aria-label="${esc(t('close'))}">${ic('close')}</button></header><div class="list"></div>`;
    p.querySelector('[data-hide]').onclick = () => p.classList.add('hidden');
    document.body.appendChild(p);
  }
  return p;
}

function render(id) {
  const it = items.get(id); const p = ensurePanel();
  let row = p.querySelector(`[data-dl="${CSS.escape(id)}"]`);
  if (!row) {
    row = document.createElement('div'); row.className = 'dl-row'; row.dataset.dl = id;
    p.querySelector('.list').prepend(row);
  }
  const pct = it.total ? Math.min(100, Math.floor((it.completed / it.total) * 100)) : null;
  row.className = `dl-row ${it.state}`;
  row.innerHTML = `<div class="dl-head"><span class="n" dir="auto">${esc(it.label)}</span>${it.state === 'running' && it.cancel ? `<button class="mini" data-cancel title="${esc(t('cancel'))}">${ic('close')}</button>` : ''}</div>
    <div class="progress"><div style="width:${pct ?? (it.state === 'done' ? 100 : 0)}%"></div><span>${esc(it.text || '')}${pct !== null && it.state === 'running' ? ` · ${pct}%` : ''}${it.total && it.state === 'running' ? ` · ${fmtBytes(it.completed)} / ${fmtBytes(it.total)}` : ''}</span></div>`;
  const c = row.querySelector('[data-cancel]'); if (c) c.onclick = () => it.cancel();
  p.classList.remove('hidden');
}

export const downloads = {
  start(id, label, cancel) { items.set(id, { label, state: 'running', completed: 0, total: 0, text: t('starting'), cancel }); render(id); },
  update(id, patch) { const it = items.get(id); if (!it) return; Object.assign(it, patch); render(id); },
  done(id, text = t('done')) { const it = items.get(id); if (!it) return; Object.assign(it, { state: 'done', text, cancel: null }); render(id); setTimeout(() => { $('dlTray')?.querySelector(`[data-dl="${CSS.escape(id)}"]`)?.remove(); items.delete(id); if (!items.size) $('dlTray')?.classList.add('hidden'); }, 6000); },
  fail(id, text) { const it = items.get(id); if (!it) return; Object.assign(it, { state: 'error', text, cancel: null }); render(id); },
  active: () => [...items.values()].filter((x) => x.state === 'running').length,
};
