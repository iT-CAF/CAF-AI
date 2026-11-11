// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
// استخراج النص محليًا بلا اعتماديات: TXT/MD/CSV/TSV/JSON وDOCX وXLSX (ملف zip + XML). PDF يُستخرج في المتصفح عبر pdf.js.
'use strict';
const { zipGet, zipEntries } = require('./archive');

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s) => String(s).replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (_, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENT[e.toLowerCase()]));

// نص عادي: UTF-8 (مع BOM) وإلا Windows-1256 للملفات العربية القديمة
function decodeText(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) buf = buf.subarray(3);
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { /* ليس UTF-8 */ }
  try { return new TextDecoder('windows-1256').decode(buf); } catch { return buf.toString('latin1'); }
}

// CSV/TSV → صفوف (يدعم الاقتباس والأسطر داخل الخلايا)
function parseCsv(text, sep) {
  if (!sep) { const head = text.slice(0, 2000); sep = (head.match(/\t/g) || []).length > (head.match(/,/g) || []).length ? '\t' : (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ';' : ','; }
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------- DOCX ----------
function docxToMarkdown(buf) {
  const xml = zipGet(buf, 'word/document.xml');
  if (!xml) throw Object.assign(new Error('not a docx'), { code: 'BAD_DOC' });
  const body = xml.toString('utf8');
  const out = [];
  const paraText = (p) => {
    let s = '';
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g; let m;
    while ((m = re.exec(p))) s += m[1] !== undefined ? unxml(m[1]) : m[0].startsWith('<w:tab') ? '\t' : '\n';
    return s;
  };
  // نمر على الجداول والفقرات بالترتيب
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>/g; let m;
  while ((m = re.exec(body))) {
    const blk = m[0];
    if (blk.startsWith('<w:tbl')) {
      const rows = [...blk.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((r) => [...r[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) => [...c[0].matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) => paraText(p[0])).join(' ').replace(/\|/g, '\\|').trim()));
      if (rows.length) {
        const w = Math.max(...rows.map((r) => r.length));
        const pad = (r) => [...r, ...Array(w - r.length).fill('')];
        out.push(`| ${pad(rows[0]).join(' | ')} |\n|${' --- |'.repeat(w)}\n${rows.slice(1).map((r) => `| ${pad(r).join(' | ')} |`).join('\n')}`);
      }
      continue;
    }
    const text = paraText(blk).trim();
    if (!text) continue;
    const style = (/<w:pStyle w:val="([^"]+)"/.exec(blk) || [])[1] || '';
    const h = /^(Heading|heading|Title|عنوان)\s*(\d)?/.exec(style);
    if (h) out.push(`${'#'.repeat(Math.min(4, Number(h[2]) || 1))} ${text}`);
    else if (/<w:numPr>/.test(blk)) out.push(`- ${text}`);
    else out.push(text);
  }
  return out.join('\n\n');
}

// ---------- XLSX ----------
const colIndex = (ref) => { let n = 0; for (const ch of /^[A-Z]+/.exec(ref)[0]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
function xlsxSheets(buf, { maxRows = 100000 } = {}) {
  const wb = zipGet(buf, 'xl/workbook.xml');
  if (!wb) throw Object.assign(new Error('not an xlsx'), { code: 'BAD_DOC' });
  const rels = (zipGet(buf, 'xl/_rels/workbook.xml.rels') || Buffer.from('')).toString('utf8');
  const relMap = {};
  for (const r of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (/Id="([^"]+)"/.exec(r[0]) || [])[1]; const target = (/Target="([^"]+)"/.exec(r[0]) || [])[1];
    if (id && target) relMap[id] = target.replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const ssXml = (zipGet(buf, 'xl/sharedStrings.xml') || Buffer.from('')).toString('utf8');
  const shared = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => unxml(t[1])).join(''));
  const sheets = [];
  for (const s of wb.toString('utf8').matchAll(/<sheet\b[^>]*>/g)) {
    const name = unxml((/name="([^"]*)"/.exec(s[0]) || [])[1] || 'Sheet');
    const rid = (/r:id="([^"]+)"/.exec(s[0]) || [])[1];
    const path = relMap[rid] ? 'xl/' + relMap[rid] : null;
    const xml = path ? zipGet(buf, path) : null;
    if (!xml) continue;
    const rows = [];
    for (const r of xml.toString('utf8').matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      if (rows.length >= maxRows) break;
      const rnum = Number((/\br="(\d+)"/.exec(r[0]) || [])[1]) || rows.length + 1;
      const row = [];
      for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]; const inner = c[2] || '';
        const ref = (/\br="([A-Z]+)\d+"/.exec(attrs) || [])[1];
        const type = (/\bt="([^"]+)"/.exec(attrs) || [])[1] || 'n';
        const v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
        let val = '';
        if (type === 's') val = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') val = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => unxml(t[1])).join('');
        else if (type === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else val = v !== undefined ? unxml(v) : '';
        const f = (/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(inner) || [])[1];
        row[ref ? colIndex(ref) : row.length] = f && !val ? `=${unxml(f)}` : val;
      }
      while (rows.length < rnum - 1) rows.push([]);
      rows.push(Array.from(row, (x) => x ?? ''));
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

const rowsToMarkdown = (rows, max = 50) => {
  const take = rows.filter((r) => r.some((c) => String(c).trim())).slice(0, max);
  if (!take.length) return '';
  const w = Math.max(...take.map((r) => r.length));
  const fmt = (r) => `| ${Array.from({ length: w }, (_, i) => String(r[i] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`;
  return [fmt(take[0]), `|${' --- |'.repeat(w)}`, ...take.slice(1).map(fmt)].join('\n');
};

// الواجهة الموحدة: يعيد { kind, text, sheets?, chars }
function extract(buf, name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (ext === 'docx' || (isZip && zipEntries(buf).some((e) => e.name === 'word/document.xml'))) {
    const text = docxToMarkdown(buf);
    return { kind: 'docx', text, chars: text.length };
  }
  if (ext === 'xlsx' || ext === 'xlsm' || (isZip && zipEntries(buf).some((e) => e.name === 'xl/workbook.xml'))) {
    const sheets = xlsxSheets(buf);
    const text = sheets.map((s) => `## ${s.name}\n${rowsToMarkdown(s.rows, 100000)}`).join('\n\n');
    return { kind: 'xlsx', text, chars: text.length, sheets: sheets.map((s) => ({ name: s.name, rows: s.rows.slice(0, 200), nrows: s.rows.length, ncols: Math.max(0, ...s.rows.map((r) => r.length)) })) };
  }
  if (ext === 'pdf' || buf.subarray(0, 5).toString() === '%PDF-') throw Object.assign(new Error('pdf is extracted in the browser'), { code: 'PDF_CLIENT' });
  if (isZip) throw Object.assign(new Error('unsupported archive'), { code: 'UNSUPPORTED' });
  if (buf.subarray(0, 8000).includes(0)) throw Object.assign(new Error('binary file'), { code: 'UNSUPPORTED' });
  const text = decodeText(buf);
  if (ext === 'csv' || ext === 'tsv') {
    const rows = parseCsv(text, ext === 'tsv' ? '\t' : undefined);
    return { kind: 'csv', text: rowsToMarkdown(rows, 100000), chars: text.length, sheets: [{ name: name || 'CSV', rows: rows.slice(0, 200), nrows: rows.length, ncols: Math.max(0, ...rows.map((r) => r.length)) }] };
  }
  return { kind: ext === 'md' || ext === 'markdown' ? 'md' : 'txt', text, chars: text.length };
}

module.exports = { extract, decodeText, parseCsv, docxToMarkdown, xlsxSheets, rowsToMarkdown, unxml };
