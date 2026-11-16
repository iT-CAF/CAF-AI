/* CAF AI · © 2026 كآف · iT CAF — جميع الحقوق محفوظة. */
// مولّد رموز QR محلي بلا مكتبات (ISO/IEC 18004): وضع البايت، تصحيح أخطاء M، الإصدارات 1–10، واختيار القناع الأفضل.
// يُستخدم في صفحة «الوصول» ليمسح الجوال الرابط مباشرة — لا يُرسل الرابط لأي خدمة خارجية.

const EC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // مستوى M
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VER = 10;

// ---- الحقل GF(256) بكثير الحدود 0x11D ----
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift(); r.push(0);
    for (let i = 0; i < div.length; i++) r[i] ^= gfMul(div[i], f);
  }
  return r;
}

const rawModules = (v) => {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) { const a = Math.floor(v / 7) + 2; n -= (25 * a - 10) * a - 55; if (v >= 7) n -= 36; }
  return n;
};
const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - EC_PER_BLOCK[v] * NUM_BLOCKS[v];
function alignPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2; const size = v * 4 + 17;
  const step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
  return out;
}

// ---- ترميز البيانات إلى كلمات ----
function encodeData(bytes) {
  let ver = 0;
  for (let v = 1; v <= MAX_VER; v++) {
    const cc = v <= 9 ? 8 : 16;
    if (4 + cc + bytes.length * 8 <= dataCodewords(v) * 8) { ver = v; break; }
  }
  if (!ver) throw new Error('qr_too_long');
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; words.push(b); }
  return { ver, words };
}
function addEcc(ver, data) {
  const nb = NUM_BLOCKS[ver]; const ecLen = EC_PER_BLOCK[ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nb - (raw % nb); const shortLen = Math.floor(raw / nb);
  const div = rsDivisor(ecLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecLen + (i < nShort ? 0 : 1)); k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) if (i !== shortLen - ecLen || j >= nShort) out.push(blocks[j][i]);
  }
  return out;
}

// ---- رسم المصفوفة ----
function build(ver, codewords) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx; const y = cy + dy; const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  }
  const al = alignPositions(ver); const last = al.length - 1;
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask) => {
    const data = (0 << 3) | mask; // M = 00
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const b = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, b(i));
    set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1; const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
      set(a, b, dark); set(b, a, dark);
    }
  }
  // البيانات بنمط متعرّج من الأسفل يمينًا
  let i = 0; const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j; const up = ((right + 1) & 2) === 0; const y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < total) { m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
      }
    }
  }
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
  let best = 0; let bestScore = Infinity;
  for (let k = 0; k < 8; k++) {
    applyMask(k); drawFormat(k);
    const s = penalty(m, size);
    if (s < bestScore) { bestScore = s; best = k; }
    applyMask(k);
  }
  applyMask(best); drawFormat(best);
  return m;
}

// عقوبات القناع (القواعد الأربع في المواصفة)
function penalty(m, size) {
  let score = 0; let dark = 0;
  const line = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1; const seq = [];
      for (let b = 0; b < size; b++) {
        const v = get(a, b); seq.push(v ? 1 : 0);
        if (b > 0) { if (v === get(a, b - 1)) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1; }
      }
      const s = seq.join('');
      for (const pat of ['10111010000', '00001011101']) { let p = s.indexOf(pat); while (p >= 0) { score += 40; p = s.indexOf(pat, p + 1); } }
    }
  };
  line((y, x) => m[y][x]); line((x, y) => m[y][x]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x < size - 1 && y < size - 1) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3; }
  }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  const { ver, words } = encodeData(bytes);
  return { ver, size: ver * 4 + 17, modules: build(ver, addEcc(ver, words)) };
}

// SVG بمسار واحد، بهامش هادئ 4 وحدات (يتطلبه الماسح)
export function qrSvg(text, { margin = 4, label = '' } = {}) {
  const { size, modules } = qrMatrix(text);
  const dim = size + margin * 2; let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) d += `M${x + margin} ${y + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img"${label ? ` aria-label="${label.replace(/"/g, '&quot;')}"` : ''}><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#0E1113"/></svg>`;
}
