import { useEffect, useMemo, useRef, useState } from 'react'
import { buildFrameDoc } from '../../lib/frameDoc'

let counter = 0
/** Auto-height sandboxed iframe (scripts allowed, isolated from the app) */
export default function SandboxFrame({ html, css, js, packages, baseCss, padding, copyButtons, minHeight = 60, onError, title = 'Lesson block', width = '100%' }) {
  const ref = useRef(null)
  const [frameId] = useState(() => `f${++counter}_${Date.now()}`)
  const [height, setHeight] = useState(minHeight)
  const srcDoc = useMemo(() => buildFrameDoc({ frameId, html, css, js, packages, baseCss, padding, copyButtons }), [frameId, html, css, js, packages, baseCss, padding, copyButtons])

  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || e.data.rkFrame !== frameId) return
      if (e.data.height) setHeight(Math.max(minHeight, Math.min(e.data.height, 20000)))
      if (e.data.error) onError?.(e.data.error)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [frameId, minHeight, onError])

  return (
    <div className="sandbox-wrap" style={{ maxWidth: width, margin: '0 auto' }}>
      <iframe ref={ref} title={title} sandbox="allow-scripts allow-popups allow-forms allow-modals" srcDoc={srcDoc} style={{ width: '100%', height, border: 0, display: 'block' }} loading="lazy" />
    </div>
  )
}
