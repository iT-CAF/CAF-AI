/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// المحادثة: عرض الرسائل، البث، التفكير، الموجّه التلقائي، الأخطاء مع حلول، الحفظ.
import { state, $, t, esc, ic, uid, api, readNdjson, authHeaders, errText, toast, emit, on, confirmBox, promptBox, ApiError } from './core.js';
import { renderMd, enhance, splitThink } from './md.js';

// نقاط توسعة: وحدات أخرى تضيف محتوى للرسالة (صور، مصادر، صوت) وأزرار أفعال
export const msgExtras = [];
export const msgActions = [];

const ROUTE_LABEL = { chat: 'routeChat', code: 'routeCode', vision: 'routeVision', image: 'routeImage', manual: 'routeManual' };
const newChatId = () => uid().replace(/[^a-z0-9-]/g, '').slice(0, 36);

// ---------- قائمة المحادثات ----------
export async function loadChats() {
  try { state.chats = (await api('GET', '/api/chats')).chats; } catch { state.chats = []; }
  renderChatList();
}
function groupOf(ts) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const day = 86400000; const diff = d0.getTime() - ts;
  if (diff <= 0) return 'today'; if (diff <= day) return 'yesterday'; if (diff <= 6 * day) return 'week'; return 'older';
}
export function renderChatList() {
  const l = $('chatList'); if (!l) return;
  const ws = state.workspace === 'code' ? 'code' : 'chat';
  const q = state.filter.trim().toLowerCase();
  const list = state.chats.filter((c) => (c.workspace || 'chat') === ws && (!q || (c.title || '').toLowerCase().includes(q)));
  if (!list.length) { l.innerHTML = `<p class="no-chats">${esc(t(ws === 'code' ? 'noCodeChats' : 'noChats'))}</p>`; return; }
  let html = ''; let last = '';
  for (const c of list) {
    const g = groupOf(c.updated || c.created || 0);
    if (g !== last) { html += `<div class="group-label">${esc(t(g))}</div>`; last = g; }
    const active = state.chat && c.id === state.chat.id;
    html += `<div class="chat-item ${active ? 'active' : ''}" data-id="${esc(c.id)}" tabindex="0" role="button" ${active ? 'aria-current="true"' : ''}><span class="t">${esc(c.title || t('untitled'))}</span><span class="acts"><button class="mini" data-rename="${esc(c.id)}" title="${esc(t('rename'))}" aria-label="${esc(t('rename'))}">${ic('edit')}</button><button class="mini" data-delchat="${esc(c.id)}" title="${esc(t('deleteChat'))}" aria-label="${esc(t('deleteChat'))}">${ic('trash')}</button></span></div>`;
  }
  l.innerHTML = html;
}

export function newChat({ focus = true } = {}) {
  if (state.streaming) return;
  state.chat = { id: newChatId(), title: '', model: '', workspace: state.workspace === 'code' ? 'code' : 'chat', created: Date.now(), collections: [], messages: [] };
  renderMessages(true); renderChatList(); emit('chat:changed');
  if (focus) $('input')?.focus();
}
export async function openChat(id) {
  if (state.streaming) return;
  try { state.chat = await api('GET', '/api/chats/' + encodeURIComponent(id)); } catch { return; }
  if (state.chat.workspace !== (state.workspace === 'code' ? 'code' : 'chat')) emit('workspace:set', state.chat.workspace === 'code' ? 'code' : 'chat', { keepChat: true });
  renderMessages(true); renderChatList(); emit('chat:changed');
}
export async function persist() {
  if (!state.chat || !state.chat.messages.length) return;
  const body = { ...state.chat, messages: state.chat.messages.map(({ live, ...m }) => m) };
  try { await api('PUT', '/api/chats/' + state.chat.id, body); } catch { /* سيُعاد المحاولة مع الرسالة التالية */ }
  await loadChats();
}

// ---------- رسم الرسائل ----------
function badge(m) {
  if (!m.model) return '';
  const r = m.route && ROUTE_LABEL[m.route] ? t(ROUTE_LABEL[m.route]) : '';
  return `<span class="model-badge" dir="ltr" title="${esc(t('answeredBy'))}">${esc(m.model)}</span>${r ? `<span class="route-badge">${esc(r)}</span>` : ''}`;
}
function thinkHtml(thinking, open, live) {
  if (!thinking) return '';
  return `<details class="think" ${open ? 'open' : ''}><summary>${ic('bulb')}<span>${esc(t(live ? 'thinking' : 'thoughts'))}</span></summary><div class="think-body" dir="auto">${esc(thinking).replace(/\n/g, '<br>')}</div></details>`;
}
export function msgHtml(m, idx, live) {
  const isUser = m.role === 'user';
  const who = isUser ? t('you') : t('assistant');
  const avatar = isUser ? `<div class="avatar">${ic('user')}</div>` : '<div class="avatar"><img src="/brand/itcaf-monogram-app-icon.svg" alt=""></div>';
  let { thinking, content, open } = isUser ? { thinking: '', content: m.content, open: false } : splitThink(m.content);
  thinking = m.thinking || thinking;
  const thinkingLive = live && (open || (thinking && !content));
  let body;
  if (isUser) body = `<div class="user-text">${esc(m.content)}</div>`;
  else if (m.errCode) body = errorBody(m);
  else if (!content && live) body = thinking ? '' : '<span class="typing"><i></i><i></i><i></i></span>';
  else body = renderMd(content, { live }) + (live ? '<span class="cursor"></span>' : '');
  const extras = msgExtras.map((fn) => fn(m, idx, live)).join('');
  const stat = m.stat ? `<span class="stat">${esc(m.stat)}</span>` : '';
  const isLast = idx === state.chat.messages.length - 1;
  const acts = !isUser && !live && !m.errCode
    ? `<div class="msg-acts"><button class="mini" data-copymsg="${idx}">${ic('copy')}${esc(t('copy'))}</button>${isLast ? `<button class="mini" data-regen>${ic('refresh')}${esc(t('regenerate'))}</button>` : ''}${msgActions.map((fn) => fn(m, idx)).join('')}</div>`
    : (!isUser && !live && m.errCode && isLast ? `<div class="msg-acts"><button class="mini" data-regen>${ic('refresh')}${esc(t('retry'))}</button></div>` : '');
  return `<article class="msg ${m.role}${m.errCode ? ' is-err' : ''}" data-i="${idx}">${avatar}<div class="msg-main"><div class="who">${esc(who)}${isUser ? '' : badge(m)}${stat}</div>${isUser ? '' : thinkHtml(thinking, thinkingLive, thinkingLive)}${isUser ? extras : ''}<div class="body" dir="auto">${body}</div>${isUser ? '' : extras}${acts}</div></article>`;
}

function errorBody(m) {
  const d = m.errData || {};
  let actions = '';
  if (d.alternatives && d.alternatives.length) actions += d.alternatives.slice(0, 3).map((n) => `<button class="btn small" data-usemodel="${esc(n)}">${esc(t('useModel'))} <b dir="ltr">${esc(n)}</b></button>`).join('');
  if (d.suggest) actions += `<button class="btn small primary" data-pullmodel="${esc(d.suggest)}">${ic('download')} ${esc(t('downloadModel'))} <b dir="ltr">${esc(d.suggest)}</b></button>`;
  if (m.errCode === 'engine_unavailable' || m.errCode === 'engine_unreachable') actions += `<button class="btn small" data-regen>${ic('refresh')} ${esc(t('retry'))}</button>`;
  return `<div class="err-box" role="alert">${ic('alert')}<div><p>${esc(errText(m.errCode))}</p>${actions ? `<div class="row wrap">${actions}</div>` : ''}</div></div>`;
}

export function renderMessages(force) {
  const has = state.chat && state.chat.messages.length;
  $('empty').classList.toggle('hidden', !!has);
  const box = $('msgs');
  box.innerHTML = has ? state.chat.messages.map((m, i) => msgHtml(m, i, state.streaming && i === state.chat.messages.length - 1)).join('') : '';
  enhance(box);
  scrollDown(!!force);
}
function patchLive(idx) {
  const m = state.chat.messages[idx];
  const node = document.querySelector(`.msg[data-i="${idx}"]`);
  if (!node) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = msgHtml(m, idx, true);
  const fresh = tmp.firstElementChild;
  // نحافظ على حالة طيّ التفكير إن غيّرها المستخدم
  const oldThink = node.querySelector('details.think');
  const newThink = fresh.querySelector('details.think');
  if (oldThink && newThink && oldThink.dataset.user) { newThink.open = oldThink.open; newThink.dataset.user = '1'; }
  node.replaceWith(fresh);
  scrollDown(false);
}
export function scrollDown(force) {
  const th = $('thread');
  if (force || th.scrollHeight - th.scrollTop - th.clientHeight < 200) th.scrollTo({ top: th.scrollHeight, behavior: 'auto' });
}

// ---------- الإرسال ----------
// opts: { regen, images:[{id,...}], files:[], context, route, collections }
export async function send(text, opts = {}) {
  if (state.streaming) return;
  if (!state.chat) newChat({ focus: false });
  const chat = state.chat;
  const model = $('modelSelect').value || 'auto';
  if (!state.models.length) { toast(t('errNoModels')); emit('view:set', 'tools'); return; }
  if (!opts.regen) {
    text = (text || '').trim();
    if (!text && !(opts.images && opts.images.length)) return;
    const um = { role: 'user', content: text };
    if (opts.images?.length) um.images = opts.images;
    if (opts.files?.length) um.files = opts.files;
    if (opts.context) um.context = opts.context;
    chat.messages.push(um);
    if (!chat.title) chat.title = (text || opts.images?.[0]?.name || t('untitled')).replace(/\s+/g, ' ').slice(0, 48);
  }
  const am = { role: 'assistant', content: '', live: true };
  chat.messages.push(am);
  const idx = chat.messages.length - 1;
  setStreaming(true);
  renderMessages(true);
  state.abort = new AbortController();
  const history = chat.messages.slice(0, -1).filter((m) => !m.errCode).map((m) => ({
    role: m.role, content: m.context ? `${m.context}\n\n${m.content}` : m.content,
    ...(m.images?.length ? { images: m.images.map((x) => x.id) } : {}),
  }));
  let t0 = 0; let thinkStart = 0;
  try {
    const r = await api('POST', '/api/chat', {
      model, messages: history, chatId: chat.id, workspace: chat.workspace, route: opts.route || '',
      collections: chat.collections || [], think: $('thinkSelect')?.value || state.settings.think,
    }, { signal: state.abort.signal, raw: true });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch { /* */ } throw new ApiError(j.error || `http_${r.status}`, r.status, j); }
    await readNdjson(r, (j) => {
      if (j.meta) {
        am.model = j.meta.model || ''; am.route = j.meta.auto ? j.meta.route : 'manual';
        if (j.meta.sources) am.sources = j.meta.sources;
        if (j.meta.route === 'image') { am.route = 'image'; am.imagePrompt = j.meta.prompt; }
        patchLive(idx); return;
      }
      if (j.error) throw new ApiError(j.error, 500, j);
      if (j.message?.thinking) { if (!thinkStart) thinkStart = performance.now(); am.thinking = (am.thinking || '') + j.message.thinking; }
      if (j.message?.content) { if (!t0) t0 = performance.now(); am.content += j.message.content; }
      if (j.message?.thinking || j.message?.content) patchLive(idx);
      if (j.done && j.eval_count && j.eval_duration) am.stat = `${(j.eval_count / (j.eval_duration / 1e9)).toFixed(1)} ${t('tokps')}`;
    });
    if (am.route === 'image') { delete am.live; setStreaming(false); emit('image:intent', { prompt: am.imagePrompt, msg: am, idx }); return; }
  } catch (e) {
    if (e.name !== 'AbortError') {
      if (am.content) am.content += `\n\n> ⚠ ${errText(e)}`;
      else { am.errCode = e.code || 'engine_unreachable'; am.errData = e.data || {}; }
    }
  }
  delete am.live;
  setStreaming(false);
  if (!am.content && !am.errCode && !am.thinking) chat.messages.pop();
  if (am.errCode) { am.content = ''; }
  chat.model = am.model || chat.model;
  renderMessages(false);
  // رسائل الخطأ لا تُحفظ كإجابات
  const toSave = chat.messages;
  if (am.errCode) { chat.messages = toSave.filter((m) => !m.errCode); await persist(); chat.messages = toSave; }
  else await persist();
  emit('chat:done', am);
}

function setStreaming(on) {
  state.streaming = on;
  $('send').classList.toggle('hidden', on); $('stop').classList.toggle('hidden', !on);
}

export function bindChat() {
  $('stop').onclick = () => state.abort && state.abort.abort();
  $('chatList').onclick = async (e) => {
    const del = e.target.closest('[data-delchat]'), ren = e.target.closest('[data-rename]'), item = e.target.closest('.chat-item');
    if (del) {
      if (!(await confirmBox(t('confirmDeleteChat'), { danger: true, ok: t('delete') }))) return;
      await api('DELETE', '/api/chats/' + del.dataset.delchat);
      if (state.chat && state.chat.id === del.dataset.delchat) newChat({ focus: false });
      return loadChats();
    }
    if (ren) {
      const c = state.chats.find((x) => x.id === ren.dataset.rename);
      const name = await promptBox(t('rename'), c?.title || '');
      if (name === null) return;
      const full = await api('GET', '/api/chats/' + ren.dataset.rename); full.title = name.slice(0, 120);
      await api('PUT', '/api/chats/' + full.id, full);
      if (state.chat && state.chat.id === full.id) state.chat.title = full.title;
      return loadChats();
    }
    if (item) openChat(item.dataset.id);
  };
  $('chatList').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('chat-item')) openChat(e.target.dataset.id); });
  $('msgs').addEventListener('toggle', (e) => { if (e.target.matches('details.think')) e.target.dataset.user = '1'; }, true);
  $('msgs').addEventListener('click', async (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      await navigator.clipboard.writeText(cp.closest('.codeblock').querySelector('pre.src code').textContent);
      const s = cp.querySelector('span'); if (s) { s.textContent = t('copied'); setTimeout(() => { s.textContent = t('copy'); }, 1200); }
      return;
    }
    const cm = e.target.closest('[data-copymsg]');
    if (cm) { const m = state.chat.messages[+cm.dataset.copymsg]; await navigator.clipboard.writeText(splitThink(m.content).content); toast(t('copied')); return; }
    if (e.target.closest('[data-regen]')) {
      if (state.streaming) return;
      state.chat.messages.pop();
      return send(null, { regen: true });
    }
    const use = e.target.closest('[data-usemodel]');
    if (use) { emit('model:select', use.dataset.usemodel); state.chat.messages.pop(); return send(null, { regen: true }); }
    const pull = e.target.closest('[data-pullmodel]');
    if (pull) return emit('model:pull', pull.dataset.pullmodel);
    const wrap = e.target.closest('[data-wrap]');
    if (wrap) { wrap.closest('.codeblock').classList.toggle('wrap'); return; }
    emit('msgs:click', e);
  });
  on('model:pulled', () => { /* القائمة تتحدّث من main */ });
}
