/**
 * RK Study Zone — "Save PDF" for a chapter (A4, opens the browser print dialog → Save as PDF)
 *
 * What changed (fixes blank pages / missing content):
 *  - Every block type is read from its REAL data fields (heading, body, items, example …).
 *  - Custom HTML / JSON lessons are copied exactly as the student sees them (including what their scripts built),
 *    isolated in a Shadow DOM so their CSS cannot leak into — or be broken by — the page.
 *  - "100vh" heights, fixed / sticky elements and animations are neutralised, big blocks are allowed to break across
 *    pages (no more half-empty pages), small cards are kept together.
 */
import { frameProps } from './blockRender'
import { findSectionGroup } from './sectionFinder'
import { normalizeTable } from './table'

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** Remove anything that could run script from rich text before it is put into the print page */
export function cleanHtml(html = '') {
  return String(html)
    .replace(/<\s*(script|iframe|object|embed|noscript)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .replace(/<button[\s\S]*?<\/button>/gi, '')
    .trim()
}
const hasText = (html = '') => /<img|<table|<video/i.test(html) || String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== ''

/** Rewrites a lesson's CSS so it works inside a Shadow DOM wrapper and prints on paper */
export function shadowCss(css = '') {
  return String(css)
    .replace(/@import[^;]+;/g, '')
    .replace(/\bhtml\s+body\b/gi, '.rk-body')
    .replace(/(^|[\s,{}>+~(])(html|body)(?![\w-])/gi, '$1.rk-body')
    .replace(/:root/g, ':host')
    .replace(/\b(min-height|height|max-height)\s*:\s*[\d.]+(vh|dvh|svh|lvh)\b/gi, '$1:auto')
    .replace(/position\s*:\s*(fixed|sticky)/gi, 'position:relative')
}
const fontFaces = (css = '') => (String(css).match(/@font-face\s*{[^}]*}/gi) || []).join('\n')

const PRINT_SHADOW_CSS = `
:host{display:block}
.rk-body{display:block;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;margin:0}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;animation-fill-mode:forwards!important;transition:none!important}
img,svg,video{max-width:100%;height:auto}
img,figure,tr,pre,blockquote,li{break-inside:avoid;page-break-inside:avoid}
h1,h2,h3,h4,h5{break-after:avoid;page-break-after:avoid}
`

const READY = ['heading-paragraph', 'heading-image', 'heading-list', 'heading-example', 'multi-heading']
const h = (tag, cls, inner) => (inner ? `<${tag} class="${cls}">${inner}</${tag}>` : '')

function readyBlockHtml(block) {
  const d = block.data || {}
  const t = block.template || block.type
  const heading = hasText(d.heading) ? `<h2 class="pdf-block-heading">${cleanHtml(d.heading).replace(/<\/?p[^>]*>/gi, '')}</h2>` : ''
  const body = (x) => (hasText(x) ? `<div class="pdf-paragraph">${cleanHtml(x)}</div>` : '')
  let inner = ''
  if (t === 'multi-heading') {
    inner = (d.sections || [])
      .map((x) => {
        const lvl = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(x.level) ? x.level : 'h2'
        return `<section class="pdf-subsection">${hasText(x.heading) ? `<${lvl} class="pdf-sub-h">${cleanHtml(x.heading).replace(/<\/?p[^>]*>/gi, '')}</${lvl}>` : ''}${body(x.body)}</section>`
      })
      .join('')
  } else {
    inner = heading
    if (t === 'heading-image') {
      if (d.image) inner += `<figure class="pdf-image-wrap"><img src="${esc(d.image)}" alt="${esc(d.imageAlt || '')}" class="pdf-img">${hasText(d.caption) ? `<figcaption class="pdf-caption">${cleanHtml(d.caption)}</figcaption>` : ''}</figure>`
      inner += body(d.body)
    } else if (t === 'heading-list') {
      inner += body(d.body)
      const items = (d.items || []).filter(hasText)
      if (items.length) {
        const tag = d.listStyle === 'number' ? 'ol' : 'ul'
        inner += `<${tag} class="pdf-list">${items.map((i) => `<li>${cleanHtml(i)}</li>`).join('')}</${tag}>`
      }
    } else if (t === 'heading-example') {
      inner += body(d.body)
      if (hasText(d.exampleText)) inner += `<div class="pdf-example-box"><div class="pdf-example-badge">${cleanHtml(d.exampleTitle || 'Example').replace(/<[^>]*>/g, '')}</div><div>${cleanHtml(d.exampleText)}</div></div>`
    } else inner += body(d.body)
  }
  return inner ? `<div class="pdf-block pdf-ready-block">${inner}</div>` : ''
}

function tableHtml(block) {
  const d = block.data || {}
  const t = normalizeTable(d)
  const o = t.options || {}
  const rows = t.rows || []
  if (!rows.length) return ''
  const cell = (c, tag) => (c.cov ? '' : `<${tag}${c.cs > 1 ? ` colspan="${c.cs}"` : ''}${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${c.st?.align ? ` style="text-align:${esc(c.st.align)}"` : ''}>${cleanHtml(c.t || '')}</${tag}>`)
  const head = o.header ? rows[0] : null
  const body = o.header ? rows.slice(1) : rows
  return `<div class="pdf-block pdf-table-block">
    ${o.showTitle !== false && d.title ? `<h3 class="pdf-table-title">${esc(d.title)}</h3>` : ''}
    ${d.caption ? `<p class="pdf-table-desc">${esc(d.caption)}</p>` : ''}
    <table class="pdf-table">${d.tableCaption ? `<caption>${esc(d.tableCaption)}</caption>` : ''}
      ${head ? `<thead><tr>${head.cells.map((c) => cell(c, 'th')).join('')}</tr></thead>` : ''}
      <tbody>${body.map((r) => `<tr>${r.cells.map((c) => cell(c, 'td')).join('')}</tr>`).join('')}</tbody>
    </table></div>`
}

/** Collects the pieces of a custom HTML / JSON block: from the live snapshot if we have one, otherwise from its data */
function frameParts(block, snap) {
  if (snap) return { css: (snap.styles || []).join('\n'), links: snap.links || [], body: snap.body || '', bodyClass: snap.bodyClass || '', bodyStyle: snap.bodyStyle || '' }
  const fp = frameProps(block)
  if (!fp) return null
  return { css: fp.css || '', links: (fp.packages || []).filter((p) => p.type === 'css').map((p) => p.url), body: fp.html || '', bodyClass: '', bodyStyle: '' }
}

const PAGE_CSS = `
@page{size:A4 portrait;margin:14mm 13mm 16mm 13mm;@bottom-right{content:"Page " counter(page);font-size:9pt;color:#64748b}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#fff}
body{font-family:Inter,"Noto Sans Oriya",-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1e293b;line-height:1.55;font-size:11pt}
.pdf-header{border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.pdf-brand{font-size:14pt;font-weight:800;color:#1e3a8a}.pdf-meta{font-size:9pt;color:#64748b;text-align:right}
.pdf-chapter-banner{background:#f8fafc;border-left:4px solid #2563eb;padding:12px 16px;margin-bottom:18px;border-radius:4px;break-inside:avoid}
.pdf-chapter-banner h1{font-size:20pt;font-weight:700;color:#0f172a;margin:0 0 4px}.pdf-chapter-banner p{color:#475569;font-size:10.5pt;margin:0}
.pdf-block{margin:0 0 16px}
.pdf-block-heading{font-size:14pt;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin:0 0 9px;break-after:avoid}
.pdf-sub-h{color:#1e3a8a;margin:12px 0 6px;break-after:avoid}
.pdf-paragraph{font-size:11pt;color:#334155;margin-bottom:10px}.pdf-paragraph p{margin:0 0 8px}
.pdf-image-wrap{text-align:center;margin:10px 0;break-inside:avoid}
.pdf-img{max-width:92%;max-height:340px;object-fit:contain;border-radius:6px;border:1px solid #cbd5e1}
.pdf-caption{font-size:9pt;color:#64748b;font-style:italic;margin-top:4px}
.pdf-list{margin:6px 0 12px 22px;padding:0;color:#334155}.pdf-list li{margin-bottom:4px;break-inside:avoid}
.pdf-example-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 13px;margin:10px 0;break-inside:avoid}
.pdf-example-badge{display:inline-block;font-size:8.5pt;font-weight:700;text-transform:uppercase;background:#2563eb;color:#fff;padding:2px 8px;border-radius:4px;margin-bottom:5px}
.pdf-table-title{font-size:13pt;margin:0 0 4px;color:#0f172a}.pdf-table-desc{font-size:10pt;color:#475569;margin:0 0 6px}
.pdf-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10pt}.pdf-table caption{caption-side:bottom;font-size:9pt;color:#64748b;padding-top:4px}
.pdf-table th{background:#1e40af;color:#fff;font-weight:600;padding:7px 9px;border:1px solid #1e3a8a;text-align:left}
.pdf-table td{padding:7px 9px;border:1px solid #cbd5e1;color:#1e293b;vertical-align:top}.pdf-table tr{break-inside:avoid}.pdf-table tbody tr:nth-child(even) td{background:#f8fafc}
.pdf-media-note{border:1px dashed #94a3b8;border-radius:6px;padding:9px 12px;color:#475569;font-size:10pt;break-inside:avoid}
.pdf-slides{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pdf-slides figure{margin:0;break-inside:avoid}.pdf-slides img{width:100%;border-radius:6px;border:1px solid #cbd5e1}
.pdf-frame{display:block;margin:0 0 14px}
.pdf-footer{margin-top:24px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8.5pt;color:#94a3b8;display:flex;justify-content:space-between}
`

/** Builds the print document. Returns { html, shadows } — shadows are attached to .pdf-frame hosts after load. */
export function buildChapterPrint({ chapter, unit, portal, snaps = {} }) {
  const portalName = portal?.name || 'RK Study Zone'
  const shadows = []
  const fontCss = []
  const links = new Set()
  const parts = (chapter.blocks || [])
    .filter((b) => b.visible !== false && b.type !== 'mcq')
    .map((block) => {
      if (READY.includes(block.type)) return readyBlockHtml(block)
      if (block.type === 'table') return tableHtml(block)
      if (block.type === 'youtube') return block.data?.url ? `<div class="pdf-block pdf-media-note"><b>Video:</b> ${esc(block.data.heading || block.title || 'YouTube video')} — <span>${esc(block.data.url)}</span></div>` : ''
      if (block.type === 'slider') {
        const slides = (block.data?.slides || []).filter((s) => s.src)
        return slides.length ? `<div class="pdf-block">${h('h2', 'pdf-block-heading', esc(block.data.heading || ''))}<div class="pdf-slides">${slides.map((s) => `<figure><img src="${esc(s.src)}" alt="">${s.caption || s.title ? `<figcaption class="pdf-caption">${esc(s.caption || s.title)}</figcaption>` : ''}</figure>`).join('')}</div></div>` : ''
      }
      if (block.type === 'html' || block.type === 'json') {
        const fp = frameParts(block, snaps[block.id])
        if (!fp || !fp.body) return ''
        fp.links.forEach((u) => links.add(u))
        fontCss.push(fontFaces(fp.css))
        shadows.push(fp)
        return `<div class="pdf-frame" data-shadow="${shadows.length - 1}"></div>`
      }
      return ''
    })
    .filter(Boolean)

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(chapter.title || 'Chapter')} — ${esc(portalName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Oriya:wght@400;600&display=swap" rel="stylesheet">
${[...links].map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('\n')}
<style>${PAGE_CSS}\n${fontCss.join('\n')}</style></head><body>
<div class="pdf-header"><div class="pdf-brand">${esc(portalName)}</div><div class="pdf-meta">${unit?.title ? `<div>Unit: ${esc(unit.title)}</div>` : ''}<div>Downloaded from RK Study Zone</div></div></div>
<div class="pdf-chapter-banner"><h1>${esc(chapter.title || 'Chapter')}</h1>${chapter.description ? `<p>${esc(chapter.description)}</p>` : ''}</div>
<div class="pdf-content">${parts.join('\n') || '<p>No lesson content is available in this chapter.</p>'}</div>
<div class="pdf-footer"><span>${esc(portalName)} — Study Materials</span><span>Print / Save as PDF</span></div>
</body></html>`
  return { html, shadows }
}

/** Fill each .pdf-frame host with its isolated lesson (Shadow DOM) and keep small cards together */
export function mountShadows(doc, shadows) {
  doc.querySelectorAll('.pdf-frame').forEach((host) => {
    const s = shadows[Number(host.getAttribute('data-shadow'))]
    if (!s) return
    const root = host.attachShadow({ mode: 'open' })
    const links = s.links.map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('')
    root.innerHTML = `${links}<style>${shadowCss(s.css)}</style><style>${PRINT_SHADOW_CSS}</style><div class="rk-body ${esc(s.bodyClass)}" style="${esc(s.bodyStyle)}">${cleanHtml(s.body)}</div>`
  })
}

/** Keep cards / sections together when they fit on a page; long ones flow naturally. Call after images / fonts loaded. */
export function keepCardsTogether(doc) {
  doc.querySelectorAll('.pdf-frame').forEach((host) => {
    const wrap = host.shadowRoot?.querySelector('.rk-body')
    if (!wrap) return
    try {
      findSectionGroup(wrap).forEach((el) => {
        if (el.offsetHeight > 0 && el.offsetHeight < 900) el.style.breakInside = 'avoid'
      })
    } catch { /* ignore */ }
  })
}

/** Ask every lesson iframe on the page for a copy of what it currently shows */
export function requestFrameSnapshots(root = document, timeout = 3000) {
  const frames = Array.from(root.querySelectorAll('.lesson-block iframe'))
  const token = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  return new Promise((resolve) => {
    const out = {}
    let pending = frames.length
    if (!pending) return resolve(out)
    let timer = null
    const finish = () => { window.removeEventListener('message', onMsg); clearTimeout(timer); resolve(out) }
    function onMsg(e) {
      const snap = e.data?.snap
      if (!snap || snap.token !== token) return
      const f = frames.find((x) => x.contentWindow === e.source)
      if (!f) return
      const id = (f.closest('.lesson-block')?.id || '').replace(/^b-/, '')
      if (id && !snap.error) out[id] = snap
      pending -= 1
      if (pending <= 0) finish()
    }
    window.addEventListener('message', onMsg)
    timer = setTimeout(finish, timeout)
    frames.forEach((f) => { try { f.contentWindow?.postMessage({ rkSnap: token }, '*') } catch { pending -= 1 } })
  })
}

/** Opens the print dialog (Save as PDF) for the chapter. */
export async function downloadChapterPdf({ chapter, unit, portal, snaps }) {
  const { html, shadows } = buildChapterPrint({ chapter, unit, portal, snaps })

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:700px;height:1000px;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const cleanup = () => { try { iframe.remove() } catch { /* already removed */ } }

  const doc = iframe.contentWindow.document
  doc.open(); doc.write(html); doc.close()
  mountShadows(doc, shadows)

  // wait for images + fonts (max 5 s) so nothing is missing on paper
  await new Promise((resolve) => {
    const imgs = Array.from(doc.images).filter((i) => !i.complete)
    let left = imgs.length
    const tick = () => { left -= 1; if (left <= 0) resolve() }
    imgs.forEach((i) => { i.onload = tick; i.onerror = tick })
    if (!left) resolve()
    setTimeout(resolve, 5000)
  })
  try { await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 3000))]) } catch { /* fonts API missing */ }
  // re-run the page-break measuring now that images / fonts have their final size
  keepCardsTogether(doc)

  const win = iframe.contentWindow
  win.addEventListener('afterprint', cleanup)
  setTimeout(cleanup, 10 * 60 * 1000)
  win.focus()
  win.print()
}
