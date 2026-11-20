// Run with: node --import ./tests/_register.mjs --test tests/builderNav.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INITIAL_NAV_STATE,
  builderNavReducer,
  isBlockSectionsOpen,
  isChapterOpen,
  isSameTarget,
  isUnitOpen,
  normalizeTarget,
} from '../src/lib/builderNav.js'

test('normalizeTarget strips orphan descendants when an ancestor is missing', () => {
  assert.deepEqual(normalizeTarget({}), { unitId: null, chapterId: null, blockId: null, sectionId: null })
  assert.deepEqual(normalizeTarget({ chapterId: 'ch1', blockId: 'b1' }), {
    unitId: null,
    chapterId: null,
    blockId: null,
    sectionId: null,
  })
  assert.deepEqual(normalizeTarget({ unitId: 'u1', blockId: 'b1' }), {
    unitId: 'u1',
    chapterId: null,
    blockId: null,
    sectionId: null,
  })
  assert.deepEqual(normalizeTarget({ unitId: 'u1', chapterId: 'ch1', blockId: 'b5', sectionId: 'sec-2' }), {
    unitId: 'u1',
    chapterId: 'ch1',
    blockId: 'b5',
    sectionId: 'sec-2',
  })
})

test('PAGE_CLICK on block 5 opens its unit and chapter, selects block 5, and never triggers a page scroll', () => {
  const s1 = builderNavReducer(INITIAL_NAV_STATE, {
    type: 'PAGE_CLICK',
    target: { unitId: 'u1', chapterId: 'ch2', blockId: 'blk5' },
  })
  assert.deepEqual(s1.target, { unitId: 'u1', chapterId: 'ch2', blockId: 'blk5', sectionId: null })
  assert.equal(s1.scroll.n, 0)
  assert.equal(s1.scroll.to, null)
  assert.equal(isUnitOpen(s1.treeOpen, s1.target, 'u1'), true)
  assert.equal(isChapterOpen(s1.treeOpen, s1.target, 'ch2'), true)
})

test('manually collapsing a chapter stays collapsed while target is elsewhere, and re-opens when clicking a block inside it', () => {
  let s = builderNavReducer(INITIAL_NAV_STATE, {
    type: 'SELECT',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b1' },
    source: 'init',
  })
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), true)

  // Collapse chapter 1 by hand
  s = builderNavReducer(s, { type: 'TOGGLE_OPEN', kind: 'chapter', id: 'ch1' })
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), false)

  // Selecting a block in chapter 2 leaves chapter 1 collapsed
  s = builderNavReducer(s, {
    type: 'PAGE_CLICK',
    target: { unitId: 'u1', chapterId: 'ch2', blockId: 'b9' },
  })
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), false)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch2'), true)

  // Clicking a block in chapter 1 on the page force-opens chapter 1 again without scrolling
  const beforeScrollN = s.scroll.n
  s = builderNavReducer(s, {
    type: 'PAGE_CLICK',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b2' },
  })
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), true)
  assert.equal(s.target.blockId, 'b2')
  assert.equal(s.scroll.n, beforeScrollN)
})

test('TREE_CLICK on a JSON section opens unit, chapter, and blockSections and increments scroll once', () => {
  let s = builderNavReducer(INITIAL_NAV_STATE, {
    type: 'TOGGLE_OPEN',
    kind: 'blockSections',
    id: 'b3',
    open: false,
  })
  assert.equal(isBlockSectionsOpen(s.treeOpen, s.target, 'b3'), false)

  s = builderNavReducer(s, {
    type: 'TREE_CLICK',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b3', sectionId: 'sec-4' },
  })
  assert.deepEqual(s.target, { unitId: 'u1', chapterId: 'ch1', blockId: 'b3', sectionId: 'sec-4' })
  assert.equal(s.scroll.n, 1)
  assert.equal(s.scroll.source, 'tree')
  assert.deepEqual(s.scroll.to, s.target)
  assert.equal(isUnitOpen(s.treeOpen, s.target, 'u1'), true)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), true)
  assert.equal(isBlockSectionsOpen(s.treeOpen, s.target, 'b3'), true)
})

test('SPY updates target and opens ancestors without scrolling, and is a no-op when target is unchanged', () => {
  const s1 = builderNavReducer(INITIAL_NAV_STATE, {
    type: 'SPY',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b4', sectionId: null },
  })
  assert.equal(s1.target.blockId, 'b4')
  assert.equal(s1.scroll.n, 0)
  assert.equal(isChapterOpen(s1.treeOpen, s1.target, 'ch1'), true)

  const s2 = builderNavReducer(s1, {
    type: 'SPY',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b4', sectionId: null },
  })
  assert.equal(s2, s1)
  assert.equal(isSameTarget(s1.target, s2.target), true)
})

test('SELECT honors explicit scroll flag and source=tree while keeping page/action non-scrolling by default', () => {
  const s1 = builderNavReducer(INITIAL_NAV_STATE, {
    type: 'SELECT',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b1' },
    source: 'action',
  })
  assert.equal(s1.scroll.n, 0)

  const s2 = builderNavReducer(s1, {
    type: 'SELECT',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b2' },
    source: 'action',
    scroll: true,
  })
  assert.equal(s2.scroll.n, 1)
  assert.equal(s2.scroll.to.blockId, 'b2')
})
