/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// الصوت (اختياري): ميكروفون في صندوق الكتابة (تفريغ محلي) وزر «استمع» على كل رد (Piper أو صوت النظام المحلي).
import { state, $, t, esc, ic, api, toast, on, errText, authHeaders } from '../core.js';
import { msgActions } from '../chat.js';
import { settingsSections, saveSettings } from '../settings.js';
import { installAddon } from '../runners.js';
import { splitThink } from '../md.js';

window.I18N_ADD({
  ar: {
    voice: 'الصوت', voiceSub: 'تحويل كلامك إلى نص، وقراءة الردود بصوت — محليًا بالكامل. لا يُنزَّل شيء حتى تفعّله.', voiceEnable: 'تفعيل الصوت',
    sttTitle: 'الكلام إلى نص', ttsTitle: 'قراءة الردود', sttWhisper: 'whisper.cpp + نموذج Whisper', sttOllama: 'نموذج صوتي في Ollama: {m}', sttNone: 'غير مجهّز بعد',
    sttMacHint: 'على macOS: نزّل نموذجًا يدعم الصوت (gemma4:e2b) أو ثبّت whisper-cpp عبر Homebrew (brew install whisper-cpp) ثم نزّل نموذج Whisper.',
    ttsPiper: 'Piper + الصوت العربي (كريم)', ttsSystem: 'صوت النظام المحلي', systemVoice: 'صوت النظام', noLocalVoice: 'لا يوجد صوت محلي مثبّت لهذه اللغة في نظامك.',
    mic: 'تحدّث', recording: 'يسجّل… اضغط للإيقاف', transcribing: 'يفرّغ الصوت…', listen: 'استمع', stopListen: 'إيقاف', micDenied: 'لم يُسمح بالوصول إلى الميكروفون.',
    err_no_stt: 'تفريغ الصوت غير مجهّز: فعّل الصوت من الإعدادات ونزّل محرك التفريغ.', err_voice_disabled: 'الصوت غير مفعّل من الإعدادات.', err_stt_failed: 'تعذّر تفريغ الصوت.', err_tts_failed: 'تعذّرت القراءة الصوتية.',
  },
  en: {
    voice: 'Voice', voiceSub: 'Speech to text and spoken replies — fully local. Nothing is downloaded until you enable it.', voiceEnable: 'Enable voice',
    sttTitle: 'Speech to text', ttsTitle: 'Read replies aloud', sttWhisper: 'whisper.cpp + Whisper model', sttOllama: 'Ollama audio model: {m}', sttNone: 'Not set up yet',
    sttMacHint: 'On macOS: download an audio-capable model (gemma4:e2b), or install whisper-cpp with Homebrew (brew install whisper-cpp) and download a Whisper model.',
    ttsPiper: 'Piper + Arabic voice (Kareem)', ttsSystem: 'Local system voice', systemVoice: 'System voice', noLocalVoice: 'No local voice installed for this language on your system.',
    mic: 'Speak', recording: 'Recording… click to stop', transcribing: 'Transcribing…', listen: 'Listen', stopListen: 'Stop', micDenied: 'Microphone access was not allowed.',
    err_no_stt: 'Speech to text is not set up: enable voice in Settings and download the engine.', err_voice_disabled: 'Voice is disabled in Settings.', err_stt_failed: 'Could not transcribe.', err_tts_failed: 'Could not read aloud.',
  },
});

// ---------- تسجيل الميكروفون → WAV ‏16kHz أحادي ----------
let rec = null;
async function toWav16k(blob) {
  const buf = await blob.arrayBuffer();
  const ctx = new AudioContext(); const audio = await ctx.decodeAudioData(buf); ctx.close();
  const off = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
  const src = off.createBufferSource(); src.buffer = audio; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([out], { type: 'audio/wav' });
}
async function toggleMic() {
  const b = $('micBtn');
  if (rec) { rec.stop(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
  catch { toast(t('micDenied')); return; }
  const chunks = []; rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach((x) => x.stop()); rec = null;
    b.classList.remove('rec'); b.classList.add('busy'); b.title = t('transcribing');
    try {
      const wav = await toWav16k(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' }));
      const lang = state.settings.lang === 'en' ? 'auto' : 'ar';
      const r = await fetch(`/api/voice/stt?lang=${lang}`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'audio/wav' }), body: wav });
      const j = await r.json(); if (!r.ok) throw Object.assign(new Error(j.error), { code: j.error });
      const input = $('input'); input.value = (input.value ? input.value.trimEnd() + ' ' : '') + j.text; input.dispatchEvent(new Event('input')); input.focus();
    } catch (e) { toast(errText(e), 5000); }
    b.classList.remove('busy'); b.title = t('mic');
  };
  rec.start(); b.classList.add('rec'); b.title = t('recording');
}

// ---------- القراءة الصوتية ----------
let speaking = null;
const plain = (md) => splitThink(md).content.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/[#*_>|~\-]+/g, ' ').replace(/\[(\d+)\]/g, '').replace(/\s+/g, ' ').trim();
const localVoices = (lang) => speechSynthesis.getVoices().filter((v) => v.localService && v.lang.toLowerCase().startsWith(lang));
function stopSpeaking() { if (speaking?.audio) speaking.audio.pause(); speechSynthesis.cancel(); speaking = null; document.querySelectorAll('[data-listen].on').forEach((x) => x.classList.remove('on')); }
async function listen(idx, btn) {
  if (speaking?.idx === idx) return stopSpeaking();
  stopSpeaking();
  const text = plain(state.chat.messages[idx].content).slice(0, 5000); if (!text) return;
  speaking = { idx }; btn.classList.add('on');
  try {
    const r = await fetch('/api/voice/tts', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text }) });
    if (r.status === 200) { const a = new Audio(URL.createObjectURL(await r.blob())); speaking.audio = a; a.onended = stopSpeaking; await a.play(); return; }
    if (r.status !== 409) throw Object.assign(new Error('tts'), { code: (await r.json()).error });
    // أصوات النظام المحلية فقط (localService) — لا نستخدم أصواتًا سحابية
    const lang = /[؀-ۿ]/.test(text) ? 'ar' : 'en';
    const want = localStorage.getItem('caf-voice-' + lang);
    const voice = localVoices(lang).find((v) => v.name === want) || localVoices(lang)[0];
    if (!voice) { stopSpeaking(); return toast(t('noLocalVoice')); }
    const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.onend = stopSpeaking;
    speechSynthesis.speak(u);
  } catch (e) { stopSpeaking(); toast(errText(e)); }
}

// ---------- قسم الإعدادات ----------
async function renderSection(el) {
  const s = state.settings;
  el.innerHTML = `<h3>${esc(t('voice'))}</h3><p class="muted small">${esc(t('voiceSub'))}</p>
    <div class="set-row"><div class="set-l"><b>${esc(t('voiceEnable'))}</b></div><div class="set-c"><label class="switch"><input type="checkbox" id="vEnable" ${s.voiceEnabled ? 'checked' : ''}><span class="sw"></span></label></div></div>
    <div id="vBody">${s.voiceEnabled ? `<p class="muted">${esc(t('loading'))}</p>` : ''}</div>`;
  el.querySelector('#vEnable').onchange = async (e) => { await saveSettings({ voiceEnabled: e.target.checked }); renderSection(el); syncButtons(); };
  if (!s.voiceEnabled) return;
  let v; try { v = await api('GET', '/api/voice/status'); } catch (e) { el.querySelector('#vBody').textContent = errText(e); return; }
  const add = await api('GET', '/api/addons');
  const eng = (id) => add.engines.find((x) => x.id === id); const mdl = (id) => add.models.find((x) => x.id === id);
  const btn = (id, label) => `<button class="btn small" data-vinst="${id}">${ic('download')}<span>${esc(label)}</span></button>`;
  const sttState = v.stt.engine === 'whisper' ? t('sttWhisper') : v.stt.engine === 'ollama-audio' ? t('sttOllama', { m: v.stt.ollamaAudio }) : t('sttNone');
  const ar = localVoices('ar'); const en = localVoices('en');
  el.querySelector('#vBody').innerHTML = `
    <div class="set-row"><div class="set-l"><b>${ic('mic')} ${esc(t('sttTitle'))}</b><small>${esc(sttState)}</small></div><div class="set-c row wrap">
      ${eng('whisper')?.downloadable && !v.stt.whisper.binary ? btn('whisper', 'whisper.cpp') : ''}
      ${(v.stt.whisper.binary || eng('whisper')?.downloadable) && !v.stt.whisper.model ? btn('whisper-small', 'Whisper small (488 MB)') : ''}
      ${!v.stt.engine && !eng('whisper')?.downloadable ? `<button class="btn small" data-pullmodel="gemma4:e2b">${ic('download')}<span>gemma4:e2b</span></button>` : ''}
    </div></div>
    ${!v.stt.engine && !eng('whisper')?.downloadable ? `<p class="muted small">${esc(t('sttMacHint'))}</p>` : ''}
    <div class="set-row"><div class="set-l"><b>${ic('speaker')} ${esc(t('ttsTitle'))}</b><small>${esc(v.tts.engine === 'piper' ? t('ttsPiper') : t('ttsSystem'))}</small></div><div class="set-c row wrap">
      ${eng('piper')?.downloadable && !v.tts.piper.binary ? btn('piper', 'Piper') : ''}${eng('piper')?.downloadable && !v.tts.piper.voice ? btn('voice-ar-kareem', `${mdl('voice-ar-kareem')?.name || 'Arabic voice'}`) : ''}</div></div>
    ${v.tts.engine !== 'piper' ? `<div class="set-row"><div class="set-l"><b>${esc(t('systemVoice'))} · العربية</b></div><div class="set-c"><select data-voice="ar">${ar.map((x) => `<option ${localStorage.getItem('caf-voice-ar') === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('') || `<option>${esc(t('noLocalVoice'))}</option>`}</select></div></div>
      <div class="set-row"><div class="set-l"><b>${esc(t('systemVoice'))} · English</b></div><div class="set-c"><select data-voice="en">${en.map((x) => `<option ${localStorage.getItem('caf-voice-en') === x.name ? 'selected' : ''}>${esc(x.name)}</option>`).join('') || `<option>${esc(t('noLocalVoice'))}</option>`}</select></div></div>` : ''}`;
  el.querySelectorAll('[data-vinst]').forEach((b) => { b.onclick = async () => { b.disabled = true; await installAddon(b.dataset.vinst, b.textContent.trim()); renderSection(el); }; });
  el.querySelectorAll('[data-voice]').forEach((sel) => { sel.onchange = () => localStorage.setItem('caf-voice-' + sel.dataset.voice, sel.value); });
}

function syncButtons() { const b = $('micBtn'); if (b) b.hidden = !state.settings.voiceEnabled; }

export function init() {
  settingsSections.push({ id: 'voice', icon: 'mic', label: () => t('voice'), render: renderSection });
  const mic = document.createElement('button'); mic.type = 'button'; mic.id = 'micBtn'; mic.className = 'btn icon-only mic-btn';
  mic.title = t('mic'); mic.setAttribute('aria-label', t('mic')); mic.innerHTML = ic('mic'); mic.hidden = true;
  $('composerRight').appendChild(mic); mic.onclick = toggleMic;
  msgActions.push((m, idx) => (state.settings.voiceEnabled && m.role === 'assistant' && m.content ? `<button class="mini" data-listen="${idx}">${ic('speaker')}${esc(t('listen'))}</button>` : ''));
  $('msgs').addEventListener('click', (e) => { const b = e.target.closest('[data-listen]'); if (b) listen(+b.dataset.listen, b); });
  speechSynthesis?.getVoices(); // تحميل قائمة الأصوات مبكرًا
  on('ui:applied', syncButtons); on('settings:changed', syncButtons); syncButtons();
}
