/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// صفحة «الأدوات المثبّتة»: المساحة، النماذج المثبّتة، كتالوج النماذج مع التوصيات، والمحركات الإضافية.
import { state, $, t, esc, ic, api, errText, toast, fmtBytes, emit, on } from '../core.js';
import { pullModel, deleteModel, loadModels } from '../models.js';

const ROLES = [['chat', 'roleChat'], ['code', 'roleCode'], ['vision', 'roleVision'], ['embed', 'roleEmbed'], ['stt', 'roleStt']];
let tab = 'chat';
// أقسام إضافية تسجّلها وحدات أخرى (توليد الصور، الصوت، Pyodide)
export const toolSections = [];

export async function loadCatalog() {
  state.catalog = await api('GET', '/api/catalog');
  return state.catalog;
}

const fitBadge = (f) => `<span class="fit fit-${f}">${esc(t('fit_' + f))}</span>`;
const stars = (n) => `<span class="stars" title="${esc(t('arabicQuality'))}" aria-label="${esc(t('arabicQuality'))} ${n}/5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
const capChips = (caps) => (caps || []).filter((c) => !['completion', 'insert', 'chat'].includes(c)).map((c) => `<span class="chip">${esc(t('cap_' + c) !== 'cap_' + c ? t('cap_' + c) : c)}</span>`).join('');

export async function renderTools() {
  const v = $('viewTools');
  v.innerHTML = `<div class="page"><header class="page-head"><h1>${esc(t('installedTools'))}</h1><p class="lead">${esc(t('installedToolsSub'))}</p></header><div class="loading">${esc(t('loading'))}</div></div>`;
  let storage = null;
  try { [storage] = await Promise.all([api('GET', '/api/storage'), loadCatalog(), loadModels()]); }
  catch (e) { v.querySelector('.loading').textContent = errText(e); return; }
  const cat = state.catalog;
  const installedRows = state.models.map((m) => `<tr><td><span class="mono" dir="ltr">${esc(m.name)}</span>${m.moe ? ' <span class="chip">MoE</span>' : ''}</td><td>${capChips(m.capabilities)}</td><td>${fmtBytes(m.size)}</td><td class="end"><button class="btn small danger" data-delmodel="${esc(m.name)}">${ic('trash')}${esc(t('delete'))}</button></td></tr>`).join('');
  const s = storage || {};
  v.innerHTML = `<div class="page">
    <header class="page-head"><div><h1>${esc(t('installedTools'))}</h1><p class="lead">${esc(t('installedToolsSub'))}</p></div></header>
    <section class="card storage">
      <h2>${ic('server')}<span>${esc(t('storageUsed'))}</span></h2>
      <div class="storage-bars">
        ${[['models', t('stModels'), s.models], ['extras', t('stExtras'), s.extras], ['data', t('stData'), s.data], ['runtime', t('stRuntime'), s.runtime]].map(([k, label, val]) => `<div class="sb"><span>${esc(label)}</span><b>${fmtBytes(val?.bytes || 0)}</b></div>`).join('')}
        <div class="sb total"><span>${esc(t('total'))}</span><b>${fmtBytes(s.totalBytes || 0)}</b></div>
        <div class="sb"><span>${esc(t('freeSpace'))}</span><b>${s.freeBytes ? fmtBytes(s.freeBytes) : '—'}</b></div>
      </div>
      <p class="muted small">${esc(t('dataFolder'))}: <code dir="ltr">${esc(s.home || '')}</code> · ${esc(t('modelsFolder'))}: <code dir="ltr">${esc(s.modelsDir || '')}</code>${s.sharedModels ? ` <span class="chip">${esc(t('sharedWithOllama'))}</span>` : ''}</p>
    </section>

    <section class="card">
      <h2>${ic('chip')}<span>${esc(t('installedModels'))}</span> <span class="count">${state.models.length}</span></h2>
      ${state.models.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>${esc(t('name'))}</th><th>${esc(t('capabilities'))}</th><th>${esc(t('size'))}</th><th></th></tr></thead><tbody>${installedRows}</tbody></table></div>` : `<p class="muted">${esc(t('noModels'))}</p>`}
    </section>

    <section class="card">
      <h2>${ic('grid')}<span>${esc(t('modelCatalog'))}</span><span class="muted small">${esc(t('catalogVersion', { v: cat.version }))}</span></h2>
      <p class="muted small">${esc(t('catalogNote'))}</p>
      <div class="tabs" role="tablist">${ROLES.map(([r, k]) => `<button role="tab" data-tab="${r}" aria-selected="${tab === r}">${esc(t(k))}</button>`).join('')}</div>
      <div id="catList"></div>
      <div class="row custom-pull"><input id="pullName" dir="ltr" placeholder="${esc(t('customModelPh'))}" spellcheck="false" aria-label="${esc(t('customModel'))}"><button class="btn primary" id="pullBtn">${ic('download')}<span>${esc(t('download'))}</span></button></div>
      <div class="row"><button class="btn small ghost" id="catUpdate">${ic('refresh')}<span>${esc(t('updateCatalog'))}</span></button></div>
    </section>
    <div id="toolExtras"></div>
  </div>`;
  renderCatList();
  for (const sec of toolSections) { try { await sec($('toolExtras')); } catch (e) { console.error(e); } }

  v.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; v.querySelectorAll('.tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); renderCatList(); };
  $('pullBtn').onclick = async () => { const n = $('pullName').value.trim(); if (!n) return; if (await pullModel(n)) { $('pullName').value = ''; renderTools(); } };
  $('pullName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('pullBtn').click(); });
  $('catUpdate').onclick = async () => {
    try { const r = await api('POST', '/api/catalog/update'); toast(r.updated ? t('catalogUpdated', { v: r.version }) : t('catalogLatest')); renderTools(); }
    catch (e) { toast(errText(e)); }
  };
}

function renderCatList() {
  const box = $('catList'); if (!box) return;
  const cat = state.catalog;
  const rec = cat.recommendations?.[tab]?.recommended;
  const FIT_ORDER = { ok: 0, slow: 1, tight: 2, too_big: 3 };
  const list = cat.models.filter((m) => m.rank && m.rank[tab]).sort((a, b) => (b.name === rec) - (a.name === rec) || FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || b.rank[tab] - a.rank[tab]);
  box.innerHTML = `<ul class="cat-list">${list.map((m) => `<li class="${m.name === rec ? 'is-rec' : ''}">
    <div class="cat-main"><span class="mono" dir="ltr">${esc(m.name)}</span>${m.name === rec ? `<span class="rec-badge">${ic('check')}${esc(t('recForDevice'))}</span>` : ''}${m.moe ? '<span class="chip">MoE</span>' : ''}${capChips(m.caps)}
      <div class="muted small">${esc(m.family)} · ${esc(m.params)} · ${m.sizeGB} GB · RAM ${m.ramGB} GB · ${stars(m.arabic)} · <span class="${m.licenseWarn ? 'warn' : ''}">${esc(m.license)}</span></div></div>
    <div class="cat-acts">${fitBadge(m.fit)}${m.installed ? `<span class="ok-badge">${ic('check')}${esc(t('installed'))}</span>` : `<button class="btn small ${m.name === rec ? 'primary' : ''}" data-pullmodel="${esc(m.name)}">${ic('download')}${esc(t('download'))}</button>`}</div>
  </li>`).join('')}</ul>`;
}

export function bindTools() {
  document.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-delmodel]');
    if (d) { await deleteModel(d.dataset.delmodel); if (state.view === 'tools') renderTools(); }
  });
  on('model:pulled', () => { if (state.view === 'tools') renderTools(); if (state.view === 'hardware') emit('view:refresh'); });
}
