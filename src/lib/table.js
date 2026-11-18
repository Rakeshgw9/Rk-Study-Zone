import { clone, uid } from './id'

/* Table block model.  rows[r].cells[c] = { t:'html', cs:1, rs:1, cov:false, st:{align,bg,color,size,weight,border,pad,valign} }
   A merged anchor has cs/rs > 1; the cells it covers keep cov:true so "Split" restores the grid. No undefined values (Firestore). */
export const newCell = (t = '') => ({ t, cs: 1, rs: 1, cov: false, st: {} })
export const DEFAULT_TABLE_STYLE = {
  theme: 'primary',
  headBg: '#2563eb',
  headColor: '#ffffff',
  border: '#cbd5e1',
  stripe: '#f1f5f9',
  bg: '#ffffff',
  color: '#0f172a',
  hover: '#e2e8f0',
  radius: 10,
  fontSize: 15,
  pad: 10,
  fontFamily: 'Inter',
  rowHeight: 0,
  titleColor: '#1e3a8a',
  captionColor: '#475569',
}

export const DEFAULT_TABLE_OPTIONS = {
  header: true,
  footer: false,
  striped: true,
  bordered: true,
  hover: true,
  responsive: true,
  sortable: false,
  showTitle: true,
  align: 'center',
  widthPct: 100,
}

/* 6 Selectable Preset Themes (Change 6) */
export const TABLE_THEMES = [
  {
    id: 'primary',
    label: 'Primary (Blue)',
    headBg: '#2563eb',
    headColor: '#ffffff',
    border: '#cbd5e1',
    stripe: '#f1f5f9',
    bg: '#ffffff',
    color: '#0f172a',
    hover: '#e2e8f0',
    titleColor: '#1e3a8a',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    headBg: '#0891b2',
    headColor: '#ffffff',
    border: '#cffafe',
    stripe: '#ecfeff',
    bg: '#ffffff',
    color: '#0e7490',
    hover: '#cffafe',
    titleColor: '#155e75',
  },
  {
    id: 'green',
    label: 'Green',
    headBg: '#059669',
    headColor: '#ffffff',
    border: '#a7f3d0',
    stripe: '#ecfdf5',
    bg: '#ffffff',
    color: '#064e3b',
    hover: '#d1fae5',
    titleColor: '#065f46',
  },
  {
    id: 'purple',
    label: 'Purple',
    headBg: '#7c3aed',
    headColor: '#ffffff',
    border: '#ddd6fe',
    stripe: '#f5f3ff',
    bg: '#ffffff',
    color: '#3b0764',
    hover: '#ede9fe',
    titleColor: '#5b21b6',
  },
  {
    id: 'orange',
    label: 'Orange',
    headBg: '#ea580c',
    headColor: '#ffffff',
    border: '#fed7aa',
    stripe: '#fff7ed',
    bg: '#ffffff',
    color: '#431407',
    hover: '#ffedd5',
    titleColor: '#9a3412',
  },
  {
    id: 'classic',
    label: 'Classic',
    headBg: '#1e293b',
    headColor: '#ffffff',
    border: '#cbd5e1',
    stripe: '#f8fafc',
    bg: '#ffffff',
    color: '#0f172a',
    hover: '#f1f5f9',
    titleColor: '#0f172a',
  },
]

export function makeTable(r = 4, c = 4) {
  const head = ['Sl. No.', 'Type of Activity', 'Examples', 'Purpose / Benefit']
  const rows = Array.from({ length: r }, (_, i) => ({
    id: uid('r'),
    h: 0,
    cells: Array.from({ length: c }, (_, j) => newCell(i === 0 ? (head[j] || `Column ${j + 1}`) : '')),
  }))
  return { rows, cols: Array.from({ length: c }, () => ({ w: 0 })) }
}

export const SAMPLE_TABLE = () => {
  const t = makeTable(5, 4)
  const body = [
    ['1', 'Aerobic Activities', 'Running, Cycling, Brisk Walking', 'Improves heart and lung health'],
    ['2', 'Strength Activities', 'Push-ups, Squats, Weight Training', 'Builds muscle strength and endurance'],
    ['3', 'Flexibility Activities', 'Yoga, Stretching', 'Improves joint mobility and reduces injury'],
    ['4', 'Skill-based Activities', 'Football, Volleyball, Badminton', 'Develops coordination and motor skills'],
  ]
  body.forEach((row, i) =>
    row.forEach((v, j) => {
      t.rows[i + 1].cells[j].t = v
    })
  )
  return t
}

export const dims = (rows) => ({ r: rows.length, c: rows[0]?.cells.length || 0 })

export function unmergeWhere(rows, pred) {
  const out = clone(rows)
  out.forEach((row, r) =>
    row.cells.forEach((cell, c) => {
      if (cell.cs > 1 || cell.rs > 1) {
        if (!pred(r, c, r + cell.rs - 1, c + cell.cs - 1)) return
        for (let i = r; i < r + cell.rs; i++)
          for (let j = c; j < c + cell.cs; j++) {
            if (out[i]?.cells[j]) out[i].cells[j].cov = false
          }
        cell.cs = 1
        cell.rs = 1
      }
    })
  )
  return out
}

export const hasMerges = (rows) => rows.some((row) => row.cells.some((c) => c.cs > 1 || c.rs > 1))

export function addRow(rows, at, count = 1) {
  const { c } = dims(rows)
  at = Math.max(0, Math.min(at, rows.length))
  const base = unmergeWhere(rows, (r1, _c1, r2) => r1 < at && r2 >= at)
  const add = Array.from({ length: count }, () => ({
    id: uid('r'),
    h: 0,
    cells: Array.from({ length: c }, () => newCell()),
  }))
  base.splice(at, 0, ...add)
  return base
}

export function addCol(rows, cols, at) {
  const { c } = dims(rows)
  at = Math.max(0, Math.min(at, c))
  const base = unmergeWhere(rows, (_r1, c1, _r2, c2) => c1 < at && c2 >= at)
  base.forEach((row) => row.cells.splice(at, 0, newCell()))
  const nc = clone(cols)
  nc.splice(at, 0, { w: 0 })
  return { rows: base, cols: nc }
}

export function delRows(rows, from, to = from) {
  if (rows.length - (to - from + 1) < 1) return rows
  const base = unmergeWhere(rows, (r1, _c1, r2) => r2 >= from && r1 <= to)
  base.splice(from, to - from + 1)
  return base
}

export function delCols(rows, cols, from, to = from) {
  const { c } = dims(rows)
  if (c - (to - from + 1) < 1) return { rows, cols }
  const base = unmergeWhere(rows, (_r1, c1, _r2, c2) => c2 >= from && c1 <= to)
  base.forEach((row) => row.cells.splice(from, to - from + 1))
  const nc = clone(cols)
  nc.splice(from, to - from + 1)
  return { rows: base, cols: nc }
}

export const normSel = (s) =>
  s ? { r1: Math.min(s.r1, s.r2), r2: Math.max(s.r1, s.r2), c1: Math.min(s.c1, s.c2), c2: Math.max(s.c1, s.c2) } : null

export function expandSel(rows, sel) {
  let s = normSel(sel)
  let changed = true
  while (changed) {
    changed = false
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < rows[r].cells.length; c++) {
        const cell = rows[r].cells[c]
        if (cell.cs <= 1 && cell.rs <= 1) continue
        const a = { r1: r, c1: c, r2: r + cell.rs - 1, c2: c + cell.cs - 1 }
        const hit = !(a.r2 < s.r1 || a.r1 > s.r2 || a.c2 < s.c1 || a.c1 > s.c2)
        if (hit && (a.r1 < s.r1 || a.r2 > s.r2 || a.c1 < s.c1 || a.c2 > s.c2)) {
          s = {
            r1: Math.min(s.r1, a.r1),
            r2: Math.max(s.r2, a.r2),
            c1: Math.min(s.c1, a.c1),
            c2: Math.max(s.c2, a.c2),
          }
          changed = true
        }
      }
  }
  return s
}

export function mergeCells(rows, sel) {
  const s = expandSel(rows, sel)
  if (s.r1 === s.r2 && s.c1 === s.c2) return rows
  const out = clone(rows)
  const texts = []
  for (let r = s.r1; r <= s.r2; r++)
    for (let c = s.c1; c <= s.c2; c++) {
      const cell = out[r].cells[c]
      if (!cell.cov && String(cell.t).trim()) texts.push(cell.t)
    }
  for (let r = s.r1; r <= s.r2; r++)
    for (let c = s.c1; c <= s.c2; c++) {
      const cell = out[r].cells[c]
      cell.cov = !(r === s.r1 && c === s.c1)
      cell.cs = 1
      cell.rs = 1
    }
  const a = out[s.r1].cells[s.c1]
  a.cs = s.c2 - s.c1 + 1
  a.rs = s.r2 - s.r1 + 1
  a.t = texts.join(' ')
  return out
}

export function splitCell(rows, r, c) {
  const out = clone(rows)
  const a = out[r]?.cells[c]
  if (!a || (a.cs <= 1 && a.rs <= 1)) return rows
  for (let i = r; i < r + a.rs; i++)
    for (let j = c; j < c + a.cs; j++) {
      if (out[i]?.cells[j]) out[i].cells[j].cov = false
    }
  a.cs = 1
  a.rs = 1
  return out
}

export function setCellText(rows, r, c, t) {
  const out = clone(rows)
  if (out[r]?.cells[c]) out[r].cells[c].t = t
  return out
}

export function styleCells(rows, sel, patch) {
  const s = expandSel(rows, sel)
  const out = clone(rows)
  for (let r = s.r1; r <= s.r2; r++)
    for (let c = s.c1; c <= s.c2; c++) {
      const cell = out[r]?.cells[c]
      if (cell && !cell.cov) cell.st = { ...(cell.st || {}), ...patch }
    }
  return out
}

export function clearCellStyles(rows, sel) {
  const s = expandSel(rows, sel)
  const out = clone(rows)
  for (let r = s.r1; r <= s.r2; r++)
    for (let c = s.c1; c <= s.c2; c++) {
      const cell = out[r]?.cells[c]
      if (cell) cell.st = {}
    }
  return out
}

export function moveRow(rows, from, to) {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows
  const out = unmergeWhere(rows, () => false)
  const [row] = out.splice(from, 1)
  out.splice(to, 0, row)
  return out
}

export function moveCol(rows, cols, from, to) {
  const { c } = dims(rows)
  if (from === to || from < 0 || to < 0 || from >= c || to >= c) return { rows, cols }
  const out = unmergeWhere(rows, () => false)
  out.forEach((row) => {
    const [cell] = row.cells.splice(from, 1)
    row.cells.splice(to, 0, cell)
  })
  const nc = clone(cols)
  const [col] = nc.splice(from, 1)
  nc.splice(to, 0, col)
  return { rows: out, cols: nc }
}

export function sortRows(rows, colIdx, dir = 'asc', { header = true, footer = false } = {}) {
  const start = header ? 1 : 0
  const end = rows.length - (footer ? 1 : 0)
  if (end <= start) return rows
  const head = rows.slice(0, start)
  const foot = rows.slice(end)
  const body = rows.slice(start, end)

  body.sort((a, b) => {
    const ta = String(a.cells[colIdx]?.t || '').replace(/<[^>]+>/g, '').trim()
    const tb = String(b.cells[colIdx]?.t || '').replace(/<[^>]+>/g, '').trim()
    const na = Number(ta)
    const nb = Number(tb)
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      return dir === 'asc' ? na - nb : nb - na
    }
    return dir === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta)
  })

  return [...head, ...body, ...foot]
}

export function colLetter(idx) {
  let s = ''
  idx = Math.max(0, idx)
  while (idx >= 0) {
    s = String.fromCharCode((idx % 26) + 65) + s
    idx = Math.floor(idx / 26) - 1
  }
  return s
}

export function tableToCsv(rows) {
  return rows
    .map((r) =>
      r.cells
        .filter((c) => !c.cov)
        .map((c) => `"${String(c.t).replace(/"/g, '""').replace(/<[^>]+>/g, '')}"`)
        .join(',')
    )
    .join('\n')
}

export function tableFromGridText(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return null
  const sep = lines[0].includes('\t') ? '\t' : ','
  const data = lines.map((l) => l.split(sep).map((s) => s.replace(/^"(.*)"$/, '$1').trim()))
  const maxCols = Math.max(...data.map((r) => r.length))
  const rows = data.map((r) => ({
    id: uid('r'),
    h: 0,
    cells: Array.from({ length: maxCols }, (_, j) => newCell(r[j] || '')),
  }))
  return { rows, cols: Array.from({ length: maxCols }, () => ({ w: 0 })) }
}

export function normalizeTable(data = {}) {
  const sample = SAMPLE_TABLE()
  const rows = Array.isArray(data.rows) && data.rows.length ? data.rows : sample.rows
  const maxCols = Math.max(1, ...rows.map((r) => r.cells?.length || 0))
  const cols = Array.isArray(data.cols) && data.cols.length >= maxCols
    ? data.cols
    : Array.from({ length: maxCols }, (_, i) => data.cols?.[i] || { w: 0 })

  return {
    rows,
    cols,
    options: { ...DEFAULT_TABLE_OPTIONS, ...(data.options || {}) },
    style: { ...DEFAULT_TABLE_STYLE, ...(data.style || {}) },
    spacing: data.spacing || {},
  }
}

export function validateTable(data = {}) {
  const errors = []
  if (!data.rows || !data.rows.length) errors.push('Table must have at least one row.')
  return errors
}

export function scopeCss(css, prefix) {
  if (!css) return ''
  return css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, (match, selector, suffix) => {
    if (selector.trim().startsWith('@')) return match
    return `${prefix} ${selector.trim()}${suffix}`
  })
}
