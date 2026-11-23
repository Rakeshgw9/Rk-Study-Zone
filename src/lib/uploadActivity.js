/* Tiny store that tracks uploads in flight, so one place can (a) show "Uploading…" feedback and (b) warn before the tab is closed.
   pct is null for indeterminate work (a single network request) and 0-100 when the work is made of countable steps. */
let jobs = []
let snap = { count: 0, pct: null, label: '' }
const listeners = new Set()

function recompute() {
  const known = jobs.filter((j) => Number.isFinite(j.pct))
  const pct = jobs.length && known.length === jobs.length ? Math.round(known.reduce((s, j) => s + j.pct, 0) / known.length) : null
  const next = { count: jobs.length, pct, label: jobs.length ? (jobs.length > 1 ? `${jobs.length} uploads` : jobs[0].label) : '' }
  if (next.count === snap.count && next.pct === snap.pct && next.label === snap.label) return
  snap = next
  listeners.forEach((fn) => fn())
}

/** Returns { progress(pct), end() }. end() is safe to call more than once. */
export function beginUpload(label = 'Uploading') {
  const job = { label, pct: null }
  jobs = [...jobs, job]
  recompute()
  return {
    progress(pct) { job.pct = Math.max(0, Math.min(100, pct)); recompute() },
    end() { if (!jobs.includes(job)) return; jobs = jobs.filter((j) => j !== job); recompute() },
  }
}

/** Wraps an async function so it is tracked for its whole duration. */
export async function trackUpload(label, fn) {
  const h = beginUpload(label)
  try { return await fn(h) } finally { h.end() }
}

export const getUploadSnapshot = () => snap
export const subscribeUploads = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const uploadsInFlight = () => jobs.length
export const resetUploads = () => { jobs = []; recompute() } // tests
