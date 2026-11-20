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

function forceOpenAncestors(treeOpen, target) {
  let unit = treeOpen.unit
  let chapter = treeOpen.chapter
  let blockSections = treeOpen.blockSections

  if (target.unitId && unit[target.unitId] !== true) {
    unit = { ...unit, [target.unitId]: true }
  }
  if (target.chapterId && chapter[target.chapterId] !== true) {
    chapter = { ...chapter, [target.chapterId]: true }
  }
  if (target.blockId && target.sectionId && blockSections[target.blockId] !== true) {
    blockSections = { ...blockSections, [target.blockId]: true }
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
  return target?.unitId ? target.unitId === unitId : true
}

export function isChapterOpen(treeOpen, target, chapterId) {
  if (treeOpen?.chapter && Object.prototype.hasOwnProperty.call(treeOpen.chapter, chapterId)) {
    return !!treeOpen.chapter[chapterId]
  }
  return target?.chapterId === chapterId
}

export function isBlockSectionsOpen(treeOpen, target, blockId) {
  if (treeOpen?.blockSections && Object.prototype.hasOwnProperty.call(treeOpen.blockSections, blockId)) {
    return !!treeOpen.blockSections[blockId]
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
      return {
        ...state,
        treeOpen: {
          ...state.treeOpen,
          [kind]: {
            ...state.treeOpen[kind],
            [id]: nextVal,
          },
        },
      }
    }

    default:
      return state
  }
}
