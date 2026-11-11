/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// الإعدادات: تنقّل جانبي بين الأقسام. الوحدات تضيف أقسامها عبر settingsSections: { id, icon, label(), render(el) }
import { state, $, t, esc, ic, api, toast, emit, confirmBox, errText } from './core.js';
import { chatModels } from './models.js';

export const settingsSections = [];
const ROLE_PINS = [['chat', 'roleChat'], ['code', 'roleCode'], ['vision', 'roleVision'], ['embed', 'roleEmbed']];
let current = 'general';

export async function saveSettings(patch, { quiet = true } = {}) {
  state.settings = await api('PUT', '/api/settings', { ...patch });
  emit('settings:changed', patch);
  if (!quiet) toast(t('saved'));
}

function rolePinSelect(role) {
  const cur = state.settings.modelsByRole?.[role] || '';
  const list = role === 'embed'
    ? state.models.filter((m) => (m.capabilities || []).includes('embedding'))
    : chatModels().filter((m) => !(m.capabilities || []).includes('embedding') && (role !== 'vision' || (m.capabilities || []).includes('vision')));
  return `<select data-pin="${role}"><option value="">${esc(t('recommendedAuto'))}</option>${list.map((m) => `<option value="${esc(m.name)}" ${m.name === cur ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`;
}
const row = (label, hint, control) => `<div class="set-row"><div class="set-l"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div><div class="set-c">${control}</div></div>`;

const SECTIONS = [
  { id: 'general', icon: 'sliders', label: () => t('general'), render: (el) => {
    const s = state.settings;
    el.innerHTML = `<h3>${esc(t('general'))}</h3>
      ${row(t('language'), t('languageHint'), `<div class="seg" id="segLang" role="group"><button type="button" data-v="ar" aria-pressed="${s.lang === 'ar'}">العربية</button><button type="button" data-v="en" aria-pressed="${s.lang === 'en'}">English</button></div>`)}
      ${row(t('theme'), t('themeHint'), `<div class="seg" id="segTheme" role="group">${['system', 'light', 'dark'].map((k) => `<button type="button" data-v="${k}" aria-pressed="${s.theme === k}">${ic(k === 'system' ? 'device' : k === 'light' ? 'sun' : 'moon')}<span>${esc(t(k))}</span></button>`).join('')}</div>`)}
      ${row(t('wrapCodeDefault'), '', `<label class="switch"><input type="checkbox" id="setWrap" ${s.wrapCode ? 'checked' : ''}><span class="sw"></span></label>`)}`;
    el.querySelector('#segLang').onclick = (e) => { const b = e.target.closest('button'); if (b) saveSettings({ lang: b.dataset.v }).then(() => { emit('ui:lang'); openSettings('general'); }); };
    el.querySelector('#segTheme').onclick = (e) => { const b = e.target.closest('button'); if (b) saveSettings({ theme: b.dataset.v }).then(() => { emit('ui:lang'); el.querySelectorAll('#segTheme button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }); };
    el.querySelector('#setWrap').onchange = (e) => saveSettings({ wrapCode: e.target.checked });
  } },
  { id: 'behavior', icon: 'bulb', label: () => t('behavior'), render: (el) => {
    const s = state.settings;
    el.innerHTML = `<h3>${esc(t('behavior'))}</h3>
      <label class="field"><span>${esc(t('systemPrompt'))}</span><textarea id="setSystem" rows="3" dir="auto" placeholder="${esc(t('systemPromptPh'))}">${esc(s.systemPrompt)}</textarea></label>
      <label class="field"><span>${esc(t('codeSystemPrompt'))}</span><textarea id="setCodeSystem" rows="3" dir="auto" placeholder="${esc(t('codeSystemPromptPh'))}">${esc(s.codeSystemPrompt)}</textarea></label>
      ${row(t('temperature'), t('temperatureHint'), `<div class="range-wrap"><input type="range" id="setTemp" min="0" max="1.5" step="0.1" value="${s.temperature}"><output id="tempOut">${s.temperature}</output></div>`)}
      ${row(t('context'), t('contextHint'), `<select id="setCtx">${[2048, 4096, 8192, 16384, 32768, 65536, 131072].map((n) => `<option ${n === s.numCtx ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
      ${row(t('thinkDefault'), t('thinkHint'), `<select id="setThink">${['auto', 'on', 'off', 'low', 'medium', 'high'].map((k) => `<option value="${k}" ${s.think === k ? 'selected' : ''}>${esc(t('think_' + k))}</option>`).join('')}</select>`)}`;
    el.querySelector('#setTemp').oninput = (e) => { el.querySelector('#tempOut').textContent = e.target.value; };
    el.querySelector('#setTemp').onchange = (e) => saveSettings({ temperature: +e.target.value });
    el.querySelector('#setCtx').onchange = (e) => saveSettings({ numCtx: +e.target.value });
    el.querySelector('#setThink').onchange = (e) => saveSettings({ think: e.target.value }).then(() => emit('think:changed'));
    el.querySelector('#setSystem').onchange = (e) => saveSettings({ systemPrompt: e.target.value }, { quiet: false });
    el.querySelector('#setCodeSystem').onchange = (e) => saveSettings({ codeSystemPrompt: e.target.value }, { quiet: false });
  } },
  { id: 'models', icon: 'chip', label: () => t('modelRoles'), render: (el) => {
    el.innerHTML = `<h3>${esc(t('modelRoles'))}</h3><p class="muted small">${esc(t('modelRolesSub'))}</p>
      ${ROLE_PINS.map(([r, k]) => row(t(k), '', rolePinSelect(r))).join('')}
      <div class="row"><button type="button" class="btn" data-goto="tools">${ic('box')}<span>${esc(t('manageModels'))}</span></button><button type="button" class="btn ghost" data-goto="hardware">${ic('device')}<span>${esc(t('myDevice'))}</span></button></div>`;
    el.querySelectorAll('[data-pin]').forEach((sel) => { sel.onchange = () => saveSettings({ modelsByRole: { [sel.dataset.pin]: sel.value } }, { quiet: false }); });
  } },
  { id: 'updates', icon: 'refresh', label: () => t('updates'), render: (el) => renderUpdates(el) },
  { id: 'data', icon: 'server', label: () => t('data'), render: (el) => {
    el.innerHTML = `<h3>${esc(t('data'))}</h3>
      ${row(t('dataFolder'), t('dataFolderHint'), `<code class="path" dir="ltr">${esc(state.info?.home || '')}</code>`)}
      <div id="dataExtra"></div>
      <div class="danger-zone"><h4>${ic('alert')}${esc(t('dangerZone'))}</h4>
        <div class="row wrap"><button type="button" class="btn danger" id="wipeChats">${ic('trash')}<span>${esc(t('deleteAll'))}</span></button><button type="button" class="btn" id="quitApp">${ic('close')}<span>${esc(t('quit'))}</span></button></div></div>`;
    el.querySelector('#wipeChats').onclick = async () => {
      if (!(await confirmBox(t('confirmDeleteAll'), { danger: true, ok: t('delete') }))) return;
      try { await api('DELETE', '/api/chats'); emit('chats:wiped'); toast(t('deleted')); } catch (e) { toast(errText(e)); }
    };
    el.querySelector('#quitApp').onclick = async () => {
      if (!(await confirmBox(t('confirmQuit')))) return;
      try { await api('POST', '/api/quit'); } catch { /* */ }
      document.body.innerHTML = `<p class="quit-done">${esc(t('quitDone'))}</p>`;
    };
    for (const s of settingsSections.filter((x) => x.into === 'data')) s.render(el.querySelector('#dataExtra'));
  } },
  { id: 'about', icon: 'globe', label: () => t('aboutTitle'), render: (el) => {
    const y = state.info?.year || new Date().getFullYear(); const v = state.info?.version || '';
    el.innerHTML = `<div class="about">
      <img src="/brand/itcaf-horizontal-on-graphite-anim.svg" class="logo-dark" alt="iT CAF"><img src="/brand/itcaf-horizontal-on-bone-anim.svg" class="logo-light" alt="iT CAF">
      <p class="ver-line"><b>CAF AI · كآف AI</b> <span class="chip">v${esc(v)}</span></p>
      <p>${esc(t('about'))}</p>
      <div class="promo">
        <a class="promo-card" href="https://it-caf.com/" target="_blank" rel="noopener noreferrer">${ic('globe')}<span><b>${esc(t('promoSiteTitle'))}</b><small>${esc(t('promoSiteSub'))}</small></span><span class="url" dir="ltr">it-caf.com</span></a>
        <a class="promo-card" href="https://github.com/iT-CAF/CAF-AI" target="_blank" rel="noopener noreferrer">${ic('github')}<span><b>${esc(t('promoRepoTitle'))}</b><small>${esc(t('promoRepoSub'))}</small></span><span class="url" dir="ltr">github.com/iT-CAF/CAF-AI</span></a>
      </div>
      <p class="rights">${esc(t('rightsFull').replace('{y}', y).replace('{v}', v))}</p></div>`;
  } },
];

// ---------- التحديثات ----------
async function renderUpdates(el) {
  const v = state.info?.version || '';
  el.innerHTML = `<h3>${esc(t('updates'))}</h3>
    <div class="update-card" id="updCard"><div class="upd-ic">${ic('refresh')}</div><div class="upd-t"><b>${esc(t('currentVersion'))}: v${esc(v)}</b><small id="updStatus">${esc(t('updatesSub'))}</small></div>
      <button type="button" class="btn primary" id="updCheck">${ic('refresh')}<span>${esc(t('checkUpdates'))}</span></button></div>
    <div id="updNotes"></div>
    <p class="muted small">${esc(t('updatesPrivacy'))}</p>`;
  el.querySelector('#updCheck').onclick = () => checkUpdate(el);
}
async function checkUpdate(el) {
  const btn = el.querySelector('#updCheck'); const st = el.querySelector('#updStatus');
  btn.disabled = true; st.textContent = t('checking');
  try {
    const r = await api('GET', '/api/update/check');
    if (!r.available) { st.textContent = t('upToDate', { v: r.latest || r.current }); btn.disabled = false; return; }
    st.innerHTML = `${esc(t('updateAvailable', { v: r.latest }))}${r.publishedAt ? ` · <span dir="ltr">${esc(new Date(r.publishedAt).toLocaleDateString(state.settings.lang === 'ar' ? 'ar' : 'en'))}</span>` : ''}`;
    el.querySelector('#updNotes').innerHTML = r.notes ? `<details class="upd-notes" open><summary>${esc(t('whatsNew'))}</summary><div class="msg"><div class="body">${(await import('./md.js')).renderMd(r.notes)}</div></div></details>` : '';
    btn.disabled = false;
    if (!r.canApply) { btn.innerHTML = `${ic('external')}<span>${esc(t('openRelease'))}</span>`; btn.onclick = () => window.open(r.url, '_blank', 'noopener'); if (r.reason) st.insertAdjacentHTML('beforeend', `<br><span class="warn">${esc(t('upd_' + r.reason))}</span>`); return; }
    btn.innerHTML = `${ic('download')}<span>${esc(t('updateNow'))}</span>`;
    btn.onclick = () => applyUpdate(el, r);
  } catch (e) { st.textContent = errText(e); btn.disabled = false; }
}
async function applyUpdate(el, info) {
  if (!(await confirmBox(t('confirmUpdate', { v: info.latest })))) return;
  const btn = el.querySelector('#updCheck'); const st = el.querySelector('#updStatus');
  btn.disabled = true;
  const { readNdjson, authHeaders } = await import('./core.js');
  try {
    const job = await api('POST', '/api/update/apply');
    const res = await fetch(`/api/jobs/${job.id}/stream`, { headers: authHeaders() });
    let final = null;
    await readNdjson(res, (j) => { final = j; if (j.status === 'running') st.textContent = `${t('updating')} ${j.progress.total ? Math.floor((j.progress.completed / j.progress.total) * 100) + '%' : ''} ${j.progress.text ? '· ' + t('upd_step_' + j.progress.text) : ''}`; });
    if (final?.status !== 'done') throw Object.assign(new Error(final?.error?.code || 'update_failed'), { code: final?.error?.code || 'update_failed' });
    st.textContent = t('restarting');
    // ننتظر عودة الخادم بالإصدار الجديد ثم نحدّث الصفحة
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try { const inf = await (await fetch('/api/info')).json(); if (inf.version === info.latest) { location.reload(); return; } } catch { /* يعيد التشغيل */ }
    }
    st.textContent = t('restartManually');
  } catch (e) { st.textContent = errText(e); btn.disabled = false; }
}

export function openSettings(section) {
  const dlg = $('settingsDlg');
  if (section) current = section;
  const all = [...SECTIONS, ...settingsSections.filter((x) => !x.into)];
  if (!all.some((x) => x.id === current)) current = 'general';
  $('settingsBody').innerHTML = `<div class="set-layout"><nav class="set-nav" role="tablist" aria-orientation="vertical">${all.map((x) => `<button type="button" role="tab" data-sec="${x.id}" aria-selected="${x.id === current}">${ic(x.icon)}<span>${esc(x.label())}</span></button>`).join('')}</nav><section class="set-pane" id="setPane" role="tabpanel"></section></div>`;
  const pane = $('setPane');
  (all.find((x) => x.id === current) || all[0]).render(pane);
  $('settingsBody').querySelector('.set-nav').onclick = (e) => { const b = e.target.closest('[data-sec]'); if (b) openSettings(b.dataset.sec); };
  $('settingsBody').querySelector('.set-nav').onkeydown = (e) => {
    const tabs = [...$('settingsBody').querySelectorAll('[data-sec]')]; const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (d) { e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; openSettings(n.dataset.sec); $('settingsBody').querySelector(`[data-sec="${n.dataset.sec}"]`).focus(); }
  };
  if (!dlg.open) dlg.showModal();
}
