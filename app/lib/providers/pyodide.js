// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// مزوّد تشغيل Python: Pyodide (WebAssembly) يعمل في المتصفح داخل Worker معزول. الخادم يحفظ ملفاته ويخدمها فقط.
'use strict';
const addons = require('../addons');

module.exports = {
  id: 'pyodide', name: 'Pyodide (Python)', capabilities: ['code-run'],
  async status() {
    const s = addons.engineStatus('pyodide');
    return { kind: 'browser', installed: s.installed, healthy: s.installed, ready: s.installed, version: s.installedVersion || s.version, path: s.path, size: s.size, detail: s.installed ? '' : 'not_installed' };
  },
};
