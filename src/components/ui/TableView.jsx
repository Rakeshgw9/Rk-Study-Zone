import { useMemo, useState } from 'react'
import { hasMerges, normalizeTable, scopeCss, sortRows } from '../../lib/table'
import { RichEditable, RichHtml } from './RichText'

const cellCss = (st = {}) => {
  const o = {}
  if (st.align) o.textAlign = st.align
  if (st.valign) o.verticalAlign = st.valign
  if (st.bg) o.background = st.bg
  if (st.color) o.color = st.color
  if (st.size) o.fontSize = `${st.size}px`
  if (st.weight) o.fontWeight = st.weight
  if (st.border) o.borderColor = st.border
  if (st.pad !== undefined && st.pad !== '') o.padding = `${st.pad}px`
  return o
}
let uidCount = 0

/** Renders a table block. Same component is used in the builder (editable cells) and on the student page. */
export default function TableView({ data, editable = false, onCellCommit, sel, onSelectCell, className = '' }) {
  const t = useMemo(() => normalizeTable(data), [data])
  const o = t.options; const st = t.style
  const [sort, setSort] = useState(null)
  const [scope] = useState(() => `tb${++uidCount}`)
  const merged = hasMerges(t.rows)
  const canSort = o.sortable && !merged && !editable && o.header
  let rows = t.rows.map((row, r) => ({ row, r }))
  if (canSort && sort) {
    const sorted = sortRows(t.rows, sort.col, sort.dir, { header: o.header, footer: o.footer })
    rows = sorted.map((row) => ({ row, r: t.rows.indexOf(row) }))
  }
  const headRows = o.header ? rows.slice(0, 1) : []
  const footRows = o.footer && rows.length > (o.header ? 2 : 1) ? rows.slice(-1) : []
  const bodyRows = rows.slice(headRows.length, rows.length - footRows.length)
  const vars = {
    '--tb-head-bg': st.headBg, '--tb-head-color': st.headColor, '--tb-border': st.border, '--tb-stripe': st.stripe, '--tb-bg': st.bg, '--tb-color': st.color, '--tb-hover': st.hover,
    '--tb-radius': `${st.radius}px`, '--tb-font-size': `${st.fontSize}px`, '--tb-pad': `${st.pad}px`, '--tb-font': `'${st.fontFamily}', sans-serif`, '--tb-title': st.titleColor, '--tb-caption': st.captionColor,
    '--tb-row-h': st.rowHeight ? `${st.rowHeight}px` : 'auto', '--tb-width': `${Math.min(100, Math.max(30, Number(o.widthPct) || 100))}%`,
  }
  const sp = t.spacing || data.spacing || {}
  const scoped = data.customCss ? scopeCss(data.customCss, `.${scope}`) : ''

  const renderCell = (cell, r, c, tag) => {
    if (cell.cov) return null
    const Tag = tag; const selected = sel && r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2
    const isSortCol = sort && sort.col === c && tag === 'th'
    const props = { colSpan: cell.cs > 1 ? cell.cs : undefined, rowSpan: cell.rs > 1 ? cell.rs : undefined, style: cellCss(cell.st), className: `${selected ? 'is-sel' : ''} ${canSort && tag === 'th' ? 'sortable' : ''}` }
    if (editable) {
      return <Tag key={`${r}-${c}`} {...props} onMouseDown={(e) => onSelectCell?.(r, c, e)}><RichEditable as="div" className="tbl-cell" value={cell.t} onCommit={(v) => onCellCommit?.(r, c, v)} onFocus={(e) => { if (!e.shiftKey) onSelectCell?.(r, c, { focus: true }) }} placeholder="" /></Tag>
    }
    if (canSort && tag === 'th') {
      return <Tag key={`${r}-${c}`} {...props} role="columnheader" aria-sort={isSortCol ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} tabIndex={0}
        onClick={() => setSort((s) => (s && s.col === c ? (s.dir === 'asc' ? { col: c, dir: 'desc' } : null) : { col: c, dir: 'asc' }))}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSort((s) => (s && s.col === c ? (s.dir === 'asc' ? { col: c, dir: 'desc' } : null) : { col: c, dir: 'asc' })) } }}>
        <RichHtml as="span" value={cell.t} /><span className="tbl-sort" aria-hidden="true">{isSortCol ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span></Tag>
    }
    return null
  }
  // non-editable, non-sortable cells render sanitized HTML directly in the <td>/<th>
  const cellEl = (cell, r, c, tag) => {
    if (cell.cov) return null
    if (editable || (canSort && tag === 'th')) return renderCell(cell, r, c, tag)
    const Tag = tag
    return <Tag key={`${r}-${c}`} colSpan={cell.cs > 1 ? cell.cs : undefined} rowSpan={cell.rs > 1 ? cell.rs : undefined} style={cellCss(cell.st)}><RichHtml as="div" className="tbl-cell" value={cell.t} /></Tag>
  }

  return (
    <div className={`tbl-block ${scope} tbl-align-${o.align} ${className}`} style={{ ...vars, padding: sp.padding !== undefined ? `${sp.padding}px` : undefined, marginTop: sp.marginTop, marginBottom: sp.marginBottom }}>
      {scoped && <style>{scoped}</style>}
      {o.showTitle && data.title && <h3 className="tbl-title">{data.title}</h3>}
      {data.caption && <p className="tbl-desc">{data.caption}</p>}
      <div className={`tbl-scroll ${o.responsive ? 'responsive' : ''}`}>
        <table className={`tbl ${o.bordered ? 'bordered' : ''} ${o.striped ? 'striped' : ''} ${o.hover ? 'hover' : ''}`}>
          {data.tableCaption && <caption>{data.tableCaption}</caption>}
          <colgroup>{t.cols.map((c, i) => <col key={i} style={c.w ? { width: `${c.w}px` } : undefined} />)}</colgroup>
          {headRows.length > 0 && <thead>{headRows.map(({ row, r }) => <tr key={row.id} style={row.h ? { height: row.h } : undefined}>{row.cells.map((cell, c) => cellEl(cell, r, c, 'th'))}</tr>)}</thead>}
          <tbody>{bodyRows.map(({ row, r }) => <tr key={row.id} style={row.h ? { height: row.h } : undefined}>{row.cells.map((cell, c) => cellEl(cell, r, c, 'td'))}</tr>)}</tbody>
          {footRows.length > 0 && <tfoot>{footRows.map(({ row, r }) => <tr key={row.id}>{row.cells.map((cell, c) => cellEl(cell, r, c, 'td'))}</tr>)}</tfoot>}
        </table>
      </div>
    </div>
  )
}
