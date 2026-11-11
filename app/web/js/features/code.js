/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// مساحة الكود: اللوحة الجانبية (CodeMirror 6) بالنسخ والفروق، «اطلب تعديل»، المعاينة الحية، التشغيل الآمن،
// تنزيل الكود بالامتداد الصحيح، إرفاق ملفات ومجلد مشروع، والأوامر السريعة.
import { state, $, t, esc, ic, uid, api, readNdjson, toast, on, emit, download, promptBox, confirmBox, errText, ApiError } from '../core.js';
import { EXT, guessFileName, isArtifact } from '../md.js';
import { msgExtras, artifactMode } from '../chat.js';
import { addPending, beforeSend, pending, addAttachItem, pickFiles, slashCommands, setInput, submit } from '../composer.js';
import { runJS, runPython, mountPreview, LANG_KIND } from '../runners.js';
import { cm, themeExt } from '../editor.js';

window.I18N_ADD({
  ar: {
    canvas: 'اللوحة الجانبية', attach: 'إرفاق', attachCode: 'ملفات كود', attachFolder: 'مجلد مشروع', saveVersion: 'حفظ نسخة', versions: 'النسخ', version: 'نسخة',
    showDiff: 'الفروق مع النسخة السابقة', hideDiff: 'إخفاء الفروق', preview: 'معاينة', livePreview: 'معاينة حية معزولة', output: 'المخرجات', clear: 'مسح',
    askEdit: 'اطلب تعديلًا على الجزء المحدد (أو الملف كله)…', applyEdit: 'عدّل', editing: 'يعدّل…', selWhole: 'الملف كاملًا', selLines: '{n} سطر محدد',
    editDone: 'تم التعديل — راجع الفروق', editNoCode: 'لم يُرجع النموذج كودًا صالحًا.', fileName: 'اسم الملف', language: 'اللغة', unsaved: 'غير محفوظ',
    runTimeout: 'توقّف التشغيل: تجاوز {s} ثانية (حلقة لا تنتهي؟).', pyInstallAsk: 'تشغيل Python يحتاج تنزيل Pyodide مرة واحدة ({size}) إلى مجلد كآف AI. بعدها يعمل بدون إنترنت. متابعة؟',
    pyNotInstalled: 'Pyodide غير مثبّت.', pyLoadFailed: 'تعذّر تحميل Python في المتصفح.', pyLoading: 'تحميل Python…', running: 'يعمل…', ranIn: 'انتهى في {ms} م.ث', extracting: 'فك الضغط', installedOk: 'تم التثبيت',
    folderTitle: 'إرفاق مجلد مشروع', folderSub: 'اخترنا الملفات النصية فقط وتجاهلنا node_modules و.git والملفات الثنائية. الحد التقريبي: {limit} توكن.', folderUse: 'إرفاق المحدد',
    tokensEst: '≈ {n} توكن', overBudget: 'المحدد أكبر من حجم السياق ({ctx}). سيُقصّ النموذج أو يتجاهل جزءًا — ألغِ تحديد بعض الملفات أو كبّر حجم السياق من الإعدادات.',
    filesSkipped: 'تُجوهل {n} ملف (ثنائي أو كبير)', codeFiles: 'ملفات', noTextFiles: 'لا توجد ملفات نصية في هذا الاختيار.',
    qExplain: 'اشرح الكود', qBugs: 'اكتشف الأخطاء', qRefactor: 'أعد الهيكلة', qTests: 'اكتب اختبارات', qComments: 'تعليقات بالعربية', qConvert: 'حوّل إلى لغة أخرى',
    pExplain: 'اشرح هذا الكود خطوة بخطوة بالعربية، ثم لخّص ما يفعله في سطرين:', pBugs: 'راجع هذا الكود واكتشف الأخطاء والثغرات والحالات الحدّية، واذكر لكل مشكلة سببها وإصلاحها بالكود:',
    pRefactor: 'أعد هيكلة هذا الكود ليصبح أوضح وأسهل صيانة دون تغيير سلوكه، واشرح التغييرات باختصار:', pTests: 'اكتب اختبارات وحدة شاملة لهذا الكود بإطار الاختبار المعتاد للغته، وغطِّ الحالات الحدّية:',
    pComments: 'أضف تعليقات توضيحية بالعربية داخل هذا الكود دون تغيير أي منطق، وأعده كاملًا:', pConvert: 'حوّل هذا الكود إلى {lang} مع الحفاظ على السلوك نفسه، واذكر أي فروق مهمة:', convertTo: 'إلى أي لغة؟',
    quickNeedCode: 'الصق الكود بعد الأمر، أو افتحه في اللوحة الجانبية، أو أرفق ملفاته.', newCanvas: 'لوحة جديدة', closeCanvas: 'إغلاق اللوحة',
  },
  en: {
    canvas: 'Side canvas', attach: 'Attach', attachCode: 'Code files', attachFolder: 'Project folder', saveVersion: 'Save version', versions: 'Versions', version: 'version',
    showDiff: 'Diff with previous version', hideDiff: 'Hide diff', preview: 'Preview', livePreview: 'Sandboxed live preview', output: 'Output', clear: 'Clear',
    askEdit: 'Ask for an edit to the selection (or the whole file)…', applyEdit: 'Edit', editing: 'Editing…', selWhole: 'Whole file', selLines: '{n} lines selected',
    editDone: 'Edited — review the diff', editNoCode: 'The model did not return valid code.', fileName: 'File name', language: 'Language', unsaved: 'Unsaved',
    runTimeout: 'Stopped: exceeded {s} seconds (an endless loop?).', pyInstallAsk: 'Running Python needs a one-time Pyodide download ({size}) into the CAF AI folder. After that it works offline. Continue?',
    pyNotInstalled: 'Pyodide is not installed.', pyLoadFailed: 'Could not load Python in the browser.', pyLoading: 'Loading Python…', running: 'Running…', ranIn: 'Finished in {ms} ms', extracting: 'Extracting', installedOk: 'Installed',
    folderTitle: 'Attach a project folder', folderSub: 'Only text files were picked; node_modules, .git and binaries are ignored. Approximate limit: {limit} tokens.', folderUse: 'Attach selected',
    tokensEst: '≈ {n} tokens', overBudget: 'The selection is larger than the context size ({ctx}). The model will truncate or ignore part — unselect files or raise the context size in Settings.',
    filesSkipped: '{n} files skipped (binary or large)', codeFiles: 'files', noTextFiles: 'No text files in this selection.',
    qExplain: 'Explain code', qBugs: 'Find bugs', qRefactor: 'Refactor', qTests: 'Write tests', qComments: 'Arabic comments', qConvert: 'Convert language',
    pExplain: 'Explain this code step by step, then summarize what it does in two lines:', pBugs: 'Review this code and find bugs, vulnerabilities and edge cases; for each, give the cause and a fix in code:',
    pRefactor: 'Refactor this code to be clearer and easier to maintain without changing behavior, and briefly explain the changes:', pTests: 'Write thorough unit tests for this code using the usual test framework for its language, covering edge cases:',
    pComments: 'Add explanatory comments in Arabic inside this code without changing any logic, and return it in full:', pConvert: 'Convert this code to {lang} keeping the same behavior, and note any important differences:', convertTo: 'Convert to which language?',
    quickNeedCode: 'Paste the code after the command, open it in the side canvas, or attach its files.', newCanvas: 'New canvas', closeCanvas: 'Close canvas',
  },
});

const LANGS = ['javascript', 'typescript', 'python', 'html', 'css', 'json', 'markdown', 'php', 'sql', 'java', 'cpp', 'rust', 'go', 'xml', 'text'];
const IGNORE_DIRS = /(^|\/)(node_modules|\.git|\.svn|\.hg|dist|build|out|\.next|\.nuxt|vendor|__pycache__|\.venv|venv|\.idea|\.vscode|target|coverage|\.cache|Pods|DerivedData)(\/|$)/;
const BIN_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|psd|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|exe|dll|so|dylib|bin|o|a|class|wasm|mp[34]|m4a|wav|ogg|flac|mov|avi|mkv|webm|woff2?|ttf|otf|eot|sqlite|db|lock|pyc|DS_Store)$/i;
const tokens = (chars) => Math.ceil(chars / 3.5);
const langOf = (name) => { const e = (name.split('.').pop() || '').toLowerCase(); return Object.entries(EXT).find(([, x]) => x === e)?.[0] || e || 'text'; };

// ---------------- CodeMirror (مشترك في ../editor.js) ----------------

// ---------------- اللوحة الجانبية ----------------
const cv = { doc: null, view: null, langC: null, diffC: null, wrapC: null, diff: false, preview: null, dirty: false, busy: false, group: [], groupKey: '' };

function canvasHtml() {
  return `<header class="cv-head">
    <div class="cv-row">
      <span class="cv-file">${ic('filecode')}<input class="cv-name" id="cvName" dir="ltr" aria-label="${esc(t('fileName'))}" spellcheck="false"><span class="cv-dirty hidden" id="cvDirty" title="${esc(t('unsaved'))}">●</span></span>
      <span class="cv-writing hidden" id="cvWriting"><i class="spin"></i><span>${esc(t('writingNow'))}</span></span>
      <span class="spacer"></span>
      <button class="mini" id="cvMax" title="${esc(t('fullWidth'))}" aria-pressed="false">${ic('maximize')}</button>
      <button class="mini" id="cvClose" title="${esc(t('closeCanvas'))}" aria-label="${esc(t('closeCanvas'))}">${ic('close')}</button>
    </div>
    <div class="cv-files" id="cvFiles" role="tablist" aria-label="${esc(t('filesInReply'))}" hidden></div>
    <div class="cv-row cv-row2">
      <div class="cv-tabs" role="tablist" aria-label="${esc(t('canvas'))}">
        <button type="button" role="tab" data-cvtab="preview" id="cvTabRun" aria-selected="false"></button>
        <button type="button" role="tab" data-cvtab="code" aria-selected="true">${ic('code')}<span>${esc(t('codeTab'))}</span></button>
      </div>
      <span class="spacer"></span>
      <select id="cvLang" aria-label="${esc(t('language'))}">${LANGS.map((l) => `<option>${l}</option>`).join('')}</select>
      <select id="cvVer" aria-label="${esc(t('versions'))}"></select>
      <button class="mini" id="cvDiff" title="${esc(t('showDiff'))}" aria-pressed="false">${ic('diff')}</button>
      <button class="mini" id="cvWrap" title="${esc(t('wrapLines'))}" aria-pressed="false">${ic('wrap')}</button>
      <button class="mini" id="cvSave" title="${esc(t('saveVersion'))} (⌘S)">${ic('save')}</button>
      <button class="mini" id="cvCopy" title="${esc(t('copy'))}">${ic('copy')}</button>
      <button class="mini" id="cvDl" title="${esc(t('downloadFile'))}">${ic('download')}</button>
    </div>
  </header>
  <div class="cv-body"><div class="cv-editor" id="cvEditor" dir="ltr"></div>
    <section class="cv-out" id="cvOut" aria-live="polite"><div class="cv-out-head"><b id="cvOutTitle">${esc(t('output'))}</b><span class="muted small" id="cvOutMeta"></span><span class="spacer"></span><button class="mini" id="cvOutClear">${esc(t('clear'))}</button></div><div class="cv-out-body" id="cvOutBody"></div></section>
  </div>
  <footer class="cv-ask"><span class="cv-sel muted small" id="cvSel">${esc(t('selWhole'))}</span><input id="cvAsk" dir="auto" placeholder="${esc(t('askEdit'))}"><button class="btn small primary" id="cvAskBtn">${ic('wand')}<span>${esc(t('applyEdit'))}</span></button></footer>`;
}

// تبويبا اللوحة: «المعاينة/التشغيل» و«الكود» في مساحة واحدة بدل نافذتين
function runKind() { return LANG_KIND(cv.doc?.lang || '') || LANG_KIND((cv.doc?.name || '').split('.').pop()); }
function updateRunTab() {
  const k = runKind(); const b = $('cvTabRun');
  b.hidden = !k;
  b.innerHTML = k === 'html' ? `${ic('eye')}<span>${esc(t('previewTab'))}</span>` : `${ic('play')}<span>${esc(t('outputTab'))}</span>`;
}
function setTab(tab, { run = true } = {}) {
  const box = $('canvas'); box.dataset.tab = tab;
  box.querySelectorAll('[data-cvtab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cvtab === tab)));
  if (tab === 'preview' && run) runCanvas();
  if (tab === 'code') cv.view?.focus();
}

async function openCanvas({ content = '', lang = 'text', name = '', id = null, stream = false, group = [], groupKey = '' } = {}) {
  const C = await cm();
  const box = $('canvas');
  if (!box.dataset.ready) { box.innerHTML = canvasHtml(); box.dataset.ready = '1'; bindCanvas(); }
  box.classList.remove('hidden'); document.body.classList.add('canvas-open');
  if (id) {
    try { cv.doc = await api('GET', '/api/canvas/' + id); } catch { cv.doc = null; }
  }
  if (!cv.doc || !id) {
    cv.doc = { id: uid(), chatId: state.chat?.id || null, name: name || `caf-code.${EXT[lang] || 'txt'}`, lang, versions: [{ content, note: 'v1', at: Date.now() }] };
    if (!stream) await saveDoc();
  }
  const cur = cv.doc.versions[cv.doc.versions.length - 1].content;
  $('cvName').value = cv.doc.name; $('cvLang').value = LANGS.includes(cv.doc.lang) ? cv.doc.lang : 'text';
  renderVersions(); updateRunTab();
  cv.langC = new C.Compartment(); cv.diffC = new C.Compartment(); cv.wrapC = new C.Compartment();
  cv.view?.destroy();
  cv.view = new C.EditorView({
    parent: $('cvEditor'),
    state: C.EditorState.create({
      doc: cur,
      extensions: [C.basicSetup, C.keymap.of([C.indentWithTab, { key: 'Mod-s', preventDefault: true, run: () => { saveVersion(); return true; } }]),
        cv.langC.of(langExt(C, cv.doc.lang)), cv.diffC.of([]), cv.wrapC.of([]), themeExt(C),
        C.EditorView.updateListener.of((u) => { if (u.docChanged && !cv.busy) setDirty(true); if (u.selectionSet) showSel(); }),
        C.EditorView.contentAttributes.of({ 'aria-label': t('canvas') })],
    }),
  });
  cv.diff = false; setDirty(false); showSel();
  cv.streaming = stream; $('cvWriting').classList.toggle('hidden', !stream);
  cv.group = group; cv.groupKey = groupKey; renderFiles();
  $('cvTabRun').classList.remove('pulse');
  setTab('code', { run: false });
  if (!stream) cv.view.focus();
}

// «وضع المحاكي»: الكود يُكتب حيًا داخل اللوحة أثناء توليده، ثم تُعرض المعاينة عند الانتهاء
function streamInto(code) {
  if (!cv.view) return;
  cv.busy = true;
  cv.view.dispatch({ changes: { from: 0, to: cv.view.state.doc.length, insert: code }, scrollIntoView: true, selection: { anchor: code.length } });
  cv.busy = false;
  cv.doc.versions[cv.doc.versions.length - 1].content = code;
}
async function endStream(code, { show = true } = {}) {
  if (!cv.streaming) return;
  cv.streaming = false; $('cvWriting').classList.add('hidden');
  streamInto(code);
  setDirty(false);
  const saving = saveDoc();
  if (show) showResult();
  await saving;
}
// بعد الكتابة: صفحات HTML تُعرض مباشرة، وJS/Python جاهزة للتشغيل بنقرة، وغيرها يبقى في المحرر
function showResult() {
  const k = runKind();
  if (k === 'html') return setTab('preview');
  setTab('code', { run: false });
  if (k) { $('cvTabRun').classList.add('pulse'); toast(t('readyToRun'), 2600); }
}

// ---------- ملفات الرد الواحد: تبويبات داخل اللوحة + ربط CSS/JS بصفحة HTML عند المعاينة ----------
const FILE_IC = (l) => (LANG_KIND(l) === 'html' ? 'globe' : LANG_KIND(l) ? 'terminal' : 'filecode');
function renderFiles() {
  const row = $('cvFiles'); if (!row) return;
  const g = cv.group || [];
  row.hidden = g.length < 2;
  row.innerHTML = g.map((f, i) => `<button type="button" role="tab" data-file="${i}" aria-selected="${cv.doc && (f.id ? f.id === cv.doc.id : f.name === cv.doc.name)}" title="${esc(f.name)}">${ic(FILE_IC(f.lang))}<span dir="ltr">${esc(f.name)}</span>${f.writing ? '<i class="spin"></i>' : ''}</button>`).join('');
  // تمييز بطاقة الملف المفتوح داخل المحادثة
  document.querySelectorAll('.artifact.active').forEach((a) => a.classList.remove('active'));
  if (cv.groupKey && cv.doc) document.querySelector(`.msg[data-i="${cv.groupKey}"]`)?.querySelectorAll('.artifact').forEach((a) => { if (a.dataset.name === cv.doc.name) a.classList.add('active'); });
}
async function openGroupFile(i) {
  const f = cv.group[i]; if (!f || f.writing) return;
  if (cv.dirty) await saveVersion();
  const group = cv.group; const groupKey = cv.groupKey;
  if (f.id) await openCanvas({ id: f.id, content: f.content, lang: f.lang, name: f.name, group, groupKey });
  else { await openCanvas({ content: f.content, lang: f.lang, name: f.name, group, groupKey }); f.id = cv.doc.id; docIds.set(docKey(groupKey, f.name), f.id); }
}
const baseName = (n) => String(n || '').split(/[\\/]/).pop().toLowerCase();
function assetsFor() {
  const out = {};
  for (const f of cv.group || []) if (cv.doc && f.name !== cv.doc.name) out[baseName(f.name)] = f.id === cv.doc?.id ? curText() : f.content;
  return out;
}
// يضمّن ملفات CSS/JS من الرد نفسه داخل صفحة HTML (لأن المعاينة معزولة بلا شبكة ولا نظام ملفات)
function inlineAssets(html, assets) {
  if (!assets || !Object.keys(assets).length) return html;
  return html
    .replace(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi, (m, href) => { const c = assets[baseName(href)]; return c != null && /stylesheet|\.css/i.test(m) ? `<style>\n${c}\n</style>` : m; })
    .replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, a, src, b) => { const c = assets[baseName(src)]; return c != null ? `<script${(a + b).replace(/\s+defer|\s+async/gi, '')}>\n${c.replace(/<\/script/gi, '<\\/script')}\n</script>` : m; });
}
const previewCode = () => inlineAssets(curText(), assetsFor());
function langExt(C, l) { const f = C.languages[l]; try { return f ? f() : []; } catch { return []; } }
function closeCanvas() { $('canvas').classList.add('hidden'); document.body.classList.remove('canvas-open', 'cv-max'); cv.preview?.destroy(); cv.preview = null; cv.streaming = false; }
const curText = () => cv.view?.state.doc.toString() || '';
function setDirty(v) { cv.dirty = v; $('cvDirty')?.classList.toggle('hidden', !v); }
function showSel() {
  const s = cv.view?.state.selection.main; if (!s) return;
  const n = s.empty ? 0 : cv.view.state.doc.lineAt(s.to).number - cv.view.state.doc.lineAt(s.from).number + 1;
  $('cvSel').textContent = n ? t('selLines', { n }) : t('selWhole');
}
function renderVersions() {
  const n = cv.doc.versions.length;
  $('cvVer').innerHTML = cv.doc.versions.map((v, i) => `<option value="${i}" ${i === n - 1 ? 'selected' : ''}>${esc(t('version'))} ${i + 1}${v.note && !/^v\d+$/.test(v.note) ? ' · ' + esc(v.note.slice(0, 30)) : ''}</option>`).join('');
}
async function saveDoc() {
  try { await api('PUT', '/api/canvas/' + cv.doc.id, { chatId: cv.doc.chatId, name: cv.doc.name, lang: cv.doc.lang, versions: cv.doc.versions }); } catch { /* */ }
}
async function saveVersion(note = '') {
  const content = curText();
  const last = cv.doc.versions[cv.doc.versions.length - 1];
  if (last.content !== content) { cv.doc.versions.push({ content, note: note || `v${cv.doc.versions.length + 1}`, at: Date.now() }); renderVersions(); }
  setDirty(false); await saveDoc();
}
function setContent(text) {
  cv.busy = true;
  cv.view.dispatch({ changes: { from: 0, to: cv.view.state.doc.length, insert: text } });
  cv.busy = false;
}
async function toggleDiff(force) {
  const C = await cm();
  cv.diff = force ?? !cv.diff;
  const vers = cv.doc.versions; const sel = +$('cvVer').value;
  const base = vers[Math.max(0, (sel === vers.length - 1 ? sel - 1 : sel))]?.content ?? '';
  cv.view.dispatch({ effects: cv.diffC.reconfigure(cv.diff ? C.unifiedMergeView({ original: base, mergeControls: false, highlightChanges: true, gutter: true }) : []) });
  $('cvDiff').setAttribute('aria-pressed', String(cv.diff)); $('cvDiff').title = t(cv.diff ? 'hideDiff' : 'showDiff');
}

// ---------- المخرجات والمعاينة ----------
const EXTERNAL_RE = /(src|href)\s*=\s*["']\s*(https?:)?\/\/|@import\s+url\(\s*["']?https?:|url\(\s*["']?https?:/i;
const DEVICES = [['desktop', '100%', 'desktop'], ['tablet', '820px', 'tablet'], ['mobile', '390px', 'mobile']];
function openOut(title, meta = '') { setTab('preview', { run: false }); $('cvOutTitle').textContent = title; $('cvOutMeta').textContent = meta; }
function closeOut() { cv.preview?.destroy(); cv.preview = null; }
function outLine(box, l) { const d = document.createElement('div'); d.className = 'ol ol-' + l.type; d.textContent = l.text; box.appendChild(d); box.scrollTop = box.scrollHeight; }
const statusPill = (state, text) => `<span class="run-status st-${state}">${state === 'running' ? '<i class="spin"></i>' : state === 'ok' ? ic('check') : ic('alert')}<span>${esc(text)}</span></span>`;

function previewUi(body, code) {
  body.classList.add('is-preview');
  const external = EXTERNAL_RE.test(code);
  body.innerHTML = `<div class="pv-bar" role="toolbar" aria-label="${esc(t('livePreview'))}">
      <div class="seg pv-dev" role="group">${DEVICES.map(([k, , icn], i) => `<button type="button" data-dev="${k}" aria-pressed="${i === 0}" title="${esc(t('dev_' + k))}">${ic(icn)}</button>`).join('')}</div>
      <button type="button" class="mini" data-pv="reload" title="${esc(t('reload'))}">${ic('refresh')}</button>
      <button type="button" class="mini" data-pv="max" title="${esc(t('fullPreview'))}" aria-pressed="false">${ic('eye')}</button>
      <span class="spacer"></span>
      <button type="button" class="mini pv-con-btn" data-pv="console" aria-pressed="false">${ic('terminal')}<span>${esc(t('console'))}</span><b class="pv-count">0</b></button>
    </div>
    ${external ? `<p class="pv-note" role="note">${ic('alert')}${esc(t('externalBlocked'))}</p>` : ''}
    <div class="pv-stage"><div class="preview-holder"></div></div>
    <div class="preview-console hidden" aria-live="polite"></div>`;
  const holder = body.querySelector('.preview-holder'); const con = body.querySelector('.preview-console'); const count = body.querySelector('.pv-count');
  let n = 0;
  cv.preview?.destroy();
  cv.preview = mountPreview(holder, code, { onConsole: (l) => { outLine(con, l); n++; count.textContent = n; if (l.type === 'err') { count.classList.add('has-err'); con.classList.remove('hidden'); body.querySelector('[data-pv=console]').setAttribute('aria-pressed', 'true'); } } });
  body.querySelector('.pv-bar').onclick = (e) => {
    const d = e.target.closest('[data-dev]');
    if (d) { holder.style.maxWidth = DEVICES.find((x) => x[0] === d.dataset.dev)[1]; body.querySelectorAll('[data-dev]').forEach((b) => b.setAttribute('aria-pressed', String(b === d))); return; }
    const a = e.target.closest('[data-pv]'); if (!a) return;
    if (a.dataset.pv === 'reload') { con.innerHTML = ''; n = 0; count.textContent = '0'; count.classList.remove('has-err'); cv.preview.update(previewCode()); }
    if (a.dataset.pv === 'console') { const on = a.getAttribute('aria-pressed') !== 'true'; a.setAttribute('aria-pressed', String(on)); con.classList.toggle('hidden', !on); }
    if (a.dataset.pv === 'max') $('cvMax').click();
  };
}

async function runCanvas() {
  const kind = LANG_KIND(cv.doc.lang) || LANG_KIND(cv.doc.name.split('.').pop());
  const code = curText();
  const body = $('cvOutBody'); body.innerHTML = '';
  if (kind === 'html') { openOut(t('livePreview')); $('cvOutMeta').innerHTML = statusPill('ok', t('sandboxed')); previewUi(body, previewCode()); return; }
  body.classList.remove('is-preview');
  if (!kind) { openOut(t('output')); outLine(body, { type: 'warn', text: t('cannotRun') }); return; }
  openOut(kind === 'py' ? 'Python' : 'JavaScript');
  $('cvOutMeta').innerHTML = statusPill('running', t('running'));
  const res = kind === 'js' ? await runJS(code, { onLine: (l) => outLine(body, l) })
    : await runPython(code, { onLine: (l) => outLine(body, l), onStatus: (st) => { if (st === 'loading') $('cvOutMeta').innerHTML = statusPill('running', t('pyLoading')); } });
  $('cvOutMeta').innerHTML = statusPill(res.timedOut ? 'timeout' : res.failed ? 'err' : 'ok', res.timedOut ? t('timedOut') : res.failed ? t('runFailed') : t('ranIn', { ms: res.ms ?? 0 }));
  if (!res.lines.length) outLine(body, { type: 'muted', text: t('noOutput') });
}

// ---------- «اطلب تعديل» ----------
function firstCodeBlock(text) { const m = /```[\w+#.-]*\n([\s\S]*?)```/.exec(text) || /```[\w+#.-]*\n([\s\S]*)$/.exec(text); return m ? m[1].replace(/\n$/, '') : null; }
async function askEdit() {
  const instr = $('cvAsk').value.trim(); if (!instr || cv.busy) return;
  const full = curText(); const s = cv.view.state.selection.main;
  const sel = s.empty ? '' : cv.view.state.sliceDoc(s.from, s.to);
  if (cv.dirty) await saveVersion();
  const lang = cv.doc.lang;
  const ar = state.settings.lang !== 'en';
  const fence = (c) => `\`\`\`${lang}\n${c}\n\`\`\``;
  const prompt = (ar ? `الملف \`${cv.doc.name}\`:\n` : `File \`${cv.doc.name}\`:\n`) + fence(full) + '\n'
    + (sel ? (ar ? 'عدّل الجزء التالي فقط واترك الباقي كما هو:\n' : 'Change only this part and keep the rest as is:\n') + fence(sel) + '\n' : '')
    + (ar ? `التعليمات: ${instr}\n\nأعد الملف كاملًا بعد التعديل داخل كتلة كود واحدة فقط، بدون أي شرح قبلها أو بعدها.` : `Instructions: ${instr}\n\nReturn the complete file after the edit in a single code block only, with no explanation before or after it.`);
  const btn = $('cvAskBtn'); btn.disabled = true; btn.querySelector('span').textContent = t('editing'); cv.busy = true;
  let out = '';
  try {
    const r = await api('POST', '/api/chat', { model: $('modelSelect').value || 'auto', route: 'code', workspace: 'code', messages: [{ role: 'user', content: prompt }], think: 'off' }, { raw: true });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch { /* */ } throw new ApiError(j.error || 'chat_failed', r.status, j); }
    await readNdjson(r, (j) => { if (j.error) throw new ApiError(j.error); if (j.message?.content) { out += j.message.content; $('cvSel').textContent = `${t('editing')} ${out.length}`; } });
    const code = firstCodeBlock(out);
    if (!code) throw new Error(t('editNoCode'));
    cv.busy = false;
    setContent(code);
    await saveVersion(instr);
    await toggleDiff(true);
    $('cvAsk').value = '';
    toast(t('editDone'));
  } catch (e) { toast(e instanceof ApiError ? errText(e) : e.message); }
  cv.busy = false; btn.disabled = false; btn.querySelector('span').textContent = t('applyEdit'); showSel();
}

function bindCanvas() {
  $('cvClose').onclick = closeCanvas;
  $('cvSave').onclick = () => saveVersion().then(() => toast(t('saved')));
  $('cvCopy').onclick = async () => { await navigator.clipboard.writeText(curText()); toast(t('copied')); };
  $('cvDl').onclick = () => download(new Blob([curText()], { type: 'text/plain;charset=utf-8' }), cv.doc.name || 'caf-code.txt');
  $('canvas').querySelector('.cv-tabs').onclick = (e) => { const b = e.target.closest('[data-cvtab]'); if (b) setTab(b.dataset.cvtab); };
  $('cvMax').onclick = () => { const on = !document.body.classList.contains('cv-max'); document.body.classList.toggle('cv-max', on); $('cvMax').setAttribute('aria-pressed', String(on)); $('cvMax').innerHTML = ic(on ? 'minimize' : 'maximize'); };
  $('cvDiff').onclick = () => toggleDiff();
  $('cvWrap').onclick = async () => { const C = await cm(); const on = $('cvWrap').getAttribute('aria-pressed') !== 'true'; cv.view.dispatch({ effects: cv.wrapC.reconfigure(on ? C.EditorView.lineWrapping : []) }); $('cvWrap').setAttribute('aria-pressed', String(on)); };
  $('cvOutClear').onclick = () => { if (!$('cvOutBody').classList.contains('is-preview')) $('cvOutBody').innerHTML = ''; };
  $('cvName').onchange = (e) => { cv.doc.name = e.target.value.trim().slice(0, 200) || cv.doc.name; const l = langOf(cv.doc.name); if (LANGS.includes(l)) { $('cvLang').value = l; $('cvLang').onchange(); } saveDoc(); };
  $('cvLang').onchange = async () => { const C = await cm(); cv.doc.lang = $('cvLang').value; cv.view.dispatch({ effects: cv.langC.reconfigure(langExt(C, cv.doc.lang)) }); updateRunTab(); saveDoc(); };
  $('cvVer').onchange = () => { const v = cv.doc.versions[+$('cvVer').value]; if (!v) return; setContent(v.content); setDirty(false); if (cv.diff) toggleDiff(true); };
  $('cvAskBtn').onclick = askEdit;
  $('cvFiles').onclick = (e) => { const b = e.target.closest('[data-file]'); if (b) openGroupFile(+b.dataset.file); };
  $('cvTabRun').addEventListener('click', () => $('cvTabRun').classList.remove('pulse'));
  $('cvAsk').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); askEdit(); } });
}

// ---------------- أفعال كتل الكود داخل الرسائل ----------------
function blockInfo(btn) {
  const art = btn.closest('.artifact');
  const box = art ? art.querySelector('.codeblock') : btn.closest('.codeblock');
  const code = box.querySelector('pre.src code').textContent;
  const lang = box.dataset.lang || '';
  const before = (art || box).previousElementSibling ? (art || box).previousElementSibling.textContent : '';
  return { box, art, code, lang, name: art ? art.dataset.name || art.querySelector('.art-meta b').textContent : guessFileName(code, lang, before) };
}

// معاينة داخل كتلة الكود نفسها (تبويب «المعاينة») — بلا نافذة ثانية
function inlinePreview(btn) {
  const box = btn.closest('.codeblock');
  box.querySelectorAll('[data-cbtab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
  let pv = box.querySelector('.cb-preview');
  pv?.__p?.destroy(); pv?.remove();
  if (btn.dataset.cbtab !== 'preview') { box.classList.remove('show-preview'); return; }
  const code = box.querySelector('pre.src code').textContent;
  pv = document.createElement('div'); pv.className = 'cb-preview';
  pv.innerHTML = `<div class="cb-pv-bar"><span class="run-status st-ok">${ic('shield')}<span>${esc(t('sandboxed'))}</span></span><span class="spacer"></span><button type="button" class="mini" data-cbreload title="${esc(t('reload'))}">${ic('refresh')}</button><button type="button" class="mini" data-cbexpand title="${esc(t('openCanvas'))}">${ic('maximize')}</button></div>${EXTERNAL_RE.test(code) ? `<p class="pv-note">${ic('alert')}${esc(t('externalBlocked'))}</p>` : ''}<div class="cb-frame"></div><div class="preview-console hidden"></div>`;
  box.appendChild(pv); box.classList.add('show-preview');
  const con = pv.querySelector('.preview-console');
  pv.__p = mountPreview(pv.querySelector('.cb-frame'), code, { onConsole: (l) => { con.classList.remove('hidden'); outLine(con, l); } });
  pv.querySelector('[data-cbreload]').onclick = () => { con.innerHTML = ''; con.classList.add('hidden'); pv.__p.update(code); };
  pv.querySelector('[data-cbexpand]').onclick = () => { const b = blockInfo(btn); openCanvas({ content: b.code, lang: 'html', name: b.name }).then(() => setTab('preview')); };
}

async function runInline(btn) {
  const { box, code, lang, name } = blockInfo(btn);
  const kind = LANG_KIND(lang);
  if (kind === 'html') return openCanvas({ content: code, lang: 'html', name }).then(runCanvas);
  let out = box.nextElementSibling;
  if (!out || !out.classList.contains('run-out')) { out = document.createElement('div'); out.className = 'run-out'; out.setAttribute('aria-live', 'polite'); box.after(out); }
  out.innerHTML = `<div class="run-head"><span class="run-lang">${kind === 'py' ? 'Python' : 'JavaScript'}</span><span class="run-meta">${statusPill('running', t('running'))}</span><span class="spacer"></span>
    <button class="mini" data-runcopy title="${esc(t('copyOutput'))}">${ic('copy')}</button><button class="mini" data-rerun title="${esc(t('rerun'))}">${ic('refresh')}</button><button class="mini" data-closeout aria-label="${esc(t('close'))}">${ic('close')}</button></div><div class="run-body"></div>`;
  const body = out.querySelector('.run-body'); const meta = out.querySelector('.run-meta');
  out.querySelector('[data-rerun]').onclick = () => runInline(btn);
  out.querySelector('[data-runcopy]').onclick = async () => { await navigator.clipboard.writeText(body.innerText); toast(t('copied')); };
  const res = kind === 'js' ? await runJS(code, { onLine: (l) => outLine(body, l) })
    : await runPython(code, { onLine: (l) => outLine(body, l), onStatus: (st) => { if (st === 'loading') meta.innerHTML = statusPill('running', t('pyLoading')); } });
  meta.innerHTML = statusPill(res.timedOut ? 'timeout' : res.failed ? 'err' : 'ok', res.timedOut ? t('timedOut') : res.failed ? t('runFailed') : t('ranIn', { ms: res.ms ?? 0 }));
  if (!res.lines.length) outLine(body, { type: 'muted', text: t('noOutput') });
}

// ---------- وضع المحاكي: كل ملف في رد برمجي يُكتب حيًا في اللوحة الجانبية ----------
// يعمل في مساحة الكود، وفي المحادثة حين تكون نية الطلب «كود». البطاقة في المحادثة تبقى مختصرة والكود كاملًا في اللوحة.
const CANVAS_LANG = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', node: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', python3: 'python', htm: 'html', svg: 'xml', md: 'markdown', 'c++': 'cpp', c: 'cpp', h: 'cpp', hpp: 'cpp', cc: 'cpp', scss: 'css', less: 'css', mysql: 'sql', postgres: 'sql', postgresql: 'sql' };
const canvasLang = (l, name) => { const x = CANVAS_LANG[(l || '').toLowerCase()] || (l || '').toLowerCase(); if (LANGS.includes(x)) return x; const f = langOf(name || ''); return LANGS.includes(f) ? f : 'text'; };
const docIds = new Map(); // «محادثة|رسالة|ملف» ← معرّف مستند اللوحة (لا نكرر إنشاء المستند عند كل نقرة)
const docKey = (msgIdx, name) => `${state.chat?.id || ''}|${msgIdx}|${name}`;
// الكتل المسوّرة بنفس قواعد العرض (السطر يبدأ بـ ``` أو ~~~)
function fencedBlocks(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n'); const out = []; let i = 0; let before = '';
  while (i < lines.length) {
    const f = lines[i].match(/^\s*(```+|~~~+)\s*([\w+#.-]*)/);
    if (!f) { before += lines[i] + '\n'; i++; continue; }
    const close = f[1][0].repeat(3); const buf = []; i++;
    while (i < lines.length && !lines[i].trim().startsWith(close)) buf.push(lines[i++]);
    const done = i < lines.length; i++;
    out.push({ lang: (f[2] || '').toLowerCase(), code: buf.join('\n'), done, before: before.slice(-400) });
    before = '';
  }
  return out;
}
// حفظ ملف من ملفات الرد مباشرة (احتياط إن لم يكن هو المفتوح في اللوحة لحظة الانتقال)
async function saveFile(f) {
  if (!f) return;
  if (!f.id) f.id = uid();
  try { await api('PUT', '/api/canvas/' + f.id, { chatId: state.chat?.id || null, name: f.name, lang: f.lang, versions: [{ content: f.content, note: 'v1', at: Date.now() }] }); } catch { /* */ }
}
const fileBlocks = (content) => fencedBlocks(content).filter((b) => isArtifact(b.lang, b.code.split('\n').length));
let live = null; // { msg, idx, cur, files:[{name,lang,content,id,writing}], opening }
function onStream({ idx, msg, content }) {
  if (!msg || !artifactMode(msg)) return;
  const blocks = fileBlocks(content); if (!blocks.length) return;
  if (!live || live.msg !== msg) live = { msg, idx, cur: -1, files: [], opening: null };
  const i = blocks.length - 1; const b = blocks[i];
  if (live.cur !== i) {
    const prev = live.files[live.cur];
    if (prev) { prev.content = blocks[live.cur].code; prev.writing = false; }
    live.cur = i;
    const name = guessFileName(b.code, b.lang, b.before);
    const f = { name, lang: canvasLang(b.lang, name), content: b.code, id: null, writing: true };
    live.files.push(f);
    const L = live;
    live.opening = Promise.resolve(L.opening).then(async () => {
      // أنهِ الملف السابق (يُحفظ) قبل فتح التالي
      if (prev && cv.streaming && cv.doc?.name === prev.name) await endStream(prev.content, { show: false });
      else if (prev) await saveFile(prev);
      await openCanvas({ content: f.content, lang: f.lang, name, stream: true, group: L.files, groupKey: String(idx) });
      f.id = cv.doc.id; docIds.set(docKey(idx, name), f.id); streamInto(f.content);
    });
    live.opening.finally(() => { if (live === L) L.opening = null; });
    return;
  }
  const f = live.files[i]; f.content = b.code;
  if (!live.opening && cv.streaming && cv.doc?.name === f.name) streamInto(b.code);
}

async function autoPreview(msg) {
  if (msg && live && live.msg === msg) {
    const L = live; live = null;
    await L.opening;
    const blocks = fileBlocks(msg.content || '');
    L.files.forEach((f, i) => { if (blocks[i]) f.content = blocks[i].code.replace(/\n$/, ''); f.writing = false; });
    const cur = L.files[L.files.length - 1];
    if (cur && cv.streaming && cv.doc?.name === cur.name) await endStream(cur.content, { show: false });
    else if (cur) await saveFile(cur);
    // صفحة HTML ضمن ملفات الرد؟ اعرضها (مع CSS/JS المرافقة) — وإلا أظهر نتيجة الملف الحالي
    const page = L.files.find((f) => LANG_KIND(f.lang) === 'html' && /<!DOCTYPE html|<html[\s>]|<body[\s>]/i.test(f.content));
    if (page && cv.doc?.name !== page.name) { await openCanvas({ id: page.id, content: page.content, lang: page.lang, name: page.name, group: L.files, groupKey: String(L.idx) }); page.id = cv.doc.id; }
    renderFiles();
    showResult();
    return;
  }
  if (!msg?.content || !artifactMode(msg) || !$('canvas').classList.contains('hidden')) return;
  // رد محفوظ/غير مبثوث: صفحة HTML كاملة تُفتح مباشرة
  const blocks = fileBlocks(msg.content).filter((b) => /^(html|htm)$/.test(b.lang) && /<!DOCTYPE html|<html[\s>]|<body[\s>]/i.test(b.code));
  if (!blocks.length) return;
  const b = blocks.sort((x, y) => y.code.length - x.code.length)[0];
  openCanvas({ content: b.code, lang: 'html', name: guessFileName(b.code, 'html', b.before) }).then(runCanvas);
}

// فتح ملف من بطاقة داخل الرسالة، مع بقية ملفات الرد نفسه كتبويبات
async function openFromCard(btn, tab) {
  const msgEl = btn.closest('.msg'); const idx = msgEl?.dataset.i ?? '';
  const cards = [...(msgEl?.querySelectorAll('.artifact') || [])];
  const group = cards.map((a) => { const name = a.dataset.name; return { name, lang: canvasLang(a.dataset.lang, name), content: a.querySelector('pre.src code').textContent, id: docIds.get(docKey(idx, name)) || null }; });
  const art = btn.closest('.artifact'); const i = Math.max(0, cards.indexOf(art));
  const f = group[i]; if (!f) return;
  if (cv.dirty) await saveVersion();
  if (f.id) await openCanvas({ id: f.id, content: f.content, lang: f.lang, name: f.name, group, groupKey: String(idx) });
  else { await openCanvas({ content: f.content, lang: f.lang, name: f.name, group, groupKey: String(idx) }); f.id = cv.doc.id; docIds.set(docKey(idx, f.name), f.id); }
  if (tab === 'preview') setTab('preview');
}

// ---------------- إرفاق ملفات الكود ومجلد المشروع ----------------
async function readTextFiles(files) {
  const ok = []; let skipped = 0;
  for (const f of files) {
    const rel = f.webkitRelativePath || f.name;
    if (IGNORE_DIRS.test(rel) || BIN_EXT.test(rel) || f.size > 600 * 1024) { skipped++; continue; }
    const head = new Uint8Array(await f.slice(0, 4096).arrayBuffer());
    if (head.includes(0)) { skipped++; continue; }
    ok.push({ path: rel, size: f.size, file: f });
  }
  return { ok, skipped };
}
function ctxLimit() { return Math.floor((state.settings.numCtx || 4096) * 0.7); }

async function attachFiles(directory) {
  const files = await pickFiles({ directory });
  if (!files.length) return;
  const { ok, skipped } = await readTextFiles(files);
  if (!ok.length) { toast(t('noTextFiles')); return; }
  ok.sort((a, b) => a.path.localeCompare(b.path));
  const limit = ctxLimit();
  let used = 0;
  for (const f of ok) { f.on = used + tokens(f.size) <= limit || ok.length === 1; if (f.on) used += tokens(f.size); }
  const chosen = await chooseFiles(ok, { skipped, limit, directory });
  if (!chosen || !chosen.length) return;
  const parts = [];
  for (const f of chosen) parts.push(`### الملف: ${f.path}\n\`\`\`${langOf(f.path)}\n${await f.file.text()}\n\`\`\``);
  const root = directory ? (chosen[0].path.split('/')[0] || 'project') : chosen.length === 1 ? chosen[0].path : `${chosen.length} ${t('codeFiles')}`;
  const tree = chosen.map((f) => f.path).join('\n');
  const context = (directory ? `مجلد المشروع «${root}» (${chosen.length} ملف):\n\`\`\`text\n${tree}\n\`\`\`\n\n` : '') + parts.join('\n\n');
  const chars = context.length;
  addPending({ key: 'code:' + uid(), kind: directory ? 'folder' : 'file', label: root, note: t('tokensEst', { n: tokens(chars).toLocaleString() }), title: tree, payload: { context, files: chosen.map((f) => ({ name: f.path, size: f.size, kind: 'code', chars: 0 })) } });
  if (tokens(chars) > (state.settings.numCtx || 4096)) toast(t('overBudget', { ctx: state.settings.numCtx }), 6000);
}

function chooseFiles(list, { skipped, limit, directory }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog'); d.className = 'files-dlg';
    const sum = () => list.filter((f) => f.on).reduce((a, f) => a + tokens(f.size), 0);
    const render = () => {
      const total = sum();
      d.querySelector('.ft-sum').innerHTML = `${esc(t('tokensEst', { n: total.toLocaleString() }))} / ${limit.toLocaleString()}${total > (state.settings.numCtx || 4096) ? ` <span class="warn">${esc(t('overBudget', { ctx: state.settings.numCtx }))}</span>` : ''}`;
    };
    d.innerHTML = `<form method="dialog"><header><h2>${esc(t(directory ? 'folderTitle' : 'attachCode'))}</h2></header>
      <p class="muted small">${esc(t('folderSub', { limit: limit.toLocaleString() }))}${skipped ? ' · ' + esc(t('filesSkipped', { n: skipped })) : ''}</p>
      <ul class="ftree" dir="ltr">${list.map((f, i) => `<li style="padding-left:${(f.path.split('/').length - 1) * 14}px"><label><input type="checkbox" data-i="${i}" ${f.on ? 'checked' : ''}> <span>${esc(f.path.split('/').pop())}</span> <small>${esc(f.path.split('/').slice(0, -1).join('/'))}</small> <small class="muted">${tokens(f.size).toLocaleString()}</small></label></li>`).join('')}</ul>
      <p class="ft-sum"></p>
      <div class="row end"><button value="0" class="btn" formnovalidate>${esc(t('cancel'))}</button><button value="1" class="btn primary">${esc(t('folderUse'))}</button></div></form>`;
    d.querySelector('.ftree').onchange = (e) => { const i = e.target.dataset.i; if (i !== undefined) { list[+i].on = e.target.checked; render(); } };
    document.body.appendChild(d); render();
    d.addEventListener('close', () => { resolve(d.returnValue === '1' ? list.filter((f) => f.on) : null); d.remove(); });
    d.showModal();
  });
}

// ---------------- الأوامر السريعة ----------------
const QUICK = [['qExplain', 'pExplain'], ['qBugs', 'pBugs'], ['qRefactor', 'pRefactor'], ['qTests', 'pTests'], ['qComments', 'pComments'], ['qConvert', 'pConvert']];
function renderQuick() {
  const q = $('quick');
  const show = state.workspace === 'code' && state.view === 'chat';
  q.hidden = !show;
  if (show) q.innerHTML = QUICK.map(([k], i) => `<button type="button" data-q="${i}">${esc(t(k))}</button>`).join('') + `<button type="button" data-q="canvas">${ic('panel')} ${esc(t('newCanvas'))}</button>`;
}
async function quick(i) {
  if (i === 'canvas') return openCanvas({ content: '', lang: 'javascript' });
  let [, p] = QUICK[i];
  let instr = t(p);
  if (p === 'pConvert') { const lang = await promptBox(t('convertTo'), 'JavaScript'); if (!lang) return; instr = t(p, { lang }); }
  // الموضوع: اللوحة المفتوحة (أو تحديدها)، ثم المرفقات، ثم النص المكتوب
  const canvasOpen = !$('canvas').classList.contains('hidden') && cv.view;
  if (canvasOpen) {
    const s = cv.view.state.selection.main;
    const code = s.empty ? curText() : cv.view.state.sliceDoc(s.from, s.to);
    setInput(`${instr}\n\`\`\`${cv.doc.lang}\n${code}\n\`\`\``, { focus: false });
    return submit();
  }
  if (pending.some((x) => x.payload?.context) || $('input').value.trim()) {
    const cur = $('input').value.trim();
    setInput(cur ? `${instr}\n${cur}` : instr, { focus: false });
    return submit();
  }
  setInput(instr + '\n'); toast(t('quickNeedCode'), 4000);
}

export function init() {
  window.I18N_ADD({
    ar: { cannotRun: 'التشغيل المباشر متاح لـ JavaScript وPython وHTML فقط.', dev_desktop: 'سطح المكتب', dev_tablet: 'تابلت', dev_mobile: 'جوال', reload: 'إعادة التحميل', fullPreview: 'معاينة بالمساحة كاملة',
      console: 'Console', externalBlocked: 'هذه الصفحة تطلب ملفات من الإنترنت (CDN أو صور خارجية). المعاينة معزولة وبلا شبكة، لذلك قد تظهر بدون تنسيقها. اطلب من كآف AI نسخة مضمّنة بالكامل.',
      codeTab: 'الكود', previewTab: 'المعاينة', outputTab: 'التشغيل', nLines: '{n} سطر', writingNow: 'يكتب الآن…', readyNow: 'جاهز', fullWidth: 'عرض كامل',
      sandboxed: 'معزولة · بلا شبكة', readyToRun: 'جاهز — اضغط «التشغيل»', filesInReply: 'ملفات هذا الرد', timedOut: 'تجاوز المهلة', runFailed: 'انتهى بخطأ', noOutput: '(لا توجد مخرجات)', copyOutput: 'نسخ المخرجات', rerun: 'إعادة التشغيل' },
    en: { cannotRun: 'Direct run is available for JavaScript, Python and HTML only.', dev_desktop: 'Desktop', dev_tablet: 'Tablet', dev_mobile: 'Phone', reload: 'Reload', fullPreview: 'Full-size preview',
      console: 'Console', externalBlocked: 'This page requests files from the internet (CDN or external images). The preview is sandboxed with no network, so it may look unstyled. Ask CAF AI for a fully self-contained version.',
      codeTab: 'Code', previewTab: 'Preview', outputTab: 'Run', nLines: '{n} lines', writingNow: 'Writing…', readyNow: 'Ready', fullWidth: 'Full width',
      sandboxed: 'sandboxed · no network', readyToRun: 'Ready — press “Run”', filesInReply: 'Files in this reply', timedOut: 'Timed out', runFailed: 'Ended with an error', noOutput: '(no output)', copyOutput: 'Copy output', rerun: 'Run again' },
  });
  addAttachItem({ id: 'code-files', icon: 'code', label: () => t('attachCode'), run: () => attachFiles(false) });
  addAttachItem({ id: 'code-folder', icon: 'folder', label: () => t('attachFolder'), run: () => attachFiles(true) });
  beforeSend.push((opts) => {
    const ctx = pending.filter((p) => p.payload?.context);
    if (!ctx.length) return;
    opts.context = [opts.context, ...ctx.map((p) => p.payload.context)].filter(Boolean).join('\n\n');
    opts.files = [...(opts.files || []), ...ctx.flatMap((p) => p.payload.files || [])];
  });
  // شارات الملفات المرفقة على رسالة المستخدم
  msgExtras.push((m) => (m.role === 'user' && m.files?.length ? `<div class="msg-files">${m.files.slice(0, 12).map((f) => `<span class="file-chip" dir="ltr" title="${esc(f.name)}">${ic(f.kind === 'code' ? 'code' : 'file')}${esc(f.name.split('/').pop())}</span>`).join('')}${m.files.length > 12 ? `<span class="file-chip">+${m.files.length - 12}</span>` : ''}</div>` : ''));
  slashCommands.push({ cmd: 'code', label: () => t('wsCode'), run: (rest) => { emit('workspace:set', 'code'); if (rest.trim()) { setInput(rest); submit(); } return true; } });
  on('msgs:click', (e) => {
    const tab = e.target.closest('[data-cbtab]'); if (tab) return inlinePreview(tab);
    const ao = e.target.closest('[data-artopen], [data-artrun]'); if (ao) return openFromCard(ao, 'preview');
    const ae = e.target.closest('[data-artedit]'); if (ae) return openFromCard(ae, 'code');
    const ac = e.target.closest('[data-artcode]'); if (ac) { const box = ac.closest('.artifact').querySelector('.art-code'); box.hidden = !box.hidden; ac.setAttribute('aria-expanded', String(!box.hidden)); return; }
    const run = e.target.closest('[data-run]'); if (run) return runInline(run);
    const can = e.target.closest('[data-canvas]'); if (can) { const b = blockInfo(can); return openCanvas({ content: b.code, lang: LANGS.includes(b.lang) ? b.lang : langOf(b.name), name: b.name }); }
    const dl = e.target.closest('[data-dl]'); if (dl) { const b = blockInfo(dl); return download(new Blob([b.code], { type: 'text/plain;charset=utf-8' }), b.name); }
    const co = e.target.closest('[data-closeout]'); if (co) co.closest('.run-out').remove();
  });
  $('quick').onclick = (e) => { const b = e.target.closest('[data-q]'); if (b) quick(b.dataset.q === 'canvas' ? 'canvas' : +b.dataset.q); };
  on('workspace:changed', renderQuick); on('view:changed', renderQuick); on('ui:applied', () => { renderQuick(); if ($('canvas').dataset.ready && !$('canvas').classList.contains('hidden')) { /* النصوص تتحدّث عند الفتح التالي */ } });
  on('chat:changed', () => { if (cv.doc && state.chat && cv.doc.chatId && cv.doc.chatId !== state.chat.id) closeCanvas(); });
  on('chat:done', autoPreview);
  on('stream:update', onStream);
}
