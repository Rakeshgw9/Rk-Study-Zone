/* Size meter helpers for the editor ("412 KB of 950 KB"). */
export const DOC_LIMIT_BYTES = 950 * 1024 // one Firestore document (kept from the original limit)
export const MAX_CHAPTER_BYTES = 12 * 1024 * 1024 // all parts of one chapter together
export const WARN_AT = 0.8

export function byteLength(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length
  return unescape(encodeURIComponent(s)).length // eslint-disable-line no-restricted-globals
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '0 KB'
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** level: ok | warn | chunked | over.  "chunked" = bigger than one document but still saved in several parts. */
export function sizeMeter(bytes, { limit = DOC_LIMIT_BYTES, max = MAX_CHAPTER_BYTES } = {}) {
  const used = Math.max(0, bytes || 0)
  const parts = Math.max(1, Math.ceil(used / limit))
  let level = 'ok'
  if (used > max) level = 'over'
  else if (used > limit) level = 'chunked'
  else if (used >= limit * WARN_AT) level = 'warn'
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const label = level === 'chunked' || level === 'over'
    ? `${formatBytes(used)} · saved in ${parts} parts`
    : `${formatBytes(used)} of ${formatBytes(limit)}`
  return { used, limit, pct, level, parts, label }
}
