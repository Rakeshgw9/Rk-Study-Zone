export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
export const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))
export const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export function timeAgo(ms) {
  if (!ms) return '—'
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 45) return 'Just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
export function toMillis(t) {
  if (!t) return 0
  if (typeof t === 'number') return t
  if (t.toMillis) return t.toMillis()
  return new Date(t).getTime() || 0
}
export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export const readFileText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file) })

/** Resize an image file to a compact JPEG/PNG data URL (used as Storage fallback) */
export function resizeImage(file, max = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** Convert JSON.parse error to line / column */
export function jsonError(text, err) {
  const m = /position (\d+)/i.exec(err.message)
  let line = null; let col = null
  if (m) {
    const pos = Number(m[1]); const before = text.slice(0, pos).split('\n')
    line = before.length; col = before[before.length - 1].length + 1
  } else {
    const lm = /line (\d+) column (\d+)/i.exec(err.message)
    if (lm) { line = Number(lm[1]); col = Number(lm[2]) }
  }
  const clean = err.message.replace(/^JSON\.parse: /, '').replace(/ in JSON at position \d+.*$/, '')
  return { line, col, message: line ? `Line ${line}, column ${col}: ${clean}` : clean }
}
