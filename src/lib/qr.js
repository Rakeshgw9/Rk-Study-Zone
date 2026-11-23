/* Tiny dependency-free QR code generator (byte mode, error-correction level M, versions 1-10 → up to ~213 chars).
   Returns a boolean matrix; qrSvg() turns it into an inline SVG string. */
const EC = { // [ecBytesPerBlock, blocks1, dataPerBlock1, blocks2, dataPerBlock2] for level M
  1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0], 5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39], 9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44],
}
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] }

const EXP = new Array(512)
const LOG = new Array(256)
;(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] })()
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0)

function rsGenerator(n) {
  let g = [1]
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]) }
    g = next
  }
  return g
}
function rsRemainder(data, n) {
  const gen = rsGenerator(n)
  const rem = new Array(n).fill(0)
  for (const d of data) {
    const f = d ^ rem.shift()
    rem.push(0)
    if (f) for (let i = 0; i < n; i++) rem[i] ^= mul(gen[i + 1], f)
  }
  return rem
}

function utf8(str) { return Array.from(new TextEncoder().encode(str)) }

function pickVersion(len) {
  for (let v = 1; v <= 10; v++) {
    const [, b1, d1, b2, d2] = EC[v]
    const cap = b1 * d1 + b2 * d2
    const lenBits = v < 10 ? 8 : 16
    if (Math.ceil((4 + lenBits + len * 8) / 8) <= cap) return v
  }
  return 0
}

function buildCodewords(bytes, v) {
  const [ecLen, b1, d1, b2, d2] = EC[v]
  const cap = b1 * d1 + b2 * d2
  const bits = []
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1) }
  push(0b0100, 4)
  push(bytes.length, v < 10 ? 8 : 16)
  bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, cap * 8 - bits.length))
  while (bits.length % 8) bits.push(0)
  const data = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad)
  const blocks = []
  let pos = 0
  for (let i = 0; i < b1 + b2; i++) {
    const size = i < b1 ? d1 : d2
    const d = data.slice(pos, pos + size)
    pos += size
    blocks.push({ d, e: rsRemainder(d, ecLen) })
  }
  const out = []
  for (let i = 0; i < Math.max(d1, d2); i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]) })
  for (let i = 0; i < ecLen; i++) blocks.forEach((b) => out.push(b.e[i]))
  return out
}

function bchFormat(data) { // 5 data bits → 15-bit format string
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}
function bchVersion(v) {
  let rem = v
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25)
  return (v << 12) | rem
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

function makeMatrix(v, codewords, mask) {
  const n = v * 4 + 17
  const m = Array.from({ length: n }, () => new Array(n).fill(false))
  const fn = Array.from({ length: n }, () => new Array(n).fill(false)) // function-pattern cells
  const set = (r, c, val) => { m[r][c] = val; fn[r][c] = true }

  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const r = r0 + dr, c = c0 + dc
      if (r < 0 || c < 0 || r >= n || c >= n) continue
      const on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
      set(r, c, on)
    }
  }
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0)
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  const al = ALIGN[v]
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
  }
  set(n - 8, 8, true) // dark module
  // reserve format areas
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false) }
  for (let i = 0; i < 8; i++) { if (!fn[8][n - 1 - i]) set(8, n - 1 - i, false); if (!fn[n - 1 - i][8]) set(n - 1 - i, 8, false) }
  if (v >= 7) {
    const bits = bchVersion(v)
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1
      const a = Math.floor(i / 3), b = (i % 3) + n - 11
      set(a, b, bit); set(b, a, bit)
    }
  }
  // place data (zig-zag)
  const bitsArr = []
  codewords.forEach((cw) => { for (let i = 7; i >= 0; i--) bitsArr.push((cw >> i) & 1) })
  let idx = 0
  let up = true
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let k = 0; k < n; k++) {
      const r = up ? n - 1 - k : k
      for (let c = col; c >= col - 1; c--) {
        if (fn[r][c]) continue
        const bit = idx < bitsArr.length ? bitsArr[idx++] === 1 : false
        m[r][c] = bit !== MASKS[mask](r, c)
      }
    }
    up = !up
  }
  // format info (level M = 00)
  const f = bchFormat((0b00 << 3) | mask)
  const fb = (i) => ((f >> i) & 1) === 1
  for (let i = 0; i <= 5; i++) m[i][8] = fb(i)
  m[7][8] = fb(6); m[8][8] = fb(7); m[8][7] = fb(8)
  for (let i = 9; i < 15; i++) m[8][14 - i] = fb(i)
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = fb(i)
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = fb(i)
  m[n - 8][8] = true
  return m
}

function penalty(m) {
  const n = m.length
  let p = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      let run = 1
      for (let b = 1; b < n; b++) {
        const cur = pass ? m[b][a] : m[a][b]
        const prev = pass ? m[b - 1][a] : m[a][b - 1]
        if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++ } else run = 1
      }
    }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3
  let dark = 0
  m.forEach((row) => row.forEach((x) => { if (x) dark++ }))
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10
  return p
}

/** @returns {boolean[][]|null} module matrix, or null when the text is too long for this small encoder */
export function qrMatrix(text) {
  const bytes = utf8(String(text))
  const v = pickVersion(bytes.length)
  if (!v) return null
  const cw = buildCodewords(bytes, v)
  let best = null
  let bestP = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const m = makeMatrix(v, cw, mask)
    const p = penalty(m)
    if (p < bestP) { bestP = p; best = m }
  }
  return best
}

/** Inline SVG markup (dark modules on a white square with a 4-module quiet zone). */
export function qrSvg(text, { size = 168 } = {}) {
  const m = qrMatrix(text)
  if (!m) return null
  const n = m.length
  const q = 4
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + q} ${r + q}h1v1h-1z`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + q * 2} ${n + q * 2}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}
