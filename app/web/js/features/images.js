/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// توليد الصور (stable-diffusion.cpp محليًا): نموذج التوليد، تحسين الوصف، تقدّم حقيقي وإلغاء، المعرض، وطلب «ارسم…» من المحادثة.
import { state, $, t, esc, ic, api, toast, on, emit, errText, confirmBox, fmtBytes, readNdjson, authHeaders, pages, download, ApiError } from '../core.js';
import { msgExtras, persist, renderMessages } from '../chat.js';
import { slashCommands, setInput } from '../composer.js';
import { installAddon } from '../runners.js';

window.I18N_ADD({
  ar: {
    imgTitle: 'توليد الصور', imgSub: 'صِف الصورة بالعربية، وكآف AI يحوّلها إلى وصف احترافي ويولّدها على جهازك — بلا إنترنت.',
    imgPrompt: 'صِف الصورة التي تريدها…', enhance: 'حسّن الوصف', enhancing: 'يحسّن الوصف…', enPrompt: 'الوصف الإنجليزي (يمكنك تعديله)', negative: 'ما لا تريده في الصورة (اختياري)', advanced: 'خيارات متقدمة',
    size: 'المقاس', square: 'مربع', portrait: 'عمودي', landscape: 'أفقي', quality: 'الجودة', qFast: 'سريع', qBalanced: 'متوازن', qHigh: 'عالٍ', count: 'العدد', steps: 'الخطوات', seed: 'البذرة (Seed)', randomSeed: 'عشوائية',
    imgModel: 'نموذج الصور', generate: 'ولّد', generating: 'يولّد…', estimate: 'الوقت المتوقع: ~{t}', noGpuWarn: 'جهازك بلا كرت شاشة مدعوم: التوليد على المعالج بطيء (قد يستغرق عدة دقائق).',
    stageLoading: 'تحميل النموذج', stageSampling: 'الصورة {i}/{n} · الخطوة {s}/{S}', stageDecoding: 'المعالجة النهائية', gallery: 'المعرض', galleryEmpty: 'صورك المولّدة ستظهر هنا.',
    sameSeed: 'نفس البذرة', toVision: 'اسأل عنها', copyImage: 'نسخ الصورة', imgCopied: 'تم نسخ الصورة', deleteImageQ: 'حذف هذه الصورة نهائيًا؟',
    setupTitle: 'تجهيز توليد الصور (مرة واحدة)', setupSub: 'يُنزَّل محرك stable-diffusion.cpp ونموذج صور مناسب لجهازك إلى مجلد كآف AI، ثم يعمل كل شيء دون إنترنت.',
    installEngine: 'تثبيت المحرك', installModel: 'تنزيل النموذج', installed: 'مثبّت', unsupportedImg: 'توليد الصور غير متاح لهذا النظام حاليًا (لا توجد نسخة جاهزة من المحرك له).',
    modelFast: 'سريع وخفيف (٤ خطوات)', modelQuality: 'جودة أعلى (٨ خطوات)', ramNeed: 'يحتاج ~{n} GB رام', licenseLbl: 'الرخصة',
    imgIntent: 'سأرسمها لك…', imgOpenWs: 'افتح مساحة الصور', imgNotReady: 'لرسم الصور يلزم تجهيز توليد الصور مرة واحدة من مساحة «صور».', imgGenFailed: 'تعذّر توليد الصورة.',
    err_no_image_model: 'لا يوجد نموذج صور مثبّت.', err_no_image_engine: 'محرك الصور غير مثبّت.', err_image_busy: 'هناك صورة قيد التوليد الآن. انتظر حتى تنتهي.', err_image_failed: 'فشل توليد الصورة.', err_empty_prompt: 'اكتب وصفًا أولًا.', err_enhance_failed: 'تعذّر تحسين الوصف.',
  },
  en: {
    imgTitle: 'Image generation', imgSub: 'Describe the image in Arabic or English; CAF AI turns it into a professional prompt and generates it on your device — offline.',
    imgPrompt: 'Describe the image you want…', enhance: 'Enhance prompt', enhancing: 'Enhancing…', enPrompt: 'English prompt (editable)', negative: 'What you do not want (optional)', advanced: 'Advanced',
    size: 'Size', square: 'Square', portrait: 'Portrait', landscape: 'Landscape', quality: 'Quality', qFast: 'Fast', qBalanced: 'Balanced', qHigh: 'High', count: 'Count', steps: 'Steps', seed: 'Seed', randomSeed: 'Random',
    imgModel: 'Image model', generate: 'Generate', generating: 'Generating…', estimate: 'Estimated time: ~{t}', noGpuWarn: 'No supported GPU: generating on the CPU is slow (may take several minutes).',
    stageLoading: 'Loading model', stageSampling: 'Image {i}/{n} · step {s}/{S}', stageDecoding: 'Finishing', gallery: 'Gallery', galleryEmpty: 'Your generated images appear here.',
    sameSeed: 'Same seed', toVision: 'Ask about it', copyImage: 'Copy image', imgCopied: 'Image copied', deleteImageQ: 'Permanently delete this image?',
    setupTitle: 'Set up image generation (one time)', setupSub: 'The stable-diffusion.cpp engine and an image model suited to your device are downloaded into the CAF AI folder; then everything works offline.',
    installEngine: 'Install engine', installModel: 'Download model', installed: 'Installed', unsupportedImg: 'Image generation is not available for this system yet (no prebuilt engine).',
    modelFast: 'Fast & light (4 steps)', modelQuality: 'Higher quality (8 steps)', ramNeed: 'needs ~{n} GB RAM', licenseLbl: 'License',
    imgIntent: 'Drawing it for you…', imgOpenWs: 'Open Images', imgNotReady: 'Image generation needs a one-time setup in the Images workspace.', imgGenFailed: 'Could not generate the image.',
    err_no_image_model: 'No image model installed.', err_no_image_engine: 'Image engine not installed.', err_image_busy: 'An image is being generated. Wait for it to finish.', err_image_failed: 'Image generation failed.', err_empty_prompt: 'Write a description first.', err_enhance_failed: 'Could not enhance the prompt.',
  },
});

const SIZES = { square: [1, 1], portrait: [3, 4], landscape: [4, 3] };
const QUALITY = { fast: { mul: 1, base: 512 }, balanced: { mul: 1.5, base: 768 }, high: { mul: 2, base: 1024 } };
const f = { prompt: '', en: '', negative: '', size: 'square', quality: 'fast', count: 1, steps: null, seed: '', model: '' };
let st = null; let running = null;
const fmtSec = (s) => (s >= 90 ? `${Math.round(s / 60)} ${state.settings.lang === 'en' ? 'min' : 'د'}` : `${s} ${state.settings.lang === 'en' ? 's' : 'ث'}`);

function dims(model) {
  const [a, b] = SIZES[f.size]; const q = QUALITY[f.quality];
  const base = Math.min(q.base, model?.base || 1024);
  const scale = base / Math.sqrt(a * b);
  return { width: Math.round((a * scale) / 16) * 16, height: Math.round((b * scale) / 16) * 16 };
}
const stepsFor = (m) => f.steps || Math.min(m?.maxSteps || 12, Math.round((m?.steps || 4) * QUALITY[f.quality].mul));

// ---------- توليد مع تقدّم ----------
export async function generateImage(opts, onProgress) {
  const job = await api('POST', '/api/images/generate', opts);
  running = job.id;
  const r = await fetch(`/api/jobs/${job.id}/stream`, { headers: authHeaders() });
  let final = null;
  await readNdjson(r, (j) => { final = j; if (j.status === 'running') onProgress?.(j.progress); });
  running = null;
  if (final?.status === 'canceled') throw new ApiError('canceled');
  if (final?.status !== 'done') throw new ApiError(final?.error?.code || 'image_failed');
  return final.result.images;
}
const stageText = (p) => (p.stage === 'sampling' ? t('stageSampling', { i: p.image, n: p.images, s: p.step, S: p.steps }) : p.stage === 'decoding' ? t('stageDecoding') : t('stageLoading'));

// ---------- الصفحة ----------
async function renderPage() {
  const v = $('viewImages');
  try { st = await api('GET', '/api/images/status'); } catch (e) { v.innerHTML = `<div class="page">${esc(errText(e))}</div>`; return; }
  const ready = st.ready;
  const installedModels = st.models.filter((m) => m.installed);
  if (!f.model || !installedModels.some((m) => m.id === f.model)) f.model = installedModels[0]?.id || '';
  const model = st.models.find((m) => m.id === f.model);
  v.innerHTML = `<div class="page img-page">
    <header class="page-head"><div><h1>${esc(t('imgTitle'))}</h1><p class="lead">${esc(t('imgSub'))}</p></div></header>
    ${ready ? '' : setupHtml()}
    <div class="img-layout">
      <section class="card img-form" aria-label="${esc(t('imgTitle'))}">
        <textarea id="imgPrompt" rows="3" dir="auto" placeholder="${esc(t('imgPrompt'))}">${esc(f.prompt)}</textarea>
        <div class="row"><button class="btn" id="imgEnhance" ${ready ? '' : 'disabled'}>${ic('wand')}<span>${esc(t('enhance'))}</span></button><span class="spacer"></span></div>
        <label class="field en-field ${f.en ? '' : 'hidden'}"><span>${esc(t('enPrompt'))}</span><textarea id="imgEn" rows="3" dir="ltr">${esc(f.en)}</textarea></label>
        <div class="field"><span>${esc(t('size'))}</span><div class="seg" id="imgSize">${Object.keys(SIZES).map((k) => `<button type="button" data-v="${k}" aria-pressed="${f.size === k}"><i class="ratio r-${k}"></i>${esc(t(k))}</button>`).join('')}</div></div>
        <div class="field"><span>${esc(t('quality'))}</span><div class="seg" id="imgQuality">${Object.keys(QUALITY).map((k) => `<button type="button" data-v="${k}" aria-pressed="${f.quality === k}">${esc(t('q' + k[0].toUpperCase() + k.slice(1)))}</button>`).join('')}</div></div>
        <div class="field"><span>${esc(t('count'))}</span><div class="seg" id="imgCount">${[1, 2, 3, 4].map((n) => `<button type="button" data-v="${n}" aria-pressed="${f.count === n}">${n}</button>`).join('')}</div></div>
        <details class="adv"><summary>${esc(t('advanced'))}</summary>
          <label class="field"><span>${esc(t('negative'))}</span><input id="imgNeg" dir="auto" value="${esc(f.negative)}"></label>
          <div class="field-row"><label class="field"><span>${esc(t('imgModel'))}</span><select id="imgModel">${installedModels.map((m) => `<option value="${esc(m.id)}" ${m.id === f.model ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
            <label class="field"><span>${esc(t('steps'))}</span><input id="imgSteps" type="number" min="1" max="${model?.maxSteps || 12}" value="${stepsFor(model)}"></label>
            <label class="field"><span>${esc(t('seed'))}</span><input id="imgSeed" type="number" min="0" placeholder="${esc(t('randomSeed'))}" value="${esc(f.seed)}"></label></div>
        </details>
        <p class="img-est muted small" id="imgEst"></p>
        <div class="img-go"><button class="btn primary big" id="imgGen" ${ready ? '' : 'disabled'}>${ic('sparkle')}<span>${esc(t('generate'))}</span></button><button class="btn hidden" id="imgCancel">${ic('close')}<span>${esc(t('cancel'))}</span></button></div>
        <div class="progress hidden" id="imgProg"><div id="imgBar"></div><span id="imgTxt"></span></div>
      </section>
      <section class="img-gallery"><h2 class="sec-title">${esc(t('gallery'))}</h2><div class="gal-grid" id="galGrid"></div></section>
    </div></div>`;
  bindPage(model); renderGallery(); updateEstimate(model);
}

function setupHtml() {
  const e = st; const fit = (m) => (st.ramGB && m.ramGB > st.ramGB * 0.85 ? ' warn' : '');
  if (!st.supported) return `<section class="card setup-card"><p>${ic('alert')} ${esc(t('unsupportedImg'))}</p></section>`;
  return `<section class="card setup-card"><h2>${ic('rocket')}<span>${esc(t('setupTitle'))}</span></h2><p class="muted">${esc(t('setupSub'))}</p>
    <div class="setup-grid">
      <div class="setup-item"><b>stable-diffusion.cpp</b><small class="muted">MIT</small>${e.installed ? `<span class="ok-badge">${ic('check')}${esc(t('installed'))}</span>` : `<button class="btn small primary" data-install="sdcpp">${ic('download')}<span>${esc(t('installEngine'))}</span></button>`}</div>
      ${st.models.map((m) => `<div class="setup-item${fit(m)}"><b>${esc(m.name)}</b><small class="muted">${esc(t(m.tier === 'fast' ? 'modelFast' : 'modelQuality'))} · ${esc(fmtBytes((m.files || []).reduce((a, x) => a + x.size, 0)))} · ${esc(t('ramNeed', { n: m.ramGB }))} · ${esc(t('licenseLbl'))}: ${esc(m.license)}</small>${m.installed ? `<span class="ok-badge">${ic('check')}${esc(t('installed'))}</span>` : `<button class="btn small" data-install="${esc(m.id)}">${ic('download')}<span>${esc(t('installModel'))}</span></button>`}</div>`).join('')}
    </div></section>`;
}

function updateEstimate(model) {
  const el = $('imgEst'); if (!el || !model) return;
  const d = dims(model);
  api('POST', '/api/images/estimate', { ...d, steps: stepsFor(model), count: f.count }).then((r) => {
    el.innerHTML = `${ic('clock')} ${esc(t('estimate', { t: fmtSec(r.seconds) }))} · ${d.width}×${d.height}${st.gpu ? '' : `<br><span class="warn">${esc(t('noGpuWarn'))}</span>`}`;
  }).catch(() => {});
}

function bindPage(model) {
  const v = $('viewImages');
  v.querySelectorAll('[data-install]').forEach((b) => { b.onclick = async () => { b.disabled = true; await installAddon(b.dataset.install, b.closest('.setup-item').querySelector('b').textContent); renderPage(); }; });
  const seg = (id, key, cast = (x) => x) => { $(id).onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; f[key] = cast(b.dataset.v); $(id).querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); if (key === 'quality') { f.steps = null; const s = $('imgSteps'); if (s) s.value = stepsFor(model); } updateEstimate(model); }; };
  seg('imgSize', 'size'); seg('imgQuality', 'quality'); seg('imgCount', 'count', Number);
  $('imgPrompt').oninput = (e) => { f.prompt = e.target.value; };
  $('imgNeg').oninput = (e) => { f.negative = e.target.value; };
  $('imgSteps').onchange = (e) => { f.steps = Math.max(1, +e.target.value || 1); updateEstimate(model); };
  $('imgSeed').oninput = (e) => { f.seed = e.target.value; };
  $('imgModel').onchange = (e) => { f.model = e.target.value; renderPage(); };
  const en = $('imgEn'); if (en) en.oninput = (e) => { f.en = e.target.value; };
  $('imgEnhance').onclick = async () => {
    if (!f.prompt.trim()) return toast(t('err_empty_prompt'));
    const b = $('imgEnhance'); b.disabled = true; b.querySelector('span').textContent = t('enhancing');
    try { const r = await api('POST', '/api/images/enhance', { text: f.prompt }); f.en = r.prompt; $('imgEn').value = r.prompt; $('imgEn').closest('.en-field').classList.remove('hidden'); }
    catch (e) { toast(errText(e)); }
    b.disabled = false; b.querySelector('span').textContent = t('enhance');
  };
  $('imgGen').onclick = () => runGeneration(model);
  $('imgCancel').onclick = () => { if (running) api('POST', `/api/jobs/${running}/cancel`).catch(() => {}); };
}

async function runGeneration(model) {
  const prompt = (f.en || f.prompt).trim();
  if (!prompt) return toast(t('err_empty_prompt'));
  const d = dims(model);
  $('imgGen').classList.add('hidden'); $('imgCancel').classList.remove('hidden');
  const prog = $('imgProg'); prog.classList.remove('hidden'); $('imgBar').style.width = '0'; $('imgTxt').textContent = t('stageLoading');
  try {
    await generateImage({ prompt, promptAr: f.prompt, negative: f.negative, model: f.model, steps: stepsFor(model), count: f.count, seed: f.seed === '' ? undefined : Math.max(0, parseInt(f.seed, 10) || 0), ...d }, (p) => {
      if (p.total) $('imgBar').style.width = Math.min(100, Math.round((p.completed / p.total) * 100)) + '%';
      $('imgTxt').textContent = stageText(p);
    });
    renderGallery();
  } catch (e) { if (e.code !== 'canceled') toast(errText(e), 5000); }
  $('imgGen').classList.remove('hidden'); $('imgCancel').classList.add('hidden'); prog.classList.add('hidden');
}

async function renderGallery() {
  const g = $('galGrid'); if (!g) return;
  const { images } = await api('GET', '/api/images');
  g.innerHTML = images.length ? images.map((im) => `<figure class="gal-card" data-img="${esc(im.id)}">
      <button type="button" class="gal-img" data-open="${esc(im.id)}" aria-label="${esc(t('openImage'))}"><img src="/files/img/${esc(im.id)}" alt="${esc(im.prompt_ar || im.prompt)}" loading="lazy" width="${im.width}" height="${im.height}"></button>
      <figcaption><p dir="auto" title="${esc(im.prompt)}">${esc(im.prompt_ar || im.prompt)}</p><small class="muted" dir="ltr">${im.width}×${im.height} · seed ${im.seed} · ${esc(im.modelName || im.model)} · ${fmtSec(Math.round(im.ms / 1000))}</small>
      <div class="gal-acts"><button class="mini" data-dlimg="${esc(im.id)}" title="${esc(t('downloadFile'))}">${ic('download')}</button><button class="mini" data-copyimg="${esc(im.id)}" title="${esc(t('copyImage'))}">${ic('copy')}</button><button class="mini" data-seed="${esc(im.id)}" title="${esc(t('sameSeed'))}">${ic('refresh')}</button><button class="mini" data-vision="${esc(im.id)}" title="${esc(t('toVision'))}">${ic('eye')}</button><button class="mini" data-delimg="${esc(im.id)}" title="${esc(t('delete'))}">${ic('trash')}</button></div></figcaption></figure>`).join('')
    : `<p class="muted gal-empty">${ic('image')} ${esc(t('galleryEmpty'))}</p>`;
  g.onclick = (e) => galleryAction(e, images);
}

async function galleryAction(e, images) {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.dlimg || b.dataset.copyimg || b.dataset.seed || b.dataset.vision || b.dataset.delimg || b.dataset.open;
  const im = images.find((x) => x.id === id); if (!im) return;
  const blob = () => fetch('/files/img/' + id).then((r) => r.blob());
  if (b.dataset.open) { const d = document.createElement('dialog'); d.className = 'img-viewer'; d.innerHTML = `<form method="dialog"><button class="btn icon-only" aria-label="${esc(t('close'))}">${ic('close')}</button></form><img src="/files/img/${esc(id)}" alt="">`; document.body.appendChild(d); d.addEventListener('close', () => d.remove()); d.showModal(); }
  if (b.dataset.dlimg) download(await blob(), `caf-ai-${im.seed}.png`);
  if (b.dataset.copyimg) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await blob() })]); toast(t('imgCopied')); } catch { toast(t('err_generic')); } }
  if (b.dataset.seed) { f.prompt = im.prompt_ar || ''; f.en = im.prompt; f.seed = String(im.seed); f.negative = im.negative || ''; renderPage(); }
  if (b.dataset.delimg && await confirmBox(t('deleteImageQ'), { danger: true, ok: t('delete') })) { await api('DELETE', '/api/images/' + id); renderGallery(); }
  if (b.dataset.vision) {
    emit('workspace:set', 'chat');
    const file = new File([await blob()], `caf-ai-${im.seed}.png`, { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    setTimeout(() => $('input').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })), 100);
  }
}

// ---------- «ارسم لي…» من المحادثة ----------
async function onIntent({ prompt, msg }) {
  try { st = await api('GET', '/api/images/status'); } catch { st = null; }
  if (!st?.ready) { msg.content = t('imgNotReady'); msg.gen = { images: [], prompt, status: 'setup' }; renderMessages(false); await persist(); return; }
  msg.gen = { images: [], prompt, status: 'enhancing', progress: t('enhancing') }; msg.model = 'stable-diffusion.cpp'; renderMessages(false);
  let en = prompt;
  try { en = (await api('POST', '/api/images/enhance', { text: prompt })).prompt || prompt; } catch { /* نستخدم النص كما هو */ }
  const m = st.models.find((x) => x.installed);
  const d = { width: st.gpu ? Math.min(768, m.base) : 512, height: st.gpu ? Math.min(768, m.base) : 512 };
  try {
    const imgs = await generateImage({ prompt: en, promptAr: prompt, model: m.id, steps: m.steps, count: 1, chatId: state.chat.id, ...d }, (p) => { msg.gen.status = 'running'; msg.gen.progress = stageText(p); msg.gen.pct = p.total ? Math.round((p.completed / p.total) * 100) : 0; patchGen(msg); });
    msg.gen = { images: imgs.map((x) => x.id), prompt: en, status: 'done' };
    msg.content = `🎨 ${prompt}`;
  } catch (e) { msg.gen = { images: [], prompt: en, status: 'error' }; msg.content = `${t('imgGenFailed')} ${errText(e)}`; }
  renderMessages(false); await persist();
}
function patchGen(msg) {
  const idx = state.chat.messages.indexOf(msg); const box = document.querySelector(`.msg[data-i="${idx}"] .gen-box`);
  if (!box) return renderMessages(false);
  box.querySelector('.gen-txt').textContent = msg.gen.progress || '';
  box.querySelector('.progress div').style.width = (msg.gen.pct || 0) + '%';
}
function genHtml(m) {
  const g = m.gen; if (!g) return '';
  if (g.status === 'setup') return `<div class="gen-box"><button class="btn small primary" data-goto="images">${ic('image')}<span>${esc(t('imgOpenWs'))}</span></button></div>`;
  if (g.status === 'done' && g.images.length) return `<div class="gen-imgs">${g.images.map((id) => `<button type="button" class="msg-img gen" data-viewimg="/files/img/${esc(id)}" aria-label="${esc(t('openImage'))}"><img src="/files/img/${esc(id)}" alt="${esc(g.prompt)}" loading="lazy"></button>`).join('')}</div><details class="gen-prompt"><summary>${esc(t('enPrompt'))}</summary><p dir="ltr">${esc(g.prompt)}</p></details>`;
  if (g.status === 'enhancing' || g.status === 'running') return `<div class="gen-box"><span class="run-status st-running"><i class="spin"></i><span class="gen-txt">${esc(g.progress || t('imgIntent'))}</span></span><div class="progress"><div style="width:${g.pct || 0}%"></div></div></div>`;
  return '';
}

export function init() {
  pages.images = renderPage;
  on('image:intent', onIntent);
  msgExtras.push((m) => (m.role === 'assistant' ? genHtml(m) : ''));
  slashCommands.push({ cmd: 'image', icon: 'image', label: () => t('imgTitle'), run: (rest) => { if (rest.trim()) { setInput(''); emit('image:direct', rest.trim()); } else emit('workspace:set', 'images'); return true; } });
  on('image:direct', async (text) => { const { send } = await import('../chat.js'); send(text, { route: 'image' }); });
}
