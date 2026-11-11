// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// المحركات والنماذج الإضافية، والمهام الطويلة (التقدّم والإلغاء)، وملفات Pyodide للمتصفح.
'use strict';
const path = require('path');
const { send, fail, ndjson, sendFile } = require('../http');
const addons = require('../addons');
const jobs = require('../jobs');
const { within } = require('../fsx');
const log = require('../log');

module.exports = function routes(r) {
  r.add('GET', '/api/addons', (c) => send(c.res, 200, addons.listAll()));

  r.add('POST', '/api/addons/:id/install', (c) => {
    const id = c.params.id;
    const cat = addons.loadCatalog();
    const isEngine = !!cat.engines[id]; const isModel = !!cat.models[id];
    if (!isEngine && !isModel) return fail(c.res, 404, 'unknown_addon');
    const existing = jobs.running('addon', id);
    if (existing) return send(c.res, 200, existing);
    const label = isEngine ? cat.engines[id].name : cat.models[id].name;
    const job = jobs.create('addon', label, async ({ update, signal }) => {
      const res = isEngine ? await addons.installEngine(id, { update, signal }) : await addons.installModel(id, { update, signal });
      log.info('addon installed', { id });
      return res;
    }, { key: id });
    send(c.res, 202, job);
  });

  r.add('DELETE', '/api/addons/:id', (c) => send(c.res, addons.uninstall(c.params.id) ? 200 : 404, { ok: true }));

  r.add('GET', '/api/jobs', (c) => send(c.res, 200, { jobs: jobs.list(c.url.searchParams.get('kind') || undefined) }));
  r.add('GET', '/api/jobs/:id', (c) => { const j = jobs.get(c.params.id); return j ? send(c.res, 200, j) : fail(c.res, 404, 'not_found'); });
  r.add('POST', '/api/jobs/:id/cancel', (c) => send(c.res, 200, { ok: jobs.cancel(c.params.id) }));
  // بث تقدّم مهمة حتى اكتمالها
  r.add('GET', '/api/jobs/:id/stream', (c) => {
    const j = jobs.get(c.params.id);
    if (!j) return fail(c.res, 404, 'not_found');
    const out = ndjson(c.res);
    out.write(j);
    if (j.status !== 'running') return out.end();
    let last = 0;
    const off = jobs.subscribe(j.id, (job) => {
      const now = Date.now();
      if (job.status !== 'running') { off(); return out.end(job); }
      if (now - last > 200) { last = now; out.write(job); }
    });
    c.res.on('close', off);
  });

  // ملفات Pyodide تُخدَّم للمتصفح من CAF_HOME (نفس الأصل، بلا CDN)
  r.add('GET', /^\/runtime\/pyodide\/(?<file>[\w.-]+)$/, (c) => {
    const dir = addons.engineDir('pyodide');
    const f = within(dir, c.params.file);
    if (!f || c.params.file.startsWith('.')) return fail(c.res, 404, 'not_found');
    sendFile(c.req, c.res, f, { 'Cache-Control': 'public, max-age=604800', ...(path.extname(f) === '.mjs' ? { 'Content-Type': 'text/javascript; charset=utf-8' } : {}) });
  }, { public: true });
};
