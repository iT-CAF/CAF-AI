// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// «جهازي» والكتالوج والتوصيات.
'use strict';
const { send, fail } = require('../http');
const hardware = require('../hardware');
const catalog = require('../catalog');
const ollama = require('../providers/ollama');
const engine = require('../engine');
const log = require('../log');

module.exports = function hw(r) {
  // القياس الأول في الخلفية عند التشغيل
  if (!hardware.cached()) hardware.measure().catch((e) => log.warn('hardware measure failed', { err: e.message }));

  r.add('GET', '/api/hardware', async (c) => {
    const data = await hardware.get({ refresh: c.url.searchParams.get('refresh') === '1' });
    let ollamaVersion = '';
    try { if (engine.getPort()) ollamaVersion = await ollama.version(); } catch { /* */ }
    send(c.res, 200, { ...data, engine: { ollama: ollamaVersion, external: engine.isExternal() }, budget: catalog.budget(data) });
  });

  r.add('GET', '/api/catalog', async (c) => {
    const hw = await hardware.get();
    let installed = [];
    try { await engine.ensureEngine(); installed = (await ollama.listModels({ withCaps: false })).map((m) => m.name); } catch { /* المحرك متوقف: نعرض الكتالوج بدون حالة التثبيت */ }
    const cat = catalog.load();
    send(c.res, 200, {
      version: cat.version, origin: cat.origin, verified: cat.verified,
      models: catalog.annotate(cat, hw, installed), recommendations: catalog.recommend(hw, installed, cat),
      budget: catalog.budget(hw), tier: hw.tier,
    });
  });

  // المساحة المستخدمة في CAF_HOME (والنماذج إن كانت في مجلد Ollama المشترك)
  r.add('GET', '/api/storage', (c) => {
    const { P } = require('../paths');
    const { dirSize, freeSpace } = require('../fsx');
    const path = require('path');
    const inHome = path.resolve(P.models).startsWith(path.resolve(P.home) + path.sep);
    const models = dirSize(P.models); const extras = dirSize(P.extras); const data = dirSize(P.data);
    const runtime = dirSize(P.runtime); const eng = dirSize(P.engine);
    const fs = freeSpace(P.home);
    send(c.res, 200, {
      home: P.home, modelsDir: P.models, sharedModels: !inHome,
      models, extras, data, runtime: { bytes: runtime.bytes + eng.bytes, files: runtime.files + eng.files },
      totalBytes: models.bytes + extras.bytes + data.bytes + runtime.bytes + eng.bytes, freeBytes: fs.free,
    });
  });

  r.add('POST', '/api/catalog/update', async (c) => {
    try { send(c.res, 200, await catalog.update()); }
    catch (e) { fail(c.res, 502, 'catalog_update_failed', e.message); }
  });
};
