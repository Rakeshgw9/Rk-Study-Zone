/* Student-side portal discovery: search, filters, sorting, recommendations (pure). */
import { toMillis } from './id'

export const createdAtOf = (p) => toMillis(p?.createdAt)
/** "Last updated" for students = last publish, falling back to the last edit. */
export const updatedAtOf = (p) => toMillis(p?.publishedAt) || toMillis(p?.updatedAt) || createdAtOf(p)

const norm = (s) => String(s ?? '').trim().toLowerCase()
export const SORTS = [
  { v: 'updated', l: 'Recently updated' },
  { v: 'newest', l: 'Newest' },
  { v: 'name', l: 'Name A–Z' },
  { v: 'progress', l: 'My progress' },
]

/** items: [{ portal, prog:{pct} }] */
export function filterPortals(items = [], { search = '', specialization = '', category = '', teacher = '', sort = 'updated' } = {}) {
  const q = norm(search)
  const out = items.filter(({ portal: p }) => {
    if (specialization && norm(p.ownerSpecialization) !== norm(specialization)) return false
    if (category && p.category !== category) return false
    if (teacher && p.ownerId !== teacher) return false
    if (q && !`${p.name} ${p.ownerName || ''}`.toLowerCase().includes(q)) return false
    return true
  })
  const by = {
    updated: (a, b) => updatedAtOf(b.portal) - updatedAtOf(a.portal),
    newest: (a, b) => createdAtOf(b.portal) - createdAtOf(a.portal),
    name: (a, b) => String(a.portal.name).localeCompare(String(b.portal.name)),
    progress: (a, b) => (b.prog?.pct || 0) - (a.prog?.pct || 0),
  }[sort] || (() => 0)
  return [...out].sort(by)
}

export function facets(items = []) {
  const spec = new Set()
  const cat = new Set()
  const teachers = new Map()
  for (const { portal: p } of items) {
    if (p.ownerSpecialization) spec.add(p.ownerSpecialization)
    if (p.category) cat.add(p.category)
    if (p.ownerId) teachers.set(p.ownerId, p.ownerName || 'Teacher')
  }
  return {
    specializations: [...spec].sort((a, b) => a.localeCompare(b)),
    categories: [...cat].sort(),
    teachers: [...teachers].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Portals the student has not started, ranked by overlap with specialization / category of portals they did start. */
export function recommend(items = [], limit = 3) {
  const started = items.filter((x) => (x.prog?.pct || 0) > 0)
  const specs = new Set(started.map((x) => norm(x.portal.ownerSpecialization)).filter(Boolean))
  const cats = new Set(started.map((x) => x.portal.category).filter(Boolean))
  return items
    .filter((x) => !(x.prog?.pct > 0))
    .map((x) => ({ x, score: (specs.has(norm(x.portal.ownerSpecialization)) ? 2 : 0) + (cats.has(x.portal.category) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || updatedAtOf(b.x.portal) - updatedAtOf(a.x.portal))
    .slice(0, limit)
    .map((r) => r.x)
}

/** The chapter the student should resume: most recent lastReading / lastChapterId across enrolled portals. */
export function continueReading(items = []) {
  let best = null
  for (const x of items) {
    const at = toMillis(x.sd?.lastReading?.at) || 0
    const chapterId = x.sd?.lastChapterId
    if (!chapterId || !(x.prog?.pct > 0 || at)) continue
    if (!best || at > best.at) best = { x, chapterId, at }
  }
  return best
}

export function averagePct(items = []) {
  const list = items.filter((x) => (x.prog?.pct || 0) > 0)
  return list.length ? Math.round(list.reduce((s, x) => s + x.prog.pct, 0) / list.length) : 0
}
