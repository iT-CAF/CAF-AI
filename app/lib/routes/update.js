// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const { send, fail } = require('../http');
const updater = require('../updater');
const jobs = require('../jobs');

module.exports = function routes(r, ctx) {
  r.add('GET', '/api/update/check', async (c) => {
    try { send(c.res, 200, await updater.check()); } catch (e) { fail(c.res, 502, 'update_check_failed', e.message); }
  });
  r.add('POST', '/api/update/apply', (c) => {
    const existing = jobs.running('update');
    if (existing) return send(c.res, 202, existing);
    const job = jobs.create('update', 'CAF AI', async ({ update, signal }) => {
      const res = await updater.apply({ update, signal });
      setTimeout(() => updater.restart(ctx.shutdown), 800); // بعد أن يستلم المتصفح نهاية المهمة
      return res;
    });
    send(c.res, 202, job);
  });
};
