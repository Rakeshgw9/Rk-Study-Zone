import { useEffect, useSyncExternalStore } from 'react'
import { UploadProgress } from './Loaders'
import { getUploadSnapshot, subscribeUploads } from '../../lib/uploadActivity'

/** App-wide feedback for every upload (image, media, profile photo, syllabus) + leave-page warning while one is running. */
export default function UploadActivityBar() {
  const s = useSyncExternalStore(subscribeUploads, getUploadSnapshot, getUploadSnapshot)
  useEffect(() => {
    if (!s.count) return undefined
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [s.count])
  if (!s.count) return null
  return (
    <div className="upload-activity" role="status" aria-live="polite">
      <UploadProgress pct={s.pct} label={s.label} sub="please keep this tab open" />
    </div>
  )
}
