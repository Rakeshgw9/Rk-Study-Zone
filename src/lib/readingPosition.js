/**
 * Cross-device student reading position helpers (Unit -> Chapter -> Block -> Section).
 * Persisted inside Firestore `studentData/{uid}_{portalId}` so any user logging in
 * from any device resumes at their exact last-read block/section.
 */

export function parseReadingAnchor(anchorId, fallbackBlockId = null) {
  const id = typeof anchorId === 'string' ? anchorId.trim() : ''
  if (!id) {
    return fallbackBlockId
      ? { blockId: fallbackBlockId, sectionId: null, anchorId: `b-${fallbackBlockId}` }
      : { blockId: null, sectionId: null, anchorId: null }
  }
  if (id.startsWith('sec-')) {
    const rest = id.slice(4)
    if (fallbackBlockId && rest.startsWith(`${fallbackBlockId}-`)) {
      return {
        blockId: fallbackBlockId,
        sectionId: rest.slice(fallbackBlockId.length + 1) || null,
        anchorId: id,
      }
    }
    const dash = rest.indexOf('-')
    if (dash > 0) {
      return {
        blockId: rest.slice(0, dash),
        sectionId: rest.slice(dash + 1) || null,
        anchorId: id,
      }
    }
  }
  if (id.startsWith('b-')) {
    const blk = id.slice(2) || fallbackBlockId || null
    return { blockId: blk, sectionId: null, anchorId: blk ? `b-${blk}` : null }
  }
  return { blockId: fallbackBlockId || null, sectionId: null, anchorId: id }
}

export function buildReadingRecord({ unitId, chapterId, blockId = null, sectionId = null, anchorId = null, updatedAt = Date.now() }) {
  if (!chapterId) return null
  const resolvedAnchor =
    anchorId ||
    (blockId && sectionId ? `sec-${blockId}-${sectionId}` : blockId ? `b-${blockId}` : null)
  return {
    unitId: unitId || null,
    chapterId,
    blockId: blockId || null,
    sectionId: sectionId || null,
    anchorId: resolvedAnchor,
    updatedAt,
  }
}

export function isSameReadingPosition(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    (a.unitId ?? null) === (b.unitId ?? null) &&
    (a.chapterId ?? null) === (b.chapterId ?? null) &&
    (a.blockId ?? null) === (b.blockId ?? null) &&
    (a.sectionId ?? null) === (b.sectionId ?? null) &&
    (a.anchorId ?? null) === (b.anchorId ?? null)
  )
}

/**
 * Resolves the saved reading target for a given chapter (checking per-chapter history first,
 * then overall portal `lastReading` if it belongs to this chapter).
 */
export function getSavedReadingForChapter(sd, chapterId) {
  if (!sd || !chapterId) return null
  const perChapter = sd.chapterReading?.[chapterId]
  if (perChapter && (perChapter.anchorId || perChapter.blockId)) {
    return perChapter
  }
  if (sd.lastReading?.chapterId === chapterId && (sd.lastReading.anchorId || sd.lastReading.blockId)) {
    return sd.lastReading
  }
  return null
}

/**
 * Resolves the initial chapter ID to open when a student loads a portal without an explicit
 * chapter/unit in the URL.
 */
export function resolveInitialChapterId({ requestedChapter, unitFirstChapterId, sd }) {
  return requestedChapter || unitFirstChapterId || sd?.lastReading?.chapterId || sd?.lastChapterId || null
}

/**
 * Applies a new reading position into studentData immutably (for Firestore persistence).
 */
export function withReadingPosition(sd, record) {
  if (!sd || !record?.chapterId) return sd
  const prevChapterRec = sd.chapterReading?.[record.chapterId]
  if (isSameReadingPosition(sd.lastReading, record) && isSameReadingPosition(prevChapterRec, record)) {
    return sd
  }
  return {
    ...sd,
    lastChapterId: record.chapterId,
    lastReading: record,
    chapterReading: {
      ...(sd.chapterReading || {}),
      [record.chapterId]: record,
    },
  }
}
