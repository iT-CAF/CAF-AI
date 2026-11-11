/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// تصدير المحادثة (Markdown / صفحة HTML مستقلة بصورها / PDF عبر الطباعة) + النسخ الاحتياطي والاستعادة في الإعدادات.
import { state, $, t, esc, ic, api, toast, on, errText, confirmBox, lang, download, authHeaders, fmtBytes } from '../core.js';
import { renderMd, splitThink } from '../md.js';
import { settingsSections } from '../settings.js';
import { pickFiles } from '../composer.js';

window.I18N_ADD({
  ar: {
    exportChat: 'تصدير المحادثة', exportMd: 'Markdown', exportMdSub: 'نص منسّق (‎.md‎) — مع صورها في ملف zip', exportHtml: 'صفحة HTML', exportHtmlSub: 'ملف واحد يُفتح في أي متصفح، بصوره',
    exportPdf: 'PDF', exportPdfSub: 'نافذة الطباعة ← «حفظ كـ PDF»', exporting: 'جارٍ التصدير…', exportedFrom: 'صُدّرت من كآف AI', you: 'أنت',
    backupTitle: 'النسخ الاحتياطي والاستعادة', backupSub: 'ملف zip واحد يضم المحادثات والمرفقات والصور والمعرفة واللوحات والإعدادات والمهارات المستوردة — بدون النماذج والمحركات (تُنزَّل من جديد).',
    backupNow: 'تنزيل نسخة احتياطية', restoreBtn: 'استعادة من نسخة…', backupSummary: '{chats} محادثة · {files} ملف · {size}',
    confirmRestore: 'استعادة النسخة المؤرخة {date} (كآف AI {v} · {n} ملف · {size})؟\n\nستُنقل بياناتك الحالية أولًا إلى نسخة أمان داخل مجلد البيانات (data/backups)، ثم يُعاد تشغيل كآف AI.',
    restoring: 'جارٍ الاستعادة…', restoredOk: 'تمت الاستعادة — يُعاد التشغيل…', backupPreparing: 'جارٍ تجهيز النسخة…',
    err_backup_too_large: 'البيانات أكبر من 1.5 جيجابايت. انسخ مجلد البيانات يدويًا بدلًا من ذلك.', err_bad_backup: 'هذا الملف ليس نسخة احتياطية صالحة من كآف AI.', err_backup_newer: 'هذه النسخة من إصدار أحدث من كآف AI. حدّث البرنامج أولًا.', err_disk_full: 'لا توجد مساحة كافية على القرص.',
  },
  en: {
    exportChat: 'Export chat', exportMd: 'Markdown', exportMdSub: 'Formatted text (.md) — zipped with its images', exportHtml: 'HTML page', exportHtmlSub: 'One file that opens in any browser, with images',
    exportPdf: 'PDF', exportPdfSub: 'Print dialog → “Save as PDF”', exporting: 'Exporting…', exportedFrom: 'Exported from CAF AI', you: 'You',
    backupTitle: 'Backup & restore', backupSub: 'One zip with chats, attachments, images, knowledge, canvases, settings and imported skills — without models and engines (they are re-downloaded).',
    backupNow: 'Download a backup', restoreBtn: 'Restore from a backup…', backupSummary: '{chats} chats · {files} files · {size}',
    confirmRestore: 'Restore the backup from {date} (CAF AI {v} · {n} files · {size})?\n\nYour current data is first moved to a safety copy inside the data folder (data/backups), then CAF AI restarts.',
    restoring: 'Restoring…', restoredOk: 'Restored — restarting…', backupPreparing: 'Preparing the backup…',
    err_backup_too_large: 'Your data is larger than 1.5 GB. Copy the data folder manually instead.', err_bad_backup: 'This file is not a valid CAF AI backup.', err_backup_newer: 'This backup comes from a newer CAF AI. Update the app first.', err_disk_full: 'Not enough disk space.',
  },
});

const fileBase = () => (state.chat?.title || 'chat').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'chat';
async function toDataUrl(url) {
  try { const b = await (await fetch(url, { headers: authHeaders(), credentials: 'same-origin' })).blob(); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); } catch { return ''; }
}
const EXPORT_CSS = `
:root{--ink:#14181c;--muted:#5d6670;--line:#e3e1dc;--bg:#fbfaf7;--card:#fff;--accent:#c97c12;--code:#f3f1ec}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.85 "IBM Plex Sans Arabic","Segoe UI",Tahoma,system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:36px 24px 60px}
header.top{display:flex;align-items:center;gap:14px;border-bottom:2px solid var(--ink);padding-bottom:16px;margin-bottom:26px}
header.top .mark{width:42px;height:42px;border-radius:10px;background:var(--ink);color:#f5a524;display:grid;place-items:center;font:700 22px/1 system-ui}
header.top h1{font-size:24px;line-height:1.3;margin:0}header.top small{color:var(--muted);display:block;font-size:13px}
.m{padding:18px 0;border-bottom:1px solid var(--line);break-inside:avoid-page}
.who{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
.who code{font-size:11px;color:var(--muted);text-transform:none;letter-spacing:0;margin-inline-start:6px}
.m.user .txt{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px;white-space:pre-wrap}
h1,h2,h3,h4{line-height:1.35}p{margin:.5em 0}a{color:var(--accent)}
.codeblock{border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:12px 0;background:var(--code);direction:ltr;text-align:left;break-inside:avoid}
.codeblock .bar{font:600 11px ui-monospace,Menlo,monospace;color:var(--muted);padding:6px 12px;border-bottom:1px solid var(--line);text-transform:uppercase}
.codeblock pre{margin:0;padding:12px 14px;overflow:auto;font:13px/1.6 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em;background:var(--code);padding:1px 5px;border-radius:5px}pre code{background:none;padding:0}
table{border-collapse:collapse;margin:10px 0;width:100%}th,td{border:1px solid var(--line);padding:6px 10px;text-align:start}th{background:var(--code)}
blockquote{margin:10px 0;padding:4px 14px;border-inline-start:3px solid var(--accent);color:var(--muted)}
img{max-width:100%;border-radius:10px;border:1px solid var(--line)}.imgs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.imgs img{max-height:320px}
.src{font-size:13px;color:var(--muted)}.math{font-family:ui-monospace,Menlo,monospace;direction:ltr}
footer{max-width:860px;margin:0 auto;padding:0 24px 40px;color:var(--muted);font-size:13px;text-align:center}
@media print{body{background:#fff}main{padding:0}@page{margin:16mm}a{color:inherit}}
@media (prefers-color-scheme:dark){:root{--ink:#eceae4;--muted:#9aa3ad;--line:#2a3036;--bg:#111417;--card:#171b1f;--code:#1b2026}header.top .mark{background:#f5a524;color:#111}}
`;
async function chatHtml() {
  const chat = state.chat; const ar = lang() !== 'en';
  const out = [];
  for (const m of chat.messages) {
    if (m.role === 'system') continue;
    const isUser = m.role === 'user';
    let body = isUser ? `<div class="txt" dir="auto">${esc(m.content)}</div>` : renderMd(m.errCode ? `> ⚠ ${m.errCode}` : splitThink(m.content).content, { artifacts: false });
    const imgs = [];
    for (const im of m.images || []) { const d = await toDataUrl(`/files/att/${chat.id}/${im.id}`); if (d) imgs.push(`<img src="${d}" alt="${esc(im.name || '')}">`); }
    for (const id of m.gen?.images || []) { const d = await toDataUrl(`/files/img/${id}`); if (d) imgs.push(`<img src="${d}" alt="${esc(m.gen.prompt || '')}">`); }
    if (imgs.length) body += `<div class="imgs">${imgs.join('')}</div>`;
    if (m.sources?.length) body += `<p class="src">${esc(ar ? 'المصادر' : 'Sources')}: ${m.sources.map((s) => `[${s.n}] ${esc(s.file)}${s.loc ? ` (${esc(s.loc)})` : ''}`).join(' · ')}</p>`;
    out.push(`<section class="m ${isUser ? 'user' : 'ai'}"><div class="who"><bdi>${esc(isUser ? t('you') : t('assistant'))}</bdi>${!isUser && m.model ? ` <code dir="ltr">${esc(m.model)}</code>` : ''}</div>${body}</section>`);
  }
  // تنظيف: لا أزرار ولا أرقام أسطر ولا عناصر تفاعلية داخل الملف المصدَّر
  const box = document.createElement('div'); box.innerHTML = out.join('');
  box.querySelectorAll('button, .tools, .cb-tabs, .gutter, .cursor, .cb-preview, .run-out, .art-acts').forEach((x) => x.remove());
  box.querySelectorAll('.codeblock').forEach((cb) => { const l = cb.dataset.lang || ''; const code = cb.querySelector('pre.src code')?.textContent || ''; cb.innerHTML = `<div class="bar">${esc(l || 'code')}</div><pre><code>${esc(code)}</code></pre>`; });
  box.querySelectorAll('.mermaid-box').forEach((mb) => { mb.outerHTML = `<div class="codeblock"><div class="bar">mermaid</div><pre><code>${esc(mb.dataset.src || '')}</code></pre></div>`; });
  const date = new Date(chat.updated || chat.created || Date.now()).toLocaleString(ar ? 'ar' : 'en');
  return `<!DOCTYPE html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(chat.title || 'CAF AI')}</title><meta name="generator" content="CAF AI ${esc(state.info?.version || '')} — it-caf.com"><style>${EXPORT_CSS}</style></head>
<body><main><header class="top"><div class="mark">ك</div><div><h1 dir="auto">${esc(chat.title || t('exportChat'))}</h1><small><bdi>${esc(t('exportedFrom'))}</bdi> · <bdi>${esc(date)}</bdi></small></div></header>${box.innerHTML}</main>
<footer>${esc(ar ? 'كآف AI — ذكاء اصطناعي يعمل على جهازك بالكامل · برمجة وتصميم كآف' : 'CAF AI — AI that runs entirely on your device · by CAF')} · <a href="https://it-caf.com">it-caf.com</a> · <a href="https://github.com/iT-CAF/CAF-AI">GitHub</a></footer></body></html>`;
}

async function exportAs(kind) {
  const chat = state.chat; if (!chat?.messages?.length) return;
  toast(t('exporting'));
  try {
    if (kind === 'md') {
      const r = await api('GET', `/api/chats/${chat.id}/export`, undefined, { raw: true });
      if (!r.ok) throw new Error('http_' + r.status);
      const zip = (r.headers.get('content-type') || '').includes('zip');
      download(await r.blob(), fileBase() + (zip ? '.zip' : '.md'));
      return;
    }
    const html = await chatHtml();
    if (kind === 'html') { download(new Blob([html], { type: 'text/html;charset=utf-8' }), fileBase() + '.html'); return; }
    // PDF: نطبع الصفحة نفسها من إطار مخفي (المستخدم يختار «حفظ كـ PDF»)
    const fr = document.createElement('iframe'); fr.className = 'print-frame'; fr.setAttribute('aria-hidden', 'true'); fr.srcdoc = html;
    document.body.appendChild(fr);
    fr.onload = () => { setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast(errText(e)); } setTimeout(() => fr.remove(), 60000); }, 250); };
  } catch (e) { toast(errText(e), 4000); }
}

function menu(anchor) {
  $('exportPop')?.remove();
  const pop = document.createElement('div'); pop.id = 'exportPop'; pop.className = 'pop-menu export-pop'; pop.setAttribute('role', 'menu');
  pop.innerHTML = [['md', 'file', 'exportMd', 'exportMdSub'], ['html', 'globe', 'exportHtml', 'exportHtmlSub'], ['pdf', 'filedown', 'exportPdf', 'exportPdfSub']]
    .map(([k, i, a, b]) => `<button type="button" role="menuitem" data-exp="${k}">${ic(i)}<span><b>${esc(t(a))}</b><small>${esc(t(b))}</small></span></button>`).join('');
  anchor.parentElement.appendChild(pop);
  pop.querySelector('button').focus();
  pop.onclick = (e) => { const b = e.target.closest('[data-exp]'); if (b) { pop.remove(); exportAs(b.dataset.exp); } };
  pop.onkeydown = (e) => { if (e.key === 'Escape') { pop.remove(); anchor.focus(); } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const bs = [...pop.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement); bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); } };
  setTimeout(() => document.addEventListener('click', function close(ev) { if (!pop.contains(ev.target) && !anchor.contains(ev.target)) { pop.remove(); document.removeEventListener('click', close); } }), 0);
}

// ---------- النسخ الاحتياطي ----------
function backupSection(el) {
  const box = document.createElement('div'); box.className = 'backup-box';
  box.innerHTML = `<h4>${ic('history')}<span>${esc(t('backupTitle'))}</span></h4><p class="muted small">${esc(t('backupSub'))}</p>
    <p class="small" id="bkSum">…</p>
    <div class="row wrap"><button type="button" class="btn primary" id="bkNow">${ic('download')}<span>${esc(t('backupNow'))}</span></button><button type="button" class="btn" id="bkRestore">${ic('upload')}<span>${esc(t('restoreBtn'))}</span></button></div>
    <p class="small muted" id="bkStatus" aria-live="polite"></p>`;
  el.appendChild(box);
  api('GET', '/api/backup/summary').then((s) => { box.querySelector('#bkSum').textContent = t('backupSummary', { chats: s.chats, files: s.files, size: fmtBytes(s.bytes) }); }).catch(() => {});
  const st = box.querySelector('#bkStatus');
  box.querySelector('#bkNow').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; st.textContent = t('backupPreparing');
    try {
      const r = await api('GET', '/api/backup', undefined, { raw: true });
      if (!r.ok) { let j = {}; try { j = await r.json(); } catch { /* */ } throw Object.assign(new Error(j.error), { code: j.error || 'http_' + r.status }); }
      download(await r.blob(), `CAF-AI-backup-${new Date().toISOString().slice(0, 10)}.zip`); st.textContent = '';
    } catch (err) { st.textContent = errText(err); } finally { b.disabled = false; }
  };
  box.querySelector('#bkRestore').onclick = async () => {
    const [f] = await pickFiles({ accept: '.zip,application/zip' }); if (!f) return;
    const buf = await f.arrayBuffer();
    try {
      const chk = await api('POST', '/api/backup/restore?check=1', new Blob([buf], { type: 'application/zip' }));
      const m = chk.manifest || {};
      if (!(await confirmBox(t('confirmRestore', { date: new Date(m.created || Date.now()).toLocaleString(lang() === 'en' ? 'en' : 'ar'), v: m.version || '?', n: chk.files, size: fmtBytes(chk.bytes) }), { danger: true, ok: t('restoreBtn').replace('…', '') }))) return;
      st.textContent = t('restoring');
      await api('POST', '/api/backup/restore', new Blob([buf], { type: 'application/zip' }));
      st.textContent = t('restoredOk');
      for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 1000)); try { if ((await fetch('/api/info')).ok && i > 1) { location.reload(); return; } } catch { /* يعيد التشغيل */ } }
    } catch (err) { st.textContent = errText(err); }
  };
}

export function init() {
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn icon-only'; btn.id = 'exportBtn';
  btn.innerHTML = ic('filedown'); btn.setAttribute('aria-haspopup', 'menu');
  const wrap = document.createElement('span'); wrap.className = 'pop-anchor'; wrap.appendChild(btn);
  $('topActions').appendChild(wrap);
  btn.onclick = (e) => { e.stopPropagation(); if ($('exportPop')) $('exportPop').remove(); else menu(btn); };
  const sync = () => { const ok = state.view === 'chat' && !!state.chat?.messages?.length; wrap.hidden = !ok; btn.title = t('exportChat'); btn.setAttribute('aria-label', t('exportChat')); };
  on('view:changed', sync); on('chat:changed', sync); on('chat:done', sync); on('ui:applied', sync); on('chats:wiped', sync); sync();
  settingsSections.push({ into: 'data', render: backupSection });
}
