/* Firestore refuses arrays that directly contain other arrays (and `undefined` values). Table blocks keep their rows as an array of arrays,
- so portal content is converted just before it is written and restored right after it is read.
-  - a nested array  [[1,2],[3]]   is stored as   [{ "__rkArray": [1,2] }, { "__rkArray": [3] }]
-  - `undefined` object fields are omitted, `undefined` array entries become null
-  - Documents written before this existed contain no marker, so reading them returns exactly what was stored (nothing to migrate).
- Only plain objects / arrays are converted; Firestore sentinels (Timestamp, FieldValue …) pass through untouched. */
export const NESTED_KEY = '__rkArray'

const isPlain = (v) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)

/* Firestore rejects: undefined, functions, symbols, nested arrays and (in practice) non-finite numbers that JSON round-trips turn into null.
-  - functions / symbols are omitted (object fields) or become null (array entries)
-  - NaN / ±Infinity become null so Firestore and the localStorage demo store the same thing
-  - bigint becomes a string, circular references become null */
function walk(value, seen) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return String(value)
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    if (seen.has(value)) return null
    seen.add(value)
    const out = value.map((child) => {
      const c = walk(child, seen)
      if (c === undefined) return null
      return Array.isArray(child) ? { [NESTED_KEY]: c } : c
    })
    seen.delete(value)
    return out
  }
  if (isPlain(value)) {
    if (seen.has(value)) return null
    seen.add(value)
    const out = {}
    for (const [key, child] of Object.entries(value)) {
      const c = walk(child, seen)
      if (c !== undefined) out[key] = c
    }
    seen.delete(value)
    return out
  }
  return value // Timestamp, FieldValue sentinels, Date … pass through untouched
}

export function toFirestoreSafe(value) {
  return walk(value, new WeakSet())
}

export function fromFirestoreSafe(value) {
  if (Array.isArray(value)) return value.map(fromFirestoreSafe)
  if (isPlain(value)) {
    const keys = Object.keys(value)
    if (keys.length === 1 && keys[0] === NESTED_KEY && Array.isArray(value[NESTED_KEY])) {
      return fromFirestoreSafe(value[NESTED_KEY])
    }
    const out = {}
    for (const key of keys) out[key] = fromFirestoreSafe(value[key])
    return out
  }
  return value
}

/* Calculates approximate UTF-8 byte size in KB of a Firestore-safe payload */
export function estimateFirestoreSizeKb(value) {
  try {
    const safe = toFirestoreSafe(value)
    const json = JSON.stringify(safe)
    const bytes = new TextEncoder().encode(json).length
    return Math.ceil(bytes / 1024)
  } catch {
    return 0
  }
}