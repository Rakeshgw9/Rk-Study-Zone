/**
 * Unified builder navigation, selection, scroll request, and tree open/closed reducer.
 * Replaces separate sel, ui.jsonSec, secScroll, and scrollReq states in BuilderPage.
 */

export const INITIAL_NAV_STATE = {
  target: {
    unitId: null,
    chapterId: null,
    blockId: null,
    sectionId: null,
  },
  scroll: {
    to: null,
    source: null,
    n: 0,
  },
  treeOpen: {
    unit: {},
    chapter: {},
    blockSections: {},
  },
}

export function normalizeTarget(raw) {
  if (!raw || typeof raw !== 'object') {
    return { unitId: null, chapterId: null, blockId: null, sectionId: null }
  }
  const unitId = raw.unitId ?? null
  const chapterId = unitId ? (raw.chapterId ?? null) : null
  const blockId = chapterId ? (raw.blockId ?? null) : null
  const sectionId = blockId ? (raw.sectionId ?? null) : null
  return { unitId, chapterId, blockId, sectionId }
}

export function isSameTarget(a, b) {
  if (!a || !b) return false
  return (
    (a.unitId ?? null) === (b.unitId ?? null) &&
    (a.chapterId ?? null) === (b.chapterId ?? null) &&
    (a.blockId ?? null) === (b.blockId ?? null) &&
    (a.sectionId ?? null) === (b.sectionId ?? null)
  )
}

/**
 * Persistence helpers for "Continue Where You Left Off" (per portalId).
 * Stores { unitId, chapterId } in localStorage safely.
 */
const LAST_EDITED_PREFIX = 'rk_builder_last_edited:'

export function lastEditedStorageKey(portalId) {
  return `${LAST_EDITED_PREFIX}${portalId || ''}`
}

export function saveLastEdited(portalId, target, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!portalId || !storage) return false
  const norm = normalizeTarget(target)
  if (!norm.unitId) return false
  try {
    storage.setItem(
      lastEditedStorageKey(portalId),
      JSON.stringify({
        unitId: norm.unitId,
        chapterId: norm.chapterId || null,
        updatedAt: Date.now(),
      })
    )
    return true
  } catch {
    return false
  }
}

export function loadLastEdited(portalId, content, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!portalId || !storage || !content?.units?.length) return null
  try {
    const raw = storage.getItem(lastEditedStorageKey(portalId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.unitId) return null
    const unit = content.units.find((u) => u.id === parsed.unitId)
    if (!unit) return null
    const chapter = parsed.chapterId
      ? unit.chapters?.find((c) => c.id === parsed.chapterId)
      : null
    return {
      unitId: unit.id,
      chapterId: chapter ? chapter.id : null,
    }
  } catch {
    return null
  }
}

/**
 * Unit & Chapter Edit Lock guard.
 * Returns true when a user-initiated navigation would switch away from the
 * currently edited unit or chapter while edit lock is active.
 */
export function shouldConfirmSwitch(currentTarget, nextTarget, source = 'action', isLocked = true) {
  if (!isLocked) return false
  if (source === 'spy' || source === 'init' || source === 'action') return false

  const cur = normalizeTarget(currentTarget)
  const next = normalizeTarget(nextTarget)

  // Nothing actively selected yet
  if (!cur.unitId) return false

  // Currently editing a chapter: any change of unit or chapter (including exiting chapter) requires confirmation
  if (cur.chapterId) {
    return next.unitId !== cur.unitId || next.chapterId !== cur.chapterId
  }

  // Currently on a unit overview (no chapter open): switching to a different unit requires confirmation;
  // drilling into a chapter of the same unit does not.
  if (next.unitId && next.unitId !== cur.unitId) {
    return true
  }
  return false
}

function forceOpenAncestors(treeOpen, target) {
  let unit = treeOpen.unit
  let chapter = treeOpen.chapter
  let blockSections = treeOpen.blockSections

  // Exclusive single-open unit accordion: opening/selecting a unit hides all other units' chapters
  if (target.unitId) {
    const otherUnitOpen = Object.keys(unit).some((k) => k !== target.unitId && unit[k] === true)
    if (unit[target.unitId] !== true || otherUnitOpen) {
      unit = { [target.unitId]: true }
    }
  }
  // Exclusive single-open chapter accordion: opening/selecting a chapter hides all other chapters' blocks
  if (target.chapterId) {
    const otherChapterOpen = Object.keys(chapter).some((k) => k !== target.chapterId && chapter[k] === true)
    if (chapter[target.chapterId] !== true || otherChapterOpen) {
      chapter = { [target.chapterId]: true }
    }
  }
  if (target.blockId && target.sectionId) {
    const otherBlkOpen = Object.keys(blockSections).some((k) => k !== target.blockId && blockSections[k] === true)
    if (blockSections[target.blockId] !== true || otherBlkOpen) {
      blockSections = { [target.blockId]: true }
    }
  }

  if (unit === treeOpen.unit && chapter === treeOpen.chapter && blockSections === treeOpen.blockSections) {
    return treeOpen
  }
  return { unit, chapter, blockSections }
}

export function isUnitOpen(treeOpen, target, unitId) {
  if (treeOpen?.unit && Object.prototype.hasOwnProperty.call(treeOpen.unit, unitId)) {
    return !!treeOpen.unit[unitId]
  }
  if (treeOpen?.unit && Object.values(treeOpen.unit).some(Boolean)) {
    return false
  }
  return target?.unitId ? target.unitId === unitId : false
}

export function isChapterOpen(treeOpen, target, chapterId) {
  if (treeOpen?.chapter && Object.prototype.hasOwnProperty.call(treeOpen.chapter, chapterId)) {
    return !!treeOpen.chapter[chapterId]
  }
  if (treeOpen?.chapter && Object.values(treeOpen.chapter).some(Boolean)) {
    return false
  }
  return target?.chapterId === chapterId
}

export function isBlockSectionsOpen(treeOpen, target, blockId) {
  if (treeOpen?.blockSections && Object.prototype.hasOwnProperty.call(treeOpen.blockSections, blockId)) {
    return !!treeOpen.blockSections[blockId]
  }
  if (treeOpen?.blockSections && Object.values(treeOpen.blockSections).some(Boolean)) {
    return false
  }
  return target?.blockId === blockId
}

function applySelection(state, rawTarget, source, shouldScroll) {
  const nextTarget = normalizeTarget(rawTarget)
  const nextTreeOpen = forceOpenAncestors(state.treeOpen, nextTarget)
  const nextScroll = shouldScroll
    ? { to: nextTarget, source, n: state.scroll.n + 1 }
    : state.scroll

  if (
    !shouldScroll &&
    isSameTarget(state.target, nextTarget) &&
    nextTreeOpen === state.treeOpen
  ) {
    return state
  }

  return {
    target: nextTarget,
    scroll: nextScroll,
    treeOpen: nextTreeOpen,
  }
}

export function builderNavReducer(state = INITIAL_NAV_STATE, action) {
  if (!action || typeof action.type !== 'string') return state

  switch (action.type) {
    case 'SELECT': {
      const source = action.source || 'action'
      const shouldScroll = action.scroll === true || source === 'tree'
      return applySelection(state, action.target, source, shouldScroll)
    }

    case 'TREE_CLICK': {
      return applySelection(state, action.target, 'tree', true)
    }

    case 'PAGE_CLICK': {
      return applySelection(state, action.target, 'page', false)
    }

    case 'SPY': {
      return applySelection(state, action.target, 'spy', false)
    }

    case 'TOGGLE_OPEN': {
      const { kind, id, open } = action
      if (!id || !['unit', 'chapter', 'blockSections'].includes(kind)) return state
      const current =
        kind === 'unit'
          ? isUnitOpen(state.treeOpen, state.target, id)
          : kind === 'chapter'
            ? isChapterOpen(state.treeOpen, state.target, id)
            : isBlockSectionsOpen(state.treeOpen, state.target, id)
      const nextVal = typeof open === 'boolean' ? open : !current
      if (state.treeOpen[kind][id] === nextVal) return state
      // Exclusive accordion for units and chapters: opening one closes all others
      const nextKindMap =
        nextVal === true
          ? { [id]: true }
          : {
              ...state.treeOpen[kind],
              [id]: nextVal,
            }
      return {
        ...state,
        treeOpen: {
          ...state.treeOpen,
          [kind]: nextKindMap,
        },
      }
    }

    default:
      return state
  }
}
