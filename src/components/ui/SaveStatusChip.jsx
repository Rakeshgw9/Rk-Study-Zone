import { LuCircleAlert, LuCircleCheck, LuLoaderCircle, LuRotateCw, LuSquarePen } from 'react-icons/lu'
import { saveStatusModel } from '../../lib/saveStatus'

/** Autosave chip: Saved / Saving… / Unsaved changes / Save failed — Retry (+ last saved time). */
export default function SaveStatusChip({ status, at, dirty, error, progress, onRetry }) {
  const m = saveStatusModel({ status, at, dirty, error, progress })
  const Icon = m.key === 'saving' ? LuLoaderCircle : m.key === 'error' ? LuCircleAlert : m.key === 'unsaved' ? LuSquarePen : LuCircleCheck
  const body = (
    <>
      <span className="save-ico">{<Icon className={m.key === 'saving' ? 'spin' : undefined} />}</span>
      <span className="save-chip-short d-xl-none">{m.short}</span>
      <span className="save-text d-none d-xl-inline">{m.label}</span>
      {m.retry && <LuRotateCw aria-hidden="true" />}
    </>
  )
  if (m.retry) {
    return (
      <button type="button" className={`save-pill s-${m.key}`} onClick={onRetry} title={error || 'Retry saving'} aria-label="Save failed — retry">{body}</button>
    )
  }
  return <span className={`save-pill s-${m.key}`} title={m.label} role="status" aria-live="polite">{body}</span>
}
