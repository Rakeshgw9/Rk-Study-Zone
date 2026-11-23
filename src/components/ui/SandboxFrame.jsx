import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { buildFrameDoc } from '../../lib/frameDoc'

let counter = 0
/** Auto-height sandboxed iframe (scripts allowed, isolated from the app).
 *  bridge = { onEdit, onImage, onFocus, onState } connects the on-canvas editing / image tools running inside the frame. */
function SandboxFrame({ html, css, js, packages, baseCss, padding, copyButtons, minHeight = 60, onError, onConsole, bridge, editMode = null, imageTools = false, title = 'Lesson block', width = '100%', notes = false, onNote, onSections, noteKeys }) {
  const ref = useRef(null)
  const [frameId] = useState(() => `f${++counter}_${Date.now()}`)
  const [height, setHeight] = useState(minHeight)
  const pkgKey = JSON.stringify(packages || [])
  // Lazy: the (possibly huge) document is only built once the frame scrolls near the viewport,
  // and edits are applied at low priority so typing never waits for the preview.
  const wrapRef = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (visible) return
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() } }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])
  const dHtml = useDeferredValue(html)
  const dCss = useDeferredValue(css)
  const dJs = useDeferredValue(js)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const srcDoc = useMemo(() => (visible ? buildFrameDoc({ frameId, html: dHtml, css: dCss, js: dJs, packages, baseCss, padding, copyButtons, editMode, imageTools, notes }) : ''), [visible, frameId, dHtml, dCss, dJs, pkgKey, baseCss, padding, copyButtons, editMode, imageTools, notes])
  const live = useRef({})
  live.current = { onError, onConsole, bridge, onNote, onSections }
  const keysRef = useRef([])
  keysRef.current = noteKeys || []
  const sendKeys = () => ref.current?.contentWindow?.postMessage({ rkNoteKeys: keysRef.current }, '*')
  const keyStr = (noteKeys || []).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (notes) sendKeys() }, [keyStr, notes])

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data
      // the frame is sandboxed (origin "null"), so the sender is verified by WINDOW identity, not by origin
      if (!d || d.rkFrame !== frameId || e.source !== ref.current?.contentWindow) return
      const { onError: err, onConsole: con, bridge: br, onNote: nt, onSections: sc } = live.current
if (Number.isFinite(d.height) && d.height > 0) setHeight(Math.max(minHeight, Math.min(d.height, 1000)))
        if (d.error) err?.(d.error)
      if (d.console) con?.(d.console)
      if (d.edit) br?.onEdit?.(d.edit)
      if (d.img) br?.onImage?.(d.img)
      if (d.state) br?.onState?.(d.state)
      if (d.note) nt?.(d.note)
      if (d.sections !== undefined) { sc?.(d.sections); sendKeys() }
      if (d.focus) br?.onFocus?.({ kind: 'frame', id: frameId, post: (m) => ref.current?.contentWindow?.postMessage(m, '*') })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [frameId, minHeight])

  return (
    <div className="sandbox-wrap" ref={wrapRef} style={{ maxWidth: width, margin: '0 auto', minHeight: visible ? undefined : minHeight }}>
      {visible && <iframe ref={ref} title={title} sandbox="allow-scripts allow-popups allow-forms allow-modals" srcDoc={srcDoc} style={{ width: '100%', height, border: 0, display: 'block' }} loading="lazy" />}
    </div>
  )
}

/* Skip re-rendering the preview when the parent re-renders with identical content (e.g. another block was edited).
   Functions are compared by identity (safe: a changed callback still re-renders); arrays by value. */
function sameProps(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if (a[k] === b[k]) continue
    if ((k === 'packages' || k === 'noteKeys') && JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null)) continue
    return false
  }
  return true
}
export default memo(SandboxFrame, sameProps)
