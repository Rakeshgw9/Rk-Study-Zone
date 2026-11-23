/* Transparent chunking of a chapter's blocks across several Firestore documents.
   chapters/{id}              { unitId, chapterId, blocks:[...] }                       (legacy, or small chapter)
   chapters/{id}              { unitId, chapterId, blocks:[], partCount:n }             (big chapter)
   chapters/{id}/parts/{000}  { index, blocks:[...] }                                  (n part documents)
   Old single-document chapters have no `partCount`, so they are read exactly as before. */
import { byteLength, DOC_LIMIT_BYTES, MAX_CHAPTER_BYTES } from './sizeMeter'

export const partId = (i) => String(i).padStart(3, '0')

/** Splits blocks (in order) into groups that each stay under `limit` bytes. A single block over the limit cannot be split. */
export function splitBlocks(blocks = [], limit = DOC_LIMIT_BYTES, sizeOf = byteLength) {
  const list = Array.isArray(blocks) ? blocks : []
  const total = list.length ? sizeOf(list) : 2
  if (total <= limit) return { parts: [list], total, tooBigBlock: null }
  const parts = []
  let cur = []
  let curBytes = 2
  let tooBigBlock = null
  let sum = 0
  for (const b of list) {
    const size = sizeOf(b) + 1
    sum += size
    if (size > limit && !tooBigBlock) tooBigBlock = { id: b?.id, bytes: size }
    if (cur.length && curBytes + size > limit) {
      parts.push(cur)
      cur = []
      curBytes = 2
    }
    cur.push(b)
    curBytes += size
  }
  if (cur.length) parts.push(cur)
  return { parts, total: sum, tooBigBlock }
}

/** Throws a friendly error when a chapter cannot be stored. */
export function assertChapterFits(title, split, max = MAX_CHAPTER_BYTES, limit = DOC_LIMIT_BYTES) {
  if (split.tooBigBlock) {
    throw new Error(`A block in chapter "${title}" is ${(split.tooBigBlock.bytes / 1024).toFixed(0)} KB — one block must stay under ${Math.round(limit / 1024)} KB. Split it into smaller blocks or use image URLs.`)
  }
  if (split.total > max) {
    throw new Error(`Chapter "${title}" is ${(split.total / 1048576).toFixed(1)} MB — over the ${Math.round(max / 1048576)} MB chapter limit.`)
  }
}

/** Joins part documents (any order) back into one blocks array. */
export function joinParts(partDocs = []) {
  return [...partDocs]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => (Array.isArray(p.blocks) ? p.blocks : []))
}
