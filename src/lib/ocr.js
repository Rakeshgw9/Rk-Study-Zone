/* Optional browser-side extraction. Libraries are loaded on demand from a CDN so
 * the normal portal bundle stays small. No Firebase Storage dependency is used. */
export async function extractMcqText(file) {
  let imageSource = file
  if (file.type === 'application/pdf') {
    let pdfjs
    try { pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.394/build/pdf.min.mjs') }
    catch { throw new Error('PDF text extraction could not load. Save the PDF pages as images or try a text-based PDF.') }
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs'
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages = []
    for (let n = 1; n <= Math.min(pdf.numPages, 20); n++) {
      const page = await pdf.getPage(n); const content = await page.getTextContent()
      pages.push(content.items.map((item) => item.str).join(' '))
    }
    const text = pages.join('\n')
    if (text.trim()) return text
    const page = await pdf.getPage(1); const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    imageSource = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }
  let tesseract
  try { tesseract = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.esm.min.js') }
  catch { throw new Error('OCR library could not be loaded. Check your internet connection and try again.') }
  const worker = await tesseract.createWorker('eng')
  try { const result = await worker.recognize(imageSource); return result.data.text || '' }
  finally { await worker.terminate() }
}
