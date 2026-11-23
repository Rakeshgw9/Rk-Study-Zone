// Run with: node --import ./tests/_register.mjs --test tests/phaseC.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { contentSignature, describeChange, diffSignatures, hashBlock, summarizeDiff } from '../src/lib/publishDiff.js'
import { absoluteTime, DAY_MS, filterNotifications, isRetained, mergeNotifications, normalizeState, pruneReadFeed, relativeTime, unreadCount } from '../src/lib/notifications.js'

const blk = (id, text, type = 'html') => ({ id, type, data: { text } })
const mkContent = (over = {}) => ({
  units: [
    { id: 'u1', title: 'Unit 1', chapters: [{ id: 'c1', title: 'Intro', blocks: [blk('b1', 'a'), blk('b2', 'b')] }] },
    { id: 'u2', title: 'Unit 2', chapters: [{ id: 'c4', title: 'Chapter 4', blocks: [blk('b9', 'x')] }] },
  ],
  ...over,
})

test('signature is compact and stable; hash changes with content', () => {
  const a = contentSignature(mkContent())
  assert.deepEqual(a, contentSignature(mkContent()))
  assert.equal(a.u[0].c[0].b.length, 2)
  assert.notEqual(hashBlock(blk('b1', 'a')), hashBlock(blk('b1', 'changed')))
})

test('first publish has no diff; unchanged content is empty', () => {
  const sig = contentSignature(mkContent())
  assert.equal(diffSignatures(null, sig).first, true)
  assert.equal(diffSignatures(sig, sig).empty, true)
})

test('diff: new blocks, updated block, removed block, new chapter/unit, exams', () => {
  const prev = contentSignature(mkContent())
  const next = mkContent()
  next.units[1].chapters[0].blocks.push(blk('n1', 'new1'), blk('n2', 'new2'), blk('n3', 'quiz', 'mcq'))
  next.units[0].chapters[0].blocks[0] = blk('b1', 'EDITED')
  next.units[0].chapters[0].blocks.pop() // removes b2
  next.units[0].chapters.push({ id: 'c2', title: 'Second', blocks: [blk('z', '1')] })
  next.units.push({ id: 'u3', title: 'Unit 3', chapters: [{ id: 'c7', title: 'Z', blocks: [] }] })
  const d = diffSignatures(prev, contentSignature(next))
  assert.equal(d.empty, false)
  const lines = d.changes.map(describeChange)
  assert.ok(lines.includes('3 new blocks in Unit 2 › Chapter 4'))
  assert.ok(lines.includes('1 block updated, 1 block removed in Unit 1 › Intro'))
  assert.ok(lines.includes('New chapter: Unit 1 › Second'))
  assert.ok(lines.includes('New unit: Unit 3'))
  assert.equal(d.totals.exams, 1)
  const s = summarizeDiff(d, 'Maths')
  assert.equal(s.hasExam, true)
  assert.equal(s.title, 'Updated: Maths')
  assert.match(s.summary, /and 1 more$/)
  assert.ok(s.chapterId)
})

test('diff: removals and renames', () => {
  const prev = contentSignature(mkContent())
  const next = mkContent()
  next.units.pop()
  next.units[0].chapters[0].title = 'Introduction'
  const lines = diffSignatures(prev, contentSignature(next)).changes.map(describeChange)
  assert.ok(lines.includes('Unit removed: Unit 2'))
  assert.ok(lines.includes('Chapter renamed: Unit 1 › Introduction'))
})

test('time helpers and retention (60 days)', () => {
  const now = 1_000_000_000_000
  assert.equal(relativeTime(now - 10_000, now), 'just now')
  assert.equal(relativeTime(now - 5 * 60_000, now), '5 min ago')
  assert.equal(relativeTime(now - 3 * 3600_000, now), '3 h ago')
  assert.equal(relativeTime(now - 2 * DAY_MS, now), '2 d ago')
  assert.equal(relativeTime(0, now), '')
  assert.ok(absoluteTime(now).length > 5)
  assert.equal(isRetained(now - 59 * DAY_MS, now), true)
  assert.equal(isRetained(now - 61 * DAY_MS, now), false)
})

const NOW = 5_000_000_000_000
const direct = [
  { id: 'a', kind: 'chat', title: 'New reply', at: NOW - 1000, read: false },
  { id: 'b', kind: 'enrol', title: 'Enrolled', at: NOW - 2000, read: true },
  { id: 'old', kind: 'chat', title: 'Ancient', at: NOW - 90 * DAY_MS, read: false },
]
const feed = [
  { id: 'f1', portalId: 'p1', title: 'Updated: Maths', summary: '3 new blocks', chapterId: 'c4', at: NOW - 5000, teacherName: 'Asha' },
  { id: 'f2', portalId: 'p1', title: 'Updated: Maths', summary: 'old news', at: NOW - 20 * DAY_MS },
  { id: 'f3', portalId: 'p1', title: 'Exam', summary: 'quiz', at: NOW - 9000, hasExam: true },
]

test('merge: sorts newest first, hides >60-day items, keeps deep links', () => {
  const state = normalizeState({ enrolled: { p1: NOW - 30 * DAY_MS } })
  const m = mergeNotifications({ direct, feed, state, now: NOW })
  assert.deepEqual(m.map((x) => x.rawId), ['a', 'b', 'f1', 'f3', 'f2'])
  assert.equal(m.find((x) => x.rawId === 'f1').link, '/learn/p1/c4')
  assert.equal(m.find((x) => x.rawId === 'f3').kind, 'exam-added')
  assert.equal(unreadCount(m), 4)
})

test('merge: updates from before the student enrolled are ignored; lastSeenAt and readFeed mark items read', () => {
  const state = normalizeState({ enrolled: { p1: NOW - 10000 }, lastSeenAt: NOW - 7000, readFeed: { f3: NOW } })
  const m = mergeNotifications({ direct: [], feed, state, now: NOW })
  assert.deepEqual(m.map((x) => x.rawId), ['f1', 'f3'])
  assert.equal(m[0].read, false)
  assert.equal(m[1].read, true)
})

test('preferences mute content / chat / enrolments', () => {
  const state = normalizeState({ prefs: { muteContent: true, muteChat: true } })
  assert.deepEqual(mergeNotifications({ direct, feed, state, now: NOW }).map((x) => x.rawId), ['b'])
  assert.equal(mergeNotifications({ direct, feed, state: normalizeState({ prefs: { muteEnrol: true } }), now: NOW }).some((x) => x.rawId === 'b'), false)
})

test('filters: all / unread / messages / content', () => {
  const m = mergeNotifications({ direct, feed, state: normalizeState(), now: NOW })
  assert.equal(filterNotifications(m, 'all').length, m.length)
  assert.ok(filterNotifications(m, 'unread').every((x) => !x.read))
  assert.deepEqual(filterNotifications(m, 'messages').map((x) => x.rawId), ['a'])
  assert.ok(filterNotifications(m, 'content').every((x) => x.source === 'feed'))
})

test('readFeed is pruned to the newest entries', () => {
  const rf = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`id${i}`, i]))
  const p = pruneReadFeed(rf, 200)
  assert.equal(Object.keys(p).length, 200)
  assert.ok(p.id299 !== undefined && p.id0 === undefined)
  assert.equal(pruneReadFeed({ a: 1 }, 200).a, 1)
})
