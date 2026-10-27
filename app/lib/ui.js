// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const fs = require('fs');
const { P, VERSION } = require('./paths');

const on = (process.stdout.isTTY || process.env.FORCE_COLOR) && !process.env.NO_COLOR;
const c = (code) => (s) => (on ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const amber = c('38;2;232;163;61'), green = c('38;2;95;179;161'), gray = c('38;2;138;147;153'), copper = c('38;2;219;133;86'), bold = c('1');

function lang() {
  const a = process.argv.find((x) => x.startsWith('--lang='));
  if (a) return a.slice(7) === 'en' ? 'en' : 'ar';
  const i = process.argv.indexOf('--lang');
  if (i > 0) return process.argv[i + 1] === 'en' ? 'en' : 'ar';
  if (process.env.CAF_LANG) return process.env.CAF_LANG === 'en' ? 'en' : 'ar';
  try { return JSON.parse(fs.readFileSync(P.settings, 'utf8')).lang === 'en' ? 'en' : 'ar'; } catch { return 'ar'; }
}
const st = { L: lang() };
const tr = (ar, en) => (st.L === 'en' ? en : ar);
const setLang = (l) => { st.L = l === 'en' ? 'en' : 'ar'; };

const say = (s = '') => console.log(s);
const ok = (s) => say(`  ${green('✓')} ${s}`);
const info = (s) => say(`  ${gray(s)}`);
const step = (s) => say(`  ${amber('›')} ${s}`);
const fail = (s) => { say(`  ${copper('✗ ' + s)}`); process.exit(1); };

function banner() {
  const year = new Date().getFullYear();
  say('');
  say(`  ${amber(bold('>'))} ${bold('CAF AI')}  ${gray('·')}  ${bold('كآف AI')}   ${gray('v' + VERSION)}`);
  say(`  ${gray(`by CAF · iT CAF · store.it-caf.com · © ${year}`)}`);
  say(`  ${gray('─'.repeat(52))}`);
}

const clear = () => { if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); };
const rule = () => gray('  ' + '─'.repeat(52));
module.exports = { amber, green, gray, copper, bold, tr, setLang, say, ok, info, step, fail, banner, clear, rule };
