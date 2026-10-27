// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { P, VERSION, ensureDirs, findOllama } = require('./lib/paths');
const ui = require('./lib/ui');
const { tr, say, ok, info, step, amber, green, gray, bold, copper } = ui;
const term = require('./lib/term');
const proc = require('./lib/proc');
const models = require('./lib/models');
const engine = require('./lib/engine');
const { installEngine } = require('./lib/install');
const { openTarget } = require('./lib/open');

const REPO_RAW = 'https://raw.githubusercontent.com/iT-CAF/CAF-AI/main';
const noOpen = process.argv.includes('--no-open');
const interactive = process.stdin.isTTY && process.stdout.isTTY;

// ---------- الإعدادات ----------
const readSettings = () => { try { return JSON.parse(fs.readFileSync(P.settings, 'utf8')); } catch { return {}; } };
function writeSettings(patch) {
  fs.mkdirSync(P.data, { recursive: true });
  const tmp = P.settings + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ ...readSettings(), ...patch }, null, 2));
  fs.renameSync(tmp, P.settings);
}
function askLine(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}
const url = (st) => `http://127.0.0.1:${st.port}`;

// ---------- التشغيل والإيقاف ----------
async function doStart({ open = true } = {}) {
  let st = await proc.status();
  if (!st.running) st = await term.spin(tr('تشغيل كآف AI…', 'Starting CAF AI…'), proc.startDaemon());
  if (open && !noOpen) openTarget(url(st));
  return st;
}
async function doStop() { return term.spin(tr('إيقاف كآف AI…', 'Stopping CAF AI…'), proc.stopDaemon()); }

// ---------- النماذج ----------
async function withEngine(label, fn) {
  const port = await term.spin(label, engine.startEngine());
  try { return await fn(port); } finally { engine.stopEngine(); }
}
async function downloadModel(name) {
  say(''); step(tr(`تنزيل ${bold(name)}`, `Downloading ${bold(name)}`));
  const err = await withEngine(tr('تشغيل المحرك…', 'Starting engine…'), (port) => models.pull(name, port));
  if (err) say(`  ${copper('✗ ' + err)}`); else ok(tr(`تم تنزيل ${name}`, `${name} is ready`));
  say('');
}
async function deleteModel() {
  const list = models.listInstalled().slice(0, 9);
  if (!list.length) { info(tr('لا توجد نماذج لحذفها.', 'No models to delete.')); await term.pause(); return; }
  const items = [...list.map((m, i) => ({ k: String(i + 1), label: m.name, hint: models.gb(m.size), m })), { k: '0', label: tr('رجوع', 'Back') }];
  const pick = await term.menu({ render: () => { ui.banner(); say(''); say(`  ${bold(tr('حذف نموذج', 'Delete a model'))}`); }, items });
  if (!pick.m) return;
  const yes = await term.menu({
    render: () => { ui.banner(); say(''); say(`  ${copper(tr(`حذف ${pick.m.name}؟`, `Delete ${pick.m.name}?`))}`); },
    items: [{ k: '1', label: tr('نعم، احذف', 'Yes, delete') }, { k: '0', label: tr('إلغاء', 'Cancel') }],
  });
  if (yes.k !== '1') return;
  const r = await withEngine(tr('تشغيل المحرك…', 'Starting engine…'), () => engine.engineJson('DELETE', '/api/delete', { name: pick.m.name }));
  if (r.status === 200) ok(tr('تم الحذف', 'Deleted')); else say(`  ${copper('✗ ' + tr('تعذّر الحذف', 'Delete failed'))}`);
  await term.pause();
}
async function modelsMenu() {
  for (;;) {
    const have = models.listInstalled();
    const presets = models.PRESETS();
    const has = (n) => have.some((m) => m.name === n || m.name === n + ':latest');
    const extra = have.filter((m) => !presets.some((p) => p.name === m.name));
    const items = [
      ...presets.map((p) => ({ k: p.k, label: `${p.name.padEnd(13)}${has(p.name) ? green('✓') : ' '}`, hint: `${p.size} · RAM ${p.ram}+ · ${p.tag}`, p })),
      { k: '6', label: tr('نموذج آخر من مكتبة Ollama', 'Another model from the Ollama library') },
      { k: '7', label: tr('حذف نموذج', 'Delete a model') },
      { k: '0', label: tr('رجوع', 'Back') },
    ];
    const pick = await term.menu({
      render: () => {
        ui.banner(); say('');
        say(`  ${bold(tr('النماذج', 'Models'))}  ${gray(tr('اختر رقمًا لتنزيل نموذج', 'press a number to download'))}`);
        if (extra.length) say(`  ${gray(tr('مثبّت أيضًا: ', 'Also installed: ') + extra.map((m) => m.name).join(', '))}`);
      },
      items,
    });
    if (pick.k === '0') return;
    if (pick.p) {
      if (has(pick.p.name)) { info(tr('هذا النموذج مثبّت بالفعل.', 'Already installed.')); await term.pause(); continue; }
      await downloadModel(pick.p.name); await term.pause();
    } else if (pick.k === '6') {
      ui.clear(); ui.banner(); say('');
      const n = await askLine(`  ${amber('>')} ${tr('اسم النموذج (مثل mistral:7b): ', 'Model name (e.g. mistral:7b): ')}`);
      if (/^[\w.\-:/]{1,120}$/.test(n)) { await downloadModel(n); await term.pause(); }
    } else if (pick.k === '7') await deleteModel();
  }
}

// ---------- الإعدادات والتحديث ----------
function runUpdate() {
  say(''); step(tr('تحديث كآف AI…', 'Updating CAF AI…'));
  const r = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `irm ${REPO_RAW}/install-caf-ai.ps1 | iex`], { stdio: 'inherit' })
    : spawnSync('bash', ['-c', `curl -fsSL ${REPO_RAW}/install-caf-ai.sh | bash`], { stdio: 'inherit' });
  if (r.status === 0) ok(tr('تم التحديث. أعد تشغيل كآف AI لتفعيله.', 'Updated. Restart CAF AI to apply.')); else say(`  ${copper('✗ ' + tr('فشل التحديث', 'Update failed'))}`);
}
function about() {
  ui.clear(); ui.banner(); say('');
  say(`  ${bold('CAF AI')} v${VERSION}`);
  say(`  © ${new Date().getFullYear()} ${tr('كآف · iT CAF — جميع الحقوق محفوظة', 'CAF · iT CAF — All rights reserved')}`);
  say(`  ${amber('https://store.it-caf.com')}`); say('');
  say(`  ${gray(tr('البيانات: ', 'Data: ') + P.home)}`);
  say(`  ${gray(tr('النماذج: ', 'Models: ') + P.models)}`);
  say(`  ${gray(tr('الرخصة: ملف LICENSE في المشروع', 'License: see LICENSE in the project'))}`); say('');
}
async function settingsMenu() {
  for (;;) {
    const s = readSettings();
    const lang = s.lang === 'en' ? 'en' : 'ar'; const theme = s.theme || 'system';
    const themeName = { system: tr('تلقائي', 'Auto'), dark: tr('ليلي', 'Night'), light: tr('نهاري', 'Day') }[theme] || theme;
    const pick = await term.menu({
      render: () => { ui.banner(); say(''); say(`  ${bold(tr('الإعدادات والتحديث', 'Settings & update'))}`); },
      items: [
        { k: '1', label: tr('اللغة', 'Language'), hint: lang === 'ar' ? 'العربية → English' : 'English → العربية' },
        { k: '2', label: tr('المظهر', 'Appearance'), hint: themeName },
        { k: '3', label: tr('تحديث كآف AI', 'Update CAF AI'), hint: `v${VERSION}` },
        { k: '4', label: tr('فتح مجلد البيانات', 'Open data folder') },
        { k: '5', label: tr('عن كآف AI والحقوق', 'About & rights') },
        { k: '0', label: tr('رجوع', 'Back') },
      ],
    });
    if (pick.k === '0') return;
    if (pick.k === '1') { const n = lang === 'ar' ? 'en' : 'ar'; writeSettings({ lang: n }); ui.setLang(n); }
    else if (pick.k === '2') writeSettings({ theme: { system: 'dark', dark: 'light', light: 'system' }[theme] || 'system' });
    else if (pick.k === '3') { runUpdate(); await term.pause(); }
    else if (pick.k === '4') openTarget(P.home);
    else if (pick.k === '5') { about(); await term.pause(); }
  }
}

// ---------- أول تشغيل ----------
async function firstRun() {
  ensureDirs();
  const asked = path.join(P.data, '.models-asked');
  const needEngine = !findOllama();
  const needModels = !models.listInstalled().length && !fs.existsSync(asked);
  if (!needEngine && !needModels) return;
  ui.clear(); ui.banner(); say('');
  say(`  ${bold(tr('إعداد أول مرة', 'First-time setup'))}`); say('');
  await installEngine();
  if (needModels) {
    if (!interactive) { info(tr('لا يوجد نموذج بعد: نزّله من الإعدادات داخل التطبيق.', 'No model yet: download one from Settings in the app.')); return; }
    const presets = models.PRESETS();
    const pick = await term.menu({
      render: () => { ui.banner(); say(''); say(`  ${bold(tr('اختر نموذجك الأول', 'Choose your first model'))}  ${gray(tr('(يمكنك إضافة غيره لاحقًا)', '(you can add more later)'))}`); },
      items: [...presets.map((p) => ({ k: p.k, label: p.name.padEnd(13), hint: `${p.size} · RAM ${p.ram}+ · ${p.tag}`, p })), { k: '0', label: tr('تخطّي', 'Skip') }],
      hint: tr('اختر رقمًا · Enter للأول الموصى به', 'Press a number · Enter for the recommended one'),
    });
    fs.writeFileSync(asked, new Date().toISOString());
    if (pick.p) { ui.clear(); ui.banner(); await downloadModel(pick.p.name); }
  }
}

// ---------- القائمة الرئيسية ----------
async function mainMenu() {
  let note = '';
  for (;;) {
    const st = await proc.status();
    const items = [
      { k: '1', label: st.running ? tr('فتح الدردشة', 'Open chat') : tr('تشغيل وفتح الدردشة', 'Start & open chat'), hint: st.running ? url(st) : 'start' },
      { k: '2', label: tr('إعادة التشغيل', 'Restart'), hint: 'restart' },
      { k: '3', label: tr('إيقاف', 'Stop'), hint: 'stop' },
      { k: '4', label: tr('النماذج', 'Models'), hint: 'models' },
      { k: '5', label: tr('الإعدادات والتحديث', 'Settings & update'), hint: 'settings' },
      { k: '0', label: tr('خروج', 'Exit') },
    ];
    const pick = await term.menu({
      render: () => {
        ui.banner(); say('');
        say(st.running
          ? `  ${green('●')} ${bold(tr('يعمل', 'Running'))}  ${amber(url(st))}  ${gray(st.model ? '· ' + st.model : '')}`
          : `  ${gray('○')} ${bold(tr('متوقف', 'Stopped'))}`);
        if (note) say(`  ${note}`);
      },
      items,
      hint: tr('اختر رقمًا · أو الأسهم ثم Enter · 0 للخروج', 'Press a number · or arrows + Enter · 0 to exit'),
    });
    note = '';
    try {
      if (pick.k === '1') { const s = await doStart(); note = `${green('✓')} ${tr('تم فتح الدردشة', 'Chat opened')} ${gray(url(s))}`; }
      else if (pick.k === '2') { await proc.stopDaemon(); const s = await doStart(); note = `${green('✓')} ${tr('تمت إعادة التشغيل', 'Restarted')} ${gray(url(s))}`; }
      else if (pick.k === '3') { note = (await doStop()) ? `${green('✓')} ${tr('تم الإيقاف', 'Stopped')}` : gray(tr('كان متوقفًا', 'Already stopped')); }
      else if (pick.k === '4') await modelsMenu();
      else if (pick.k === '5') await settingsMenu();
      else if (pick.k === '0') break;
    } catch (e) { note = copper('✗ ' + String(e.message).split('\n').slice(-2).join(' ')); }
  }
  ui.clear(); ui.banner();
  const st = await proc.status();
  say('');
  if (st.running) { ok(`${tr('كآف AI يعمل في الخلفية', 'CAF AI keeps running in the background')}  ${amber(url(st))}`); info(tr('للإيقاف: startcaf stop', 'To stop: startcaf stop')); }
  say('');
}

// ---------- الأوامر السريعة ----------
async function quickStart() {
  await firstRun();
  ui.banner(); say('');
  const was = (await proc.status()).running;
  const st = await doStart();
  ok(`${was ? tr('كآف AI يعمل أصلًا', 'CAF AI is already running') : tr('كآف AI يعمل', 'CAF AI is running')}  ${amber(url(st))}`);
  if (!noOpen) step(tr('فتح الدردشة في المتصفح…', 'Opening the chat in your browser…'));
  info(tr('للإيقاف: startcaf stop · للقائمة: startcaf', 'Stop: startcaf stop · Menu: startcaf'));
  say('');
}
function help() {
  ui.banner(); say('');
  const row = (c, d) => say(`  ${bold(c.padEnd(22))} ${d}`);
  row('startcaf', tr('القائمة التفاعلية (1-5)', 'Interactive menu (1-5)'));
  row('startcaf start', tr('تشغيل سريع وفتح الدردشة', 'Quick start and open the chat'));
  row('startcaf restart', tr('إعادة التشغيل', 'Restart'));
  row('startcaf stop', tr('إيقاف', 'Stop'));
  row('startcaf status', tr('الحالة', 'Status'));
  row('startcaf models', tr('النماذج المثبّتة', 'Installed models'));
  row('startcaf run', tr('تشغيل في هذه النافذة (Ctrl+C للإيقاف)', 'Run in this window (Ctrl+C to stop)'));
  row('startcaf update', tr('تحديث', 'Update'));
  row('--no-open', tr('بدون فتح المتصفح', 'Do not open the browser'));
  row('--lang ar|en', tr('لغة الطرفية', 'Terminal language'));
  say('');
}

(async () => {
  const args = process.argv.slice(2);
  let cmd = args.find((a) => !a.startsWith('-')) || '';
  if (args.includes('--version') || args.includes('-v')) cmd = 'version';
  if (args.includes('--help') || args.includes('-h')) cmd = 'help';
  if (cmd === '') { if (interactive) { await firstRun(); await mainMenu(); } else await quickStart(); }
  else if (cmd === 'start' || cmd === 'ensure') await quickStart();
  else if (cmd === 'install') { await firstRun(); ui.banner(); say(''); ok(tr('اكتمل الإعداد. شغّل: startcaf', 'Setup complete. Run: startcaf')); say(''); }
  else if (cmd === 'restart') { ui.banner(); say(''); await proc.stopDaemon(); const st = await doStart(); ok(`${tr('تمت إعادة التشغيل', 'Restarted')}  ${amber(url(st))}`); say(''); }
  else if (cmd === 'stop') { ui.banner(); say(''); ok((await doStop()) ? tr('تم إيقاف كآف AI', 'CAF AI stopped') : tr('كآف AI غير مشغّل', 'CAF AI is not running')); say(''); }
  else if (cmd === 'status') {
    ui.banner(); say(''); const st = await proc.status();
    say(st.running ? `  ${green('●')} ${bold(tr('يعمل', 'Running'))}  ${amber(url(st))}  ${gray('· ' + st.models + ' ' + tr('نموذج', 'models'))}` : `  ${gray('○')} ${bold(tr('متوقف', 'Stopped'))}  ${gray(tr('شغّله بالأمر: startcaf', 'Start it with: startcaf'))}`); say('');
  } else if (cmd === 'models') {
    ui.banner(); say(''); const l = models.listInstalled();
    if (!l.length) info(tr('لا توجد نماذج. شغّل startcaf ← النماذج.', 'No models. Run startcaf → Models.')); else l.forEach((m) => say(`  ${green('✓')} ${m.name.padEnd(22)} ${gray(models.gb(m.size))}`)); say('');
  } else if (cmd === 'run') { await firstRun(); require('./server.js'); return; }
  else if (cmd === 'update') { ui.banner(); runUpdate(); say(''); }
  else if (cmd === 'version') say(`CAF AI v${VERSION} · by CAF · iT CAF`);
  else help();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
