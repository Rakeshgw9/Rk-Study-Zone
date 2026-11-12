/**
 * RK Study Zone — Lesson Content A4 PDF Exporter (Change 3)
 * Exports the current chapter's lesson materials as a clean, professionally formatted A4 PDF.
 * Excludes sidebars, navigation, exam engines, and editing controls.
 */

function sanitizeForPdf(html = '') {
  return String(html)
    .replace(/<button[^>]*>.*?<\/button>/gi, '')
    .replace(/data-placeholder="[^"]*"/gi, '')
    .trim()
}

export function generateChapterPrintHtml({ chapter, unit, portal }) {
  const portalName = portal?.name || 'RK Study Zone'
  const unitTitle = unit?.title ? `Unit: ${unit.title}` : ''
  const chapterTitle = chapter?.title || 'Chapter Lesson'
  const chapterDesc = chapter?.description || ''

  // Build block contents HTML
  const blocksHtml = (chapter.blocks || [])
    .filter((b) => b.visible !== false && b.type !== 'mcq') // MCQs have separate exam functionality
    .map((block) => {
      const d = block.data || {}

      if (['heading-paragraph', 'heading-image', 'heading-list', 'heading-example', 'multi-heading'].includes(block.type)) {
        return `
          <div class="pdf-block pdf-ready-block">
            ${d.heading ? `<h2 class="pdf-block-heading">${d.heading}</h2>` : ''}
            ${d.subheading ? `<h4 class="pdf-block-subheading">${d.subheading}</h4>` : ''}
            ${d.paragraph ? `<div class="pdf-paragraph">${sanitizeForPdf(d.paragraph)}</div>` : ''}
            ${
              d.image
                ? `<div class="pdf-image-wrap">
                    <img src="${d.image}" alt="${d.alt || ''}" class="pdf-img" />
                    ${d.caption ? `<div class="pdf-caption">${d.caption}</div>` : ''}
                  </div>`
                : ''
            }
            ${
              Array.isArray(d.items) && d.items.length
                ? `<ul class="pdf-list">${d.items.map((it) => `<li>${sanitizeForPdf(it)}</li>`).join('')}</ul>`
                : ''
            }
            ${
              d.example
                ? `<div class="pdf-example-box">
                    <div class="pdf-example-badge">Example</div>
                    <div>${sanitizeForPdf(d.example)}</div>
                  </div>`
                : ''
            }
          </div>
        `
      }

      if (block.type === 'table') {
        const rows = d.rows || []
        const options = d.options || {}
        if (!rows.length) return ''
        const headRow = options.header ? rows[0] : null
        const bodyRows = options.header ? rows.slice(1) : rows

        return `
          <div class="pdf-block pdf-table-block">
            ${d.title ? `<h3 class="pdf-table-title">${d.title}</h3>` : ''}
            ${d.caption ? `<p class="pdf-table-desc">${d.caption}</p>` : ''}
            <table class="pdf-table">
              ${
                headRow
                  ? `<thead><tr>${headRow.cells
                      .map((c) => `<th colspan="${c.cs || 1}" rowspan="${c.rs || 1}">${sanitizeForPdf(c.t)}</th>`)
                      .join('')}</tr></thead>`
                  : ''
              }
              <tbody>
                ${bodyRows
                  .map(
                    (r) =>
                      `<tr>${r.cells
                        .map((c) => (c.cov ? '' : `<td colspan="${c.cs || 1}" rowspan="${c.rs || 1}">${sanitizeForPdf(c.t)}</td>`))
                        .join('')}</tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
      }

      if (block.type === 'html') {
        return `
          <div class="pdf-block pdf-html-block">
            ${block.title ? `<h3 class="pdf-block-heading">${block.title}</h3>` : ''}
            ${d.css ? `<style>${d.css}</style>` : ''}
            <div class="pdf-html-content">${sanitizeForPdf(d.html || '')}</div>
          </div>
        `
      }

      if (block.type === 'json') {
        let jsonParsed = null
        try {
          jsonParsed = typeof d.json === 'string' ? JSON.parse(d.json) : d.json
        } catch {}

        if (jsonParsed && Array.isArray(jsonParsed.sections)) {
          return `
            <div class="pdf-block pdf-json-block">
              ${jsonParsed.title ? `<h2 class="pdf-block-heading">${jsonParsed.title}</h2>` : ''}
              ${jsonParsed.sections
                .map(
                  (sec) => `
                <div class="pdf-json-section">
                  ${sec.heading ? `<h3 class="pdf-section-heading">${sec.heading}</h3>` : ''}
                  ${sec.text ? `<div class="pdf-paragraph">${sec.text}</div>` : ''}
                  ${sec.points ? `<ul class="pdf-list">${sec.points.map((p) => `<li>${p}</li>`).join('')}</ul>` : ''}
                  ${sec.image?.src ? `<div class="pdf-image-wrap"><img src="${sec.image.src}" class="pdf-img" /></div>` : ''}
                </div>
              `
                )
                .join('')}
            </div>
          `
        }
      }

      return ''
    })
    .join('')

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${chapterTitle} — ${portalName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 18mm 16mm 18mm 16mm;
          @bottom-right {
            content: "Page " counter(page);
            font-size: 9pt;
            color: #64748b;
          }
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #1e293b;
          line-height: 1.55;
          margin: 0;
          padding: 0;
          font-size: 11pt;
          background: #ffffff;
        }
        .pdf-header {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 12px;
          margin-bottom: 22px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .pdf-brand {
          font-size: 14pt;
          font-weight: 800;
          color: #1e3a8a;
          letter-spacing: -0.02em;
        }
        .pdf-meta {
          font-size: 9pt;
          color: #64748b;
          text-align: right;
        }
        .pdf-chapter-banner {
          background: #f8fafc;
          border-left: 4px solid #2563eb;
          padding: 14px 18px;
          margin-bottom: 24px;
          border-radius: 4px;
        }
        .pdf-chapter-banner h1 {
          font-size: 20pt;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px;
        }
        .pdf-chapter-banner p {
          color: #475569;
          font-size: 10.5pt;
          margin: 0;
        }
        .pdf-block {
          margin-bottom: 22px;
          page-break-inside: avoid;
        }
        .pdf-block-heading {
          font-size: 14pt;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin: 18px 0 10px;
        }
        .pdf-block-subheading {
          font-size: 12pt;
          font-weight: 600;
          color: #3b82f6;
          margin: 0 0 8px;
        }
        .pdf-paragraph {
          font-size: 11pt;
          color: #334155;
          margin-bottom: 12px;
        }
        .pdf-image-wrap {
          text-align: center;
          margin: 14px 0;
          page-break-inside: avoid;
        }
        .pdf-img {
          max-width: 90%;
          max-height: 380px;
          object-fit: contain;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
        }
        .pdf-caption {
          font-size: 9pt;
          color: #64748b;
          font-style: italic;
          margin-top: 4px;
        }
        .pdf-list {
          margin: 8px 0 14px 22px;
          padding: 0;
          color: #334155;
        }
        .pdf-list li {
          margin-bottom: 5px;
        }
        .pdf-example-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 12px 14px;
          margin: 14px 0;
          position: relative;
        }
        .pdf-example-badge {
          display: inline-block;
          font-size: 8.5pt;
          font-weight: 700;
          text-transform: uppercase;
          background: #2563eb;
          color: #fff;
          padding: 2px 8px;
          border-radius: 4px;
          margin-bottom: 6px;
        }
        .pdf-table {
          width: 100%;
          border-collapse: collapse;
          margin: 14px 0;
          font-size: 10pt;
          page-break-inside: avoid;
        }
        .pdf-table th {
          background: #1e40af;
          color: #ffffff;
          font-weight: 600;
          padding: 8px 10px;
          border: 1px solid #1e3a8a;
          text-align: left;
        }
        .pdf-table td {
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          color: #1e293b;
        }
        .pdf-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .pdf-footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          font-size: 8.5pt;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="pdf-header">
        <div class="pdf-brand">${portalName}</div>
        <div class="pdf-meta">
          ${unitTitle ? `<div>${unitTitle}</div>` : ''}
          <div>Downloaded from RK Study Zone</div>
        </div>
      </div>

      <div class="pdf-chapter-banner">
        <h1>${chapterTitle}</h1>
        ${chapterDesc ? `<p>${chapterDesc}</p>` : ''}
      </div>

      <div class="pdf-content">
        ${blocksHtml || '<p>No written lesson content available in this chapter.</p>'}
      </div>

      <div class="pdf-footer">
        <span>${portalName} — Study Materials</span>
        <span>A4 Format • Print / Save as PDF</span>
      </div>
    </body>
    </html>
  `
}

/**
 * Downloads or opens the formatted A4 chapter lesson for printing or saving to PDF.
 */
export async function downloadChapterPdf({ chapter, unit, portal }) {
  const html = generateChapterPrintHtml({ chapter, unit, portal })

  // Use an invisible iframe so the main page layout is never disturbed
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()

  // Wait for images inside iframe to load before printing
  await new Promise((resolve) => {
    const images = doc.images
    if (images.length === 0) return resolve()
    let loaded = 0
    const check = () => {
      loaded++
      if (loaded >= images.length) resolve()
    }
    for (let i = 0; i < images.length; i++) {
      if (images[i].complete) {
        check()
      } else {
        images[i].onload = check
        images[i].onerror = check
      }
    }
    setTimeout(resolve, 1500) // safety timeout
  })

  // Trigger print dialog where user can save directly as PDF
  iframe.contentWindow.focus()
  iframe.contentWindow.print()

  // Cleanup iframe after printing
  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 2000)
}
