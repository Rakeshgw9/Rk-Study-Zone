import { escapeHtml, jsonError } from './id'
import { hasMarkup, sanitizeHtml } from './richText'

export const SAMPLE_LESSON = {
  title: 'Meaning and Definition of Physical Education',
  summary: 'Physical Education is a systematic process of physical, mental and social development through planned activities.',
  points: [
    { id: 1, text: 'Meaning of Physical Education' },
    { id: 2, text: 'Definitions by various experts' },
    { id: 3, text: 'Nature and scope of Physical Education' },
  ],
  sections: [
    {
      heading: '1. Meaning of Physical Education',
      text: 'Physical Education is a **systematic process** of physical, mental and social development through planned activities. It is not merely physical exercise, but a broader educational approach that helps in the ==all-round development== of an individual.',
      takeaway: 'Physical Education aims to develop a healthy, active, disciplined and socially responsible individual.',
    },
    {
      heading: '2. Definitions by Various Experts',
      table: {
        columns: ['Expert', 'Definition'],
        rows: [
          ['J. B. Nash', '“Physical Education is that phase of general education which deals with large muscle activities.”'],
          ['Clarke H. Harrison', '“Physical Education is an education through physical activities for the development of total personality.”'],
          ['C. C. Cowell', '“Physical Education is the sum of those experiences which come to the individual through movement.”'],
        ],
      },
    },
  ],
}

export const JSON_HELP = `{
  "type": "lesson",
  "title": "Lesson title",
  "summary": "Short intro (supports **bold**, ==highlight==, \`code\`, <b>HTML tags</b>)",
  "hero": {"label": "Concept of PE", "heading": "Big heading", "image": "https://…"},
  "points": ["Point 1", {"id": 2, "text": "Point 2"}],
  "sections": [{
    "heading": "Section heading",
    "text": "Paragraph" | "paragraphs": ["p1", "p2"],
    "list": ["item", "item"],
    "image": "https://..." | {"src": "", "alt": "", "caption": ""},
    "takeaway": "Key takeaway box",
    "note": "Info box",
    "example": "Example text" | {"title": "Example", "text": "…"},
    "formula": "E = mc^2" | ["a^2+b^2=c^2"],
    "quote": "Quote text",
    "table": {"columns": ["A","B"], "rows": [["1","2"]]},
    "mcq": [{"question": "?", "options": ["A","B"], "answer": 0, "explanation": ""}],
    "html": "<b>raw html</b>"
  }],
  "keyTakeaway": "Final takeaway"
}`

export const JSON_TEMPLATES = [
  { id: 'lesson', label: 'Lesson (default)', json: SAMPLE_LESSON },
  { id: 'notes', label: 'Study notes with key points', json: { title: 'Study Notes', summary: 'Quick revision notes for this chapter.', points: ['Remember the definition', 'Know the three main aims', 'Learn the key terms'], sections: [{ heading: 'Definition', text: 'Physical Education is education **through** physical activities.', note: 'Learn this definition word for word.' }, { heading: 'Aims', list: ['Physical development', 'Mental development', 'Social development'], takeaway: 'All-round development is the main aim.' }], keyTakeaway: 'Revise these notes before the test.' } },
  { id: 'image', label: 'Image with text', json: { title: 'Image and Text', summary: 'A section with an illustration beside the explanation.', sections: [{ heading: 'Illustrated section', text: 'Add your explanation here. The image appears next to the text on wide screens.', image: { src: 'https://placehold.co/600x400/png', alt: 'Illustration', caption: 'Figure 1' } }] } },
  { id: 'table', label: 'Advanced table', json: { title: 'Comparison Table', sections: [{ heading: 'Types of Physical Activities', table: { columns: ['Type', 'Examples', 'Benefit'], rows: [['Aerobic', 'Running, Cycling', 'Heart and lung health'], ['Strength', 'Push-ups, Squats', 'Muscle strength'], ['Flexibility', 'Yoga, Stretching', 'Joint mobility']] } }] } },
  { id: 'formula', label: 'Formulas & examples', json: { title: 'Formulas', summary: 'Formulas are written in LaTeX and rendered with KaTeX.', sections: [{ heading: 'Body Mass Index', text: 'BMI measures body weight relative to height.', formula: 'BMI = \\frac{\\text{weight (kg)}}{\\text{height (m)}^2}', example: { title: 'Example', text: 'A student weighing 60 kg with a height of 1.5 m has BMI = 60 / 2.25 ≈ 26.7.' } }] } },
  { id: 'quiz', label: 'Lesson with MCQ', json: { title: 'Check Your Understanding', sections: [{ heading: 'Quick quiz', text: 'Choose the correct answer. Click an option to see the result.', mcq: [{ question: 'The main aim of Physical Education is…', options: ['Winning medals', 'All-round development', 'Building muscles', 'Recreation only'], answer: 1, explanation: 'It aims at the all-round development of personality.' }] }] } },
]

export const STYLE_PRESETS = [
  { id: 'default', label: 'Default' },
  { id: 'card', label: 'Card' },
  { id: 'bordered', label: 'Bordered' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'notebook', label: 'Notebook' },
]

export const DEFAULT_JSON_STYLE = {
  preset: 'default',
  titleFont: 'Inter', titleSize: 24, textFont: 'Inter', textSize: 16,
  titleColor: '#0f172a', textColor: '#334155', accent: '#2563eb', headingBg: '#3730a3',
  background: '#ffffff', padding: 20, margin: 0, radius: 14, borderColor: '#dbe4f3', borderWidth: 1,
  listStyle: 'numbered', showIcon: true, icon: 'bi-book',
}

/** Parse + validate. Returns { ok, data, errors[], warnings[] } */
export function validateLessonJson(text) {
  const errors = []; const warnings = []
  if (!text || !text.trim()) return { ok: false, data: null, errors: [{ message: 'JSON is empty. Paste content or load the sample.' }], warnings }
  let data
  try { data = JSON.parse(text) } catch (e) { return { ok: false, data: null, errors: [jsonError(text, e)], warnings } }
  if (Array.isArray(data)) data = { sections: data }
  if (typeof data !== 'object' || data === null) return { ok: false, data: null, errors: [{ message: 'Top level must be an object { } or an array [ ].' }], warnings }
  const str = (v, path) => { if (v !== undefined && typeof v !== 'string') errors.push({ message: `"${path}" must be text (string).` }) }
  str(data.title, 'title'); str(data.summary, 'summary'); str(data.keyTakeaway, 'keyTakeaway')
  if (!data.title) warnings.push('No "title" found — the lesson will show without a heading.')
  if (data.points !== undefined) {
    if (!Array.isArray(data.points)) errors.push({ message: '"points" must be an array.' })
    else data.points.forEach((p, i) => { if (typeof p !== 'string' && !(p && typeof p.text === 'string')) errors.push({ message: `"points[${i}]" must be text or an object with "text".` }) })
  }
  if (data.sections !== undefined) {
    if (!Array.isArray(data.sections)) errors.push({ message: '"sections" must be an array.' })
    else data.sections.forEach((s, i) => {
      if (!s || typeof s !== 'object') { errors.push({ message: `"sections[${i}]" must be an object.` }); return }
      ;['heading', 'text', 'takeaway', 'note', 'quote', 'html'].forEach((k) => str(s[k], `sections[${i}].${k}`))
      if (s.mcq !== undefined) { if (!Array.isArray(s.mcq)) errors.push({ message: `"sections[${i}].mcq" must be an array of questions.` }); else s.mcq.forEach((m, k) => { if (!m || typeof m.question !== 'string' || !Array.isArray(m.options)) errors.push({ message: `"sections[${i}].mcq[${k}]" needs "question" (text) and "options" (array).` }) }) }
      if (s.paragraphs !== undefined && !Array.isArray(s.paragraphs)) errors.push({ message: `"sections[${i}].paragraphs" must be an array.` })
      if (s.list !== undefined && !Array.isArray(s.list)) errors.push({ message: `"sections[${i}].list" must be an array.` })
      if (s.table !== undefined) {
        if (!s.table || !Array.isArray(s.table.rows)) errors.push({ message: `"sections[${i}].table.rows" must be an array of rows.` })
        else if (s.table.columns && !Array.isArray(s.table.columns)) errors.push({ message: `"sections[${i}].table.columns" must be an array.` })
      }
      if (s.image !== undefined && typeof s.image !== 'string' && !(s.image && typeof s.image.src === 'string')) errors.push({ message: `"sections[${i}].image" must be a URL or { "src": "..." }.` })
    })
  }
  if (data.hero !== undefined && (typeof data.hero !== 'object' || data.hero === null || Array.isArray(data.hero))) errors.push({ message: '"hero" must be an object like { "heading": "…" }.' })
  if (!data.title && !data.summary && !data.description && !data.points && !data.keyPoints && !data.sections && !data.keyTakeaway && !data.hero) errors.push({ message: 'Nothing to show. Use keys like "title", "summary", "points", "sections".' })
  return { ok: errors.length === 0, data, errors, warnings }
}

export function countLessonMedia(data) {
  if (!data?.sections) return data?.hero?.image ? 1 : 0
  return data.sections.filter((s) => s && s.image).length + (data.hero?.image ? 1 : 0)
}
export const hasFormula = (data) => !!(data?.sections || []).some((s) => s && s.formula)
export const hasLessonMcq = (data) => !!(data?.sections || []).some((s) => s && Array.isArray(s.mcq) && s.mcq.length)
export const DEFAULT_JSON_DISPLAY = { showTitle: true, showDescription: true, numberedSections: false, keyPointsAsList: true }
export const JSON_RENDERERS = [{ value: 'lesson', label: 'Lesson (Default)' }, { value: 'cards', label: 'Section cards' }, { value: 'compact', label: 'Compact notes' }]

const inline = (t = '', allowHtml) => {
  const raw = String(t ?? '')
  let s = allowHtml ? raw : hasMarkup(raw) ? sanitizeHtml(raw) : escapeHtml(raw)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/==(.+?)==/g, '<mark>$1</mark>')
  s = s.replace(/`([^`]+?)`/g, '<code>$1</code>')
  return s.replace(/\n/g, '<br>')
}
const safeUrl = (u = '') => (/^(https?:|data:image\/)/i.test(u) ? escapeHtml(u) : '')
const ansIdx = (a, opts) => { if (typeof a === 'number') return a; const t = String(a ?? '').trim(); if (/^[A-Ha-h]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 65; if (/^\d+$/.test(t)) return Number(t); return opts.findIndex((o) => String(o).trim().toLowerCase() === t.toLowerCase()) }

/** Small script that makes the lesson MCQs clickable (runs inside the sandboxed preview). */
export const LESSON_JS = `document.querySelectorAll('.lsn-mcq').forEach(function(box){var right=Number(box.getAttribute('data-a'));box.querySelectorAll('.lsn-opt').forEach(function(b){b.addEventListener('click',function(){if(box.classList.contains('done'))return;box.classList.add('done');var k=Number(b.getAttribute('data-k'));b.classList.add(k===right?'right':'wrong');var r=box.querySelector('.lsn-opt[data-k="'+right+'"]');if(r)r.classList.add('right');var e=box.querySelector('.lsn-exp');if(e)e.hidden=false})})});`

export function renderLessonHtml(data, style = DEFAULT_JSON_STYLE, opts = {}) {
  if (!data) return ''
  const allow = Boolean(data.allowHtml)
  const dsp = { ...DEFAULT_JSON_DISPLAY, ...(opts.display || {}) }
  const edit = !!opts.editable
  const tpl = ['cards', 'compact'].includes(opts.template) ? opts.template : 'lesson'
  const P = (path) => (edit ? ` data-rk-path="${escapeHtml(path)}"` : '')
  const listTag = style.listStyle === 'bullets' ? 'ul' : 'ol'
  const pt = (p) => (typeof p === 'string' ? p : p?.text || '')
  const title = data.title; const summary = data.summary ?? data.description
  const points = Array.isArray(data.points) ? data.points : Array.isArray(data.keyPoints) ? data.keyPoints : null
  const pointsPath = Array.isArray(data.points) ? 'points' : 'keyPoints'
  let out = `<article class="lsn preset-${escapeHtml(style.preset)} tpl-${tpl}${dsp.numberedSections ? ' numbered-secs' : ''}">`
  if (data.hero && typeof data.hero === 'object') {
    const h = data.hero; const img = typeof h.image === 'string' ? h.image : h.image?.src
    out += `<header class="lsn-hero${safeUrl(img) ? ' with-img' : ''}"><div class="lsn-hero-text">${h.label || h.title ? `<span class="lsn-hero-label">${inline(h.label || h.title, allow)}</span>` : ''}${h.heading ? `<h2 class="lsn-hero-h">${inline(h.heading, allow)}</h2>` : ''}${summary && dsp.showDescription ? `<p class="lsn-summary"${P(data.summary !== undefined ? 'summary' : 'description')}>${inline(summary, allow)}</p>` : ''}</div>${safeUrl(img) ? `<img class="lsn-hero-img" src="${safeUrl(img)}" alt="">` : ''}</header>`
  } else if ((title && dsp.showTitle) || (summary && dsp.showDescription)) {
    out += '<header class="lsn-head">'
    if (style.showIcon && tpl !== 'compact') out += `<div class="lsn-icon"><i class="bi ${escapeHtml(data.icon || style.icon || 'bi-book')}"></i></div>`
    out += '<div class="lsn-head-text">'
    if (title && dsp.showTitle) out += `<h2 class="lsn-title"${P('title')}>${inline(title, allow)}</h2>`
    if (summary && dsp.showDescription) out += `<p class="lsn-summary"${P(data.summary !== undefined ? 'summary' : 'description')}>${inline(summary, allow)}</p>`
    out += '</div></header>'
  }
  if (points && points.length) {
    out += `<div class="lsn-points"><div class="lsn-points-label"><i class="bi bi-bullseye"></i> ${escapeHtml(data.pointsTitle || 'Key Points')}</div>`
    if (dsp.keyPointsAsList) { out += `<${listTag} class="lsn-list ${style.listStyle}">`; points.forEach((p, i) => { out += `<li><span${P(`${pointsPath}.${i}`)}>${inline(pt(p), allow)}</span></li>` }); out += `</${listTag}>` }
    else { out += '<div class="lsn-chips">'; points.forEach((p, i) => { out += `<span class="lsn-chip"${P(`${pointsPath}.${i}`)}>${inline(pt(p), allow)}</span>` }); out += '</div>' }
    out += '</div>'
  }
  ;(data.sections || []).forEach((s, si) => {
    if (!s) return
    const sp = `sections.${si}`
    out += '<section class="lsn-sec">'
    if (s.heading) out += `<h3 class="lsn-h"${P(`${sp}.heading`)}>${inline(s.heading, allow)}</h3>`
    const img = typeof s.image === 'string' ? { src: s.image } : s.image
    const hasImg = img && safeUrl(img.src)
    out += `<div class="lsn-body ${hasImg ? 'with-img' : ''}"><div class="lsn-col">`
    if (s.text) out += `<p${P(`${sp}.text`)}>${inline(s.text, allow)}</p>`
    ;(s.paragraphs || []).forEach((p, i) => { out += `<p${P(`${sp}.paragraphs.${i}`)}>${inline(p, allow)}</p>` })
    if (Array.isArray(s.list) && s.list.length) out += `<${listTag} class="lsn-list ${style.listStyle}">${s.list.map((i, k) => `<li><span${P(`${sp}.list.${k}`)}>${inline(pt(i), allow)}</span></li>`).join('')}</${listTag}>`
    if (s.formula) (Array.isArray(s.formula) ? s.formula : [s.formula]).forEach((f) => { out += `<div class="lsn-formula">$$${escapeHtml(String(f))}$$</div>` })
    if (s.quote) out += `<blockquote class="lsn-quote"${P(`${sp}.quote`)}>${inline(s.quote, allow)}</blockquote>`
    if (s.note) out += `<div class="lsn-note"><i class="bi bi-info-circle"></i><div${P(`${sp}.note`)}>${inline(s.note, allow)}</div></div>`
    if (s.example) { const ex = typeof s.example === 'string' ? { text: s.example } : s.example; out += `<div class="lsn-example"><b class="lsn-ex-h"><i class="bi bi-lightbulb"></i> ${escapeHtml(ex.title || 'Example')}</b><p${P(`${sp}.example${typeof s.example === 'string' ? '' : '.text'}`)}>${inline(ex.text || '', allow)}</p></div>` }
    if (s.takeaway) out += `<div class="lsn-take"><div class="lsn-take-h"><i class="bi bi-bullseye"></i> Key Takeaway</div><p${P(`${sp}.takeaway`)}>${inline(s.takeaway, allow)}</p></div>`
    out += '</div>'
    if (hasImg) out += `<figure class="lsn-fig"><img src="${safeUrl(img.src)}" alt="${escapeHtml(img.alt || '')}" loading="lazy">${img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : ''}</figure>`
    out += '</div>'
    if (s.table && Array.isArray(s.table.rows)) {
      out += '<div class="lsn-table-wrap"><table class="lsn-table">'
      if (s.table.columns) out += `<thead><tr>${s.table.columns.map((c, ci) => `<th${P(`${sp}.table.columns.${ci}`)}>${inline(c, allow)}</th>`).join('')}</tr></thead>`
      out += `<tbody>${s.table.rows.map((r, ri) => `<tr>${(Array.isArray(r) ? r : [r]).map((c, i) => `<td${i === 0 ? ' class="first"' : ''}${Array.isArray(r) ? P(`${sp}.table.rows.${ri}.${i}`) : ''}>${inline(String(c), allow)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    }
    if (Array.isArray(s.mcq)) s.mcq.forEach((m, k) => {
      if (!m || !Array.isArray(m.options)) return
      const a = ansIdx(m.answer, m.options.map(String))
      out += `<div class="lsn-mcq" data-a="${a}"><div class="lsn-mcq-q">${k + 1}. ${inline(m.question, allow)}</div>${m.options.map((o, oi) => `<button type="button" class="lsn-opt" data-k="${oi}"><span>${'ABCDEFGH'[oi] || oi + 1}</span>${inline(String(o), allow)}</button>`).join('')}${m.explanation ? `<div class="lsn-exp" hidden><b>Solution:</b> ${inline(m.explanation, allow)}</div>` : ''}</div>`
    })
    if (s.html) out += `<div class="lsn-html">${s.html}</div>`
    out += '</section>'
  })
  if (data.keyTakeaway) out += `<div class="lsn-take final"><div class="lsn-take-h"><i class="bi bi-stars"></i> Key Takeaway</div><p${P('keyTakeaway')}>${inline(data.keyTakeaway, allow)}</p></div>`
  out += '</article>'
  return out
}

export function lessonCss(st = DEFAULT_JSON_STYLE) {
  const s = { ...DEFAULT_JSON_STYLE, ...st }
  return `
:root{--t:${s.titleColor};--x:${s.textColor};--a:${s.accent};--hb:${s.headingBg};--bg:${s.background};--r:${s.radius}px;--bc:${s.borderColor}}
body{color:var(--x);font-family:'${s.textFont}','Noto Sans Oriya',Inter,sans-serif;font-size:${s.textSize}px}
.lsn{background:var(--bg);padding:${s.padding}px;margin:${s.margin}px;border-radius:var(--r)}
.lsn-head{display:flex;gap:16px;align-items:center;margin-bottom:16px}
.lsn-icon{width:56px;height:56px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:26px;color:var(--a);background:color-mix(in srgb,var(--a) 14%,#fff);border:1px solid color-mix(in srgb,var(--a) 25%,#fff)}
.lsn-head-text{border-left:2px solid var(--bc);padding-left:16px}
.lsn-title{font-family:'${s.titleFont}',Inter,sans-serif;font-size:${s.titleSize}px;color:var(--t);margin:0 0 4px;font-weight:700;line-height:1.25}
.lsn-summary{margin:0;color:var(--x)}
.lsn-points{max-width:560px;margin:8px auto 18px;background:color-mix(in srgb,var(--a) 6%,#fff);border:1px solid color-mix(in srgb,var(--a) 20%,#fff);border-radius:12px;overflow:hidden}
.lsn-points-label{background:color-mix(in srgb,var(--a) 16%,#fff);color:var(--hb);font-weight:600;font-size:.9em;padding:6px 14px;display:flex;gap:6px;align-items:center}
.lsn-list{margin:0;padding:10px 14px 12px 14px;list-style:none;counter-reset:n}
.lsn-list li{counter-increment:n;display:flex;gap:10px;align-items:flex-start;padding:4px 0;font-weight:500;color:var(--t)}
.lsn-list.numbered li::before{content:counter(n);flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--a);color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:2px}
.lsn-list.bullets li::before{content:'';flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--a);margin-top:9px}
.lsn-list.check li::before{content:'✓';flex-shrink:0;width:22px;height:22px;border-radius:6px;background:#16a34a;color:#fff;font-size:13px;display:inline-flex;align-items:center;justify-content:center;margin-top:2px}
.lsn-sec{margin:18px 0}
.lsn-h{font-family:'${s.titleFont}',Inter,sans-serif;font-size:${Math.round(s.titleSize * 0.82)}px;color:#fff;background:linear-gradient(90deg,var(--hb),color-mix(in srgb,var(--hb) 70%,#6366f1));padding:8px 16px;border-radius:8px;margin:0 0 14px;font-weight:600}
.lsn-body.with-img{display:grid;grid-template-columns:1.45fr 1fr;gap:18px;align-items:start}
.lsn-body p{margin:0 0 12px}
.lsn-fig{margin:0}.lsn-fig img{width:100%;border-radius:10px;display:block;object-fit:cover}
.lsn-fig figcaption{font-size:.8em;color:#64748b;margin-top:6px;text-align:center}
strong{color:var(--a);font-weight:600} mark{background:color-mix(in srgb,var(--a) 16%,#fff);color:var(--t);padding:0 3px;border-radius:3px}
code{background:#eef2f7;padding:1px 5px;border-radius:4px;font-size:.9em}
.lsn-take{background:color-mix(in srgb,var(--a) 9%,#fff);border:1px solid color-mix(in srgb,var(--a) 25%,#fff);border-radius:10px;padding:12px 16px;margin-top:10px}
.lsn-take-h{font-weight:700;color:var(--hb);display:flex;gap:8px;align-items:center;margin-bottom:4px}
.lsn-take p{margin:0;font-size:.95em}
.lsn-note{display:flex;gap:10px;background:#fff8e6;border:1px solid #f6d48a;border-radius:10px;padding:10px 14px;margin:10px 0;color:#6b4a00}
.lsn-quote{border-left:4px solid var(--a);margin:10px 0;padding:6px 14px;color:var(--t);font-style:italic;background:#f8fafc;border-radius:0 8px 8px 0}
.lsn-table-wrap{overflow-x:auto;border:1px solid var(--bc);border-radius:10px}
.lsn-table{width:100%;border-collapse:collapse;font-size:.95em}
.lsn-table th{background:color-mix(in srgb,var(--a) 10%,#fff);color:var(--t);text-align:left;padding:10px 14px;font-weight:600}
.lsn-table td{padding:10px 14px;border-top:1px solid var(--bc);vertical-align:top}
.lsn-table td.first{font-weight:600;color:var(--t);white-space:nowrap}
.preset-card .lsn{box-shadow:0 10px 30px rgba(15,23,42,.08)}
.lsn.preset-card{box-shadow:0 8px 26px rgba(15,23,42,.10);border:1px solid var(--bc)}
.lsn.preset-bordered{border:${Math.max(1, s.borderWidth)}px solid var(--bc)}
.lsn.preset-minimal .lsn-h{background:none;color:var(--t);padding:0 0 6px;border-bottom:2px solid var(--a);border-radius:0}
.lsn.preset-minimal .lsn-icon{display:none}.lsn.preset-minimal .lsn-head-text{border:0;padding:0}
.lsn.preset-highlight{background:linear-gradient(180deg,color-mix(in srgb,var(--a) 7%,#fff),var(--bg));border:1px solid color-mix(in srgb,var(--a) 30%,#fff)}
.lsn.preset-notebook{background:repeating-linear-gradient(#fffdf6,#fffdf6 27px,#e6ecf7 28px);border-left:4px solid #f87171}
.lsn-hero{display:flex;gap:18px;align-items:center;justify-content:space-between;background:linear-gradient(120deg,color-mix(in srgb,var(--a) 10%,#fff),color-mix(in srgb,var(--hb) 8%,#fff));border:1px solid color-mix(in srgb,var(--a) 25%,#fff);border-radius:16px;padding:20px 24px;margin-bottom:16px}
.lsn-hero-label{display:inline-block;background:var(--hb);color:#fff;font-size:.78em;font-weight:600;padding:3px 12px;border-radius:999px;margin-bottom:8px}
.lsn-hero-h{font-family:'${s.titleFont}',Inter,sans-serif;font-size:${Math.round(s.titleSize * 1.5)}px;line-height:1.15;margin:0 0 8px;color:var(--hb);font-weight:800}
.lsn-hero-img{max-width:38%;max-height:180px;object-fit:contain;border-radius:12px}
.lsn-chips{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px 12px}.lsn-chip{background:var(--a);color:#fff;border-radius:999px;padding:3px 12px;font-size:.9em;font-weight:500}
.lsn-formula{background:#f8fafc;border:1px dashed var(--bc);border-radius:10px;padding:10px 14px;margin:10px 0;text-align:center;overflow-x:auto;font-family:'Cambria Math',Georgia,serif}
.lsn-example{background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:10px 14px;margin:10px 0;color:#78350f}.lsn-ex-h{display:flex;gap:6px;align-items:center;margin-bottom:2px}.lsn-example p{margin:0}
.lsn-mcq{border:1px solid var(--bc);border-radius:12px;padding:12px 14px;margin:12px 0;background:#fff}.lsn-mcq-q{font-weight:600;color:var(--t);margin-bottom:8px}
.lsn-opt{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid var(--bc);background:#f8fafc;border-radius:8px;padding:7px 12px;margin:5px 0;cursor:pointer;color:var(--x);font:inherit}
.lsn-opt span{width:22px;height:22px;border-radius:50%;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.lsn-mcq:not(.done) .lsn-opt:hover{border-color:var(--a)}.lsn-opt.right{background:#dcfce7;border-color:#16a34a}.lsn-opt.wrong{background:#fee2e2;border-color:#dc2626}.lsn-exp{margin-top:8px;background:#eff6ff;border-radius:8px;padding:8px 12px;font-size:.95em}
.numbered-secs{counter-reset:sec}.numbered-secs .lsn-h::before{counter-increment:sec;content:counter(sec) '. '}
.lsn.tpl-cards .lsn-sec{background:#fff;border:1px solid var(--bc);border-radius:14px;padding:14px 16px;box-shadow:0 6px 18px rgba(15,23,42,.06)}.lsn.tpl-cards .lsn-h{margin:-14px -16px 14px;border-radius:13px 13px 0 0}
.lsn.tpl-compact{padding:${Math.min(s.padding, 12)}px}.lsn.tpl-compact .lsn-sec{margin:10px 0}.lsn.tpl-compact .lsn-h{background:none;color:var(--t);padding:0 0 4px;border-bottom:2px solid var(--a);border-radius:0;font-size:1.05em}.lsn.tpl-compact .lsn-points{max-width:none}
[data-rk-path]{outline-offset:2px}
@media (max-width:640px){.lsn-hero{flex-direction:column;align-items:flex-start}.lsn-hero-img{max-width:100%}.lsn-body.with-img{grid-template-columns:1fr}.lsn-head{align-items:flex-start}.lsn-icon{width:44px;height:44px;font-size:20px}.lsn{padding:${Math.min(s.padding, 14)}px}}
`
}
