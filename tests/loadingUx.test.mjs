// Run with: node --import ./tests/_register.mjs --test tests/loadingUx.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { accessNotice, appBaseUrl, buildShareModel, chapterLink, contentCounts, portalLink, unitLink } from '../src/lib/shareLinks.js'
import { DOC_LIMIT_BYTES, formatBytes, sizeMeter } from '../src/lib/sizeMeter.js'
import { assertChapterFits, joinParts, partId, splitBlocks } from '../src/lib/chapterChunks.js'
import { qrMatrix, qrSvg } from '../src/lib/qr.js'
import { formatClock, makeProgress, progressLabel, saveStatusModel } from '../src/lib/saveStatus.js'
import { formatJsonText } from '../src/lib/jsonWorkerClient.js'

const content = {
  units: [
    { id: 'u1', title: 'Unit 1', chapters: [{ id: 'c1', title: 'A', blocks: [{}, {}] }, { id: 'c2', title: 'B', blocks: [{}] }] },
    { id: 'u2', title: 'Unit 2', chapters: [] },
  ],
}

test('share links use the HashRouter format and the deployed origin', () => {
  const base = appBaseUrl({ origin: 'https://site.netlify.app', pathname: '/index.html', protocol: 'https:', host: 'site.netlify.app' })
  assert.equal(base, 'https://site.netlify.app/')
  assert.equal(portalLink(base, 'p 1'), 'https://site.netlify.app/#/learn/p%201')
  assert.equal(chapterLink(base, 'p1', 'c1'), 'https://site.netlify.app/#/learn/p1/c1')
  assert.equal(unitLink(base, 'p1', content.units[0]), 'https://site.netlify.app/#/learn/p1/c1')
  assert.equal(unitLink(base, 'p1', content.units[1]), null)
  assert.equal(appBaseUrl({ origin: 'null', pathname: '/app/', protocol: 'file:', host: '' }), 'file:///app/')
})

test('share model counts and grouping', () => {
  assert.deepEqual(contentCounts(content), { units: 2, chapters: 2, blocks: 3 })
  const m = buildShareModel('https://x/', 'p1', content)
  assert.equal(m.units[0].chapters[1].link, 'https://x/#/learn/p1/c2')
  assert.equal(m.units[1].link, null)
  assert.deepEqual(contentCounts(null), { units: 0, chapters: 0, blocks: 0 })
})

test('access notice covers inactive / paid / private', () => {
  assert.equal(accessNotice(null), null)
  assert.ok(accessNotice({ status: 'draft', accessType: 'paid' }).length === 2)
  assert.match(accessNotice({ status: 'active', accessType: 'private' })[0], /invite/)
})

test('size meter levels and labels', () => {
  assert.equal(sizeMeter(100 * 1024).level, 'ok')
  assert.equal(sizeMeter(Math.ceil(DOC_LIMIT_BYTES * 0.8)).level, 'warn')
  const big = sizeMeter(DOC_LIMIT_BYTES * 2.5)
  assert.equal(big.level, 'chunked')
  assert.equal(big.parts, 3)
  assert.equal(sizeMeter(13 * 1024 * 1024).level, 'over')
  assert.equal(sizeMeter(412 * 1024).label, '412 KB of 950 KB')
  assert.equal(formatBytes(2.5 * 1024 * 1024), '2.5 MB')
})

test('chapter chunking: small chapters stay in one document (legacy format)', () => {
  const blocks = [{ id: 'a', t: 'x' }, { id: 'b', t: 'y' }]
  const s = splitBlocks(blocks)
  assert.equal(s.parts.length, 1)
  assert.deepEqual(s.parts[0], blocks)
  assert.deepEqual(splitBlocks([]).parts, [[]])
})

test('chapter chunking: big chapters split in order and join back identically', () => {
  const blocks = Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, text: 'x'.repeat(1000) }))
  const s = splitBlocks(blocks, 10_000)
  assert.ok(s.parts.length > 3)
  s.parts.forEach((p) => assert.ok(JSON.stringify(p).length <= 10_000))
  const docs = s.parts.map((blocks, index) => ({ index, blocks })).reverse() // any read order
  assert.deepEqual(joinParts(docs), blocks)
  assert.equal(partId(7), '007')
})

test('chapter chunking: a single oversized block / chapter is rejected with a clear message', () => {
  const s = splitBlocks([{ id: 'huge', text: 'x'.repeat(5000) }], 1000)
  assert.ok(s.tooBigBlock)
  assert.throws(() => assertChapterFits('Ch', s, 1_000_000, 1000), /one block must stay under/)
  const ok = splitBlocks([{ id: 'a' }], 1000)
  assert.doesNotThrow(() => assertChapterFits('Ch', ok))
  assert.throws(() => assertChapterFits('Ch', { parts: [], total: 99, tooBigBlock: null }, 10), /over the/)
})

test('chapter chunking handles a multi-MB chapter', () => {
  const blocks = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, json: 'y'.repeat(100 * 1024) }))
  const s = splitBlocks(blocks)
  assert.ok(s.total > 2.9 * 1024 * 1024)
  assert.ok(s.parts.length >= 4)
  assert.equal(joinParts(s.parts.map((b, index) => ({ index, blocks: b }))).length, 30)
})

test('QR generator returns a square matrix and valid SVG; too-long text returns null', () => {
  const m = qrMatrix('https://example.com/#/learn/abc/def')
  assert.equal(m.length, m[0].length)
  assert.ok([21, 25, 29, 33].includes(m.length))
  assert.equal(m[0][0], true) // finder pattern corner
  const svg = qrSvg('https://example.com/')
  assert.match(svg, /^<svg[^>]+viewBox/)
  assert.equal(qrMatrix('x'.repeat(400)), null)
})

test('save status model', () => {
  assert.equal(saveStatusModel({ status: 'saving', progress: 45 }).label, 'Saving… 45%')
  assert.equal(saveStatusModel({ status: 'saved', dirty: true }).key, 'unsaved')
  const err = saveStatusModel({ status: 'error', error: 'offline' })
  assert.equal(err.retry, true)
  assert.match(err.label, /Save failed — offline/)
  const at = new Date(2026, 0, 1, 9, 5).getTime()
  assert.equal(formatClock(at), '09:05')
  assert.match(saveStatusModel({ status: 'saved', at }).label, /last saved at 09:05/)
  assert.equal(saveStatusModel({}).label, 'All changes saved')
})

test('progress labels and counter', () => {
  assert.equal(progressLabel('Saving', { pct: 45.4 }), 'Saving 45%')
  assert.equal(progressLabel('Publishing', { step: 2, total: 5 }), 'Publishing 2 of 5')
  assert.equal(progressLabel('Saving'), 'Saving…')
  const seen = []
  const p = makeProgress(4, (pct) => seen.push(pct))
  p.tick(); p.tick(); p.tick(10)
  assert.deepEqual(seen, [25, 50, 100])
})

test('formatJsonText formats small and big input (worker-less fallback) and rejects invalid JSON', async () => {
  assert.equal(await formatJsonText('{"a":1}'), '{\n  "a": 1\n}')
  const big = JSON.stringify({ rows: Array.from({ length: 60000 }, (_, i) => ({ i, t: 'text' + i })) })
  assert.ok(big.length > 1_000_000)
  const out = await formatJsonText(big)
  assert.deepEqual(JSON.parse(out), JSON.parse(big))
  await assert.rejects(formatJsonText('{bad'), /JSON/)
  await assert.rejects(formatJsonText('{bad' + ' '.repeat(200_000)), /JSON|Unexpected|Expected/)
})

import { beginUpload, getUploadSnapshot, resetUploads, subscribeUploads, trackUpload, uploadsInFlight } from '../src/lib/uploadActivity.js'

test('upload activity: counts jobs, averages known progress, notifies, and always cleans up', async () => {
  resetUploads()
  let calls = 0
  const off = subscribeUploads(() => calls++)
  assert.equal(uploadsInFlight(), 0)
  const a = beginUpload('Uploading a.png')
  assert.deepEqual(getUploadSnapshot(), { count: 1, pct: null, label: 'Uploading a.png' }) // one request = indeterminate
  a.progress(40)
  assert.equal(getUploadSnapshot().pct, 40)
  const b = beginUpload('Uploading syllabus')
  assert.equal(getUploadSnapshot().pct, null) // one job has unknown progress
  assert.equal(getUploadSnapshot().label, '2 uploads')
  b.progress(100)
  assert.equal(getUploadSnapshot().pct, 70)
  a.end(); a.end() // safe twice
  assert.equal(uploadsInFlight(), 1)
  b.end()
  assert.equal(uploadsInFlight(), 0)
  assert.ok(calls >= 4)
  await assert.rejects(trackUpload('x', async () => { assert.equal(uploadsInFlight(), 1); throw new Error('boom') }), /boom/)
  assert.equal(uploadsInFlight(), 0) // a failed upload never leaves the "uploading" state stuck
  off()
})
