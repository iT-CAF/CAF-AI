/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// المهارات: صفحة إدارة (تفعيل، عرض، استيراد مجلد أو ملف)، منتقي مهارة في صندوق الكتابة، اختصارات لكل مساحة، وأوامر «/».
import { state, $, t, esc, ic, api, toast, on, emit, errText, confirmBox, lang, pages, download } from '../core.js';
import { renderMd, enhance } from '../md.js';
import { cm, themeExt } from '../editor.js';
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
    skNew: 'مهارة جديدة', skViewTab: 'المحتوى', skEditTab: 'تعديل', skAbout: 'الوصف', skWhen: 'متى تُفعَّل', skWhenAuto: 'تُختار تلقائيًا حين يطابق طلبك وصفها، أو يدويًا من زر المهارات و«/».',
    skWorkspaces: 'مساحات العمل', skCommand: 'الأمر المختصر', skNoCommand: 'بلا أمر مختصر', skSize: 'الحجم', skTokens: '≈ {n} رمز', skTrimNote: 'تُختصر تلقائيًا إلى نحو {n} حرف لتناسب سياق النموذج الحالي.',
    skFile: 'الملف', skVibe: 'الطابع', skEdited: 'معدّلة', skEditedNote: 'نسخة معدّلة محفوظة في مجلد بياناتك، والأصل محفوظ ويمكن استعادته.',
    skBundledNote: 'تعديل مهارة مدمجة يحفظ نسخة في مجلد بياناتك دون المساس بملفات البرنامج، فتبقى تعديلاتك بعد التحديثات.',
    fEmoji: 'الرمز', fNameAr: 'الاسم بالعربية', fNameEn: 'الاسم بالإنجليزية', fDesc: 'الوصف', fDescHint: 'جملة واضحة عمّا تفعله المهارة ومتى تُستخدم؛ يعتمد عليها الاختيار التلقائي.',
    fTriggers: 'كلمات التفعيل', fTriggersHint: 'افصل بينها بفاصلة. إذا ورد أيٌّ منها في طلبك تُفعَّل المهارة تلقائيًا.', fCommand: 'أمر مختصر', fCommandHint: 'حروف إنجليزية صغيرة وأرقام وشرطة، مثل review',
    fBody: 'تعليمات المهارة', fBodyHint: 'Markdown — هذا ما يقرؤه النموذج حرفيًا عند تفعيل المهارة.', livePreview: 'معاينة جانبية',
    saveSkill: 'حفظ التعديلات', createSkill: 'إضافة المهارة', resetSkill: 'استعادة الأصل', confirmReset: 'استعادة النسخة الأصلية من «{n}»؟ ستُحذف تعديلاتك.',
    deleteSkill: 'حذف المهارة', confirmDeleteSkill: 'حذف المهارة «{n}» من مجلد بياناتك؟', unsavedChanges: 'تغييرات غير محفوظة', discardChanges: 'لديك تغييرات غير محفوظة. تجاهلها؟',
    fixErrors: 'راجع الحقول المظلّلة', skillSaved: 'تم حفظ المهارة', skillCreated: 'تمت إضافة المهارة — تجدها في «/» وفي منتقي المهارات', skillReset: 'تمت استعادة النسخة الأصلية', skillDeleted: 'تم حذف المهارة',
    downloadMd: 'تنزيل الملف', editSkill: 'تعديل', saving: 'جارٍ الحفظ…', shortcutSave: '⌘S / Ctrl+S للحفظ',
    v_required: 'حقل مطلوب', v_too_long: 'أطول من الحد المسموح ({n})', v_too_many: 'العدد أكبر من الحد ({n})', v_bad_command: 'حروف إنجليزية صغيرة وأرقام وشرطة فقط (حتى 24)',
    skWs_chat: 'محادثة', skWs_code: 'برمجة', skWs_docs: 'مستندات', skWs_images: 'صور',
    skTemplate: '# {n}\n\n## الدور\nأنت خبير في …\n\n## طريقة العمل\n1. افهم الطلب وحدّد المطلوب بدقة.\n2. نفّذ المطلوب خطوة بخطوة مع أمثلة واضحة.\n\n## شكل الرد\n- رد منظّم بعناوين قصيرة ونقاط.\n- اختم بخطوة تالية مقترحة.\n',
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
    skNew: 'New skill', skViewTab: 'Content', skEditTab: 'Edit', skAbout: 'Description', skWhen: 'When it activates', skWhenAuto: 'Picked automatically when your request matches its description, or manually from the Skills button and “/”.',
    skWorkspaces: 'Workspaces', skCommand: 'Shortcut command', skNoCommand: 'No shortcut command', skSize: 'Size', skTokens: '≈ {n} tokens', skTrimNote: 'Automatically trimmed to about {n} characters to fit the current model context.',
    skFile: 'File', skVibe: 'Vibe', skEdited: 'Edited', skEditedNote: 'An edited copy saved in your data folder; the original is kept and can be restored.',
    skBundledNote: 'Editing a built-in skill saves a copy in your data folder without touching the app files, so your edits survive updates.',
    fEmoji: 'Icon', fNameAr: 'Arabic name', fNameEn: 'English name', fDesc: 'Description', fDescHint: 'A clear sentence on what the skill does and when to use it; auto-selection relies on it.',
    fTriggers: 'Trigger words', fTriggersHint: 'Separate with commas. If any appears in your request, the skill activates automatically.', fCommand: 'Shortcut command', fCommandHint: 'Lowercase letters, digits and dashes, e.g. review',
    fBody: 'Skill instructions', fBodyHint: 'Markdown — this is exactly what the model reads when the skill is active.', livePreview: 'Side preview',
    saveSkill: 'Save changes', createSkill: 'Add skill', resetSkill: 'Restore original', confirmReset: 'Restore the original “{n}”? Your edits will be removed.',
    deleteSkill: 'Delete skill', confirmDeleteSkill: 'Delete the skill “{n}” from your data folder?', unsavedChanges: 'Unsaved changes', discardChanges: 'You have unsaved changes. Discard them?',
    fixErrors: 'Check the highlighted fields', skillSaved: 'Skill saved', skillCreated: 'Skill added — find it in “/” and the skill picker', skillReset: 'Original restored', skillDeleted: 'Skill deleted',
    downloadMd: 'Download file', editSkill: 'Edit', saving: 'Saving…', shortcutSave: '⌘S / Ctrl+S to save',
    v_required: 'Required', v_too_long: 'Longer than allowed ({n})', v_too_many: 'Too many (max {n})', v_bad_command: 'Lowercase letters, digits and dashes only (up to 24)',
    skWs_chat: 'Chat', skWs_code: 'Code', skWs_docs: 'Documents', skWs_images: 'Images',
    skTemplate: '# {n}\n\n## Role\nYou are an expert in …\n\n## How to work\n1. Understand the request precisely.\n2. Work step by step with clear examples.\n\n## Response format\n- Short headings and bullet points.\n- End with a suggested next step.\n',
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
      <div class="page-acts"><label class="switch"><input type="checkbox" id="skAuto" ${auto ? 'checked' : ''}><span class="sw"></span><span>${esc(t('skillsAuto'))}</span></label><button class="btn primary" id="skNew">${ic('plus')}<span>${esc(t('skNew'))}</span></button></div></header>
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
  $('skNew').onclick = () => openSkill(null, { edit: true });
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
    <header><span class="sk-emo">${esc(s.emoji || '✦')}</span><div><button type="button" class="sk-title" data-skview="${esc(s.id)}">${esc(sname(s))}</button><small class="muted">${esc(t(SRC[s.source]))} · ${esc(s.collection)}${s.command ? ` · /${esc(s.command)}` : ''}${s.edited ? ` · <span class="sk-edited">${esc(t('skEdited'))}</span>` : ''}</small></div>
      <label class="switch sm" title="${esc(t('enabled'))}"><input type="checkbox" data-tog="${esc(s.id)}" ${s.enabled ? 'checked' : ''} aria-label="${esc(t('enabled'))} ${esc(sname(s))}"><span class="sw"></span></label></header>
    <p dir="auto">${esc(s.description)}</p>
    <footer><span class="muted small">${esc(t('chars', { n: s.chars.toLocaleString() }))}${s.license ? ' · ' + esc(s.license.slice(0, 40)) : ''}</span><span class="spacer"></span><button class="btn small" data-skview="${esc(s.id)}">${ic('eye')}<span>${esc(t('view'))}</span></button><button class="btn small icon-only" data-skedit="${esc(s.id)}" title="${esc(t('editSkill'))}" aria-label="${esc(t('editSkill'))} ${esc(sname(s))}">${ic('edit')}</button><button class="btn small primary" data-use="${esc(s.id)}">${ic('sparkle')}<span>${esc(t('useSkill'))}</span></button></footer></article>`).join('') || `<p class="muted">${esc(t('skillNone'))}</p>`;
  g.onchange = async (e) => { const c = e.target.closest('[data-tog]'); if (!c) return; await api('PUT', '/api/skills/state', { toggle: [{ id: c.dataset.tog, enabled: c.checked }] }); const s = list.find((x) => x.id === c.dataset.tog); s.enabled = c.checked; c.closest('.sk-card').classList.toggle('off', !c.checked); };
  g.onclick = (e) => {
    const vb = e.target.closest('[data-skview]'); if (vb) return openSkill(vb.dataset.skview);
    const eb = e.target.closest('[data-skedit]'); if (eb) return openSkill(eb.dataset.skedit, { edit: true });
    const ub = e.target.closest('[data-use]');
    if (ub) { emit('workspace:set', 'chat'); chooseSkill(list.find((x) => x.id === ub.dataset.use)); }
  };
}

// ---------- نافذة المهارة: عرض احترافي + تعديل كامل ----------
const WS = ['chat', 'code', 'docs', 'images'];
const LIM = { name: 80, description: 1024, trigger: 60, triggers: 40, command: 24 };
const ctxBudget = () => Math.max(1200, Math.min(9000, Math.round((state.settings?.numCtx || 4096) * 3.5 * 0.3)));
function docHtml(md) { const ws = state.workspace; state.workspace = 'chat'; try { return renderMd(md); } finally { state.workspace = ws; } }
const splitTriggers = (v) => String(v || '').split(/[|،,\n]/).map((x) => x.trim()).filter(Boolean);
function vErr(code) { const n = { too_long: '', too_many: LIM.triggers }[code]; return t('v_' + code, { n }); }

function validateLocal(f) {
  const e = {};
  if (!f.nameAr && !f.nameEn) e.nameAr = 'required';
  if (f.nameAr.length > LIM.name) e.nameAr = 'too_long:' + LIM.name;
  if (f.nameEn.length > LIM.name) e.nameEn = 'too_long:' + LIM.name;
  if (!f.description) e.description = 'required'; else if (f.description.length > LIM.description) e.description = 'too_long:' + LIM.description;
  if ([...f.emoji].length > 4) e.emoji = 'too_long:4';
  if (f.triggers.length > LIM.triggers) e.triggers = 'too_many'; else if (f.triggers.some((x) => x.length > LIM.trigger)) e.triggers = 'too_long:' + LIM.trigger;
  if (f.command && (!/^[a-z0-9][a-z0-9-]*$/.test(f.command) || f.command.length > LIM.command)) e.command = 'bad_command';
  if (!f.workspaces.length) e.workspaces = 'required';
  if (!f.body.trim()) e.body = 'required';
  return e;
}
const SERVER_LIM = { nameAr: LIM.name, nameEn: LIM.name, description: LIM.description, emoji: 4, triggers: LIM.trigger, body: '256 KB' };

export async function openSkill(id, { edit = false } = {}) {
  let s;
  if (id) { try { s = await api('GET', '/api/skills/item?id=' + encodeURIComponent(id)); } catch (e) { toast(errText(e)); return; } }
  else s = { id: null, nameAr: '', nameEn: '', description: '', emoji: '✨', source: 'user', collection: 'my-skills', triggers: [], workspaces: [...WS], command: '', body: '', chars: 0, deletable: false, resettable: false };
  const isNew = !s.id;
  const d = document.createElement('dialog'); d.className = 'skill-dlg skd-dlg'; d.setAttribute('aria-labelledby', 'skdTitle');
  const wsChips = (arr) => arr.map((w) => `<span class="chip">${esc(t('skWs_' + w))}</span>`).join('');
  const sideHtml = () => {
    const tok = Math.round(s.chars / 3.6); const trim = s.chars > ctxBudget();
    return `<div class="skd-box"><h4>${ic('info')}<span>${esc(t('skAbout'))}</span></h4><p dir="auto">${esc(s.description)}</p>${s.vibe ? `<p class="skd-vibe" dir="auto">“${esc(s.vibe)}”</p>` : ''}</div>
      <div class="skd-box"><h4>${ic('zap')}<span>${esc(t('skWhen'))}</span></h4>${s.triggers?.length ? `<div class="skd-chips">${s.triggers.map((x) => `<span class="chip trig" dir="auto">${esc(x)}</span>`).join('')}</div>` : ''}<p class="muted small">${esc(t('skWhenAuto'))}</p></div>
      <div class="skd-box"><h4>${ic('slash')}<span>${esc(t('skCommand'))}</span></h4>${s.command ? `<code class="skd-cmd" dir="ltr">/${esc(s.command)}</code>` : `<p class="muted small">${esc(t('skNoCommand'))}</p>`}</div>
      <div class="skd-box"><h4>${ic('panel')}<span>${esc(t('skWorkspaces'))}</span></h4><div class="skd-chips">${wsChips(s.workspaces || [])}</div></div>
      <div class="skd-box"><h4>${ic('file')}<span>${esc(t('skSize'))}</span></h4><p class="small"><b>${esc(t('chars', { n: s.chars.toLocaleString() }))}</b> · ${esc(t('skTokens', { n: tok.toLocaleString() }))}</p>${trim ? `<p class="muted small">${esc(t('skTrimNote', { n: ctxBudget().toLocaleString() }))}</p>` : ''}
        ${s.file ? `<p class="skd-path" dir="ltr" title="${esc(s.file)}">${esc(s.file)}</p>` : ''}${s.license ? `<p class="muted small">${esc(s.license.slice(0, 80))}</p>` : ''}</div>
      ${s.edited ? `<p class="skd-note">${ic('history')}<span>${esc(t('skEditedNote'))}</span></p>` : ''}`;
  };
  const headHtml = () => `<span class="skd-emo" aria-hidden="true">${esc(s.emoji || '✦')}</span>
      <div class="skd-titles"><h2 id="skdTitle" dir="auto">${esc(isNew ? t('skNew') : sname(s))}</h2>
        <div class="skd-meta">${isNew ? '' : `<span class="chip src-${esc(s.source)}">${esc(t(SRC[s.source]))}</span><span class="chip">${esc(s.collection)}</span>${s.command ? `<span class="chip mono" dir="ltr">/${esc(s.command)}</span>` : ''}${s.edited ? `<span class="chip edited">${ic('edit')}${esc(t('skEdited'))}</span>` : ''}`}</div></div>
      ${isNew ? '' : `<label class="switch sm" title="${esc(t('enabled'))}"><input type="checkbox" id="skdOn" ${s.enabled ? 'checked' : ''} aria-label="${esc(t('enabled'))}"><span class="sw"></span></label>`}
      <button type="button" class="btn icon-only" id="skdClose" aria-label="${esc(t('close'))}">${ic('close')}</button>`;
  const f0 = { emoji: s.emoji || '', nameAr: s.nameAr || '', nameEn: s.nameEn || '', description: s.description || '', triggers: (s.triggers || []).join('، '), command: s.command || '', workspaces: s.workspaces?.length ? s.workspaces : [...WS] };
  const field = (k, label, inner, hint = '') => `<div class="skd-field" data-f="${k}"><label for="skf_${k}">${esc(label)}</label>${inner}${hint ? `<small class="hint">${esc(hint)}</small>` : ''}<small class="err" role="alert"></small></div>`;
  d.innerHTML = `<div class="dlg skd">
    <header class="skd-head">${headHtml()}</header>
    <div class="skd-tabs" role="tablist" aria-label="${esc(sname(s) || t('skNew'))}">
      ${isNew ? '' : `<button type="button" role="tab" data-skdtab="view" aria-selected="true">${ic('eye')}<span>${esc(t('skViewTab'))}</span></button>`}
      <button type="button" role="tab" data-skdtab="edit" aria-selected="false">${ic('edit')}<span>${esc(t('skEditTab'))}</span></button>
      <span class="spacer"></span><span class="skd-dirty" hidden>● ${esc(t('unsavedChanges'))}</span>
    </div>
    <div class="skd-body">
      ${isNew ? '' : `<div class="skd-pane skd-view" data-pane="view" role="tabpanel"><article class="skd-doc msg"><div class="body">${docHtml(s.body)}</div></article><aside class="skd-side">${sideHtml()}</aside></div>`}
      <div class="skd-pane skd-edit" data-pane="edit" role="tabpanel" hidden>
        <div class="skd-form">
          ${s.source !== 'user' && !isNew ? `<p class="skd-note">${ic('shield')}<span>${esc(t('skBundledNote'))}</span></p>` : ''}
          <div class="skd-row3">${field('emoji', t('fEmoji'), `<input id="skf_emoji" class="emo-in" maxlength="16" value="${esc(f0.emoji)}">`)}${field('nameAr', t('fNameAr'), `<input id="skf_nameAr" dir="rtl" value="${esc(f0.nameAr)}">`)}</div>
          ${field('nameEn', t('fNameEn'), `<input id="skf_nameEn" dir="ltr" value="${esc(f0.nameEn)}">`)}
          ${field('description', t('fDesc'), `<textarea id="skf_description" rows="4" dir="auto">${esc(f0.description)}</textarea><span class="counter" data-for="description"></span>`, t('fDescHint'))}
          ${field('triggers', t('fTriggers'), `<input id="skf_triggers" dir="auto" value="${esc(f0.triggers)}" placeholder="لخّص، ملخص، summarize">`, t('fTriggersHint'))}
          ${field('command', t('fCommand'), `<div class="cmd-in"><span dir="ltr">/</span><input id="skf_command" dir="ltr" spellcheck="false" autocapitalize="off" value="${esc(f0.command)}" placeholder="review"></div>`, t('fCommandHint'))}
          ${field('workspaces', t('skWorkspaces'), `<div class="ws-pills" id="skf_workspaces">${WS.map((w) => `<label class="pill"><input type="checkbox" value="${w}" ${f0.workspaces.includes(w) ? 'checked' : ''}><span>${esc(t('skWs_' + w))}</span></label>`).join('')}</div>`)}
        </div>
        <div class="skd-editor">
          <div class="skd-ed-bar"><b>${ic('filepen')}<span>${esc(t('fBody'))}</span></b><small class="muted">${esc(t('fBodyHint'))}</small><span class="spacer"></span><span class="counter" data-for="body"></span>
            <button type="button" class="mini" id="skdSplit" aria-pressed="false" title="${esc(t('livePreview'))}">${ic('split')}<span>${esc(t('livePreview'))}</span></button></div>
          <div class="skd-ed-split" data-f="body"><div class="skd-cm" id="skdCm"></div><div class="skd-live msg" hidden><div class="body"></div></div></div>
          <small class="err skd-body-err" role="alert"></small>
        </div>
      </div>
    </div>
    <footer class="skd-foot">
      <span class="skd-status muted small" aria-live="polite"></span><span class="spacer"></span>
      <span class="skd-acts" data-for="view">
        <button type="button" class="btn" id="skdCopy">${ic('copy')}<span>${esc(t('copy'))}</span></button>
        <button type="button" class="btn" id="skdDl">${ic('download')}<span>${esc(t('downloadMd'))}</span></button>
        <button type="button" class="btn" id="skdToEdit">${ic('edit')}<span>${esc(t('editSkill'))}</span></button>
        <button type="button" class="btn primary" id="skdUse">${ic('sparkle')}<span>${esc(t('useSkill'))}</span></button>
      </span>
      <span class="skd-acts" data-for="edit" hidden>
        ${s.resettable ? `<button type="button" class="btn danger" id="skdReset">${ic('reset')}<span>${esc(t('resetSkill'))}</span></button>` : ''}
        ${s.deletable ? `<button type="button" class="btn danger" id="skdDel">${ic('trash')}<span>${esc(t('deleteSkill'))}</span></button>` : ''}
        <button type="button" class="btn" id="skdCancel">${esc(t('cancel'))}</button>
        <button type="button" class="btn primary" id="skdSave" title="${esc(t('shortcutSave'))}">${ic('save')}<span>${esc(t(isNew ? 'createSkill' : 'saveSkill'))}</span></button>
      </span>
    </footer></div>`;
  document.body.appendChild(d);
  const q = (sel) => d.querySelector(sel);
  let editor = null; let body0 = isNew ? t('skTemplate', { n: t('skNew') }).replace(/\\n/g, '\n') : s.body; let liveT = 0;
  const bodyText = () => (editor ? editor.state.doc.toString() : body0);
  const read = () => ({ emoji: q('#skf_emoji').value.trim(), nameAr: q('#skf_nameAr').value.trim(), nameEn: q('#skf_nameEn').value.trim(), description: q('#skf_description').value.replace(/\s*\n\s*/g, ' ').trim(),
    triggers: splitTriggers(q('#skf_triggers').value), command: q('#skf_command').value.trim().replace(/^\//, ''), workspaces: [...d.querySelectorAll('#skf_workspaces input:checked')].map((x) => x.value), body: bodyText() });
  const snap = (f) => JSON.stringify(f);
  let base = null; // لقطة القيم الأصلية بعد إنشاء المحرر
  const dirty = () => base !== null && snap(read()) !== base;
  const counters = () => {
    const f = read();
    const c1 = q('.counter[data-for="description"]'); c1.textContent = `${f.description.length} / ${LIM.description}`; c1.classList.toggle('over', f.description.length > LIM.description);
    q('.counter[data-for="body"]').textContent = t('chars', { n: f.body.length.toLocaleString() });
  };
  const refresh = () => { counters(); q('.skd-dirty').hidden = !dirty(); };
  const showErrors = (errs) => {
    d.querySelectorAll('.skd-field, .skd-ed-split').forEach((el) => el.classList.remove('bad'));
    d.querySelectorAll('.err').forEach((el) => { el.textContent = ''; });
    for (const [k, code] of Object.entries(errs)) {
      const [c, n] = String(code).split(':');
      const msg = t('v_' + c, { n: n || SERVER_LIM[k] || LIM.triggers });
      if (k === 'body') { q('.skd-ed-split').classList.add('bad'); q('.skd-body-err').textContent = msg; continue; }
      const box = q(`.skd-field[data-f="${k}"]`); if (!box) continue; box.classList.add('bad'); box.querySelector('.err').textContent = msg;
    }
    const n = Object.keys(errs).length;
    q('.skd-status').textContent = n ? t('fixErrors') : '';
    if (n) (q('.skd-field.bad input, .skd-field.bad textarea') || q('.skd-cm .cm-content'))?.focus();
  };
  const renderLive = () => { const lv = q('.skd-live'); if (lv.hidden) return; lv.querySelector('.body').innerHTML = docHtml(bodyText()); enhance(lv); };
  async function ensureEditor() {
    if (editor) return;
    const C = await cm();
    editor = new C.EditorView({
      parent: q('#skdCm'),
      state: C.EditorState.create({ doc: body0, extensions: [C.basicSetup, C.languages.markdown(), C.EditorView.lineWrapping, C.EditorView.perLineTextDirection.of(true), themeExt(C),
        C.EditorView.theme({ '.cm-scroller': { fontFamily: 'var(--f-ui)', lineHeight: '1.85', fontSize: '14.5px' }, '.cm-line': { unicodeBidi: 'plaintext', textAlign: 'start' }, '.cm-content': { padding: '14px 0' } }),
        C.keymap.of([C.indentWithTab, { key: 'Mod-s', preventDefault: true, run: () => { doSave(); return true; } }]),
        C.EditorView.contentAttributes.of({ 'aria-label': t('fBody') }),
        C.EditorView.updateListener.of((u) => { if (u.docChanged) { refresh(); clearTimeout(liveT); liveT = setTimeout(renderLive, 250); } })] }),
    });
    base = isNew ? '' : snap(read());
    refresh();
  }
  const setTab = async (tab) => {
    d.querySelectorAll('[data-skdtab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.skdtab === tab)));
    d.querySelectorAll('.skd-pane').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
    d.querySelectorAll('.skd-acts').forEach((p) => { p.hidden = p.dataset.for !== tab; });
    d.classList.toggle('editing', tab === 'edit');
    if (tab === 'edit') { await ensureEditor(); if (isNew) q('#skf_nameAr').focus(); }
  };
  const close = async () => { if (dirty() && !(await confirmBox(t('discardChanges'), { danger: true, ok: t('ok') }))) return; d.close(); };
  async function doSave() {
    const f = read(); const errs = validateLocal(f);
    if (Object.keys(errs).length) return showErrors(errs);
    showErrors({});
    const btn = q('#skdSave'); btn.disabled = true; q('.skd-status').textContent = t('saving');
    try {
      const { body, ...fields } = f;
      const r = isNew ? await api('POST', '/api/skills/new', { fields, body }) : await api('PUT', '/api/skills/item', { id: s.id, fields, body });
      toast(t(isNew ? 'skillCreated' : 'skillSaved'), 3500);
      await afterChange();
      base = null; d.close(); openSkill(r.id);
    } catch (e) {
      if (e.data?.fields) showErrors(e.data.fields); else { q('.skd-status').textContent = errText(e); toast(errText(e), 4000); }
    } finally { btn.disabled = false; }
  }
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  d.addEventListener('close', () => { editor?.destroy(); d.remove(); });
  d.addEventListener('input', (e) => { if (e.target.closest('.skd-form')) { refresh(); const b = e.target.closest('.skd-field'); if (b?.classList.contains('bad')) { b.classList.remove('bad'); b.querySelector('.err').textContent = ''; } } });
  d.addEventListener('change', (e) => { if (e.target.closest('#skf_workspaces')) refresh(); });
  d.addEventListener('click', async (e) => {
    const tb = e.target.closest('[data-skdtab]'); if (tb) return setTab(tb.dataset.skdtab);
    const cp = e.target.closest('[data-copy]'); if (cp) { await navigator.clipboard.writeText(cp.closest('.codeblock').querySelector('pre.src code').textContent); toast(t('copied')); return; }
    const wr = e.target.closest('[data-wrap]'); if (wr) { wr.closest('.codeblock').classList.toggle('wrap'); return; }
  });
  d.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && d.classList.contains('editing')) { e.preventDefault(); doSave(); } });
  q('#skdClose').onclick = close;
  q('#skdOn')?.addEventListener('change', async (e) => { await api('PUT', '/api/skills/state', { toggle: [{ id: s.id, enabled: e.target.checked }] }); const it = list.find((x) => x.id === s.id); if (it) it.enabled = e.target.checked; renderGrid(); toast(t('saved')); });
  q('#skdSplit').onclick = (e) => { const b = e.currentTarget; const on2 = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on2)); q('.skd-live').hidden = !on2; q('.skd-ed-split').classList.toggle('split', on2); renderLive(); };
  if (!isNew) {
    q('#skdCopy').onclick = async () => { await navigator.clipboard.writeText(s.body); toast(t('copied')); };
    q('#skdDl').onclick = () => download(new Blob([s.raw || s.body], { type: 'text/markdown' }), (s.id.split('/').pop() || 'skill') + '.md');
    q('#skdToEdit').onclick = () => setTab('edit');
    q('#skdUse').onclick = () => { base = null; d.close(); emit('workspace:set', 'chat'); chooseSkill(list.find((x) => x.id === s.id) || s); };
  }
  q('#skdCancel').onclick = async () => { if (isNew) return close(); if (dirty() && !(await confirmBox(t('discardChanges'), { danger: true, ok: t('ok') }))) return; d.close(); openSkill(s.id); };
  q('#skdSave').onclick = doSave;
  q('#skdReset')?.addEventListener('click', async () => { if (!(await confirmBox(t('confirmReset', { n: sname(s) }), { danger: true, ok: t('resetSkill') }))) return; await api('DELETE', '/api/skills/item?id=' + encodeURIComponent(s.id)); toast(t('skillReset')); await afterChange(); base = null; d.close(); openSkill(s.id); });
  q('#skdDel')?.addEventListener('click', async () => { if (!(await confirmBox(t('confirmDeleteSkill', { n: sname(s) }), { danger: true, ok: t('delete') }))) return; await api('DELETE', '/api/skills/item?id=' + encodeURIComponent(s.id)); toast(t('skillDeleted')); await afterChange(); base = null; d.close(); });
  d.showModal();
  if (isNew || edit) await setTab('edit'); else { enhance(q('.skd-doc')); q('[data-skdtab="view"]').focus(); }
}
// بعد أي تعديل: تحديث القائمة وأوامر «/» والشبكة
async function afterChange() { await load(true); syncCommands(); if ($('skGrid')) renderGrid(); renderChips(); }
// أوامر «/» لكل مهارة لها command (مثل /summary /translate /review) — تُعاد مزامنتها بعد التعديل
function syncCommands() {
  for (let i = slashCommands.length - 1; i >= 0; i--) if (slashCommands[i].skill) slashCommands.splice(i, 1);
  for (const s of list.filter((x) => x.command && x.enabled)) {
    if (slashCommands.some((c) => c.cmd === s.command)) continue; // لا تطغى على أوامر النظام
    slashCommands.push({ cmd: s.command, skill: s.id, hidden: true, label: () => sname(s), run: (rest) => { chooseSkill(s); if (rest.trim()) { setInput(rest.trim(), { focus: false }); submit(); } return true; } });
  }
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
    syncCommands();
  } catch { /* الخادم غير متاح بعد */ }
  on('workspace:changed', renderChips); on('view:changed', renderChips); on('ui:applied', () => { renderChips(); pickBtn.title = t('skillPick'); });
  renderChips();
}
