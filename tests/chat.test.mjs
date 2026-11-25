// Run with: node --import ./tests/_register.mjs --test tests/chat.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { checkRate, cleanMessage, contextLabel, filterThreads, MAX_MESSAGE, mergeMessages, messageState, preview, sameContext, threadIdOf, typingActive, unansweredThreads, unreadThreads, validateMessage } from '../src/lib/chat.js'

test('thread id is portal + student', () => assert.equal(threadIdOf('p1', 'u9'), 'p1_u9'))

test('cleanMessage keeps plain text and line breaks, drops control characters, never exceeds the limit', () => {
  assert.equal(cleanMessage('  hi\u0000 there  '), 'hi there')
  assert.equal(cleanMessage('a\n\n\n\nb'), 'a\n\nb')
  assert.equal(cleanMessage('x < 5 and y > 3'), 'x < 5 and y > 3') // maths questions are not mangled
  assert.equal(cleanMessage('<b>bold</b>'), '<b>bold</b>') // kept as text; the UI shows it escaped, never as HTML
  assert.equal(cleanMessage('y'.repeat(5000)).length, MAX_MESSAGE)
})

test('validateMessage: empty, too long, image-only', () => {
  assert.equal(validateMessage('   ').ok, false)
  assert.equal(validateMessage('   ', { hasImage: true }).ok, true)
  assert.equal(validateMessage('z'.repeat(MAX_MESSAGE + 1)).ok, false)
  assert.equal(validateMessage('z'.repeat(MAX_MESSAGE)).ok, true)
  assert.equal(validateMessage(' hello ').text, 'hello')
})

test('client rate limit: 6 per minute, then tells when to retry', () => {
  let h = []
  const t0 = 1_000_000
  for (let i = 0; i < 6; i++) { const r = checkRate(h, t0 + i * 1000); assert.equal(r.ok, true); h = r.recent }
  const blocked = checkRate(h, t0 + 10_000)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.retryInMs, 50_000)
  assert.equal(checkRate(h, t0 + 61_000).ok, true) // the first message left the window
})

test('message state: sending → delivered → read', () => {
  assert.equal(messageState({ pending: true, at: 100 }, 0), 'sending')
  assert.equal(messageState({ at: 100 }, 0), 'sent')
  assert.equal(messageState({ at: 100 }, 99), 'sent')
  assert.equal(messageState({ at: 100 }, 100), 'read')
})

test('typing indicator expires', () => {
  assert.equal(typingActive(1000, 3000), true)
  assert.equal(typingActive(1000, 8000), false)
  assert.equal(typingActive(0, 10), false)
})

test('mergeMessages: unique, ordered, confirmed copy beats pending', () => {
  const a = [{ id: '1', at: 10 }, { id: '2', at: 20, pending: true }]
  const b = [{ id: '2', at: 21 }, { id: '0', at: 5 }]
  const m = mergeMessages(a, b)
  assert.deepEqual(m.map((x) => x.id), ['0', '1', '2'])
  assert.equal(m[2].pending, undefined)
})

test('context chip text and comparison', () => {
  assert.equal(contextLabel({ unitTitle: 'Unit 2', chapterTitle: 'Chapter 3' }), 'Unit 2 › Chapter 3')
  assert.equal(contextLabel(null), '')
  assert.equal(sameContext({ chapterId: 'a' }, { chapterId: 'a' }), true)
  assert.equal(sameContext({ chapterId: 'a' }, { chapterId: 'b' }), false)
})

const threads = [
  { id: 'p1_a', portalId: 'p1', portalName: 'Maths', studentName: 'Asha', lastMessage: 'Why is x=2?', lastSender: 'student', unreadForTeacher: 2, status: 'open', lastAt: 30, context: { chapterTitle: 'Algebra' } },
  { id: 'p1_b', portalId: 'p1', portalName: 'Maths', studentName: 'Bikash', lastMessage: 'Thanks!', lastSender: 'student', unreadForTeacher: 0, status: 'resolved', lastAt: 20 },
  { id: 'p2_c', portalId: 'p2', portalName: 'Odia', studentName: 'Chitra', lastMessage: 'Answered', lastSender: 'teacher', unreadForTeacher: 0, status: 'open', lastAt: 10 },
]
test('inbox filters: unread, unanswered, portal, search, resolved; newest first', () => {
  assert.deepEqual(filterThreads(threads).map((t) => t.id), ['p1_a', 'p1_b', 'p2_c'])
  assert.deepEqual(filterThreads(threads, { filter: 'unread' }).map((t) => t.id), ['p1_a'])
  assert.deepEqual(filterThreads(threads, { filter: 'unanswered' }).map((t) => t.id), ['p1_a']) // resolved threads are not "unanswered"
  assert.deepEqual(filterThreads(threads, { filter: 'resolved' }).map((t) => t.id), ['p1_b'])
  assert.deepEqual(filterThreads(threads, { portalId: 'p2' }).map((t) => t.id), ['p2_c'])
  assert.deepEqual(filterThreads(threads, { search: 'algebra' }).map((t) => t.id), ['p1_a'])
  assert.deepEqual(filterThreads(threads, { search: 'chitra' }).map((t) => t.id), ['p2_c'])
  assert.equal(unreadThreads(threads), 1)
  assert.equal(unansweredThreads(threads), 1)
})

test('preview collapses whitespace and truncates', () => {
  assert.equal(preview('a\n\n b'), 'a b')
  assert.equal(preview('x'.repeat(300), 20).length, 20)
})
