// CAF AI · © 2026 كآف · iT CAF — يبني app/web/vendor من حزم npm مثبّتة الإصدار.
// Dev-time only. Usage:  cd tools/vendor && npm ci && node build.mjs
// (or: node build.mjs --modules /path/to/node_modules)
// The output is committed so end users never need npm, a network connection or a CDN.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const argi = process.argv.indexOf('--modules');
const NM = argi > 0 ? path.resolve(process.argv[argi + 1]) : path.join(here, 'node_modules');
const OUT = path.resolve(here, '..', '..', 'app', 'web', 'vendor');
const req = createRequire(path.join(NM, 'x.js'));
const pkgVer = (n) => JSON.parse(fs.readFileSync(path.join(NM, n, 'package.json'), 'utf8')).version;

const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.copyFileSync(path.join(NM, from), path.join(OUT, to)); };
const copyDir = (from, to, filter = () => true) => {
  for (const f of fs.readdirSync(path.join(NM, from))) if (filter(f)) copy(path.join(from, f), path.join(to, f));
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// highlight.js — الحزمة الشائعة (~40 لغة)
copy('@highlightjs/cdn-assets/highlight.min.js', 'hljs/highlight.min.js');
copy('@highlightjs/cdn-assets/LICENSE', 'hljs/LICENSE');

// KaTeX — خطوط woff2 فقط
copy('katex/dist/katex.min.js', 'katex/katex.min.js');
copy('katex/dist/katex.min.css', 'katex/katex.min.css');
copyDir('katex/dist/fonts', 'katex/fonts', (f) => f.endsWith('.woff2'));
copy('katex/LICENSE', 'katex/LICENSE');

// Mermaid — ملف واحد يُحمَّل عند الحاجة فقط
copy('mermaid/dist/mermaid.min.js', 'mermaid/mermaid.min.js');
copy('mermaid/LICENSE', 'mermaid/LICENSE');

// pdf.js — بدون خرائط CJK وبدون محرك سكربتات PDF
copy('pdfjs-dist/build/pdf.min.mjs', 'pdfjs/pdf.min.mjs');
copy('pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.mjs');
copyDir('pdfjs-dist/wasm', 'pdfjs/wasm', (f) => !f.startsWith('quickjs') && !f.includes('nowasm'));
copy('pdfjs-dist/LICENSE', 'pdfjs/LICENSE');

// CodeMirror 6 — حزمة ESM واحدة
const esbuild = req('esbuild');
await esbuild.build({
  entryPoints: [path.join(here, 'cm-entry.js')],
  bundle: true, format: 'esm', minify: true, target: 'es2020', legalComments: 'none',
  nodePaths: [NM], outfile: path.join(OUT, 'codemirror', 'codemirror.min.mjs'), logLevel: 'warning',
});
copy('codemirror/LICENSE', 'codemirror/LICENSE');

const versions = {
  'highlight.js': pkgVer('@highlightjs/cdn-assets'), katex: pkgVer('katex'), mermaid: pkgVer('mermaid'),
  'pdfjs-dist': pkgVer('pdfjs-dist'), codemirror: pkgVer('codemirror'), '@codemirror/view': pkgVer('@codemirror/view'),
  '@codemirror/merge': pkgVer('@codemirror/merge'),
};
fs.writeFileSync(path.join(OUT, 'VERSIONS.json'), JSON.stringify(versions, null, 2) + '\n');

let total = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else total += fs.statSync(f).size; } })(OUT);
console.log('vendor built →', OUT, (total / 1048576).toFixed(2), 'MB', versions);
