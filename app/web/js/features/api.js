/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// إعدادات الواجهة البرمجية المحلية (‎/v1‎ متوافقة مع OpenAI): تفعيل، عنوان، مفتاح (إظهار/نسخ/تدوير)، وأمثلة جاهزة.
import { state, t, esc, ic, api, toast, confirmBox, errText } from '../core.js';
import { settingsSections, saveSettings } from '../settings.js';

window.I18N_ADD({
  ar: {
    apiTitle: 'الواجهة البرمجية المحلية', apiSub: 'اربط تطبيقاتك وأدواتك على هذا الجهاز بكآف AI عبر واجهة متوافقة مع OpenAI — بلا إنترنت وبلا حسابات.',
    apiEnable: 'تفعيل الواجهة البرمجية', apiEnableHint: 'تستمع على 127.0.0.1 فقط، وتتطلب المفتاح أدناه، وترفض طلبات المواقع الأخرى.',
    apiBase: 'العنوان (Base URL)', apiKey: 'المفتاح', apiShow: 'إظهار', apiHide: 'إخفاء', apiRotate: 'مفتاح جديد', apiRotateConfirm: 'إنشاء مفتاح جديد؟ ستتوقف التطبيقات التي تستخدم المفتاح الحالي حتى تحدّثها.',
    apiRotated: 'تم إنشاء مفتاح جديد', apiExample: 'جرّبها', apiDocs: 'الدليل الكامل (curl و PHP و JavaScript و Python)', apiModelsHint: 'استخدم model: "auto" ليختار كآف AI النموذج الأنسب لكل طلب.',
  },
  en: {
    apiTitle: 'Local API', apiSub: 'Connect your apps and tools on this device to CAF AI through an OpenAI-compatible API — offline, no accounts.',
    apiEnable: 'Enable the local API', apiEnableHint: 'Listens on 127.0.0.1 only, requires the key below, and rejects requests from other websites.',
    apiBase: 'Base URL', apiKey: 'Key', apiShow: 'Show', apiHide: 'Hide', apiRotate: 'New key', apiRotateConfirm: 'Create a new key? Apps using the current key will stop working until you update them.',
    apiRotated: 'New key created', apiExample: 'Try it', apiDocs: 'Full guide (curl, PHP, JavaScript, Python)', apiModelsHint: 'Use model: "auto" to let CAF AI pick the best installed model for each request.',
  },
});

async function render(el) {
  el.innerHTML = `<h3>${esc(t('apiTitle'))}</h3><p class="muted small">${esc(t('apiSub'))}</p><div class="loading">${esc(t('loading'))}</div>`;
  let k; try { k = await api('GET', '/api/apikey'); } catch (e) { el.querySelector('.loading').textContent = errText(e); return; }
  let shown = false;
  const mask = (s) => s.slice(0, 8) + '•'.repeat(20) + s.slice(-4);
  const curl = () => `curl ${k.baseUrl}/chat/completions \\\n  -H "Authorization: Bearer ${shown ? k.key : 'caf-…'}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"auto","messages":[{"role":"user","content":"مرحبا"}]}'`;
  el.innerHTML = `<h3>${esc(t('apiTitle'))}</h3><p class="muted small">${esc(t('apiSub'))}</p>
    <div class="set-row"><div class="set-l"><b>${esc(t('apiEnable'))}</b><small>${esc(t('apiEnableHint'))}</small></div><div class="set-c"><label class="switch"><input type="checkbox" id="apiOn" ${state.settings.apiEnabled ? 'checked' : ''}><span class="sw"></span></label></div></div>
    <div class="api-box${state.settings.apiEnabled ? '' : ' off'}" id="apiBox">
      <label class="api-f"><span>${esc(t('apiBase'))}</span><span class="api-v"><code dir="ltr" id="apiBase">${esc(k.baseUrl)}</code><button type="button" class="mini" data-copy-v="base" title="${esc(t('copy'))}" aria-label="${esc(t('copy'))}">${ic('copy')}</button></span></label>
      <label class="api-f"><span>${esc(t('apiKey'))}</span><span class="api-v"><code dir="ltr" id="apiKeyV">${esc(mask(k.key))}</code>
        <button type="button" class="mini" id="apiShow">${ic('eye')}<span>${esc(t('apiShow'))}</span></button><button type="button" class="mini" data-copy-v="key" title="${esc(t('copy'))}" aria-label="${esc(t('copy'))}">${ic('copy')}</button><button type="button" class="mini" id="apiRot">${ic('refresh')}<span>${esc(t('apiRotate'))}</span></button></span></label>
      <p class="muted small">${ic('info')} ${esc(t('apiModelsHint'))}</p>
      <div class="api-ex"><div class="api-ex-h"><b>${ic('terminal')}<span>${esc(t('apiExample'))}</span></b><button type="button" class="mini" data-copy-v="curl">${ic('copy')}<span>${esc(t('copy'))}</span></button></div><pre dir="ltr" id="apiCurl"></pre></div>
      <a class="btn" href="https://github.com/iT-CAF/CAF-AI/blob/main/docs/API.md" target="_blank" rel="noopener noreferrer">${ic('book')}<span>${esc(t('apiDocs'))}</span>${ic('external')}</a>
    </div>`;
  const q = (s) => el.querySelector(s);
  const paint = () => { q('#apiKeyV').textContent = shown ? k.key : mask(k.key); q('#apiShow span').textContent = t(shown ? 'apiHide' : 'apiShow'); q('#apiCurl').textContent = curl(); };
  paint();
  q('#apiOn').onchange = async (e) => { await saveSettings({ apiEnabled: e.target.checked }, { quiet: false }); q('#apiBox').classList.toggle('off', !e.target.checked); };
  q('#apiShow').onclick = () => { shown = !shown; paint(); };
  q('#apiRot').onclick = async () => { if (!(await confirmBox(t('apiRotateConfirm'), { danger: true, ok: t('apiRotate') }))) return; k.key = (await api('POST', '/api/apikey/rotate')).key; shown = true; paint(); toast(t('apiRotated')); };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy-v]'); if (!b) return;
    const v = b.dataset.copyV === 'base' ? k.baseUrl : b.dataset.copyV === 'key' ? k.key : curl().replace('caf-…', k.key);
    await navigator.clipboard.writeText(v); toast(t('copied'));
  });
}

export function init() { settingsSections.push({ id: 'api', icon: 'terminal', label: () => t('apiTitle'), render }); }
