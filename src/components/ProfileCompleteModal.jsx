import { useEffect, useState } from 'react'
import { LuUser } from 'react-icons/lu'
import Modal from './Modal'
import TeacherProfileFields from './TeacherProfileFields'
import { useToast } from './Toast'
import { ProgressButton } from './ui/Loaders'
import { useAuth } from '../context/AuthContext'
import { validateProfile } from '../lib/profile'
import { updateUserProfile } from '../services/authService'
import { syncOwnerIdentity } from '../services/portalService'

/** "Complete your profile" — teachers must give a name and specialization before creating / publishing a portal.
 *  Existing portals stay viewable; nothing is blocked except create + publish. */
export default function ProfileCompleteModal({ show, onClose, onDone, reason = '' }) {
  const { user } = useAuth()
  const toast = useToast()
  const [vals, setVals] = useState({})
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(null)

  useEffect(() => {
    if (show) { setVals({ name: user?.name || '', specialization: user?.specialization || '', qualification: user?.qualification || '' }); setErrors({}) }
  }, [show]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null
  const save = async (e) => {
    e.preventDefault()
    const v = validateProfile(vals, user?.role || 'teacher')
    setErrors(v.errors)
    if (!v.ok) return
    setBusy(true)
    try {
      const { name, ...details } = v.values
      const updated = await updateUserProfile({ name, details: { specialization: details.specialization, qualification: details.qualification } })
      await syncOwnerIdentity({ ...(updated || user), name, ...details }, { onProgress: (p) => setPct(p) }).catch(() => {})
      toast('Profile completed — thank you!')
      onDone?.()
      onClose?.()
    } catch (err) {
      toast(err.message || 'Could not save your profile', 'error', { action: { label: 'Retry', onClick: () => save({ preventDefault() {} }) } })
    } finally { setBusy(false); setPct(null) }
  }

  return (
    <Modal show={show} onClose={busy ? undefined : onClose} className="ui-modal ui-modal-md" labelledBy="pc-title">
      <div className="ui-modal-head">
        <span className="ui-modal-icon"><LuUser /></span>
        <div className="flex-grow-1">
          <h2 id="pc-title">Complete your profile</h2>
          <p>{reason || 'Students see your name and specialization on every portal you publish.'}</p>
        </div>
        <button className="ui-x" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
      </div>
      <form onSubmit={save} noValidate>
        <div className="ui-modal-body"><TeacherProfileFields values={vals} errors={errors} onChange={(k, v) => setVals((x) => ({ ...x, [k]: v }))} idPrefix="pc" /></div>
        <div className="ui-modal-foot d-flex justify-content-end gap-2">
          <button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose} disabled={busy}>Later</button>
          <ProgressButton type="submit" className="btn ui-btn ui-btn-primary" busy={busy} pct={pct} busyLabel="Saving…">Save profile</ProgressButton>
        </div>
      </form>
    </Modal>
  )
}
