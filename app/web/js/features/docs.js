/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// المستندات: إرفاق PDF/Word/Excel/CSV/نص، استخراج محلي، سياق مباشر أو فهرسة (RAG) مع مصادر،
// «عدّل الملف» → كود Python يُشغَّل في Pyodide على ملفك → ملف نتيجة للتنزيل مع معاينة، ومكتبة المعرفة.
import { state, $, t, esc, ic, uid, api, toast, on, emit, errText, confirmBox, promptBox, fmtBytes, readNdjson, authHeaders, loadScript, pages, ApiError } from '../core.js';
import { msgExtras, msgActions, persist, renderMessages } from '../chat.js';
import { renderMd } from '../md.js';
import { addPending, removePending, pending, beforeSend, addAttachItem, pickFiles, slashCommands, renderTray, setInput, submit } from '../composer.js';
import { ensureOffice, runPython } from '../runners.js';

window.I18N_ADD({
  ar: {
    attachDoc: 'مستند أو جدول', docReading: 'قراءة…', docPages: '{n} صفحة', docRows: '{n} صف', docChars: '{n} حرف', docIndexing: 'فهرسة…', docIndexed: 'مفهرس ({n} مقطع)',
    scannedAsk: 'يبدو أن «{name}» ممسوح ضوئيًا (صور بلا نص). استخراج النص بنموذج الرؤية بطيء (قد يستغرق دقيقة لكل صفحة). هل تريد المتابعة؟', ocrPage: 'OCR صفحة {p}/{n}',
    docTooBig: 'المستند كبير: سنفهرسه محليًا ونجيبك من المقاطع الأنسب مع ذكر المصادر.', unsupportedDoc: 'نوع الملف غير مدعوم.',
    sources: 'المصادر', editTask: 'تعديل ملف', taskRunning: 'يطبّق التعديل على ملفك…', taskOk: 'تم التعديل', taskFail: 'تعذّر تطبيق التعديل', taskFixing: 'تصحيح تلقائي ({n})…', taskLog: 'سجل التنفيذ', downloadResult: 'تنزيل',
    resultPreview: 'معاينة النتيجة', officeInstallAsk: 'تعديل ملفات Excel وWord يحتاج «أدوات المكتب» لـ Python مرة واحدة ({size}). بعدها يعمل دون إنترنت. متابعة؟', officeTools: 'أدوات المكتب (Python)',
    taskNeedsFile: 'الملف الأصلي لم يعد في الذاكرة. أرفقه من جديد ثم أعد الطلب.', showCode: 'عرض الكود',
    knowledge: 'مكتبة المعرفة', knowledgeSub: 'مجموعات مستندات دائمة تُفهرس محليًا. اربطها بأي محادثة ليجيب كآف AI منها مع ذكر المصدر (الملف والصفحة).',
    newCollection: 'مجموعة جديدة', collectionName: 'اسم المجموعة', addDocs: 'إضافة مستندات', askLibrary: 'اسأل هذه المكتبة', noCollections: 'لا توجد مجموعات بعد. أنشئ مجموعة وأضف مستنداتك.',
    chunks: '{n} مقطع', docsCount: '{n} مستند', deleteCollectionQ: 'حذف المجموعة «{c}» وفهرسها؟ (ملفاتك الأصلية لا تتأثر)', embedNone: 'لا يوجد نموذج تضمين: البحث بالكلمات فقط. للبحث بالمعنى نزّل نموذج التضمين الموصى به.', embedUsing: 'نموذج التضمين: {m}',
    linkKnowledge: 'المعرفة', linkedCollections: 'مجموعات مرتبطة بهذه المحادثة', searchLibrary: 'جرّب البحث في المكتبة…', chatDocs: 'مستندات المحادثات',
    err_pdf_client: 'تعذّرت قراءة PDF.', err_unsupported_file: 'نوع الملف غير مدعوم.', err_extract_failed: 'تعذّر استخراج النص من الملف.', err_empty_doc: 'المستند فارغ.', err_no_vision_model: 'لا يوجد نموذج رؤية لاستخراج النص من الصفحات الممسوحة.',
  },
  en: {
    attachDoc: 'Document or sheet', docReading: 'Reading…', docPages: '{n} pages', docRows: '{n} rows', docChars: '{n} chars', docIndexing: 'Indexing…', docIndexed: 'Indexed ({n} chunks)',
    scannedAsk: '“{name}” looks scanned (images without text). Extracting text with the vision model is slow (up to a minute per page). Continue?', ocrPage: 'OCR page {p}/{n}',
    docTooBig: 'Large document: it will be indexed locally and answers will come from the best passages, with sources.', unsupportedDoc: 'Unsupported file type.',
    sources: 'Sources', editTask: 'File edit', taskRunning: 'Applying the edit to your file…', taskOk: 'Edited', taskFail: 'Could not apply the edit', taskFixing: 'Auto-fixing ({n})…', taskLog: 'Run log', downloadResult: 'Download',
    resultPreview: 'Result preview', officeInstallAsk: 'Editing Excel and Word files needs the Python “office tools” once ({size}). After that it works offline. Continue?', officeTools: 'Office tools (Python)',
    taskNeedsFile: 'The original file is no longer in memory. Attach it again and resend.', showCode: 'Show code',
    knowledge: 'Knowledge library', knowledgeSub: 'Persistent document collections indexed locally. Link them to any chat and CAF AI answers from them, citing the file and page.',
    newCollection: 'New collection', collectionName: 'Collection name', addDocs: 'Add documents', askLibrary: 'Ask this library', noCollections: 'No collections yet. Create one and add your documents.',
    chunks: '{n} chunks', docsCount: '{n} docs', deleteCollectionQ: 'Delete the collection “{c}” and its index? (your original files are not affected)', embedNone: 'No embedding model: keyword search only. Download the recommended embedding model for meaning-based search.', embedUsing: 'Embedding model: {m}',
    linkKnowledge: 'Knowledge', linkedCollections: 'Collections linked to this chat', searchLibrary: 'Try searching the library…', chatDocs: 'Chat documents',
    err_pdf_client: 'Could not read the PDF.', err_unsupported_file: 'Unsupported file type.', err_extract_failed: 'Could not extract text from the file.', err_empty_doc: 'The document is empty.', err_no_vision_model: 'No vision model to read scanned pages.',
  },
});

const ACCEPT = '.pdf,.docx,.xlsx,.xlsm,.csv,.tsv,.txt,.md,.markdown,.json,.xml,.html,.log,application/pdf';
const EDITABLE = /\.(xlsx|xlsm|csv|docx)$/i;
const EDIT_RE = /(عدّ?ل|غيّ?ر|أضف|اضف|احذف|امسح|رتّ?ب|فرز|صحّ?ح|نظّ?ف|احسب|اجمع|دمج|ادمج|افصل|فلتر|صفّ?ِ?|حوّ?ل|استبدل|لوّ?ن|نسّ?ق|ترجم الملف|ترجم الأعمدة|أنشئ عمود|عمود جديد|ورقة جديدة|edit|modify|add (a )?column|remove|delete|sort|clean|fix|calculate|merge|split|filter|convert|replace|format|highlight|rename)/i;
const tokensOf = (chars) => Math.ceil(chars / 3.5);
const files = new Map(); // الملفات الأصلية في الذاكرة لمهام التعديل: key → { name, buf }

// ---------- قراءة PDF في المتصفح (pdf.js محلي) ----------
let pdfjs = null;
async function pdfLib() {
  if (!pdfjs) {
    pdfjs = await import(`/vendor/pdfjs/pdf.min.mjs?v=${encodeURIComponent(state.info?.version || '')}`);
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  }
  return pdfjs;
}
async function readPdf(buf, name, onProgress) {
  const lib = await pdfLib();
  const doc = await lib.getDocument({ data: new Uint8Array(buf), wasmUrl: '/vendor/pdfjs/wasm/', isEvalSupported: false, enableXfa: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let text = ''; let lastY = null;
    for (const it of tc.items) { const y = it.transform?.[5]; if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n'; text += it.str + (it.hasEOL ? '\n' : ''); lastY = y; }
    pages.push({ n: i, text: text.replace(/[ \t]+\n/g, '\n').trim() });
    onProgress?.(i, doc.numPages);
  }
  const chars = pages.reduce((a, p) => a + p.text.length, 0);
  // ممسوح ضوئيًا؟ (أقل من 40 حرفًا للصفحة في المتوسط)
  if (chars / Math.max(1, doc.numPages) < 40 && await confirmBox(t('scannedAsk', { name }), { ok: t('ok') })) {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress?.(i, doc.numPages, true);
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1.6 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      try { const r = await api('POST', '/api/ocr', { image: c.toDataURL('image/jpeg', 0.85) }); pages[i - 1].text = r.text; } catch (e) { toast(errText(e)); break; }
    }
  }
  return { kind: 'pdf', pages, text: pages.map((p) => p.text).join('\n\n'), chars: pages.reduce((a, p) => a + p.text.length, 0) };
}

async function readFile(file, onProgress) {
  const buf = await file.arrayBuffer();
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return { ...(await readPdf(buf, file.name, onProgress)), buf };
  const out = await api('POST', `/api/extract?name=${encodeURIComponent(file.name)}`, new Blob([buf]));
  return { ...out, buf };
}

// ---------- إرفاق مستند في المحادثة ----------
async function addDoc(file) {
  const key = 'doc:' + uid();
  const isSheet = /\.(xlsx|xlsm|csv|tsv)$/i.test(file.name);
  const item = { key, kind: isSheet ? 'sheet' : 'doc', label: file.name, busy: true, note: t('docReading') };
  addPending(item);
  try {
    const d = await readFile(file, (p, n, ocr) => { item.note = ocr ? t('ocrPage', { p, n }) : `${p}/${n}`; renderTray(); });
    if (!d.chars) throw new ApiError('empty_doc');
    files.set(key, { name: file.name, buf: d.buf });
    while (files.size > 6) files.delete(files.keys().next().value); // آخر 6 ملفات فقط في الذاكرة
    const note = d.pages ? t('docPages', { n: d.pages.length }) : d.sheets ? t('docRows', { n: d.sheets.reduce((a, s) => a + s.nrows, 0) }) : t('docChars', { n: d.chars.toLocaleString() });
    Object.assign(item, { busy: false, note, payload: { doc: { name: file.name, kind: d.kind, text: d.text, pages: d.pages, sheets: d.sheets, chars: d.chars, size: file.size, editable: EDITABLE.test(file.name), key } } });
    renderTray();
  } catch (e) { removePending(key); toast(e.code ? errText(e) : e.message || t('unsupportedDoc'), 4000); }
}

// ملخص الملف للنموذج في مهام التعديل (لا نرسل الملف كله)
function fileSummary(d) {
  if (d.sheets) {
    return d.sheets.map((s) => {
      const rows = s.rows.slice(0, 25);
      const w = Math.max(0, ...rows.map((r) => r.length));
      const table = rows.length ? [rows[0], Array(w).fill('---'), ...rows.slice(1)].map((r) => `| ${Array.from({ length: w }, (_, i) => String(r[i] ?? '').replace(/\|/g, '\\|').slice(0, 40)).join(' | ')} |`).join('\n') : '(فارغة)';
      const colName = (i) => { let c = ''; i++; while (i) { const m = (i - 1) % 26; c = String.fromCharCode(65 + m) + c; i = Math.floor((i - 1) / 26); } return c; };
      const cols = (rows[0] || []).map((h, i) => `${colName(i)}=«${String(h).slice(0, 30)}»`).join('، ');
      return `### ورقة «${s.name}» — ${s.nrows} صف × ${s.ncols} عمود. صف العناوين هو الصف 1.\nالأعمدة: ${cols}\n(أول ${rows.length} صفوف):\n${table}`;
    }).join('\n\n');
  }
  return `أول 3000 حرف من المستند:\n${d.text.slice(0, 3000)}`;
}
function taskPrompt(d) {
  const ext = d.name.split('.').pop().toLowerCase();
  const lib = ext === 'docx' ? 'python-docx (import docx)' : ext === 'csv' ? 'وحدة csv القياسية (encoding="utf-8-sig")' : 'openpyxl (load_workbook ثم save للحفاظ على التنسيق والصيغ)';
  const outName = d.name.replace(/(\.[^.]+)$/, '-معدل$1');
  return [
    `[مهمة تعديل ملف] الملف المرفق موجود في المسار /data/in/${d.name}`,
    `اكتب سكربت Python واحدًا كاملًا داخل كتلة \`\`\`python ينفّذ طلب المستخدم على الملف ويحفظ النتيجة في /data/out/${outName}`,
    `- استخدم ${lib}. لا تستخدم pandas ولا الإنترنت ولا input().`,
    '- حافظ على البيانات الأصلية التي لم يُطلب تغييرها، وعلى اتجاه النص العربي.',
    '- في نهاية السكربت اطبع (print) ملخصًا عربيًا قصيرًا لما تغيّر وعدد الصفوف أو الفقرات المعدّلة.',
    '- نفّذ كل جزء من الطلب حرفيًا (إن طُلب أكثر من تعديل فطبّقها كلها).',
    '- لا تكتب فوق أي عمود أو خلية موجودة إلا إذا طُلب تعديلها صراحة. العمود الجديد يُضاف بعد آخر عمود: col = ws.max_column + 1.',
    '- احسب القيم في Python واكتب الأرقام الناتجة (لا تكتب صيغًا إلا إذا طلب المستخدم صيغة Excel).',
    '- قبل الكتلة اكتب سطرًا واحدًا يشرح خطتك، ولا تكتب شيئًا بعدها.',
    ext === 'docx'
      ? 'تذكير python-docx: doc=docx.Document(p) · p.add_run(t).bold=True · doc.add_heading(t, level=1) · doc.add_paragraph(t) · para.alignment=docx.enum.text.WD_ALIGN_PARAGRAPH.RIGHT · run.font.size=docx.shared.Pt(14) · doc.save(out)'
      : ext === 'csv' ? '' : 'تذكير openpyxl: from openpyxl.styles import Font, PatternFill, Alignment · خط عريض: cell.font=Font(bold=True) · لون خلفية: cell.fill=PatternFill("solid", fgColor="FFE8A33D") · عرض عمود: ws.column_dimensions["A"].width=20 · تنسيق رقم: cell.number_format="#,##0.00" · آخر صف: ws.max_row · اتجاه الورقة للعربية: ws.sheet_view.rightToLeft=True · الترتيب: اقرأ الصفوف في قائمة ثم رتّبها ثم أعد كتابتها',
    '',
    fileSummary(d),
  ].join('\n');
}

const codeOf = (text) => { const m = /```(?:python|py)\s*\n([\s\S]*?)```/i.exec(text || ''); return m ? m[1] : null; };

// ---------- تشغيل مهمة التعديل بعد اكتمال الرد ----------
async function runTask(msg) {
  const task = msg.taskInfo; if (!task) return;
  const src = files.get(task.key);
  if (!src) { msg.task = { status: 'fail', log: t('taskNeedsFile'), attempts: 0 }; refresh(msg); return; }
  const wheels = /\.(xlsx|xlsm|docx)$/i.test(src.name) ? await ensureOffice() : [];
  if (wheels === null) { msg.task = { status: 'fail', log: t('officeTools'), attempts: 0 }; refresh(msg); return; }
  let code = codeOf(msg.content); let attempts = 0;
  for (;;) {
    msg.task = { status: 'running', log: '', attempts }; refresh(msg);
    if (!code) { msg.task = { status: 'fail', log: t('editNoCode'), attempts }; break; }
    const res = await runPython(code, { files: [{ name: src.name, data: src.buf.slice(0) }], wheels, timeout: 90000 });
    const log = res.lines.map((l) => l.text).join('\n').slice(-3500);
    if (!res.failed && !res.timedOut && res.outputs.length) {
      msg.outputs = [];
      for (const o of res.outputs) {
        const up = await api('POST', `/api/chats/${state.chat.id}/files?name=${encodeURIComponent(o.name)}`, new Blob([o.data]));
        msg.outputs.push({ id: up.id, name: up.name, size: up.size, kind: 'output' });
        if (/\.(xlsx|csv|docx)$/i.test(o.name)) { try { msg.preview = await api('POST', `/api/extract?name=${encodeURIComponent(o.name)}`, new Blob([o.data])); } catch { /* */ } }
      }
      msg.task = { status: 'ok', log, attempts };
      break;
    }
    if (attempts >= 2) { msg.task = { status: 'fail', log: log || res.error || '', attempts }; break; }
    // تصحيح تلقائي: نعيد الخطأ للنموذج ليُصلح الكود
    attempts++;
    msg.task = { status: 'fixing', log, attempts }; refresh(msg);
    const fix = `${taskPrompt({ ...task.doc })}\n\nالكود السابق:\n\`\`\`python\n${code}\n\`\`\`\nفشل التنفيذ بالخطأ التالي:\n\`\`\`\n${(res.error || log || (res.outputs.length ? '' : 'لم يُحفظ أي ملف في /data/out')).slice(-1500)}\n\`\`\`\nأصلح الكود وأعده كاملًا داخل كتلة python واحدة.`;
    try {
      const r = await api('POST', '/api/chat', { model: $('modelSelect').value || 'auto', route: 'code', workspace: 'code', messages: [{ role: 'user', content: fix }], think: 'off' }, { raw: true });
      let out = ''; await readNdjson(r, (j) => { if (j.message?.content) out += j.message.content; });
      code = codeOf(out) || code;
      msg.content += `\n\n**${t('taskFixing', { n: attempts })}**\n\`\`\`python\n${code}\n\`\`\``;
    } catch { break; }
  }
  refresh(msg);
  await persist();
}
function refresh(msg) {
  const idx = state.chat?.messages.indexOf(msg);
  if (idx >= 0) renderMessages(false);
}

// ---------- عرض المصادر والنتائج والمستندات داخل الرسائل ----------
function sourcesHtml(m) {
  if (!m.sources?.length) return '';
  return `<details class="sources"><summary>${ic('book')}<span>${esc(t('sources'))}</span><b>${m.sources.length}</b></summary><ol>${m.sources.map((s) => `<li id="src-${s.n}"><b>[${s.n}]</b> <span dir="auto">${esc(s.file)}</span>${s.loc ? ` · <span class="muted">${esc(s.loc)}</span>` : ''}${s.text ? `<p dir="auto">${esc(s.text)}…</p>` : ''}</li>`).join('')}</ol></details>`;
}
function previewTable(p) {
  const s = p?.sheets?.[0];
  if (s) {
    const rows = s.rows.slice(0, 12); const w = Math.min(10, Math.max(0, ...rows.map((r) => r.length)));
    return `<div class="table-wrap res-table"><table>${rows.map((r, i) => `<tr>${Array.from({ length: w }, (_, j) => `<${i ? 'td' : 'th'} dir="auto">${esc(String(r[j] ?? '').slice(0, 60))}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table></div>${s.nrows > 12 ? `<p class="muted small">… ${s.nrows} ${esc(t('docRows', { n: '' }).trim())}</p>` : ''}`;
  }
  return p?.text ? `<div class="res-text" dir="auto">${renderMd(p.text.slice(0, 1500))}</div>` : '';
}
function taskHtml(m) {
  if (!m.task && !m.outputs?.length) return '';
  const st = m.task?.status || 'ok';
  const label = st === 'running' ? t('taskRunning') : st === 'fixing' ? t('taskFixing', { n: m.task.attempts }) : st === 'ok' ? t('taskOk') : t('taskFail');
  const pill = `<span class="run-status st-${st === 'ok' ? 'ok' : st === 'fail' ? 'err' : 'running'}">${st === 'running' || st === 'fixing' ? '<i class="spin"></i>' : ic(st === 'ok' ? 'check' : 'alert')}<span>${esc(label)}</span></span>`;
  const outs = (m.outputs || []).map((o) => `<a class="file-card" href="/files/chat/${esc(state.chat.id)}/${esc(o.id)}" download="${esc(o.name)}"><span class="fc-ic">${ic(/\.(xlsx|csv)$/i.test(o.name) ? 'sheet' : 'file')}</span><span class="fc-t"><b dir="auto">${esc(o.name)}</b><small>${esc(fmtBytes(o.size))}</small></span><span class="btn small primary">${ic('download')}<span>${esc(t('downloadResult'))}</span></span></a>`).join('');
  return `<div class="task-box"><div class="task-top">${pill}<button type="button" class="mini" data-togglecode>${ic('code')}<span>${esc(t('showCode'))}</span></button></div>${outs}${m.preview ? `<details class="res-prev" open><summary>${esc(t('resultPreview'))}</summary>${previewTable(m.preview)}</details>` : ''}${m.task?.log ? `<details class="task-log"><summary>${esc(t('taskLog'))}</summary><pre dir="auto">${esc(m.task.log)}</pre></details>` : ''}</div>`;
}

// ---------- صفحة مكتبة المعرفة (مساحة «مستندات») ----------
let kn = { list: [], embed: null, open: null };
async function renderLibrary() {
  const v = $('viewDocs');
  try { const r = await api('GET', '/api/knowledge'); kn.list = r.collections; kn.embed = r.embedModel; } catch (e) { v.innerHTML = `<div class="page">${esc(errText(e))}</div>`; return; }
  if (kn.open && !kn.list.some((c) => c.id === kn.open)) kn.open = null;
  const cur = kn.open ? await api('GET', '/api/knowledge/' + kn.open) : null;
  v.innerHTML = `<div class="page">
    <header class="page-head"><div><h1>${esc(t('knowledge'))}</h1><p class="lead">${esc(t('knowledgeSub'))}</p></div><button class="btn primary" id="knNew">${ic('plus')}<span>${esc(t('newCollection'))}</span></button></header>
    <p class="muted small embed-line">${ic(kn.embed ? 'check' : 'alert')} ${esc(kn.embed ? t('embedUsing', { m: kn.embed }) : t('embedNone'))}${kn.embed ? '' : ` <button class="btn small" data-goto="tools">${esc(t('manageModels'))}</button>`}</p>
    <div class="kn-layout">
      <nav class="kn-list">${kn.list.length ? kn.list.map((c) => `<button data-kn="${esc(c.id)}" aria-current="${c.id === kn.open}"><span class="kn-ic">${ic('book')}</span><span><b dir="auto">${esc(c.name)}</b><small>${esc(t('docsCount', { n: c.docs }))} · ${esc(t('chunks', { n: c.chunks }))}</small></span></button>`).join('') : `<p class="muted">${esc(t('noCollections'))}</p>`}</nav>
      <section class="kn-detail">${cur ? `
        <header class="kn-head"><h2 dir="auto">${esc(cur.name)}</h2><span class="spacer"></span>
          <button class="btn small" id="knAdd">${ic('upload')}<span>${esc(t('addDocs'))}</span></button>
          <button class="btn small primary" id="knAsk">${ic('chat')}<span>${esc(t('askLibrary'))}</span></button>
          <button class="btn small icon-only" id="knRen" title="${esc(t('rename'))}">${ic('edit')}</button>
          <button class="btn small icon-only danger" id="knDel" title="${esc(t('delete'))}">${ic('trash')}</button></header>
        <ul class="kn-docs">${cur.docs.map((d) => `<li>${ic(/xlsx|csv/.test(d.kind) ? 'sheet' : 'file')}<span dir="auto">${esc(d.name)}</span><small class="muted">${esc(d.kind.toUpperCase())} · ${esc(t('chunks', { n: d.chunks }))}</small><button class="mini" data-deldoc="${esc(d.id)}" aria-label="${esc(t('delete'))}">${ic('trash')}</button></li>`).join('') || `<li class="muted">${esc(t('addDocs'))}…</li>`}</ul>
        <label class="search kn-search">${ic('search')}<input id="knQ" type="search" placeholder="${esc(t('searchLibrary'))}"></label><div id="knHits"></div>` : `<div class="kn-empty">${ic('book')}<p>${esc(t('knowledgeSub'))}</p></div>`}</section>
    </div></div>`;
  $('knNew').onclick = async () => { const n = await promptBox(t('collectionName'), ''); if (!n) return; const c = await api('POST', '/api/knowledge', { name: n }); kn.open = c.id; renderLibrary(); };
  v.querySelector('.kn-list').onclick = (e) => { const b = e.target.closest('[data-kn]'); if (b) { kn.open = b.dataset.kn; renderLibrary(); } };
  if (!cur) return;
  $('knAdd').onclick = async () => { for (const f of await pickFiles({ accept: ACCEPT })) await indexInto(cur.id, f); renderLibrary(); };
  $('knAsk').onclick = () => { emit('workspace:set', 'chat'); setTimeout(() => { state.chat.collections = [cur.id]; emit('knowledge:linked'); toast(`${t('linkKnowledge')}: ${cur.name}`); $('input').focus(); }, 50); };
  $('knRen').onclick = async () => { const n = await promptBox(t('rename'), cur.name); if (n) { await api('PUT', '/api/knowledge/' + cur.id, { name: n }); renderLibrary(); } };
  $('knDel').onclick = async () => { if (await confirmBox(t('deleteCollectionQ', { c: cur.name }), { danger: true, ok: t('delete') })) { await api('DELETE', '/api/knowledge/' + cur.id); kn.open = null; renderLibrary(); } };
  v.querySelector('.kn-docs').onclick = async (e) => { const b = e.target.closest('[data-deldoc]'); if (b) { await api('DELETE', `/api/knowledge/${cur.id}/docs/${b.dataset.deldoc}`); renderLibrary(); } };
  let qt; $('knQ').oninput = (e) => { clearTimeout(qt); qt = setTimeout(async () => { const q = e.target.value.trim(); if (!q) { $('knHits').innerHTML = ''; return; } const r = await api('POST', '/api/knowledge/search', { collections: [cur.id], q, k: 5 }); $('knHits').innerHTML = r.hits.map((h, i) => `<div class="hit"><b>[${i + 1}] <span dir="auto">${esc(h.docName)}</span>${h.loc ? ' · ' + esc(h.loc) : ''}</b> <small class="muted">${h.score.toFixed(2)}</small><p dir="auto">${esc(h.text.slice(0, 280))}…</p></div>`).join(''); }, 350); };
}

// فهرسة ملف في مجموعة (مع شريط تقدّم في التنزيلات)
async function indexInto(collectionId, file) {
  const { downloads } = await import('../downloads.js');
  const id = 'idx:' + uid();
  downloads.start(id, file.name);
  try {
    const d = await readFile(file, (p, n) => downloads.update(id, { text: `${t('docReading')} ${p}/${n}` }));
    const sections = d.pages ? d.pages.map((p) => ({ text: p.text, loc: (state.settings.lang === 'en' ? 'p. ' : 'ص ') + p.n }))
      : d.sheets ? d.sheets.map((s) => ({ text: `## ${s.name}\n` + s.rows.map((r) => r.join(' | ')).join('\n'), loc: s.name })) : [{ text: d.text, loc: '' }];
    const job = await api('POST', `/api/knowledge/${collectionId}/docs`, { name: file.name, kind: d.kind, sections });
    const r = await fetch(`/api/jobs/${job.id}/stream`, { headers: authHeaders() });
    let final = null;
    await readNdjson(r, (j) => { final = j; if (j.status === 'running') downloads.update(id, { completed: j.progress.completed || 0, total: j.progress.total || 0, text: t('docIndexing') }); });
    if (final?.status !== 'done') throw new ApiError(final?.error?.code || 'index_failed');
    downloads.done(id, t('docIndexed', { n: final.result?.chunks || 0 }));
    return final.result;
  } catch (e) { downloads.fail(id, errText(e)); return null; }
}

// زر «المعرفة» في الشريط العلوي: ربط مجموعات بالمحادثة الحالية
function renderKnowledgeButton() {
  const host = $('topExtra'); if (!host) return;
  let b = $('knBtn');
  if (!b) { b = document.createElement('button'); b.id = 'knBtn'; b.className = 'btn icon-only kn-btn'; host.appendChild(b); b.onclick = openLinker; }
  const n = state.chat?.collections?.length || 0;
  b.innerHTML = `${ic('book')}${n ? `<b>${n}</b>` : ''}`; b.title = t('linkKnowledge'); b.setAttribute('aria-label', t('linkKnowledge'));
  b.classList.toggle('on', !!n);
}
async function openLinker() {
  const r = await api('GET', '/api/knowledge?all=1');
  const cur = new Set(state.chat?.collections || []);
  const d = document.createElement('dialog'); d.className = 'mini-dlg';
  d.innerHTML = `<form method="dialog"><p><b>${esc(t('linkedCollections'))}</b></p><div class="kn-pick">${r.collections.map((c) => `<label class="check"><input type="checkbox" value="${esc(c.id)}" ${cur.has(c.id) ? 'checked' : ''}><span dir="auto">${esc(c.name)} <small class="muted">${esc(t('docsCount', { n: c.docs }))}${c.scope === 'chat' ? ' · ' + esc(t('chatDocs')) : ''}</small></span></label>`).join('') || `<p class="muted">${esc(t('noCollections'))}</p>`}</div><div class="row end"><button class="btn" value="0">${esc(t('cancel'))}</button><button class="btn primary" value="1">${esc(t('ok'))}</button></div></form>`;
  document.body.appendChild(d);
  d.addEventListener('close', () => { if (d.returnValue === '1' && state.chat) { state.chat.collections = [...d.querySelectorAll('input:checked')].map((x) => x.value); renderKnowledgeButton(); if (state.chat.messages.length) persist(); } d.remove(); });
  d.showModal();
}

export function init() {
  pages.docs = renderLibrary;
  addAttachItem({ id: 'doc', icon: 'file', label: () => t('attachDoc'), run: async () => { for (const f of await pickFiles({ accept: ACCEPT })) addDoc(f); } });
  window.addEventListener('caf:file', (e) => addDoc(e.detail));
  // قبل الإرسال: تعديل ملف ← مهمة Python · مستند صغير ← سياق مباشر · كبير ← فهرسة في مجموعة خاصة بالمحادثة
  beforeSend.push(async (opts, text) => {
    const docs = pending.filter((p) => p.payload?.doc).map((p) => p.payload.doc);
    if (!docs.length) return;
    const editable = docs.find((d) => d.editable);
    if (editable && EDIT_RE.test(text || '')) {
      opts.route = 'code';
      opts.context = taskPrompt(editable);
      opts.taskInfo = { key: editable.key, doc: { name: editable.name, sheets: editable.sheets, text: editable.text.slice(0, 3000) } };
      opts.files = [...(opts.files || []), { name: editable.name, size: editable.size, kind: 'edit', chars: editable.chars }];
      return;
    }
    const budget = Math.floor((state.settings.numCtx || 4096) * 0.55);
    const small = docs.filter((d) => tokensOf(d.chars) <= budget);
    const large = docs.filter((d) => tokensOf(d.chars) > budget);
    if (small.length) opts.context = [opts.context, ...small.map((d) => `📄 المستند «${d.name}»:\n${d.text}`)].filter(Boolean).join('\n\n');
    if (large.length) {
      toast(t('docTooBig'), 4000);
      let col = (await api('GET', '/api/knowledge?all=1')).collections.find((c) => c.scope === 'chat' && c.chatId === state.chat.id);
      if (!col) col = await api('POST', '/api/knowledge', { name: (state.chat.title || large[0].name).slice(0, 60), scope: 'chat', chatId: state.chat.id });
      for (const d of large) {
        const sections = d.pages ? d.pages.map((p) => ({ text: p.text, loc: 'ص ' + p.n })) : d.sheets ? d.sheets.map((s) => ({ text: s.rows.map((r) => r.join(' | ')).join('\n'), loc: s.name })) : [{ text: d.text, loc: '' }];
        const job = await api('POST', `/api/knowledge/${col.id}/docs`, { name: d.name, kind: d.kind, sections });
        const r = await fetch(`/api/jobs/${job.id}/stream`, { headers: authHeaders() }); await readNdjson(r, () => {});
      }
      state.chat.collections = [...new Set([...(state.chat.collections || []), col.id])];
      renderKnowledgeButton();
    }
    opts.files = [...(opts.files || []), ...docs.map((d) => ({ name: d.name, size: d.size, kind: large.includes(d) ? 'indexed' : 'doc', chars: d.chars }))];
  });
  // ربط مهمة التعديل بالرد الناتج ثم التشغيل
  let pendingTask = null;
  beforeSend.push((opts) => { pendingTask = opts.taskInfo || null; });
  on('chat:done', (am) => { if (pendingTask && am?.content) { am.taskInfo = pendingTask; pendingTask = null; runTask(am); } });
  msgExtras.push((m) => (m.role === 'assistant' ? taskHtml(m) + sourcesHtml(m) : ''));
  $('msgs').addEventListener('click', (e) => { const tc = e.target.closest('[data-togglecode]'); if (tc) { tc.closest('.msg').classList.toggle('show-code'); return; } const c = e.target.closest('sup.cite'); if (c) { const d = c.closest('.msg')?.querySelector('details.sources'); if (d) { d.open = true; d.querySelector(`#src-${c.dataset.cite}`)?.scrollIntoView({ block: 'nearest' }); } } });
  slashCommands.push({ cmd: 'doc', icon: 'file', label: () => t('attachDoc'), run: async (rest) => { for (const f of await pickFiles({ accept: ACCEPT })) addDoc(f); if (rest.trim()) setInput(rest.trim()); return true; } });
  on('chat:changed', renderKnowledgeButton); on('ui:applied', renderKnowledgeButton); on('knowledge:linked', renderKnowledgeButton);
  on('view:changed', (v) => { const b = $('knBtn'); if (b) b.hidden = v !== 'chat'; });
  renderKnowledgeButton();
}
