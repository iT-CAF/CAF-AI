// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const { spawn } = require('child_process');

function openTarget(target) {
  try {
    const cmd = process.platform === 'darwin' ? ['open', [target]]
      : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', target]]
        : ['xdg-open', [target]];
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsHide: true, windowsVerbatimArguments: true }).on('error', () => {}).unref();
  } catch { /* الرابط معروض في الطرفية */ }
}
module.exports = { openTarget };
