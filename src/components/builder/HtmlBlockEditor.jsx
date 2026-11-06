import { lazy, Suspense, useState } from 'react'
import { LuCode, LuEye, LuMaximize2, LuMinimize2, LuSave } from 'react-icons/lu'
import { timeAgo } from '../../lib/id'
import { htmlBlockStyleCss } from '../../lib/blockRender'
import { DeviceToggle, Field, NumberField, Section, Tabs, Toggle, deviceWidth } from '../ui/Controls'
import PackageManager from '../ui/PackageManager'
import SandboxFrame from '../ui/SandboxFrame'

const CodeEditor = lazy(() => import('../ui/CodeEditor'))
const LANGS = [{ value: 'html', label: 'HTML' }, { value: 'css', label: 'CSS' }, { value: 'js', label: 'JS' }]
export const EditorFallback = () => <div className="code-loading"><span className="spinner-border spinner-border-sm" /> Loading editor…</div>

export function HtmlCenter({ block, setData, ui, setUi, dirty }) {
  const d = block.data
  const [big, setBig] = useState(false)
  const tab = ui.htmlTab || 'html'
  const key = tab === 'js' ? 'js' : tab
  return (
    <div className="editor-stack">
      {ui.preview !== false && (
        <div className="ed-card">
          <div className="ed-card-head">
            <span className="ttl"><LuEye /> Live Preview</span>
            <DeviceToggle value={ui.device || 'desktop'} onChange={(v) => setUi({ device: v })} />
          </div>
          <div className="ed-preview light-canvas">
            <SandboxFrame html={d.html} css={`${d.css || ''}\n${htmlBlockStyleCss({ ...(d.style || {}), padding: d.padding })}`} js={d.js} packages={d.packages} padding={0} copyButtons={d.copyButton} width={deviceWidth(ui.device)} />
          </div>
        </div>
      )}
      <div className={`ed-card ${big ? 'ed-fullscreen' : ''}`}>
        <div className="ed-card-head">
          <span className="ttl"><LuCode /> Code Editor</span>
          <span className="d-flex align-items-center gap-2 flex-wrap">
            <span className={`pill ${dirty ? 'pill-warn' : 'pill-ok'}`}>{dirty ? 'Unsaved' : 'Draft saved'}</span>
            <span className="small text-soft d-none d-sm-inline">Last saved: {timeAgo(block.updatedAt)}</span>
            <button className="icon-mini" onClick={() => setBig((b) => !b)} aria-label={big ? 'Exit full screen' : 'Full screen'}>{big ? <LuMinimize2 /> : <LuMaximize2 />}</button>
          </span>
        </div>
        <Tabs value={tab} onChange={(v) => setUi({ htmlTab: v })} items={LANGS} className="code-tabs" />
        <Suspense fallback={<EditorFallback />}>
          <CodeEditor key={tab} lang={tab} value={d[key] || ''} onChange={(v) => setData({ [key]: v })} height={big ? 'calc(100vh - 150px)' : '300px'} ariaLabel={`${tab} code`} placeholder={tab === 'js' ? '// JavaScript runs inside a safe sandbox' : ''} />
        </Suspense>
      </div>
    </div>
  )
}

export function HtmlProps({ block, setBlock, setData, ui, setUi, onSave, dirty }) {
  const d = block.data
  const st = { background: '#ffffff', textColor: '#0f172a', fontFamily: 'Inter', fontSize: 16, textAlign: 'left', borderColor: '#dbe4f3', borderWidth: 0, borderRadius: 12, ...(d.style || {}) }
  const tab = ui.htmlPropsTab || 'content'
  const setStyle = (patch) => setData({ style: { ...st, ...patch } })
  return (
    <div className="props">
      <Tabs value={tab} onChange={(v) => setUi({ htmlPropsTab: v })} items={[{ value: 'content', label: 'Content' }, { value: 'style', label: 'Style' }, { value: 'spacing', label: 'Spacing' }, { value: 'advanced', label: 'Advanced' }]} className="props-tabs" />
      {tab === 'content' && <>
        <Field label="Block Title"><input className="ui-input" value={block.title} onChange={(e) => setBlock({ title: e.target.value })} maxLength={120} /></Field>
        <p className="small text-soft">Use the central HTML, CSS and JS editor to change the content. These settings control the block's general appearance.</p>
        <div className="prop-row"><span>Show in Chapter</span><Toggle checked={block.visible} onChange={(v) => setBlock({ visible: v })} small /></div>
        <div className="prop-row"><span>Live Preview</span><Toggle checked={ui.preview !== false} onChange={(v) => setUi({ preview: v })} small /></div>
      </>}
      {tab === 'style' && <>
        <Section title="Typography">
          <Field label="Font Family"><select className="ui-input ui-select" value={st.fontFamily} onChange={(e) => setStyle({ fontFamily: e.target.value })}>{['Inter', 'Poppins', 'Noto Sans Oriya', 'Georgia', 'Arial', 'system-ui'].map((font) => <option key={font}>{font}</option>)}</select></Field>
          <div className="row g-2"><div className="col-6"><NumberField label="Font Size" value={st.fontSize} min={10} max={48} onChange={(v) => setStyle({ fontSize: v })} suffix="px" /></div><div className="col-6"><Field label="Text Alignment"><select className="ui-input ui-select" value={st.textAlign} onChange={(e) => setStyle({ textAlign: e.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></Field></div></div>
          <div className="row g-2"><div className="col-6"><Field label="Text Color"><input className="form-control form-control-color" type="color" value={st.textColor} onChange={(e) => setStyle({ textColor: e.target.value })} /></Field></div><div className="col-6"><Field label="Background Color"><input className="form-control form-control-color" type="color" value={st.background} onChange={(e) => setStyle({ background: e.target.value })} /></Field></div></div>
        </Section>
        <Section title="Border & Shape"><div className="row g-2"><div className="col-6"><NumberField label="Border Width" value={st.borderWidth} min={0} max={8} onChange={(v) => setStyle({ borderWidth: v })} suffix="px" /></div><div className="col-6"><NumberField label="Border Radius" value={st.borderRadius} min={0} max={40} onChange={(v) => setStyle({ borderRadius: v })} suffix="px" /></div><div className="col-12"><Field label="Border Color"><input className="form-control form-control-color" type="color" value={st.borderColor} onChange={(e) => setStyle({ borderColor: e.target.value })} /></Field></div></div></Section>
      </>}
      {tab === 'spacing' && <Section title="Block Spacing"><div className="row g-2"><div className="col-6"><NumberField label="Padding" value={d.padding ?? 16} min={0} max={100} onChange={(v) => setData({ padding: v })} suffix="px" /></div><div className="col-6"><NumberField label="Margin" value={d.margin ?? 0} min={0} max={100} onChange={(v) => setData({ margin: v })} suffix="px" /></div></div><div className="prop-row mt-2"><span>Use Full Width</span><Toggle checked={!!d.fullWidth} onChange={(v) => setData({ fullWidth: v })} small /></div></Section>}
      {tab === 'advanced' && <>
        <Section title="Packages / Libraries"><PackageManager value={d.packages || []} onChange={(v) => setData({ packages: v })} /></Section>
        <Section title="Code Options"><div className="prop-row"><span>Enable Code Copy Button</span><Toggle checked={!!d.copyButton} onChange={(v) => setData({ copyButton: v })} small /></div></Section>
      </>}
      <button className="btn ui-btn ui-btn-primary w-100 mt-2" onClick={onSave}><LuSave /> {dirty ? 'Save Block' : 'Saved'}</button>
    </div>
  )
}
