import { useEffect, useMemo, useState } from 'react'
import { LuCopy, LuExternalLink, LuEye, LuLayers, LuLink, LuSave, LuUpload, LuX } from 'react-icons/lu'
import Modal from '../Modal'
import { ColorSwatches, Field, FontSizeSelect, IconPicker } from '../ui/Controls'
import { ColorSwatchField, GradientPresets, ResetButton, SampleLessonCard, SettingsSection } from '../ui/SettingsControls'
import { uploadImage } from '../../services/storageService'

const slugify = (value = '') => value.toLowerCase().trim().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const blank = { title: '', description: '', titleSize: 20, descSize: 14, headingSize: 28, headingTextColor: '#ffffff', headingAccentColor: '#00d6fd', headingBackgroundMode: 'gradient', headingBackgroundImage: '', headingStartColor: '#0756b9', headingEndColor: '#087fcb', headingSolidColor: '#0d47a1', icon: 'layers', color: '#0a84ff', fullBackgroundMode: 'color', fullBackgroundColor: '#0d47a1', fullStartColor: '#0d47a1', fullEndColor: '#1976d2', fullBackgroundImage: '', slug: '' }
const HEADING_KEYS = ['headingSize', 'headingTextColor', 'headingAccentColor', 'headingBackgroundMode', 'headingBackgroundImage', 'headingStartColor', 'headingEndColor', 'headingSolidColor']
const BACKGROUND_KEYS = ['fullBackgroundMode', 'fullBackgroundColor', 'fullStartColor', 'fullEndColor', 'fullBackgroundImage']
const defaultsFor = (keys) => Object.fromEntries(keys.map((k) => [k, blank[k]]))

const Chips = ({ value, onChange, options, label }) => (
  <div className="ui-chip-row" role="group" aria-label={label}>
    {options.map(([v, l]) => <button key={v} type="button" className={`ui-chip ${value === v ? 'on' : ''}`} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
  </div>
)

export default function UnitModal({ show, onClose, onSubmit, unit, portalId }) {
  const [f, setF] = useState(blank)
  const [err, setErr] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [settingsTab, setSettingsTab] = useState('general')
  useEffect(() => { if (show) { setF({ ...blank, ...(unit || {}), slug: unit?.slug || slugify(unit?.title || '') }); setSettingsTab('general') }; setErr('') }, [show, unit])
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const patch = (p) => setF((x) => ({ ...x, ...p }))
  const slug = f.slug || slugify(f.title)
  const previewUrl = useMemo(() => `${window.location.origin}/#/learn/${portalId || ''}?unit=${slug || unit?.id || 'unit'}`, [portalId, unit?.id, slug])
  const headingBg = f.headingBackgroundMode === 'image' && f.headingBackgroundImage ? `linear-gradient(90deg,rgba(4,10,24,.72),rgba(4,10,24,.28)),url(${f.headingBackgroundImage}) center/cover` : f.headingBackgroundMode === 'solid' ? f.headingSolidColor : `linear-gradient(110deg,${f.headingStartColor},${f.headingEndColor})`
  const fullBg = f.fullBackgroundMode === 'image' && f.fullBackgroundImage ? `linear-gradient(90deg,rgba(4,10,24,.65),rgba(4,10,24,.1)),url(${f.fullBackgroundImage})` : f.fullBackgroundMode === 'gradient' ? `linear-gradient(120deg,${f.fullStartColor},${f.fullEndColor})` : f.fullBackgroundColor
  const name = f.title.trim() || unit?.title || 'Unit name'
  const chooseImage = async (file) => {
    if (!file) return
    setImageBusy(true)
    try { const image = await uploadImage(file, 'unit-background', { max: 1800 }); setF((x) => ({ ...x, fullBackgroundImage: image, fullBackgroundMode: 'image' })); setErr('') }
    catch (e) { setErr(e.message || 'Could not load image.') }
    finally { setImageBusy(false) }
  }
  const chooseHeadingImage = async (file) => {
    if (!file) return
    setImageBusy(true)
    try { const image = await uploadImage(file, 'unit-heading-background', { max: 1800 }); setF((x) => ({ ...x, headingBackgroundImage: image, headingBackgroundMode: 'image' })); setErr('') }
    catch (e) { setErr(e.message || 'Could not load heading image.') }
    finally { setImageBusy(false) }
  }
  const submit = (e) => { e.preventDefault(); if (!f.title.trim()) { setSettingsTab('general'); return setErr('Unit title is required.') } onSubmit({ ...f, title: f.title.trim(), description: f.description.trim(), slug: slugify(f.slug || f.title) }) }
  const banner = (compact) => (
    <div className={compact ? 'unit-preview-heading' : 'unit-settings-preview'} style={{ background: headingBg, color: f.headingTextColor, borderColor: f.headingAccentColor }}>
      <span style={{ background: compact ? f.color : f.headingAccentColor }}><LuLayers /></span>
      <div className="min-w-0"><strong title={name} style={{ fontSize: `${Math.min(f.headingSize, compact ? 22 : 40)}px` }}>{name}</strong>{f.description && <small style={{ fontSize: `${f.descSize}px` }}>{f.description}</small>}</div>
    </div>
  )
  const imageRow = (value, onPick, onRemove, uploadLabel, alt) => (
    <div className="d-flex flex-wrap align-items-center gap-3">
      {value && <img src={value} alt={alt} className="unit-image-thumb" />}
      <label className="btn ui-btn ui-btn-secondary">{imageBusy ? <span className="spinner-border spinner-border-sm" /> : <LuUpload />} {uploadLabel}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = '' }} /></label>
      <button type="button" className="btn ui-btn ui-btn-danger" disabled={!value} onClick={onRemove}>Remove Image</button>
    </div>
  )
  return <Modal show={show} onClose={onClose} className="ui-modal ui-modal-xl settings-modal compact-modal" labelledBy="unit-title">
    <form onSubmit={submit} noValidate>
      <div className="ui-modal-head"><span className="ui-modal-icon"><LuLayers /></span><div className="flex-grow-1 min-w-0"><h2 id="unit-title">{unit ? 'Unit Settings' : 'Create New Unit'}</h2><p className="text-truncate">{unit ? "Configure this unit's details, heading, icon, background and link." : 'Add a unit to organize your subject into major parts.'}</p></div><button type="button" className="ui-x" onClick={onClose} aria-label="Close" title="Close"><LuX /></button></div>
      <div className="ui-modal-body settings-body">
        <div className="settings-tabs" role="tablist" aria-label="Unit settings">
          {[['general', 'General'], ['heading', 'Heading'], ['design', 'Icon & Color'], ['background', 'Background'], ['link', 'Link']].map(([v, l]) => <button type="button" role="tab" aria-selected={settingsTab === v} className={settingsTab === v ? 'on' : ''} key={v} onClick={() => setSettingsTab(v)}>{l}</button>)}
        </div>

        <SettingsSection title="General Information" hint="Basic details of the unit." tab="general" activeTab={settingsTab}>
          <div className="row g-3"><div className="col-lg-8"><Field label="Unit Title" required error={err}><input className="ui-input" value={f.title} maxLength={120} onChange={(e) => { set('title')(e.target.value); setErr('') }} placeholder="e.g. Physical Education aims" /></Field></div><div className="col-lg-4"><Field label="Title Font Size"><FontSizeSelect value={f.titleSize} onChange={set('titleSize')} label="Unit title font size" /></Field></div><div className="col-lg-8"><Field label="Unit Description (Optional)" hint={<span className="d-block text-end">{f.description.length} / 250</span>}><textarea className="ui-input ui-textarea" rows={2} maxLength={250} value={f.description} onChange={(e) => set('description')(e.target.value)} placeholder="Describe this unit…" /></Field></div><div className="col-lg-4"><Field label="Description Font Size"><FontSizeSelect value={f.descSize} onChange={set('descSize')} label="Description font size" /></Field></div></div>
        </SettingsSection>

        <SettingsSection title="Unit Heading Appearance" hint="Customize the unit heading banner (title area)." tab="heading" activeTab={settingsTab} action={<ResetButton onClick={() => patch(defaultsFor(HEADING_KEYS))} />}>
          <div className="settings-grid-3">
            <Field label="Heading Font Size"><FontSizeSelect value={f.headingSize} onChange={set('headingSize')} label="Heading font size" /></Field>
            <ColorSwatchField label="Heading Text Color" value={f.headingTextColor} onChange={set('headingTextColor')} />
            <ColorSwatchField label="Heading Accent Color" value={f.headingAccentColor} onChange={set('headingAccentColor')} />
          </div>
          <div className="settings-block"><span className="sc-label">Heading Background</span><Chips label="Heading background mode" value={f.headingBackgroundMode} onChange={set('headingBackgroundMode')} options={[['gradient', 'Gradient'], ['solid', 'Solid'], ['image', 'Image']]} /></div>
          {f.headingBackgroundMode === 'gradient' && <>
            <GradientPresets start={f.headingStartColor} end={f.headingEndColor} onPick={(a, b) => patch({ headingStartColor: a, headingEndColor: b })} />
            <div className="settings-grid-2"><ColorSwatchField label="Start Color" value={f.headingStartColor} onChange={set('headingStartColor')} /><ColorSwatchField label="End Color" value={f.headingEndColor} onChange={set('headingEndColor')} /></div>
          </>}
          {f.headingBackgroundMode === 'solid' && <div className="settings-grid-2"><ColorSwatchField label="Background Color" value={f.headingSolidColor} onChange={set('headingSolidColor')} /></div>}
          {f.headingBackgroundMode === 'image' && imageRow(f.headingBackgroundImage, chooseHeadingImage, () => set('headingBackgroundImage')(''), 'Upload Heading Image', 'Unit heading background preview')}
          <div className="settings-preview-label"><LuEye /> Heading Preview (banner only)</div>
          {banner(false)}
        </SettingsSection>

        <SettingsSection title="Unit Icon" hint="Choose an icon that represents the unit." tab="design" activeTab={settingsTab}><IconPicker value={f.icon} onChange={set('icon')} /></SettingsSection>
        <SettingsSection title="Unit Color" hint="Select a color for the unit (icon, highlights and theme)." tab="design" activeTab={settingsTab}><ColorSwatches value={f.color} onChange={set('color')} label="Unit color" /></SettingsSection>

        <SettingsSection title="Full Unit Background" hint="Set background for the entire unit (all chapters inside this unit)." tab="background" activeTab={settingsTab} action={<ResetButton onClick={() => patch(defaultsFor(BACKGROUND_KEYS))} />}>
          <div className="settings-block"><span className="sc-label">Background Type</span><Chips label="Background type" value={f.fullBackgroundMode} onChange={set('fullBackgroundMode')} options={[['color', 'Color'], ['gradient', 'Gradient'], ['image', 'Image']]} /></div>
          {f.fullBackgroundMode === 'color' && <div className="settings-grid-2"><ColorSwatchField label="Background Color" value={f.fullBackgroundColor} onChange={set('fullBackgroundColor')} /></div>}
          {f.fullBackgroundMode === 'gradient' && <>
            <GradientPresets start={f.fullStartColor} end={f.fullEndColor} onPick={(a, b) => patch({ fullStartColor: a, fullEndColor: b })} />
            <div className="settings-grid-2"><ColorSwatchField label="Start Color" value={f.fullStartColor} onChange={set('fullStartColor')} /><ColorSwatchField label="End Color" value={f.fullEndColor} onChange={set('fullEndColor')} /></div>
          </>}
          {f.fullBackgroundMode === 'image' && imageRow(f.fullBackgroundImage, chooseImage, () => set('fullBackgroundImage')(''), f.fullBackgroundImage ? 'Change Image' : 'Upload Image', 'Unit background preview')}
          <div className="settings-preview-label"><LuEye /> Live Preview (heading and a lesson card on this background)</div>
          <div className="unit-settings-preview large unit-preview-outer" style={{ background: fullBg, backgroundSize: 'cover', backgroundPosition: 'center' }}>{banner(true)}<SampleLessonCard /></div>
        </SettingsSection>

        <SettingsSection title="Unit Link Preview" hint="Open or copy the direct link to this unit." tab="link" activeTab={settingsTab}>
          <Field label="Unit URL / Slug"><div className="ui-input-icon"><LuLink /><input className="ui-input" value={f.slug || slugify(f.title)} onChange={(e) => set('slug')(e.target.value)} placeholder="physical-education-aims" /></div></Field>
          <div className="settings-link-preview"><span>Preview:</span><code>{previewUrl}</code><button type="button" className="icon-mini" title="Copy link" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(previewUrl)}><LuCopy /></button><button type="button" className="icon-mini" title="Open preview" aria-label="Open preview" onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}><LuExternalLink /></button></div>
        </SettingsSection>
      </div>
      <div className="ui-modal-foot"><button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn ui-btn ui-btn-primary"><LuSave /> Save Unit</button></div>
    </form>
  </Modal>
}
