import { useEffect, useMemo, useState } from 'react'
import { LuCheck, LuCopy, LuExternalLink, LuShare2, LuTriangleAlert, LuX } from 'react-icons/lu'
import Modal from './Modal'
import { accessNotice, appBaseUrl, buildShareModel } from '../lib/shareLinks'
import { formatClock } from '../lib/saveStatus'

function CopyField({ label, value, disabled }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(false), 1600); return () => clearTimeout(t) }, [copied])
  const copy = async () => {
    if (!value) return
    try { await navigator.clipboard.writeText(value) } catch {
      const ta = document.createElement('textarea')
      ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      ta.remove()
    }
    setCopied(true)
  }
  return (
    <div className="pub-field">
      <label className="pub-label">{label}</label>
      <div className="pub-row">
        <input className="form-control pub-input" readOnly value={value || 'No chapters in this unit yet'} onFocus={(e) => e.target.select()} aria-label={label} />
        <button type="button" className="btn ui-btn ui-btn-secondary pub-btn" onClick={copy} disabled={disabled || !value} aria-label={`Copy ${label}`}>
          {copied ? <LuCheck /> : <LuCopy />}<span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
        <a className={`btn ui-btn ui-btn-secondary pub-btn${value ? '' : ' disabled'}`} href={value || undefined} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} in a new tab`} aria-disabled={!value}>
          <LuExternalLink /><span className="d-none d-sm-inline">Open</span>
        </a>
      </div>
      <span className="visually-hidden" role="status" aria-live="polite">{copied ? `${label} copied` : ''}</span>
    </div>
  )
}

/** "Portal Published" popup — also reused as the "Share links" dialog (justPublished=false). */
export default function PublishedModal({ show, onClose, portal, content, publishedAt, publishedBy, justPublished = true }) {
  const base = useMemo(() => appBaseUrl(), [])
  const model = useMemo(() => buildShareModel(base, portal?.id, content), [base, portal?.id, content])
  const [unitId, setUnitId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [qr, setQr] = useState(null)

  const unit = model.units.find((u) => u.id === unitId) || model.units[0]
  const allChapters = model.units.flatMap((u) => u.chapters)
  const chapter = allChapters.find((c) => c.id === chapterId) || allChapters[0]

  useEffect(() => {
    if (!show || !model.portalUrl) return
    let live = true
    import('../lib/qr').then((m) => { if (live) setQr(m.qrSvg(model.portalUrl, { size: 148 })) }).catch(() => live && setQr(null))
    return () => { live = false }
  }, [show, model.portalUrl])

  if (!show || !portal) return null
  const notes = accessNotice(portal) || []
  const when = publishedAt ? new Date(publishedAt) : null
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  const share = async () => { try { await navigator.share({ title: portal.name, text: `${portal.name} — RK Study Zone`, url: model.portalUrl }) } catch { /* cancelled */ } }

  return (
    <Modal show={show} onClose={onClose} className="pub-modal" labelledBy="pub-title">
      <div className="pub-head">
        <div>
          <h2 id="pub-title" className="pub-title">{justPublished ? 'Portal Published' : 'Share links'}</h2>
          <p className="pub-sub">{justPublished ? 'Students can see the latest version now.' : 'Copy a link and send it to your students.'}</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><LuX /></button>
      </div>

      <div className="pub-body">
        <dl className="pub-summary">
          <div><dt>Portal</dt><dd title={portal.name}>{portal.name}</dd></div>
          <div><dt>Published</dt><dd>{when ? `${when.toLocaleDateString()} ${formatClock(publishedAt)}` : 'Not published yet'}</dd></div>
          <div><dt>By</dt><dd>{publishedBy || portal.ownerName || '—'}</dd></div>
          <div><dt>Content</dt><dd>{model.counts.units} units · {model.counts.chapters} chapters · {model.counts.blocks} blocks</dd></div>
        </dl>

        {notes.length > 0 && (
          <div className="pub-notice" role="note"><LuTriangleAlert aria-hidden="true" /><ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul></div>
        )}

        <div className="pub-grid">
          <div className="pub-links">
            <CopyField label="Portal link" value={model.portalUrl} />

            <div className="pub-field">
              <label className="pub-label" htmlFor="pub-unit">Unit link</label>
              <select id="pub-unit" className="form-select" value={unit?.id || ''} onChange={(e) => setUnitId(e.target.value)} disabled={!model.units.length}>
                {model.units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
              <CopyField label="Unit link (opens its first chapter)" value={unit?.link || ''} />
            </div>

            <div className="pub-field">
              <label className="pub-label" htmlFor="pub-chapter">Chapter link</label>
              <select id="pub-chapter" className="form-select" value={chapter?.id || ''} onChange={(e) => setChapterId(e.target.value)} disabled={!allChapters.length}>
                {model.units.filter((u) => u.chapters.length).map((u) => (
                  <optgroup key={u.id} label={u.title}>{u.chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>
                ))}
              </select>
              <CopyField label="Chapter link" value={chapter?.link || ''} />
            </div>
          </div>

          <div className="pub-qr">
            {qr ? <div className="pub-qr-img" role="img" aria-label="QR code for the portal link" dangerouslySetInnerHTML={{ __html: qr }} /> : <div className="pub-qr-img rk-skel" aria-hidden="true" />}
            <small>Scan to open the portal</small>
            {canShare && <button type="button" className="btn ui-btn ui-btn-secondary pub-btn" onClick={share}><LuShare2 /> Share</button>}
          </div>
        </div>
      </div>

      <div className="pub-foot">
        <a className="btn ui-btn ui-btn-primary" href={model.portalUrl} target="_blank" rel="noopener noreferrer"><LuExternalLink /> Open portal</a>
        <button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}
