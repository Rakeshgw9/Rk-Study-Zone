import { BLOCK_TYPES } from './content'
import { richToText } from './richText'

/* Shared naming logic — used by the builder left tree AND the student sidebar,
   so both always show the same label for a block. */

const READY = ['heading-paragraph', 'heading-image', 'heading-list', 'heading-example', 'multi-heading']
// Titles that were auto-generated for older blocks. They are not "real" headings.
const GENERIC_TITLES = new Set(['Custom HTML / CSS / JS', 'Lesson Content (Structured)', 'Chapter Practice Test', ...Object.values(BLOCK_TYPES).map((t) => t.label)])

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const stripTags = (html) => clean(String(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"))

export const isReadyBlock = (type) => READY.includes(type)

/** Small type badge text: H+P, EX, IMG, LIST … */
export const blockBadge = (type) => BLOCK_TYPES[type]?.short || 'BLK'

/** Human readable type name (e.g. "Heading & Example") */
export const blockTypeLabel = (type) => BLOCK_TYPES[type]?.label || 'Block'

/** The lesson heading the author actually wrote, or '' when there is none. */
export function blockHeadingText(block) {
  const d = block?.data || {}
  switch (block?.type) {
    case 'heading-paragraph': case 'heading-image': case 'heading-list': case 'heading-example':
      return richToText(d.heading)
    case 'multi-heading':
      return richToText(d.sections?.find((s) => richToText(s.heading))?.heading)
    case 'mcq':
      return clean(d.title)
    case 'table':
      return clean(d.title)
    case 'youtube': case 'slider':
      return clean(d.heading)
    case 'json': {
      try { const t = richToText(JSON.parse(d.json || '{}')?.title || ''); if (t) return t } catch { /* invalid JSON while typing */ }
      break
    }
    case 'html': {
      const m = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(d.html || '')
      if (m && stripTags(m[1])) return stripTags(m[1])
      break
    }
    default: break
  }
  // custom (author-typed) title for code-style blocks
  const t = clean(block?.title)
  return t && !GENERIC_TITLES.has(t) && !/ \(Copy\)$/.test(t) ? t : ''
}

/** Main line shown in sidebars: the real heading, or "Part N" when the block has none. */
export const blockHeading = (block, index = 0) => blockHeadingText(block) || `Part ${index + 1}`

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
