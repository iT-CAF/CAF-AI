// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// المهارات: القائمة، التفعيل والإيقاف، العرض، الاستيراد من مجلد أو ملف، وحذف مجموعة مستوردة.
'use strict';
const { send, fail, readJson, readBody } = require('../http');
const skills = require('../skills');

module.exports = function routes(r) {
  r.add('GET', '/api/skills', (c) => {
    const st = skills.state(); const dis = new Set(st.disabled);
    send(c.res, 200, { auto: st.auto, userDir: skills.USER, skills: skills.all({ fresh: c.url.searchParams.get('fresh') === '1' }).map((s) => skills.summary(s, dis)) });
  });
  r.add('GET', '/api/skills/item', (c) => {
    const s = skills.get(c.url.searchParams.get('id') || '');
    return s ? send(c.res, 200, { ...skills.summary(s, new Set(skills.state().disabled)), body: s.body }) : fail(c.res, 404, 'not_found');
  });
  r.add('PUT', '/api/skills/state', async (c) => {
    const b = await readJson(c.req);
    const st = skills.state(); const dis = new Set(st.disabled);
    if (Array.isArray(b.toggle)) for (const { id, enabled } of b.toggle) { if (enabled) dis.delete(id); else dis.add(id); }
    send(c.res, 200, skills.setState({ disabled: [...dis], ...(typeof b.auto === 'boolean' ? { auto: b.auto } : {}) }));
  });
  r.add('POST', '/api/skills/import', async (c) => {
    const { path: p, name } = await readJson(c.req);
    try { send(c.res, 200, skills.importFolder(p, name)); }
    catch (e) { fail(c.res, 400, e.code === 'NO_SKILLS' ? 'no_skills' : e.code === 'NOT_FOUND' ? 'folder_not_found' : 'import_failed', e.message); }
  });
  r.add('POST', '/api/skills/upload', async (c) => {
    const text = (await readBody(c.req, 512 * 1024)).toString('utf8');
    try { send(c.res, 200, skills.importText(c.url.searchParams.get('name') || 'skill.md', text, c.url.searchParams.get('collection') || 'uploaded')); }
    catch (e) { fail(c.res, 400, 'bad_skill', e.message); }
  });
  r.add('DELETE', '/api/skills/collection/:coll', (c) => send(c.res, skills.removeCollection(c.params.coll) ? 200 : 404, { ok: true }));
};
