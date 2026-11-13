import { clone, uid } from './id'
import { DARK_STYLE } from './blockTheme'
import { DEFAULT_JSON_DISPLAY, DEFAULT_JSON_STYLE, SAMPLE_LESSON, countLessonMedia, validateLessonJson } from './jsonLesson'
import { validateQuestions } from './mcq'
import { DEFAULT_MCQ_DISPLAY, DEFAULT_MCQ_EXAM, DEFAULT_MCQ_RESULT, DEFAULT_MCQ_SETTINGS, SAMPLE_QUESTIONS } from './mcq'
import { DEFAULT_TABLE_OPTIONS, DEFAULT_TABLE_STYLE, SAMPLE_TABLE, validateTable } from './table'

/* Portal → Unit → Chapter → Blocks (ordered) */

export const UNIT_ICONS = ['layers', 'book', 'graduation', 'runner', 'heart', 'dumbbell', 'people', 'trophy', 'brain', 'flask', 'globe', 'calculator', 'palette', 'music', 'language', 'leaf', 'lightbulb', 'clipboard']
export const SWATCHES = ['#0a84ff', '#9b3cff', '#ff4f8b', '#ff9a1f', '#ffd60a', '#22d36b', '#12e0e0']

export const BLOCK_TYPES = {
  html: { label: 'HTML / CSS / JS', sub: 'Custom Code', short: '</>' },
  json: { label: 'JSON Content', sub: 'Upload or edit JSON lesson content', short: '{ }' },
  mcq: { label: 'Create MCQ', sub: 'Chapter Practice Test', short: 'mcq' },
  table: { label: 'Table Block', sub: 'Advanced editable table', short: 'TB' },
  youtube: { label: 'YouTube Video', sub: 'Embedded video', short: 'YT' },
  slider: { label: 'Image Slider / Carousel', sub: 'Image slider', short: 'SLD' },
  'heading-paragraph': { label: 'Heading & Paragraph', sub: 'Structured lesson text', short: 'H+P' },
  'heading-image': { label: 'Heading & Image', sub: 'Heading with image', short: 'IMG' },
  'heading-list': { label: 'Heading & List', sub: 'Key points list', short: 'LIST' },
  'heading-example': { label: 'Heading & Example', sub: 'Worked example', short: 'EX' },
  'multi-heading': { label: 'Multiple Heading Sections', sub: 'H1–H6 sections', short: 'H1–H6' },
  'image-to-text': { label: 'Image to Text', sub: 'Book page photo / PDF → editable text', short: 'OCR' },
}

export const SAMPLE_HTML = `<div class="lesson-card">
  <div class="lesson-icon">
    <i class="bi bi-book"></i>
  </div>
  <div>
    <h2 class="lesson-title">
      Meaning and Definition of Physical Education
    </h2>
    <p class="lesson-text">
      Physical Education is a systematic process of physical, mental and social
      development through planned activities.
    </p>
    <button class="lesson-btn" id="continueBtn">Continue Learning <i class="bi bi-chevron-right"></i></button>
  </div>
</div>`
export const SAMPLE_CSS = `.lesson-card{display:flex;gap:18px;align-items:center;padding:22px 24px;border-radius:16px;
  background:linear-gradient(180deg,#f4f8ff,#e6efff);border:1px solid #cfdcf5}
.lesson-icon{width:64px;height:64px;border-radius:14px;background:#dbe8ff;color:#2563eb;
  display:flex;align-items:center;justify-content:center;font-size:30px;flex-shrink:0}
.lesson-title{font:700 22px Poppins,Inter,sans-serif;color:#0f172a;margin:0 0 4px}
.lesson-text{margin:0 0 12px;color:#334155}
.lesson-btn{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-weight:600;cursor:pointer}
@media(max-width:560px){.lesson-card{flex-direction:column;align-items:flex-start}}`
export const SAMPLE_JS = `document.getElementById('continueBtn')?.addEventListener('click', () => {
  alert('Keep learning! 🎯')
})`

export const YOUTUBE_DEFAULTS = { heading: '', url: '', description: '', caption: '', autoplay: false, controls: true, loop: false, mute: false, aspect: '16/9', widthPct: 100, height: 360, spacing: { padding: 24 } }
export const SLIDER_DEFAULTS = { heading: '', slides: [], layout: 'full', height: 380, fit: 'cover', autoplay: true, speed: 5, loop: true, arrows: true, dots: true, buttonOn: false, buttonLabel: 'View More', buttonUrl: '', spacing: { padding: 24 } }

export function newBlock(type) {
  // Image to Text = a Heading & Paragraph block (same data + renderer) plus a small `ocr` record kept beside it.
  if (type === 'image-to-text') {
    const b = newBlock('heading-paragraph')
    return { ...b, type, template: 'heading-paragraph', title: BLOCK_TYPES[type].label, data: { ...b.data, ocr: { rawText: '', lang: 'eng', pages: 0, confidence: null, at: null } } }
  }
  const nativeTypes = ['heading-paragraph','heading-image','heading-list','heading-example','multi-heading']
  const base = { id: uid('blk'), type: nativeTypes.includes(type) ? type : type, template: nativeTypes.includes(type) ? type : type, visible: true, title: BLOCK_TYPES[type].label, updatedAt: Date.now() }
  const nativeStyle = { ...DARK_STYLE, fontFamily: 'Inter', fontSize: 16, headingSize: 24, textAlign: 'left' }
  const nativeSpacing = { padding: 24, marginTop: 0, marginBottom: 18, }
  if (nativeTypes.includes(type)) {
    // Fields start EMPTY. Light-grey placeholder text is drawn by the UI and is never stored as content.
    const data = { heading: '', body: '', image: '', imageAlt: '', caption: '', listStyle: 'bullet', items: ['', '', ''], exampleTitle: 'Example', exampleText: '', sections: [{ heading: '', level: 'h1', body: '' }, { heading: '', level: 'h2', body: '' }], style: nativeStyle, spacing: nativeSpacing, fullWidth: false }
    return { ...base, data }
  }
  if (type === 'youtube') return { ...base, title: 'YouTube Video', data: { ...YOUTUBE_DEFAULTS } }
  if (type === 'slider') return { ...base, title: 'Image Slider', data: { ...SLIDER_DEFAULTS, slides: [] } }


if (type === 'html') {
  return {
    ...base,
    title: 'Custom HTML / CSS / JS',
    data: {
      html: SAMPLE_HTML,
      css: SAMPLE_CSS,
      js: SAMPLE_JS,
      assets: [],
      padding: 16,
      margin: 0,
      fullWidth: false,
      copyButton: false,
      packages: [],
      style: {
        textColor: '#0f172a',
        fontFamily: 'Inter',
        fontSize: 16,
        textAlign: 'left',
        borderColor: '#dbe4f3',
        borderWidth: 0,
        borderRadius: 12,
        overflowY: 'auto',
        overflowX: 'hidden',
      }
    }
  };
}



  if (type === 'json') return { ...base, title: 'Lesson Content (Structured)', data: { json: JSON.stringify(SAMPLE_LESSON, null, 2), style: { ...DEFAULT_JSON_STYLE }, display: { ...DEFAULT_JSON_DISPLAY }, renderer: 'lesson', packages: [], customCss: '', customJs: '' } }
  if (type === 'table') { const t = SAMPLE_TABLE(); return { ...base, title: 'Table Block', data: { title: 'Types of Physical Activities', caption: 'Physical activities can be classified into different types based on their purpose and nature.', tableCaption: 'Classification of Physical Activities', rows: t.rows, cols: t.cols, options: { ...DEFAULT_TABLE_OPTIONS }, style: { ...DEFAULT_TABLE_STYLE }, customCss: '', spacing: { padding: 20, marginTop: 0, marginBottom: 18 } } } }
  return { ...base, title: 'Chapter Practice Test', data: { title: 'Chapter Practice Test', description: 'Attempt the following MCQs.', questions: SAMPLE_QUESTIONS(), settings: { ...DEFAULT_MCQ_SETTINGS }, display: { ...DEFAULT_MCQ_DISPLAY }, result: { ...DEFAULT_MCQ_RESULT }, exam: { ...DEFAULT_MCQ_EXAM } } }
}

/** Convert legacy template-backed HTML blocks into structured ready-made blocks.
 * Custom HTML blocks remain untouched. This is a loss-minimizing, one-way migration
 * for the five built-in templates only. */
export function migrateReadyMadeBlocks(content) {
  if (typeof DOMParser === 'undefined' || !content?.units) return content
  let changed = false
  const units = content.units.map(unit => ({ ...unit, chapters: (unit.chapters || []).map(chapter => ({ ...chapter, blocks: (chapter.blocks || []).map(block => {
    const template = block.template
    if (block.type !== 'html' || !['heading-paragraph','heading-image','heading-list','heading-example','multi-heading'].includes(template)) return block
    try {
      const doc = new DOMParser().parseFromString(block.data?.html || '', 'text/html')
      const d = newBlock(template).data
      const heading = doc.querySelector('h1,h2,h3,h4,h5,h6')
      if (heading) d.heading = heading.textContent.trim()
      const paragraphs = [...doc.querySelectorAll('p')]
      if (paragraphs[0]) d.body = paragraphs[0].textContent.trim()
      if (template === 'heading-image') {
        const img = doc.querySelector('img')
        if (img) { d.image = img.getAttribute('src') || ''; d.imageAlt = img.getAttribute('alt') || ''; }
        if (paragraphs[1]) d.caption = paragraphs[1].textContent.trim()
      }
      if (template === 'heading-list') {
        const items = [...doc.querySelectorAll('li')].map(x => x.textContent.trim()).filter(Boolean)
        if (items.length) d.items = items
        d.listStyle = doc.querySelector('ol') ? 'number' : 'bullet'
      }
      if (template === 'heading-example') {
        const example = doc.querySelector('.example-box')
        if (example) { d.exampleTitle = example.querySelector('strong')?.textContent.trim() || 'Example'; d.exampleText = example.querySelector('p')?.textContent.trim() || '' }
      }
      if (template === 'multi-heading') {
        const sections = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ heading: h.textContent.trim(), level: h.tagName.toLowerCase(), body: h.nextElementSibling?.textContent.trim() || '' }))
        if (sections.length) d.sections = sections
      }
      const old = block.data || {}
      d.style = { ...d.style, ...(old.style || {}) }
      d.spacing = { ...d.spacing, padding: Number(old.padding ?? d.spacing.padding), marginTop: Number(old.margin ?? 0) }
      changed = true
      return { ...block, type: template, data: d, updatedAt: block.updatedAt || Date.now() }
    } catch (error) {
      console.warn('Could not migrate legacy ready-made block', block.id, error)
      return block
    }
  }) })) }))
  return changed ? { ...content, units } : content
}

export const emptyContent = () => ({ units: [] })

/* ---------- pure helpers (return new content) ---------- */
const findUnit = (c, unitId) => c.units.find((u) => u.id === unitId)
export function findChapter(c, chapterId) {
  for (const u of c.units) { const ch = u.chapters.find((x) => x.id === chapterId); if (ch) return { unit: u, chapter: ch } }
  return {}
}
export function findBlock(c, blockId) {
  for (const u of c.units) for (const ch of u.chapters) { const b = ch.blocks.find((x) => x.id === blockId); if (b) return { unit: u, chapter: ch, block: b } }
  return {}
}
const move = (arr, from, to) => { if (to < 0 || to >= arr.length || from === to) return; const [x] = arr.splice(from, 1); arr.splice(to, 0, x) }
const reId = (b) => ({ ...clone(b), id: uid('blk') })
const reIdChapter = (ch) => ({ ...clone(ch), id: uid('ch'), blocks: ch.blocks.map(reId) })

export function contentReducer(state, action) {
  const c = clone(state)
  switch (action.type) {
    case 'set': return action.content
    case 'addUnit': c.units.push({ id: action.id || uid('unit'), chapters: [], createdAt: Date.now(), ...action.unit }); return c
    case 'updateUnit': Object.assign(findUnit(c, action.unitId), action.patch); return c
    case 'deleteUnit': c.units = c.units.filter((u) => u.id !== action.unitId); return c
    case 'duplicateUnit': {
      const i = c.units.findIndex((u) => u.id === action.unitId); const u = c.units[i]
      c.units.splice(i + 1, 0, { ...clone(u), id: action.newId || uid('unit'), title: `${u.title} (Copy)`, chapters: u.chapters.map(reIdChapter) }); return c
    }
    case 'moveUnit': move(c.units, action.from, action.to); return c
    case 'addChapter': findUnit(c, action.unitId).chapters.push({ id: action.id || uid('ch'), blocks: [], createdAt: Date.now(), ...action.chapter }); return c
    case 'updateChapter': Object.assign(findChapter(c, action.chapterId).chapter, action.patch); return c
    case 'deleteChapter': { const { unit } = findChapter(c, action.chapterId); unit.chapters = unit.chapters.filter((x) => x.id !== action.chapterId); return c }
    case 'duplicateChapter': {
      const { unit, chapter } = findChapter(c, action.chapterId); const i = unit.chapters.indexOf(chapter)
      unit.chapters.splice(i + 1, 0, { ...reIdChapter(chapter), id: action.newId || uid('ch'), title: `${chapter.title} (Copy)` }); return c
    }
    case 'moveChapter': { const u = findUnit(c, action.unitId); move(u.chapters, action.from, action.to); return c }
    case 'addBlock': { const { chapter } = findChapter(c, action.chapterId); const at = Number.isInteger(action.index) ? Math.max(0, Math.min(action.index, chapter.blocks.length)) : chapter.blocks.length; chapter.blocks.splice(at, 0, action.block); return c }
    case 'updateBlock': { const { chapter } = findBlock(c, action.blockId); const i = chapter.blocks.findIndex((b) => b.id === action.blockId); chapter.blocks[i] = { ...action.block, updatedAt: Date.now() }; return c }
    case 'deleteBlock': { const { chapter } = findBlock(c, action.blockId); chapter.blocks = chapter.blocks.filter((b) => b.id !== action.blockId); return c }
    case 'duplicateBlock': {
      const { chapter, block } = findBlock(c, action.blockId); const i = chapter.blocks.indexOf(block)
      chapter.blocks.splice(i + 1, 0, { ...reId(block), id: action.newId || uid('blk'), title: `${block.title} (Copy)` }); return c
    }
    case 'moveBlock': { const { chapter } = findChapter(c, action.chapterId); move(chapter.blocks, action.from, action.to); return c }
    default: return state
  }
}

/* ---------- stats ---------- */
export function blockMedia(b) {
  if (b.type === 'html') return (b.data.html.match(/<img\b|<video\b|<iframe\b/gi) || []).length
  if (b.type === 'heading-image') return b.data.image ? 1 : 0
  if (b.type === 'youtube') return b.data.url ? 1 : 0
  if (b.type === 'slider') return (b.data.slides || []).filter((x) => x.src).length
  if (b.type === 'json') { const v = validateLessonJson(b.data.json); return v.data ? countLessonMedia(v.data) : 0 }
  return 0
}
export function unitStats(unit) {
  const blocks = unit.chapters.flatMap((ch) => ch.blocks)
  return { chapters: unit.chapters.length, contents: blocks.length, media: blocks.reduce((s, b) => s + blockMedia(b), 0) }
}
export function contentStats(content) {
  const units = content.units.length
  const chapters = content.units.reduce((s, u) => s + u.chapters.length, 0)
  const blocks = content.units.reduce((s, u) => s + u.chapters.reduce((a, ch) => a + ch.blocks.length, 0), 0)
  return { units, chapters, blocks }
}

/** Validate everything before publish */
export function validateContent(content) {
  const errors = []
  if (!content.units.length) errors.push('Add at least one unit before publishing.')
  content.units.forEach((u) => {
    if (!u.title?.trim()) errors.push('A unit has no title.')
    u.chapters.forEach((ch) => ch.blocks.forEach((b) => {
      const where = `${u.title} › ${ch.title} › ${BLOCK_TYPES[b.type]?.label || b.title}`
      if (b.type === 'json') { const v = validateLessonJson(b.data.json); if (!v.ok) errors.push(`${where}: ${v.errors[0].message}`) }
      if (b.type === 'mcq') { if (!b.data.questions.length) errors.push(`${where}: no questions.`); else { const qe = validateQuestions(b.data.questions); if (qe.length) errors.push(`${where}: ${qe[0]}`) } }
      if (b.type === 'table') { const te = validateTable(b.data); if (te.length) errors.push(`${where}: ${te[0]}`) }
    }))
  })
  return errors
}

/** Flat ordered list of chapters (for Previous / Next) */
export function flatChapters(content) {
  return content.units.flatMap((u, ui) => u.chapters.map((ch, ci) => ({ unit: u, chapter: ch, unitIndex: ui, chapterIndex: ci })))
}
