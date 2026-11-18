import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LuImage, LuLink, LuPalette } from 'react-icons/lu'
import { execRich, queryRich } from '../../lib/editBridge'
import { escapeText, fromEditable, richHtml, sanitizeHtml } from '../../lib/richText'
import { uploadImage } from '../../services/storageService'
import { Field } from './Controls'

/* ------------------------------------------------------------------ context: ONE toolbar for every compatible block */
const noop = () => false
const Ctx = createContext({ target: null, state: {}, setTarget: () => {}, setState: () => {}, exec: noop })
// eslint-disable-next-line react-refresh/only-export-components
export const useRichText = () => useContext(Ctx)

export function RichTextProvider({ children }) {
  const [target, setTargetState] = useState(null)
  const [state, setState] = useState({})
  const targetRef = useRef(null)
  const rangeRef = useRef(null)
  const setTarget = useCallback((t) => { if (targetRef.current?.el !== t?.el || targetRef.current?.id !== t?.id) rangeRef.current = null; targetRef.current = t; setTargetState(t) }, [])

  useEffect(() => {
    const onSel = () => {
      const t = targetRef.current; if (!t || t.kind !== 'local') return
      const sel = window.getSelection()
      if (sel && sel.rangeCount && t.el.contains(sel.anchorNode)) { rangeRef.current = sel.getRangeAt(0).cloneRange(); setState(queryRich(document)) }
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const exec = useCallback((name, value) => {
    const t = targetRef.current; if (!t) return false
    if (t.kind === 'frame') { t.post({ rkTo: t.id, cmd: 'exec', name, value }); return true }
    const el = t.el; if (!el?.isConnected) return false
    el.focus()
    const sel = window.getSelection()
    if (rangeRef.current) { sel.removeAllRanges(); sel.addRange(rangeRef.current) }
    execRich(document, name, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    if (sel.rangeCount) rangeRef.current = sel.getRangeAt(0).cloneRange()
    setState(queryRich(document))
    return true
  }, [])

  const value = useMemo(() => ({ target, state, setTarget, setState, exec }), [target, state, setTarget, exec])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ------------------------------------------------------------------ editable + read-only rendering */
/** contentEditable text that stores clean HTML (or plain text when nothing is formatted). Works with the universal toolbar. */
export function RichEditable({ as: Tag = 'div', value, onCommit, placeholder, className, style, editable = true, singleLine = false, onFocus, ...rest }) {
  const ref = useRef(null)
  const emitted = useRef(null)
  const timer = useRef(null)
  const { setTarget } = useRichText()

  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    if (emitted.current === null || emitted.current !== (value ?? '')) { el.innerHTML = richHtml(value); emitted.current = value ?? '' }
  }, [value])

  const commit = () => {
    clearTimeout(timer.current)
    const el = ref.current; if (!el) return
    const hasImg = !!el.querySelector('img')
    if (!el.textContent && !hasImg && el.innerHTML) el.innerHTML = ''
    const v = fromEditable(el.innerHTML)
    if (v !== emitted.current) { emitted.current = v; onCommit?.(v) }
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!editable) return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: richHtml(value) }} {...rest} />
  return (
    <Tag ref={ref} className={`${className || ''} rt-editable`} style={style} contentEditable suppressContentEditableWarning spellCheck={false} data-placeholder={placeholder} role="textbox" aria-multiline={!singleLine}
      onFocus={(e) => { setTarget({ kind: 'local', el: ref.current }); onFocus?.(e) }}
      onInput={() => { clearTimeout(timer.current); timer.current = setTimeout(commit, 300) }}
      onBlur={commit}
      onKeyDown={singleLine ? (e) => { if (e.key === 'Enter') e.preventDefault() } : undefined}
      onPaste={(e) => {
        e.preventDefault()
        const html = e.clipboardData.getData('text/html'); const text = e.clipboardData.getData('text/plain')
        const out = singleLine ? escapeText(text.replace(/\s*\n\s*/g, ' ')) : html ? sanitizeHtml(html) : escapeText(text).replace(/\r?\n/g, '<br>')
        document.execCommand('insertHTML', false, out)
      }}
      {...rest} />
  )
}

/** Read-only rich text (student page / previews). Always sanitised. */
export function RichHtml({ as: Tag = 'div', value, className, style, ...rest }) {
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: richHtml(value) }} {...rest} />
}

/** Labelled form field that uses the same editor + toolbar (used in the properties panel). */
export function RichField({ label, value, onChange, placeholder, singleLine = false, rows = 3 }) {
  return (
    <Field label={label}>
      <RichEditable className={`ui-input rt-field ${singleLine ? 'single' : ''}`} style={singleLine ? undefined : { minHeight: `${rows * 1.6}em` }} value={value} onCommit={onChange} placeholder={placeholder} singleLine={singleLine} />
    </Field>
  )
}

/* ------------------------------------------------------------------ toolbar */
const COLORS = ['#000000', '#374151', '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']
const MARKS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd', '#67e8f9', '#fca5a5']
const FONTS = ['Inter', 'Poppins', 'Noto Sans Oriya', 'Georgia', 'Arial', 'Times New Roman', 'Courier New']
const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48]

const Svg = ({ children }) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
const Align = ({ kind }) => {
  const w = { left: [3, 17, 3, 13], center: [5, 19, 7, 17], right: [7, 21, 11, 21], justify: [3, 21, 3, 21] }[kind]
  return <Svg><line x1="3" y1="6" x2="21" y2="6" /><line x1={w[0]} y1="10" x2={w[1]} y2="10" /><line x1="3" y1="14" x2="21" y2="14" /><line x1={w[2]} y1="18" x2={w[3]} y2="18" /></Svg>
}
const ListIco = ({ ordered }) => <Svg><line x1="9" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" />{ordered ? <><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none">3</text></> : <><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>}</Svg>
const Arrow = ({ redo }) => <Svg><path d={redo ? 'M21 7v6h-6' : 'M3 7v6h6'} /><path d={redo ? 'M3 17a9 9 0 0 1 15-6.7L21 13' : 'M21 17a9 9 0 0 0-15-6.7L3 13'} /></Svg>

function Pop({ icon, title, children, disabled, badge }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <span className="rt-pop" ref={ref}>
      <button type="button" className={`rt-btn ${open ? 'on' : ''}`} title={title} aria-label={title} aria-haspopup="true" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)}>{icon}{badge && <i className="rt-bar" style={{ background: badge }} />}</button>
      {open && <div className="rt-menu" role="menu">{children(() => setOpen(false))}</div>}
    </span>
  )
}

function ColorMenu({ colors, onPick, close, allowNone, noneLabel }) {
  return (
    <>
      <div className="rt-swatches">{colors.map((c) => <button type="button" key={c} className="rt-sw" style={{ background: c }} aria-label={c} title={c} onClick={() => { onPick(c); close() }} />)}</div>
      <div className="rt-row">
        <label className="rt-custom"><LuPalette /> Custom<input type="color" onChange={(e) => onPick(e.target.value)} aria-label="Custom colour" /></label>
        {allowNone && <button type="button" className="rt-link" onClick={() => { onPick('transparent'); close() }}>{noneLabel}</button>}
      </div>
    </>
  )
}

/** The single reusable formatting toolbar. Drop it once above any group of blocks; it formats whichever text is focused. */
export function RichToolbar({ className = '' }) {
  const { target, state, exec } = useRichText()
  const [textColor, setTextColor] = useState('#ef4444')
  const [markColor, setMarkColor] = useState('#fde047')
  const [font, setFont] = useState('Inter')
  const [size, setSize] = useState(16)
  const [url, setUrl] = useState('https://')
  const [imgUrl, setImgUrl] = useState('https://')
  const [grid, setGrid] = useState({ r: 3, c: 3 })
  const [busy, setBusy] = useState(false)
  const off = !target
  const B = ({ cmd, value, title, children, on }) => <button type="button" className={`rt-btn ${on ? 'on' : ''}`} disabled={off} title={title} aria-label={title} aria-pressed={!!on} onClick={() => exec(cmd, value)}>{children}</button>

  const insertTable = (close) => {
    const r = Math.max(1, Math.min(10, Number(grid.r) || 1)); const c = Math.max(1, Math.min(8, Number(grid.c) || 1))
    const cell = '<td style="border:1px solid #94a3b8;padding:6px">&nbsp;</td>'
    exec('tableInsert', `<table style="border-collapse:collapse;width:100%"><tbody>${`<tr>${cell.repeat(c)}</tr>`.repeat(r)}</tbody></table><br>`); close()
  }
  const upload = async (file, close) => {
    if (!file) return
    setBusy(true)
    try { const src = await uploadImage(file, 'rich-text', { max: 900 }); exec('insertImage', src); close() } catch (e) { window.alert(e.message || 'Image upload failed.') } finally { setBusy(false) }
  }

  return (
    <div className={`rt-toolbar ${off ? 'is-off' : ''} ${className}`} role="toolbar" aria-label="Text formatting" onMouseDown={(e) => { if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.preventDefault() }}>
      <Pop title="Font family" disabled={off} icon={<span className="rt-txt">{font.split(' ')[0]} ▾</span>}>{(close) => <div className="rt-list">{FONTS.map((f) => <button type="button" key={f} style={{ fontFamily: f }} onClick={() => { setFont(f); exec('fontName', f); close() }}>{f}</button>)}</div>}</Pop>
      <Pop title="Font size" disabled={off} icon={<span className="rt-txt">{size}px ▾</span>}>{(close) => <div className="rt-list">{SIZES.map((n) => <button type="button" key={n} onClick={() => { setSize(n); exec('fontSizePx', n); close() }}>{n} px</button>)}</div>}</Pop>
      <i className="rt-sep" />
      <B cmd="bold" title="Bold (Ctrl+B)" on={state.bold}><b>B</b></B>
      <B cmd="italic" title="Italic (Ctrl+I)" on={state.italic}><i>I</i></B>
      <B cmd="underline" title="Underline (Ctrl+U)" on={state.underline}><u>U</u></B>
      <B cmd="strikeThrough" title="Strikethrough" on={state.strike}><s>S</s></B>
      <i className="rt-sep" />
      <Pop title="Text colour" disabled={off} badge={textColor} icon={<span className="rt-txt"><b>A</b></span>}>{(close) => <ColorMenu colors={COLORS} close={close} onPick={(c) => { setTextColor(c); exec('foreColor', c) }} />}</Pop>
      <Pop title="Highlight colour" disabled={off} badge={markColor} icon={<span className="rt-txt rt-hl">ab</span>}>{(close) => <ColorMenu colors={MARKS} close={close} allowNone noneLabel="No highlight" onPick={(c) => { setMarkColor(c === 'transparent' ? markColor : c); exec('hiliteColor', c) }} />}</Pop>
      <i className="rt-sep" />
      <B cmd="superscript" title="Superscript" on={state.sup}><span className="rt-txt">x<sup>2</sup></span></B>
      <B cmd="subscript" title="Subscript" on={state.sub}><span className="rt-txt">x<sub>2</sub></span></B>
      <i className="rt-sep" />
      <B cmd="justifyLeft" title="Align left" on={state.align === 'left'}><Align kind="left" /></B>
      <B cmd="justifyCenter" title="Align centre" on={state.align === 'center'}><Align kind="center" /></B>
      <B cmd="justifyRight" title="Align right" on={state.align === 'right'}><Align kind="right" /></B>
      <B cmd="justifyFull" title="Justify" on={state.align === 'justify'}><Align kind="justify" /></B>
      <i className="rt-sep" />
      <B cmd="insertUnorderedList" title="Bulleted list" on={state.ul}><ListIco /></B>
      <B cmd="insertOrderedList" title="Numbered list" on={state.ol}><ListIco ordered /></B>
      <i className="rt-sep" />
      <Pop title="Insert link" disabled={off} icon={<LuLink />}>{(close) => (
        <div className="rt-form"><label>Link address (select text first)</label><input className="ui-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          <div className="rt-row"><button type="button" className="btn ui-btn ui-btn-primary btn-sm" onClick={() => { if (/^(https?:\/\/|mailto:|tel:|#)/i.test(url.trim()) && url.trim().length > 8) { exec('createLink', url.trim()); close() } else window.alert('Enter a full link such as https://example.com') }}>Apply</button><button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={() => { exec('unlink'); close() }}>Remove link</button></div></div>
      )}</Pop>
      <Pop title="Insert image" disabled={off} icon={<LuImage />}>{(close) => (
        <div className="rt-form"><label className="btn ui-btn ui-btn-secondary btn-sm w-100">{busy ? 'Uploading…' : 'Upload image'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { upload(e.target.files?.[0], close); e.target.value = '' }} /></label>
          <label>…or image address</label><input className="ui-input" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} />
          <button type="button" className="btn ui-btn ui-btn-primary btn-sm" onClick={() => { if (/^https?:\/\/.{3,}/i.test(imgUrl.trim())) { exec('insertImage', imgUrl.trim()); close() } else window.alert('Enter a full image address (https://…)') }}>Insert</button></div>
      )}</Pop>
      <Pop title="Insert table" disabled={off} icon={<Svg><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="4" x2="9" y2="20" /><line x1="15" y1="4" x2="15" y2="20" /></Svg>}>{(close) => (
        <div className="rt-form"><div className="rt-row"><label>Rows<input type="number" className="ui-input" min={1} max={10} value={grid.r} onChange={(e) => setGrid((g) => ({ ...g, r: e.target.value }))} /></label><label>Columns<input type="number" className="ui-input" min={1} max={8} value={grid.c} onChange={(e) => setGrid((g) => ({ ...g, c: e.target.value }))} /></label></div>
          <button type="button" className="btn ui-btn ui-btn-primary btn-sm" onClick={() => insertTable(close)}>Insert table</button></div>
      )}</Pop>
      <i className="rt-sep" />
      <B cmd="undo" title="Undo (Ctrl+Z)"><Arrow /></B>
      <B cmd="redo" title="Redo (Ctrl+Y)"><Arrow redo /></B>
      <B cmd="clearFormat" title="Clear formatting"><span className="rt-txt">T<sub>x</sub></span></B>
      <span className="rt-hint d-none d-xl-inline">{off ? 'Click any text to format it' : ''}</span>
    </div>
  )
}
