import { useEffect, useState } from 'react'
import { LuCircleAlert, LuDownload, LuFileText, LuImage, LuX } from 'react-icons/lu'
import Modal from '../Modal'
import { loadSyllabusFile, syllabusFilesOf } from '../../services/portalService'

/** View / download the syllabus files of a portal (several files: pick one from the list). PDF and image preview, JSON as text. */
export default function SyllabusModal({ show, onClose, portal }) {
  const files = syllabusFilesOf(portal)
  const [active, setActive] = useState(0)
  const [state, setState] = useState('loading') // loading | ready | missing | error
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [jsonText, setJsonText] = useState('')
  const filesKey = files.map((f) => f.id).join('|')

  useEffect(() => { if (show) setActive(0) }, [show, filesKey])

  useEffect(() => {
    const meta = files[active]
    if (!show || !portal || !meta) return undefined
    let alive = true
    let objectUrl = ''
    setState('loading'); setFile(null); setUrl(''); setJsonText('')
    ;(async () => {
      try {
        const f = await loadSyllabusFile(portal.id, meta)
        if (!alive) return
        if (!f?.url) return setState('missing')
        let blob = null
        try { blob = await (await fetch(f.url)).blob() } catch { blob = null } // some hosts block fetch — the direct URL still works for preview
        if (!alive) return
        if (f.type === 'application/json') {
          if (!blob) return setState('error')
          const raw = await blob.text()
          let pretty = raw
          try { pretty = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* show as-is */ }
          setJsonText(pretty)
        }
        if (blob) { objectUrl = URL.createObjectURL(new Blob([blob], { type: f.type })); setUrl(objectUrl) } else setUrl(f.url)
        setFile(f); setState('ready')
      } catch (e) { console.error(e); if (alive) setState('error') }
    })()
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [show, portal, active, filesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal show={show} onClose={onClose} className="ui-modal ui-modal-lg syllabus-modal" labelledBy="syl-title">
      <div className="ui-modal-head">
        <span className="ui-modal-icon"><LuFileText /></span>
        <div className="flex-grow-1 min-w-0"><h2 id="syl-title">Syllabus</h2><p className="text-truncate">{file?.name || files[active]?.name || portal?.name}</p></div>
        <button type="button" className="ui-x" onClick={onClose} aria-label="Close"><LuX /></button>
      </div>
      {files.length > 1 && (
        <div className="syl-tabs" role="tablist" aria-label="Syllabus files">
          {files.map((f, i) => (
            <button key={f.id} type="button" role="tab" aria-selected={i === active} className={i === active ? 'on' : ''} onClick={() => setActive(i)} title={f.name}>
              {f.type?.startsWith('image/') ? <LuImage /> : <LuFileText />}<span>{f.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="ui-modal-body syllabus-view">
        {state === 'loading' && <div className="syllabus-msg"><span className="spinner-border text-info" /></div>}
        {(state === 'missing' || state === 'error' || files.length === 0) && <div className="syllabus-msg"><LuCircleAlert className="fs-1 text-warning" /><p className="mb-0">{state === 'error' ? 'Could not load the syllabus. Please try again.' : 'No syllabus is available for this course.'}</p></div>}
        {state === 'ready' && file.type === 'application/pdf' && <iframe className="syllabus-frame" src={url} title="Syllabus PDF" />}
        {state === 'ready' && file.type.startsWith('image/') && <img className="syllabus-img" src={url} alt="Syllabus" />}
        {state === 'ready' && file.type === 'application/json' && <pre className="syllabus-json">{jsonText}</pre>}
      </div>
      <div className="ui-modal-foot">
        <button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}>Close</button>
        {state === 'ready' && <a className="btn ui-btn ui-btn-primary" href={url} download={file.name} target="_blank" rel="noopener noreferrer"><LuDownload /> Download</a>}
      </div>
    </Modal>
  )
}
