// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// سجل تشخيصي محلي فقط (data/caf.log) — لا يحوي نصوص المحادثات، ولا يُرسل لأي جهة.
'use strict';
const fs = require('fs');
const path = require('path');
const { P } = require('./paths');

const file = () => path.join(P.data, 'caf.log');
function log(level, msg, extra) {
  const line = `${new Date().toISOString()} ${level} ${msg}${extra ? ' ' + JSON.stringify(extra).slice(0, 800) : ''}\n`;
  try {
    const f = file();
    try { if (fs.statSync(f).size > 2 * 1024 * 1024) fs.renameSync(f, f + '.1'); } catch { /* */ }
    fs.appendFileSync(f, line);
  } catch { /* القرص للقراءة فقط */ }
  if (process.env.CAF_DEBUG) process.stderr.write(line);
}
module.exports = { info: (m, e) => log('INFO', m, e), warn: (m, e) => log('WARN', m, e), error: (m, e) => log('ERROR', m, e) };
