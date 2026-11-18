import { useRef } from 'react'
import { LuCircleAlert, LuFileText, LuImage, LuPlus, LuTrash2, LuUpload, LuX } from 'react-icons/lu'
import Modal from './Modal'
import { useConfirm } from './ui/Confirm'
import { SYLLABUS_LIMIT, SYLLABUS_MAX, syllabusType } from '../services/portalService'

const sizeLabel = (n) => (!n ? '' : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const kindLabel = (t) => (t === 'application/pdf' ? 'PDF' : t === 'application/json' ? 'JSON' : 'Image')

/**
 * Popup to manage the syllabus files of a portal: add many files, replace or delete one.
 * Nothing is saved to the server here — changes are applied when the portal form is saved.
 * rows = [{ key, id?, file?, name, type, size, status: 'saved' | 'new' }]
 */
export default function SyllabusManagerModal({ show, onClose, rows, onAdd, onReplace, onRemove, error, setError }) {
  const addRef = useRef(null)
  const replaceRef = useRef(null)
  const replaceKey = useRef(null)
  const confirm = useConfirm()

  const check = (file) => {
    if (!syllabusType(file)) return `${file.name}: only PDF, JPG, PNG or JSON files are allowed.`
    if (file.size > SYLLABUS_MAX) return `${file.name}: must be 5 MB or smaller.`
    return ''
  }

  function onPickAdd(e) {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (!picked.length) return
    const room = SYLLABUS_LIMIT - rows.length
    const errs = []
    const ok = []
    picked.forEach((f) => { const m = check(f); if (m) errs.push(m); else ok.push(f) })
    if (ok.length > room) errs.push(`Only ${SYLLABUS_LIMIT} syllabus files are allowed — the extra files were skipped.`)
    setError(errs.join(' '))
    if (ok.length) onAdd(ok.slice(0, Math.max(0, room)))
  }

  function onPickReplace(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !replaceKey.current) return
    const m = check(f)
    setError(m)
    if (!m) onReplace(replaceKey.current, f)
  }

  async function askDelete(row) {
    const ok = await confirm({
      title: 'Delete this syllabus file?',
      message: `“${row.name}” will be removed from this portal when you press Save Changes.`,
      danger: true,
      confirmText: 'Delete',
    })
    if (ok) onRemove(row.key)
  }

  return (
    <Modal show={show} onClose={onClose} className="ui-modal ui-modal-md syl-manager" labelledBy="sylm-title">
      <div className="ui-modal-head">
        <span className="ui-modal-icon"><LuFileText /></span>
        <div className="flex-grow-1">
          <h2 id="sylm-title">Manage Syllabus</h2>
          <p>Add, replace or delete syllabus files ({rows.length}/{SYLLABUS_LIMIT}). PDF, JPG, PNG or JSON · max 5 MB each.</p>
        </div>
        <button type="button" className="ui-x" onClick={onClose} aria-label="Close"><LuX /></button>
      </div>

      <div className="ui-modal-body">
        {error && <div className="syl-error" role="alert"><LuCircleAlert /> <span>{error}</span></div>}
        {rows.length === 0 ? (
          <div className="syl-empty">
            <LuFileText />
            <p className="mb-0">No syllabus files yet. Add one or more files for your students.</p>
          </div>
        ) : (
          <ul className="syl-list">
            {rows.map((r) => (
              <li key={r.key} className="syl-item">
                <span className="syl-ico">{r.type?.startsWith('image/') ? <LuImage /> : <LuFileText />}</span>
                <span className="syl-meta min-w-0">
                  <b title={r.name}>{r.name}</b>
                  <small>{kindLabel(r.type)}{r.size ? ` · ${sizeLabel(r.size)}` : ''}</small>
                </span>
                <span className={`syl-badge ${r.status}`}>{r.status === 'new' ? 'New · not saved yet' : 'Saved'}</span>
                <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={() => { replaceKey.current = r.key; replaceRef.current?.click() }}><LuUpload /> Replace</button>
                <button type="button" className="icon-mini danger" onClick={() => askDelete(r)} aria-label={`Delete ${r.name}`} title="Delete"><LuTrash2 /></button>
              </li>
            ))}
          </ul>
        )}
        <input ref={addRef} type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.json,application/pdf,image/jpeg,image/png,application/json" onChange={onPickAdd} />
        <input ref={replaceRef} type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.json,application/pdf,image/jpeg,image/png,application/json" onChange={onPickReplace} />
      </div>

      <div className="ui-modal-foot">
        <button type="button" className="btn ui-btn ui-btn-secondary me-auto" onClick={() => addRef.current?.click()} disabled={rows.length >= SYLLABUS_LIMIT}><LuPlus /> Add files</button>
        <button type="button" className="btn ui-btn ui-btn-primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}
