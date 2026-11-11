// CAF AI · اختبارات المهارات: صيغة SKILL.md والوكلاء، الاختيار التلقائي، الاستيراد، والحقن في تعليمات النظام.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, parseNdjson } = require('./helpers/server');

process.env.CAF_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'caf-skills-'));
const skills = require('../app/lib/skills');

test('frontmatter parsing follows the Agent Skills spec (name, description, metadata map)', () => {
  const { meta, body } = skills.parseFrontmatter('---\nname: pdf-tools\ndescription: "Works with PDFs."\nmetadata:\n  author: x\n  version: "1.0"\n---\n# Body');
  assert.equal(meta.name, 'pdf-tools'); assert.equal(meta.description, 'Works with PDFs.');
  assert.deepEqual(meta.metadata, { author: 'x', version: '1.0' }); assert.equal(body.trim(), '# Body');
});

test('bundled skills load and auto-select by Arabic triggers', () => {
  const all = skills.all({ fresh: true });
  assert.ok(all.filter((s) => s.source === 'caf').length >= 13);
  assert.ok(all.filter((s) => s.source === 'community').length >= 15);
  assert.equal(skills.autoSelect('لخّص لي هذا المقال')[0]?.id, 'caf/summarizer');
  assert.equal(skills.autoSelect('راجع الكود وابحث عن ثغرات', 'code')[0]?.id, 'caf/code-reviewer');
  assert.equal(skills.autoSelect('ما عاصمة اليابان؟').length, 0, 'no skill for plain questions');
  const p = skills.promptFor([skills.get('caf/summarizer')], { numCtx: 4096 });
  assert.match(p, /المهارة المفعّلة: الملخّص/);
});

test('import a folder of agent .md files (Agency-Agents style), disable, remove', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-'));
  fs.mkdirSync(path.join(src, 'design'));
  fs.writeFileSync(path.join(src, 'design', 'ui-designer.md'), '---\nname: UI Designer\ndescription: Designs beautiful interfaces\nemoji: 🎨\n---\n# UI Designer\nYou are a designer. ' + 'x'.repeat(20000));
  fs.writeFileSync(path.join(src, 'README.md'), '# not a skill');
  const r = skills.importFolder(src, 'agency');
  assert.equal(r.imported, 1);
  const s = skills.get('agency/ui-designer');
  assert.equal(s.emoji, '🎨');
  const p = skills.promptFor([s], { numCtx: 4096 });
  assert.ok(p.length < 6000, 'long agents are trimmed to fit the context');
  assert.match(p, /مختصر ليناسب/);
  skills.setState({ disabled: ['agency/ui-designer'] });
  assert.ok(!skills.enabled().some((x) => x.id === 'agency/ui-designer'));
  assert.ok(skills.removeCollection('agency'));
  assert.equal(skills.get('agency/ui-designer'), null);
});

test('chat injects the chosen skill and reports it in meta', async () => {
  const S = await startServer();
  try {
    const r = await S.api('POST', '/api/chat', { body: { model: 'qwen2.5:7b', messages: [{ role: 'user', content: 'مرحبا' }], skills: ['caf/translator'] } });
    const lines = parseNdjson(r.text);
    assert.equal(lines[0].meta.skills[0].id, 'caf/translator');
    const sent = S.mock.calls.filter((c) => c.path === '/api/chat').at(-1).body;
    assert.match(sent.messages[0].content, /المترجم المحترف/);
    const auto = parseNdjson((await S.api('POST', '/api/chat', { body: { model: 'qwen2.5:7b', messages: [{ role: 'user', content: 'لخص لي النص التالي' }] } })).text);
    assert.equal(auto[0].meta.skills[0].id, 'caf/summarizer');
    assert.equal(auto[0].meta.skills[0].auto, true);
    const list = await S.api('GET', '/api/skills');
    assert.ok(list.json.skills.length >= 28);
  } finally { await S.stop(); }
});

test('edit a bundled skill → saved as an override, original untouched, reset restores it', () => {
  const orig = skills.get('caf/code-reviewer');
  const origRaw = fs.readFileSync(orig.file, 'utf8');
  const s = skills.save('caf/code-reviewer', { nameAr: 'مراجع الكود: المحترف', nameEn: orig.nameEn, description: 'يراجع الكود # بدقة', emoji: '🔍', triggers: ['راجع الكود', 'code review'], command: 'review', workspaces: ['code'] }, '# مراجعة\nنص جديد');
  assert.equal(s.id, 'caf/code-reviewer', 'id is stable');
  assert.equal(s.edited, true); assert.equal(s.nameAr, 'مراجع الكود: المحترف'); assert.equal(s.description, 'يراجع الكود # بدقة');
  assert.deepEqual(s.triggers, ['راجع الكود', 'code review']); assert.deepEqual(s.workspaces, ['code']);
  assert.equal(s.body, '# مراجعة\nنص جديد');
  assert.equal(fs.readFileSync(orig.file, 'utf8'), origRaw, 'bundled file is never modified');
  assert.ok(s.file.startsWith(skills.USER), 'override lives in CAF_HOME');
  const r = skills.removeSkill('caf/code-reviewer');
  assert.equal(r.reset, true); assert.equal(skills.get('caf/code-reviewer').edited, undefined);
  assert.throws(() => skills.removeSkill('caf/code-reviewer'), { code: 'BUNDLED' });
});

test('edit keeps unknown agent keys, validation is explicit (no silent truncation), create and delete', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'agents2-'));
  fs.writeFileSync(path.join(src, 'growth.md'), '---\nname: Growth Hacker\ndescription: Grows things\ncolor: green\nemoji: 🚀\nvibe: Fast.\n---\n# Growth\nBody');
  skills.importFolder(src, 'agency2');
  const s = skills.save('agency2/growth-hacker', { nameAr: 'خبير النمو', nameEn: 'Growth Hacker', description: 'ينمّي المنتجات', emoji: '📈', triggers: [], command: '', workspaces: ['chat', 'code', 'docs', 'images'] }, '# Growth\nNew body');
  const raw = fs.readFileSync(s.file, 'utf8');
  assert.match(raw, /^color: green$/m); assert.match(raw, /^vibe: Fast\.$/m); assert.match(raw, /^emoji: 📈$/m);
  assert.match(raw, /^name: Growth Hacker$/m); assert.match(raw, /ar-name: خبير النمو/);
  assert.equal(s.nameAr, 'خبير النمو'); assert.equal(s.emoji, '📈');
  assert.throws(() => skills.save('agency2/growth-hacker', { nameAr: 'x', description: 'd'.repeat(1025), workspaces: ['chat'] }, 'b'), (e) => e.code === 'INVALID' && e.errors.description === 'too_long');
  assert.throws(() => skills.save('agency2/growth-hacker', { nameAr: 'x', description: 'ok', command: 'Bad Cmd', workspaces: [] }, ''), (e) => e.errors.command === 'bad_command' && e.errors.workspaces === 'required' && e.errors.body === 'required');
  const n = skills.create({ nameAr: 'مساعد العقود', nameEn: 'Contract Helper', description: 'يكتب العقود', emoji: '📜', triggers: ['عقد'], command: 'contract', workspaces: ['chat', 'docs'] }, '# العقود\nاكتب عقدًا واضحًا.');
  assert.equal(n.id, 'my-skills/contract-helper'); assert.equal(n.command, 'contract');
  assert.equal(skills.create({ nameAr: 'مساعد العقود', nameEn: 'Contract Helper', description: 'x', workspaces: ['chat'] }, 'b').id, 'my-skills/contract-helper-2', 'no overwrite');
  assert.equal(skills.removeSkill('my-skills/contract-helper').removed, true);
  assert.equal(skills.get('my-skills/contract-helper'), null);
});

test('auto-select respects the workspace: the Arabic writer does not hijack code requests', () => {
  assert.equal(skills.autoSelect('اكتب مقالًا عن القهوة', 'chat')[0]?.id, 'caf/arabic-writer');
  assert.notEqual(skills.autoSelect('اكتب لي صفحة هبوط بـ html و css', 'code')[0]?.id, 'caf/arabic-writer');
});
