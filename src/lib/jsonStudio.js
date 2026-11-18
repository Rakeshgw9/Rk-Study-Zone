/* JSON Content Studio
 * ------------------------------------------------------------------
 * Core section types (default Format Guide + template): heading_paragraph, structured_header, heading_list, heading_table, heading_example.
 * Optional section types (added on demand from the \"Preset Section Blocks\" grid, not part of the default guide): callout_formula, heading_image, heading_youtube.
 * Bilingual: every heading / paragraph / list item / formula / example can carry an optional Odia text (odiaHeading, odiaText, odiaExplain …).
 * Multi-section JSON lessons:  { "type": "studio", "theme": "midnight-slate", "sections": [ { "type": "heading_paragraph", ... } ] }
 * - Single source of truth: SECTION_SCHEMA (used by validation, defaults, the Format Guide and the Sections Manager)
 * - 16 themes (8 dark + 8 light)  →  CSS variables on .json-artboard-content[data-theme="…"]
 * - Legacy lessons (title / summary / points / sections[{heading,text,list,table,example}]) are normalised IN MEMORY
 *   by normalizeToSections(); they are never rewritten until the author chooses to upgrade.
 * Pure string/array code (no DOM) so it also runs in the student page, PDF export and tests.
 */
import { escAttr, escapeText, hasMarkup, sanitizeHtml } from './richText'

/* ---------------------------------------------------------------- themes */
const th = (id, label, mode, bg, surface, text, heading, accent, border) => ({ id, label, mode, bg, surface, text, heading, accent, border })

export const DARK_THEMES = [
  th('midnight-slate', 'Midnight Slate', 'dark', '#0f172a', '#1e293b', '#cbd5e1', '#f1f5f9', '#38bdf8', '#334155'),
  th('obsidian-gold', 'Obsidian Gold', 'dark', '#0b0b0c', '#18181b', '#d6d3d1', '#fde68a', '#f5b301', '#3f3a2a'),
  th('deep-ocean', 'Deep Ocean', 'dark', '#04141f', '#0a2536', '#bfe3f5', '#e0f7ff', '#22d3ee', '#164e63'),
  th('emerald-night', 'Emerald Night', 'dark', '#04120d', '#0b2a1f', '#bfe8d4', '#d1fae5', '#34d399', '#14532d'),
  th('royal-indigo', 'Royal Indigo', 'dark', '#0f0c29', '#1b1747', '#c7d2fe', '#e0e7ff', '#818cf8', '#3730a3'),
  th('carbon-crimson', 'Carbon Crimson', 'dark', '#111111', '#1c1c1f', '#d4d4d8', '#fecaca', '#f43f5e', '#4c1d24'),
  th('cyber-teal', 'Cyber Teal', 'dark', '#06151a', '#0c2a30', '#b6ece6', '#ccfbf1', '#14b8a6', '#115e59'),
  th('graphite-amber', 'Graphite Amber', 'dark', '#18181b', '#27272a', '#d4d4d8', '#fef3c7', '#f59e0b', '#52525b'),
]
export const LIGHT_THEMES = [
  th('pure-paper', 'Pure Paper', 'light', '#ffffff', '#f8fafc', '#334155', '#0f172a', '#2563eb', '#dbe4f3'),
  th('warm-ivory', 'Warm Ivory', 'light', '#fffbf0', '#fdf3dc', '#44403c', '#292524', '#b45309', '#eadcb8'),
  th('mint-breeze', 'Mint Breeze', 'light', '#f0fdf9', '#d9f7ec', '#1f4d3f', '#064e3b', '#059669', '#bfe9d6'),
  th('sky-pastel', 'Sky Pastel', 'light', '#f0f9ff', '#e0f2fe', '#1e3a52', '#0c4a6e', '#0284c7', '#bae0f5'),
  th('lavender-mist', 'Lavender Mist', 'light', '#f7f5ff', '#ece8fd', '#3b3560', '#2e1065', '#7c3aed', '#d8d0f5'),
  th('peach-cream', 'Peach Cream', 'light', '#fff7f2', '#ffe9dc', '#5a3a2e', '#7c2d12', '#ea580c', '#f6d2bd'),
  th('soft-sage', 'Soft Sage', 'light', '#f4f7f2', '#e5eddf', '#3a4a35', '#1f3a1a', '#5f8a4d', '#cddcc4'),
  th('classic-sepia', 'Classic Sepia', 'light', '#f6efe2', '#ebdfc7', '#4a3b28', '#3b2a14', '#92400e', '#d6c3a0'),
]
export const JSON_THEMES = [...DARK_THEMES, ...LIGHT_THEMES]
export const DEFAULT_THEME = 'midnight-slate'
export const isThemeId = (id) => JSON_THEMES.some((t) => t.id === id)
export const themeById = (id) => JSON_THEMES.find((t) => t.id === id) || JSON_THEMES[0]

/* ---------------------------------------------------------------- schema */
const F = (key, kind, desc, o = {}) => ({ key, kind, desc, ...o })
const LABEL = F('label', 'string', 'Small pill above the heading', { optional: true, sample: '' })
const HEADING = F('heading', 'string', 'Main title of the section', { sample: 'New heading' })
const SUB = F('subHeading', 'string', 'Subtitle under the heading', { optional: true, sample: '' })
const ODIA_H = F('odiaHeading', 'string', 'Odia translation of the heading (shown under it)', { optional: true, odia: true, sample: '' })
/** Every section may carry its own theme. Leave it out and the section follows the block theme. */
const THEME = F('theme', 'theme', 'Theme ID for THIS section only (see Theme IDs). Leave it out to use the block theme.', { optional: true })

export const LIST_STYLES = ['check', 'bullet', 'numbered']

export const SECTION_SCHEMA = {
  heading_paragraph: {
    label: 'Heading + Paragraph', short: 'H+P', desc: 'A heading with one or more paragraphs. A paragraph is a plain string or { "text", "odiaText"? }.',
    fields: [THEME, LABEL, HEADING, ODIA_H, SUB, F('paragraphs', 'items', 'Paragraphs: "text" or { "text": "…", "odiaText": "…" } (**bold**, ==highlight== and `code` work)', { sample: [{ text: 'Write your paragraph here.', odiaText: '' }] })],
  },
  structured_header: {
    label: 'Structured Header', short: 'HDR', desc: 'A large topic header with a tag and an overview line.',
    fields: [THEME, F('label', 'string', 'Topic tag shown as a pill', { optional: true, sample: 'Topic' }), HEADING, ODIA_H, F('subHeading', 'string', 'Overview subtitle', { optional: true, sample: 'A short overview of this topic.' }), F('odiaSubHeading', 'string', 'Odia translation of the subtitle', { optional: true, odia: true, sample: '' })],
  },
  heading_list: {
    label: 'Heading + List', short: 'LIST', desc: 'A heading with a check, bullet or numbered list. An item is a plain string or { "text", "odiaText"? }.',
    fields: [THEME, LABEL, HEADING, ODIA_H, SUB, F('listStyle', 'enum', 'check | bullet | numbered', { values: LIST_STYLES, sample: 'bullet' }), F('items', 'items', 'List points: "text" or { "text": "…", "odiaText": "…" }', { sample: [{ text: 'Point 1', odiaText: '' }, { text: 'Point 2', odiaText: '' }] })],
  },
  heading_table: {
    label: 'Heading + Table', short: 'TB', desc: 'A heading with a table (scrolls sideways on small screens, full width in PDF).',
    fields: [THEME, LABEL, HEADING, ODIA_H, SUB, F('odiaNote', 'string', 'Odia note shown under the table', { optional: true, odia: true, sample: '' }), F('headers', 'string[]', 'Column headings', { sample: ['Column 1', 'Column 2'] }), F('rows', 'string[][]', 'Rows – each row is an array of cell text', { sample: [['Row 1A', 'Row 1B']] })],
  },
  callout_formula: {
    label: 'Formula / Equation', short: 'EQ', optional: true, desc: 'Optional section: highlighted exam formulas. Add as many formula boxes as you need; each can have an explanation and an Odia explanation.',
    fields: [THEME, F('label', 'string', 'Pill (e.g. "Formula")', { optional: true, sample: 'Formula' }), HEADING, ODIA_H, F('formulas', 'formulas', 'Formula boxes: { "id", "expression", "explanation"?, "odiaExplain"? }', { sample: [{ id: 'f1', expression: 'Speed = Distance ÷ Time', explanation: '', odiaExplain: '' }] })],
  },
  heading_example: {
    label: 'Heading + Example', short: 'EX', desc: 'One or more highlighted examples / case studies, each with an optional Odia explanation.',
    fields: [THEME, F('label', 'string', 'Pill (usually "Example")', { optional: true, sample: 'Example' }), HEADING, ODIA_H, F('examples', 'examples', 'Example boxes: { "id", "title"?, "detail", "odiaExplain"? }', { sample: [{ id: 'e1', title: '', detail: 'Describe the example in detail here.', odiaExplain: '' }] })],
  },
}

/* ---- optional media sections (heading_image / heading_youtube) – kept OUT of SECTION_TYPE_IDS so the default guide and templates stay focused on the 6 core study blocks */
export const IMAGE_LAYOUTS = ['top', 'split-left', 'split-right']
export const DEFAULT_YT_CONTROLS = { showControls: true, autoplay: false, mute: false, loop: false, startTime: 0 }
const CAPTION = F('caption', 'string', 'Caption under the media', { optional: true, sample: '', dropEmpty: true })
const ODIA_CAP = F('odiaCaption', 'string', 'Odia translation of the caption', { optional: true, odia: true, sample: '', dropEmpty: true })
SECTION_SCHEMA.heading_image = {
  label: 'Heading + Image', short: 'IMG', media: true, desc: 'Optional media section: a heading with one image (URL or uploaded) and a caption. layout: top | split-left | split-right.',
  fields: [THEME, LABEL, HEADING, ODIA_H, SUB, F('imageUrl', 'url', 'Image address (https://… link or an uploaded image)', { sample: '' }), CAPTION, ODIA_CAP, F('layout', 'enum', 'top | split-left | split-right', { values: IMAGE_LAYOUTS, sample: 'top' })],
}
SECTION_SCHEMA.heading_youtube = {
  label: 'Heading + YouTube', short: 'YT', media: true, desc: 'Optional media section: a heading with a responsive 16:9 YouTube player, an optional caption and a \"Watch on YouTube ↗\" link.',
  fields: [THEME, LABEL, HEADING, ODIA_H, SUB, F('youtubeUrl', 'url', 'YouTube link (watch, youtu.be, shorts or embed)', { sample: '' }), CAPTION, ODIA_CAP, F('showWatchLink', 'bool', 'Show the \"Watch on YouTube ↗\" button', { sample: true }), F('controls', 'controls', '{ showControls, autoplay, mute, loop, startTime }', { sample: DEFAULT_YT_CONTROLS })],
}
/** The 5 core study types – used by the Format Guide, the template and the type pickers. */
export const SECTION_TYPE_IDS = ['heading_paragraph', 'structured_header', 'heading_list', 'heading_table', 'heading_example']
export const MEDIA_SECTION_TYPE_IDS = ['heading_image', 'heading_youtube']
export const OPTIONAL_SECTION_TYPE_IDS = ['callout_formula', ...MEDIA_SECTION_TYPE_IDS]
export const ALL_SECTION_TYPE_IDS = [...SECTION_TYPE_IDS, ...OPTIONAL_SECTION_TYPE_IDS]
export const isSectionType = (t) => Object.prototype.hasOwnProperty.call(SECTION_SCHEMA, t)

/** The 8 draggable \"Preset Section Blocks\" of the right sidebar (6 core + 2 optional media presets). */
export const PRESET_BLOCKS = [
  { type: 'heading_paragraph', title: 'Heading + Para', short: 'H+P', hint: 'Heading with paragraphs' },
  { type: 'structured_header', title: 'Header / Title', short: 'HDR', hint: 'Large topic header' },
  { type: 'heading_list', title: 'Heading + List', short: 'LIST', hint: 'Check, bullet or numbered list' },
  { type: 'heading_table', title: 'Heading + Table', short: 'TB', hint: 'Scrollable table' },
  { type: 'callout_formula', title: 'Formula Box', short: 'EQ', hint: 'Optional formula', optional: true },
  { type: 'heading_example', title: 'Example Box', short: 'EX', hint: 'Examples / case studies' },
  { type: 'heading_image', title: 'Heading + Image', short: 'IMG', hint: 'Optional media', media: true },
  { type: 'heading_youtube', title: 'Heading + YouTube', short: 'YT', hint: 'Optional media', media: true },
]
export const PRESET_MIME = 'application/x-rk-preset-section'

/** Quick "add section" choices (below a section) – text / structured study types only */
export const QUICK_ADD = [
  { type: 'heading_paragraph', label: 'Heading + Paragraph' },
  { type: 'heading_list', label: 'List' },
  { type: 'heading_table', label: 'Table' },
  { type: 'heading_example', label: 'Example' },
]

const cloneDeep = (v) => JSON.parse(JSON.stringify(v))
let seq = 0
const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`
export const newSectionId = () => uid('s_')
export const newItemId = () => uid('i_')

export function newSection(type) {
  const t = isSectionType(type) ? type : 'heading_paragraph'
  const out = { id: newSectionId(), type: t }
  SECTION_SCHEMA[t].fields.forEach((f) => {
    if (f.kind === 'theme' || (f.optional && f.odia)) return
    out[f.key] = cloneDeep(f.sample ?? '')
  })
  if (out.formulas) out.formulas = out.formulas.map((x) => ({ ...x, id: newItemId() }))
  if (out.examples) out.examples = out.examples.map((x) => ({ ...x, id: newItemId() }))
  return out
}

/* ------------------------------------------------------- normalisation */
const str = (v) => (v === undefined || v === null ? '' : String(v))

/** Any value → complete YouTube player options (startTime in whole seconds). */
export function normalizeControls(c) {
  const o = c && typeof c === 'object' && !Array.isArray(c) ? c : {}
  const b = (k) => (typeof o[k] === 'boolean' ? o[k] : DEFAULT_YT_CONTROLS[k])
  const t = Math.floor(Number(o.startTime))
  return { showControls: b('showControls'), autoplay: b('autoplay'), mute: b('mute'), loop: b('loop'), startTime: Number.isFinite(t) && t > 0 ? Math.min(t, 86400) : 0 }
}

/** \"90\" | \"1m30s\" | \"1h2m3s\" → seconds */
function parseTimeParam(t) {
  const v = str(t).trim().toLowerCase(); if (!v) return 0
  if (/^\d+$/.test(v)) return Number(v)
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0
}

/** YouTube link (watch / youtu.be / shorts / live / embed / bare 11-char id) → { id, start } or null. Never throws. */
export function parseYouTube(input) {
  const raw = str(input).trim(); if (!raw) return null
  if (/^[\w-]{11}$/.test(raw)) return { id: raw, start: 0 }
  let u
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) } catch { return null }
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '')
  let id = ''
  if (host === 'youtu.be') id = u.pathname.split('/')[1] || ''
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || ''
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/); if (m) id = m[1] }
  } else return null
  if (!/^[\w-]{11}$/.test(id)) return null
  return { id, start: parseTimeParam(u.searchParams.get('t') || u.searchParams.get('start')) }
}
/** Privacy-friendly embed address with the author's player options. autoplay always implies mute (browsers block sound autoplay). */
export function youtubeEmbedUrl(url, controls) {
  const y = parseYouTube(url); if (!y) return ''
  const c = normalizeControls(controls)
  const q = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1', controls: c.showControls ? '1' : '0' })
  if (c.autoplay) q.set('autoplay', '1')
  if (c.mute || c.autoplay) q.set('mute', '1')
  if (c.loop) { q.set('loop', '1'); q.set('playlist', y.id) }
  const start = c.startTime || y.start
  if (start) q.set('start', String(start))
  return `https://www.youtube-nocookie.com/embed/${y.id}?${q.toString()}`
}
export function youtubeWatchUrl(url, controls) {
  const y = parseYouTube(url); if (!y) return ''
  const start = normalizeControls(controls).startTime || y.start
  return `https://www.youtube.com/watch?v=${y.id}${start ? `&t=${start}s` : ''}`
}
/** Only http(s), data:image and site-relative image addresses are rendered. Anything else (javascript:, file: …) → ''. */
export function safeImageUrl(u) {
  const v = str(u).trim()
  if (/^https?:\/\//i.test(v) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);/i.test(v)) return v
  return v.startsWith('/') && !v.startsWith('//') ? v : ''
}
const cellText = (p) => (typeof p === 'string' ? p : p && typeof p === 'object' ? str(p.text) : str(p))

/** string | { text, odiaText } → { text, odiaText } (never throws) */
export const toItem = (p) => (p && typeof p === 'object' && !Array.isArray(p)
  ? { text: str(p.text ?? p.content ?? p.value), odiaText: str(p.odiaText ?? p.odia) }
  : { text: str(p), odiaText: '' })

function ensureIds(list, prefix) {
  const seen = new Set()
  return list.map((x, k) => {
    let id = str(x.id) || `${prefix}${k + 1}`; let n = 2; const base = id
    while (seen.has(id)) id = `${base}-${n++}`
    seen.add(id)
    return id === x.id ? x : { ...x, id }
  })
}
const toFormula = (p) => (p && typeof p === 'object' && !Array.isArray(p)
  ? { id: str(p.id), expression: str(p.expression ?? p.formulaOrQuote ?? p.formula ?? p.text), explanation: str(p.explanation), odiaExplain: str(p.odiaExplain ?? p.odiaText) }
  : { id: '', expression: str(p), explanation: '', odiaExplain: '' })
const toExample = (p) => (p && typeof p === 'object' && !Array.isArray(p)
  ? { id: str(p.id), title: str(p.title ?? p.heading), detail: str(p.detail ?? p.exampleText ?? p.text), odiaExplain: str(p.odiaExplain ?? p.odiaText) }
  : { id: '', title: '', detail: str(p), odiaExplain: '' })

function inferType(s) {
  if (s.youtubeUrl) return 'heading_youtube'
  if (s.imageUrl) return 'heading_image'
  if (s.headers || s.rows || s.columns || s.table) return 'heading_table'
  if (s.formulas || s.formulaOrQuote !== undefined) return 'callout_formula'
  if (s.examples || s.exampleText || s.example) return 'heading_example'
  if (s.items || s.list) return 'heading_list'
  if (s.text !== undefined || s.content !== undefined || s.paragraphs) return 'heading_paragraph'
  return 'structured_header'
}

/** One section object → complete, well-typed section (never throws). Older shapes are upgraded in memory:
 *  text → paragraphs[], string arrays → { text } items, formulaOrQuote → formulas[], exampleText → examples[]. */
export function normalizeSection(s, i = 0) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null
  const type = isSectionType(s.type) ? s.type : inferType(s)
  const out = { id: str(s.id) || `sec-${i + 1}`, type }
  if (isThemeId(s.theme)) out.theme = s.theme
  const src = { ...s }
  if (src.heading === undefined && src.title !== undefined) src.heading = src.title
  if (src.headers === undefined && Array.isArray(src.columns)) src.headers = src.columns
  if (src.items === undefined && Array.isArray(src.list)) src.items = src.list
  if (type === 'heading_paragraph' && !Array.isArray(src.paragraphs)) src.paragraphs = src.text !== undefined ? [src.text] : src.content !== undefined ? [src.content] : []
  if (type === 'callout_formula' && !Array.isArray(src.formulas)) {
    const expr = src.formulaOrQuote ?? src.formula ?? src.quote ?? src.takeaway
    src.formulas = expr !== undefined || src.explanation ? [{ expression: expr, explanation: src.explanation }] : []
  }
  if (type === 'heading_example' && !Array.isArray(src.examples)) {
    const ex = typeof src.example === 'string' ? { detail: src.example } : src.example && typeof src.example === 'object' ? src.example : null
    const detail = src.exampleText ?? ex?.detail ?? ex?.text
    src.examples = detail !== undefined ? [{ title: ex?.title, detail }] : []
  }
  SECTION_SCHEMA[type].fields.forEach((f) => {
    const v = src[f.key]
    if (f.kind === 'theme') return
    if (f.kind === 'string') out[f.key] = str(v)
    else if (f.kind === 'enum') out[f.key] = f.values.includes(v) ? v : f.sample
    else if (f.kind === 'url') out[f.key] = str(v).trim()
    else if (f.kind === 'bool') out[f.key] = typeof v === 'boolean' ? v : f.sample
    else if (f.kind === 'controls') out[f.key] = normalizeControls(v)
    else if (f.kind === 'items') out[f.key] = Array.isArray(v) ? v.map(toItem) : []
    else if (f.kind === 'formulas') out[f.key] = ensureIds(Array.isArray(v) ? v.map(toFormula) : [], 'f')
    else if (f.kind === 'examples') out[f.key] = ensureIds(Array.isArray(v) ? v.map(toExample) : [], 'e')
    else if (f.kind === 'string[]') out[f.key] = Array.isArray(v) ? v.map(cellText) : []
    else if (f.kind === 'string[][]') out[f.key] = Array.isArray(v) ? v.map((r) => (Array.isArray(r) ? r.map(cellText) : [cellText(r)])) : []
  })
  return out
}

/** Sections → compact JSON shape: plain strings when there is no Odia text, empty optional Odia fields dropped. */
export function compactSections(sections = []) {
  return sections.map((s) => {
    const def = SECTION_SCHEMA[s.type]; if (!def) return s
    const out = { id: s.id, type: s.type }
    if (s.theme && isThemeId(s.theme)) out.theme = s.theme
    def.fields.forEach((f) => {
      const v = s[f.key]
      if (f.kind === 'theme' || v === undefined) return
      if (f.optional && f.odia && (v === '' || v === null)) return
      if (f.dropEmpty && (v === '' || v === null)) return
      if (f.kind === 'items') out[f.key] = v.map((it) => (it.odiaText ? { text: it.text, odiaText: it.odiaText } : it.text))
      else if (f.kind === 'formulas') out[f.key] = v.map((x) => ({ id: x.id, expression: x.expression, ...(x.explanation ? { explanation: x.explanation } : {}), ...(x.odiaExplain ? { odiaExplain: x.odiaExplain } : {}) }))
      else if (f.kind === 'examples') out[f.key] = v.map((x) => ({ id: x.id, ...(x.title ? { title: x.title } : {}), detail: x.detail, ...(x.odiaExplain ? { odiaExplain: x.odiaExplain } : {}) }))
      else if (f.kind === 'controls') out[f.key] = normalizeControls(v)
      else out[f.key] = v
    })
    return out
  })
}

/* ------------------------------------------------------ text style */
export const FONT_FAMILIES = [
  { id: 'Inter', css: "Inter,'Noto Sans Oriya',system-ui,sans-serif" },
  { id: 'Poppins', css: "Poppins,'Noto Sans Oriya',system-ui,sans-serif" },
  { id: 'Noto Sans Oriya', css: "'Noto Sans Oriya',Inter,system-ui,sans-serif" },
  { id: 'Merriweather', css: "Merriweather,'Noto Sans Oriya',Georgia,serif" },
  { id: 'JetBrains Mono', css: "'JetBrains Mono','Noto Sans Oriya',ui-monospace,Menlo,monospace" },
]
export const ALIGNS = ['left', 'center', 'right', 'justify']
export const WEIGHTS = ['400', '500', '600', '700']
export const TEXT_STYLE_LIMITS = { headingSize: [20, 36], bodySize: [14, 22], lineHeight: [1.4, 2], letterSpacing: [-0.5, 3] }
const HEX = /^#[0-9a-f]{3,8}$/i
const clamp = (n, [a, b]) => Math.min(b, Math.max(a, n))
/** Any value → only the valid, non-default style keys (so an untouched block stays clean). */
export function normalizeTextStyle(t) {
  const o = t && typeof t === 'object' && !Array.isArray(t) ? t : {}
  const out = {}
  if (FONT_FAMILIES.some((f) => f.id === o.fontFamily)) out.fontFamily = o.fontFamily
  ;['headingSize', 'bodySize', 'lineHeight', 'letterSpacing'].forEach((k) => {
    const n = Number(o[k]); if (o[k] !== '' && o[k] !== null && o[k] !== undefined && Number.isFinite(n)) out[k] = clamp(n, TEXT_STYLE_LIMITS[k])
  })
  if (ALIGNS.includes(o.textAlign)) out.textAlign = o.textAlign
  if (WEIGHTS.includes(String(o.fontWeight))) out.fontWeight = String(o.fontWeight)
  ;['headingColor', 'textColor', 'accentColor'].forEach((k) => { if (typeof o[k] === 'string' && HEX.test(o[k].trim())) out[k] = o[k].trim() })
  return out
}
/** CSS custom properties for a (normalised) textStyle. Only set keys produce a variable. */
export function textStyleVars(t) {
  const s = normalizeTextStyle(t); const v = {}
  if (s.fontFamily) v['--js-font'] = FONT_FAMILIES.find((f) => f.id === s.fontFamily).css
  if (s.headingSize) v['--js-h-size'] = `${s.headingSize}px`
  if (s.bodySize) v['--js-b-size'] = `${s.bodySize}px`
  if (s.lineHeight) v['--js-lh'] = String(s.lineHeight)
  if (s.letterSpacing !== undefined) v['--js-ls'] = `${s.letterSpacing}px`
  if (s.textAlign) v['--js-align'] = s.textAlign
  if (s.fontWeight) v['--js-weight'] = s.fontWeight
  if (s.headingColor) v['--js-heading'] = s.headingColor
  if (s.textColor) v['--js-text'] = s.textColor
  if (s.accentColor) v['--js-accent'] = s.accentColor
  return v
}
const varsToCss = (v) => Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')

const LEGACY_TOP = new Set(['type', 'title', 'summary', 'description', 'points', 'keyPoints', 'pointsTitle', 'sections', 'theme', 'hero', 'textStyle'])
const LEGACY_SECTION = new Set(['id', 'heading', 'text', 'paragraphs', 'list', 'table', 'example'])
/** Top-level keys that normalizeToSections folds into sections (dropped when a legacy lesson is upgraded) */
const FOLDED_TOP = ['summary', 'description', 'points', 'keyPoints', 'pointsTitle', 'hero']

/**
 * Any lesson JSON → { studio, lossless, theme, textStyle, sections[] }
 *  studio   – the JSON already uses typed sections (or "type":"studio"): render it with the Studio
 *  lossless – every legacy key could be mapped (false when the lesson uses image / MCQ / formula / note / takeaway / quote / html …)
 */
export function normalizeToSections(data) {
  const d = Array.isArray(data) ? { sections: data } : data && typeof data === 'object' ? data : {}
  const theme = isThemeId(d.theme) ? d.theme : DEFAULT_THEME
  const textStyle = normalizeTextStyle(d.textStyle)
  const raw = Array.isArray(d.sections) ? d.sections : []
  const studio = d.type === 'studio' || raw.some((s) => s && typeof s === 'object' && isSectionType(s.type))
  if (studio) {
    const seen = new Set()
    const list = raw.map(normalizeSection).filter(Boolean).map((s) => {
      let id = s.id; let n = 2
      while (seen.has(id)) id = `${s.id}-${n++}`
      seen.add(id)
      return id === s.id ? s : { ...s, id }
    })
    return { studio: true, lossless: true, theme, textStyle, sections: list }
  }

  let lossless = !Array.isArray(data)
  Object.keys(d).forEach((k) => { if (!LEGACY_TOP.has(k)) lossless = false })
  const out = []
  const add = (type, o) => out.push({ ...normalizeSection({ type }, out.length), id: `sec-${out.length + 1}`, ...o })
  const hero = d.hero && typeof d.hero === 'object' && !Array.isArray(d.hero) ? d.hero : null
  if (hero && hero.image) lossless = false
  const title = d.title ?? hero?.heading
  const summary = d.summary ?? d.description
  if (title || summary || hero?.label || hero?.title) add('structured_header', { label: str(hero?.label || hero?.title), heading: str(hero?.heading || title), subHeading: str(summary) })
  const points = Array.isArray(d.points) ? d.points : Array.isArray(d.keyPoints) ? d.keyPoints : null
  if (points && points.length) add('heading_list', { heading: str(d.pointsTitle) || 'Key Points', listStyle: 'bullet', items: points.map(toItem) })
  raw.forEach((s) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) { lossless = false; return }
    Object.keys(s).forEach((k) => { if (!LEGACY_SECTION.has(k)) lossless = false })
    let heading = str(s.heading); let made = false
    const take = () => { const h = heading; heading = ''; made = true; return h }
    const paras = [s.text, ...(Array.isArray(s.paragraphs) ? s.paragraphs : [])].filter((p) => p !== undefined && p !== null && p !== '')
    if (paras.length) add('heading_paragraph', { heading: take(), paragraphs: paras.map(toItem) })
    if (Array.isArray(s.list) && s.list.length) add('heading_list', { heading: take(), listStyle: 'bullet', items: s.list.map(toItem) })
    if (s.table && Array.isArray(s.table.rows)) add('heading_table', { heading: take(), headers: Array.isArray(s.table.columns) ? s.table.columns.map(cellText) : [], rows: s.table.rows.map((r) => (Array.isArray(r) ? r.map(cellText) : [cellText(r)])) })
    if (s.example) { const ex = typeof s.example === 'string' ? { text: s.example } : s.example; add('heading_example', { label: 'Example', heading: take() || str(ex.title), examples: [{ id: 'e1', title: '', detail: str(ex.text), odiaExplain: '' }] }) }
    if (!made && heading) add('structured_header', { heading })
  })
  return { studio: false, lossless, theme, textStyle, sections: out }
}

/** Studio lesson → JSON text. `base` is the parsed JSON the edit started from. Other top-level keys are preserved.
 *  textStyle (optional): undefined = keep what `base` has;  object = replace (empty/default → removed). */
export function buildStudioJson(base, sections, theme, wasStudio = true, textStyle) {
  const b = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {}
  if (!wasStudio) FOLDED_TOP.forEach((k) => { delete b[k] })
  const { type: _t, theme: _th, sections: _s, title, textStyle: oldTs, ...rest } = b
  const out = { type: 'studio' }
  if (typeof title === 'string' && title) out.title = title
  out.theme = isThemeId(theme) ? theme : DEFAULT_THEME
  const ts = normalizeTextStyle(textStyle === undefined ? oldTs : textStyle)
  if (Object.keys(ts).length) out.textStyle = ts
  Object.assign(out, rest)
  out.sections = compactSections(sections)
  return JSON.stringify(out, null, 2)
}

/* ------------------------------------------------------------ mutations */
export function duplicateSection(list, i) {
  if (!list[i]) return list
  const copy = cloneDeep(list[i]); copy.id = newSectionId()
  if (copy.formulas) copy.formulas = copy.formulas.map((x) => ({ ...x, id: newItemId() }))
  if (copy.examples) copy.examples = copy.examples.map((x) => ({ ...x, id: newItemId() }))
  return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]
}
export function moveSection(list, i, dir) {
  const j = i + dir
  if (!list[i] || j < 0 || j >= list.length) return list
  const next = [...list];[next[i], next[j]] = [next[j], next[i]]
  return next
}
/** Drag & drop: take item `from` and insert it before the item that was at index `to` (to === length → at the end). */
export function arrayMove(arr, from, to) {
  if (!Array.isArray(arr) || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= arr.length || to < 0 || to > arr.length) return arr
  const t = to > from ? to - 1 : to
  if (t === from) return arr
  const next = [...arr]; const [x] = next.splice(from, 1); next.splice(t, 0, x)
  return next
}
export const moveSectionTo = (list, from, to) => arrayMove(list, from, to)
export const removeSection = (list, i) => (list[i] ? list.filter((_, k) => k !== i) : list)
/** Per-section theme override. id = theme id → set;  falsy / unknown → removed (the section follows the block theme again). */
export function setSectionTheme(list, i, id) {
  if (!list[i]) return list
  const next = list.slice()
  const { theme: _old, id: sid, type, ...rest } = list[i]
  next[i] = isThemeId(id) ? { id: sid, type, theme: id, ...rest } : { id: sid, type, ...rest }
  return next
}
/** Insert a brand-new section of `type` so that it ends up at `index` (clamped to 0…length). Used by the preset cards (click + drag & drop). */
export function insertSectionAt(list, index, type) {
  const at = Math.max(0, Math.min(Number.isInteger(index) ? index : list.length, list.length))
  return [...list.slice(0, at), newSection(type), ...list.slice(at)]
}
/** Same edits by section id (left-sidebar layer tree). Unknown id → list unchanged. */
const idx = (list, id) => list.findIndex((s) => s.id === id)
export const duplicateSectionById = (list, id) => duplicateSection(list, idx(list, id))
export const removeSectionById = (list, id) => removeSection(list, idx(list, id))
/** Studio JSON text → new JSON text after `fn(sections)`; null when the text is not a valid Studio block (so classic lessons are never rewritten by accident). */
export function editStudioJson(jsonText, fn) {
  let base; try { base = JSON.parse(jsonText || '{}') } catch { return null }
  const n = normalizeToSections(base); if (!n.studio) return null
  const next = fn(n.sections); if (!Array.isArray(next)) return null
  return buildStudioJson(base, next, n.theme, true)
}
export function addSectionBelow(list, i, type) {
  const at = i < 0 ? list.length : i + 1
  return [...list.slice(0, at), newSection(type), ...list.slice(at)]
}
/** Set one value by path: "heading" | "paragraphs.1.text" | "items.2.odiaText" | "headers.1" | "rows.0.1" | "formulas.0.expression" */
export function setSectionValue(list, i, path, value) {
  if (!list[i]) return list
  const keys = String(path).split('.')
  if (keys.some((k) => k === '__proto__' || k === 'constructor' || k === 'prototype')) return list
  const next = cloneDeep(list); let cur = next[i]
  for (let k = 0; k < keys.length - 1; k++) { cur = cur?.[keys[k]]; if (cur === undefined || cur === null) return list }
  cur[keys[keys.length - 1]] = value
  return next
}
export function mutateSection(list, i, fn) {
  if (!list[i]) return list
  const next = cloneDeep(list); fn(next[i]); return next
}
/** Array-field helpers (key = paragraphs | items | rows | formulas | examples) – used by the per-element mini toolbar and drag & drop. */
const withNewId = (x) => (x && typeof x === 'object' && !Array.isArray(x) && 'id' in x ? { ...x, id: newItemId() } : x)
export function dupItem(s, key, k) { const a = [...(s[key] || [])]; if (k < 0 || k >= a.length) return; a.splice(k + 1, 0, withNewId(cloneDeep(a[k]))); s[key] = a }
export function moveItem(s, key, k, dir) { const a = [...(s[key] || [])]; const j = k + dir; if (k < 0 || k >= a.length || j < 0 || j >= a.length) return; [a[k], a[j]] = [a[j], a[k]]; s[key] = a }
export function moveItemTo(s, key, from, to) { s[key] = arrayMove(s[key] || [], from, to) }
export function removeItem(s, key, k) { s[key] = (s[key] || []).filter((_, n) => n !== k) }
export const addParagraph = (s) => { s.paragraphs = [...(s.paragraphs || []), { text: 'New paragraph', odiaText: '' }] }
export const addFormula = (s) => { s.formulas = [...(s.formulas || []), { id: newItemId(), expression: 'New formula', explanation: '', odiaExplain: '' }] }
export const addExample = (s) => { s.examples = [...(s.examples || []), { id: newItemId(), title: '', detail: 'New example', odiaExplain: '' }] }
export const listAddItem = (s) => { s.items = [...(s.items || []), { text: 'New point', odiaText: '' }] }
export const listRemoveItem = (s, k) => { s.items = (s.items || []).filter((_, n) => n !== k) }
export const tableCols = (s) => Math.max((s.headers || []).length, ...(s.rows || []).map((r) => r.length), 1)
export function tableAddRow(s) { s.rows = [...(s.rows || []), Array.from({ length: tableCols(s) }, () => 'New cell')] }
export function tableRemoveRow(s) { s.rows = (s.rows || []).slice(0, -1) }
export function tableAddCol(s) { const n = tableCols(s); s.headers = [...(s.headers || []), ...Array(n - (s.headers || []).length).fill(''), 'New column'].slice(0, n + 1); s.rows = (s.rows || []).map((r) => [...r, ...Array(n - r.length).fill(''), 'New cell']) }
export function tableRemoveCol(s) { const n = tableCols(s); if (n <= 1) return; s.headers = (s.headers || []).slice(0, n - 1); s.rows = (s.rows || []).map((r) => r.slice(0, n - 1)) }

/* ------------------------------------------------------------ validation */
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x)
/** Messages for one section object (appended to validateLessonJson). */
export function validateStudioSection(s, i) {
  const errs = []; const at = `sections[${i}]`
  if (!isObj(s)) return errs
  if (s.type !== undefined && !isSectionType(s.type)) { errs.push(`"${at}.type" must be one of: ${SECTION_TYPE_IDS.join(', ')} (optional: ${OPTIONAL_SECTION_TYPE_IDS.join(', ')}).`); return errs }
  if (!isSectionType(s.type)) return errs
  SECTION_SCHEMA[s.type].fields.forEach((f) => {
    const v = s[f.key]; if (v === undefined) return
    if (f.kind === 'theme') return // an unknown theme only warns (studioSectionWarnings) and falls back to the block theme
    if (f.kind === 'string' && typeof v !== 'string') errs.push(`"${at}.${f.key}" must be text (string).`)
    if (f.kind === 'enum' && !f.values.includes(v)) errs.push(`"${at}.${f.key}" must be one of: ${f.values.join(', ')}.`)
    if (f.kind === 'url' && typeof v !== 'string') errs.push(`"${at}.${f.key}" must be text (a link).`)
    if (f.kind === 'bool' && typeof v !== 'boolean') errs.push(`"${at}.${f.key}" must be true or false.`)
    if (f.kind === 'controls') {
      if (!isObj(v)) errs.push(`"${at}.${f.key}" must be an object like { "showControls": true, "startTime": 0 }.`)
      else ['showControls', 'autoplay', 'mute', 'loop'].forEach((k) => { if (v[k] !== undefined && typeof v[k] !== 'boolean') errs.push(`"${at}.${f.key}.${k}" must be true or false.`) })
      if (isObj(v) && v.startTime !== undefined && !(typeof v.startTime === 'number' && v.startTime >= 0)) errs.push(`"${at}.${f.key}.startTime" must be a number of seconds (0 or more).`)
    }
    if (f.kind === 'string[]' && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) errs.push(`"${at}.${f.key}" must be an array of text.`)
    if (f.kind === 'string[][]' && (!Array.isArray(v) || v.some((r) => !Array.isArray(r)))) errs.push(`"${at}.${f.key}" must be an array of rows, each row an array of text.`)
    if (f.kind === 'items') {
      if (!Array.isArray(v)) errs.push(`"${at}.${f.key}" must be an array.`)
      else v.forEach((x, k) => { if (typeof x !== 'string' && !(isObj(x) && typeof x.text === 'string' && (x.odiaText === undefined || typeof x.odiaText === 'string'))) errs.push(`"${at}.${f.key}[${k}]" must be text or { "text": "…", "odiaText": "…" }.`) })
    }
    if (f.kind === 'formulas' || f.kind === 'examples') {
      const main = f.kind === 'formulas' ? 'expression' : 'detail'; const odia = 'odiaExplain'
      if (!Array.isArray(v)) errs.push(`"${at}.${f.key}" must be an array.`)
      else v.forEach((x, k) => {
        if (!isObj(x)) { if (typeof x !== 'string') errs.push(`"${at}.${f.key}[${k}]" must be an object with "${main}".`); return }
        if (x[main] !== undefined && typeof x[main] !== 'string') errs.push(`"${at}.${f.key}[${k}].${main}" must be text (string).`)
        if (x[odia] !== undefined && typeof x[odia] !== 'string') errs.push(`"${at}.${f.key}[${k}].${odia}" must be text (string).`)
      })
    }
  })
  return errs
}

/** Non-blocking notes (appended to validateLessonJson warnings). */
export function studioSectionWarnings(s, i) {
  const out = []
  if (!isObj(s) || !isSectionType(s.type)) return out
  if (s.theme !== undefined && !isThemeId(s.theme)) out.push(`"sections[${i}].theme" is not a known theme — the block theme will be used.`)
  if (s.type === 'heading_youtube' && typeof s.youtubeUrl === 'string' && s.youtubeUrl.trim() && !parseYouTube(s.youtubeUrl)) out.push(`"sections[${i}].youtubeUrl" is not a recognised YouTube link — no player will be shown.`)
  if (s.type === 'heading_image' && typeof s.imageUrl === 'string' && s.imageUrl.trim() && !safeImageUrl(s.imageUrl)) out.push(`"sections[${i}].imageUrl" must start with https:// — no image will be shown.`)
  return out
}

/** Parsed studio lesson from JSON text, or null (invalid JSON / classic lesson). */
export function studioFromJson(text) {
  let d
  try { d = JSON.parse(text || '{}') } catch { return null }
  if (!d || typeof d !== 'object') return null
  const n = normalizeToSections(d)
  return n.studio ? n : null
}
/** Studio blocks render natively in React (no iframe). Custom JS / external packages need a sandbox, so only those keep the frame. */
export function nativeStudio(data) {
  if (!data) return null
  if (String(data.customJs || '').trim() || (data.packages || []).length) return null
  return studioFromJson(data.json)
}

/** Sections of a Studio block for the left-sidebar layer tree (null = not a Studio block / invalid JSON). Cached by JSON text so a big tree re-renders cheaply. */
const sectionListCache = new Map()
export function studioSectionList(jsonText) {
  const key = typeof jsonText === 'string' ? jsonText : ''
  if (sectionListCache.has(key)) return sectionListCache.get(key)
  const n = studioFromJson(key)
  const list = n ? n.sections : null
  if (sectionListCache.size > 300) sectionListCache.clear()
  sectionListCache.set(key, list)
  return list
}
/** Move the item at `from` so that it ends up at index `to` (final position; used by the layer tree drag & drop). */
export function moveSectionIndex(list, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || !list[from] || from === to || to < 0 || to >= list.length) return list
  const next = [...list]; const [x] = next.splice(from, 1); next.splice(to, 0, x)
  return next
}

/** Author CSS is wrapped in the block selector. A stray `}` would let it escape into the whole page, so unbalanced / @import CSS is dropped. */
export function safeScopedCss(css = '') {
  const t = String(css || '').replace(/@import[^;]*;?/gi, '').replace(/<\/?style/gi, '')
  let depth = 0
  for (const ch of t) { if (ch === '{') depth++; else if (ch === '}' && --depth < 0) return ''; }
  return depth === 0 ? t : ''
}

/** Plain-text preview of a section (sidebar list, navigation) */
export const sectionTitle = (s) => String(s?.heading || s?.label || s?.paragraphs?.[0]?.text || s?.formulas?.[0]?.expression || s?.examples?.[0]?.detail || '').replace(/<[^>]*>/g, '').trim()

/* -------------------------------------------------------------- guide */
export const STUDIO_TEMPLATE = {
  type: 'studio',
  title: 'Meaning and Definition of Physical Education',
  theme: DEFAULT_THEME,
  sections: [
    { id: 'sec-1', type: 'structured_header', label: 'Unit 1', heading: 'Physical Education', odiaHeading: 'ଶାରୀରିକ ଶିକ୍ଷା', subHeading: 'An overview of meaning, aims and activities.', odiaSubHeading: 'ଅର୍ଥ, ଉଦ୍ଦେଶ୍ୟ ଏବଂ କାର୍ଯ୍ୟକଳାପର ସଂକ୍ଷିପ୍ତ ବିବରଣୀ।' },
    { id: 'sec-2', type: 'heading_paragraph', label: 'Concept', heading: 'Meaning of Physical Education', odiaHeading: 'ଶାରୀରିକ ଶିକ୍ଷାର ଅର୍ଥ', subHeading: 'Education through movement', paragraphs: [{ text: 'Physical Education is a **systematic process** of physical, mental and social development through planned activities.', odiaText: 'ଶାରୀରିକ ଶିକ୍ଷା ହେଉଛି ଯୋଜନାବଦ୍ଧ କାର୍ଯ୍ୟକଳାପ ମାଧ୍ୟମରେ ଶାରୀରିକ, ମାନସିକ ଓ ସାମାଜିକ ବିକାଶର ଏକ ପ୍ରକ୍ରିୟା।' }, 'It uses movement, games and exercise as the medium of learning.'] },
    { id: 'sec-3', type: 'heading_list', label: 'Aims', heading: 'Aims of Physical Education', listStyle: 'check', items: ['Physical development', { text: 'Mental development', odiaText: 'ମାନସିକ ବିକାଶ' }, 'Social development'] },
    { id: 'sec-4', type: 'heading_table', label: 'Classification', heading: 'Types of Physical Activities', odiaNote: 'ଶାରୀରିକ କାର୍ଯ୍ୟକଳାପର ପ୍ରକାର', headers: ['Type of Activity', 'Examples', 'Benefit'], rows: [['Aerobic Activities', 'Running, Cycling', 'Heart and lung health'], ['Strength Activities', 'Push-ups, Squats', 'Muscle strength'], ['Flexibility Activities', 'Yoga, Stretching', 'Joint mobility']] },
    { id: 'sec-5', type: 'heading_example', label: 'Example', heading: 'Case Study: School Fitness Programme', examples: [{ id: 'e1', title: 'Daily activity', detail: 'A school added 30 minutes of daily activity. After one term students showed better attendance and concentration.', odiaExplain: 'ଏକ ବିଦ୍ୟାଳୟ ପ୍ରତିଦିନ ୩୦ ମିନିଟ୍ କାର୍ଯ୍ୟକଳାପ ଯୋଗ କଲା।' }] },
  ],
}
export const STUDIO_TEMPLATE_JSON = JSON.stringify(STUDIO_TEMPLATE, null, 2)

/** Pretty one-line description of a field type for the guide table */
export const kindLabel = (f) => (f.kind === 'enum' ? f.values.map((v) => `"${v}"`).join(' | ')
  : f.kind === 'items' ? 'string | { text, odiaText? }[]'
  : f.kind === 'formulas' ? '{ id, expression, explanation?, odiaExplain? }[]'
  : f.kind === 'examples' ? '{ id, title?, detail, odiaExplain? }[]'
  : f.kind === 'controls' ? '{ showControls, autoplay, mute, loop, startTime }'
  : f.kind === 'bool' ? 'true | false'
  : f.kind === 'url' ? 'link (string)'
  : f.kind === 'theme' ? 'theme id' : f.kind)

/* ------------------------------------------------------------ rendering */
/** Stored text → safe inline HTML (supports **bold**, ==highlight==, `code`, line breaks and sanitised HTML) */
export function fmt(t = '') {
  const raw = str(t)
  const clean = hasMarkup(raw) ? sanitizeHtml(raw) : escapeText(raw)
  // Markdown-style marks may only touch TEXT: tags (and their attributes, e.g. href="a==b==c") are parked first, then put back
  const tags = []
  let s = clean.replace(/<[^>]*>/g, (m) => { tags.push(m); return `\u0000${tags.length - 1}\u0000` })
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/==(.+?)==/g, '<mark>$1</mark>').replace(/`([^`]+?)`/g, '<code>$1</code>')
  s = s.replace(/\u0000(\d+)\u0000/g, (_, k) => tags[Number(k)] ?? '')
  return s.replace(/\r?\n/g, '<br>')
}

/** Static HTML for the PDF export and the classic frame path (the student page and builder render the same classes natively with React). */
export function renderStudioHtml(sections = [], theme = DEFAULT_THEME, opts = {}) {
  const opt = (cls, v, tag = 'div') => (v ? `<${tag} class="${cls}">${fmt(v)}</${tag}>` : '')
  const od = (v, cls = '') => opt(`js-odia-text ${cls}`.trim(), v)
  const head = (s) => `${opt('js-pill', s.label, 'span')}${s.heading ? `<h3 class="js-h">${fmt(s.heading)}</h3>` : ''}${od(s.odiaHeading, 'js-odia-h')}${opt('js-sub', s.subHeading)}${od(s.odiaSubHeading)}`
  const body = sections.map((s) => {
    let inner = ''
    if (s.type === 'structured_header') inner = head(s)
    else if (s.type === 'heading_paragraph') inner = `${head(s)}${(s.paragraphs || []).map((p) => `<div class="js-pi"><p class="js-p">${fmt(p.text)}</p>${od(p.odiaText)}</div>`).join('')}`
    else if (s.type === 'heading_list') inner = `${head(s)}<ul class="js-list ${LIST_STYLES.includes(s.listStyle) ? s.listStyle : 'bullet'}">${(s.items || []).map((x) => `<li><div class="js-li-body"><div>${fmt(x.text)}</div>${od(x.odiaText)}</div></li>`).join('')}</ul>`
    else if (s.type === 'heading_table') {
      const cols = tableCols(s)
      const pad = (r) => Array.from({ length: cols }, (_, c) => r[c] ?? '')
      inner = `${head(s)}<div class="js-table-scroll js-table-wrap table-responsive"><table class="js-table">${(s.headers || []).length ? `<thead><tr>${pad(s.headers).map((h) => `<th>${fmt(h)}</th>`).join('')}</tr></thead>` : ''}<tbody>${(s.rows || []).map((r) => `<tr>${pad(r).map((c) => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${od(s.odiaNote, 'js-odia-note')}`
    } else if (s.type === 'callout_formula') inner = `${head(s)}${(s.formulas || []).map((x) => `<div class="js-fbox"><div class="js-formula">${fmt(x.expression)}</div>${opt('js-expl', x.explanation)}${od(x.odiaExplain)}</div>`).join('')}`
    else if (s.type === 'heading_image') {
      const src = safeImageUrl(s.imageUrl); const layout = IMAGE_LAYOUTS.includes(s.layout) ? s.layout : 'top'
      const fig = src ? `<figure class="js-media js-img"><img src="${escAttr(src)}" alt="${escAttr(String(s.heading || s.caption || 'Image').replace(/<[^>]*>/g, ''))}" loading="lazy"></figure>` : ''
      const caps = `${opt('js-caption', s.caption)}${od(s.odiaCaption)}`
      inner = `${head(s)}${layout === 'top' ? `${fig}${caps}` : `<div class="js-split js-${layout}">${fig}<div class="js-split-text">${caps}</div></div>`}`
    } else if (s.type === 'heading_youtube') {
      const embed = youtubeEmbedUrl(s.youtubeUrl, s.controls); const watch = youtubeWatchUrl(s.youtubeUrl, s.controls)
      const player = embed ? `<div class="js-media js-yt"><iframe src="${escAttr(embed)}" title="${escAttr(String(s.heading || 'YouTube video').replace(/<[^>]*>/g, ''))}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div class="js-yt-print">▶ Video: <a href="${escAttr(watch)}">${escapeText(watch)}</a></div>` : ''
      const link = embed && s.showWatchLink !== false ? `<div class="js-yt-link"><a href="${escAttr(watch)}" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></div>` : ''
      inner = `${head(s)}${player}${opt('js-caption', s.caption)}${od(s.odiaCaption)}${link}`
    } else if (s.type === 'heading_example') inner = `${head(s)}${(s.examples || []).map((x) => `<div class="js-ex-item">${opt('js-ex-title', x.title)}<div class="js-ex-body">${fmt(x.detail)}</div>${od(x.odiaExplain)}</div>`).join('')}`
    const thm = isThemeId(s.theme) ? ` data-theme="${s.theme}"` : ''
    return `<section class="js-sec js-${s.type.replace(/_/g, '-')}" id="${escAttr(opts.idPrefix || 'js-sec-')}${escAttr(s.id)}"${thm}>${inner}</section>`
  }).join('')
  const vars = varsToCss(textStyleVars(opts.textStyle))
  return `<div class="json-artboard-content${opts.full === false ? '' : ' in-frame'}" data-theme="${themeById(theme).id}"${vars ? ` style="${escAttr(vars)}"` : ''}>${body}</div>`
}

const themeVars = (t) => `--js-bg:${t.bg};--js-surface:${t.surface};--js-text:${t.text};--js-heading:${t.heading};--js-accent:${t.accent};--js-border:${t.border}`

/** Stylesheet shared by the builder canvas, the chapter canvas, the student page and the PDF.
 *  The same text is mirrored into src/styles/jsonStudio.css (generated block – run `npm run sync:css`; a unit test guards against drift). */
export function studioCss() {
  const base = themeById(DEFAULT_THEME)
  const themes = JSON_THEMES.map((t) => `.json-artboard-content[data-theme="${t.id}"],.json-artboard-content .js-sec[data-theme="${t.id}"]{${themeVars(t)};color-scheme:${t.mode}}`).join('\n')
  return `
.json-artboard-content{${themeVars(base)};color-scheme:dark;box-sizing:border-box;position:relative;background:var(--js-bg);color:var(--js-text);border-radius:14px;padding:20px;max-height:1000px;overflow-y:auto;overflow-x:hidden;font-family:var(--js-font,Inter,'Noto Sans Oriya',system-ui,sans-serif);font-size:var(--js-b-size,16px);line-height:var(--js-lh,1.65);letter-spacing:var(--js-ls,normal);font-weight:var(--js-weight,400);scrollbar-width:thin;scrollbar-color:var(--js-accent) transparent;text-align:var(--js-align,left);max-width:100%}
.json-artboard-content *{box-sizing:border-box}
.json-artboard-content::-webkit-scrollbar{width:10px}
.json-artboard-content::-webkit-scrollbar-track{background:transparent}
.json-artboard-content::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--js-accent) 55%,transparent);border-radius:99px;border:2px solid var(--js-bg)}
.json-artboard-content.in-frame,.json-artboard-content.js-full{max-height:none;overflow:visible}
${themes}
.json-artboard-content .js-sec{position:relative;background:var(--js-surface);color:var(--js-text);border:1px solid var(--js-border);border-radius:12px;padding:18px 20px;margin:0 0 14px}
.json-artboard-content .js-sec:last-child{margin-bottom:0}
.json-artboard-content .js-sec.js-active{outline:2px solid var(--js-accent);outline-offset:2px}
.json-artboard-content .js-pill{display:inline-block;font-size:.72em;font-weight:700;letter-spacing:.05em;text-transform:uppercase;line-height:1.4;padding:3px 11px;border-radius:999px;color:var(--js-accent);background:color-mix(in srgb,var(--js-accent) 16%,transparent);border:1px solid color-mix(in srgb,var(--js-accent) 35%,transparent);margin:0 0 8px}
.json-artboard-content .js-h{color:var(--js-heading);font-size:var(--js-h-size,1.35em);font-weight:700;line-height:1.3;margin:0 0 4px;word-break:normal;overflow-wrap:anywhere}
.json-artboard-content .js-sub{color:color-mix(in srgb,var(--js-text) 82%,transparent);font-size:.95em;margin:0 0 10px}
.json-artboard-content .js-p{margin:6px 0 0;overflow-wrap:anywhere}
.json-artboard-content .js-odia-text{font-family:'Noto Sans Oriya',Inter,system-ui,sans-serif;color:color-mix(in srgb,var(--js-text) 92%,var(--js-accent));margin-top:4px;padding:4px 8px;background:color-mix(in srgb,var(--js-accent) 10%,var(--js-surface));border-radius:6px;border-left:3px solid color-mix(in srgb,var(--js-accent) 55%,transparent);font-size:.98em;line-height:1.75;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.json-artboard-content .js-odia-h{color:var(--js-heading);font-weight:600;font-size:1.05em;margin-bottom:6px}
.json-artboard-content .js-odia-note{margin-top:8px}
.json-artboard-content .js-structured-header{background:linear-gradient(135deg,color-mix(in srgb,var(--js-accent) 20%,var(--js-surface)),var(--js-surface));border-color:color-mix(in srgb,var(--js-accent) 40%,var(--js-border))}
.json-artboard-content .js-structured-header .js-h{font-size:var(--js-h-size,1.75em);font-weight:800}
.json-artboard-content .js-structured-header .js-sub{margin-bottom:0;font-size:1.02em}
.json-artboard-content strong{color:var(--js-heading);font-weight:700}
.json-artboard-content mark{background:color-mix(in srgb,var(--js-accent) 28%,transparent);color:var(--js-heading);padding:0 3px;border-radius:3px}
.json-artboard-content code{background:color-mix(in srgb,var(--js-text) 14%,transparent);padding:1px 6px;border-radius:5px;font-size:.9em}
.json-artboard-content .js-list{list-style:none;margin:8px 0 0;padding:0;counter-reset:jsn}
.json-artboard-content .js-list li{display:flex;gap:10px;align-items:flex-start;padding:4px 0;counter-increment:jsn;position:relative}
.json-artboard-content .js-list li .js-li-body{flex:1;min-width:0;overflow-wrap:anywhere}
.json-artboard-content .js-list li::before{flex:none;margin-top:.1em}
.json-artboard-content .js-list.bullet li::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--js-accent);margin-top:.68em}
.json-artboard-content .js-list.numbered li::before{content:counter(jsn);width:24px;height:24px;border-radius:50%;background:var(--js-accent);color:var(--js-bg);font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:.2em}
.json-artboard-content .js-list.check li::before{content:'\\2713';width:24px;height:24px;border-radius:7px;background:color-mix(in srgb,var(--js-accent) 22%,transparent);color:var(--js-accent);border:1px solid color-mix(in srgb,var(--js-accent) 45%,transparent);font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:.2em}
.json-artboard-content .js-table-scroll,.json-artboard-content .js-table-wrap{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--js-border);border-radius:10px;margin-top:8px}
.json-artboard-content .js-table{width:100%;border-collapse:collapse;table-layout:auto;font-size:.95em;margin:0}
.json-artboard-content .js-table th,.json-artboard-content .js-table td{min-width:140px;padding:10px 14px;text-align:left;vertical-align:top;word-break:normal;overflow-wrap:normal;hyphens:none;border:0;border-top:1px solid var(--js-border);color:var(--js-text);background:transparent}
.json-artboard-content .js-table thead th{background:color-mix(in srgb,var(--js-accent) 16%,var(--js-surface));color:var(--js-heading);font-weight:700;border-top:0;white-space:nowrap}
.json-artboard-content .js-table tbody tr:nth-child(even) td{background:color-mix(in srgb,var(--js-text) 5%,transparent)}
.json-artboard-content .js-fbox{margin-top:10px}
.json-artboard-content .js-formula{font-size:1.2em;font-weight:700;text-align:center;color:var(--js-heading);background:color-mix(in srgb,var(--js-accent) 14%,transparent);border:1px dashed color-mix(in srgb,var(--js-accent) 65%,transparent);border-radius:12px;padding:14px 16px;overflow-wrap:anywhere}
.json-artboard-content .js-expl{margin-top:8px;overflow-wrap:anywhere}
.json-artboard-content .js-ex-item{margin-top:10px}
.json-artboard-content .js-ex-title{font-weight:700;color:var(--js-heading);margin:0 0 4px}
.json-artboard-content .js-ex-body{border-left:4px solid var(--js-accent);background:color-mix(in srgb,var(--js-accent) 12%,transparent);border-radius:0 10px 10px 0;padding:12px 16px;margin-top:6px;overflow-wrap:anywhere}
.json-artboard-content .js-media{margin-top:10px}
.json-artboard-content .js-img{margin:10px 0 0;border:1px solid var(--js-border);border-radius:12px;overflow:hidden;background:color-mix(in srgb,var(--js-text) 6%,transparent)}
.json-artboard-content .js-img img{display:block;width:100%;max-width:100%;height:auto;object-fit:contain}
.json-artboard-content .js-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start;margin-top:10px}
.json-artboard-content .js-split .js-img{margin:0}
.json-artboard-content .js-split.js-split-right .js-img{order:2}
.json-artboard-content .js-split-text{min-width:0}
.json-artboard-content .js-caption{margin-top:8px;font-size:.9em;font-style:italic;color:color-mix(in srgb,var(--js-text) 85%,transparent);overflow-wrap:anywhere}
.json-artboard-content .js-yt{position:relative;width:100%;aspect-ratio:16/9;border:1px solid var(--js-border);border-radius:12px;overflow:hidden;background:#000}
.json-artboard-content .js-yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.json-artboard-content .js-yt-link{margin-top:10px}
.json-artboard-content .js-yt-link a{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid var(--js-accent);border-radius:999px;color:var(--js-accent);font-size:.9em;font-weight:600;text-decoration:none}
.json-artboard-content .js-yt-link a:hover{background:color-mix(in srgb,var(--js-accent) 14%,transparent)}
.json-artboard-content .js-yt-print{display:none}
.json-artboard-content .js-media-empty{margin-top:10px;padding:22px;border:1px dashed var(--js-border);border-radius:12px;text-align:center;font-size:.92em;opacity:.8}
.json-artboard-content .js-media-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}
.json-artboard-content .js-media-ctl .js-url{flex:1 1 220px;min-width:0;height:32px;padding:0 10px;border:1px solid var(--js-border);border-radius:8px;background:color-mix(in srgb,var(--js-bg) 70%,var(--js-surface));color:var(--js-text);font:inherit;font-size:.88em}
.json-artboard-content .js-media-ctl .js-url:focus{outline:2px solid var(--js-accent);outline-offset:1px}
.json-artboard-content .js-media-ctl button,.json-artboard-content .js-media-ctl label.js-chip-btn,.json-artboard-content .js-media-ctl .js-num{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border:1px dashed color-mix(in srgb,var(--js-accent) 55%,transparent);border-radius:999px;background:transparent;color:var(--js-accent);font-size:12px;font-weight:600;cursor:pointer}
.json-artboard-content .js-media-ctl button.on,.json-artboard-content .js-media-ctl label.js-chip-btn.on{background:color-mix(in srgb,var(--js-accent) 22%,transparent);border-style:solid}
.json-artboard-content .js-media-ctl .js-num{cursor:default}
.json-artboard-content .js-media-ctl .js-num input{width:56px;height:22px;border:1px solid var(--js-border);border-radius:6px;background:transparent;color:var(--js-text);font:inherit;padding:0 4px}
.json-artboard-content .js-media-ctl input[type=file]{display:none}
.json-artboard-content .js-note-btn{position:absolute;right:12px;bottom:8px}
.json-artboard-content .js-sec.js-has-note{padding-bottom:44px}
/* builder-only controls (never rendered for students) */
.json-artboard-content .js-opt-empty{display:none}
.json-artboard-content .js-sec:hover .js-opt-empty,.json-artboard-content .js-sec:focus-within .js-opt-empty{display:block}
.json-artboard-content .js-sec:hover .js-pill.js-opt-empty,.json-artboard-content .js-sec:focus-within .js-pill.js-opt-empty{display:inline-block}
.json-artboard-content [contenteditable]{outline:none;border-radius:4px;cursor:text;min-height:1em;transition:background .12s}
.json-artboard-content [contenteditable]:hover{background:color-mix(in srgb,var(--js-accent) 10%,transparent)}
.json-artboard-content [contenteditable]:focus{background:color-mix(in srgb,var(--js-accent) 14%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--js-accent) 70%,transparent)}
.json-artboard-content [contenteditable]:empty::before{content:attr(data-ph);opacity:.5;pointer-events:none}
.json-artboard-content .js-edit-sec:hover{border-color:color-mix(in srgb,var(--js-accent) 60%,var(--js-border))}
.json-artboard-content .js-el{position:relative;border-radius:8px}
.json-artboard-content .js-el.js-drop-before::before,.json-artboard-content .js-el.js-drop-after::after,.json-artboard-content .js-sec.js-drop-before::before,.json-artboard-content .js-sec.js-drop-after::after{content:'';position:absolute;left:0;right:0;height:3px;border-radius:3px;background:var(--js-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--js-accent) 30%,transparent);z-index:7;pointer-events:none}
.json-artboard-content .js-drop-before::before{top:-3px}
.json-artboard-content .js-drop-after::after{bottom:-3px}
.json-artboard-content .js-dragging{opacity:.4}
.json-artboard-content .js-drop-line{position:relative;height:0;margin:0;pointer-events:none;z-index:9}
.json-artboard-content .js-drop-line::before{content:'';position:absolute;left:0;right:0;top:-9px;height:4px;border-radius:4px;background:var(--js-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--js-accent) 35%,transparent),0 0 14px 4px color-mix(in srgb,var(--js-accent) 75%,transparent);animation:jsDropGlow 1s ease-in-out infinite alternate}
@keyframes jsDropGlow{from{opacity:.65}to{opacity:1}}
.json-artboard-content tr.js-drop-before td{box-shadow:inset 0 3px 0 var(--js-accent)}
.json-artboard-content tr.js-drop-after td{box-shadow:inset 0 -3px 0 var(--js-accent)}
.json-artboard-content .js-grip{display:inline-flex;align-items:center;justify-content:center;width:24px;height:28px;border-radius:7px;color:#94a3b8;cursor:grab;user-select:none;font-size:15px;letter-spacing:-2px;line-height:1;touch-action:none}
.json-artboard-content .js-grip:hover{background:#1e293b;color:#fff}
.json-artboard-content .js-grip:active{cursor:grabbing}
.json-artboard-content .js-tools,.json-artboard-content .js-el-tools{position:absolute;z-index:5;display:flex;align-items:center;gap:2px;padding:3px;border-radius:10px;background:#0b1220;border:1px solid #334155;box-shadow:0 6px 18px rgba(0,0,0,.35);opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity .12s,transform .12s;color-scheme:dark}
.json-artboard-content .js-tools{top:-12px;right:12px}
.json-artboard-content .js-el-tools{top:-14px;right:4px;padding:2px}
.json-artboard-content .js-sec:hover>.js-tools,.json-artboard-content .js-sec:focus-within>.js-tools,.json-artboard-content .js-tools.open,.json-artboard-content .js-el:hover>.js-el-tools,.json-artboard-content .js-el:focus-within>.js-el-tools{opacity:1;pointer-events:auto;transform:none}
.json-artboard-content .js-el:hover>.js-el-tools{z-index:6}
.json-artboard-content .js-row-ctl{position:sticky;right:0;width:1%;min-width:0!important;white-space:nowrap;padding:4px 6px!important;background:var(--js-surface)!important;border-top:1px solid var(--js-border)}
.json-artboard-content .js-row-ctl .js-el-tools{position:static;opacity:.0;pointer-events:none;transform:none;box-shadow:none}
.json-artboard-content tr:hover .js-row-ctl .js-el-tools,.json-artboard-content tr:focus-within .js-row-ctl .js-el-tools{opacity:1;pointer-events:auto}
@media (hover:none){.json-artboard-content .js-tools{opacity:1;pointer-events:auto;transform:none;top:6px;right:6px}.json-artboard-content .js-sec{padding-top:36px}.json-artboard-content .js-el-tools{opacity:1;pointer-events:auto;transform:none;position:static;margin:4px 0;width:max-content;max-width:100%}.json-artboard-content .js-row-ctl .js-el-tools{opacity:1;pointer-events:auto}}
.json-artboard-content .js-tools button,.json-artboard-content .js-el-tools button{min-width:26px;height:26px;border:0;border-radius:7px;background:transparent;color:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;cursor:pointer;padding:0 4px;gap:3px}
.json-artboard-content .js-tools button:hover:not(:disabled),.json-artboard-content .js-el-tools button:hover:not(:disabled){background:#1e293b;color:#fff}
.json-artboard-content .js-tools button:disabled,.json-artboard-content .js-el-tools button:disabled{opacity:.35;cursor:not-allowed}
.json-artboard-content .js-tools button.danger:hover:not(:disabled),.json-artboard-content .js-el-tools button.danger:hover:not(:disabled){background:#7f1d1d}
.json-artboard-content .js-menu-wrap{position:relative;display:inline-flex}
.json-artboard-content .js-menu{position:absolute;top:34px;right:0;min-width:190px;background:#0b1220;border:1px solid #334155;border-radius:10px;padding:4px;box-shadow:0 10px 26px rgba(0,0,0,.45);z-index:8}
.json-artboard-content .js-menu button{width:100%;height:auto;justify-content:flex-start;padding:7px 10px;font-size:13px;font-weight:600;gap:8px}
.json-artboard-content .js-mini{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;opacity:0;transition:opacity .12s}
.json-artboard-content .js-sec:hover .js-mini,.json-artboard-content .js-sec:focus-within .js-mini{opacity:1}
@media (hover:none){.json-artboard-content .js-mini{opacity:1}}
.json-artboard-content .js-mini button{border:1px dashed color-mix(in srgb,var(--js-accent) 55%,transparent);background:transparent;color:var(--js-accent);border-radius:999px;font-size:12px;font-weight:600;padding:2px 10px;cursor:pointer}
.json-artboard-content .js-mini button:hover{background:color-mix(in srgb,var(--js-accent) 14%,transparent)}
.json-artboard-content .js-empty{border:1px dashed var(--js-border);border-radius:12px;padding:28px;text-align:center}
.json-artboard-content .js-empty button{margin-top:8px;border:1px solid var(--js-accent);background:transparent;color:var(--js-accent);border-radius:999px;padding:5px 16px;font-weight:600;cursor:pointer}
@media (max-width:767.98px){.json-artboard-content .js-split{grid-template-columns:minmax(0,1fr)}.json-artboard-content .js-split.js-split-right .js-img{order:0}}
@media (max-width:575.98px){.json-artboard-content{padding:12px;border-radius:10px}.json-artboard-content .js-sec{padding:14px 14px}.json-artboard-content .js-table th,.json-artboard-content .js-table td{min-width:120px;padding:8px 10px}}
/* PDF / print: full-width tables, nothing clipped */
@media print{.json-artboard-content .js-yt{display:none!important}.json-artboard-content .js-yt-link{display:none!important}.json-artboard-content .js-yt-print{display:block!important;margin-top:10px;font-size:.92em;overflow-wrap:anywhere}.json-artboard-content .js-media-ctl{display:none!important}.json-artboard-content .js-img{break-inside:avoid}
.json-artboard-content{max-height:none!important;overflow:visible!important;border-radius:0}.json-artboard-content .js-table-scroll,.json-artboard-content .js-table-wrap{overflow:visible!important;border-radius:0}.json-artboard-content .js-table{width:100%!important;table-layout:auto!important}.json-artboard-content .js-table th,.json-artboard-content .js-table td{min-width:0!important}.json-artboard-content .js-table tr{break-inside:avoid;page-break-inside:avoid}.json-artboard-content .js-sec{break-inside:avoid-page}.json-artboard-content .js-tools,.json-artboard-content .js-el-tools,.json-artboard-content .js-mini,.json-artboard-content .js-note-btn,.json-artboard-content .js-row-ctl{display:none!important}}
.pdf-export .json-artboard-content{max-height:none!important;overflow:visible!important}
.pdf-export .json-artboard-content .js-note-btn,.pdf-export .json-artboard-content .js-media-ctl,.pdf-export .json-artboard-content .js-yt,.pdf-export .json-artboard-content .js-yt-link{display:none!important}
.pdf-export .json-artboard-content .js-yt-print{display:block!important;margin-top:10px;font-size:.92em;overflow-wrap:anywhere}
.pdf-export .json-artboard-content .js-table-scroll,.pdf-export .json-artboard-content .js-table-wrap{overflow:visible!important}
.pdf-export .json-artboard-content .js-table{width:100%!important;table-layout:auto!important}
.pdf-export .json-artboard-content .js-table th,.pdf-export .json-artboard-content .js-table td{min-width:0!important}
.pdf-export .json-artboard-content .js-table tr{break-inside:avoid;page-break-inside:avoid}
`
}
