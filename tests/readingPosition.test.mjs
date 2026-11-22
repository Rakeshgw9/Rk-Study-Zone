// Run with: node --import ./tests/_register.mjs --test tests/readingPosition.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReadingRecord,
  getSavedReadingForChapter,
  isSameReadingPosition,
  parseReadingAnchor,
  resolveInitialChapterId,
  withReadingPosition,
} from '../src/lib/readingPosition.js'

test('parseReadingAnchor extracts blockId and sectionId from section and block anchors', () => {
  assert.deepEqual(parseReadingAnchor('sec-blk_1-s_intro', 'blk_1'), {
    blockId: 'blk_1',
    sectionId: 's_intro',
    anchorId: 'sec-blk_1-s_intro',
  })
  assert.deepEqual(parseReadingAnchor('sec-blk1-s2'), {
    blockId: 'blk1',
    sectionId: 's2',
    anchorId: 'sec-blk1-s2',
  })
  assert.deepEqual(parseReadingAnchor('b-blk_9'), {
    blockId: 'blk_9',
    sectionId: null,
    anchorId: 'b-blk_9',
  })
})

test('resolveInitialChapterId prefers URL chapter/unit, then lastReading.chapterId, then lastChapterId', () => {
  assert.equal(
    resolveInitialChapterId({
      requestedChapter: 'ch-url',
      unitFirstChapterId: 'ch-u',
      sd: { lastChapterId: 'ch-old', lastReading: { chapterId: 'ch-last' } },
    }),
    'ch-url'
  )
  assert.equal(
    resolveInitialChapterId({
      requestedChapter: null,
      unitFirstChapterId: null,
      sd: { lastChapterId: 'ch-old', lastReading: { chapterId: 'ch-last' } },
    }),
    'ch-last'
  )
  assert.equal(
    resolveInitialChapterId({
      requestedChapter: null,
      unitFirstChapterId: null,
      sd: { lastChapterId: 'ch-old', lastReading: null },
    }),
    'ch-old'
  )
})

test('withReadingPosition updates lastChapterId, lastReading, and chapterReading without redundant writes', () => {
  const base = { uid: 'u1', portalId: 'p1', lastChapterId: null, lastReading: null, chapterReading: {} }
  const rec1 = buildReadingRecord({
    unitId: 'unit-2',
    chapterId: 'ch-5',
    blockId: 'blk-3',
    sectionId: 'sec-7',
    anchorId: 'sec-blk-3-sec-7',
    updatedAt: 1000,
  })
  const next1 = withReadingPosition(base, rec1)
  assert.equal(next1.lastChapterId, 'ch-5')
  assert.deepEqual(next1.lastReading, rec1)
  assert.deepEqual(getSavedReadingForChapter(next1, 'ch-5'), rec1)

  // Calling again with same position is a no-op (returns same reference)
  const same = withReadingPosition(next1, { ...rec1, updatedAt: 2000 })
  assert.equal(same, next1)
  assert.equal(isSameReadingPosition(next1.lastReading, rec1), true)

  // Reading another chapter keeps ch-5 saved in chapterReading too
  const rec2 = buildReadingRecord({
    unitId: 'unit-1',
    chapterId: 'ch-1',
    blockId: 'blk-1',
    anchorId: 'b-blk-1',
    updatedAt: 3000,
  })
  const next2 = withReadingPosition(next1, rec2)
  assert.equal(next2.lastChapterId, 'ch-1')
  assert.deepEqual(getSavedReadingForChapter(next2, 'ch-1'), rec2)
  assert.deepEqual(getSavedReadingForChapter(next2, 'ch-5'), rec1)
})
