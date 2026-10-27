// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { P } = require('./paths');
const ui = require('./ui');

const PRESETS = () => [
  { k: '1', name: 'qwen2.5:7b', size: '4.7 GB', ram: '8 GB', tag: ui.tr('موصى به', 'recommended'), desc: ui.tr('الأفضل للعربية والبرمجة', 'best for Arabic & code') },
  { k: '2', name: 'gemma3:4b', size: '3.3 GB', ram: '6 GB', tag: ui.tr('متوازن', 'balanced'), desc: ui.tr('خفيف وجيد بالعربية', 'light, good Arabic') },
  { k: '3', name: 'llama3.2:3b', size: '2.0 GB', ram: '4 GB', tag: ui.tr('سريع', 'fast'), desc: ui.tr('للأجهزة المتواضعة', 'for modest machines') },
  { k: '4', name: 'qwen2.5:3b', size: '1.9 GB', ram: '4 GB', tag: ui.tr('سريع', 'fast'), desc: ui.tr('صغير بدعم عربي مقبول', 'small, decent Arabic') },
  { k: '5', name: 'qwen2.5:14b', size: '9.0 GB', ram: '16 GB', tag: ui.tr('أقوى', 'powerful'), desc: ui.tr('جودة أعلى للأجهزة القوية', 'higher quality, strong PCs') },
];

// النماذج المثبّتة من ملفات manifests مباشرة (بدون تشغيل المحرك)
function listInstalled() {
  const base = path.join(P.models, 'manifests');
  const out = [];
  const dirs = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  for (const host of dirs(base)) {
    if (!host.isDirectory()) continue;
    for (const ns of dirs(path.join(base, host.name))) {
      if (!ns.isDirectory()) continue;
      for (const model of dirs(path.join(base, host.name, ns.name))) {
        if (!model.isDirectory()) continue;
        for (const tag of dirs(path.join(base, host.name, ns.name, model.name))) {
          if (!tag.isFile()) continue;
          let size = 0;
          try {
            const m = JSON.parse(fs.readFileSync(path.join(base, host.name, ns.name, model.name, tag.name), 'utf8'));
            size = (m.layers || []).reduce((a, l) => a + (l.size || 0), 0) + (m.config?.size || 0);
          } catch { /* */ }
          const prefix = host.name === 'registry.ollama.ai' ? (ns.name === 'library' ? '' : ns.name + '/') : `${host.name}/${ns.name}/`;
          out.push({ name: `${prefix}${model.name}:${tag.name}`, size });
        }
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
const gb = (n) => (n / 1073741824).toFixed(1) + ' GB';

function bar(pct) { const n = Math.max(0, Math.min(25, Math.floor(pct / 4))); return ui.amber('█'.repeat(n)) + ui.gray('░'.repeat(25 - n)); }

function pull(name, port) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify({ name, stream: true }));
    const req = http.request({ host: '127.0.0.1', port, path: '/api/pull', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
      let buf = ''; let failed = null; let last = 0;
      res.on('data', (c) => {
        buf += c.toString('utf8'); let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          try {
            const j = JSON.parse(line);
            if (j.error) failed = j.error;
            else if (j.total && j.completed && process.stdout.isTTY && Date.now() - last > 150) {
              last = Date.now();
              const pct = Math.floor((j.completed / j.total) * 100);
              process.stdout.write(`\r  ${bar(pct)} ${String(pct).padStart(3)}%  ${(j.completed / 1073741824).toFixed(2)}/${(j.total / 1073741824).toFixed(2)} GB   `);
            }
          } catch { /* */ }
        }
      });
      res.on('end', () => { if (process.stdout.isTTY) process.stdout.write('\n'); resolve(failed); });
    });
    req.on('error', (e) => resolve(e.message));
    req.write(data); req.end();
  });
}

module.exports = { PRESETS, listInstalled, pull, gb };
