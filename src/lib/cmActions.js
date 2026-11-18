/** Editor commands loaded on demand so CodeMirror stays out of the main bundle. */
export async function cmAction(view, name) {
  if (!view) return
  if (name === 'find') { const { openSearchPanel } = await import('@codemirror/search'); openSearchPanel(view) }
  else if (name === 'undo' || name === 'redo') { const c = await import('@codemirror/commands'); (name === 'undo' ? c.undo : c.redo)(view) }
  view.focus()
}
export function insertAtCursor(view, text) {
  if (!view) return false
  const { from, to } = view.state.selection.main
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true })
  view.focus(); return true
}
export function downloadText(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
/** Split an imported full HTML page into html / css / js parts */
export function splitHtmlDocument(text) {
  if (typeof DOMParser === 'undefined' || !/<(html|body|style|script)\b/i.test(text)) return { html: text, css: '', js: '' }
  const doc = new DOMParser().parseFromString(text, 'text/html')
  const css = [...doc.querySelectorAll('style')].map((s) => s.textContent.trim()).filter(Boolean).join('\n\n')
  const js = [...doc.querySelectorAll('script:not([src])')].map((s) => s.textContent.trim()).filter(Boolean).join('\n\n')
  doc.querySelectorAll('style, script').forEach((n) => n.remove())
  return { html: doc.body.innerHTML.trim(), css, js }
}
export const readFileText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsText(file) })
