/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// Markdown آمن: يُهرَّب كل شيء أولًا، ثم تُضاف العناصر المسموحة فقط. الكود دائمًا LTR.
// تلوين الكود (highlight.js) والرياضيات (KaTeX) والمخططات (Mermaid) تُحمَّل محليًا عند الحاجة فقط.
import { esc, t, ic, loadScript, loadCss, state } from './core.js';

export const EXT = {
  javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', python: 'py', py: 'py', html: 'html', css: 'css', scss: 'scss',
  json: 'json', bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh', powershell: 'ps1', ps1: 'ps1', php: 'php', java: 'java', kotlin: 'kt', swift: 'swift',
  c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs', go: 'go', golang: 'go', rust: 'rs', rs: 'rs', ruby: 'rb', sql: 'sql', yaml: 'yml', yml: 'yml',
  xml: 'xml', svg: 'svg', markdown: 'md', md: 'md', dart: 'dart', lua: 'lua', r: 'r', toml: 'toml', ini: 'ini', dockerfile: 'Dockerfile', vue: 'vue', txt: 'txt', text: 'txt',
};
export const RUNNABLE = new Set(['javascript', 'js', 'python', 'py', 'html', 'svg']);

// اتجاه كل كتلة حسب نصها: العربية (حتى مع كلمات إنجليزية مثل HTML وCSS) ← RTL، وإلا LTR
const AR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
export function dirOf(text) {
  const s = String(text || '').replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/<[^>]+>/g, ' ');
  const ar = (s.match(AR_RE) || []).length;
  if (!ar) return 'ltr';
  const lat = (s.match(/[A-Za-z]/g) || []).length;
  return ar * 3 >= lat ? 'rtl' : 'ltr';
}
const D = (text) => ` dir="${dirOf(text)}"`;

// يستبدل الكتل التي تغيّر مصدرها فقط (البث بلا وميض؛ الكتل المكتملة تبقى كما هي مع تلوينها)
export function morph(container, html) {
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const fresh = [...tpl.content.childNodes]; const old = [...container.childNodes];
  for (let i = 0; i < fresh.length; i++) {
    const f = fresh[i]; const src = f.nodeType === 1 ? f.outerHTML : f.textContent; const o = old[i];
    if (o && o.__src === src) continue;
    f.__src = src;
    if (o) container.replaceChild(f, o); else container.appendChild(f);
  }
  for (let i = fresh.length; i < old.length; i++) old[i].remove();
}

function inline(s) {
  const codes = []; const maths = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000c${codes.length - 1}\u0000`; });
  // رياضيات سطرية: \( … \) أو $…$ (لا تبدأ/تنتهي بمسافة، وليست أرقامًا فقط مثل الأسعار)
  s = s.replace(/\\\((.+?)\\\)/g, (_, m) => { maths.push(m); return `\u0000m${maths.length - 1}\u0000`; });
  s = s.replace(/(^|[^\\$\w])\$(?!\s)([^$\n]{1,300}?[^\s$\\])\$(?![\w$])/g, (all, pre, m) => {
    if (/^[\d.,\s]+$/.test(m)) return all;
    maths.push(m); return `${pre}\u0000m${maths.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[(\d{1,2})\]/g, '<sup class="cite" data-cite="$1">[$1]</sup>');
  return s.replace(/\u0000c(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`)
    .replace(/\u0000m(\d+)\u0000/g, (_, i) => `<span class="math" data-tex="${esc(maths[+i])}">${esc(maths[+i])}</span>`);
}

const PREVIEWABLE = new Set(['html', 'htm', 'svg']);
function codeBlock(lang, code, { open, before = '' }) {
  const l = (lang || '').toLowerCase();
  if (l === 'mermaid' && !open) return `<div class="mermaid-box" data-src="${esc(code)}"><pre class="mermaid-src">${esc(code)}</pre></div>`;
  const lines = code.split('\n').length;
  const wrap = state.settings?.wrapCode ? ' wrap' : '';
  const tabs = PREVIEWABLE.has(l)
    ? `<div class="cb-tabs" role="tablist"><button type="button" role="tab" data-cbtab="code" aria-selected="true">${ic('code')}<span>${esc(t('codeTab'))}</span></button><button type="button" role="tab" data-cbtab="preview" aria-selected="false"${open ? ' disabled' : ''}>${ic('eye')}<span>${esc(t('previewTab'))}</span></button></div>`
    : RUNNABLE.has(l) ? `<button type="button" class="mini run-btn" data-run="1" title="${esc(t('runCode'))}"${open ? ' disabled' : ''}>${ic('play')}<span>${esc(t('run'))}</span></button>` : '';
  const block = `<div class="codeblock${wrap}" data-lang="${esc(l)}"${open ? ' data-live="1"' : ''}><div class="bar"><span class="cb-title">${ic('filecode')}<b class="lang">${esc(l || 'code')}</b><span class="cb-lines">${esc(t('nLines', { n: lines }))}</span></span><span class="tools">`
    + `${tabs}<span class="cb-sep"></span><button type="button" class="mini" data-canvas title="${esc(t('openCanvas'))}" aria-label="${esc(t('openCanvas'))}">${ic('panel')}</button>`
    + `<button type="button" class="mini" data-wrap title="${esc(t('wrapLines'))}" aria-label="${esc(t('wrapLines'))}">${ic('wrap')}</button>`
    + `<button type="button" class="mini" data-dl title="${esc(t('downloadFile'))}" aria-label="${esc(t('downloadFile'))}">${ic('download')}</button>`
    + `<button type="button" class="mini" data-copy>${ic('copy')}<span>${esc(t('copy'))}</span></button></span></div>`
    + `<div class="code-wrap"><pre class="gutter" aria-hidden="true">${Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</pre><pre class="src"><code class="${l ? 'language-' + esc(l) : ''}">${esc(code)}</code></pre></div></div>`;
  // مساحة الكود: صفحات HTML تظهر كبطاقة ملف (المعاينة في اللوحة الجانبية) بدل كتلة طويلة
  if (state.workspace === 'code' && PREVIEWABLE.has(l) && lines >= 8) {
    const name = guessFileName(code, l, before);
    return `<div class="artifact${open ? ' writing' : ''}" data-lang="${esc(l)}"><div class="art-head"><span class="art-ic">${ic('filecode')}</span><div class="art-meta"><b dir="ltr">${esc(name)}</b><small>${esc(l.toUpperCase())} · ${esc(t('nLines', { n: lines }))} · <span class="art-state">${esc(t(open ? 'writingNow' : 'readyNow'))}</span></small></div>`
      + `<div class="art-acts"><button type="button" class="btn small primary" data-artopen${open ? ' disabled' : ''}>${ic('eye')}<span>${esc(t('previewTab'))}</span></button><button type="button" class="btn small" data-artcode aria-expanded="false">${ic('code')}<span>${esc(t('codeTab'))}</span></button><button type="button" class="btn small icon-only" data-dl title="${esc(t('downloadFile'))}" aria-label="${esc(t('downloadFile'))}">${ic('download')}</button></div></div>`
      + `<div class="art-code" hidden>${block}</div></div>`;
  }
  return block;
}

export function renderMd(src, { live = false } = {}) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = []; let i = 0;
  const isTable = (a, b) => a && b && a.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(b);
  while (i < lines.length) {
    const ln = lines[i];
    const fence = ln.match(/^\s*(```+|~~~+)\s*([\w+#.-]*)/);
    if (fence) {
      const close = fence[1][0].repeat(3);
      const buf = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith(close)) buf.push(lines[i++]);
      const open = i >= lines.length; // الكتلة لم تُغلق بعد (أثناء البث)
      i++;
      out.push(codeBlock(fence[2], buf.join('\n'), { open: live && open, before: out.length ? out[out.length - 1].replace(/<[^>]+>/g, '') : '' }));
      continue;
    }
    // رياضيات كتلية $$ … $$ أو \[ … \]
    const mb = ln.match(/^\s*(\$\$|\\\[)(.*)$/);
    if (mb) {
      const end = mb[1] === '$$' ? '$$' : '\\]';
      let body = mb[2]; const buf = [];
      if (body.trim().endsWith(end) && body.trim().length > end.length) { buf.push(body.trim().slice(0, -end.length)); i++; }
      else {
        if (body.trim()) buf.push(body); i++;
        while (i < lines.length && !lines[i].trim().endsWith(end)) buf.push(lines[i++]);
        if (i < lines.length) { const last = lines[i].trim(); buf.push(last.slice(0, -end.length)); i++; }
      }
      const tex = buf.join('\n').trim();
      out.push(`<div class="math display" data-tex="${esc(tex)}" data-display="1">${esc(tex)}</div>`);
      continue;
    }
    let m;
    if ((m = ln.match(/^(#{1,6})\s+(.*)$/))) { const n = Math.min(4, m[1].length); out.push(`<h${n}${D(m[2])}>${inline(m[2])}</h${n}>`); i++; continue; }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }
    if (isTable(ln, lines[i + 1])) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const aligns = lines[i + 1].trim().replace(/^\||\|$/g, '').split('|').map((c) => (/^\s*:-+:\s*$/.test(c) ? 'center' : /-+:\s*$/.test(c) ? 'end' : ''));
      const tdir = D(ln); const head = cells(ln); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      const td = (c, j, tag) => `<${tag}${aligns[j] ? ` style="text-align:${aligns[j]}"` : ''}>${c}</${tag}>`;
      out.push(`<div class="table-wrap"${tdir}><table><thead><tr>${head.map((c, j) => td(c, j, 'th')).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, j) => td(c, j, 'td')).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*>\s?/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote${D(buf.join(' '))}>${renderMd(buf.join('\n'))}</blockquote>`); continue;
    }
    if (/^\s*([-*+])\s+/.test(ln) || /^\s*\d+[.)]\s+/.test(ln)) {
      const ordered = /^\s*\d+[.)]\s+/.test(ln); const items = []; const raw = [];
      const re = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      const startNum = ordered ? parseInt(ln.match(/^\s*(\d+)/)[1], 10) : 1;
      while (i < lines.length) {
        if (re.test(lines[i])) {
          let txt = lines[i++].match(re)[1]; raw.push(txt);
          const task = txt.match(/^\[( |x|X)\]\s+(.*)$/);
          // أسطر تابعة بمسافة بادئة (قائمة متداخلة بسيطة)
          const sub = [];
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i].trim() ? lines[i] : '')) sub.push(lines[i++].replace(/^\s{2,4}/, ''));
          if (task) txt = `<input type="checkbox" disabled ${task[1] !== ' ' ? 'checked' : ''}> ${inline(task[2])}`; else txt = inline(txt);
          items.push(txt + (sub.length ? renderMd(sub.join('\n')) : ''));
        } else if (!lines[i].trim() && i + 1 < lines.length && re.test(lines[i + 1])) i++;
        else break;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}${D(raw.join(' '))}${ordered && startNum !== 1 ? ` start="${startNum}"` : ''}>${items.map((x) => `<li>${x}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    if (!ln.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(\s*(```|~~~)|#{1,6}\s|\s*>|\s*[-*+]\s|\s*\d+[.)]\s|\s*(\$\$|\\\[))/.test(lines[i]) && !isTable(lines[i], lines[i + 1])) buf.push(lines[i++]);
    out.push(`<p${D(buf.join(' '))}>${inline(buf.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('');
}

// ---------- التحسينات بعد الرسم (تلوين، رياضيات، مخططات) ----------
const V = () => `?v=${encodeURIComponent(state.info?.version || '')}`;
let hljsReady = null;
const ensureHljs = () => (hljsReady ||= loadScript('/vendor/hljs/highlight.min.js' + V()));
let katexReady = null;
const ensureKatex = () => (katexReady ||= Promise.all([loadCss('/vendor/katex/katex.min.css' + V()), loadScript('/vendor/katex/katex.min.js' + V())]));
let mermaidReady = null;
const ensureMermaid = () => (mermaidReady ||= loadScript('/vendor/mermaid/mermaid.min.js' + V()).then(() => {
  window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral', fontFamily: 'IBM Plex Sans Arabic, system-ui, sans-serif' });
}));

let mermaidSeq = 0;
export async function enhance(root) {
  if (!root) return;
  const codes = root.querySelectorAll('.codeblock:not([data-hl]):not([data-live]) pre.src code');
  if (codes.length) {
    try {
      await ensureHljs();
      for (const c of codes) {
        const box = c.closest('.codeblock'); box.dataset.hl = '1';
        const l = box.dataset.lang;
        if (c.textContent.length > 200000) continue;
        try {
          const res = l && window.hljs.getLanguage(l) ? window.hljs.highlight(c.textContent, { language: l, ignoreIllegals: true }) : window.hljs.highlightAuto(c.textContent);
          c.innerHTML = res.value; // مخرجات highlight.js مُهرَّبة
          if (!l && res.language) box.querySelector('.lang').textContent = res.language;
          c.classList.add('hljs');
        } catch { /* لغة غير معروفة */ }
      }
    } catch { /* المكتبة غير متاحة: يبقى الكود بلا تلوين */ }
  }
  const maths = root.querySelectorAll('.math:not([data-done])');
  if (maths.length) {
    try {
      await ensureKatex();
      for (const el of maths) {
        el.dataset.done = '1';
        try { window.katex.render(el.dataset.tex, el, { displayMode: el.dataset.display === '1', throwOnError: false, trust: false, strict: 'ignore', output: 'htmlAndMathml' }); } catch { /* يبقى النص */ }
      }
    } catch { /* */ }
  }
  const boxes = root.querySelectorAll('.mermaid-box:not([data-done])');
  if (boxes.length) {
    try {
      await ensureMermaid();
      for (const box of boxes) {
        box.dataset.done = '1';
        const id = `mmd-${Date.now()}-${++mermaidSeq}`;
        try {
          const { svg } = await window.mermaid.render(id, box.dataset.src);
          box.innerHTML = svg; box.classList.add('ok');
        } catch {
          box.classList.add('bad');
          box.insertAdjacentHTML('beforeend', `<p class="mermaid-err">${esc(t('mermaidError'))}</p>`);
          document.getElementById('d' + id)?.remove(); // عنصر الخطأ المؤقت الذي تتركه Mermaid
        }
      }
    } catch { /* */ }
  }
}

// يفصل وسوم <think> إن أرسلها النموذج داخل المحتوى نفسه
export function splitThink(content) {
  const m = /^\s*<think>([\s\S]*?)(<\/think>|$)/.exec(content || '');
  if (!m) return { thinking: '', content: content || '', open: false };
  return { thinking: m[1].trim(), content: (content || '').slice(m[0].length).replace(/^\s+/, ''), open: !m[2] };
}

// اسم الملف المقترح من «**الملف:** `name.ext`» أو تعليق في أول سطر
export function guessFileName(code, lang, contextBefore = '') {
  const m = /(?:الملف|اسم الملف|File|file|filename)\s*[:：]\s*\**\s*`?([\w./-]{1,120}\.[A-Za-z0-9]{1,8})`?/.exec(contextBefore.slice(-300));
  if (m && /^[\w./-]+$/.test(m[1])) return m[1].split('/').pop();
  const first = (code.split('\n')[0] || '').trim();
  const c = /^(?:\/\/|#|<!--|\/\*|--)\s*([\w.-]+\.[A-Za-z0-9]{1,8})\b/.exec(first);
  if (c) return c[1];
  return `caf-code.${EXT[(lang || '').toLowerCase()] || 'txt'}`;
}
