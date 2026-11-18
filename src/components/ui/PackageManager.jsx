import { useState } from 'react'
import { LuPackage, LuPlus, LuTrash2 } from 'react-icons/lu'
import { PACKAGE_PRESETS, guessType, validatePackageUrl } from '../../lib/packages'
import { uid } from '../../lib/id'

/** Add CDN libraries (CSS / JS) to a block */
export default function PackageManager({ value = [], onChange }) {
  const [preset, setPreset] = useState('')
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const has = (u) => value.some((p) => p.url === u)

  const addPreset = (id) => {
    const p = PACKAGE_PRESETS.find((x) => x.id === id)
    if (!p || has(p.url)) return
    onChange([...value, { ...p }]); setPreset('')
  }
  const addUrl = () => {
    const e = validatePackageUrl(url.trim()); if (e) return setErr(e)
    if (has(url.trim())) return setErr('Already added.')
    const name = url.trim().split('/').pop().split('?')[0] || 'Custom package'
    onChange([...value, { id: uid('pkg'), name, type: guessType(url), url: url.trim() }]); setUrl(''); setErr('')
  }
  return (
    <div className="pkg-mgr">
      <div className="d-flex gap-2">
        <select className="ui-input ui-select flex-grow-1" value={preset} onChange={(e) => addPreset(e.target.value)} aria-label="Add a ready package">
          <option value="">+ Add ready package…</option>
          {PACKAGE_PRESETS.map((p) => <option key={p.id} value={p.id} disabled={has(p.url)}>{p.name} ({p.type.toUpperCase()})</option>)}
        </select>
      </div>
      <div className="d-flex gap-2 mt-2">
        <input className="ui-input flex-grow-1" placeholder="https://cdn…/library.min.js" value={url} onChange={(e) => { setUrl(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())} aria-label="Package URL" />
        <button type="button" className="btn ui-btn ui-btn-secondary px-2" onClick={addUrl} aria-label="Add URL"><LuPlus /></button>
      </div>
      {err && <div className="ui-error">{err}</div>}
      <ul className="pkg-list">
        {value.length === 0 && <li className="empty">No packages added. Bootstrap/Font Awesome/Chart.js/KaTeX etc. can be added here.</li>}
        {value.map((p, i) => (
          <li key={p.url}>
            <LuPackage className="flex-shrink-0" />
            <div className="min-w-0 flex-grow-1"><div className="name">{p.name}</div><div className="url" title={p.url}>{p.url}</div></div>
            <span className={`pkg-type ${p.type}`}>{p.type}</span>
            <button type="button" className="icon-mini danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}><LuTrash2 /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}
