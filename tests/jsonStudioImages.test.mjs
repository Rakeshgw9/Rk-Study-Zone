// Run with: node --import ./tests/_register.mjs --test tests/jsonStudioImages.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addItemImage,
  addSectionImage,
  buildStudioJson,
  duplicateSection,
  moveItemImage,
  moveSectionImage,
  normalizeSection,
  normalizeToSections,
  removeItemImage,
  removeSectionImage,
  renderStudioHtml,
  updateItemImage,
  updateSectionImage,
} from '../src/lib/jsonStudio.js'
import { validateLessonJson } from '../src/lib/jsonLesson.js'

test('item-level images: add multiple (1st, 2nd, 3rd), update heading/alt/url, move, delete on paragraphs, lists, examples, formulas', () => {
  const sec = normalizeSection({
    id: 'sec-list',
    type: 'heading_list',
    heading: '7 Ways',
    items: ['Physical Development', 'Mental Development'],
  })

  const img1 = addItemImage(sec, 'items', 0, {
    url: 'https://cdn.jsdelivr.net/gh/user/repo@main/media/img1.png',
    heading: 'Strength Training',
    alt: 'Student doing push-ups',
    caption: 'Daily exercise',
  })
  const img2 = addItemImage(sec, 'items', 0, {
    url: 'https://cdn.jsdelivr.net/gh/user/repo@main/media/img2.png',
    heading: 'Flexibility',
    alt: 'Stretching diagram',
  })
  const img3 = addItemImage(sec, 'items', 0, {
    url: 'https://cdn.jsdelivr.net/gh/user/repo@main/media/img3.png',
    heading: 'Endurance',
    alt: 'Running track',
  })

  assert.equal(sec.items[0].images.length, 3)
  assert.ok(img1.id && img2.id && img3.id)

  updateItemImage(sec, 'items', 0, 1, { heading: 'Flexibility & Yoga' })
  assert.equal(sec.items[0].images[1].heading, 'Flexibility & Yoga')

  moveItemImage(sec, 'items', 0, 2, -1)
  assert.equal(sec.items[0].images[1].heading, 'Endurance')

  removeItemImage(sec, 'items', 0, 0)
  assert.equal(sec.items[0].images.length, 2)

  // Compact JSON round-trip: item 1 (no images, no Odia) stays a plain string; item 0 keeps images
  const jsonText = buildStudioJson({}, [sec], 'midnight-slate', true)
  const v = validateLessonJson(jsonText)
  assert.equal(v.ok, true)

  const parsed = JSON.parse(jsonText)
  assert.equal(typeof parsed.sections[0].items[1], 'string')
  assert.equal(parsed.sections[0].items[0].images.length, 2)
  assert.equal(parsed.sections[0].items[0].images[0].alt, 'Running track')

  const restored = normalizeToSections(parsed)
  assert.equal(restored.sections[0].items[0].images.length, 2)
  assert.equal(restored.sections[0].items[0].images[0].heading, 'Endurance')
})

test('section-bottom images work on every section type including heading_table, while table rows reject item images', () => {
  const tbl = normalizeSection({
    id: 'sec-tbl',
    type: 'heading_table',
    heading: 'Comparison',
    headers: ['A', 'B'],
    rows: [['1', '2']],
  })

  // Table rows must NOT accept per-row item images
  assert.equal(addItemImage(tbl, 'rows', 0, { url: 'https://example.com/a.png' }), null)

  // Section bottom accepts multiple images
  addSectionImage(tbl, {
    url: 'https://cdn.jsdelivr.net/gh/user/repo@main/media/table-fig1.webp',
    heading: 'Figure 1: Overview',
    alt: 'Overview chart',
  })
  addSectionImage(tbl, {
    url: 'https://cdn.jsdelivr.net/gh/user/repo@main/media/table-fig2.webp',
    heading: 'Figure 2: Summary',
    alt: 'Summary chart',
  })
  assert.equal(tbl.images.length, 2)

  updateSectionImage(tbl, 0, { caption: 'Source: OAVS notes' })
  moveSectionImage(tbl, 0, 1)
  assert.equal(tbl.images[0].heading, 'Figure 2: Summary')

  removeSectionImage(tbl, 1)
  assert.equal(tbl.images.length, 1)

  const jsonText = buildStudioJson({}, [tbl], 'midnight-slate', true)
  assert.equal(validateLessonJson(jsonText).ok, true)
  const parsed = JSON.parse(jsonText)
  assert.equal(parsed.sections[0].images.length, 1)
  assert.equal(parsed.sections[0].images[0].alt, 'Summary chart')
})

test('renderStudioHtml renders item & section-bottom images with escaped alt/heading and blocks unsafe URLs', () => {
  const sec = normalizeSection({
    id: 'sec-ex',
    type: 'heading_example',
    heading: 'Examples',
    examples: [
      {
        id: 'e1',
        title: 'School Fitness',
        detail: 'Daily warm-up',
        images: [
          { id: 'img-1', url: 'https://example.com/safe.jpg', heading: 'Warm-up Pose', alt: 'Warm-up "alt"' },
          { id: 'img-2', url: 'javascript:alert(1)', heading: 'Bad', alt: 'Bad' },
        ],
      },
    ],
    images: [
      { id: 'img-s1', url: 'https://example.com/bottom.png', heading: 'Bottom Diagram', alt: 'Diagram' },
    ],
  })

  const html = renderStudioHtml([sec], 'midnight-slate')
  assert.ok(html.includes('https://example.com/safe.jpg'))
  assert.ok(html.includes('Warm-up Pose'))
  assert.ok(html.includes('alt="Warm-up &quot;alt&quot;"'))
  assert.ok(html.includes('https://example.com/bottom.png'))
  assert.ok(html.includes('Bottom Diagram'))
  assert.ok(!html.includes('javascript:alert'))
})

test('duplicateSection refreshes IDs on both section-bottom and item-level images', () => {
  const sec = normalizeSection({
    id: 'sec-1',
    type: 'heading_paragraph',
    heading: 'Intro',
    paragraphs: [
      { text: 'Para 1', images: [{ id: 'img-p1', url: 'https://example.com/p1.png' }] },
    ],
    images: [{ id: 'img-s1', url: 'https://example.com/s1.png' }],
  })

  const list = duplicateSection([sec], 0)
  assert.equal(list.length, 2)
  assert.notEqual(list[1].images[0].id, 'img-s1')
  assert.notEqual(list[1].paragraphs[0].images[0].id, 'img-p1')
})
