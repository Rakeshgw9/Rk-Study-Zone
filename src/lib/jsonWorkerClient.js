/* formatJsonText(text) → Promise<string>
   Small inputs are formatted inline (instant). Big inputs go to a Web Worker; if workers are unavailable
   (old browser, tests, demo environments) it falls back to the main thread so behaviour is always the same. */
export const BIG_JSON_CHARS = 120 * 1024

let worker = null
let seq = 0
const waiting = new Map()

function getWorker() {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('../workers/json.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, ok, text, error } = e.data || {}
      const w = waiting.get(id)
      if (!w) return
      waiting.delete(id)
      ok ? w.resolve(text) : w.reject(new Error(error))
    }
    worker.onerror = () => {
      waiting.forEach((w) => w.fallback())
      waiting.clear()
      worker?.terminate()
      worker = null
    }
  } catch {
    worker = null
  }
  return worker
}

const inline = (text, indent) => JSON.stringify(JSON.parse(text), null, indent)

export function formatJsonText(text, { indent = 2, threshold = BIG_JSON_CHARS } = {}) {
  const src = String(text ?? '')
  if (src.length < threshold) {
    try { return Promise.resolve(inline(src, indent)) } catch (e) { return Promise.reject(e) }
  }
  const w = getWorker()
  if (!w) {
    // yield once so the "Formatting…" state can paint before the synchronous work runs
    return new Promise((resolve, reject) => setTimeout(() => { try { resolve(inline(src, indent)) } catch (e) { reject(e) } }, 0))
  }
  return new Promise((resolve, reject) => {
    const id = ++seq
    waiting.set(id, { resolve, reject, fallback: () => { try { resolve(inline(src, indent)) } catch (e) { reject(e) } } })
    w.postMessage({ id, text: src, indent })
  })
}
