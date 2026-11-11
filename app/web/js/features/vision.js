/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// قراءة الصور: إرفاق بالزر أو اللصق أو السحب، تصغير وضغط في المتصفح، حفظ مع المحادثة، وأوامر سريعة.
import { state, $, t, esc, ic, uid, api, toast, on, errText } from '../core.js';
import { msgExtras } from '../chat.js';
import { addPending, removePending, pending, beforeSend, addAttachItem, pickFiles, slashCommands, setInput, submit, renderTray } from '../composer.js';

window.I18N_ADD({
  ar: {
    attachImage: 'صورة', dropHere: 'أفلت الملفات هنا', imgTooBig: 'الصورة كبيرة جدًا.', imgBad: 'تعذّر قراءة هذه الصورة.', uploading: 'جارٍ التجهيز…',
    vDescribe: 'صف الصورة', vOcr: 'استخرج النص', vUi: 'حوّل الواجهة إلى HTML/CSS', vChart: 'اشرح المخطط أو الجدول', vTranslate: 'ترجم النص في الصورة',
    pDescribe: 'صف هذه الصورة بالتفصيل بالعربية: ما فيها، الألوان، النصوص الظاهرة، وأي ملاحظات مهمة.',
    pOcr: 'استخرج كل النص الموجود في الصورة كما هو حرفيًا (العربي والإنجليزي)، مع الحفاظ على ترتيب الأسطر. لا تضف شرحًا.',
    pUi: 'حوّل لقطة الشاشة هذه إلى صفحة HTML وCSS كاملة في ملف واحد تطابق التصميم قدر الإمكان (الألوان، المسافات، الخطوط، الاتجاه). لا تستخدم روابط خارجية.',
    pChart: 'اشرح هذا المخطط أو الجدول: ماذا يعرض، أهم الأرقام والاتجاهات، والاستنتاجات الرئيسية.',
    pTranslate: 'استخرج النص الموجود في الصورة ثم ترجمه إلى العربية (وإن كان عربيًا فترجمه إلى الإنجليزية). اعرض الأصل والترجمة.',
    openImage: 'عرض الصورة', closeViewer: 'إغلاق',
  },
  en: {
    attachImage: 'Image', dropHere: 'Drop files here', imgTooBig: 'The image is too large.', imgBad: 'Could not read this image.', uploading: 'Preparing…',
    vDescribe: 'Describe the image', vOcr: 'Extract text', vUi: 'Screenshot to HTML/CSS', vChart: 'Explain the chart/table', vTranslate: 'Translate text in image',
    pDescribe: 'Describe this image in detail: what is in it, colors, visible text, and anything important.',
    pOcr: 'Extract all text in the image verbatim (Arabic and English), keeping line order. Do not add commentary.',
    pUi: 'Turn this screenshot into a complete single-file HTML+CSS page that matches the design as closely as possible (colors, spacing, fonts, direction). No external links.',
    pChart: 'Explain this chart or table: what it shows, key numbers and trends, and the main conclusions.',
    pTranslate: 'Extract the text in the image, then translate it into English (or into Arabic if it is English). Show the original and the translation.',
    openImage: 'View image', closeViewer: 'Close',
  },
});

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/heic,image/heif';
const QUICK = [['vDescribe', 'pDescribe'], ['vOcr', 'pOcr'], ['vUi', 'pUi'], ['vChart', 'pChart'], ['vTranslate', 'pTranslate']];

// تصغير وضغط: أطول ضلع ≤ imageMaxDim، JPEG (أو PNG إن كانت شفافة وصغيرة) — Ollama لا يقرأ WebP
async function compress(file) {
  const maxDim = state.settings.imageMaxDim || 1536; const q = state.settings.imageQuality || 0.85;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error(t('imgBad')); }
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)); const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const keepPng = file.type === 'image/png' && file.size < 1.5e6 && scale === 1;
  if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  const blob = await new Promise((r) => c.toBlob(r, keepPng ? 'image/png' : 'image/jpeg', q));
  return { blob, w, h };
}

async function addImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 40 * 1024 * 1024) { toast(t('imgTooBig')); return; }
  if (!state.chat) return;
  const key = 'img:' + uid();
  const thumb = URL.createObjectURL(file);
  const item = { key, kind: 'image', label: file.name || 'image', thumb, busy: true, note: t('uploading'), remove: () => URL.revokeObjectURL(thumb) };
  addPending(item);
  try {
    const { blob, w, h } = await compress(file);
    const res = await api('POST', `/api/chats/${state.chat.id}/attachments?name=${encodeURIComponent(file.name || 'image')}`, blob);
    Object.assign(item, { busy: false, note: `${w}×${h}`, payload: { image: { id: res.id, name: res.name, type: res.type, w, h } } });
    renderTray(); renderVisionQuick();
  } catch (e) { removePending(key); toast(e.message && !e.code ? e.message : errText(e)); }
}

function renderVisionQuick() {
  const q = $('visionQuick');
  const has = pending.some((p) => p.kind === 'image' && !p.busy);
  q.hidden = !has;
  if (has) q.innerHTML = QUICK.map(([k], i) => `<button type="button" data-vq="${i}">${esc(t(k))}</button>`).join('');
}

// عارض الصور (Lightbox)
function viewImage(src, alt) {
  const d = document.createElement('dialog'); d.className = 'img-viewer';
  d.innerHTML = `<form method="dialog"><button class="btn icon-only" aria-label="${esc(t('closeViewer'))}">${ic('close')}</button></form><img src="${esc(src)}" alt="${esc(alt || '')}">`;
  document.body.appendChild(d); d.addEventListener('close', () => d.remove()); d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.showModal();
}

function bindDrop() {
  const area = $('viewChat');
  let depth = 0;
  const overlay = document.createElement('div'); overlay.className = 'drop-overlay hidden'; overlay.innerHTML = `<div>${ic('upload')}<span></span></div>`;
  area.appendChild(overlay);
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  area.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; overlay.querySelector('span').textContent = t('dropHere'); overlay.classList.remove('hidden'); });
  area.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  area.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) overlay.classList.add('hidden'); });
  area.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; overlay.classList.add('hidden');
    const files = [...e.dataTransfer.files];
    for (const f of files) {
      if (f.type.startsWith('image/')) addImage(f);
      else window.dispatchEvent(new CustomEvent('caf:file', { detail: f })); // المستندات تتعامل معها وحدة المستندات
    }
  });
}

export function init() {
  addAttachItem({ id: 'image', icon: 'image', label: () => t('attachImage'), run: async () => { for (const f of await pickFiles({ accept: ACCEPT })) addImage(f); } });
  // اللصق من الحافظة
  $('input').addEventListener('paste', (e) => {
    const imgs = [...(e.clipboardData?.items || [])].filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean);
    if (!imgs.length) return;
    e.preventDefault(); imgs.forEach(addImage);
  });
  bindDrop();
  // صف أوامر الرؤية السريعة فوق صندوق الكتابة
  const q = document.createElement('div'); q.id = 'visionQuick'; q.className = 'quick vision-quick'; q.hidden = true;
  $('quick').after(q);
  q.onclick = (e) => { const b = e.target.closest('[data-vq]'); if (!b) return; const [, p] = QUICK[+b.dataset.vq]; setInput(t(p), { focus: false }); submit(); };
  on('ui:applied', renderVisionQuick);
  beforeSend.push((opts) => {
    const imgs = pending.filter((p) => p.kind === 'image' && p.payload?.image).map((p) => p.payload.image);
    if (imgs.length) opts.images = [...(opts.images || []), ...imgs];
  });
  window.addEventListener('caf:pending', renderVisionQuick);
  // صور المستخدم داخل الرسائل
  msgExtras.push((m) => (m.role === 'user' && m.images?.length && state.chat ? `<div class="msg-images">${m.images.map((x) => `<button type="button" class="msg-img" data-viewimg="/files/att/${esc(state.chat.id)}/${esc(x.id)}" aria-label="${esc(t('openImage'))}"><img src="/files/att/${esc(state.chat.id)}/${esc(x.id)}" alt="${esc(x.name || '')}" loading="lazy" ${x.w ? `width="${x.w}" height="${x.h}"` : ''}></button>`).join('')}</div>` : ''));
  $('msgs').addEventListener('click', (e) => { const b = e.target.closest('[data-viewimg]'); if (b) viewImage(b.dataset.viewimg, b.querySelector('img')?.alt); });
  slashCommands.push({ cmd: 'describe', label: () => t('vDescribe'), run: (rest) => { if (!pending.some((p) => p.kind === 'image')) { toast(t('attachImageFirst')); return true; } setInput(rest.trim() || t('pDescribe'), { focus: false }); submit(); return true; } });
  window.I18N_ADD({ ar: { attachImageFirst: 'أرفق صورة أولًا (زر الإرفاق أو الصق صورة).' }, en: { attachImageFirst: 'Attach an image first (attach button or paste an image).' } });
}
