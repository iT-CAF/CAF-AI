/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// المهارات: صفحة إدارة (تفعيل، عرض، استيراد مجلد أو ملف)، منتقي مهارة في صندوق الكتابة، اختصارات لكل مساحة، وأوامر «/».
import { state, $, t, esc, ic, api, toast, on, emit, errText, confirmBox, lang, pages } from '../core.js';
import { renderMd } from '../md.js';
import { msgExtras } from '../chat.js';
import { addPending, removePending, pending, beforeSend, slashCommands, slashProviders, setInput, submit } from '../composer.js';

window.I18N_ADD({
  ar: {
    skills: 'المهارات', skillsSub: 'مهارات تجعل النموذج المحلي يعمل كخبير: كتابة، ترجمة، مراجعة كود، تحليل بيانات… تُفعَّل تلقائيًا حسب طلبك أو تختارها بنفسك. تتبع معيار Agent Skills المفتوح.',
    skillsAuto: 'تفعيل المهارة المناسبة تلقائيًا حسب الطلب', skillPick: 'اختر مهارة', skillSearch: 'ابحث في المهارات…', skillNone: 'لا توجد مهارات مطابقة',
    srcCaf: 'مدمجة · كآف', srcCommunity: 'مجتمعية · MIT', srcUser: 'مستوردة', allCollections: 'كل المجموعات', view: 'عرض', enabled: 'مفعّلة',
    importTitle: 'استيراد مهارات أو وكلاء', importSub: 'ألصق مسار مجلد على جهازك يحتوي ملفات SKILL.md أو وكلاء ‎.md‎ (مثل Agency Agents). تُنسخ إلى مجلد بياناتك ولا يُعدَّل المصدر.',
    importPathPh: '/Applications/Agency Agents.app/Contents/Resources/resources', importBtn: 'استيراد المجلد', uploadSkill: 'رفع ملف SKILL.md',
    imported: 'تم استيراد {n} مهارة إلى «{c}»', deleteCollection: 'حذف المجموعة', confirmDeleteCollection: 'حذف مجموعة المهارات المستوردة «{c}»؟ (المصدر الأصلي لا يتأثر)',
    activeSkill: 'المهارة', skillAutoBadge: 'تلقائيًا', useSkill: 'استخدمها الآن', chars: '{n} حرف', skillsCount: '{n} مهارة',
    err_folder_not_found: 'لم نجد هذا المجلد. تأكد من المسار.', err_no_skills: 'لا توجد مهارات في هذا المجلد (نبحث عن ملفات .md فيها name وdescription).', err_bad_skill: 'الملف لا يحتوي ترويسة name وdescription.',
  },
  en: {
    skills: 'Skills', skillsSub: 'Skills turn the local model into an expert: writing, translation, code review, data analysis… activated automatically per request or picked by you. They follow the open Agent Skills standard.',
    skillsAuto: 'Auto-activate the best skill for each request', skillPick: 'Pick a skill', skillSearch: 'Search skills…', skillNone: 'No matching skills',
    srcCaf: 'Built-in · CAF', srcCommunity: 'Community · MIT', srcUser: 'Imported', allCollections: 'All collections', view: 'View', enabled: 'Enabled',
    importTitle: 'Import skills or agents', importSub: 'Paste the path of a folder on your device with SKILL.md files or .md agents (like Agency Agents). They are copied into your data folder; the source is not modified.',
    importPathPh: '/Applications/Agency Agents.app/Contents/Resources/resources', importBtn: 'Import folder', uploadSkill: 'Upload a SKILL.md',
    imported: 'Imported {n} skills into “{c}”', deleteCollection: 'Delete collection', confirmDeleteCollection: 'Delete the imported skill collection “{c}”? (the original source is not affected)',
    activeSkill: 'Skill', skillAutoBadge: 'auto', useSkill: 'Use it now', chars: '{n} chars', skillsCount: '{n} skills',
    err_folder_not_found: 'Folder not found. Check the path.', err_no_skills: 'No skills in this folder (looking for .md files with name and description).', err_bad_skill: 'The file has no name/description header.',
  },
});

let list = []; let auto = true; let filter = ''; let coll = '';
const sname = (s) => (lang() === 'en' ? s.nameEn : s.nameAr);
const SRC = { caf: 'srcCaf', community: 'srcCommunity', user: 'srcUser' };
async function load(fresh) { const r = await api('GET', '/api/skills' + (fresh ? '?fresh=1' : '')); list = r.skills; auto = r.auto; return r; }

// ---------- اختيار مهارة للرسالة التالية ----------
function chooseSkill(s) {
  for (const p of pending.filter((x) => x.kind === 'skill')) removePending(p.key);
  addPending({ key: 'skill:' + s.id, kind: 'skill', label: `${s.emoji ? s.emoji + ' ' : ''}${sname(s)}`, title: s.description, payload: { skill: s.id } });
  $('input').focus();
}
function picker(anchor, query = '') {
  $('skillPop')?.remove();
  const pop = document.createElement('div'); pop.id = 'skillPop'; pop.className = 'pop-menu skill-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', t('skillPick'));
  pop.innerHTML = `<input type="search" class="sp-search" placeholder="${esc(t('skillSearch'))}" value="${esc(query)}" aria-label="${esc(t('skillSearch'))}"><div class="sp-list" role="listbox"></div>`;
  $('composer').appendChild(pop);
  const inp = pop.querySelector('input'); const box = pop.querySelector('.sp-list');
  const render = () => {
    const q = inp.value.trim().toLowerCase();
    const items = list.filter((s) => s.enabled && (!q || `${s.nameAr} ${s.nameEn} ${s.description} ${s.collection}`.toLowerCase().includes(q))).slice(0, 60);
    box.innerHTML = items.length ? items.map((s) => `<button type="button" role="option" data-pick="${esc(s.id)}"><span class="sp-emo">${esc(s.emoji || '✦')}</span><span class="sp-t"><b>${esc(sname(s))}</b><small>${esc(s.description.slice(0, 110))}</small></span><span class="chip">${esc(s.collection)}</span></button>`).join('') : `<p class="muted small">${esc(t('skillNone'))}</p>`;
  };
  render(); inp.focus();
  inp.oninput = render;
  inp.onkeydown = (e) => { if (e.key === 'Escape') pop.remove(); if (e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-pick]')?.click(); } if (e.key === 'ArrowDown') { e.preventDefault(); box.querySelector('button')?.focus(); } };
  box.onclick = (e) => { const b = e.target.closest('[data-pick]'); if (!b) return; chooseSkill(list.find((s) => s.id === b.dataset.pick)); pop.remove(); };
  setTimeout(() => document.addEventListener('click', function close(ev) { if (!pop.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) { pop.remove(); document.removeEventListener('click', close); } }), 0);
}

// اختصارات المهارات المدمجة حسب مساحة العمل
function renderChips() {
  const row = $('skillChips'); if (!row) return;
  const ws = state.workspace === 'code' ? 'code' : 'chat';
  const show = state.view === 'chat' && ws === 'chat';
  row.hidden = !show; if (!show) return;
  const items = list.filter((s) => s.enabled && s.source === 'caf' && s.workspaces.includes('chat')).slice(0, 7);
  row.innerHTML = items.map((s) => `<button type="button" data-chip="${esc(s.id)}" title="${esc(s.description)}">${esc(s.emoji)} ${esc(sname(s))}</button>`).join('');
}

// ---------- صفحة المهارات ----------
async function renderPage() {
  const v = $('viewSkills');
  v.innerHTML = `<div class="page"><header class="page-head"><div><h1>${esc(t('skills'))}</h1><p class="lead">${esc(t('skillsSub'))}</p></div></header><div class="loading">${esc(t('loading'))}</div></div>`;
  try { await load(true); } catch (e) { v.querySelector('.loading').textContent = errText(e); return; }
  const colls = [...new Set(list.map((s) => s.collection))];
  const userColls = [...new Set(list.filter((s) => s.source === 'user').map((s) => s.collection))];
  v.innerHTML = `<div class="page">
    <header class="page-head"><div><h1>${esc(t('skills'))} <span class="count">${esc(t('skillsCount', { n: list.length }))}</span></h1><p class="lead">${esc(t('skillsSub'))}</p></div>
      <label class="switch"><input type="checkbox" id="skAuto" ${auto ? 'checked' : ''}><span class="sw"></span><span>${esc(t('skillsAuto'))}</span></label></header>
    <section class="card">
      <h2>${ic('upload')}<span>${esc(t('importTitle'))}</span></h2>
      <p class="muted small">${esc(t('importSub'))}</p>
      <div class="row"><input id="skPath" dir="ltr" placeholder="${esc(t('importPathPh'))}" spellcheck="false" aria-label="${esc(t('importTitle'))}"><button class="btn primary" id="skImport">${ic('folder')}<span>${esc(t('importBtn'))}</span></button><button class="btn" id="skUpload">${ic('file')}<span>${esc(t('uploadSkill'))}</span></button></div>
      ${userColls.length ? `<div class="row wrap user-colls">${userColls.map((c) => `<span class="chip big">${esc(c)} · ${list.filter((s) => s.collection === c).length}<button class="mini" data-delcoll="${esc(c)}" title="${esc(t('deleteCollection'))}" aria-label="${esc(t('deleteCollection'))} ${esc(c)}">${ic('trash')}</button></span>`).join('')}</div>` : ''}
    </section>
    <div class="row sk-filter"><label class="search grow">${ic('search')}<input id="skSearch" type="search" placeholder="${esc(t('skillSearch'))}" value="${esc(filter)}"></label>
      <select id="skColl" aria-label="${esc(t('allCollections'))}"><option value="">${esc(t('allCollections'))}</option>${colls.map((c) => `<option ${c === coll ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="grid sk-grid" id="skGrid"></div></div>`;
  renderGrid();
  $('skAuto').onchange = async (e) => { await api('PUT', '/api/skills/state', { auto: e.target.checked }); auto = e.target.checked; toast(t('saved')); };
  $('skSearch').oninput = (e) => { filter = e.target.value; renderGrid(); };
  $('skColl').onchange = (e) => { coll = e.target.value; renderGrid(); };
  $('skImport').onclick = async () => {
    const p = $('skPath').value.trim(); if (!p) return;
    $('skImport').disabled = true;
    try { const r = await api('POST', '/api/skills/import', { path: p }); toast(t('imported', { n: r.imported, c: r.collection }), 4000); renderPage(); }
    catch (e) { toast(errText(e), 5000); } finally { $('skImport') && ($('skImport').disabled = false); }
  };
  $('skUpload').onclick = async () => {
    const { pickFiles } = await import('../composer.js');
    for (const f of await pickFiles({ accept: '.md,text/markdown' })) {
      try { await api('POST', `/api/skills/upload?name=${encodeURIComponent(f.name)}`, new Blob([await f.text()], { type: 'text/markdown' })); toast(t('saved')); } catch (e) { toast(errText(e)); }
    }
    renderPage();
  };
  v.querySelectorAll('[data-delcoll]').forEach((b) => { b.onclick = async () => { if (!(await confirmBox(t('confirmDeleteCollection', { c: b.dataset.delcoll }), { danger: true, ok: t('delete') }))) return; await api('DELETE', '/api/skills/collection/' + encodeURIComponent(b.dataset.delcoll)); renderPage(); }; });
}
function renderGrid() {
  const g = $('skGrid'); if (!g) return;
  const q = filter.trim().toLowerCase();
  const items = list.filter((s) => (!coll || s.collection === coll) && (!q || `${s.nameAr} ${s.nameEn} ${s.description}`.toLowerCase().includes(q)));
  g.innerHTML = items.slice(0, 400).map((s) => `<article class="card sk-card${s.enabled ? '' : ' off'}">
    <header><span class="sk-emo">${esc(s.emoji || '✦')}</span><div><b>${esc(sname(s))}</b><small class="muted">${esc(t(SRC[s.source]))} · ${esc(s.collection)}${s.command ? ` · /${esc(s.command)}` : ''}</small></div>
      <label class="switch sm" title="${esc(t('enabled'))}"><input type="checkbox" data-tog="${esc(s.id)}" ${s.enabled ? 'checked' : ''} aria-label="${esc(t('enabled'))} ${esc(sname(s))}"><span class="sw"></span></label></header>
    <p dir="auto">${esc(s.description)}</p>
    <footer><span class="muted small">${esc(t('chars', { n: s.chars.toLocaleString() }))}${s.license ? ' · ' + esc(s.license.slice(0, 40)) : ''}</span><span class="spacer"></span><button class="btn small" data-view="${esc(s.id)}">${ic('eye')}<span>${esc(t('view'))}</span></button><button class="btn small primary" data-use="${esc(s.id)}">${ic('sparkle')}<span>${esc(t('useSkill'))}</span></button></footer></article>`).join('') || `<p class="muted">${esc(t('skillNone'))}</p>`;
  g.onchange = async (e) => { const c = e.target.closest('[data-tog]'); if (!c) return; await api('PUT', '/api/skills/state', { toggle: [{ id: c.dataset.tog, enabled: c.checked }] }); const s = list.find((x) => x.id === c.dataset.tog); s.enabled = c.checked; c.closest('.sk-card').classList.toggle('off', !c.checked); };
  g.onclick = async (e) => {
    const vb = e.target.closest('[data-view]');
    if (vb) {
      const s = await api('GET', '/api/skills/item?id=' + encodeURIComponent(vb.dataset.view));
      const d = document.createElement('dialog'); d.className = 'skill-dlg';
      d.innerHTML = `<form method="dialog" class="dlg"><header><h2>${esc(s.emoji || '')} ${esc(sname(s))}</h2><button class="btn icon-only" value="close" aria-label="${esc(t('close'))}">${ic('close')}</button></header><div class="dlg-body"><p class="muted">${esc(s.description)}</p><div class="msg"><div class="body">${renderMd(s.body)}</div></div></div></form>`;
      document.body.appendChild(d); d.addEventListener('close', () => d.remove()); d.showModal();
      return;
    }
    const ub = e.target.closest('[data-use]');
    if (ub) { emit('workspace:set', 'chat'); chooseSkill(list.find((x) => x.id === ub.dataset.use)); }
  };
}

export async function init() {
  // الصفحة وزرّها في الشريط الجانبي
  const view = document.createElement('section'); view.className = 'view'; view.dataset.view = 'skills'; view.id = 'viewSkills'; view.hidden = true;
  document.querySelector('.views').appendChild(view);
  pages.skills = renderPage;
  const btn = document.createElement('button'); btn.className = 'btn ghost block'; btn.dataset.goto = 'skills';
  btn.innerHTML = `${ic('sparkle')}<span data-i18n="skills">${esc(t('skills'))}</span>`;
  document.querySelector('.side-foot [data-goto="tools"]').before(btn);
  // زر المنتقي في صندوق الكتابة + صف الاختصارات
  const pickBtn = document.createElement('button'); pickBtn.type = 'button'; pickBtn.className = 'btn icon-only'; pickBtn.id = 'skillBtn';
  pickBtn.title = t('skillPick'); pickBtn.setAttribute('aria-label', t('skillPick')); pickBtn.innerHTML = ic('sparkle');
  $('composerLeft').after(pickBtn);
  pickBtn.onclick = (e) => { e.stopPropagation(); if ($('skillPop')) $('skillPop').remove(); else picker(pickBtn); };
  const chips = document.createElement('div'); chips.id = 'skillChips'; chips.className = 'quick skill-chips'; chips.hidden = true;
  $('quick').before(chips);
  chips.onclick = (e) => { const b = e.target.closest('[data-chip]'); if (b) chooseSkill(list.find((s) => s.id === b.dataset.chip)); };
  beforeSend.push((opts) => { const sk = pending.filter((p) => p.kind === 'skill').map((p) => p.payload.skill); if (sk.length) opts.skills = sk; });
  slashCommands.push({ cmd: 'skill', icon: 'sparkle', label: () => t('skillPick'), run: (rest) => { picker(pickBtn, rest.trim()); return true; } });
  // المهارات داخل قائمة «/» (المدمجة والمستوردة)، بالبحث بالاسم العربي أو الإنجليزي
  slashProviders.push((q) => list.filter((s) => s.enabled && (!q || `${s.nameAr} ${s.nameEn} ${s.id} ${s.command || ''}`.toLowerCase().includes(q))).slice(0, q ? 25 : 12)
    .map((s) => ({ id: 'skill:' + s.id, group: t('skills'), emoji: s.emoji || '✦', label: sname(s), hint: s.command ? '/' + s.command : s.collection, pick: () => { setInput('', { focus: true }); chooseSkill(s); } })));
  // شارة المهارة على الرد
  msgExtras.push((m) => (m.role === 'assistant' && m.skills?.length ? `<div class="msg-skills">${m.skills.map((s) => `<span class="skill-badge" title="${esc(t('activeSkill'))}">${ic('sparkle')}${esc(s.emoji || '')} ${esc(s.name)}${s.auto ? ` <small>${esc(t('skillAutoBadge'))}</small>` : ''}</span>`).join('')}</div>` : ''));
  try {
    await load();
    // أوامر «/» لكل مهارة لها command (مثل /summary /translate /review)
    for (const s of list.filter((x) => x.command)) {
      slashCommands.push({ cmd: s.command, hidden: true, label: () => sname(s), run: (rest) => { chooseSkill(s); if (rest.trim()) { setInput(rest.trim(), { focus: false }); submit(); } return true; } });
    }
  } catch { /* الخادم غير متاح بعد */ }
  on('workspace:changed', renderChips); on('view:changed', renderChips); on('ui:applied', () => { renderChips(); pickBtn.title = t('skillPick'); });
  renderChips();
}
