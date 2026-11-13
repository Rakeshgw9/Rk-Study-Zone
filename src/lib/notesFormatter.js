/* Image → Text block: turns raw OCR text into structured, editable lesson HTML.
 * Pure string code (no DOM, no imports) so it runs in the builder, in tests and anywhere else.
 * It NEVER summarises, translates or invents text — every OCR line is kept, in reading order. */

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BULLET_RE = /^\s*(?:[•●▪◦‣∙·*]|[-–—](?=\s))\s+(.*\S)\s*$/
const NUMBER_RE = /^\s*(?:\(?(\d{1,3}|[a-zA-Z]|[ivxIVX]{1,5})[.)])\s+(.*\S)\s*$/
const PIPE_RE = /\|/

/** Clean typical OCR noise without changing the words. */
export function cleanOcrText(text = '') {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t]+/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z\u0B00-\u0B7F])-\n([a-z\u0B00-\u0B7F])/g, '$1$2') // join words broken by a hyphen at line end
    .replace(/[ ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const wordCount = (s) => (s.trim().match(/\S+/g) || []).length
const isAllCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase() && !/[a-z]/.test(s)
const isTitleCase = (s) => { const w = s.match(/[A-Za-z][A-Za-z'’-]*/g) || []; return w.length > 0 && w.filter((x) => /^[A-Z]/.test(x) || x.length <= 3).length / w.length >= 0.8 }
const endsSentence = (s) => /[.!?।]["')\]]?$/.test(s.trim())

/** Is this single line probably a heading? (short, no sentence ending, caps / title-case / ends with ':') */
export function looksLikeHeading(line, { prevBlank = true, nextBlank = true } = {}) {
  const s = line.trim()
  if (!s || s.length > 90 || wordCount(s) > 12) return false
  if (BULLET_RE.test(s) || NUMBER_RE.test(s)) return false
  if (/^[\d\W]+$/.test(s)) return false
  if (endsSentence(s)) return false
  if (isAllCaps(s)) return true
  if (/:$/.test(s) && wordCount(s) <= 8) return true
  if (prevBlank && nextBlank && isTitleCase(s) && wordCount(s) <= 9) return true
  return prevBlank && wordCount(s) <= 6 && isTitleCase(s) && nextBlank
}

function splitCells(line) {
  if (PIPE_RE.test(line)) return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim())
  return line.trim().split(/\s{2,}|\t+/).map((c) => c.trim())
}

/** A run of ≥2 lines that all split into the same number (≥2) of cells is a table. */
function detectTable(lines, start) {
  const first = splitCells(lines[start])
  if (first.length < 2 || first.some((c, i) => !c && i !== 0 && i !== first.length - 1)) return null
  const cols = first.length
  const rows = [first]
  let i = start + 1
  while (i < lines.length && lines[i].trim()) {
    if (/^\s*\|?[\s:|-]{3,}\|?\s*$/.test(lines[i]) && /-/.test(lines[i])) { i++; continue } // markdown-style rule line
    const c = splitCells(lines[i])
    if (c.length !== cols) break
    rows.push(c); i++
  }
  return rows.length >= 2 ? { rows, end: i } : null
}

/**
 * OCR text → ordered list of blocks:
 *   { kind:'heading', text, level }   level 1 (chapter/ALL CAPS) | 2 (heading) | 3 (sub-heading)
 *   { kind:'paragraph', text }
 *   { kind:'list', ordered, items:[...] }
 *   { kind:'table', rows:[[...]] }
 */
export function structureOcrText(text) {
  const lines = cleanOcrText(text).split('\n')
  const out = []
  let para = []
  const flush = () => { if (para.length) { out.push({ kind: 'paragraph', text: para.join(' ').replace(/\s+/g, ' ').trim() }); para = [] } }
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]; const line = raw.trim()
    if (!line) { flush(); i++; continue }

    const tbl = detectTable(lines, i)
    if (tbl) { flush(); out.push({ kind: 'table', rows: tbl.rows }); i = tbl.end; continue }

    const b = BULLET_RE.exec(line); const n = NUMBER_RE.exec(line)
    if (b || n) {
      flush()
      const ordered = !!n; const items = []
      while (i < lines.length) {
        const l = lines[i].trim()
        if (!l) break
        const mb = BULLET_RE.exec(l); const mn = NUMBER_RE.exec(l)
        if (ordered ? mn : mb) items.push((ordered ? mn[2] : mb[1]).trim())
        else if (!mb && !mn && items.length) items[items.length - 1] += ` ${l}` // wrapped item line
        else break
        i++
      }
      out.push({ kind: 'list', ordered, items })
      continue
    }

    const prevBlank = i === 0 || !lines[i - 1].trim()
    const nextBlank = i === lines.length - 1 || !lines[i + 1].trim()
    if (!para.length && looksLikeHeading(line, { prevBlank, nextBlank })) {
      const first = !out.some((x) => x.kind === 'heading')
      const level = first && (isAllCaps(line) || prevBlank) ? 1 : /:$/.test(line) ? 3 : isAllCaps(line) ? 2 : 2
      out.push({ kind: 'heading', text: line.replace(/:$/, '').trim(), level })
      i++; continue
    }
    para.push(line); i++
  }
  flush()
  return out
}

/** Structured blocks → { heading, body } for the existing "heading-paragraph" block fields.
 *  The first heading becomes the block heading; everything else becomes safe rich-text HTML
 *  (only tags the existing sanitizer allows: h3/h4, p, ul/ol/li, table/tr/th/td). */
export function blocksToBlockData(blocks, { useFirstHeading = true } = {}) {
  let heading = ''
  const list = blocks.slice()
  if (useFirstHeading && list[0]?.kind === 'heading') heading = list.shift().text
  const html = list.map((b) => {
    if (b.kind === 'heading') return b.level <= 2 ? `<h3>${esc(b.text)}</h3>` : `<h4>${esc(b.text)}</h4>`
    if (b.kind === 'paragraph') return `<p>${esc(b.text)}</p>`
    if (b.kind === 'list') { const t = b.ordered ? 'ol' : 'ul'; return `<${t}>${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</${t}>` }
    if (b.kind === 'table') {
      const [head, ...rest] = b.rows
      return `<table><thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rest.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    }
    return ''
  }).join('')
  return { heading: heading ? esc(heading) : '', body: html }
}

export const textToBlockData = (text, opts) => blocksToBlockData(structureOcrText(text), opts)

/** "1-3, 5, 8-9" → [1,2,3,5,8,9] (clamped to 1..max, in the written order, no duplicates). Returns null if invalid. */
export function parsePageRange(input, max) {
  const s = String(input || '').trim()
  if (!s) return Array.from({ length: max }, (_, i) => i + 1)
  const out = []
  for (const part of s.split(',')) {
    const m = /^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/.exec(part)
    if (!m) return null
    const a = Number(m[1]); const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b < a || b > max) return null
    for (let p = a; p <= b; p++) if (!out.includes(p)) out.push(p)
  }
  return out.length ? out : null
}

/** Simple quality warnings for the teacher (never blocks the result). */
export function ocrWarnings({ text, confidence, pageNo }) {
  const w = []; const label = pageNo ? `Page ${pageNo}: ` : ''
  if (!String(text || '').trim()) w.push(`${label}no readable text was found. Try a sharper, brighter, straight-on photo.`)
  else if (typeof confidence === 'number' && confidence < 60) w.push(`${label}low confidence (${Math.round(confidence)}%). Please check the text carefully.`)
  return w
}
