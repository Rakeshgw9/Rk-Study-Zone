import { useEffect, useMemo, useState } from 'react'
import { LuBookOpen, LuCheck, LuCopy, LuExternalLink, LuInfo, LuLink, LuMonitor, LuSave, LuSmartphone, LuUpload, LuX } from 'react-icons/lu'
import Modal from '../Modal'
import { ColorSwatches, Field, FontSizeSelect } from '../ui/Controls'
import { ColorSwatchField, GradientPresets, ResetButton, SampleLessonCard, SettingsSection } from '../ui/SettingsControls'
import HeadingBgLayers from '../ui/HeadingBg'
import { uploadImage } from '../../services/storageService'
import { BLEND_MODES, HEADING_IMAGE_DEFAULTS, HEADING_IMAGE_KEYS, HEADING_PRESETS, IMAGE_STYLES, POSITIONS } from '../../lib/chapterHeading'

const slugify = (value = '') => value.toLowerCase().trim().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const blank = {
  title: '', description: '', titleSize: 28, color: '#0a84ff',
  headingSize: 28, headingTextColor: '#ffffff', headingAccentColor: '#0d6efd', headingBackgroundMode: 'gradient', headingStartColor: '#087f5b', headingEndColor: '#0d6efd', headingSolidColor: '#173b83',
  fullBackgroundMode: 'gradient', fullStartColor: '#030a14', fullEndColor: '#1976d2', fullSolidColor: '#030a14', slug: '',
  ...HEADING_IMAGE_DEFAULTS,
}
// New chapters start with the education background image; existing chapters keep whatever mode they already use.
const NEW_CHAPTER = { headingBackgroundMode: 'image' }
const HEADING_KEYS = ['headingSize', 'headingTextColor', 'headingAccentColor', 'headingBackgroundMode', 'headingStartColor', 'headingEndColor', 'headingSolidColor', ...HEADING_IMAGE_KEYS]
const BACKGROUND_KEYS = ['fullBackgroundMode', 'fullStartColor', 'fullEndColor', 'fullSolidColor']
const defaultsFor = (keys) => Object.fromEntries(keys.map((k) => [k, blank[k]]))

const ModeChips = ({ value, onChange, options = [['gradient', 'Gradient'], ['solid', 'Solid']] }) => (
  <div className="ui-chip-row" role="group" aria-label="Background mode">
    {options.map(([v, l]) => <button key={v} type="button" className={`ui-chip ${value === v ? 'on' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
  </div>
)

function HeadingImageSettings({ f, patch, busy, onPick }) {
  const custom = !!f.headingBackgroundImage
  return (
    <div className="hbg-grid">
      <div className="hbg-col">
        <span className="sc-label">Background Image</span>
        <div className="hbg-thumbs" role="group" aria-label="Background image">
          {HEADING_PRESETS.map((p) => { const on = !custom && f.headingBgPreset === p.id; return (
            <button type="button" key={p.id} className={`hbg-thumb ${on ? 'on' : ''}`} style={{ backgroundImage: `url("${p.src}")` }} title={p.label} aria-label={p.label} aria-pressed={on} onClick={() => patch({ headingBgPreset: p.id, headingBackgroundImage: '' })}>{on && <span className="tick"><LuCheck /></span>}<em>{p.label}</em></button>
          ) })}
          {custom && <button type="button" className="hbg-thumb on" style={{ backgroundImage: `url("${f.headingBackgroundImage}")` }} title="Your uploaded image" aria-pressed="true"><span className="tick"><LuCheck /></span><em>Custom</em></button>}
          <label className="hbg-thumb upload" title="Upload a custom image">{busy ? <span className="spinner-border spinner-border-sm" /> : <LuUpload />}<span>Upload Image</span><input hidden type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = '' }} /></label>
        </div>
        {custom && <button type="button" className="btn ui-btn ui-btn-ghost btn-sm mt-2" onClick={() => patch({ headingBackgroundImage: '' })}>Remove uploaded image</button>}
        <div className="settings-block mt-3"><span className="sc-label">Background style</span>
          <div className="ui-chip-row" role="group" aria-label="Background style">{IMAGE_STYLES.map(([v, l]) => <button key={v} type="button" className={`ui-chip ${f.headingImgStyle === v ? 'on' : ''}`} aria-pressed={f.headingImgStyle === v} onClick={() => patch({ headingImgStyle: v })}>{l}</button>)}</div>
        </div>
      </div>
      <div className="hbg-col hbg-box">
        <span className="sc-label">Image Settings</span>
        <div className="hbg-row">
          <div><span className="sc-label">Position</span>
            <div className="hbg-pos" role="radiogroup" aria-label="Image position">{POSITIONS.map(([v, l]) => <button type="button" key={v} role="radio" aria-checked={f.headingImgPosition === v} title={l} aria-label={l} className={f.headingImgPosition === v ? 'on' : ''} onClick={() => patch({ headingImgPosition: v })}><i /></button>)}</div>
          </div>
          <div className="hbg-selects">
            <label><span className="sc-label">Size</span><select className="ui-input ui-select" value={f.headingImgSize} onChange={(e) => patch({ headingImgSize: e.target.value })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="auto">Original</option></select></label>
            <label><span className="sc-label">Repeat</span><select className="ui-input ui-select" value={f.headingImgRepeat} onChange={(e) => patch({ headingImgRepeat: e.target.value })}><option value="no-repeat">No Repeat</option><option value="repeat">Repeat</option><option value="repeat-x">Repeat X</option></select></label>
            <label><span className="sc-label">Blend Mode</span><select className="ui-input ui-select" value={f.headingImgBlend} onChange={(e) => patch({ headingImgBlend: e.target.value })}>{BLEND_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
        </div>
        <div className="hbg-overlay-row">
          <label className="hbg-switch"><input type="checkbox" checked={f.headingOverlayOn !== false} onChange={(e) => patch({ headingOverlayOn: e.target.checked })} /> <span>Dark overlay</span></label>
          <ColorSwatchField label="Overlay Color" value={f.headingOverlayColor} onChange={(v) => patch({ headingOverlayColor: v })} />
          <label className="hbg-opacity"><span className="sc-label">Overlay Opacity</span><span className="d-flex align-items-center gap-2"><input type="range" min="0" max="90" step="5" value={f.headingOverlayOpacity} disabled={f.headingOverlayOn === false} onChange={(e) => patch({ headingOverlayOpacity: Number(e.target.value) })} aria-label="Overlay opacity" /><b>{f.headingOverlayOpacity}%</b></span></label>
        </div>
      </div>
    </div>
  )
}

export default function ChapterModal({ show, onClose, onSubmit, chapter, unitTitle, portalId }) {
  const [f, setF] = useState(blank)
  const [err, setErr] = useState('')
  const [settingsTab, setSettingsTab] = useState('general')
  const [device, setDevice] = useState('desktop')
  const [imgBusy, setImgBusy] = useState(false)
  useEffect(() => { if (show) { setF({ ...blank, ...(chapter ? {} : NEW_CHAPTER), ...(chapter || {}), slug: chapter?.slug || slugify(chapter?.title || '') }); setErr(''); setSettingsTab('general'); setDevice('desktop') } }, [show, chapter])
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const patch = (p) => setF((x) => ({ ...x, ...p }))
  const slug = f.slug || slugify(f.title)
  const previewUrl = useMemo(() => `${window.location.origin}/#/learn/${portalId || ''}/${slug || chapter?.id || 'chapter'}`, [portalId, chapter?.id, slug])
  const submit = (e) => {
    e.preventDefault()
    if (!f.title.trim()) { setSettingsTab('general'); return setErr('Chapter title is required.') }
    onSubmit({ ...f, title: f.title.trim(), description: f.description.trim(), slug: slugify(f.slug || f.title) })
  }
  const isImage = f.headingBackgroundMode === 'image'
  const headingBackground = isImage ? '#0b1f44' : f.headingBackgroundMode === 'solid' ? f.headingSolidColor : `linear-gradient(110deg, ${f.headingStartColor}, ${f.headingEndColor})`
  const chooseImage = async (file) => {
    if (!file) return
    setImgBusy(true)
    try { const image = await uploadImage(file, 'chapter-heading-background', { max: 1600 }); patch({ headingBackgroundImage: image, headingBackgroundMode: 'image' }); setErr('') }
    catch (e) { setErr(e.message || 'Could not load image.') }
    finally { setImgBusy(false) }
  }
  const fullBackground = f.fullBackgroundMode === 'solid' ? f.fullSolidColor : `linear-gradient(120deg, ${f.fullStartColor}, ${f.fullEndColor})`
  const name = f.title.trim() || chapter?.title || 'Chapter name'
  const banner = (small) => (
    <div className={`chapter-settings-preview ${small ? 'compact' : ''} ${isImage ? 'has-hb' : ''}`} style={{ background: headingBackground, color: f.headingTextColor, borderColor: f.headingAccentColor }}>
      <HeadingBgLayers chapter={f} />
      <span style={{ background: f.headingAccentColor }}><LuBookOpen /></span>
      <strong title={name} style={{ fontSize: `${Math.min(f.headingSize, small ? 22 : 40)}px` }}>{name}</strong>
    </div>
  )
  return <Modal show={show} onClose={onClose} className="ui-modal ui-modal-xl settings-modal" labelledBy="ch-title">
    <form onSubmit={submit} noValidate>
      <div className="ui-modal-head"><span className="ui-modal-icon"><LuBookOpen /></span><div className="flex-grow-1 min-w-0"><h2 id="ch-title">Chapter Settings</h2><p className="text-truncate">Configure this chapter's details, heading, background and link.{unitTitle ? ` · ${unitTitle}` : ''}</p></div><button type="button" className="ui-x" onClick={onClose} aria-label="Close" title="Close"><LuX /></button></div>
      <div className="ui-modal-body settings-body">
        <div className="settings-tabs" role="tablist" aria-label="Chapter settings">
          {[['general', 'General'], ['heading', 'Heading'], ['background', 'Background'], ['link', 'Link']].map(([v, l]) => <button type="button" role="tab" aria-selected={settingsTab === v} className={settingsTab === v ? 'on' : ''} key={v} onClick={() => setSettingsTab(v)}>{l}</button>)}
        </div>

        <SettingsSection title="General Information" hint="Basic details of the chapter." tab="general" activeTab={settingsTab}>
          <Field label="Chapter Title" required error={err}><input className="ui-input" value={f.title} maxLength={140} onChange={(e) => { set('title')(e.target.value); setErr('') }} placeholder="e.g. Definition of Physical Education" /></Field>
          <Field label="Short Description (Optional)"><textarea className="ui-input ui-textarea" rows={2} maxLength={300} value={f.description} onChange={(e) => set('description')(e.target.value)} placeholder="Write a short description about this chapter…" /></Field>
          <Field label="Chapter Color" hint="Used for this chapter's accent in the structure tree."><ColorSwatches value={f.color} onChange={set('color')} label="Chapter color" /></Field>
        </SettingsSection>

        <SettingsSection title="Chapter Heading Appearance" hint="Affects only the chapter heading banner (title area)." tab="heading" activeTab={settingsTab} action={<ResetButton onClick={() => patch({ ...defaultsFor(HEADING_KEYS), ...NEW_CHAPTER })} />}>
          <div className="settings-grid-3">
            <Field label="Heading Font Size"><FontSizeSelect value={f.headingSize} onChange={set('headingSize')} label="Heading font size" /></Field>
            <ColorSwatchField label="Heading Text Color" value={f.headingTextColor} onChange={set('headingTextColor')} />
            <ColorSwatchField label="Heading Accent Color" value={f.headingAccentColor} onChange={set('headingAccentColor')} />
          </div>
          <div className="settings-block"><span className="sc-label">Heading Background</span><ModeChips value={f.headingBackgroundMode} onChange={set('headingBackgroundMode')} options={[['gradient', 'Gradient'], ['solid', 'Solid'], ['image', 'Image']]} /></div>
          {isImage ? <HeadingImageSettings f={f} patch={patch} busy={imgBusy} onPick={chooseImage} /> : f.headingBackgroundMode === 'gradient' ? <>
            <GradientPresets start={f.headingStartColor} end={f.headingEndColor} onPick={(a, b) => patch({ headingStartColor: a, headingEndColor: b })} />
            <div className="settings-grid-2"><ColorSwatchField label="Start Color" value={f.headingStartColor} onChange={set('headingStartColor')} /><ColorSwatchField label="End Color" value={f.headingEndColor} onChange={set('headingEndColor')} /></div>
          </> : <div className="settings-grid-2"><ColorSwatchField label="Background Color" value={f.headingSolidColor} onChange={set('headingSolidColor')} /></div>}
          <div className="settings-preview-label hbg-preview-head"><span><LuInfo /> Heading Preview (banner only)</span><span className="ui-device" role="group" aria-label="Preview size"><button type="button" className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')}><LuMonitor /> Desktop</button><button type="button" className={device === 'mobile' ? 'on' : ''} onClick={() => setDevice('mobile')}><LuSmartphone /> Mobile</button></span></div>
          <div className={`hbg-preview-frame ${device}`}>{banner(false)}</div>
        </SettingsSection>

        <SettingsSection title="Full Chapter Background" hint="Affects the entire chapter content area (all blocks inside this chapter)." tab="background" activeTab={settingsTab} action={<ResetButton onClick={() => patch(defaultsFor(BACKGROUND_KEYS))} />}>
          <div className="settings-block"><span className="sc-label">Background Mode</span><ModeChips value={f.fullBackgroundMode} onChange={set('fullBackgroundMode')} /></div>
          {f.fullBackgroundMode === 'gradient' ? <>
            <GradientPresets start={f.fullStartColor} end={f.fullEndColor} onPick={(a, b) => patch({ fullStartColor: a, fullEndColor: b })} />
            <div className="settings-grid-2"><ColorSwatchField label="Start Color" value={f.fullStartColor} onChange={set('fullStartColor')} /><ColorSwatchField label="End Color" value={f.fullEndColor} onChange={set('fullEndColor')} /></div>
          </> : <div className="settings-grid-2"><ColorSwatchField label="Background Color" value={f.fullSolidColor} onChange={set('fullSolidColor')} /></div>}
          <div className="settings-preview-label"><LuInfo /> Live Preview (heading and a lesson card on this background)</div>
          <div className="chapter-full-preview" style={{ background: fullBackground }}>{banner(true)}<SampleLessonCard /></div>
        </SettingsSection>

        <SettingsSection title="Chapter Link Preview" hint="Editable chapter URL and quick preview of the destination." tab="link" activeTab={settingsTab}>
          <Field label="Chapter URL / Slug" required><div className="ui-input-icon"><LuLink /><input className="ui-input" value={f.slug || slugify(f.title)} onChange={(e) => set('slug')(e.target.value)} placeholder="definition-of-physical-education" /></div></Field>
          <div className="settings-link-preview"><span>Preview:</span><code>{previewUrl}</code><button type="button" className="icon-mini" title="Copy link" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(previewUrl)}><LuCopy /></button><button type="button" className="icon-mini" title="Open preview" aria-label="Open preview" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}><LuExternalLink /></button></div>
        </SettingsSection>
      </div>
      <div className="ui-modal-foot"><button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn ui-btn ui-btn-primary"><LuSave /> Save Changes</button></div>
    </form>
  </Modal>
}
