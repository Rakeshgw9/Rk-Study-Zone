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
  loadLastEdited,
  normalizeTarget,
  saveLastEdited,
  shouldConfirmSwitch,
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

test('saveLastEdited & loadLastEdited persist unitId and chapterId per portalId and validate against content', () => {
  const mem = new Map()
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  }
  const content = {
    units: [
      { id: 'u1', chapters: [{ id: 'ch1' }, { id: 'ch2' }] },
      { id: 'u2', chapters: [{ id: 'ch3' }] },
    ],
  }

  assert.equal(saveLastEdited('portal-a', { unitId: 'u2', chapterId: 'ch3' }, storage), true)
  assert.deepEqual(loadLastEdited('portal-a', content, storage), { unitId: 'u2', chapterId: 'ch3' })
  assert.equal(loadLastEdited('portal-b', content, storage), null)

  // If saved chapter was deleted, still restores valid unitId with null chapterId
  assert.equal(saveLastEdited('portal-a', { unitId: 'u1', chapterId: 'deleted-ch' }, storage), true)
  assert.deepEqual(loadLastEdited('portal-a', content, storage), { unitId: 'u1', chapterId: null })

  // If saved unit was deleted, returns null
  assert.equal(saveLastEdited('portal-a', { unitId: 'deleted-u', chapterId: 'ch1' }, storage), true)
  assert.equal(loadLastEdited('portal-a', content, storage), null)
})

test('shouldConfirmSwitch enforces Unit & Chapter Edit Lock on user navigation switches', () => {
  // Switching from chapter 1 to chapter 2 in same unit -> confirm
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1', chapterId: 'ch1' }, { unitId: 'u1', chapterId: 'ch2' }, 'tree', true),
    true
  )
  // Switching from chapter 1 to unit 2 -> confirm
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1', chapterId: 'ch1' }, { unitId: 'u2' }, 'page', true),
    true
  )
  // Exiting chapter 1 back to unit 1 overview -> confirm
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1', chapterId: 'ch1' }, { unitId: 'u1' }, 'tree', true),
    true
  )
  // Switching from unit 1 overview to unit 2 -> confirm
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1' }, { unitId: 'u2' }, 'page', true),
    true
  )
  // Clicking a block or section inside the SAME chapter -> no confirm
  assert.equal(
    shouldConfirmSwitch(
      { unitId: 'u1', chapterId: 'ch1', blockId: 'b1' },
      { unitId: 'u1', chapterId: 'ch1', blockId: 'b2', sectionId: 's1' },
      'page',
      true
    ),
    false
  )
  // Drilling from unit 1 overview into chapter 1 of unit 1 -> no confirm
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1' }, { unitId: 'u1', chapterId: 'ch1' }, 'page', true),
    false
  )
  // Non-user sources (spy, init, action) or unlocked state -> never confirm
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1', chapterId: 'ch1' }, { unitId: 'u2', chapterId: 'ch3' }, 'spy', true),
    false
  )
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1', chapterId: 'ch1' }, { unitId: 'u2', chapterId: 'ch3' }, 'init', true),
    false
  )
  assert.equal(
    shouldConfirmSwitch({ unitId: 'u1', chapterId: 'ch1' }, { unitId: 'u2', chapterId: 'ch3' }, 'tree', false),
    false
  )
})

test('exclusive accordion: opening a unit closes other units, and opening/switching a chapter closes other chapters', () => {
  let s = builderNavReducer(INITIAL_NAV_STATE, {
    type: 'SELECT',
    target: { unitId: 'u1', chapterId: 'ch1', blockId: 'b1' },
    source: 'init',
  })
  assert.equal(isUnitOpen(s.treeOpen, s.target, 'u1'), true)
  assert.equal(isUnitOpen(s.treeOpen, s.target, 'u2'), false)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), true)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch2'), false)

  // Manually expand Unit 2 -> Unit 2 opens and Unit 1 automatically closes
  s = builderNavReducer(s, { type: 'TOGGLE_OPEN', kind: 'unit', id: 'u2' })
  assert.equal(isUnitOpen(s.treeOpen, s.target, 'u2'), true)
  assert.equal(isUnitOpen(s.treeOpen, s.target, 'u1'), false)

  // Manually expand Chapter 2 -> Chapter 2 opens and Chapter 1 automatically closes
  s = builderNavReducer(s, { type: 'TOGGLE_OPEN', kind: 'chapter', id: 'ch2' })
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch2'), true)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), false)

  // Switching target to Chapter 3 in Unit 2 -> only Unit 2 and Chapter 3 stay open
  s = builderNavReducer(s, {
    type: 'TREE_CLICK',
    target: { unitId: 'u2', chapterId: 'ch3' },
  })
  assert.equal(isUnitOpen(s.treeOpen, s.target, 'u2'), true)
  assert.equal(isUnitOpen(s.treeOpen, s.target, 'u1'), false)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch3'), true)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch2'), false)
  assert.equal(isChapterOpen(s.treeOpen, s.target, 'ch1'), false)
})
