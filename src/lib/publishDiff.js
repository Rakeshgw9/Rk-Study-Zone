/* Lightweight "what changed since the last publish" — pure functions.
   A signature is small (ids + 32-bit content hashes), so it can be stored next to the portal and compared later
   without re-reading every chapter. */
export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}
export const hashBlock = (b) => hashString(`${b?.type}|${JSON.stringify(b?.data ?? null)}`)

/** content: already filtered to visible blocks. */
export function contentSignature(content) {
  return {
    v: 1,
    u: (content?.units || []).map((u) => ({
      id: String(u.id), t: String(u.title || ''),
      c: (u.chapters || []).map((c) => ({
        id: String(c.id), t: String(c.title || ''),
        b: (c.blocks || []).map((b) => [String(b.id), hashBlock(b), String(b.type || '')]),
      })),
    })),
  }
}

const unitName = (u, i) => u?.t || `Unit ${i + 1}`
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

/** → { first, empty, changes:[{kind,unitId,unitTitle,chapterId,chapterTitle,added,changed,removed,exams}], totals } */
export function diffSignatures(prev, next) {
  if (!prev) return { first: true, empty: false, changes: [], totals: {} }
  const changes = []
  const pu = new Map((prev.u || []).map((u) => [u.id, u]))
  const nu = new Map((next.u || []).map((u) => [u.id, u]))
  ;(next.u || []).forEach((u, ui) => {
    const old = pu.get(u.id)
    if (!old) { changes.push({ kind: 'unit-added', unitId: u.id, unitTitle: unitName(u, ui), chapterId: u.c[0]?.id || null, chapters: u.c.length }); return }
    const pc = new Map(old.c.map((c) => [c.id, c]))
    const nc = new Map(u.c.map((c) => [c.id, c]))
    u.c.forEach((c) => {
      const oc = pc.get(c.id)
      if (!oc) { changes.push({ kind: 'chapter-added', unitId: u.id, unitTitle: unitName(u, ui), chapterId: c.id, chapterTitle: c.t, blocks: c.b.length, exams: c.b.filter((b) => b[2] === 'mcq').length }); return }
      const ob = new Map(oc.b.map((b) => [b[0], b[1]]))
      const nb = new Map(c.b.map((b) => [b[0], b[1]]))
      const addedBlocks = c.b.filter((b) => !ob.has(b[0]))
      const changed = c.b.filter((b) => ob.has(b[0]) && ob.get(b[0]) !== b[1]).length
      const removed = oc.b.filter((b) => !nb.has(b[0])).length
      const renamed = oc.t !== c.t
      if (addedBlocks.length || changed || removed || renamed) {
        changes.push({ kind: 'chapter-changed', unitId: u.id, unitTitle: unitName(u, ui), chapterId: c.id, chapterTitle: c.t, added: addedBlocks.length, changed, removed, renamed, exams: addedBlocks.filter((b) => b[2] === 'mcq').length })
      }
    })
    old.c.forEach((c) => { if (!nc.has(c.id)) changes.push({ kind: 'chapter-removed', unitId: u.id, unitTitle: unitName(u, ui), chapterId: null, chapterTitle: c.t }) })
  })
  ;(prev.u || []).forEach((u, ui) => { if (!nu.has(u.id)) changes.push({ kind: 'unit-removed', unitId: u.id, unitTitle: unitName(u, ui), chapterId: null }) })
  const totals = changes.reduce((t, c) => ({
    added: t.added + (c.added || 0) + (c.blocks || 0), changed: t.changed + (c.changed || 0), removed: t.removed + (c.removed || 0), exams: t.exams + (c.exams || 0),
  }), { added: 0, changed: 0, removed: 0, exams: 0 })
  return { first: false, empty: changes.length === 0, changes, totals }
}

/** Human lines, e.g. "3 new blocks in Unit 2 › Chapter 4". */
export function describeChange(c) {
  const where = `${c.unitTitle}${c.chapterTitle ? ` › ${c.chapterTitle}` : ''}`
  switch (c.kind) {
    case 'unit-added': return `New unit: ${c.unitTitle}`
    case 'unit-removed': return `Unit removed: ${c.unitTitle}`
    case 'chapter-added': return `New chapter: ${where}`
    case 'chapter-removed': return `Chapter removed: ${where}`
    default: {
      const parts = []
      if (c.added) parts.push(`${plural(c.added, 'new block')}`)
      if (c.changed) parts.push(`${plural(c.changed, 'block')} updated`)
      if (c.removed) parts.push(`${plural(c.removed, 'block')} removed`)
      if (c.renamed && !parts.length) return `Chapter renamed: ${where}`
      return `${parts.join(', ')} in ${where}`
    }
  }
}

/** { title, summary, lines (≤ 12), chapterId (deep link target), hasExam } */
export function summarizeDiff(diff, portalName = 'this portal') {
  const all = diff.changes.map(describeChange)
  const lines = all.slice(0, 12)
  const more = all.length - 3
  const summary = all.slice(0, 3).join(' · ') + (more > 0 ? ` · and ${more} more` : '')
  const target = diff.changes.find((c) => c.chapterId)?.chapterId || null
  return { title: `Updated: ${portalName}`, summary: summary || 'Content updated', lines, chapterId: target, hasExam: (diff.totals.exams || 0) > 0 }
}
