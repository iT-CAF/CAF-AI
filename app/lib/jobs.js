// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// سجل المهام الطويلة (تثبيت محرك، تنزيل نموذج إضافي، توليد صورة، فهرسة مستند) مع التقدّم والإلغاء.
'use strict';
const { newId } = require('./fsx');

const jobs = new Map();
const listeners = new Map();

function create(kind, label, run, meta = {}) {
  const id = newId();
  const ac = new AbortController();
  const job = { id, kind, label, meta, status: 'running', progress: { completed: 0, total: 0, text: '' }, error: null, result: null, started: Date.now(), ended: 0 };
  jobs.set(id, { job, ac });
  const notify = () => { for (const fn of listeners.get(id) || []) { try { fn(job); } catch { /* */ } } };
  const update = (p) => { Object.assign(job.progress, p); notify(); };
  Promise.resolve().then(() => run({ update, signal: ac.signal, job })).then((result) => {
    job.status = 'done'; job.result = result ?? null;
  }).catch((e) => {
    job.status = ac.signal.aborted || e.code === 'CANCELED' ? 'canceled' : 'error';
    job.error = { code: String(e.code || 'failed').toLowerCase(), detail: String(e.message || e).slice(0, 400) };
  }).finally(() => {
    job.ended = Date.now(); notify(); listeners.delete(id);
    setTimeout(() => jobs.delete(id), 30 * 60 * 1000); // تبقى النتيجة نصف ساعة
  });
  return job;
}

const get = (id) => jobs.get(id)?.job || null;
const list = (kind) => [...jobs.values()].map((x) => x.job).filter((j) => !kind || j.kind === kind);
function cancel(id) { const x = jobs.get(id); if (!x || x.job.status !== 'running') return false; x.ac.abort(); return true; }
function subscribe(id, fn) {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id).add(fn);
  return () => listeners.get(id)?.delete(fn);
}
const running = (kind, key) => list(kind).find((j) => j.status === 'running' && (!key || j.meta.key === key)) || null;

module.exports = { create, get, list, cancel, subscribe, running };
