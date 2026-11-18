import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LuArrowDown, LuArrowUp, LuCopy, LuPlus, LuTrash2 } from 'react-icons/lu'
import { fromEditable } from '../../lib/richText'
import { scrollToStudioSection } from '../../lib/jsonStudioDom'
import { handleProps, targetProps } from '../../lib/dnd'
import { useRichText } from '../ui/RichText'
import {
  IMAGE_LAYOUTS,
  LIST_STYLES,
  PRESET_MIME,
  QUICK_ADD,
  SECTION_SCHEMA,
  addExample,
  addFormula,
  addParagraph,
  addSectionBelow,
  dupItem,
  duplicateSection,
  fmt,
  insertSectionAt,
  isSectionType,
  listAddItem,
  moveItem,
  moveItemTo,
  moveSection,
  moveSectionTo,
  mutateSection,
  normalizeControls,
  removeItem,
  removeSection,
  safeImageUrl,
  setSectionValue,
  tableAddCol,
  tableAddRow,
  tableCols,
  textStyleVars,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from '../../lib/jsonStudio'

/** One inline-editable text node. The DOM is owned by the browser while the author types; React only
 *  writes to it when it is NOT focused, so the caret never jumps. Every edit is reported back (debounced).
 *  On focus it registers with the ONE sticky rich-text toolbar, so Bold / Italic / colours / links … format it live. */
function Ed({ as: Tag = 'div', value, onCommit, className = '', placeholder, multiline = false, optional = false, odia = false }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const dirty = useRef(false)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const { setTarget } = useRichText()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const v = value === undefined || value === null ? '' : String(value)
    if (el.dataset.init !== '1' || el.dataset.v !== v) {
      el.innerHTML = fmt(v)
      el.dataset.v = v
      el.dataset.init = '1'
    }
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  const flush = () => {
    clearTimeout(timer.current)
    const el = ref.current
    if (!el || !dirty.current) return
    dirty.current = false
    const v = fromEditable(el.innerHTML)
    if (v !== el.dataset.v) {
      el.dataset.v = v
      commitRef.current(v)
    }
  }
  const onInput = () => {
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 350)
  }
  const onKeyDown = (e) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }
  const onPaste = (e) => {
    e.preventDefault()
    const t = e.clipboardData.getData('text/plain') || ''
    document.execCommand('insertText', false, multiline ? t : t.replace(/\s*\n\s*/g, ' '))
  }
  const empty = value === undefined || value === null || String(value) === ''
  return (
    <Tag
      ref={ref}
      className={`${className}${optional && empty ? ' js-opt-empty' : ''}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      lang={odia ? 'or' : undefined}
      data-ph={placeholder}
      onFocus={() => setTarget({ kind: 'local', el: ref.current })}
      onInput={onInput}
      onBlur={flush}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  )
}

/** Plain text input for a link. Keeps its own value while typing so the caret never jumps, and reports every change. */
function UrlField({ value, onCommit, placeholder, label }) {
  const [v, setV] = useState(value || '')
  const last = useRef(value || '')
  useEffect(() => {
    if ((value || '') !== last.current) { last.current = value || ''; setV(value || '') }
  }, [value])
  return (
    <input
      className="js-url"
      type="text"
      inputMode="url"
      spellCheck={false}
      autoComplete="off"
      value={v}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => { last.current = e.target.value; setV(e.target.value); onCommit(e.target.value) }}
    />
  )
}

const stopFocus = (e) => e.preventDefault() // keep the text caret / selection while pressing a tool

/** Drag grip (⋮⋮) */
const Grip = ({ drag }) => (
  <span className="js-grip" role="button" aria-label="Drag to reorder" title="Drag to reorder" {...drag}>⋮⋮</span>
)

/** Compact floating toolbar for ONE element (paragraph, list item, table row, formula box, example box): drag grip + duplicate / move / delete (+ Odia). */
function ElTools({ drag, onDup, onUp, onDown, onDel, canUp, canDown, onOdia, odiaOn }) {
  return (
    <div className="js-el-tools" role="toolbar" aria-label="Element actions" onMouseDown={stopFocus}>
      {drag && <Grip drag={drag} />}
      <button type="button" onClick={onDup} title="Duplicate" aria-label="Duplicate"><LuCopy /></button>
      <button type="button" onClick={onUp} disabled={!canUp} title="Move up (swap)" aria-label="Move up"><LuArrowUp /></button>
      <button type="button" onClick={onDown} disabled={!canDown} title="Move down (swap)" aria-label="Move down"><LuArrowDown /></button>
      <button type="button" className="danger" onClick={onDel} title="Delete" aria-label="Delete"><LuTrash2 /></button>
    </div>
  )
}

/** Floating toolbar of a whole section (shown on hover / focus) */
function Tools({ i, n, drag, onDup, onUp, onDown, onAdd, onRemove }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return undefined
    const close = () => setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className={`js-tools${open ? ' open' : ''}`} role="toolbar" aria-label={`Section ${i + 1} actions`} onMouseDown={stopFocus}>
      <Grip drag={drag} />
      <button type="button" onClick={onDup} title="Duplicate section" aria-label="Duplicate section"><LuCopy /></button>
      <button type="button" onClick={onUp} disabled={i === 0} title="Move up" aria-label="Move section up"><LuArrowUp /></button>
      <button type="button" onClick={onDown} disabled={i === n - 1} title="Move down" aria-label="Move section down"><LuArrowDown /></button>
      <span className="js-menu-wrap">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }} onClick={() => setOpen((o) => !o)} title="Add section below" aria-label="Add section below" aria-haspopup="true" aria-expanded={open}><LuPlus /></button>
        {open && (
          <div className="js-menu" role="menu" onMouseDown={(e) => e.stopPropagation()}>
            {QUICK_ADD.map((q) => (
              <button type="button" role="menuitem" key={q.type} onClick={() => { setOpen(false); onAdd(q.type) }}>
                <LuPlus /> {q.label}
              </button>
            ))}
          </div>
        )}
      </span>
      <button type="button" className="danger" onClick={onRemove} title="Remove section" aria-label="Remove section"><LuTrash2 /></button>
    </div>
  )
}

/**
 * Editable studio artboard.
 *  sections – normalised sections (lib/jsonStudio)   theme – block theme id   textStyle – block typography
 *  onChange(nextSections) – write back to the JSON code     activeId / onActivate(id|null) – the section whose theme the sidebar edits
 * Every operation resolves by section id and reads the latest list from a ref, so a debounced edit can never land on the wrong section.
 */
export default function JsonStudioCanvas({ sections, theme, textStyle, onChange, maxHeight, className = '', activeId = null, onActivate, onUploadImage, onNotify }) {
  const latest = useRef(sections)
  latest.current = sections
  const [odiaOpen, setOdiaOpen] = useState(() => new Set())
  const [dropIdx, setDropIdx] = useState(null) // preset card being dragged over the artboard → insertion index
  const [uploading, setUploading] = useState('')
  const rootRef = useRef(null)
  const commit = (next) => {
    latest.current = next
    onChange(next)
  }
  const edit = (id, path, v) => {
    const cur = latest.current
    const i = cur.findIndex((s) => s.id === id)
    if (i >= 0) commit(setSectionValue(cur, i, path, v))
  }
  const op = (id, fn) => {
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur() // flush pending text first
    const cur = latest.current
    const i = cur.findIndex((s) => s.id === id)
    if (i >= 0) commit(fn(cur, i))
  }
  const mut = (id, fn) => op(id, (cur, i) => mutateSection(cur, i, fn))
  const toggleOdia = (key) => setOdiaOpen((o) => { const n = new Set(o); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const showOdia = (key, v) => !!v || odiaOpen.has(key)

  /* ---- preset cards (right sidebar) dropped on the artboard ---- */
  const isPreset = (e) => Array.from(e.dataTransfer?.types || []).includes(PRESET_MIME)
  const insertionIndex = (clientY) => {
    const els = rootRef.current ? rootRef.current.querySelectorAll(':scope > .js-edit-sec') : []
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
    }
    return els.length
  }
  const addPreset = (type, at) => {
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur()
    const next = insertSectionAt(latest.current, at, type)
    commit(next)
    const added = next[Math.min(at, next.length - 1)]
    if (added) { onActivate?.(added.id); scrollToStudioSection(added.id) }
  }
  const onPresetOver = (e) => {
    if (!isPreset(e)) return
    e.preventDefault()
    try { e.dataTransfer.dropEffect = 'copy' } catch { /* ignore */ }
    const root = rootRef.current
    if (root) {
      const r = root.getBoundingClientRect() // scroll the artboard while a card is held near its top / bottom edge
      if (e.clientY < r.top + 48) root.scrollTop -= 14
      else if (e.clientY > r.bottom - 48) root.scrollTop += 14
    }
    const i = insertionIndex(e.clientY)
    setDropIdx((cur) => (cur === i ? cur : i))
  }
  const onPresetLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropIdx(null) }
  const onPresetDrop = (e) => {
    if (!isPreset(e)) return
    e.preventDefault()
    const type = e.dataTransfer.getData(PRESET_MIME)
    const at = insertionIndex(e.clientY)
    setDropIdx(null)
    if (isSectionType(type)) addPreset(type, at)
  }
  const uploadFor = async (sid, file) => {
    if (!file || !onUploadImage) return
    setUploading(sid)
    try {
      const url = await onUploadImage(file)
      if (url) edit(sid, 'imageUrl', url)
    } catch (err) {
      onNotify?.(err?.message || 'Image upload failed.', 'error')
    } finally {
      setUploading('')
    }
  }

  /** Props bundle for one repeatable element inside a section */
  const el = (s, key, k, len, opts = {}) => {
    const scope = `${s.id}:${key}`
    const drop = targetProps({ kind: 'item', scope, index: k, onMove: (from, to) => mut(s.id, (x) => moveItemTo(x, key, from, to)) })
    const tools = (
      <ElTools
        drag={handleProps({ kind: 'item', scope, index: k })}
        onDup={() => mut(s.id, (x) => dupItem(x, key, k))}
        onUp={() => mut(s.id, (x) => moveItem(x, key, k, -1))}
        onDown={() => mut(s.id, (x) => moveItem(x, key, k, 1))}
        onDel={() => mut(s.id, (x) => removeItem(x, key, k))}
        canUp={k > 0}
        canDown={k < len - 1}
        onOdia={opts.odiaKey ? () => toggleOdia(opts.odiaKey) : undefined}
        odiaOn={opts.odiaKey ? odiaOpen.has(opts.odiaKey) : false}
      />
    )
    return { drop, tools }
  }

  const head = (s) => (
    <>
      <Ed as="span" className="js-pill" value={s.label} placeholder="Label" optional onCommit={(v) => edit(s.id, 'label', v)} />
      <Ed as="h3" className="js-h" value={s.heading} placeholder="Heading" onCommit={(v) => edit(s.id, 'heading', v)} />
      <Ed className="js-odia-h" odia value={s.odiaHeading} placeholder="+ Add Odia heading (ଓଡ଼ିଆ ଶୀର୍ଷକ)" optional onCommit={(v) => edit(s.id, 'odiaHeading', v)} />
      <Ed className="js-sub" value={s.subHeading} placeholder="Sub-heading" optional={s.type !== 'structured_header'} onCommit={(v) => edit(s.id, 'subHeading', v)} />
      {s.type === 'structured_header' && (
        <Ed className="js-odia-text" odia value={s.odiaSubHeading} placeholder="+ Add Odia sub-heading" optional onCommit={(v) => edit(s.id, 'odiaSubHeading', v)} />
      )}
    </>
  )

  const body = (s) => {
    if (s.type === 'structured_header') return head(s)

    if (s.type === 'heading_image') {
      const src = safeImageUrl(s.imageUrl)
      const layout = IMAGE_LAYOUTS.includes(s.layout) ? s.layout : 'top'
      const fig = src
        ? <figure className="js-media js-img"><img src={src} alt="" /></figure>
        : <div className="js-media-empty">No image yet — paste an image link or upload one below.</div>
      const caps = (
        <>
          <Ed className="js-caption" multiline value={s.caption} placeholder="Caption" optional onCommit={(v) => edit(s.id, 'caption', v)} />
          <Ed className="js-odia-text" multiline odia value={s.odiaCaption} placeholder="+ Add Odia caption (ଓଡ଼ିଆ ବର୍ଣ୍ଣନା)" optional onCommit={(v) => edit(s.id, 'odiaCaption', v)} />
        </>
      )
      return (
        <>
          {head(s)}
          {layout === 'top' ? <>{fig}{caps}</> : <div className={`js-split js-${layout}`}>{fig}<div className="js-split-text">{caps}</div></div>}
          <div className="js-media-ctl">
            <UrlField value={s.imageUrl} placeholder="Paste image URL (https://…)" label="Image URL" onCommit={(v) => edit(s.id, 'imageUrl', v)} />
            {onUploadImage && (
              <label className="js-chip-btn" title="Upload an image (JPG, PNG or WEBP)">
                {uploading === s.id ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading === s.id} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; uploadFor(s.id, f) }} />
              </label>
            )}
            {IMAGE_LAYOUTS.map((l) => (
              <button type="button" key={l} className={layout === l ? 'on' : ''} aria-pressed={layout === l} onClick={() => edit(s.id, 'layout', l)}>{l}</button>
            ))}
          </div>
        </>
      )
    }

    if (s.type === 'heading_youtube') {
      const c = normalizeControls(s.controls)
      const embed = youtubeEmbedUrl(s.youtubeUrl, { ...c, autoplay: false }) // never autoplay while editing
      const watch = youtubeWatchUrl(s.youtubeUrl, c)
      const setC = (patch) => edit(s.id, 'controls', { ...c, ...patch })
      const flag = (key, label) => <button type="button" key={key} className={c[key] ? 'on' : ''} aria-pressed={c[key]} onClick={() => setC({ [key]: !c[key] })}>{label}</button>
      return (
        <>
          {head(s)}
          {embed
            ? <><div className="js-media js-yt"><iframe src={embed} title={s.heading || 'YouTube video'} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
              {s.showWatchLink !== false && <div className="js-yt-link"><a href={watch} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></div>}</>
            : <div className="js-media-empty">{s.youtubeUrl ? 'This is not a recognised YouTube link.' : 'Paste a YouTube link below to show a 16:9 player.'}</div>}
          <Ed className="js-caption" multiline value={s.caption} placeholder="Caption" optional onCommit={(v) => edit(s.id, 'caption', v)} />
          <Ed className="js-odia-text" multiline odia value={s.odiaCaption} placeholder="+ Add Odia caption (ଓଡ଼ିଆ ବର୍ଣ୍ଣନା)" optional onCommit={(v) => edit(s.id, 'odiaCaption', v)} />
          <div className="js-media-ctl">
            <UrlField value={s.youtubeUrl} placeholder="Paste YouTube link (https://youtu.be/…)" label="YouTube URL" onCommit={(v) => edit(s.id, 'youtubeUrl', v)} />
            {flag('showControls', 'Controls')}
            {flag('autoplay', 'Autoplay')}
            {flag('mute', 'Mute')}
            {flag('loop', 'Loop')}
            <button type="button" className={s.showWatchLink !== false ? 'on' : ''} aria-pressed={s.showWatchLink !== false} onClick={() => edit(s.id, 'showWatchLink', s.showWatchLink === false)}>Watch link</button>
            <span className="js-num">Start (s) <input type="number" min="0" step="1" value={c.startTime} aria-label="Start time in seconds" onChange={(e) => setC({ startTime: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></span>
          </div>
        </>
      )
    }

    if (s.type === 'heading_paragraph') {
      const list = s.paragraphs || []
      return (
        <>
          {head(s)}
          {list.map((p, k) => {
            const ok = `${s.id}:p:${k}`
            const { drop, tools } = el(s, 'paragraphs', k, list.length, { odiaKey: ok })
            return (
              <div className="js-el js-pi" key={k} {...drop}>
                <Ed as="p" className="js-p" multiline value={p.text} placeholder="Write your paragraph…" onCommit={(v) => edit(s.id, `paragraphs.${k}.text`, v)} />
                {showOdia(ok, p.odiaText) && <Ed className="js-odia-text" multiline odia value={p.odiaText} placeholder="Odia explanation (ଓଡ଼ିଆ ବ୍ୟାଖ୍ୟା)…" onCommit={(v) => edit(s.id, `paragraphs.${k}.odiaText`, v)} />}
                {tools}
              </div>
            )
          })}
          <div className="js-mini" onMouseDown={stopFocus}>
            <button type="button" onClick={() => mut(s.id, addParagraph)}>+ Paragraph</button>
          </div>
        </>
      )
    }

    if (s.type === 'heading_list') {
      const style = LIST_STYLES.includes(s.listStyle) ? s.listStyle : 'bullet'
      const list = s.items || []
      return (
        <>
          {head(s)}
          <ul className={`js-list ${style}`}>
            {list.map((it, k) => {
              const ok = `${s.id}:i:${k}`
              const { drop, tools } = el(s, 'items', k, list.length, { odiaKey: ok })
              return (
                <li className="js-el" key={k} {...drop}>
                  <div className="js-li-body">
                    <Ed value={it.text} placeholder="List item" onCommit={(v) => edit(s.id, `items.${k}.text`, v)} />
                    {showOdia(ok, it.odiaText) && <Ed className="js-odia-text" odia value={it.odiaText} placeholder="Odia explanation…" onCommit={(v) => edit(s.id, `items.${k}.odiaText`, v)} />}
                  </div>
                  {tools}
                </li>
              )
            })}
          </ul>
          <div className="js-mini" onMouseDown={stopFocus}>
            <button type="button" onClick={() => mut(s.id, listAddItem)}>+ Item</button>
            {LIST_STYLES.map((ls) => (
              <button type="button" key={ls} onClick={() => edit(s.id, 'listStyle', ls)} style={style === ls ? { background: 'color-mix(in srgb,var(--js-accent) 22%,transparent)' } : undefined}>{ls}</button>
            ))}
          </div>
        </>
      )
    }

    if (s.type === 'heading_table') {
      const cols = tableCols(s)
      const pad = (r) => Array.from({ length: cols }, (_, c) => r[c] ?? '')
      const rows = s.rows || []
      return (
        <>
          {head(s)}
          <div className="js-table-scroll js-table-wrap table-responsive">
            <table className="js-table">
              {(s.headers || []).length > 0 && (
                <thead>
                  <tr>
                    {pad(s.headers).map((h, c) => (
                      <Ed as="th" key={c} value={h} placeholder="Heading" onCommit={(v) => edit(s.id, `headers.${c}`, v)} />
                    ))}
                    <th className="js-row-ctl" aria-hidden="true" />
                  </tr>
                </thead>
              )}
              <tbody>
                {rows.map((r, ri) => {
                  const { drop, tools } = el(s, 'rows', ri, rows.length)
                  return (
                    <tr key={ri} className="js-el" {...drop}>
                      {pad(r).map((c, ci) => (
                        <Ed as="td" key={ci} value={c} placeholder="Cell" onCommit={(v) => edit(s.id, `rows.${ri}.${ci}`, v)} />
                      ))}
                      <td className="js-row-ctl">{tools}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Ed className="js-odia-text js-odia-note" odia value={s.odiaNote} placeholder="+ Add Odia note (ଓଡ଼ିଆ ଟିପ୍ପଣୀ)" optional onCommit={(v) => edit(s.id, 'odiaNote', v)} />
          <div className="js-mini" onMouseDown={stopFocus}>
            <button type="button" onClick={() => mut(s.id, tableAddRow)}>+ Row</button>
            <button type="button" onClick={() => mut(s.id, tableAddCol)}>+ Column</button>
            <button type="button" onClick={() => mut(s.id, (x) => { const n = tableCols(x); if (n > 1) { x.headers = (x.headers || []).slice(0, n - 1); x.rows = (x.rows || []).map((r) => r.slice(0, n - 1)) } })} disabled={cols <= 1}>− Column</button>
          </div>
        </>
      )
    }

    if (s.type === 'callout_formula') {
      const list = s.formulas || []
      return (
        <>
          {head(s)}
          {list.map((f, k) => {
            const ok = `${s.id}:f:${k}`
            const { drop, tools } = el(s, 'formulas', k, list.length, { odiaKey: ok })
            return (
              <div className="js-el js-fbox" key={f.id || k} {...drop}>
                <Ed className="js-formula" multiline value={f.expression} placeholder="Formula / equation…" onCommit={(v) => edit(s.id, `formulas.${k}.expression`, v)} />
                <Ed className="js-expl" multiline value={f.explanation} placeholder="Explanation" optional onCommit={(v) => edit(s.id, `formulas.${k}.explanation`, v)} />
                {showOdia(ok, f.odiaExplain) && <Ed className="js-odia-text" multiline odia value={f.odiaExplain} placeholder="Odia explanation (ଓଡ଼ିଆ ବ୍ୟାଖ୍ୟା)…" onCommit={(v) => edit(s.id, `formulas.${k}.odiaExplain`, v)} />}
                {tools}
              </div>
            )
          })}
          <div className="js-mini" onMouseDown={stopFocus}>
            <button type="button" onClick={() => mut(s.id, addFormula)}>+ Formula</button>
          </div>
        </>
      )
    }

    // heading_example
    const list = s.examples || []
    return (
      <>
        {head(s)}
        {list.map((x, k) => {
          const ok = `${s.id}:e:${k}`
          const { drop, tools } = el(s, 'examples', k, list.length, { odiaKey: ok })
          return (
            <div className="js-el js-ex-item" key={x.id || k} {...drop}>
              <Ed className="js-ex-title" value={x.title} placeholder="Example title" optional onCommit={(v) => edit(s.id, `examples.${k}.title`, v)} />
              <Ed className="js-ex-body" multiline value={x.detail} placeholder="Describe the example…" onCommit={(v) => edit(s.id, `examples.${k}.detail`, v)} />
              {showOdia(ok, x.odiaExplain) && <Ed className="js-odia-text" multiline odia value={x.odiaExplain} placeholder="Odia explanation (ଓଡ଼ିଆ ବ୍ୟାଖ୍ୟା)…" onCommit={(v) => edit(s.id, `examples.${k}.odiaExplain`, v)} />}
              {tools}
            </div>
          )
        })}
        <div className="js-mini" onMouseDown={stopFocus}>
          <button type="button" onClick={() => mut(s.id, addExample)}>+ Example</button>
        </div>
      </>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`json-artboard-content js-editing ${className}`}
      data-theme={theme}
      style={{ ...textStyleVars(textStyle), ...(maxHeight ? { maxHeight } : {}) }}
      aria-label="JSON content artboard"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onActivate?.(null) }}
      onDragOver={onPresetOver}
      onDragLeave={onPresetLeave}
      onDrop={onPresetDrop}
    >
      {sections.length === 0 && (
        <div className="js-empty">
          <div>This lesson has no sections yet.</div>
          <button type="button" onClick={() => commit(addSectionBelow([], -1, 'heading_paragraph'))}>+ Add first section</button>
        </div>
      )}
      {sections.map((s, i) => (
        <Fragment key={s.id}>
        {dropIdx === i && <div className="js-drop-line" aria-hidden="true" />}
        <section
          id={`js-sec-${s.id}`}
          className={`js-sec js-edit-sec js-${s.type.replace(/_/g, '-')}${activeId === s.id ? ' js-active' : ''}`}
          data-type={s.type}
          data-theme={s.theme || undefined}
          aria-label={SECTION_SCHEMA[s.type]?.label}
          onMouseDownCapture={() => { if (activeId !== s.id) onActivate?.(s.id) }}
          onFocusCapture={() => { if (activeId !== s.id) onActivate?.(s.id) }}
          {...targetProps({ kind: 'section', scope: 'sections', index: i, onMove: (from, to) => op(s.id, (cur) => moveSectionTo(cur, from, to)) })}
        >
          <Tools
            i={i}
            n={sections.length}
            drag={handleProps({ kind: 'section', scope: 'sections', index: i })}
            onDup={() => op(s.id, (cur, k) => duplicateSection(cur, k))}
            onUp={() => op(s.id, (cur, k) => moveSection(cur, k, -1))}
            onDown={() => op(s.id, (cur, k) => moveSection(cur, k, 1))}
            onAdd={(type) => op(s.id, (cur, k) => addSectionBelow(cur, k, type))}
            onRemove={() => op(s.id, (cur, k) => removeSection(cur, k))}
          />
          {body(s)}
        </section>
        </Fragment>
      ))}
      {dropIdx !== null && dropIdx >= sections.length && <div className="js-drop-line" aria-hidden="true" />}
    </div>
  )
}
