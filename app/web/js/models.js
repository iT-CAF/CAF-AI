/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// النماذج: القائمة العلوية (تلقائي + المثبّتة)، التفكير، التنزيل مع تحذير الرام.
import { state, $, t, esc, api, readNdjson, authHeaders, errText, toast, emit, on, confirmBox } from './core.js';
import { downloads } from './downloads.js';

const capTags = (m) => {
  const c = m.capabilities || []; const tags = [];
  if (c.includes('vision')) tags.push(t('capVision'));
  if (c.includes('thinking')) tags.push(t('capThinking'));
  if (/coder|code/i.test(m.name)) tags.push(t('capCode'));
  if (m.moe) tags.push('MoE');
  return tags;
};
export const chatModels = () => state.models.filter((m) => !(m.capabilities || []).includes('embedding') || (m.capabilities || []).includes('completion'));

export async function loadModels() {
  try {
    state.models = (await api('GET', '/api/models')).models;
    $('status').classList.add('on'); $('status').title = t('online');
  } catch { state.models = []; $('status').classList.remove('on'); $('status').title = t('offline'); }
  const s = state.settings;
  // اختيار v1 لنموذج لم يعد مثبّتًا ← تلقائي
  if (s.model && s.model !== 'auto' && !state.models.find((m) => m.name === s.model)) {
    s.model = 'auto'; api('PUT', '/api/settings', { model: 'auto' }).catch(() => {});
  }
  renderModelSelect();
  emit('models:loaded');
}

export function renderModelSelect() {
  const sel = $('modelSelect'); if (!sel) return;
  const list = chatModels().filter((m) => (m.capabilities || []).includes('completion') || !(m.capabilities || []).length);
  if (!list.length) { sel.innerHTML = `<option value="">${esc(t('noModelSel'))}</option>`; updateThink(); return; }
  const cur = state.settings.model || 'auto';
  sel.innerHTML = `<option value="auto" ${cur === 'auto' ? 'selected' : ''}>${esc(t('autoModel'))}</option>`
    + list.map((m) => { const tags = capTags(m); return `<option value="${esc(m.name)}" ${m.name === cur ? 'selected' : ''}>${esc(m.name)}${tags.length ? ' · ' + esc(tags.join(' · ')) : ''}</option>`; }).join('');
  updateThink();
}

// التحكم في التفكير: يظهر عند وجود نموذج يدعمه (أو في الوضع التلقائي)
export function updateThink() {
  const sel = $('thinkSelect'); if (!sel) return;
  const cur = $('modelSelect')?.value || 'auto';
  const m = state.models.find((x) => x.name === cur);
  const anyThinking = state.models.some((x) => (x.capabilities || []).includes('thinking'));
  const supports = cur === 'auto' ? anyThinking : !!m && (m.capabilities || []).includes('thinking');
  $('thinkWrap').classList.toggle('hidden', !supports);
  sel.value = state.settings.think || 'auto';
  const gptoss = m && /^gpt-oss/.test(m.name);
  sel.querySelector('option[value="off"]').textContent = gptoss ? t('thinkOffNA') : t('thinkOff');
}

export async function pullModel(name, { confirmFit = true } = {}) {
  if (!/^[\w.\-:/]{1,120}$/.test(name)) { toast(t('err_bad_name')); return false; }
  if (confirmFit) {
    const entry = (state.catalog?.models || []).find((m) => m.name === name);
    if (entry && (entry.fit === 'too_big' || entry.fit === 'tight')) {
      const ok = await confirmBox(t(entry.fit === 'too_big' ? 'warnTooBig' : 'warnTight', { ram: entry.ramGB, have: state.hardware?.ram?.totalGB ?? '?' }), { ok: t('downloadAnyway'), danger: true });
      if (!ok) return false;
    } else if (entry && entry.fit === 'slow') {
      if (!(await confirmBox(t('warnSlow'), { ok: t('downloadAnyway') }))) return false;
    }
    if (entry?.licenseWarn && !(await confirmBox(t('warnLicense', { license: entry.license }), { ok: t('downloadAnyway') }))) return false;
  }
  const id = 'pull:' + name;
  const ac = new AbortController();
  downloads.start(id, name, () => ac.abort());
  try {
    const r = await fetch('/api/models/pull', { method: 'POST', signal: ac.signal, headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name }) });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch { /* */ } throw Object.assign(new Error(j.error || 'pull_failed'), { code: j.error }); }
    let ok = false;
    await readNdjson(r, (j) => {
      if (j.error) throw Object.assign(new Error(j.error), { code: j.error });
      if (j.status === 'success') ok = true;
      if (j.total && j.completed) downloads.update(id, { completed: j.completed, total: j.total, text: t('downloading') });
      else if (j.status) downloads.update(id, { text: j.status });
    });
    if (!ok) throw Object.assign(new Error('pull_failed'), { code: 'pull_failed' });
    downloads.done(id, t('modelReady'));
    await loadModels();
    emit('model:pulled', name);
    return true;
  } catch (e) {
    if (e.name === 'AbortError') { downloads.fail(id, t('canceled')); return false; }
    downloads.fail(id, errText(e.code ? e : 'pull_failed'));
    return false;
  }
}

export async function deleteModel(name) {
  if (!(await confirmBox(t('confirmDeleteModel') + `\n${name}`, { danger: true, ok: t('delete') }))) return;
  try { await api('DELETE', '/api/models', { name }); toast(t('deleted')); } catch (e) { toast(errText(e)); }
  await loadModels();
  emit('model:deleted', name);
}

export function bindModels() {
  $('modelSelect').onchange = async (e) => {
    state.settings = await api('PUT', '/api/settings', { model: e.target.value || 'auto' });
    updateThink();
  };
  $('thinkSelect').onchange = async (e) => { state.settings = await api('PUT', '/api/settings', { think: e.target.value }); };
  on('model:select', async (name) => { $('modelSelect').value = name; state.settings = await api('PUT', '/api/settings', { model: name }); updateThink(); });
  on('model:pull', (name) => pullModel(name));
}
