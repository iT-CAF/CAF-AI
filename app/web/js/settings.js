/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// نافذة الإعدادات. وحدات أخرى تضيف أقسامها عبر settingsSections.
import { state, $, t, esc, ic, api, toast, emit, confirmBox, errText } from './core.js';
import { chatModels } from './models.js';

export const settingsSections = [];
const ROLE_PINS = [['chat', 'roleChat'], ['code', 'roleCode'], ['vision', 'roleVision'], ['embed', 'roleEmbed']];

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
  return `<select data-pin="${role}" aria-label="${esc(t('pinFor'))} ${esc(t(ROLE_PINS.find((r) => r[0] === role)[1]))}"><option value="">${esc(t('recommendedAuto'))}</option>${list.map((m) => `<option value="${esc(m.name)}" ${m.name === cur ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`;
}

export function openSettings() {
  const dlg = $('settingsDlg');
  const s = state.settings;
  const y = state.info?.year || new Date().getFullYear(); const v = state.info?.version || '';
  $('settingsBody').innerHTML = `
    <section><h3>${esc(t('general'))}</h3>
      <div class="field"><span>${esc(t('language'))}</span><div class="seg" id="segLang" role="group"><button type="button" data-v="ar" aria-pressed="${s.lang === 'ar'}">العربية</button><button type="button" data-v="en" aria-pressed="${s.lang === 'en'}">English</button></div></div>
      <div class="field"><span>${esc(t('theme'))}</span><div class="seg" id="segTheme" role="group">${['system', 'light', 'dark'].map((k) => `<button type="button" data-v="${k}" aria-pressed="${s.theme === k}">${esc(t(k))}</button>`).join('')}</div></div>
    </section>
    <section><h3>${esc(t('behavior'))}</h3>
      <label class="field"><span>${esc(t('systemPrompt'))}</span><textarea id="setSystem" rows="3" dir="auto" placeholder="${esc(t('systemPromptPh'))}">${esc(s.systemPrompt)}</textarea></label>
      <label class="field"><span>${esc(t('codeSystemPrompt'))}</span><textarea id="setCodeSystem" rows="3" dir="auto" placeholder="${esc(t('codeSystemPromptPh'))}">${esc(s.codeSystemPrompt)}</textarea></label>
      <label class="field"><span><span>${esc(t('temperature'))}</span> <output id="tempOut">${s.temperature}</output></span><input type="range" id="setTemp" min="0" max="1.5" step="0.1" value="${s.temperature}"></label>
      <label class="field"><span>${esc(t('context'))}</span><select id="setCtx">${[2048, 4096, 8192, 16384, 32768, 65536, 131072].map((n) => `<option ${n === s.numCtx ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="field-row">
        <label class="field"><span>${esc(t('thinkDefault'))}</span><select id="setThink">${['auto', 'on', 'off', 'low', 'medium', 'high'].map((k) => `<option value="${k}" ${s.think === k ? 'selected' : ''}>${esc(t('think_' + k))}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" id="setShowThink" ${s.showThinking ? 'checked' : ''}><span>${esc(t('showThinking'))}</span></label>
      </div>
    </section>
    <section><h3>${esc(t('modelRoles'))}</h3><p class="muted small">${esc(t('modelRolesSub'))}</p>
      <div class="pins">${ROLE_PINS.map(([r, k]) => `<label class="field"><span>${esc(t(k))}</span>${rolePinSelect(r)}</label>`).join('')}</div>
      <button type="button" class="btn small" data-goto="tools">${ic('box')}<span>${esc(t('manageModels'))}</span></button>
    </section>
    <div id="settingsExtra"></div>
    <section><h3>${esc(t('data'))}</h3>
      <p class="muted small">${esc(t('dataFolder'))}: <code dir="ltr">${esc(state.info?.home || '')}</code></p>
      <div class="row wrap"><button type="button" class="btn danger" id="wipeChats">${esc(t('deleteAll'))}</button><button type="button" class="btn" id="quitApp">${esc(t('quit'))}</button></div>
    </section>
    <section class="about">
      <img src="/brand/itcaf-horizontal-on-graphite.svg" class="logo-dark" alt="iT CAF"><img src="/brand/itcaf-horizontal-on-bone.svg" class="logo-light" alt="iT CAF">
      <p>${esc(t('about'))}</p>
      <div class="promo">
        <a class="promo-card" href="https://it-caf.com/" target="_blank" rel="noopener noreferrer">${ic('globe')}<span><b>${esc(t('promoSiteTitle'))}</b><small>${esc(t('promoSiteSub'))}</small></span><span class="url" dir="ltr">it-caf.com</span></a>
        <a class="promo-card" href="https://github.com/iT-CAF/CAF-AI" target="_blank" rel="noopener noreferrer">${ic('code')}<span><b>${esc(t('promoRepoTitle'))}</b><small>${esc(t('promoRepoSub'))}</small></span><span class="url" dir="ltr">github.com/iT-CAF/CAF-AI</span></a>
      </div>
      <p class="rights">${esc(t('rightsFull').replace('{y}', y).replace('{v}', v))}</p>
    </section>`;
  for (const sec of settingsSections) { try { sec($('settingsExtra')); } catch (e) { console.error(e); } }
  bindDialog();
  dlg.showModal();
}

function bindDialog() {
  const body = $('settingsBody');
  $('segLang').onclick = (e) => { const b = e.target.closest('button'); if (b) saveSettings({ lang: b.dataset.v }).then(() => { emit('ui:lang'); openSettings(); }); };
  $('segTheme').onclick = (e) => { const b = e.target.closest('button'); if (b) saveSettings({ theme: b.dataset.v }).then(() => { emit('ui:lang'); body.querySelectorAll('#segTheme button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === b.dataset.v))); }); };
  $('setTemp').oninput = (e) => { $('tempOut').textContent = e.target.value; };
  $('setTemp').onchange = (e) => saveSettings({ temperature: +e.target.value });
  $('setCtx').onchange = (e) => saveSettings({ numCtx: +e.target.value });
  $('setThink').onchange = (e) => saveSettings({ think: e.target.value }).then(() => emit('think:changed'));
  $('setShowThink').onchange = (e) => saveSettings({ showThinking: e.target.checked });
  $('setSystem').onchange = (e) => saveSettings({ systemPrompt: e.target.value }, { quiet: false });
  $('setCodeSystem').onchange = (e) => saveSettings({ codeSystemPrompt: e.target.value }, { quiet: false });
  body.querySelectorAll('[data-pin]').forEach((sel) => { sel.onchange = () => saveSettings({ modelsByRole: { [sel.dataset.pin]: sel.value } }, { quiet: false }); });
  $('wipeChats').onclick = async () => {
    if (!(await confirmBox(t('confirmDeleteAll'), { danger: true, ok: t('delete') }))) return;
    try { await api('DELETE', '/api/chats'); emit('chats:wiped'); toast(t('deleted')); } catch (e) { toast(errText(e)); }
  };
  $('quitApp').onclick = async () => {
    if (!(await confirmBox(t('confirmQuit')))) return;
    try { await api('POST', '/api/quit'); } catch { /* */ }
    document.body.innerHTML = `<p class="quit-done">${esc(t('quitDone'))}</p>`;
  };
}
