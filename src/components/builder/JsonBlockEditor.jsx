import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { LuBraces, LuCircleAlert, LuCircleCheck, LuDownload, LuEraser, LuEye, LuFileText, LuImage, LuLink, LuSave, LuSparkles, LuUpload, LuWandSparkles } from 'react-icons/lu'
import { downloadText, readFileText } from '../../lib/id'
import { DEFAULT_JSON_STYLE, JSON_HELP, SAMPLE_LESSON, STYLE_PRESETS, validateLessonJson } from '../../lib/jsonLesson'
import { frameProps } from '../../lib/blockRender'
import { uploadImage } from '../../services/storageService'
import { DeviceToggle, Field, NumberField, Section, Tabs, Toggle, deviceWidth } from '../ui/Controls'
import PackageManager from '../ui/PackageManager'
import SandboxFrame from '../ui/SandboxFrame'
import { EditorFallback } from './HtmlBlockEditor'
import { useToast } from '../Toast'
import { useConfirm } from '../ui/Confirm'

const CodeEditor = lazy(() => import('../ui/CodeEditor'))
const FONTS = ['Inter', 'Poppins', 'Noto Sans Oriya', 'Georgia', 'system-ui']

export function JsonCenter({ block, setData, ui, setUi }) {
  const d = block.data
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef(null)
  const [url, setUrl] = useState('')
  const [check, setCheck] = useState(null)
  const mode = ui.jsonMode || 'code'
  const fp = useMemo(() => frameProps(block), [block])

  const setJson = (v) => { setData({ json: v }); setCheck(null) }
  const validate = () => { const v = validateLessonJson(d.json); setCheck(v); return v }
  const format = () => { const v = validateLessonJson(d.json); if (!v.data) { setCheck(v); return } setJson(JSON.stringify(JSON.parse(d.json), null, 2)); toast('JSON formatted') }
  const onFile = async (f) => {
    if (!f) return
    if (!/\.json$/i.test(f.name) && f.type !== 'application/json') return toast('Please choose a .json file', 'error')
    if (f.size > 500 * 1024) return toast('JSON file must be under 500 KB', 'error')
    const t = await readFileText(f); setJson(t); setUi({ jsonMode: 'code' }); setCheck(validateLessonJson(t)); toast(`Loaded ${f.name}`)
  }
  const importUrl = async () => {
    if (!/^https:\/\//i.test(url.trim())) return toast('Enter a valid https:// URL', 'error')
    try {
      const res = await fetch(url.trim()); if (!res.ok) throw new Error(res.status)
      const t = await res.text(); setJson(t); setUi({ jsonMode: 'code' }); setCheck(validateLessonJson(t)); toast('JSON imported')
    } catch { toast('Could not fetch this URL (it may block cross-site requests). Download it and use Upload File.', 'error') }
  }

  return (
    <div className="editor-stack">
      <div className="ed-card">
        <div className="ed-card-head">
          <span className="ttl"><LuEye /> Live Preview</span>
          <DeviceToggle value={ui.device || 'desktop'} onChange={(v) => setUi({ device: v })} />
        </div>
        <div className="ed-preview light-canvas"><SandboxFrame {...fp} width={deviceWidth(ui.device)} /></div>
      </div>
      <div className="ed-card">
        <div className="ed-card-head">
          <span className="ttl"><LuBraces /> JSON Input</span>
          <Tabs value={mode} onChange={(v) => setUi({ jsonMode: v })} size="sm" items={[
            { value: 'code', label: 'Code Input', icon: <LuFileText /> }, { value: 'upload', label: 'Upload File', icon: <LuUpload /> }, { value: 'url', label: 'Import URL', icon: <LuLink /> }]} />
        </div>
        {mode === 'code' && <Suspense fallback={<EditorFallback />}><CodeEditor lang="json" value={d.json} onChange={setJson} height="300px" ariaLabel="JSON content" /></Suspense>}
        {mode === 'upload' && (
          <div className="drop-zone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
            <LuUpload className="fs-2" /><strong>Drop a .json file here or click to browse</strong><span className="small text-soft">Max 500 KB</span>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = '' }} />
          </div>
        )}
        {mode === 'url' && (
          <div className="p-3 d-flex gap-2 flex-wrap">
            <input className="ui-input flex-grow-1" placeholder="https://example.com/lesson.json" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="JSON URL" />
            <button className="btn ui-btn ui-btn-primary" onClick={importUrl}><LuDownload /> Import</button>
          </div>
        )}
        {check && (
          <div className={`json-check ${check.ok ? 'ok' : 'bad'}`} role="status">
            {check.ok ? <><LuCircleCheck /> Valid JSON — ready to save.{check.warnings.length > 0 && <span className="ms-1 text-warning">{check.warnings.join(' ')}</span>}</>
              : <><LuCircleAlert /><ul>{check.errors.map((e, i) => <li key={i}>{e.message}{e.line ? ` (line ${e.line}, col ${e.col})` : ''}</li>)}</ul></>}
          </div>
        )}
        <div className="ed-toolbar">
          <button className="btn ui-btn ui-btn-ghost" onClick={format}><LuWandSparkles /> Format JSON</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={validate}><LuCircleCheck /> Validate</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={async () => { if (await confirm({ title: 'Clear JSON?', message: 'This removes all JSON content from this block.', danger: true, confirmText: 'Clear' })) setJson('') }}><LuEraser /> Clear</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={() => { setJson(JSON.stringify(SAMPLE_LESSON, null, 2)); toast('Sample JSON loaded') }}><LuSparkles /> Sample JSON</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={() => downloadText(`${(block.title || 'lesson').replace(/\W+/g, '-')}.json`, d.json)}><LuDownload /> Download</button>
        </div>
      </div>
    </div>
  )
}

function ColorInput({ label, value, onChange }) {
  return <label className="ui-color"><span>{label}</span><span className="box"><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /><code>{value}</code></span></label>
}

export function JsonProps({ block, setBlock, setData, ui, setUi, onSave, dirty, portalId }) {
  const d = block.data
  const st = { ...DEFAULT_JSON_STYLE, ...d.style }
  const setStyle = (p) => setData({ style: { ...st, ...p } })
  const tab = ui.jsonProps || 'content'
  const toast = useToast()
  const [imgUrl, setImgUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const onImg = async (f) => {
    if (!f) return
    setBusy(true)
    try { const u = await uploadImage(f, `media/${portalId}`, { max: 900 }); let parsed = JSON.parse(d.json || '{}'); if (Array.isArray(parsed)) parsed = { sections: parsed }; if (!parsed || typeof parsed !== 'object') throw new Error('The JSON root must be an object or an array of sections.'); if (!Array.isArray(parsed.sections)) parsed.sections = []; if (!parsed.sections.length) parsed.sections.push({ heading: 'Image section', text: 'Add your explanation here.' }); let target = parsed.sections.findIndex(section => section && typeof section === 'object' && !Array.isArray(section)); if (target < 0) { parsed.sections.push({ heading: 'Image section', text: 'Add your explanation here.' }); target = parsed.sections.length - 1; } parsed.sections[target] = { ...parsed.sections[target], image: { src: u, alt: f.name || 'Lesson image' } }; const nextJson = JSON.stringify(parsed, null, 2); const validation = validateLessonJson(nextJson); if (!validation.ok) throw new Error(validation.errors[0]?.message || 'The resulting JSON is invalid.'); setImgUrl(u); setData({ json: nextJson }); toast('Image inserted into the lesson JSON and preview updated.') } catch (e) { toast(e instanceof SyntaxError ? 'Fix the JSON structure before inserting an image.' : (e.message || 'Image upload failed.'), 'error') } finally { setBusy(false) }
  }
  const Color = ({ k, label }) => <ColorInput label={label} value={st[k]} onChange={(v) => setStyle({ [k]: v })} />
  return (
    <div className="props">
      <Tabs value={tab} onChange={(v) => setUi({ jsonProps: v })} items={[{ value: 'content', label: 'Content' }, { value: 'style', label: 'Style' }, { value: 'advanced', label: 'Advanced' }]} className="props-tabs" />
      {tab === 'content' && <>
        <Field label="Block Title"><input className="ui-input" value={block.title} onChange={(e) => setBlock({ title: e.target.value })} maxLength={120} /></Field>
        <Section title="Image helper" icon={<LuImage />}>
          <p className="small text-soft mb-2">Upload an image to insert it into the first JSON section automatically. You can edit its alt text and position in the JSON code.</p>
          <label className="btn ui-btn ui-btn-secondary w-100">{busy ? <span className="spinner-border spinner-border-sm" /> : <LuUpload />} Upload image<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { onImg(e.target.files[0]); e.target.value = '' }} /></label>
          {imgUrl && <div className="mt-2"><img src={imgUrl} alt="Uploaded lesson preview" className="json-upload-preview" /><small className="d-block text-success mt-1">Image inserted in JSON.</small></div>}
        </Section>
        <Section title="JSON format guide" defaultOpen={false}><pre className="json-help">{JSON_HELP}</pre></Section>
      </>}
      {tab === 'style' && <>
        <Section title="Theme Presets">
          <div className="preset-grid">
            {STYLE_PRESETS.map((p) => <button key={p.id} type="button" className={`preset ${st.preset === p.id ? 'on' : ''}`} onClick={() => setStyle({ preset: p.id })}><span className={`pv pv-${p.id}`} />{p.label}</button>)}
          </div>
        </Section>
        <Section title="Typography">
          <div className="row g-2">
            <div className="col-7"><Field label="Title Font"><select className="ui-input ui-select" value={st.titleFont} onChange={(e) => setStyle({ titleFont: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field></div>
            <div className="col-5"><NumberField label="Title Size" value={st.titleSize} min={14} max={48} onChange={(v) => setStyle({ titleSize: v })} suffix="px" /></div>
            <div className="col-7"><Field label="Text Font"><select className="ui-input ui-select" value={st.textFont} onChange={(e) => setStyle({ textFont: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field></div>
            <div className="col-5"><NumberField label="Text Size" value={st.textSize} min={12} max={24} onChange={(v) => setStyle({ textSize: v })} suffix="px" /></div>
            <div className="col-6">{Color({ k: "titleColor", label: "Title Color" })}</div>
            <div className="col-6">{Color({ k: "textColor", label: "Text Color" })}</div>
          </div>
        </Section>
        <Section title="Colors & Background" defaultOpen={false}>
          <div className="row g-2">
            <div className="col-6">{Color({ k: "accent", label: "Accent" })}</div>
            <div className="col-6">{Color({ k: "headingBg", label: "Heading Bar" })}</div>
            <div className="col-6">{Color({ k: "background", label: "Background" })}</div>
            <div className="col-6">{Color({ k: "borderColor", label: "Border" })}</div>
          </div>
        </Section>
        <Section title="Spacing" defaultOpen={false}>
          <div className="row g-2">
            <div className="col-6"><NumberField label="Padding" value={st.padding} onChange={(v) => setStyle({ padding: v })} suffix="px" /></div>
            <div className="col-6"><NumberField label="Margin" value={st.margin} onChange={(v) => setStyle({ margin: v })} suffix="px" /></div>
          </div>
        </Section>
        <Section title="Border & Radius" defaultOpen={false}>
          <div className="row g-2">
            <div className="col-6"><NumberField label="Radius" value={st.radius} max={40} onChange={(v) => setStyle({ radius: v })} suffix="px" /></div>
            <div className="col-6"><NumberField label="Border" value={st.borderWidth} max={8} onChange={(v) => setStyle({ borderWidth: v })} suffix="px" /></div>
          </div>
        </Section>
        <Section title="Icons & List Style" defaultOpen={false}>
          <div className="prop-row"><span>Show header icon</span><Toggle checked={st.showIcon} onChange={(v) => setStyle({ showIcon: v })} small /></div>
          <Field label="Icon (Bootstrap Icons class)"><input className="ui-input" value={st.icon} onChange={(e) => setStyle({ icon: e.target.value })} placeholder="bi-book" /></Field>
          <Field label="List Style"><select className="ui-input ui-select" value={st.listStyle} onChange={(e) => setStyle({ listStyle: e.target.value })}><option value="numbered">Numbered</option><option value="bullets">Bullets</option><option value="check">Check marks</option></select></Field>
        </Section>
      </>}
      {tab === 'advanced' && <>
        <div className="prop-row"><span>Show in Chapter</span><Toggle checked={block.visible} onChange={(v) => setBlock({ visible: v })} small /></div>
        <Section title="Packages / Libraries"><PackageManager value={d.packages || []} onChange={(v) => setData({ packages: v })} /></Section>
        <Section title="Custom CSS" defaultOpen={false}><Suspense fallback={<EditorFallback />}><CodeEditor lang="css" value={d.customCss || ''} onChange={(v) => setData({ customCss: v })} height="150px" /></Suspense></Section>
        <Section title="Custom JS" defaultOpen={false}><Suspense fallback={<EditorFallback />}><CodeEditor lang="js" value={d.customJs || ''} onChange={(v) => setData({ customJs: v })} height="150px" /></Suspense></Section>
      </>}
      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave}><LuSave /> {dirty ? 'Save Block' : 'Saved'}</button>
    </div>
  )
}
