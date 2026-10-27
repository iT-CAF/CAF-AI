// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const readline = require('readline');
const ui = require('./ui');

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const norm = (s) => { const i = s.length === 1 ? AR_DIGITS.indexOf(s) : -1; return i >= 0 ? String(i) : s; };

// ضغطة مفتاح واحدة بدون Enter (الأرقام العربية والإنجليزية، الأسهم، Enter، Esc)
function readKey() {
  return new Promise((resolve) => {
    const si = process.stdin;
    if (!si.isTTY) {
      const rl = readline.createInterface({ input: si });
      rl.once('line', (l) => { rl.close(); resolve(l.trim()[0] || '\r'); });
      rl.once('close', () => resolve('0'));
      return;
    }
    si.setRawMode(true); si.resume(); si.setEncoding('utf8');
    si.once('data', (d) => {
      si.setRawMode(false); si.pause();
      if (d === '\u0003') { process.stdout.write('\n'); process.exit(130); }
      resolve(norm(d));
    });
  });
}

// قائمة أرقام: اختر برقم أو بالأسهم + Enter. render() يرسم الرأس.
async function menu({ render, items, hint }) {
  let sel = 0;
  for (;;) {
    ui.clear();
    render();
    ui.say('');
    const vis = (x) => x.replace(/\x1b\[[0-9;]*m/g, '').length;
    const w = Math.max(...items.map((i) => vis(i.label)));
    items.forEach((it, i) => {
      const on = i === sel;
      const num = on ? ui.amber(ui.bold(it.k)) : ui.gray(it.k);
      const lab = on ? ui.bold(it.label) : it.label;
      ui.say(`  ${on ? ui.amber('›') : ' '} ${num}  ${lab}${it.hint ? ' '.repeat(w - vis(it.label) + 3) + ui.gray(it.hint) : ''}`);
    });
    ui.say('');
    ui.say(ui.rule());
    ui.say(`  ${ui.gray(hint || ui.tr('اختر رقمًا · أو الأسهم ثم Enter · 0 للرجوع', 'Press a number · or arrows + Enter · 0 to go back'))}`);
    const k = await readKey();
    if (k === '\x1b[A' || k === 'k') sel = (sel - 1 + items.length) % items.length;
    else if (k === '\x1b[B' || k === 'j') sel = (sel + 1) % items.length;
    else if (k === '\r' || k === '\n') return items[sel];
    else {
      const hit = items.find((i) => i.k.toLowerCase() === k.toLowerCase());
      if (hit) return hit;
      if (k === 'q' || k === '\x1b') return items.find((i) => i.k === '0') || items[items.length - 1];
    }
  }
}

async function pause(msg) {
  ui.say(`  ${ui.gray(msg || ui.tr('اضغط أي مفتاح للمتابعة…', 'Press any key to continue…'))}`);
  await readKey();
}

const FR = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
async function spin(label, promise) {
  if (!process.stdout.isTTY) { ui.step(label); return promise; }
  let i = 0;
  const t = setInterval(() => process.stdout.write(`\r  ${ui.amber(FR[i++ % FR.length])} ${label}   `), 80);
  try { return await promise; }
  finally { clearInterval(t); process.stdout.write('\r' + ' '.repeat(label.length + 12) + '\r'); }
}

module.exports = { readKey, menu, pause, spin };
