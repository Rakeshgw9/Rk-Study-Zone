/** Progress helpers — only visible (published) blocks count */
export function visibleContent(content) {
  return { ...content, units: (content?.units || []).map((u) => ({ ...u, chapters: u.chapters.map((c) => ({ ...c, blocks: c.blocks.filter((b) => b.visible !== false) })) })) }
}
export const chapterProgress = (ch, done = {}) => {
  const n = ch.blocks.length; const d = ch.blocks.filter((b) => done[b.id]).length
  return { done: d, total: n, pct: n ? Math.round((d / n) * 100) : 0 }
}
export const unitProgress = (u, done = {}) => {
  const bl = u.chapters.flatMap((c) => c.blocks); const d = bl.filter((b) => done[b.id]).length
  return { done: d, total: bl.length, pct: bl.length ? Math.round((d / bl.length) * 100) : 0 }
}
export const overallProgress = (content, done = {}) => {
  const bl = content.units.flatMap((u) => u.chapters.flatMap((c) => c.blocks)); const d = bl.filter((b) => done[b.id]).length
  return { done: d, total: bl.length, pct: bl.length ? Math.round((d / bl.length) * 100) : 0 }
}
