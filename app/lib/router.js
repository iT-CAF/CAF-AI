// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// موجّه مسارات HTTP بسيط: add(method, path|RegExp, handler, opts)
'use strict';

function createRouter() {
  const routes = [];
  function add(method, pattern, handler, opts = {}) {
    let re; const keys = [];
    if (pattern instanceof RegExp) re = pattern;
    else re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, opts });
  }
  function match(method, pathname) {
    let pathHit = false;
    for (const r of routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathHit = true;
      if (r.method !== method && !(r.method === 'GET' && method === 'HEAD')) continue;
      const params = {};
      if (r.keys.length) r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      else if (m.groups) Object.assign(params, m.groups);
      return { route: r, params };
    }
    return pathHit ? { methodNotAllowed: true } : null;
  }
  return { add, match, routes };
}

module.exports = { createRouter };
