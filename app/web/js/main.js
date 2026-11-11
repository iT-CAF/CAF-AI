/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// نقطة البداية: التهيئة، مساحات العمل والصفحات، المظهر واللغة، الاختصارات.
import { state, $, qsa, t, esc, api, on, emit, toast } from './core.js';
import { loadChats, newChat, openChat, renderChatList, renderMessages, bindChat } from './chat.js';
import { loadModels, renderModelSelect, bindModels, updateThink } from './models.js';
import { bindComposer } from './composer.js';
import { openSettings } from './settings.js';
import { renderTools, bindTools } from './pages/tools.js';
import { renderHardware } from './pages/hardware.js';

// وحدات المزايا تسجّل نفسها (تُحمَّل بعد الأساس)
const FEATURES = [];

const dark = window.matchMedia('(prefers-color-scheme: dark)');
const effectiveTheme = () => (state.settings.theme === 'system' ? (dark.matches ? 'dark' : 'light') : state.settings.theme);
// صفحات تُرسم عند فتحها؛ الوحدات تضيف صفحاتها هنا
export const pages = { tools: renderTools, hardware: renderHardware };
const VIEW_OF_WS = { chat: 'chat', code: 'chat', images: 'images', docs: 'docs' };

function applyLang() {
  const { lang } = state.settings;
  const th = effectiveTheme();
  const html = document.documentElement;
  html.lang = lang; html.dir = lang === 'ar' ? 'rtl' : 'ltr'; html.dataset.theme = th;
  $('themeIc').style.setProperty('--i', `url(/brand/icons/${th === 'dark' ? 'sun' : 'moon'}.svg)`);
  $('themeBtn').title = th === 'dark' ? t('light') : t('dark');
  $('langLbl').textContent = lang === 'ar' ? 'EN' : 'ع';
  qsa('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
  qsa('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
  qsa('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); e.setAttribute('aria-label', e.title); });
  const y = state.info?.year || new Date().getFullYear(); const v = state.info?.version || '';
  $('rightsShort').textContent = t('rightsShort').replace('{y}', y);
  $('verTag').textContent = 'v' + v;
  document.title = lang === 'ar' ? 'كآف AI · CAF AI' : 'CAF AI · iT CAF';
  renderSuggest(); renderChatList(); renderModelSelect(); renderWsTitle();
  if (state.chat && state.view === 'chat') renderMessages(false);
  if (state.view !== 'chat') pages[state.view]?.();
  emit('ui:applied');
}

export const SUGGEST = { chat: ['s1', 's2', 's3', 's4'], code: ['c1', 'c2', 'c3', 'c4'] };
function renderSuggest() {
  const ws = state.workspace === 'code' ? 'code' : 'chat';
  $('suggest').innerHTML = SUGGEST[ws].map((k, i) => `<button type="button" data-p="${k}"><span class="n">0${i + 1}</span><span class="tx">${esc(t(k))}<small>${esc(t(k + 's'))}</small></span></button>`).join('');
  $('welcomeTitle').textContent = t(ws === 'code' ? 'codeWelcomeTitle' : 'welcomeTitle');
  $('welcomeSub').textContent = t(ws === 'code' ? 'codeWelcomeSub' : 'welcomeSub');
  $('promptLine').textContent = ws === 'code' ? 'caf-ai --code --local' : 'caf-ai --chat --local';
}
function renderWsTitle() {
  const el = $('wsTitle'); if (!el) return;
  const k = state.view === 'chat' ? (state.workspace === 'code' ? 'wsCode' : 'wsChat') : { images: 'wsImages', docs: 'wsDocs', tools: 'installedTools', hardware: 'myDevice' }[state.view];
  el.textContent = t(k || 'wsChat');
}

// ---------- مساحات العمل والصفحات ----------
export function setView(view) {
  state.view = view;
  qsa('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
  document.body.dataset.view = view;
  qsa('[data-goto]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.goto === view)));
  $('chatTools').classList.toggle('hidden', view !== 'chat');
  if (view !== 'chat') pages[view]?.();
  renderWsTitle();
  closeSide();
  emit('view:changed', view);
}
export function setWorkspace(ws, { keepChat = false } = {}) {
  const prev = state.workspace;
  state.workspace = ws;
  document.body.dataset.ws = ws;
  qsa('#workspaces [data-ws]').forEach((b) => { const on = b.dataset.ws === ws; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  setView(VIEW_OF_WS[ws] || 'chat');
  const chatWs = ws === 'code' ? 'code' : 'chat';
  if ((ws === 'chat' || ws === 'code') && !keepChat && (!state.chat || state.chat.workspace !== chatWs || prev !== ws)) {
    if (!state.chat || state.chat.messages.length || state.chat.workspace !== chatWs) newChat({ focus: false });
  }
  renderSuggest(); renderChatList();
  emit('workspace:changed', ws);
}

const openSide = () => { $('sidebar').classList.add('open'); $('scrim').classList.add('show'); };
const closeSide = () => { $('sidebar').classList.remove('open'); $('scrim').classList.remove('show'); };

function route() {
  const h = decodeURIComponent(location.hash || '');
  if (h.startsWith('#chat=')) return openChat(h.slice(6));
  const map = { '#chat': ['ws', 'chat'], '#code': ['ws', 'code'], '#images': ['ws', 'images'], '#docs': ['ws', 'docs'], '#tools': ['view', 'tools'], '#device': ['view', 'hardware'] };
  if (h === '#settings') return openSettings();
  const m = map[h];
  if (m) { if (m[0] === 'ws') setWorkspace(m[1]); else setView(m[1]); }
}

function bind() {
  $('newChat').onclick = () => { if (state.view !== 'chat') setWorkspace(state.workspace === 'code' ? 'code' : 'chat'); newChat(); closeSide(); };
  $('toggleSide').onclick = openSide; $('scrim').onclick = closeSide;
  $('themeBtn').onclick = async () => { state.settings = await api('PUT', '/api/settings', { theme: effectiveTheme() === 'dark' ? 'light' : 'dark' }); applyLang(); };
  $('langBtn').onclick = async () => { state.settings = await api('PUT', '/api/settings', { lang: state.settings.lang === 'ar' ? 'en' : 'ar' }); applyLang(); };
  $('search').oninput = (e) => { state.filter = e.target.value; renderChatList(); };
  $('workspaces').addEventListener('click', (e) => { const b = e.target.closest('[data-ws]'); if (b) setWorkspace(b.dataset.ws); });
  $('workspaces').addEventListener('keydown', (e) => {
    const tabs = qsa('#workspaces [data-ws]'); const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowDown: 1, ArrowUp: -1, ArrowLeft: document.dir === 'rtl' ? 1 : -1, ArrowRight: document.dir === 'rtl' ? -1 : 1 }[e.key];
    if (next) { e.preventDefault(); const n = tabs[(i + next + tabs.length) % tabs.length]; n.focus(); setWorkspace(n.dataset.ws); }
  });
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); const v = g.dataset.goto; if (['chat', 'code', 'images', 'docs'].includes(v)) setWorkspace(v); else setView(v); if ($('settingsDlg').open) $('settingsDlg').close(); return; }
    const p = e.target.closest('[data-pullmodel]');
    if (p && !e.target.closest('#msgs')) emit('model:pull', p.dataset.pullmodel);
  });
  $('openSettings').onclick = () => { closeSide(); openSettings(); };
  $('settingsDlg').addEventListener('click', (e) => { if (e.target === $('settingsDlg')) $('settingsDlg').close(); });
  $('suggest').onclick = (e) => { const b = e.target.closest('button[data-p]'); if (b) import('./chat.js').then((m) => m.send(t(b.dataset.p))); };
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (state.view !== 'chat') setWorkspace(state.workspace === 'code' ? 'code' : 'chat'); newChat(); }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); }
    if (mod && e.key === ',') { e.preventDefault(); openSettings(); }
    if (e.key === 'Escape') closeSide();
  });
  const th = $('thread');
  th.addEventListener('scroll', () => { $('toBottom').classList.toggle('hidden', th.scrollHeight - th.scrollTop - th.clientHeight < 300); });
  $('toBottom').onclick = () => th.scrollTo({ top: th.scrollHeight, behavior: 'smooth' });
  window.addEventListener('hashchange', route);
  dark.addEventListener?.('change', () => { if (state.settings?.theme === 'system') applyLang(); });
  on('ui:lang', applyLang);
  on('view:set', setView);
  on('view:refresh', () => pages[state.view]?.());
  on('workspace:set', (ws, o) => setWorkspace(ws, o));
  on('toast', (m) => toast(m));
  on('chats:wiped', () => { newChat({ focus: false }); loadChats(); });
  on('think:changed', updateThink);
}

(async function init() {
  state.settings = await api('GET', '/api/settings').catch(() => ({ lang: 'ar', theme: 'system', model: 'auto', systemPrompt: '', temperature: 0.7, numCtx: 4096, think: 'auto', modelsByRole: {} }));
  state.info = await api('GET', '/api/info').catch(() => null);
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) qsa('kbd[data-mod]').forEach((k) => { k.textContent = k.textContent.replace('⌘', 'Ctrl '); });
  bind(); bindChat(); bindModels(); bindComposer(); bindTools();
  for (const f of FEATURES) { try { const m = await import(f); m.init?.(); } catch (e) { console.warn('feature', f, e); } }
  applyLang();
  setWorkspace('chat');
  await Promise.all([loadModels(), loadChats()]);
  if (!state.models.length) { $('firstRun').classList.remove('hidden'); }
  route();
  setInterval(() => { if (!state.streaming && document.visibilityState === 'visible') loadModels(); }, 30000);
})();
