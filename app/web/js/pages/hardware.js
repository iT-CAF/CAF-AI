/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// صفحة «جهازي»: ملف تعريف الجهاز والتوصيات.
import { state, $, t, esc, ic, api, errText } from '../core.js';
import { loadCatalog } from './tools.js';

const ROLE_KEYS = { chat: 'roleChat', code: 'roleCode', vision: 'roleVision', embed: 'roleEmbed', stt: 'roleStt' };
const gpuLabel = (g) => (g.kind === 'metal' ? t('gpuMetal') : g.kind === 'cuda' ? 'NVIDIA CUDA' : g.kind === 'rocm' ? 'AMD ROCm' : t('gpuNone'));

export async function loadHardware(refresh = false) {
  try { state.hardware = await api('GET', '/api/hardware' + (refresh ? '?refresh=1' : '')); } catch (e) { state.hardware = null; throw e; }
  return state.hardware;
}

export async function renderHardware(refresh = false) {
  const v = $('viewHardware');
  v.innerHTML = `<div class="page"><header class="page-head"><h1>${esc(t('myDevice'))}</h1><p class="lead">${esc(t('myDeviceSub'))}</p></header><div class="loading">${esc(t('measuring'))}</div></div>`;
  let hw;
  try { hw = await loadHardware(refresh); await loadCatalog(); } catch (e) { v.querySelector('.loading').textContent = errText(e); return; }
  const rec = state.catalog?.recommendations || {};
  const card = (icon, title, rows, note = '') => `<section class="card hw-card"><h2>${ic(icon)}<span>${esc(title)}</span></h2><dl>${rows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd dir="auto">${val}</dd></div>`).join('')}</dl>${note ? `<p class="note">${note}</p>` : ''}</section>`;
  const disk = hw.disk || {};
  const usbNote = disk.removable ? esc(t('usbNote')) : '';
  const speedWarn = disk.writeMBs !== null && disk.writeMBs < 60 ? `<span class="warn">${esc(t('slowDisk'))}</span>` : '';
  const tierName = t('tier_' + hw.tier);
  v.innerHTML = `<div class="page">
    <header class="page-head"><div><h1>${esc(t('myDevice'))}</h1><p class="lead">${esc(t('myDeviceSub'))}</p></div>
      <button class="btn" id="hwRefresh">${ic('refresh')}<span>${esc(t('remeasure'))}</span></button></header>
    <div class="tier-banner"><span class="tier-badge">${esc(tierName)}</span><span>${esc(t('budgetLine', { gb: hw.budget?.gb ?? '?' }))}${hw.budget?.cpuOnly ? ' · ' + esc(t('cpuOnlyNote')) : ''}</span></div>
    <div class="grid cards">
      ${card('chip', t('processor'), [[t('model'), esc(hw.cpu.model || '—')], [t('cores'), String(hw.cpu.cores) + (hw.cpu.performanceCores ? ` (${hw.cpu.performanceCores} ${esc(t('perfCores'))})` : '')], [t('arch'), esc(hw.cpu.arch)], ...(hw.cpu.avx2 === null ? [] : [['AVX2', hw.cpu.avx2 ? '✓' : '✗']])])}
      ${card('database', t('memory'), [[t('total'), `${hw.ram.totalGB} GB`], [t('available'), `${hw.ram.availableGB} GB`]])}
      ${card('device', t('graphics'), [[t('type'), esc(gpuLabel(hw.gpu))], [t('name'), esc(hw.gpu.name || '—')], ...(hw.gpu.vramGB ? [[hw.gpu.unified ? t('unifiedMem') : 'VRAM', `${hw.gpu.vramGB} GB`]] : [])], hw.gpu.usable ? '' : esc(t('noGpuNote')))}
      ${card('server', t('storage'), [[t('freeSpace'), disk.freeGB !== null ? `${disk.freeGB} GB` : '—'], [t('location'), `<code dir="ltr">${esc(disk.home)}</code>`], [t('removable'), disk.removable ? t('yes') : t('no')], [t('diskSpeed'), disk.writeMBs ? `${t('write')} ${disk.writeMBs} MB/s · ${t('read')} ${disk.readMBs} MB/s ${speedWarn}` : '—']], usbNote)}
      ${card('globe', t('system'), [[t('os'), esc(`${hw.os.platform} ${hw.os.release} (${hw.os.arch})`)], ['Node.js', esc(hw.node)], ['Ollama', esc(hw.engine?.ollama || '—')], [t('measuredAt'), esc(new Date(hw.measuredAt).toLocaleString(state.settings.lang === 'ar' ? 'ar' : 'en'))]])}
    </div>
    <h2 class="sec-title">${esc(t('recommendedForYou'))}</h2>
    <div class="grid recs">${Object.entries(ROLE_KEYS).map(([role, key]) => {
      const r = rec[role] || {};
      const name = r.recommended;
      const entry = (state.catalog?.models || []).find((m) => m.name === name);
      return `<section class="card rec"><h3>${esc(t(key))}</h3>${name ? `<p class="mono" dir="ltr">${esc(name)}</p><p class="muted">${entry ? esc(`${entry.sizeGB} GB · RAM ${entry.ramGB} GB${entry.moe ? ' · MoE' : ''} · ${entry.license}`) : ''}</p>${entry?.installed ? `<span class="ok-badge">${ic('check')}${esc(t('installed'))}</span>` : `<button class="btn small primary" data-pullmodel="${esc(name)}">${ic('download')}${esc(t('download'))}</button>`}` : `<p class="muted">${esc(t('noFit'))}</p>`}${r.installedBest && r.installedBest !== name ? `<p class="muted small">${esc(t('usingNow'))}: <span dir="ltr">${esc(r.installedBest)}</span></p>` : ''}</section>`;
    }).join('')}</div>
  </div>`;
  $('hwRefresh').onclick = () => renderHardware(true);
}
