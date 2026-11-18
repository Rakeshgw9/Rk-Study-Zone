import { useEffect, useState } from 'react'
import { LuRotateCcw } from 'react-icons/lu'

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
/** Normalise user input like "fff" / "#FFF" / "#0D6EFD" to "#rrggbb" (or null when invalid). */
export function normHex(v) {
  let x = String(v ?? '').trim()
  if (!x) return null
  if (!x.startsWith('#')) x = '#' + x
  if (!HEX.test(x)) return null
  if (x.length === 4) x = '#' + [...x.slice(1)].map((c) => c + c).join('')
  return x.toLowerCase()
}

/** One shared colour control: rounded swatch with thin border + editable hex value. */
export function ColorSwatchField({ label, value, onChange }) {
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState(value || '')
  useEffect(() => { if (!edit) setText(value || '') }, [value, edit])
  const commit = () => { const n = normHex(text); if (n) onChange(n); setEdit(false) }
  const shown = normHex(value) || '#ffffff'
  return (
    <div className="sc-field">
      {label && <span className="sc-label">{label}</span>}
      <div className="sc-row">
        <label className="sc-swatch" style={{ '--sw': shown }} title={label ? `Choose ${label.toLowerCase()}` : 'Choose colour'}>
          <input type="color" value={shown} onChange={(e) => onChange(e.target.value)} aria-label={`${label || 'Colour'} picker`} />
        </label>
        {edit ? (
          <input className="sc-hex-input" autoFocus value={text} maxLength={7} spellCheck={false} aria-label={`${label || 'Colour'} hex value`}
            onChange={(e) => setText(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setText(value || ''); setEdit(false) } }} />
        ) : (
          <button type="button" className="sc-hex" onClick={() => setEdit(true)} title="Click to edit the hex value">{shown}</button>
        )}
      </div>
    </div>
  )
}

export const GRADIENT_PRESETS = [
  { name: 'Ocean', start: '#0756b9', end: '#087fcb' },
  { name: 'Forest', start: '#087f5b', end: '#0d6efd' },
  { name: 'Violet', start: '#6a11cb', end: '#2575fc' },
  { name: 'Sunset', start: '#ff7a18', end: '#af002d' },
  { name: 'Rose', start: '#ee0979', end: '#ff6a00' },
  { name: 'Night', start: '#0f2027', end: '#2c5364' },
]

export function GradientPresets({ start, end, onPick }) {
  return (
    <div className="gp-wrap">
      <span className="sc-label">Gradient presets</span>
      <div className="gp-row" role="group" aria-label="Gradient presets">
        {GRADIENT_PRESETS.map((p) => (
          <button key={p.name} type="button" className={`gp-chip ${p.start === start && p.end === end ? 'on' : ''}`} style={{ background: `linear-gradient(110deg, ${p.start}, ${p.end})` }} title={p.name} aria-label={`${p.name} gradient`} aria-pressed={p.start === start && p.end === end} onClick={() => onPick(p.start, p.end)} />
        ))}
      </div>
    </div>
  )
}

export function ResetButton({ onClick, label = 'Reset to default' }) {
  return <button type="button" className="btn ui-btn ui-btn-ghost btn-sm" onClick={onClick}><LuRotateCcw /> {label}</button>
}

/** Settings section without numbered badges */
export function SettingsSection({ title, hint, children, tab, activeTab, action }) {
  return (
    <section hidden={tab && tab !== activeTab} className="settings-section">
      <div className="settings-section-head"><b>{title}</b>{hint && <small>{hint}</small>}{action}</div>
      <div className="settings-section-body">{children}</div>
    </section>
  )
}

export const SampleLessonCard = () => (
  <div className="sample-lesson-card"><b>Sample lesson heading</b><span>This is how a lesson card looks on this background.</span></div>
)
