/* Pure helpers for the autosave status chip and progress labels. */
export function formatClock(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** status: saved | saving | unsaved | error */
export function saveStatusModel({ status = 'saved', at = null, dirty = false, error = '', progress = null } = {}) {
  const key = dirty && status !== 'saving' ? 'unsaved' : status
  const clock = formatClock(at)
  const pct = Number.isFinite(progress) ? ` ${Math.round(progress)}%` : ''
  switch (key) {
    case 'saving': return { key, label: `Saving…${pct}`, short: `Saving…${pct}`, retry: false }
    case 'unsaved': return { key, label: 'Unsaved changes', short: 'Unsaved', retry: false }
    case 'error': return { key, label: `Save failed${error ? ` — ${error}` : ''}`, short: 'Retry', retry: true }
    default: return { key: 'saved', label: clock ? `Saved · last saved at ${clock}` : 'All changes saved', short: 'Saved', retry: false }
  }
}

/** "Saving 45%" / "Publishing chunk 2 of 5" style label for buttons. */
export function progressLabel(base, { pct = null, step = null, total = null } = {}) {
  if (Number.isFinite(step) && Number.isFinite(total) && total > 1) return `${base} ${step} of ${total}`
  if (Number.isFinite(pct)) return `${base} ${Math.max(0, Math.min(100, Math.round(pct)))}%`
  return `${base}…`
}

/** Calls onProgress(pct) as `done` of `total` steps complete (never goes backwards, never above 100). */
export function makeProgress(total, onProgress) {
  let done = 0
  return {
    tick(n = 1) {
      done = Math.min(total, done + n)
      onProgress?.(total ? Math.round((done / total) * 100) : 100, done, total)
    },
  }
}
