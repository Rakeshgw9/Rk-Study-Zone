// Run with:  npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanOcrText, structureOcrText, blocksToBlockData, textToBlockData, parsePageRange, ocrWarnings } from '../src/lib/notesFormatter.js'
import { validateOcrFile } from '../src/lib/pageOcr.js'
import { sanitizeHtml, richToText } from '../src/lib/richText.js'
import { BLOCK_TYPES, newBlock } from '../src/lib/content.js'
import { blockHeadingText, isReadyBlock } from '../src/lib/blockLabel.js'

const SAMPLE = `MEANING OF PHYSICAL EDUCATION

Physical Education is an integral part of total education. It develops physical,
mental, social and emotional abilities through physical activities.

Objectives:

1. Physical Development.
2. Mental Development
   continued line.
3. Social Development.

Type      Example      Benefit
Aerobic   Running      Stamina
Strength  Weights      Muscles

• First point
• Second point`

test('structure detection: heading, paragraph, sub-heading, numbered list, table, bullets (in reading order)', () => {
  const b = structureOcrText(SAMPLE)
  assert.deepEqual(b.map((x) => x.kind), ['heading', 'paragraph', 'heading', 'list', 'table', 'list'])
  assert.equal(b[0].text, 'MEANING OF PHYSICAL EDUCATION')
  assert.match(b[1].text, /^Physical Education is an integral part.*physical activities\.$/)
  assert.equal(b[3].ordered, true)
  assert.deepEqual(b[3].items, ['Physical Development.', 'Mental Development continued line.', 'Social Development.'])
  assert.equal(b[4].rows.length, 3)
  assert.equal(b[5].ordered, false)
})

test('no OCR content is dropped, summarised or reordered', () => {
  const words = (s) => s.replace(/[•]/g, ' ').match(/[A-Za-z]+/g)
  const out = richToText(blocksToBlockData(structureOcrText(SAMPLE), { useFirstHeading: false }).body.replace(/<\/(h\d|p|li|th|td)>/g, '$& '))
  const src = words(SAMPLE).join(' ').toLowerCase(); const got = words(out).join(' ').toLowerCase()
  assert.equal(got, src)
})

test('generated HTML survives the app sanitizer unchanged (only allowed tags are used)', () => {
  const { body, heading } = textToBlockData(SAMPLE)
  assert.equal(sanitizeHtml(body), body)
  assert.equal(heading, 'MEANING OF PHYSICAL EDUCATION')
})

test('text is HTML-escaped (OCR text can never inject markup)', () => {
  const { body } = textToBlockData('<script>alert(1)</script> & more text here.')
  assert.ok(!body.includes('<script'))
  assert.match(body, /&lt;script&gt;/)
})

test('Odia (Unicode) text is preserved exactly', () => {
  const odia = 'ଶାରୀରିକ ଶିକ୍ଷା ହେଉଛି ସମ୍ପୂର୍ଣ୍ଣ ଶିକ୍ଷାର ଏକ ଅବିଚ୍ଛେଦ୍ୟ ଅଂଶ।'
  const { body } = textToBlockData(`${odia}\n\n1. ଶାରୀରିକ ବିକାଶ।\n2. ମାନସିକ ବିକାଶ।`)
  assert.ok(body.includes(odia)); assert.ok(body.includes('<ol><li>ଶାରୀରିକ ବିକାଶ।</li>'))
})

test('hyphenated line breaks are joined, other text untouched', () => {
  assert.equal(cleanOcrText('develop-\nment of skills'), 'development of skills')
  assert.equal(cleanOcrText('well-\nKnown'), 'well-\nKnown') // capital letter → real hyphen, keep
})

test('page range parsing', () => {
  assert.deepEqual(parsePageRange('1-3, 5', 6), [1, 2, 3, 5])
  assert.deepEqual(parsePageRange('', 3), [1, 2, 3])
  assert.equal(parsePageRange('9', 6), null)
  assert.equal(parsePageRange('3-1', 6), null)
  assert.equal(parsePageRange('a', 6), null)
})

test('file validation gives clear messages', () => {
  assert.match(validateOcrFile({ name: 'a.gif', type: 'image/gif', size: 5000 }), /only JPG, PNG, WEBP/)
  assert.match(validateOcrFile({ name: 'a.jpg', type: 'image/jpeg', size: 20 * 1048576 }), /larger than/)
  assert.match(validateOcrFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }), /empty or corrupt/)
  assert.equal(validateOcrFile({ name: 'a.jpg', type: 'image/jpeg', size: 50000 }), '')
  assert.equal(validateOcrFile({ name: 'a.pdf', type: 'application/pdf', size: 50000 }), '')
  assert.match(validateOcrFile({ name: 'a.pdf', type: 'application/pdf', size: 50000 }, { allowPdf: false }), /not allowed/)
})

test('OCR warnings: empty and low confidence', () => {
  assert.equal(ocrWarnings({ text: '', confidence: 0, pageNo: 2 }).length, 1)
  assert.match(ocrWarnings({ text: 'x', confidence: 40 })[0], /low confidence/)
  assert.deepEqual(ocrWarnings({ text: 'fine', confidence: 90 }), [])
})

test('new "Image to Text" block uses the existing Heading & Paragraph data + renderer', () => {
  assert.ok(BLOCK_TYPES['image-to-text'])
  const b = newBlock('image-to-text'); const base = newBlock('heading-paragraph')
  assert.equal(b.type, 'image-to-text'); assert.equal(b.template, 'heading-paragraph')
  for (const k of Object.keys(base.data)) assert.deepEqual(b.data[k], base.data[k], k)
  assert.equal(b.data.ocr.rawText, '')
  assert.ok(isReadyBlock('image-to-text'))
  assert.equal(blockHeadingText({ ...b, data: { ...b.data, heading: 'Meaning of PE' } }), 'Meaning of PE')
})

test('existing block types are untouched', () => {
  for (const t of ['html', 'json', 'mcq', 'table', 'youtube', 'slider', 'heading-paragraph', 'heading-image', 'heading-list', 'heading-example', 'multi-heading']) {
    assert.ok(BLOCK_TYPES[t], t); assert.equal(newBlock(t).type, t)
  }
})
