import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuBookOpen,
  LuBraces,
  LuCheck,
  LuCircleAlert,
  LuCircleCheck,
  LuCopy,
  LuDownload,
  LuEraser,
  LuEye,
  LuImage,
  LuLink,
  LuMaximize2,
  LuMinimize2,
  LuPencil,
  LuSave,
  LuSearch,
  LuSparkles,
  LuUpload,
  LuWandSparkles,
  LuX,
} from 'react-icons/lu'
import { fromEditable } from '../../lib/richText'
import { cmAction } from '../../lib/cmActions'
import { setByPath } from '../../lib/editBridge'
import { downloadText, readFileText } from '../../lib/id'
import {
  DEFAULT_JSON_DISPLAY,
  DEFAULT_JSON_STYLE,
  JSON_HELP,
  JSON_RENDERERS,
  JSON_TEMPLATES,
  STYLE_PRESETS,
  validateLessonJson,
} from '../../lib/jsonLesson'
import { frameProps } from '../../lib/blockRender'
import { uploadImage } from '../../services/storageService'
import Modal from '../Modal'
import { DeviceToggle, Field, NumberField, Section, Tabs, Toggle, deviceWidth } from '../ui/Controls'
import { useRichText } from '../ui/RichText'
import SandboxFrame from '../ui/SandboxFrame'
import { EditorFallback } from './HtmlBlockEditor'
import { useToast } from '../Toast'
import { useConfirm } from '../ui/Confirm'

const CodeEditor = lazy(() => import('../ui/CodeEditor'))
const FONTS = ['Inter', 'Poppins', 'Noto Sans Oriya', 'Georgia', 'system-ui']

function mergeLessons(cur, inc) {
  const a = Array.isArray(cur) ? { sections: cur } : { ...cur }
  const b = Array.isArray(inc) ? { sections: inc } : inc
  const out = { ...b, ...a }
  ;['points', 'sections'].forEach((k) => {
    if (Array.isArray(a[k]) || Array.isArray(b[k]))
      out[k] = [...(a[k] || []), ...(b[k] || [])]
  })
  return out
}

/**
 * Enhanced JSON Block Editor (Change 8)
 * 1. Top toolbar contains only Format, Find, Undo, Redo, Templates, and Clear.
 * 2. Bottom Action Bar strictly ordered:
 *    [Validation Status] [JSON Format Guide] [Import JSON] [Export JSON] [From URL] ... [Save JSON (Right)]
 * 3. Save JSON validates before saving and prevents saving invalid JSON.
 * 4. Format Guide has full Copy Example with 'Copied!' toast/badge.
 * 5. Full Edit Text on Canvas synchronization preserved.
 */
export function JsonCenter({ block, setData, ui, setUi }) {
  const d = block.data
  const toast = useToast()
  const confirm = useConfirm()
  const rich = useRichText()
  const fileRef = useRef(null)
  const viewRef = useRef(null)

  const [url, setUrl] = useState('')
  const [urlOpen, setUrlOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [guideCopied, setGuideCopied] = useState(false)
  const [pending, setPending] = useState(null)
  const [snap, setSnap] = useState(null)
  const [big, setBig] = useState(false)
  const [bigEd, setBigEd] = useState(false)
  const [details, setDetails] = useState(false)
  const [savingJson, setSavingJson] = useState(false)

  const dRef = useRef(d)
  dRef.current = d
  const act = useRef({})
  act.current = { setData, toast }

  const textEdit = !!ui.canvasEdit
  const check = useMemo(() => validateLessonJson(d.json), [d.json])

  useEffect(() => {
    setSnap(textEdit ? dRef.current.json : null)
  }, [textEdit])

  const shown = textEdit && snap !== null ? snap : d.json
  const fp = useMemo(
    () => frameProps({ type: 'json', data: { ...d, json: shown } }, { textEdit }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, d.style, d.display, d.renderer, d.packages, d.customCss, d.customJs, textEdit]
  )

  const bridge = useMemo(
    () => ({
      onFocus: rich.setTarget,
      onState: rich.setState,
      onEdit: (e) => {
        if (!e.path) return
        const v = validateLessonJson(dRef.current.json)
        if (!v.data)
          return act.current.toast(
            'Fix the JSON errors before editing text in the preview.',
            'error'
          )
        const obj = JSON.parse(JSON.stringify(v.data))
        if (setByPath(obj, e.path, fromEditable(e.html)))
          act.current.setData({ json: JSON.stringify(obj, null, 2) })
      },
    }),
    [rich.setTarget, rich.setState]
  )

  const setJson = (v) => {
    setData({ json: v })
    if (textEdit) setUi({ canvasEdit: false })
  }

  const format = () => {
    const v = validateLessonJson(d.json)
    if (!v.data) {
      setDetails(true)
      return toast('Fix the JSON errors first, then format.', 'error')
    }
    setJson(JSON.stringify(JSON.parse(d.json), null, 2))
    toast('JSON formatted ✓')
  }

  const readJsonFile = async (f) => {
    if (!f) return
    if (!/\.json$/i.test(f.name) && f.type !== 'application/json')
      return toast('Please choose a .json file', 'error')
    if (f.size > 500 * 1024) return toast('JSON file must be under 500 KB', 'error')
    const t = await readFileText(f)
    const v = validateLessonJson(t)
    if (!v.ok) {
      setJson(t)
      setDetails(true)
      return toast(`Imported, but file has errors: ${v.errors[0].message}`, 'error')
    }
    if (!d.json.trim()) {
      setJson(JSON.stringify(JSON.parse(t), null, 2))
      toast(`Loaded ${f.name}`)
    } else {
      setPending({ name: f.name, text: t })
    }
  }

  const applyImport = (mode) => {
    try {
      if (mode === 'replace') setJson(JSON.stringify(JSON.parse(pending.text), null, 2))
      else {
        const cur = validateLessonJson(d.json)
        if (!cur.data) throw new Error('Current JSON has errors — fix it or choose Replace.')
        setJson(JSON.stringify(mergeLessons(cur.data, JSON.parse(pending.text)), null, 2))
      }
      toast(mode === 'replace' ? 'Content replaced' : 'Content appended')
    } catch (e) {
      toast(e.message, 'error')
    }
    setPending(null)
  }

  const importUrl = async () => {
    if (!/^https:\/\//i.test(url.trim())) return toast('Enter a valid https:// URL', 'error')
    try {
      const res = await fetch(url.trim())
      if (!res.ok) throw new Error(res.status)
      const t = await res.text()
      setPending({ name: 'URL', text: t })
      setUrlOpen(false)
    } catch {
      toast('Could not fetch URL directly. Download it and use Import JSON.', 'error')
    }
  }

  const applyTemplate = async (t) => {
    setTplOpen(false)
    if (
      d.json.trim() &&
      !(await confirm({
        title: `Use “${t.label}” template?`,
        message: 'This replaces the JSON currently in the editor.',
        confirmText: 'Use template',
      }))
    )
      return
    setJson(JSON.stringify(t.json, null, 2))
    toast(`${t.label} loaded`)
  }

  const exportJson = () => {
    downloadText(`${(block.title || 'lesson').replace(/\W+/g, '-')}.json`, d.json)
    toast('Download started')
  }

  /* Requirement 3: Dedicated Save JSON button */
  const handleSaveJson = () => {
    setSavingJson(true)
    const v = validateLessonJson(d.json)
    if (!v.ok) {
      setDetails(true)
      setSavingJson(false)
      toast(`Cannot save invalid JSON: ${v.errors[0].message}`, 'error')
      return
    }
    // Format and persist
    try {
      const formatted = JSON.stringify(JSON.parse(d.json), null, 2)
      setData({ json: formatted })
      toast('Valid JSON saved to block storage ✓')
    } catch {
      setData({ json: d.json })
      toast('JSON saved to block storage ✓')
    } finally {
      setSavingJson(false)
    }
  }

  const copyGuideExample = () => {
    navigator.clipboard?.writeText(JSON_HELP)
    setGuideCopied(true)
    toast('JSON format example copied to clipboard!')
    setTimeout(() => setGuideCopied(false), 2500)
  }

  return (
    <div className="editor-stack">
      {/* 1. Live Preview */}
      <div className={`ed-card ${big ? 'ed-fullscreen' : ''}`}>
        <div className="ed-card-head">
          <span className="ttl">
            <LuEye /> Live Preview <span className="pill pill-info ms-1">Full width</span>
          </span>
          <span className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className={`btn ui-btn btn-sm ${textEdit ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
              onClick={() => setUi({ canvasEdit: !textEdit })}
              disabled={!check.ok && !textEdit}
              title="Click and edit text directly in the preview"
            >
              <LuPencil /> {textEdit ? 'Done editing text' : 'Edit text on canvas'}
            </button>
            <DeviceToggle value={ui.device || 'desktop'} onChange={(v) => setUi({ device: v })} />
            <button
              className="icon-mini"
              onClick={() => setBig((b) => !b)}
              aria-label={big ? 'Exit full screen' : 'Full screen preview'}
            >
              {big ? <LuMinimize2 /> : <LuMaximize2 />}
            </button>
          </span>
        </div>
        <div className="ed-preview light-canvas">
          <SandboxFrame {...fp} width={deviceWidth(ui.device)} minHeight={120} bridge={bridge} />
        </div>
        <p className="ed-hint">
          {textEdit
            ? 'Text editing is on. Click any text on the canvas to update its content.'
            : 'The preview updates automatically whenever the JSON changes.'}
        </p>
      </div>

      {/* 2. JSON Editor Card */}
      <div className={`ed-card ${bigEd ? 'ed-fullscreen' : ''}`}>
        <div className="ed-card-head">
          <span className="ttl">
            <LuBraces /> JSON Editor
          </span>
          <button
            className="icon-mini"
            onClick={() => setBigEd((b) => !b)}
            aria-label={bigEd ? 'Exit full screen' : 'Full screen'}
          >
            {bigEd ? <LuMinimize2 /> : <LuMaximize2 />}
          </button>
        </div>

        {/* Top Toolbar (Rearranged per Requirement 1: Only format, search, undo, redo, templates, clear) */}
        <div className="code-toolbar" role="toolbar" aria-label="JSON tools">
          <button type="button" onClick={format} title="Format JSON (Ctrl+Shift+F)">
            <LuWandSparkles /> Format
          </button>
          <button
            type="button"
            onClick={() => cmAction(viewRef.current, 'find')}
            title="Find & replace (Ctrl+F)"
          >
            <LuSearch /> Find
          </button>
          <button type="button" onClick={() => cmAction(viewRef.current, 'undo')} title="Undo">
            ↶ Undo
          </button>
          <button type="button" onClick={() => cmAction(viewRef.current, 'redo')} title="Redo">
            ↷ Redo
          </button>
          <i className="rt-sep" />
          <span className="code-menu">
            <button
              type="button"
              onClick={() => setTplOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={tplOpen}
            >
              <LuSparkles /> Templates ▾
            </button>
            {tplOpen && (
              <div className="rt-menu" role="menu">
                {JSON_TEMPLATES.map((t) => (
                  <button type="button" key={t.id} onClick={() => applyTemplate(t)}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </span>
          <button
            type="button"
            onClick={async () => {
              if (
                await confirm({
                  title: 'Clear JSON?',
                  message: 'This removes all JSON content from this block.',
                  danger: true,
                  confirmText: 'Clear',
                })
              )
                setJson('')
            }}
          >
            <LuEraser /> Clear
          </button>
        </div>

        {/* URL Fetch Input Box (when toggled from bottom bar) */}
        {urlOpen && (
          <div className="p-2 d-flex gap-2 flex-wrap border-bottom">
            <input
              className="ui-input flex-grow-1"
              placeholder="https://example.com/lesson.json"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="JSON URL"
            />
            <button className="btn ui-btn ui-btn-primary btn-sm" onClick={importUrl}>
              <LuDownload /> Fetch
            </button>
            <button className="btn ui-btn ui-btn-ghost btn-sm" onClick={() => setUrlOpen(false)}>
              <LuX />
            </button>
          </div>
        )}

        {/* CodeMirror JSON Editor */}
        <Suspense fallback={<EditorFallback />}>
          <CodeEditor
            lang="json"
            value={d.json || ''}
            onChange={setJson}
            height={bigEd ? 'calc(100vh - 280px)' : '320px'}
            ariaLabel="JSON content"
            onReady={(v) => {
              viewRef.current = v
            }}
            onFormat={format}
          />
        </Suspense>

        {/* Requirement 2: Bottom Action Bar Strictly Ordered:
            1. JSON Validation Status
            2. JSON Format Guide
            3. Import JSON
            4. Export JSON
            5. From URL
            6. Save JSON (Right Aligned) */}
        <div className="json-bottom-action-bar d-flex align-items-center justify-content-between p-2 px-3 border-top flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* 1. Validation Status */}
            <button
              type="button"
              className={`json-status-pill ${check.ok ? 'is-valid' : 'is-invalid'}`}
              onClick={() => setDetails((v) => !v)}
              title={check.ok ? 'JSON is valid' : 'Click to view validation errors'}
            >
              {check.ok ? (
                <>
                  <LuCircleCheck /> Valid JSON
                </>
              ) : (
                <>
                  <LuCircleAlert /> Invalid ({check.errors.length} errors)
                </>
              )}
            </button>

            {/* 2. JSON Format Guide */}
            <button
              type="button"
              className="btn ui-btn ui-btn-secondary btn-sm"
              onClick={() => setGuideModalOpen(true)}
              title="Open JSON Format Guide with copyable example"
            >
              <LuBookOpen /> Format Guide
            </button>

            {/* 3. Import JSON */}
            <button
              type="button"
              className="btn ui-btn ui-btn-secondary btn-sm"
              onClick={() => fileRef.current?.click()}
              title="Import a .json file"
            >
              <LuUpload /> Import JSON
            </button>

            {/* 4. Export JSON */}
            <button
              type="button"
              className="btn ui-btn ui-btn-secondary btn-sm"
              onClick={exportJson}
              title="Download as .json"
            >
              <LuDownload /> Export JSON
            </button>

            {/* 5. From URL */}
            <button
              type="button"
              className={`btn ui-btn btn-sm ${urlOpen ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
              onClick={() => setUrlOpen((o) => !o)}
              title="Fetch JSON from external URL"
            >
              <LuLink /> From URL
            </button>
          </div>

          {/* 6. Save JSON (Right Aligned) */}
          <div className="ms-auto">
            <button
              type="button"
              className="btn ui-btn ui-btn-primary btn-sm px-3 fw-bold"
              onClick={handleSaveJson}
              disabled={savingJson}
              title="Validate and save JSON content to block storage"
            >
              <LuSave /> Save JSON
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              readJsonFile(e.target.files[0])
              e.target.value = ''
            }}
          />
        </div>

        {/* Validation Errors Dropdown/Details */}
        {details && !check.ok && (
          <div className="p-2 border-top bg-darker">
            <ul className="err-list m-0">
              {check.errors.map((e, i) => (
                <li key={i} className="text-danger small">
                  {e.message}
                  {e.line ? ` (line ${e.line}, col ${e.col})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <Modal
        show={!!pending}
        onClose={() => setPending(null)}
        className="ui-modal ui-modal-md"
        labelledBy="json-imp"
      >
        <div className="ui-modal-head">
          <span className="ui-modal-icon">
            <LuUpload />
          </span>
          <div className="flex-grow-1">
            <h2 id="json-imp">Import {pending?.name}</h2>
            <p>Replace current content, or append sections to it.</p>
          </div>
          <button className="ui-x" onClick={() => setPending(null)} aria-label="Close">
            <LuX />
          </button>
        </div>
        <div className="ui-modal-foot">
          <button className="btn ui-btn ui-btn-secondary" onClick={() => setPending(null)}>
            Cancel
          </button>
          <button className="btn ui-btn ui-btn-secondary" onClick={() => applyImport('append')}>
            Append
          </button>
          <button className="btn ui-btn ui-btn-primary" onClick={() => applyImport('replace')}>
            Replace
          </button>
        </div>
      </Modal>

      {/* Requirement 4: JSON Format Guide Modal with Copy Functionality */}
      <Modal
        show={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        className="ui-modal ui-modal-lg"
        labelledBy="guide-title"
      >
        <div className="ui-modal-head">
          <span className="ui-modal-icon">
            <LuBookOpen />
          </span>
          <div className="flex-grow-1">
            <h2 id="guide-title">JSON Format Guide</h2>
            <p>Use this structure to organize headings, paragraphs, lists, and images.</p>
          </div>
          <button className="ui-x" onClick={() => setGuideModalOpen(false)} aria-label="Close">
            <LuX />
          </button>
        </div>
        <div className="ui-modal-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small text-soft fw-semibold">Example Structure</span>
            <button
              type="button"
              className="btn ui-btn ui-btn-primary btn-sm py-1 px-3"
              onClick={copyGuideExample}
            >
              {guideCopied ? (
                <>
                  <LuCheck /> Copied!
                </>
              ) : (
                <>
                  <LuCopy /> Copy Complete Example
                </>
              )}
            </button>
          </div>
          <pre
            className="json-help p-3 rounded"
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              background: '#040d1f',
              border: '1px solid rgba(40,180,255,0.25)',
              color: '#38bdf8',
              fontSize: '0.85rem',
            }}
          >
            {JSON_HELP}
          </pre>
        </div>
        <div className="ui-modal-foot">
          <button
            type="button"
            className="btn ui-btn ui-btn-secondary"
            onClick={() => setGuideModalOpen(false)}
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="ui-color">
      <span>{label}</span>
      <span className="box">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <code>{value}</code>
      </span>
    </label>
  )
}

/** Right Sidebar Properties for JSON Block */
export function JsonProps({ block, setBlock, setData, ui, setUi, onSave, dirty, portalId }) {
  const d = block.data
  const st = { ...DEFAULT_JSON_STYLE, ...d.style }
  const setStyle = (p) => setData({ style: { ...st, ...p } })
  const tab = ui.jsonProps || 'content'
  const toast = useToast()
  const [imgUrl, setImgUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedSidebar, setCopiedSidebar] = useState(false)

  const onImg = async (f) => {
    if (!f) return
    setBusy(true)
    try {
      const u = await uploadImage(f, `media/${portalId}`, { max: 900 })
      let parsed = JSON.parse(d.json || '{}')
      if (Array.isArray(parsed)) parsed = { sections: parsed }
      if (!parsed || typeof parsed !== 'object')
        throw new Error('The JSON root must be an object or an array of sections.')
      if (!Array.isArray(parsed.sections)) parsed.sections = []
      if (!parsed.sections.length)
        parsed.sections.push({ heading: 'Image section', text: 'Add your explanation here.' })
      let target = parsed.sections.findIndex(
        (section) => section && typeof section === 'object' && !Array.isArray(section)
      )
      if (target < 0) {
        parsed.sections.push({ heading: 'Image section', text: 'Add your explanation here.' })
        target = parsed.sections.length - 1
      }
      parsed.sections[target] = {
        ...parsed.sections[target],
        image: { src: u, alt: f.name || 'Lesson image' },
      }
      const nextJson = JSON.stringify(parsed, null, 2)
      const validation = validateLessonJson(nextJson)
      if (!validation.ok)
        throw new Error(validation.errors[0]?.message || 'The resulting JSON is invalid.')
      setImgUrl(u)
      setData({ json: nextJson })
      toast('Image inserted into JSON and preview updated ✓')
    } catch (e) {
      toast(
        e instanceof SyntaxError
          ? 'Fix the JSON structure before inserting an image.'
          : e.message || 'Image upload failed.',
        'error'
      )
    } finally {
      setBusy(false)
    }
  }

  const copySidebarHelp = () => {
    navigator.clipboard?.writeText(JSON_HELP)
    setCopiedSidebar(true)
    toast('JSON example copied!')
    setTimeout(() => setCopiedSidebar(false), 2500)
  }

  const Color = ({ k, label }) => (
    <ColorInput label={label} value={st[k]} onChange={(v) => setStyle({ [k]: v })} />
  )

  return (
    <div className="props">
      <Tabs
        value={tab}
        onChange={(v) => setUi({ jsonProps: v })}
        items={[
          { value: 'content', label: 'Content' },
          { value: 'style', label: 'Style' },
          { value: 'spacing', label: 'Spacing' },
          { value: 'advanced', label: 'Advanced' },
        ]}
        className="props-tabs"
      />

      {tab === 'content' && (
        <>
          <Field label="Block Title">
            <input
              className="ui-input"
              value={block.title}
              onChange={(e) => setBlock({ title: e.target.value })}
              maxLength={120}
            />
          </Field>

          <Section title="Template / Renderer">
            <Field label="Renderer">
              <select
                className="ui-input ui-select"
                value={d.renderer || 'lesson'}
                onChange={(e) => setData({ renderer: e.target.value })}
              >
                {JSON_RENDERERS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Display Options">
            {[
              ['showTitle', 'Show title'],
              ['showDescription', 'Show description'],
              ['numberedSections', 'Numbered sections'],
              ['keyPointsAsList', 'Show key points as list'],
            ].map(([k, label]) => (
              <div className="prop-row" key={k}>
                <span>{label}</span>
                <Toggle
                  checked={
                    (d.display || DEFAULT_JSON_DISPLAY)[k] ?? DEFAULT_JSON_DISPLAY[k]
                  }
                  onChange={(v) =>
                    setData({
                      display: { ...DEFAULT_JSON_DISPLAY, ...(d.display || {}), [k]: v },
                    })
                  }
                  small
                />
              </div>
            ))}
          </Section>

          <Section title="Image Helper" icon={<LuImage />}>
            <p className="small text-soft mb-2">
              Upload an image to insert it into the first JSON section automatically.
            </p>
            <label className="btn ui-btn ui-btn-secondary w-100">
              {busy ? <span className="spinner-border spinner-border-sm" /> : <LuUpload />} Upload image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  onImg(e.target.files[0])
                  e.target.value = ''
                }}
              />
            </label>
            {imgUrl && (
              <div className="mt-2">
                <img src={imgUrl} alt="Uploaded lesson preview" className="json-upload-preview" />
                <small className="d-block text-success mt-1">Image inserted into JSON.</small>
              </div>
            )}
          </Section>

          {/* Format Guide in Sidebar with Copy Example */}
          <Section title="JSON Format Guide" defaultOpen={false}>
            <div className="d-flex justify-content-end mb-2">
              <button
                type="button"
                className="btn ui-btn ui-btn-secondary btn-sm py-0 px-2"
                onClick={copySidebarHelp}
              >
                {copiedSidebar ? <><LuCheck /> Copied!</> : <><LuCopy /> Copy</>}
              </button>
            </div>
            <pre className="json-help">{JSON_HELP}</pre>
          </Section>
        </>
      )}

      {tab === 'style' && (
        <>
          <Section title="Theme Presets">
            <div className="preset-grid">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset ${st.preset === p.id ? 'on' : ''}`}
                  onClick={() => setStyle({ preset: p.id })}
                >
                  <span className={`pv pv-${p.id}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Typography">
            <div className="row g-2">
              <div className="col-7">
                <Field label="Title Font">
                  <select
                    className="ui-input ui-select"
                    value={st.titleFont}
                    onChange={(e) => setStyle({ titleFont: e.target.value })}
                  >
                    {FONTS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-5">
                <NumberField
                  label="Title Size"
                  value={st.titleSize}
                  min={14}
                  max={48}
                  onChange={(v) => setStyle({ titleSize: v })}
                  suffix="px"
                />
              </div>
              <div className="col-7">
                <Field label="Text Font">
                  <select
                    className="ui-input ui-select"
                    value={st.textFont}
                    onChange={(e) => setStyle({ textFont: e.target.value })}
                  >
                    {FONTS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-5">
                <NumberField
                  label="Text Size"
                  value={st.textSize}
                  min={12}
                  max={24}
                  onChange={(v) => setStyle({ textSize: v })}
                  suffix="px"
                />
              </div>
              <div className="col-6">{Color({ k: 'titleColor', label: 'Title Color' })}</div>
              <div className="col-6">{Color({ k: 'textColor', label: 'Text Color' })}</div>
            </div>
          </Section>
          <Section title="Colors & Background" defaultOpen={false}>
            <div className="row g-2">
              <div className="col-6">{Color({ k: 'accent', label: 'Accent' })}</div>
              <div className="col-6">{Color({ k: 'headingBg', label: 'Heading Bar' })}</div>
              <div className="col-6">{Color({ k: 'background', label: 'Background' })}</div>
              <div className="col-6">{Color({ k: 'borderColor', label: 'Border' })}</div>
            </div>
          </Section>
        </>
      )}

      {tab === 'spacing' && (
        <Section title="Block Spacing">
          <div className="row g-2">
            <div className="col-6">
              <NumberField
                label="Padding"
                value={st.padding}
                onChange={(v) => setStyle({ padding: v })}
                suffix="px"
              />
            </div>
            <div className="col-6">
              <NumberField
                label="Margin"
                value={st.margin}
                onChange={(v) => setStyle({ margin: v })}
                suffix="px"
              />
            </div>
          </div>
        </Section>
      )}

      {tab === 'advanced' && (
        <>
          <div className="prop-row">
            <span>Show in Chapter</span>
            <Toggle checked={block.visible} onChange={(v) => setBlock({ visible: v })} small />
          </div>
        </>
      )}

      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave}>
        <LuSave /> {dirty ? 'Save Block' : 'Saved'}
      </button>
    </div>
  )
}
