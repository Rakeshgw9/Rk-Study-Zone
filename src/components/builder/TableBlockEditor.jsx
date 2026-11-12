import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import {
  LuArrowDown,
  LuArrowUp,
  LuDownload,
  LuEraser,
  LuEye,
  LuMaximize2,
  LuMinimize2,
  LuPlus,
  LuRotateCcw,
  LuSave,
  LuTrash2,
  LuUpload,
} from 'react-icons/lu'
import { downloadText, readFileText } from '../../lib/id'
import {
  DEFAULT_TABLE_OPTIONS,
  DEFAULT_TABLE_STYLE,
  TABLE_THEMES,
  addCol,
  addRow,
  clearCellStyles,
  colLetter,
  delCols,
  delRows,
  expandSel,
  hasMerges,
  mergeCells,
  moveCol,
  moveRow,
  normSel,
  normalizeTable,
  setCellText,
  sortRows,
  splitCell,
  styleCells,
  tableFromGridText,
  tableToCsv,
} from '../../lib/table'
import { useToast } from '../Toast'
import { DeviceToggle, Field, NumberField, Section, Tabs, Toggle, deviceWidth } from '../ui/Controls'
import TableView from '../ui/TableView'
import { EditorFallback } from './HtmlBlockEditor'

const CodeEditor = lazy(() => import('../ui/CodeEditor'))
const HIST = new Map()
const histFor = (id) => {
  let h = HIST.get(id)
  if (!h) {
    h = { undo: [], redo: [] }
    HIST.set(id, h)
  }
  return h
}
const FONTS = ['Inter', 'Poppins', 'Noto Sans Oriya', 'Georgia', 'Arial', 'system-ui']

/** All table editing operations (shared by the workspace editor and properties panel). Every change is undoable. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTableOps({ block, setData, ui, setUi }) {
  const toast = useToast()
  const d = block.data
  const t = useMemo(() => normalizeTable(d), [d])
  const h = histFor(block.id)
  const nr = t.rows.length
  const nc = t.cols.length
  const raw = ui.tsel || { r1: 0, c1: 0, r2: 0, c2: 0 }
  const sel = {
    r1: Math.min(raw.r1, nr - 1),
    r2: Math.min(raw.r2, nr - 1),
    c1: Math.min(raw.c1, nc - 1),
    c2: Math.min(raw.c2, nc - 1),
  }
  const eSel = expandSel(t.rows, sel)

  const commit = (rows, cols) => {
    h.undo.push({ rows: t.rows, cols: t.cols })
    if (h.undo.length > 60) h.undo.shift()
    h.redo = []
    setData(cols ? { rows, cols } : { rows })
  }

  const setSel = (s) => setUi({ tsel: s })

  const ops = {
    t,
    sel,
    eSel,
    nr,
    nc,
    canUndo: h.undo.length > 0,
    canRedo: h.redo.length > 0,
    select(r, c, e) {
      if (e?.shiftKey && ui.tsel)
        return setSel({ r1: ui.tsel.r1, c1: ui.tsel.c1, r2: r, c2: c })
      if (
        e?.focus &&
        ui.tsel &&
        r >= Math.min(ui.tsel.r1, ui.tsel.r2) &&
        r <= Math.max(ui.tsel.r1, ui.tsel.r2) &&
        c >= Math.min(ui.tsel.c1, ui.tsel.c2) &&
        c <= Math.max(ui.tsel.c1, ui.tsel.c2) &&
        (ui.tsel.r1 !== ui.tsel.r2 || ui.tsel.c1 !== ui.tsel.c2)
      )
        return
      setSel({ r1: r, c1: c, r2: r, c2: c })
    },
    selectRow: (r, e) =>
      setSel({ r1: e?.shiftKey && ui.tsel ? ui.tsel.r1 : r, c1: 0, r2: r, c2: nc - 1 }),
    selectCol: (c, e) =>
      setSel({ r1: 0, c1: e?.shiftKey && ui.tsel ? ui.tsel.c1 : c, r2: nr - 1, c2: c }),
    selectAll: () => setSel({ r1: 0, c1: 0, r2: nr - 1, c2: nc - 1 }),
    setCell: (r, c, v) => commit(setCellText(t.rows, r, c, v)),
    addRowAt(where) {
      const at = where === 'above' ? eSel.r1 : where === 'end' ? nr : eSel.r2 + 1
      commit(addRow(t.rows, at))
      setSel({ r1: at, c1: 0, r2: at, c2: nc - 1 })
    },
    addColAt(where) {
      const at = where === 'left' ? eSel.c1 : where === 'end' ? nc : eSel.c2 + 1
      const n = addCol(t.rows, t.cols, at)
      commit(n.rows, n.cols)
      setSel({ r1: 0, c1: at, r2: nr - 1, c2: at })
    },
    delRows() {
      if (eSel.r2 - eSel.r1 + 1 >= nr) return toast('A table needs at least one row.', 'error')
      commit(delRows(t.rows, eSel.r1, eSel.r2))
      setSel({ r1: Math.max(0, eSel.r1 - 1), c1: 0, r2: Math.max(0, eSel.r1 - 1), c2: nc - 1 })
    },
    delCols() {
      if (eSel.c2 - eSel.c1 + 1 >= nc) return toast('A table needs at least one column.', 'error')
      const n = delCols(t.rows, t.cols, eSel.c1, eSel.c2)
      commit(n.rows, n.cols)
      setSel({ r1: 0, c1: Math.max(0, eSel.c1 - 1), r2: nr - 1, c2: Math.max(0, eSel.c1 - 1) })
    },
    merge() {
      if (sel.r1 === sel.r2 && sel.c1 === sel.c2)
        return toast('Select two or more cells first (Shift+click).', 'error')
      commit(mergeCells(t.rows, sel))
      setSel({ r1: eSel.r1, c1: eSel.c1, r2: eSel.r1, c2: eSel.c1 })
    },
    split() {
      const c = t.rows[eSel.r1]?.cells[eSel.c1]
      if (!c || (c.cs <= 1 && c.rs <= 1)) return toast('Select a merged cell to split it.', 'error')
      commit(splitCell(t.rows, eSel.r1, eSel.c1))
    },
    sort(dir) {
      const body = t.rows.slice(t.options.header ? 1 : 0, t.rows.length - (t.options.footer ? 1 : 0))
      if (hasMerges(body)) return toast('Split merged cells before sorting.', 'error')
      commit(sortRows(t.rows, sel.c1, dir, { header: t.options.header, footer: t.options.footer }))
      toast(`Sorted column ${colLetter(sel.c1)} ${dir === 'asc' ? 'A → Z' : 'Z → A'}`)
    },
    moveRowTo(from, to) {
      if (from === to) return
      if (hasMerges(t.rows)) toast('Merged cells were split to reorder rows.')
      commit(moveRow(t.rows, from, to))
      setSel({ r1: to, c1: 0, r2: to, c2: nc - 1 })
    },
    moveColTo(from, to) {
      if (from === to) return
      if (hasMerges(t.rows)) toast('Merged cells were split to reorder columns.')
      const n = moveCol(t.rows, t.cols, from, to)
      commit(n.rows, n.cols)
      setSel({ r1: 0, c1: to, r2: nr - 1, c2: to })
    },
    style: (patch) => commit(styleCells(t.rows, eSel, patch)),
    clearStyle: () => commit(clearCellStyles(t.rows, eSel)),
    setColWidth(i, w) {
      commit(
        t.rows,
        t.cols.map((c, j) => (j === i ? { ...c, w: Math.max(0, Number(w) || 0) } : c))
      )
    },
    undo() {
      const s = h.undo.pop()
      if (!s) return
      h.redo.push({ rows: t.rows, cols: t.cols })
      setData({ rows: s.rows, cols: s.cols })
    },
    redo() {
      const s = h.redo.pop()
      if (!s) return
      h.undo.push({ rows: t.rows, cols: t.cols })
      setData({ rows: s.rows, cols: s.cols })
    },
    importText(text) {
      const g = tableFromGridText(text)
      if (!g) return toast('No table data found in that file.', 'error')
      commit(g.rows, g.cols)
      setSel({ r1: 0, c1: 0, r2: 0, c2: 0 })
      toast(`Imported ${g.rows.length} rows × ${g.cols.length} columns`)
    },
    exportCsv() {
      downloadText(`${(d.title || 'table').replace(/\W+/g, '-')}.csv`, tableToCsv(t.rows), 'text/csv')
      toast('Download started')
    },
    setOpt: (patch) => setData({ options: { ...t.options, ...patch } }),
    setStyle: (patch) => setData({ style: { ...t.style, ...patch } }),
    applyTheme(theme) {
      setData({
        style: {
          ...t.style,
          theme: theme.id,
          headBg: theme.headBg,
          headColor: theme.headColor,
          border: theme.border,
          stripe: theme.stripe,
          bg: theme.bg,
          color: theme.color,
          hover: theme.hover,
          titleColor: theme.titleColor,
        },
      })
      toast(`Theme applied: ${theme.label}`)
    },
  }
  return ops
}

const Btn = ({ children, ...p }) => (
  <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" {...p}>
    {children}
  </button>
)

const ColorField = ({ label, value, onChange }) => (
  <Field label={label}>
    <input
      className="form-control form-control-color"
      type="color"
      value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#ffffff'}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    />
  </Field>
)

function CellFormat({ ops }) {
  const c = ops.t.rows[ops.eSel.r1]?.cells[ops.eSel.c1]
  const st = c?.st || {}
  const many = ops.eSel.r1 !== ops.eSel.r2 || ops.eSel.c1 !== ops.eSel.c2
  return (
    <div className="tbl-cellfmt">
      <p className="small text-soft mb-2">
        Formatting {many ? `${(ops.eSel.r2 - ops.eSel.r1 + 1) * (ops.eSel.c2 - ops.eSel.c1 + 1)} selected cells` : `cell ${colLetter(ops.eSel.c1)}${ops.eSel.r1 + 1}`}.
      </p>
      <Field label="Alignment">
        <div className="ui-chip-row">
          {[
            ['left', 'Left'],
            ['center', 'Center'],
            ['right', 'Right'],
          ].map(([v, l]) => (
            <button
              type="button"
              key={v}
              className={`ui-chip ${st.align === v ? 'on' : ''}`}
              onClick={() => ops.style({ align: v })}
            >
              {l}
            </button>
          ))}
        </div>
      </Field>
      <div className="row g-2">
        <div className="col-6">
          <Field label="Vertical">
            <select
              className="ui-input ui-select"
              value={st.valign || ''}
              onChange={(e) => ops.style({ valign: e.target.value })}
            >
              <option value="">Default</option>
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </select>
          </Field>
        </div>
        <div className="col-6">
          <Field label="Weight">
            <select
              className="ui-input ui-select"
              value={st.weight || ''}
              onChange={(e) => ops.style({ weight: e.target.value })}
            >
              <option value="">Default</option>
              <option value="400">Normal</option>
              <option value="600">Semi-bold</option>
              <option value="800">Bold</option>
            </select>
          </Field>
        </div>
        <div className="col-6">
          <NumberField
            label="Font size (0 = default)"
            value={st.size || 0}
            min={0}
            max={48}
            onChange={(v) => ops.style({ size: v || '' })}
            suffix="px"
          />
        </div>
        <div className="col-6">
          <NumberField
            label="Padding (0 = default)"
            value={st.pad || 0}
            min={0}
            max={40}
            onChange={(v) => ops.style({ pad: v || '' })}
            suffix="px"
          />
        </div>
        <div className="col-4">
          <ColorField label="Text" value={st.color} onChange={(v) => ops.style({ color: v })} />
        </div>
        <div className="col-4">
          <ColorField label="Background" value={st.bg} onChange={(v) => ops.style({ bg: v })} />
        </div>
        <div className="col-4">
          <ColorField label="Border" value={st.border} onChange={(v) => ops.style({ border: v })} />
        </div>
      </div>
      <button type="button" className="btn ui-btn ui-btn-ghost btn-sm mt-2" onClick={ops.clearStyle}>
        <LuEraser /> Clear cell formatting
      </button>
    </div>
  )
}

/**
 * Clean Central Table Workspace (Change 6: Requirements 3 & 4)
 * Controls above the table: Add Row, Add Column, Delete Row, Delete Column, Undo / Redo.
 * Direct in-preview cell editing. No duplicate settings below.
 */
export function TableCenter({ block, setData, ui, setUi }) {
  const d = block.data
  const ops = useTableOps({ block, setData, ui, setUi })
  const [big, setBig] = useState(false)

  return (
    <div className="editor-stack table-editor-clean">
      <div className={`ed-card ${big ? 'ed-fullscreen' : ''}`}>
        <div className="ed-card-head flex-wrap gap-2">
          {/* Controls above table */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn ui-btn ui-btn-primary btn-sm"
              onClick={() => ops.addRowAt('end')}
            >
              <LuPlus /> Add Row
            </button>
            <button
              type="button"
              className="btn ui-btn ui-btn-primary btn-sm"
              onClick={() => ops.addColAt('end')}
            >
              <LuPlus /> Add Column
            </button>
            <button
              type="button"
              className="btn ui-btn ui-btn-danger btn-sm"
              onClick={ops.delRows}
            >
              <LuTrash2 /> Delete Row
            </button>
            <button
              type="button"
              className="btn ui-btn ui-btn-danger btn-sm"
              onClick={ops.delCols}
            >
              <LuTrash2 /> Delete Column
            </button>
            <span className="v-sep mx-1" style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.2)' }} />
            <button
              type="button"
              className="icon-mini"
              disabled={!ops.canUndo}
              onClick={ops.undo}
              aria-label="Undo"
              title="Undo"
            >
              <LuRotateCcw />
            </button>
            <button
              type="button"
              className="icon-mini"
              disabled={!ops.canRedo}
              onClick={ops.redo}
              aria-label="Redo"
              title="Redo"
              style={{ transform: 'scaleX(-1)' }}
            >
              <LuRotateCcw />
            </button>
          </div>

          <div className="d-flex align-items-center gap-2 ms-auto">
            <DeviceToggle value={ui.device || 'desktop'} onChange={(v) => setUi({ device: v })} />
            <button
              className="icon-mini"
              onClick={() => setBig((b) => !b)}
              aria-label={big ? 'Exit full screen' : 'Full screen preview'}
            >
              {big ? <LuMinimize2 /> : <LuMaximize2 />}
            </button>
          </div>
        </div>

        {/* Clean Direct Editing Table Preview */}
        <div className="ed-preview light-canvas p-3">
          <div style={{ maxWidth: deviceWidth(ui.device), margin: '0 auto' }}>
            <TableView
              data={d}
              editable={true}
              onCellCommit={ops.setCell}
              sel={ops.sel}
              onSelectCell={ops.select}
            />
          </div>
        </div>

        <p className="ed-hint mx-3 my-2">
          Click directly inside any table cell to edit text. Shift+click selects a cell range. All settings and visual themes are in the right sidebar.
        </p>
      </div>
    </div>
  )
}

/**
 * Right-Side Properties Panel (Change 6: Requirements 1, 2 & 5)
 * Table Themes and all settings organized into compact, collapsible sections.
 */
export function TableProps({ block, setBlock, setData, ui, setUi, onSave, dirty }) {
  const d = block.data
  const ops = useTableOps({ block, setData, ui, setUi })
  const o = ops.t.options
  const st = ops.t.style
  const sp = { padding: 20, marginTop: 0, marginBottom: 18, ...(d.spacing || {}) }
  const tab = ui.tablePropsTab || 'style'
  const fileRef = useRef(null)
  const toast = useToast()

  const onFile = async (f) => {
    if (!f) return
    if (f.size > 500 * 1024) return toast('File must be under 500 KB', 'error')
    ops.importText(await readFileText(f))
  }

  return (
    <div className="props">
      <Tabs
        value={tab}
        onChange={(v) => setUi({ tablePropsTab: v })}
        items={[
          { value: 'content', label: 'Content' },
          { value: 'style', label: 'Style' },
          { value: 'advanced', label: 'Advanced' },
        ]}
        className="props-tabs"
      />

      {/* Content Tab: Titles, Headings & Tools */}
      {tab === 'content' && (
        <>
          <Section title="Table Headers & Captions">
            <Field label="Table Title">
              <input
                className="ui-input"
                value={d.title || ''}
                maxLength={160}
                onChange={(e) => {
                  setData({ title: e.target.value })
                  setBlock({ title: e.target.value || 'Table Block' })
                }}
              />
            </Field>
            <Field label="Description (optional)">
              <textarea
                className="ui-input ui-textarea"
                rows={2}
                value={d.caption || ''}
                onChange={(e) => setData({ caption: e.target.value })}
              />
            </Field>
            <Field label="Table Caption (optional)">
              <input
                className="ui-input"
                value={d.tableCaption || ''}
                maxLength={200}
                onChange={(e) => setData({ tableCaption: e.target.value })}
              />
            </Field>
          </Section>

          <Section title="Merge & Split Cells">
            <div className="d-flex gap-2 flex-wrap">
              <Btn onClick={ops.merge}>Merge Selected</Btn>
              <Btn onClick={ops.split}>Split Cell</Btn>
            </div>
            <p className="ui-hint mb-0 mt-2">
              Select cells in the table (Shift+click for a range) to merge.
            </p>
          </Section>

          <Section title={`Sort & Order (Col ${colLetter(ops.sel.c1)})`}>
            <div className="d-flex gap-2 flex-wrap">
              <Btn onClick={() => ops.sort('asc')}>Sort A → Z</Btn>
              <Btn onClick={() => ops.sort('desc')}>Sort Z → A</Btn>
            </div>
            <div className="prop-row mt-2">
              <span>Let students sort by clicking headers</span>
              <Toggle checked={!!o.sortable} onChange={(v) => ops.setOpt({ sortable: v })} small />
            </div>
          </Section>

          <Section title="Import / Export Data" defaultOpen={false}>
            <div className="d-flex gap-2 flex-wrap">
              <Btn onClick={() => fileRef.current?.click()}>
                <LuUpload /> Import CSV / TSV
              </Btn>
              <Btn onClick={ops.exportCsv}>
                <LuDownload /> Export CSV
              </Btn>
            </div>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              onChange={(e) => {
                onFile(e.target.files[0])
                e.target.value = ''
              }}
            />
          </Section>

          <div className="prop-row">
            <span>Show in Chapter</span>
            <Toggle
              checked={block.visible !== false}
              onChange={(v) => setBlock({ visible: v })}
              small
            />
          </div>
        </>
      )}

      {/* Style Tab: Table Themes + All moved settings (Change 6) */}
      {tab === 'style' && (
        <>
          {/* Requirement 1: Table Themes */}
          <Section title="Table Themes">
            <div className="table-theme-grid">
              {TABLE_THEMES.map((th) => {
                const active = st.theme === th.id || st.headBg === th.headBg
                return (
                  <button
                    key={th.id}
                    type="button"
                    className={`table-theme-card ${active ? 'is-active' : ''}`}
                    onClick={() => ops.applyTheme(th)}
                  >
                    <div className="theme-mini-preview">
                      <div className="mini-head" style={{ background: th.headBg }} />
                      <div className="mini-row stripe" style={{ background: th.stripe }} />
                      <div className="mini-row" style={{ background: th.bg }} />
                    </div>
                    <span className="theme-title">{th.label}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Requirement 2: Moved Table Settings in Right Sidebar */}
          <Section title="Table Style">
            <div className="prop-row">
              <span>Header Style (Show Header)</span>
              <Toggle checked={!!o.header} onChange={(v) => ops.setOpt({ header: v })} small />
            </div>
            <div className="prop-row">
              <span>Striped Rows</span>
              <Toggle checked={!!o.striped} onChange={(v) => ops.setOpt({ striped: v })} small />
            </div>
            <div className="prop-row">
              <span>Bordered Table</span>
              <Toggle checked={!!o.bordered} onChange={(v) => ops.setOpt({ bordered: v })} small />
            </div>
            <div className="prop-row">
              <span>Hover Effect</span>
              <Toggle checked={!!o.hover} onChange={(v) => ops.setOpt({ hover: v })} small />
            </div>
          </Section>

          <Section title="Table Alignment & Width">
            <Field label="Table Alignment">
              <div className="ui-chip-row mb-2">
                {[
                  ['left', 'Left'],
                  ['center', 'Center'],
                  ['right', 'Right'],
                ].map(([v, l]) => (
                  <button
                    type="button"
                    key={v}
                    className={`ui-chip ${o.align === v ? 'on' : ''}`}
                    onClick={() => ops.setOpt({ align: v })}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <NumberField
              label="Table Width"
              value={o.widthPct}
              min={30}
              max={100}
              onChange={(v) => ops.setOpt({ widthPct: v })}
              suffix="%"
            />
          </Section>

          <Section title="Spacing & Typography">
            <div className="row g-2">
              <div className="col-6">
                <NumberField
                  label="Cell Padding"
                  value={st.pad}
                  min={0}
                  max={40}
                  onChange={(v) => ops.setStyle({ pad: v })}
                  suffix="px"
                />
              </div>
              <div className="col-6">
                <NumberField
                  label="Font Size"
                  value={st.fontSize}
                  min={10}
                  max={32}
                  onChange={(v) => ops.setStyle({ fontSize: v })}
                  suffix="px"
                />
              </div>
              <div className="col-6">
                <NumberField
                  label="Corner Radius"
                  value={st.radius}
                  min={0}
                  max={40}
                  onChange={(v) => ops.setStyle({ radius: v })}
                  suffix="px"
                />
              </div>
              <div className="col-6">
                <NumberField
                  label="Row Height (0 = auto)"
                  value={st.rowHeight}
                  min={0}
                  max={200}
                  onChange={(v) => ops.setStyle({ rowHeight: v })}
                  suffix="px"
                />
              </div>
              <div className="col-12">
                <Field label="Font Family">
                  <select
                    className="ui-input ui-select"
                    value={st.fontFamily || 'Inter'}
                    onChange={(e) => ops.setStyle({ fontFamily: e.target.value })}
                  >
                    {FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Responsive Settings">
            <div className="prop-row">
              <span>Responsive Table (Horizontal Scroll)</span>
              <Toggle
                checked={!!o.responsive}
                onChange={(v) => ops.setOpt({ responsive: v })}
                small
              />
            </div>
          </Section>

          <Section title="Cell Formatting" defaultOpen={false}>
            <CellFormat ops={ops} />
          </Section>

          <Section title="Custom Theme Colors" defaultOpen={false}>
            <div className="row g-2">
              <div className="col-6">
                <ColorField
                  label="Header Background"
                  value={st.headBg}
                  onChange={(v) => ops.setStyle({ headBg: v })}
                />
              </div>
              <div className="col-6">
                <ColorField
                  label="Header Text"
                  value={st.headColor}
                  onChange={(v) => ops.setStyle({ headColor: v })}
                />
              </div>
              <div className="col-6">
                <ColorField
                  label="Border Color"
                  value={st.border}
                  onChange={(v) => ops.setStyle({ border: v })}
                />
              </div>
              <div className="col-6">
                <ColorField
                  label="Stripe Color"
                  value={st.stripe}
                  onChange={(v) => ops.setStyle({ stripe: v })}
                />
              </div>
            </div>
          </Section>
        </>
      )}

      {/* Advanced Tab: Custom CSS & Reset */}
      {tab === 'advanced' && (
        <>
          <Section title="Custom CSS (applies to this table only)">
            <Suspense fallback={<EditorFallback />}>
              <CodeEditor
                lang="css"
                value={d.customCss || ''}
                onChange={(v) => setData({ customCss: v })}
                height="160px"
                ariaLabel="Table custom CSS"
              />
            </Suspense>
          </Section>
          <Section title="Reset Settings" defaultOpen={false}>
            <button
              type="button"
              className="btn ui-btn ui-btn-ghost btn-sm"
              onClick={() => {
                ops.setStyle({ ...DEFAULT_TABLE_STYLE })
                ops.setOpt({ ...DEFAULT_TABLE_OPTIONS })
              }}
            >
              <LuEraser /> Reset to Default Theme & Style
            </button>
          </Section>
        </>
      )}

      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave}>
        <LuSave /> {dirty ? 'Save Block' : 'Saved'}
      </button>
    </div>
  )
}
