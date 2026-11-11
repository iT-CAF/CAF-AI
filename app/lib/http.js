// CAF AI · © 2026 كآف · iT CAF — by CAF. جميع الحقوق محفوظة. انظر LICENSE.
'use strict';
const fs = require('fs');
const path = require('path');
const { appHeaders } = require('./security');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.wav': 'audio/wav', '.zip': 'application/zip',
  '.whl': 'application/zip', '.data': 'application/octet-stream', '.tar': 'application/x-tar', '.pdf': 'application/pdf',
};
const mimeOf = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

function send(res, code, body, headers = {}) {
  if (res.headersSent) { try { res.end(); } catch { /* */ } return; }
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, {
    ...appHeaders(),
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

// خطأ موحّد: code ثابت تترجمه الواجهة، وdetail للتشخيص
const fail = (res, status, code, detail) => send(res, status, { error: code, ...(detail ? { detail: String(detail).slice(0, 500) } : {}) });

function readBody(req, limit = 32 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let over = false;
    req.on('data', (c) => {
      if (over) return;
      size += c.length;
      if (size > limit) { over = true; const e = new Error('too large'); e.code = 'TOO_LARGE'; reject(e); req.resume(); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}
async function readJson(req, limit) {
  const b = await readBody(req, limit);
  if (!b.length) return {};
  try { return JSON.parse(b.toString('utf8')); } catch { const e = new Error('bad json'); e.code = 'BAD_JSON'; throw e; }
}

// إرسال ملف من القرص مع دعم Range (للصوت والصور الكبيرة)
function sendFile(req, res, file, headers = {}) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, { error: 'not_found' });
    const type = headers['Content-Type'] || mimeOf(file);
    const base = { ...appHeaders(), 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', ...headers };
    const range = req.headers.range && req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
    if (range) {
      let start = range[1] ? parseInt(range[1], 10) : 0;
      let end = range[2] ? parseInt(range[2], 10) : stat.size - 1;
      if (!range[1] && range[2]) { start = Math.max(0, stat.size - parseInt(range[2], 10)); end = stat.size - 1; }
      if (start > end || start >= stat.size) { res.writeHead(416, { ...base, 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      end = Math.min(end, stat.size - 1);
      res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...base, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// بث NDJSON إلى المتصفح
function ndjson(res, headers = {}) {
  res.writeHead(200, { ...appHeaders(), 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...headers });
  return {
    write: (obj) => { if (!res.writableEnded) res.write(JSON.stringify(obj) + '\n'); },
    end: (obj) => { if (!res.writableEnded) { if (obj) res.write(JSON.stringify(obj) + '\n'); res.end(); } },
  };
}

module.exports = { send, fail, readBody, readJson, sendFile, ndjson, mimeOf, MIME };
