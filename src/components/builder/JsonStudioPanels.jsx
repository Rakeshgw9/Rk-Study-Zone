import { useState } from 'react'
import { LuCheck, LuCopy, LuDownload } from 'react-icons/lu'
import {
  ALIGNS,
  DARK_THEMES,
  FONT_FAMILIES,
  LIGHT_THEMES,
  PRESET_BLOCKS,
  PRESET_MIME,
  SECTION_SCHEMA,
  SECTION_TYPE_IDS,
  STUDIO_TEMPLATE_JSON,
  TEXT_STYLE_LIMITS,
  WEIGHTS,
  kindLabel,
  newSection,
  normalizeTextStyle,
  themeById,
} from '../../lib/jsonStudio'

function ThemeGroup({ title, themes, value, onPick }) {
  const [more, setMore] = useState(false)
  const shown = more ? themes : themes.slice(0, 4)
  const hiddenSelected = !more && themes.slice(4).some((t) => t.id === value)
  return (
    <div className="jt-group">
      <div className="jt-group-head">
        <b>{title} ({themes.length})</b>
        <button type="button" className="jt-toggle" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? 'Collapse' : `Show ${themes.length - 4} More`}
          {hiddenSelected ? ' •' : ''}
        </button>
      </div>
      <div className="jt-grid" role="radiogroup" aria-label={title}>
        {shown.map((t) => (
          <button
            type="button"
            key={t.id}
            role="radio"
            aria-checked={value === t.id}
            className={`jt-swatch${value === t.id ? ' on' : ''}`}
            onClick={() => onPick(t.id)}
            title={`${t.label} (${t.id})`}
          >
            <span className="jt-chip" style={{ background: `linear-gradient(135deg, ${t.bg} 0 55%, ${t.accent} 55% 100%)`, borderColor: t.border }}>
              {value === t.id && <LuCheck />}
            </span>
            <span className="jt-name">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Dark (8) + Light (8) theme picker. Shows the first 4 of each group; "Show 4 More / Collapse" reveals the rest.
 *  `value` = theme id currently in effect (the section's own theme, or the block theme when a section follows the default). */
export function ThemePicker({ value, onPick, note }) {
  const cur = themeById(value)
  return (
    <div className="jt-picker">
      <div className="jt-current">
        {note || 'Current theme'}: <b>{cur.label}</b> <code>{cur.id}</code>
      </div>
      <ThemeGroup title="Dark Themes" themes={DARK_THEMES} value={cur.id} onPick={onPick} />
      <ThemeGroup title="Light Themes" themes={LIGHT_THEMES} value={cur.id} onPick={onPick} />
    </div>
  )
}

/** Right sidebar: 8 draggable "Preset Section Blocks" (6 core study blocks + 2 optional media presets).
 *  Drag a card over the artboard (a glowing line shows where it lands) or click it to add below the selected section.
 *  Layer management (reorder / duplicate / delete) lives only in the left Portal Structure tree. */
export function PresetBlocks({ onAdd }) {
  return (
    <div className="jt-presets">
      <p className="small text-soft mb-2">Drag a card onto the artboard, or click it to add below the selected section.</p>
      <div className="jt-preset-grid">
        {PRESET_BLOCKS.map((p) => (
          <div
            key={p.type}
            role="button"
            tabIndex={0}
            draggable
            className={`jt-preset${p.media ? ' media' : ''}`}
            title={`${p.title} — ${p.hint}. Drag onto the artboard or click to add.`}
            aria-label={`Add ${p.title}`}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData(PRESET_MIME, p.type)
            }}
            onClick={() => onAdd(p.type)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(p.type) } }}
          >
            <span className={`jt-badge jt-${p.type}`}>{p.short}</span>
            <span className="jt-preset-t">{p.title}</span>
            {p.media && <span className="jt-preset-opt">Optional</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

const SLIDERS = [
  ['headingSize', 'Heading size', 1, 'px'],
  ['bodySize', 'Body font size', 1, 'px'],
  ['lineHeight', 'Line height', 0.05, ''],
  ['letterSpacing', 'Letter spacing', 0.1, 'px'],
]
const ALIGN_LABEL = { left: 'Left', center: 'Center', right: 'Right', justify: 'Justify' }
const COLOR_KEYS = [['headingColor', 'Heading colour'], ['textColor', 'Text colour'], ['accentColor', 'Accent colour']]

/** Typography for the whole JSON block. Stored in the JSON's root "textStyle" object, so the builder, student page and PDF all use it. */
export function TextStyleEditor({ value, onChange, themeId }) {
  const ts = normalizeTextStyle(value)
  const t = themeById(themeId)
  const set = (k, v) => onChange(normalizeTextStyle({ ...ts, [k]: v }))
  const clear = (k) => { const n = { ...ts }; delete n[k]; onChange(n) }
  const fallback = { headingColor: t.heading, textColor: t.text, accentColor: t.accent }
  return (
    <div className="jt-style">
      <div className="jt-field">
        <label htmlFor="jts-font">Font family</label>
        <select id="jts-font" className="ui-input ui-select" value={ts.fontFamily || ''} onChange={(e) => (e.target.value ? set('fontFamily', e.target.value) : clear('fontFamily'))}>
          <option value="">Default (Inter)</option>
          {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>{f.id}</option>)}
        </select>
      </div>
      {SLIDERS.map(([k, label, step, unit]) => {
        const [lo, hi] = TEXT_STYLE_LIMITS[k]
        const on = ts[k] !== undefined
        return (
          <div className="jt-field" key={k}>
            <label htmlFor={`jts-${k}`}>{label} <b>{on ? `${ts[k]}${unit}` : 'Default'}</b></label>
            <div className="jt-range">
              <input id={`jts-${k}`} type="range" min={lo} max={hi} step={step} value={on ? ts[k] : (k === 'bodySize' ? 16 : k === 'headingSize' ? 22 : k === 'lineHeight' ? 1.65 : 0)} onChange={(e) => set(k, Number(e.target.value))} />
              {on && <button type="button" className="jt-link" onClick={() => clear(k)}>Reset</button>}
            </div>
          </div>
        )
      })}
      <div className="jt-field">
        <label>Text alignment</label>
        <div className="jt-seg" role="radiogroup" aria-label="Text alignment">
          {ALIGNS.map((a) => (
            <button type="button" key={a} role="radio" aria-checked={ts.textAlign === a} className={ts.textAlign === a ? 'on' : ''} onClick={() => (ts.textAlign === a ? clear('textAlign') : set('textAlign', a))}>{ALIGN_LABEL[a]}</button>
          ))}
        </div>
      </div>
      <div className="jt-field">
        <label htmlFor="jts-weight">Font weight</label>
        <select id="jts-weight" className="ui-input ui-select" value={ts.fontWeight || ''} onChange={(e) => (e.target.value ? set('fontWeight', e.target.value) : clear('fontWeight'))}>
          <option value="">Default</option>
          {WEIGHTS.map((w) => <option key={w} value={w}>{{ 400: 'Regular (400)', 500: 'Medium (500)', 600: 'Semi-bold (600)', 700: 'Bold (700)' }[w]}</option>)}
        </select>
      </div>
      <div className="jt-colors">
        {COLOR_KEYS.map(([k, label]) => (
          <div className="jt-field" key={k}>
            <label htmlFor={`jts-${k}`}>{label}</label>
            <div className="jt-color-row">
              <input id={`jts-${k}`} type="color" value={ts[k] || fallback[k]} onChange={(e) => set(k, e.target.value)} />
              <span className="jt-hex">{ts[k] || 'Theme'}</span>
              {ts[k] && <button type="button" className="jt-link" onClick={() => clear(k)}>Reset</button>}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn ui-btn ui-btn-secondary w-100" onClick={() => onChange({})} disabled={!Object.keys(ts).length}>Reset Style</button>
    </div>
  )
}

/** Schema-driven guide: the fields, themes and template shown here come straight from lib/jsonStudio, so they never drift from the real format. */
export function FormatGuide({ onCopy, onInsert, copied, compact = false }) {
  const [copiedType, setCopiedType] = useState('')
  const copySample = (t) => {
    const sample = newSection(t)
    navigator.clipboard?.writeText(JSON.stringify(sample, null, 2))
    setCopiedType(t)
    setTimeout(() => setCopiedType(''), 2000)
  }
  return (
    <div className={`jt-guide${compact ? ' compact' : ''}`}>
      <div className="jt-guide-actions">
        <button type="button" className="btn ui-btn ui-btn-primary btn-sm" onClick={onCopy}>
          {copied ? <><LuCheck /> Copied!</> : <><LuCopy /> Copy Format Guide JSON</>}
        </button>
        {onInsert && (
          <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={onInsert}>
            <LuDownload /> Insert Template
          </button>
        )}
      </div>

      <p className="small text-soft mb-2">
        One JSON block holds any number of sections, in any order. Each section has a <code>type</code> and an optional <code>id</code>.
        Set the look with <code>"theme"</code> (whole block) or <code>"theme"</code> inside one section (that section only).
        Optional sections (<code>callout_formula</code>, <code>heading_image</code>, <code>heading_youtube</code>) are not part of this default guide — add them from the <b>Preset Section Blocks</b> cards.
      </p>

      <div className="jt-type">
        <div className="jt-type-head"><b>Bilingual Odia keys</b> <span className="small text-soft">(all optional)</span></div>
        <div className="jt-table-wrap">
          <table className="jt-table">
            <thead><tr><th>Key</th><th>Where</th></tr></thead>
            <tbody>
              <tr><td><code>odiaHeading</code></td><td>every section – Odia heading under the heading</td></tr>
              <tr><td><code>odiaSubHeading</code></td><td>structured_header</td></tr>
              <tr><td><code>odiaText</code></td><td>paragraph and list items: <code>{'{ "text": "…", "odiaText": "…" }'}</code></td></tr>
              <tr><td><code>odiaExplain</code></td><td>formula and example items</td></tr>
              <tr><td><code>odiaNote</code></td><td>heading_table – note under the table</td></tr>
            </tbody>
          </table>
        </div>
        <p className="small text-soft mt-1 mb-0">Plain string arrays (<code>"paragraphs": ["…"]</code>, <code>"items": ["…"]</code>) still work.</p>
      </div>

      {SECTION_TYPE_IDS.map((t) => (
        <div className="jt-type" key={t}>
          <div className="jt-type-head">
            <span className={`jt-badge jt-${t}`}>{SECTION_SCHEMA[t].short}</span>
            <code>{t}</code>
            <button type="button" className="jt-link ms-auto" onClick={() => copySample(t)}>{copiedType === t ? 'Copied!' : 'Copy sample'}</button>
          </div>
          <p className="small text-soft mb-1">{SECTION_SCHEMA[t].desc}</p>
          <div className="jt-table-wrap">
            <table className="jt-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                {SECTION_SCHEMA[t].fields.map((f) => (
                  <tr key={f.key}>
                    <td><code>{f.key}</code>{f.optional ? <small> (optional)</small> : null}</td>
                    <td>{kindLabel(f)}</td>
                    <td>{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="jt-type">
        <div className="jt-type-head"><b>Block options</b></div>
        <div className="jt-table-wrap">
          <table className="jt-table">
            <thead><tr><th>Key</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>theme</code></td><td>theme ID for the whole block (default <code>midnight-slate</code>)</td></tr>
              <tr><td><code>textStyle</code></td><td>{'{ fontFamily, headingSize, bodySize, lineHeight, letterSpacing, textAlign, fontWeight, headingColor, textColor, accentColor }'} — set it from the Style tab</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="jt-type">
        <div className="jt-type-head"><b>Theme IDs</b> <span className="small text-soft">(default: <code>midnight-slate</code>)</span></div>
        <p className="small mb-1"><b>Dark:</b> {DARK_THEMES.map((t) => <code key={t.id} className="me-1">{t.id}</code>)}</p>
        <p className="small mb-0"><b>Light:</b> {LIGHT_THEMES.map((t) => <code key={t.id} className="me-1">{t.id}</code>)}</p>
      </div>

      <div className="jt-type">
        <div className="jt-type-head"><b>Template JSON</b></div>
        <pre className="json-help">{STUDIO_TEMPLATE_JSON}</pre>
      </div>
    </div>
  )
}
