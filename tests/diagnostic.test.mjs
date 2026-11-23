// Regression tests for the full diagnostic pass (Firestore sanitising, XSS hardening, reducer safety, bilingual null-safety, rules, upload function).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { toFirestoreSafe, fromFirestoreSafe } from '../src/lib/firestoreSafe.js'
import { richToText, isRichEmpty } from '../src/lib/richText.js'
import { blockHeadingText } from '../src/lib/blockLabel.js'
import { frameProps } from '../src/lib/blockRender.js'
import { contentReducer, blockMedia } from '../src/lib/content.js'
import { arrayMove, fmt, renderStudioHtml, setSectionValue, normalizeToSections, JSON_THEMES, studioCss } from '../src/lib/jsonStudio.js'
import { hasFormula, hasLessonMcq, renderLessonHtml, DEFAULT_JSON_STYLE } from '../src/lib/jsonLesson.js'
import { cleanHtml } from '../src/lib/pdfExport.js'
import { sniffMatches } from '../netlify/functions/upload-media.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('firestoreSafe: undefined / NaN / functions / bigint / cycles never reach Firestore', () => {
  const cyc = { a: 1 }; cyc.self = cyc
  const out = toFirestoreSafe({ a: undefined, b: NaN, c: Infinity, d: () => 1, e: Symbol('x'), f: 10n, g: [undefined, NaN, () => 1, [1, 2]], h: cyc, ok: 'x' })
  assert.deepEqual(Object.keys(out).sort(), ['b', 'c', 'f', 'g', 'h', 'ok'])
  assert.equal(out.b, null); assert.equal(out.c, null); assert.equal(out.f, '10')
  assert.deepEqual(out.g.slice(0, 3), [null, null, null]); assert.deepEqual(out.g[3], { __rkArray: [1, 2] })
  assert.equal(out.h.self, null)
  assert.deepEqual(fromFirestoreSafe(toFirestoreSafe({ rows: [[1, 2], [3]] })), { rows: [[1, 2], [3]] })
})

test('every Firestore write in the services goes through toFirestoreSafe', () => {
  for (const f of ['contentService', 'portalService', 'studentService', 'userService', 'authService']) {
    const src = read(`src/services/${f}.js`)
    const writes = src.split('\n').filter((l) => /\b(addDoc|setDoc|updateDoc)\(/.test(l) && !l.includes('import '))
    if (f !== 'contentService') assert.ok(writes.length > 0, f) // contentService writes through batches (batch.set) of toFirestoreSafe data
    for (const l of writes) assert.ok(l.includes('toFirestoreSafe'), `${f}: unsafe write → ${l.trim().slice(0, 90)}`)
  }
})

test('null values in bilingual / partial JSON never print "null" or crash', () => {
  assert.equal(richToText(null), ''); assert.ok(isRichEmpty(null))
  assert.equal(blockHeadingText({ type: 'multi-heading', data: { sections: [null, { heading: 'Hello' }] } }), 'Hello')
  assert.equal(blockHeadingText({ type: 'multi-heading', data: { sections: 'bad' } }), '')
  assert.equal(blockHeadingText({ type: 'json', data: { json: JSON.stringify({ title: { x: 1 }, sections: {} }) } }), '')
  assert.equal(frameProps(null), null)
  assert.ok(frameProps({ type: 'html' }))
  assert.equal(hasFormula({ sections: 'oops' }), false); assert.equal(hasLessonMcq({ sections: {} }), false)
  const html = renderLessonHtml({ title: 'T', sections: [{ heading: 'H', paragraphs: [{ text: 'English', odiaText: 'ଓଡ଼ିଆ' }, null], list: [{ text: 'x', odiaText: 'ଖ' }], table: { columns: 'bad', rows: [['a', { text: 'b' }]] } }] }, DEFAULT_JSON_STYLE)
  assert.ok(html.includes('ଓଡ଼ିଆ') && html.includes('ଖ') && !html.includes('[object Object]'))
  assert.doesNotThrow(() => renderLessonHtml({ sections: 'x', points: 5 }, DEFAULT_JSON_STYLE))
  const studio = normalizeToSections({ type: 'studio', sections: [null, 3, { type: 'heading_paragraph', paragraphs: null, odiaHeading: null }] })
  assert.equal(studio.sections.length, 1); assert.doesNotThrow(() => renderStudioHtml(studio.sections, studio.theme))
})

test('studio renderer: attribute injection is escaped and ==marks== never corrupt links', () => {
  const evil = 'https://a.com/x" onerror="alert(1)'
  const html = renderStudioHtml([{ id: 's"1', type: 'heading_image', heading: 'H', imageUrl: evil, layout: 'top' }], 'midnight-slate')
  assert.match(html, /<img src="[^"]*" alt="H" loading="lazy">/, html) // the quote is escaped, so no extra attribute can appear
  assert.ok(html.includes('&quot;'))
  assert.ok(!html.includes('id="js-sec-s"1"'))
  const link = fmt('<a href="https://x.com/?t=a==b==c">go</a> and ==mark==')
  assert.ok(link.includes('href="https://x.com/?t=a==b==c"') && link.includes('<mark>mark</mark>'))
})

test('drag & drop helpers reject bad indexes; setSectionValue blocks prototype pollution', () => {
  const a = [1, 2, 3]
  assert.equal(arrayMove(a, NaN, 1), a); assert.equal(arrayMove(a, 0, 1.5), a); assert.equal(arrayMove(a, 5, 0), a); assert.equal(arrayMove(a, -1, 0), a)
  assert.deepEqual(arrayMove(a, 0, 3), [2, 3, 1])
  const list = [{ id: 's1', type: 'heading_paragraph' }]
  assert.equal(setSectionValue(list, 0, '__proto__.polluted', 'yes'), list)
  assert.equal({}.polluted, undefined)
})

test('content reducer: stale ids and out-of-range moves never corrupt or crash', () => {
  const s = { units: [{ id: 'u1', title: 'U', chapters: [{ id: 'c1', title: 'C', blocks: [{ id: 'b1', title: 'B', type: 'html', data: {} }, { id: 'b2', title: 'B2', type: 'html' }] }] }] }
  assert.equal(contentReducer(s, { type: 'moveUnit', from: 9, to: 0 }).units.length, 1)
  assert.ok(contentReducer(s, { type: 'moveUnit', from: 9, to: 0 }).units.every(Boolean))
  assert.ok(contentReducer(s, { type: 'moveBlock', chapterId: 'c1', from: 7, to: 0 }).units[0].chapters[0].blocks.every(Boolean))
  assert.equal(contentReducer(s, { type: 'moveBlock', chapterId: 'c1', from: 0, to: 1 }).units[0].chapters[0].blocks[0].id, 'b2')
  for (const t of [{ type: 'updateUnit', unitId: 'zz', patch: {} }, { type: 'addChapter', unitId: 'zz' }, { type: 'moveChapter', unitId: 'zz', from: 0, to: 1 }, { type: 'deleteChapter', chapterId: 'zz' }, { type: 'updateChapter', chapterId: 'zz', patch: {} }, { type: 'addBlock', chapterId: 'zz', block: {} }, { type: 'deleteBlock', blockId: 'zz' }, { type: 'duplicateBlock', blockId: 'zz' }, { type: 'updateBlock', blockId: 'zz', block: {} }, { type: 'duplicateUnit', unitId: 'zz' }, { type: 'duplicateChapter', chapterId: 'zz' }]) {
    assert.doesNotThrow(() => contentReducer(s, t), t.type)
    assert.equal(contentReducer(s, t), s, t.type)
  }
  assert.equal(blockMedia({ type: 'html', data: {} }), 0)
})

test('PDF export cleanHtml strips script vectors (slash separators, javascript: URLs, handlers)', () => {
  const dirty = '<img/src=x/onerror=alert(1)><a href="javascript:alert(1)">x</a><p onclick="evil()">t</p><script>alert(1)</script><iframe src="//x"></iframe><svg/onload=alert(1)>'
  const c = cleanHtml(dirty)
  assert.ok(!/onerror|onload|onclick|javascript:|<script|<iframe/i.test(c), c)
  assert.ok(c.includes('<p') && c.includes('t</p>'))
})

test('themes: all 16 themes have valid tokens and a rule in the shared stylesheet (canvas + lesson page + PDF)', () => {
  assert.equal(JSON_THEMES.length, 16)
  const css = studioCss()
  for (const t of JSON_THEMES) {
    for (const k of ['bg', 'surface', 'text', 'heading', 'accent', 'border']) assert.match(t[k], /^#[0-9a-f]{6}$/i, `${t.id}.${k}`)
    assert.ok(css.includes(`data-theme="${t.id}"`), t.id)
  }
  assert.ok(JSON_THEMES.some((t) => t.id === 'midnight-slate'))
})

test('upload function: declared type must match the real bytes; size cap leaves room for base64 in a 6 MB body', () => {
  assert.ok(sniffMatches('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])))
  assert.ok(!sniffMatches('image/png', Buffer.from('<html>not an image</html>')))
  assert.ok(sniffMatches('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])))
  assert.ok(sniffMatches('application/pdf', Buffer.from('%PDF-1.7 ...')))
  assert.ok(sniffMatches('application/json', Buffer.from('{"a":1}')) && !sniffMatches('application/json', Buffer.from('{bad')))
  assert.ok(!sniffMatches('image/svg+xml', Buffer.from('<svg/>')))
  const src = read('netlify/functions/upload-media.mjs')
  assert.ok(src.includes('MAX_BYTES = 4 * 1024 * 1024'))
  assert.ok((4 * 1024 * 1024 * 4) / 3 + 4096 < 6 * 1024 * 1024)
})

test('firestore.rules: portal owner and enrollment ownership fields are immutable', () => {
  const r = read('firestore.rules')
  assert.ok(r.includes('request.resource.data.ownerId == resource.data.ownerId'))
  assert.ok(r.includes('request.resource.data.portalId == resource.data.portalId'))
  for (const c of ['users', 'portals', 'portalContent', 'portalPublished', 'portalSyllabus', 'enrollments', 'studentData']) assert.ok(r.includes(`match /${c}/`), c)
  assert.ok(!/allow [a-z, ]+: if true/.test(r), 'no public writes in Firestore rules')
})

test('iframe messages are verified by window identity; print frame waits for shadow-DOM images', () => {
  assert.ok(read('src/components/ui/SandboxFrame.jsx').includes('e.source !== ref.current?.contentWindow'))
  const p = read('src/lib/pdfExport.js')
  assert.ok(p.includes('host.shadowRoot?.querySelectorAll') && p.includes("removeAttribute('loading')"))
})
