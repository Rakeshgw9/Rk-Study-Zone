import { useEffect, useState } from 'react'
import { LuCircleAlert, LuDownload, LuFileText, LuX } from 'react-icons/lu'
import Modal from '../Modal'
import { loadSyllabus } from '../../services/portalService'

/** View / download the syllabus uploaded while creating the portal (PDF and image preview, JSON as text). */
export default function SyllabusModal({ show, onClose, portal }) {
  const [state, setState] = useState('loading') // loading | ready | missing | error
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [jsonText, setJsonText] = useState('')

  useEffect(() => {
    if (!show || !portal) return undefined
    let alive = true
    let objectUrl = ''
    setState('loading'); setFile(null); setUrl(''); setJsonText('')
    ;(async () => {
      try {
        const f = await loadSyllabus(portal.id)
        if (!alive) return
        if (!f?.data) return setState('missing')
        const blob = await (await fetch(f.data)).blob()
        if (!alive) return
        if (f.type === 'application/json') {
          const raw = await blob.text()
          let pretty = raw
          try { pretty = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* show as-is */ }
          setJsonText(pretty)
        }
        objectUrl = URL.createObjectURL(blob)
        setFile(f); setUrl(objectUrl); setState('ready')
      } catch (e) { console.error(e); if (alive) setState('error') }
    })()
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [show, portal])

  return (
    <Modal show={show} onClose={onClose} className="ui-modal ui-modal-lg syllabus-modal" labelledBy="syl-title">
      <div className="ui-modal-head">
        <span className="ui-modal-icon"><LuFileText /></span>
        <div className="flex-grow-1 min-w-0"><h2 id="syl-title">Syllabus</h2><p className="text-truncate">{file?.name || portal?.syllabusName || portal?.name}</p></div>
        <button type="button" className="ui-x" onClick={onClose} aria-label="Close"><LuX /></button>
      </div>
      <div className="ui-modal-body syllabus-view">
        {state === 'loading' && <div className="syllabus-msg"><span className="spinner-border text-info" /></div>}
        {(state === 'missing' || state === 'error') && <div className="syllabus-msg"><LuCircleAlert className="fs-1 text-warning" /><p className="mb-0">{state === 'missing' ? 'No syllabus is available for this course.' : 'Could not load the syllabus. Please try again.'}</p></div>}
        {state === 'ready' && file.type === 'application/pdf' && <iframe className="syllabus-frame" src={url} title="Syllabus PDF" />}
        {state === 'ready' && file.type.startsWith('image/') && <img className="syllabus-img" src={url} alt="Syllabus" />}
        {state === 'ready' && file.type === 'application/json' && <pre className="syllabus-json">{jsonText}</pre>}
      </div>
      <div className="ui-modal-foot">
        <button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}>Close</button>
        {state === 'ready' && <a className="btn ui-btn ui-btn-primary" href={url} download={file.name}><LuDownload /> Download</a>}
      </div>
    </Modal>
  )
}
