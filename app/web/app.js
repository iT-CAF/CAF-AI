/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { settings: null, info: null, models: [], chats: [], chat: null, streaming: false, abort: null, filter: '' };
  const t = (k) => (window.I18N[state.settings?.lang || 'ar'][k] ?? k);
  const dark = window.matchMedia('(prefers-color-scheme: dark)');

  const api = async (method, url, body) => {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2));
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name) => `<span class="ic" style="--i:url(/brand/icons/${name}.svg)"></span>`;
  let toastTimer;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  // ---------- Markdown (آمن: يُهرَّب كل شيء أولًا) ----------
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = esc(s);
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  }
  function renderMd(src) {
    const lines = src.replace(/\r\n/g, '\n').split('\n');
    const out = []; let i = 0;
    const isTable = (a, b) => a && b && a.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(b);
    while (i < lines.length) {
      const ln = lines[i];
      const fence = ln.match(/^\s*```\s*([\w+#.-]*)/);
      if (fence) {
        const buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push(`<div class="codeblock"><div class="bar"><span>${esc(fence[1] || 'code')}</span><button type="button" class="mini" data-copy>${t('copy')}</button></div><pre><code>${esc(buf.join('\n'))}</code></pre></div>`);
        continue;
      }
      let m;
      if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }
      if (isTable(ln, lines[i + 1])) {
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
        const head = cells(ln); i += 2; const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
        out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
        continue;
      }
      if (/^\s*>\s?/.test(ln)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push(`<blockquote>${inline(buf.join('<br>'))}</blockquote>`); continue;
      }
      if (/^\s*([-*+])\s+/.test(ln) || /^\s*\d+[.)]\s+/.test(ln)) {
        const ordered = /^\s*\d+[.)]\s+/.test(ln); const items = [];
        const re = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
        const startNum = ordered ? parseInt(ln.match(/^\s*(\d+)/)[1], 10) : 1;
        while (i < lines.length) {
          if (re.test(lines[i])) items.push(inline(lines[i++].match(re)[1]));
          else if (!lines[i].trim() && i + 1 < lines.length && re.test(lines[i + 1])) i++;
          else break;
        }
        out.push(`<${ordered ? 'ol' : 'ul'}${ordered && startNum !== 1 ? ` start="${startNum}"` : ''}>${items.map((x) => `<li>${x}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
      }
      if (!ln.trim()) { i++; continue; }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(\s*```|#{1,4}\s|\s*>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i])) buf.push(lines[i++]);
      out.push(`<p>${inline(buf.join('\n')).replace(/\n/g, '<br>')}</p>`);
    }
    return out.join('');
  }

  // ---------- المظهر واللغة ----------
  const effectiveTheme = () => (state.settings.theme === 'system' ? (dark.matches ? 'dark' : 'light') : state.settings.theme);
  function applyLang() {
    const { lang } = state.settings;
    const th = effectiveTheme();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = th;
    $('themeIc').style.setProperty('--i', `url(/brand/icons/${th === 'dark' ? 'sun' : 'moon'}.svg)`);
    $('themeBtn').title = th === 'dark' ? t('light') : t('dark');
    $('langLbl').textContent = lang === 'ar' ? 'EN' : 'ع';
    document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.placeholder = t(e.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); e.setAttribute('aria-label', e.title); });
    const y = state.info?.year || new Date().getFullYear(); const v = state.info?.version || '';
    $('rightsShort').textContent = t('rightsShort').replace('{y}', y);
    $('rightsFull').textContent = t('rightsFull').replace('{y}', y).replace('{v}', v);
    $('aboutTxt').textContent = t('about');
    $('verTag').textContent = 'v' + v;
    $('exportChat').title = t('export');
    document.title = lang === 'ar' ? 'كآف AI · CAF AI' : 'CAF AI · iT CAF';
    document.querySelectorAll('#segLang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === lang)));
    document.querySelectorAll('#segTheme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.settings.theme)));
    renderSuggest(); renderChatList(); renderModelSelect(); renderModelList();
    if (state.chat) renderMessages(false);
  }
  function renderSuggest() {
    $('suggest').innerHTML = ['s1', 's2', 's3', 's4'].map((k, i) => `<button type="button" data-p="${k}"><span class="n">0${i + 1}</span><span class="tx">${esc(t(k))}<small>${esc(t(k + 's'))}</small></span></button>`).join('');
  }
  async function saveSettings(patch) {
    state.settings = await api('PUT', '/api/settings', { ...state.settings, ...patch });
    applyLang();
  }
  dark.addEventListener?.('change', () => { if (state.settings?.theme === 'system') applyLang(); });

  // ---------- النماذج ----------
  async function loadModels() {
    try {
      state.models = (await api('GET', '/api/models')).models;
      $('status').classList.add('on'); $('status').title = t('online');
    } catch { state.models = []; $('status').classList.remove('on'); $('status').title = t('offline'); }
    if (state.models.length && !state.models.find((m) => m.name === state.settings.model)) {
      state.settings.model = state.models[0].name;
      api('PUT', '/api/settings', state.settings).catch(() => {});
    }
    renderModelSelect(); renderModelList();
  }
  function renderModelSelect() {
    const s = $('modelSelect');
    if (!state.models.length) { s.innerHTML = `<option value="">${esc(t('noModelSel'))}</option>`; return; }
    s.innerHTML = state.models.map((m) => `<option value="${esc(m.name)}" ${m.name === state.settings.model ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  }
  function renderModelList() {
    const l = $('modelList');
    if (!state.models.length) { l.innerHTML = `<li><span class="s">${esc(t('noModels'))}</span></li>`; return; }
    l.innerHTML = state.models.map((m) => `<li><span><span class="n">${esc(m.name)}</span> <span class="s">${(m.size / 1073741824).toFixed(1)} GB</span></span><button type="button" class="btn danger" data-del="${esc(m.name)}">${esc(t('delete'))}</button></li>`).join('');
  }
  async function pull() {
    const name = $('pullName').value.trim(); if (!name) return;
    const prog = $('pullProg'), bar = $('pullBar'), txt = $('pullTxt');
    prog.classList.remove('hidden'); bar.style.width = '0'; txt.textContent = t('pulling'); $('pullBtn').disabled = true;
    try {
      const r = await fetch('/api/models/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
          const j = JSON.parse(line);
          if (j.error) throw new Error(j.error);
          if (j.total && j.completed) { const p = Math.floor((j.completed / j.total) * 100); bar.style.width = p + '%'; txt.textContent = `${j.status} · ${p}%`; }
          else if (j.status) txt.textContent = j.status;
        }
      }
      txt.textContent = t('done'); $('pullName').value = '';
      await loadModels();
    } catch (e) { txt.textContent = String(e.message || e); }
    $('pullBtn').disabled = false;
  }

  // ---------- المحادثات ----------
  async function loadChats() { try { state.chats = (await api('GET', '/api/chats')).chats; } catch { state.chats = []; } renderChatList(); }
  function groupOf(ts) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const day = 86400000; const diff = d0.getTime() - ts;
    if (diff <= 0) return 'today'; if (diff <= day) return 'yesterday'; if (diff <= 6 * day) return 'week'; return 'older';
  }
  function renderChatList() {
    const l = $('chatList');
    const q = state.filter.trim().toLowerCase();
    const list = state.chats.filter((c) => !q || (c.title || '').toLowerCase().includes(q));
    if (!list.length) { l.innerHTML = `<p class="no-chats">${esc(t('noChats'))}</p>`; return; }
    let html = ''; let last = '';
    for (const c of list) {
      const g = groupOf(c.updated || c.created || 0);
      if (g !== last) { html += `<div class="group-label">${esc(t(g))}</div>`; last = g; }
      html += `<div class="chat-item ${state.chat && c.id === state.chat.id ? 'active' : ''}" data-id="${c.id}" tabindex="0" role="button"><span class="t">${esc(c.title || t('untitled'))}</span><span class="acts"><button class="mini" data-rename="${c.id}" title="${esc(t('rename'))}" aria-label="${esc(t('rename'))}">${ic('edit')}</button><button class="mini" data-delchat="${c.id}" title="${esc(t('deleteChat'))}" aria-label="${esc(t('deleteChat'))}">${ic('trash')}</button></span></div>`;
    }
    l.innerHTML = html;
  }
  function newChat() {
    if (state.streaming) return;
    state.chat = { id: uid().replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 36), title: '', model: '', created: Date.now(), messages: [] };
    renderMessages(true); renderChatList(); $('input').focus(); closeSide();
  }
  async function openChat(id) {
    if (state.streaming) return;
    try { state.chat = await api('GET', '/api/chats/' + id); } catch { return; }
    renderMessages(true); renderChatList(); closeSide();
  }
  async function persist() {
    if (!state.chat || !state.chat.messages.length) return;
    await api('PUT', '/api/chats/' + state.chat.id, state.chat).catch(() => {});
    await loadChats();
  }
  function msgHtml(m, idx, live) {
    const isUser = m.role === 'user';
    const who = isUser ? t('you') : t('assistant');
    const avatar = isUser ? '<div class="avatar">U</div>' : '<div class="avatar"><img src="/brand/itcaf-monogram-app-icon.svg" alt=""></div>';
    let body;
    if (isUser) body = esc(m.content);
    else if (!m.content && live) body = '<span class="typing"><i></i><i></i><i></i></span>';
    else body = renderMd(m.content) + (live ? '<span class="cursor"></span>' : '');
    const stat = m.stat ? `<span class="stat">${esc(m.stat)}</span>` : '';
    const acts = !isUser && !live ? `<div class="msg-acts"><button class="mini" data-copymsg="${idx}">${ic('copy')}${esc(t('copy'))}</button>${idx === state.chat.messages.length - 1 ? `<button class="mini" data-regen>${ic('refresh')}${esc(t('regenerate'))}</button>` : ''}</div>` : '';
    return `<article class="msg ${m.role}" data-i="${idx}">${avatar}<div><div class="who">${esc(who)}${stat}</div><div class="body" dir="auto">${body}</div>${acts}</div></article>`;
  }
  function renderMessages(force) {
    const has = state.chat && state.chat.messages.length;
    $('empty').classList.toggle('hidden', !!has);
    $('msgs').innerHTML = has ? state.chat.messages.map((m, i) => msgHtml(m, i, state.streaming && i === state.chat.messages.length - 1)).join('') : '';
    scrollDown(!!force);
  }
  function scrollDown(force) {
    const th = $('thread');
    if (force || th.scrollHeight - th.scrollTop - th.clientHeight < 180) th.scrollTo({ top: th.scrollHeight, behavior: 'auto' });
  }

  async function send(text, regen) {
    if (state.streaming) return;
    if (!state.chat) newChat();
    const model = $('modelSelect').value;
    if (!model) { toast(t('errModel')); return; }
    if (!regen) {
      text = (text || '').trim(); if (!text) return;
      state.chat.messages.push({ role: 'user', content: text });
      if (!state.chat.title) state.chat.title = text.replace(/\s+/g, ' ').slice(0, 48);
    }
    state.chat.model = model;
    state.chat.messages.push({ role: 'assistant', content: '' });
    state.streaming = true; $('send').classList.add('hidden'); $('stop').classList.remove('hidden');
    renderMessages(true);
    const idx = state.chat.messages.length - 1;
    const node = () => document.querySelector(`.msg[data-i="${idx}"] .body`);
    state.abort = new AbortController();
    const history = state.chat.messages.slice(0, -1).map(({ role, content }) => ({ role, content }));
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: state.abort.signal, body: JSON.stringify({ model, messages: history }) });
      if (!r.ok) throw new Error(t('errEngine'));
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
          const j = JSON.parse(line);
          if (j.error) throw new Error(j.error);
          if (j.message?.content) {
            state.chat.messages[idx].content += j.message.content;
            const n = node(); if (n) { n.innerHTML = renderMd(state.chat.messages[idx].content) + '<span class="cursor"></span>'; scrollDown(false); }
          }
          if (j.done && j.eval_count && j.eval_duration) {
            state.chat.messages[idx].stat = `${(j.eval_count / (j.eval_duration / 1e9)).toFixed(1)} ${t('tokps')}`;
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        state.chat.messages[idx].content += (state.chat.messages[idx].content ? '\n\n' : '') + '⚠ ' + (e.message || t('errEngine'));
        state.chat.messages[idx].err = true;
      }
    }
    state.streaming = false; state.abort = null; $('send').classList.remove('hidden'); $('stop').classList.add('hidden');
    if (!state.chat.messages[idx].content) state.chat.messages.pop();
    renderMessages(false);
    const last = document.querySelector('.msg.assistant:last-child .body'); if (last && state.chat.messages[idx]?.err) last.classList.add('err');
    await persist();
  }

  function exportChat() {
    if (!state.chat || !state.chat.messages.length) return;
    const md = `# ${state.chat.title || t('untitled')}\n\n` + state.chat.messages.map((m) => `**${m.role === 'user' ? t('you') : t('assistant')}:**\n\n${m.content}\n`).join('\n---\n\n') + `\n\n— CAF AI · كآف · iT CAF`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    a.download = `caf-ai-${state.chat.id.slice(0, 8)}.md`; a.click(); URL.revokeObjectURL(a.href);
    toast(t('exported'));
  }
  const openSide = () => { $('sidebar').classList.add('open'); $('scrim').classList.add('show'); };
  const closeSide = () => { $('sidebar').classList.remove('open'); $('scrim').classList.remove('show'); };

  // ---------- الأحداث ----------
  function bind() {
    $('newChat').onclick = newChat;
    $('toggleSide').onclick = openSide; $('scrim').onclick = closeSide;
    $('send').onclick = () => { const v = $('input').value; $('input').value = ''; autoGrow(); send(v); };
    $('stop').onclick = () => state.abort && state.abort.abort();
    $('exportChat').onclick = exportChat;
    $('themeBtn').onclick = () => saveSettings({ theme: effectiveTheme() === 'dark' ? 'light' : 'dark' });
    $('langBtn').onclick = () => saveSettings({ lang: state.settings.lang === 'ar' ? 'en' : 'ar' });
    $('search').oninput = (e) => { state.filter = e.target.value; renderChatList(); };
    const input = $('input');
    const autoGrow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 220) + 'px'; };
    input.addEventListener('input', autoGrow);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('send').click(); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newChat(); }
      if (e.key === 'Escape') closeSide();
    });
    const th = $('thread');
    th.addEventListener('scroll', () => { $('toBottom').classList.toggle('hidden', th.scrollHeight - th.scrollTop - th.clientHeight < 300); });
    $('toBottom').onclick = () => th.scrollTo({ top: th.scrollHeight, behavior: 'smooth' });
    $('modelSelect').onchange = (e) => saveSettings({ model: e.target.value });
    $('suggest').onclick = (e) => { const b = e.target.closest('button[data-p]'); if (b) send(t(b.dataset.p)); };
    $('chatList').onclick = async (e) => {
      const del = e.target.closest('[data-delchat]'), ren = e.target.closest('[data-rename]'), item = e.target.closest('.chat-item');
      if (del) {
        if (!confirm(t('confirmDeleteChat'))) return;
        await api('DELETE', '/api/chats/' + del.dataset.delchat);
        if (state.chat && state.chat.id === del.dataset.delchat) { state.chat = null; renderMessages(true); }
        return loadChats();
      }
      if (ren) {
        const c = state.chats.find((x) => x.id === ren.dataset.rename); const name = prompt(t('rename'), c?.title || '');
        if (name === null) return;
        const full = await api('GET', '/api/chats/' + ren.dataset.rename); full.title = name.slice(0, 120);
        await api('PUT', '/api/chats/' + full.id, full);
        if (state.chat && state.chat.id === full.id) state.chat.title = full.title;
        return loadChats();
      }
      if (item) openChat(item.dataset.id);
    };
    $('chatList').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('chat-item')) openChat(e.target.dataset.id); });
    $('msgs').onclick = async (e) => {
      const cp = e.target.closest('[data-copy]');
      if (cp) { await navigator.clipboard.writeText(cp.closest('.codeblock').querySelector('code').textContent); cp.textContent = t('copied'); setTimeout(() => { cp.textContent = t('copy'); }, 1200); return; }
      const cm = e.target.closest('[data-copymsg]');
      if (cm) { await navigator.clipboard.writeText(state.chat.messages[+cm.dataset.copymsg].content); toast(t('copied')); return; }
      if (e.target.closest('[data-regen]')) { state.chat.messages.pop(); send(null, true); }
    };
    // الإعدادات
    const dlg = $('settingsDlg');
    $('openSettings').onclick = () => {
      $('setSystem').value = state.settings.systemPrompt;
      $('setTemp').value = state.settings.temperature; $('tempOut').textContent = state.settings.temperature; $('setCtx').value = String(state.settings.numCtx);
      closeSide(); loadModels(); dlg.showModal();
    };
    $('segLang').onclick = (e) => { const b = e.target.closest('button'); if (b) saveSettings({ lang: b.dataset.v }); };
    $('segTheme').onclick = (e) => { const b = e.target.closest('button'); if (b) saveSettings({ theme: b.dataset.v }); };
    $('setTemp').oninput = (e) => { $('tempOut').textContent = e.target.value; };
    $('setTemp').onchange = (e) => saveSettings({ temperature: +e.target.value });
    $('setCtx').onchange = (e) => saveSettings({ numCtx: +e.target.value });
    $('setSystem').onchange = (e) => saveSettings({ systemPrompt: e.target.value }).then(() => toast(t('saved')));
    $('pullBtn').onclick = pull;
    $('pullName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pull(); } });
    $('modelList').onclick = async (e) => {
      const b = e.target.closest('[data-del]'); if (!b || !confirm(t('confirmDeleteModel'))) return;
      await api('DELETE', '/api/models', { name: b.dataset.del }); loadModels();
    };
    $('wipeChats').onclick = async () => { if (!confirm(t('confirmDeleteAll'))) return; await api('DELETE', '/api/chats'); state.chat = null; renderMessages(true); loadChats(); };
    $('quitApp').onclick = async () => { try { await api('POST', '/api/quit'); } catch { /* */ } document.body.innerHTML = `<p style="padding:40px;font:18px var(--f-ui)">${esc(t('quitDone'))}</p>`; };
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  (async function init() {
    state.settings = await api('GET', '/api/settings').catch(() => ({ lang: 'ar', theme: 'system', model: '', systemPrompt: '', temperature: 0.7, numCtx: 4096 }));
    state.info = await api('GET', '/api/info').catch(() => null);
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) document.querySelector('.btn.primary kbd').textContent = 'Ctrl K';
    bind(); applyLang(); newChat();
    await Promise.all([loadModels(), loadChats()]);
    const h = location.hash;
    if (h.startsWith('#chat=')) await openChat(decodeURIComponent(h.slice(6)));
    if (h === '#settings') $('openSettings').click();
    setInterval(loadModels, 20000);
  })();
})();
