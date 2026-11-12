import { useEffect, useMemo, useRef, useState } from 'react'
import { buildFrameDoc } from '../../lib/frameDoc'

let counter = 0
/** Auto-height sandboxed iframe (scripts allowed, isolated from the app).
 *  bridge = { onEdit, onImage, onFocus, onState } connects the on-canvas editing / image tools running inside the frame. */
export default function SandboxFrame({ html, css, js, packages, baseCss, padding, copyButtons, minHeight = 60, onError, onConsole, bridge, editMode = null, imageTools = false, title = 'Lesson block', width = '100%' }) {
  const ref = useRef(null)
  const [frameId] = useState(() => `f${++counter}_${Date.now()}`)
  const [height, setHeight] = useState(minHeight)
  const pkgKey = JSON.stringify(packages || [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const srcDoc = useMemo(() => buildFrameDoc({ frameId, html, css, js, packages, baseCss, padding, copyButtons, editMode, imageTools }), [frameId, html, css, js, pkgKey, baseCss, padding, copyButtons, editMode, imageTools])
  const live = useRef({})
  live.current = { onError, onConsole, bridge }

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data
      if (!d || d.rkFrame !== frameId) return
      const { onError: err, onConsole: con, bridge: br } = live.current
if (d.height) setHeight(Math.max(minHeight, Math.min(d.height, 1000)))
        if (d.error) err?.(d.error)
      if (d.console) con?.(d.console)
      if (d.edit) br?.onEdit?.(d.edit)
      if (d.img) br?.onImage?.(d.img)
      if (d.state) br?.onState?.(d.state)
      if (d.focus) br?.onFocus?.({ kind: 'frame', id: frameId, post: (m) => ref.current?.contentWindow?.postMessage(m, '*') })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [frameId, minHeight])

  return (
    <div className="sandbox-wrap" style={{ maxWidth: width, margin: '0 auto' }}>
      <iframe ref={ref} title={title} sandbox="allow-scripts allow-popups allow-forms allow-modals" srcDoc={srcDoc} style={{ width: '100%', height, border: 0, display: 'block' }} loading="lazy" />
    </div>
  )
}
