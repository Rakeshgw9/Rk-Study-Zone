import { useState } from 'react'
import { LuCheck, LuChevronDown, LuChevronUp, LuMonitor, LuPalette, LuSmartphone, LuTablet, LuType } from 'react-icons/lu'
import { SWATCHES, UNIT_ICONS } from '../../lib/content'
import { IconOf } from './icons'

export function Toggle({ checked, onChange, label, id, small }) {
  return (
    <label className={`ui-toggle ${small ? 'sm' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-toggle-track" aria-hidden="true" />
      {label && <span className="ui-toggle-label">{label}</span>}
    </label>
  )
}

export function FontSizeSelect({ value, onChange, options = [12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32], label }) {
  return (
    <label className="ui-fontsize" title={label}>
      <LuType aria-hidden="true" />
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
        {options.map((o) => <option key={o} value={o}>{o} px</option>)}
      </select>
      <LuChevronDown className="caret" aria-hidden="true" />
    </label>
  )
}

export function ColorSwatches({ value, onChange, label = 'Color' }) {
  const custom = value && !SWATCHES.includes(value)
  return (
    <div className="ui-swatches" role="radiogroup" aria-label={label}>
      {SWATCHES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={`ui-swatch ${value === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c}>
          {value === c && <LuCheck />}
        </button>
      ))}
      <label className={`ui-custom-color ${custom ? 'on' : ''}`}>
        <LuPalette /> Custom
        {custom && <span className="dot" style={{ background: value }} />}
        <input type="color" value={value || '#0a84ff'} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
      </label>
    </div>
  )
}

export function IconPicker({ value, onChange }) {
  const [more, setMore] = useState(false)
  const list = more ? UNIT_ICONS : UNIT_ICONS.slice(0, 8)
  return (
    <div className="ui-icon-grid" role="radiogroup" aria-label="Icon">
      {list.map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={`ui-icon-opt ${value === n ? 'on' : ''}`} onClick={() => onChange(n)} aria-label={n}>
          <IconOf name={n} />{value === n && <span className="tick"><LuCheck /></span>}
        </button>
      ))}
      <button type="button" className="ui-icon-opt more" onClick={() => setMore((m) => !m)}>
        {more ? <LuChevronUp /> : <span className="fs-5 lh-1">+</span>}<small>{more ? 'Less' : 'More'}</small>
      </button>
    </div>
  )
}

export function Section({ title, children, defaultOpen = true, icon }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`ui-section ${open ? 'open' : ''}`}>
      <button type="button" className="ui-section-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="d-flex align-items-center gap-2">{icon}{title}</span>
        {open ? <LuChevronUp /> : <LuChevronDown />}
      </button>
      {open && <div className="ui-section-body">{children}</div>}
    </div>
  )
}

export function Tabs({ value, onChange, items, className = '', size }) {
  return (
    <div className={`ui-tabs ${size || ''} ${className}`} role="tablist">
      {items.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} className={`ui-tab ${value === t.value ? 'on' : ''}`} onClick={() => onChange(t.value)}>
          {t.icon}{t.label && <span>{t.label}</span>}
        </button>
      ))}
    </div>
  )
}

export function DeviceToggle({ value, onChange }) {
  const items = [{ v: 'desktop', I: LuMonitor }, { v: 'tablet', I: LuTablet }, { v: 'mobile', I: LuSmartphone }]
  return (
    <div className="ui-device" role="group" aria-label="Preview size">
      {items.map(({ v, I }) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)} aria-label={v} title={v}><I /></button>)}
    </div>
  )
}
export const deviceWidth = (d) => (d === 'mobile' ? 375 : d === 'tablet' ? 768 : '100%')

export function NumberField({ value, onChange, min = 0, max = 200, step = 1, label, suffix }) {
  return (
    <label className="ui-number">
      {label && <span className="lbl">{label}</span>}
      <span className="box">
        <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} aria-label={label} />
        {suffix && <span className="sfx">{suffix}</span>}
      </span>
    </label>
  )
}

export function Field({ label, required, children, hint, error, right }) {
  return (
    <div className="ui-field">
      {(label || right) && <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
        {label && <span className="ui-label">{label}{required && <span className="req"> *</span>}</span>}
        {right}
      </div>}
      {children}
      {error ? <div className="ui-error">{error}</div> : hint ? <div className="ui-hint">{hint}</div> : null}
    </div>
  )
}
