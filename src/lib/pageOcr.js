/* Image → Text block: browser-side page preparation + OCR.
 * Same on-demand CDN loading strategy as lib/ocr.js (no new npm dependency, no secret keys, nothing is uploaded:
 * photos and PDFs never leave the teacher's browser). Pinned versions match lib/ocr.js. */
import { parsePageRange } from './notesFormatter'

const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.esm.min.js'
const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.394/build/pdf.min.mjs'
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs'

export const OCR_LIMITS = { maxPages: 30, maxImageMB: 15, maxPdfMB: 40, maxSide: 2400 }
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp']
export const OCR_LANGUAGES = [
  { value: 'eng', label: 'English' },
  { value: 'ori', label: 'Odia (ଓଡ଼ିଆ)' },
  { value: 'eng+ori', label: 'English + Odia' },
]

let tessPromise, pdfPromise
// The CDN ES-module build may expose its API as named exports or on `default` — accept both.
const pickApi = (mod, fn) => (typeof mod?.[fn] === 'function' ? mod : typeof mod?.default?.[fn] === 'function' ? mod.default : null)
const loadTesseract = () => (tessPromise ||= import(/* @vite-ignore */ TESS_URL).then((m) => { const api = pickApi(m, 'createWorker'); if (!api) throw new Error('bad module'); return api }).catch(() => { tessPromise = null; throw new Error('The OCR engine could not be loaded. Check your internet connection and try again.') }))
const loadPdfjs = () => (pdfPromise ||= import(/* @vite-ignore */ PDFJS_URL).then((m) => { const api = pickApi(m, 'getDocument'); if (!api) throw new Error('bad module'); api.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return api }).catch(() => { pdfPromise = null; throw new Error('The PDF reader could not be loaded. Check your internet connection and try again.') }))

/** Validate a picked file. Returns an error string or ''. */
export function validateOcrFile(file, { allowPdf = true } = {}) {
  if (!file) return 'No file selected.'
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
  if (isPdf) {
    if (!allowPdf) return `${file.name}: PDF is not allowed here.`
    if (file.size > OCR_LIMITS.maxPdfMB * 1048576) return `${file.name}: PDF is larger than ${OCR_LIMITS.maxPdfMB} MB.`
    return ''
  }
  if (!IMAGE_MIME.includes(file.type)) return `${file.name || 'File'}: only JPG, PNG, WEBP images or PDF files are supported.`
  if (file.size > OCR_LIMITS.maxImageMB * 1048576) return `${file.name}: image is larger than ${OCR_LIMITS.maxImageMB} MB.`
  if (file.size < 1024) return `${file.name}: the image looks empty or corrupt.`
  return ''
}

const loadImage = (blob) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob); const img = new Image()
  img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read. It may be corrupt or in an unsupported format.')) }
  img.src = url
})

/** Rotate / crop / enhance a page image → PNG Blob that is handed to the OCR engine (the original is never modified). */
export async function preparePageImage(blob, { rotate = 0, crop = {}, enhance = true } = {}) {
  const img = await loadImage(blob)
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height
  const pct = (v, max) => Math.min(max, Math.max(0, Number(v) || 0))
  const cl = pct(crop.left, 45), cr = pct(crop.right, 45), ct = pct(crop.top, 45), cb = pct(crop.bottom, 45)
  const sx = Math.round(W * cl / 100), sy = Math.round(H * ct / 100)
  const sw = Math.max(16, Math.round(W * (1 - (cl + cr) / 100))), sh = Math.max(16, Math.round(H * (1 - (ct + cb) / 100)))
  const scale = Math.min(1, OCR_LIMITS.maxSide / Math.max(sw, sh))
  const dw = Math.max(1, Math.round(sw * scale)), dh = Math.max(1, Math.round(sh * scale))
  const turns = ((Math.round(rotate / 90) % 4) + 4) % 4
  const c = document.createElement('canvas')
  c.width = turns % 2 ? dh : dw; c.height = turns % 2 ? dw : dh
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.translate(c.width / 2, c.height / 2); ctx.rotate(turns * Math.PI / 2)
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (enhance) {
    const data = ctx.getImageData(0, 0, c.width, c.height); const px = data.data; const hist = new Uint32Array(256)
    for (let i = 0; i < px.length; i += 4) { const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0; px[i] = px[i + 1] = px[i + 2] = g; hist[g]++ }
    const total = px.length / 4; let acc = 0, lo = 0, hi = 255
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break } }
    acc = 0
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.02) { hi = v; break } }
    if (hi - lo > 20) { const k = 255 / (hi - lo); for (let i = 0; i < px.length; i += 4) { const g = Math.max(0, Math.min(255, (px[i] - lo) * k)) | 0; px[i] = px[i + 1] = px[i + 2] = g } }
    ctx.putImageData(data, 0, 0)
  }
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the page image.'))), 'image/png'))
}

/** Rebuild readable lines from a PDF text layer (groups items by their vertical position). */
function pdfLines(items) {
  const rows = []
  for (const it of items) {
    if (!('str' in it) || !it.str.trim()) continue
    const y = Math.round(it.transform[5]); const x = it.transform[4]
    const row = rows.find((r) => Math.abs(r.y - y) <= 2)
    if (row) row.parts.push({ x, s: it.str }); else rows.push({ y, parts: [{ x, s: it.str }] })
  }
  return rows.sort((a, b) => b.y - a.y).map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim()).join('\n')
}

/** Read a PDF, render the chosen pages as images (and keep each page's embedded text when it has one).
 *  rangeText: "1-3, 5" (empty = all pages, up to the page limit). */
export async function readPdfPages(file, rangeText = '', onProgress) {
  const pdfjs = await loadPdfjs()
  let pdf
  try { pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise }
  catch (e) {
    if (e?.name === 'PasswordException') throw new Error(`${file.name}: this PDF is password protected.`)
    throw new Error(`${file.name}: this PDF is corrupt or unsupported.`)
  }
  const wanted = parsePageRange(rangeText, pdf.numPages)
  if (!wanted) throw new Error(`Page range is not valid. This PDF has ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}; use a format like 1-3, 5.`)
  const picked = wanted.slice(0, OCR_LIMITS.maxPages)
  const out = []
  for (let n = 0; n < picked.length; n++) {
    onProgress?.(n + 1, picked.length)
    const page = await pdf.getPage(picked[n])
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    let text = ''
    try { text = pdfLines((await page.getTextContent()).items) } catch { /* image-only page → OCR */ }
    out.push({ pdfPage: picked[n], blob, textLayer: text.trim().length > 30 ? text : '' })
    page.cleanup?.()
  }
  await pdf.destroy?.()
  return { pages: out, total: pdf.numPages, truncated: wanted.length > picked.length }
}

/**
 * OCR the given pages in order (one worker, sequential, cancellable).
 * pages: [{ id, blob, rotate, crop, enhance, textLayer? }]
 * Returns { results: [{ id, text, confidence, error?, fromTextLayer? }] } — a failing page never discards the others.
 */
export async function recognizePages(pages, { lang = 'eng', layout = 'auto', onProgress, signal } = {}) {
  const needsOcr = pages.some((p) => !p.textLayer)
  let worker = null
  const results = []
  let current = 0
  const aborted = () => signal?.aborted
  try {
    if (needsOcr) {
      const tesseract = await loadTesseract()
      worker = await tesseract.createWorker(lang, 1, {
        logger: (m) => { if (m.status === 'recognizing text') onProgress?.({ index: current, total: pages.length, status: 'Reading text', fraction: m.progress }); else if (/loading|initializ/i.test(m.status || '')) onProgress?.({ index: current, total: pages.length, status: m.status.includes('language') ? 'Loading language data' : 'Starting OCR engine', fraction: m.progress }) },
      })
      await worker.setParameters({ tessedit_pageseg_mode: layout === 'single' ? '6' : '3', preserve_interword_spaces: '1' })
    }
    for (let i = 0; i < pages.length; i++) {
      if (aborted()) throw Object.assign(new Error('Cancelled'), { cancelled: true })
      current = i
      const p = pages[i]
      onProgress?.({ index: i, total: pages.length, status: 'Preparing page', fraction: 0 })
      try {
        if (p.textLayer) { results.push({ id: p.id, text: p.textLayer, confidence: 100, fromTextLayer: true }); continue }
        const img = await preparePageImage(p.blob, p)
        const { data } = await worker.recognize(img)
        results.push({ id: p.id, text: (data.text || '').trim(), confidence: typeof data.confidence === 'number' ? data.confidence : null })
      } catch (e) {
        if (e.cancelled) throw e
        results.push({ id: p.id, text: '', confidence: null, error: e.message || 'This page could not be read.' })
      }
    }
    onProgress?.({ index: pages.length, total: pages.length, status: 'Done', fraction: 1 })
    return { results }
  } finally {
    try { await worker?.terminate() } catch { /* ignore */ }
  }
}
