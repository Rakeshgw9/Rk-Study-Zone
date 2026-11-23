import { cloneElement, useCallback, useEffect, useId, useRef, useState } from 'react'

/** Accessible tooltip: shows on hover, keyboard focus and long-press (touch); Esc closes it.
 *  The child must be a single element that accepts props (button, span …). */
export default function Tooltip({ text, children, placement = 'bottom', delay = 250 }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const press = useRef(null)
  const show = useCallback((wait = delay) => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), wait) }, [delay])
  const hide = useCallback(() => { clearTimeout(timer.current); clearTimeout(press.current); setOpen(false) }, [])
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(press.current) }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && hide()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, hide])
  if (!text) return children
  const c = children.props
  return (
    <span className="rk-tip-wrap">
      {cloneElement(children, {
        'aria-describedby': open ? id : c['aria-describedby'],
        onMouseEnter: (e) => { c.onMouseEnter?.(e); show() },
        onMouseLeave: (e) => { c.onMouseLeave?.(e); hide() },
        onFocus: (e) => { c.onFocus?.(e); show(0) },
        onBlur: (e) => { c.onBlur?.(e); hide() },
        onTouchStart: (e) => { c.onTouchStart?.(e); press.current = setTimeout(() => setOpen(true), 450) },
        onTouchEnd: (e) => { c.onTouchEnd?.(e); clearTimeout(press.current); timer.current = setTimeout(() => setOpen(false), 1800) },
      })}
      {open && <span id={id} role="tooltip" className={`rk-tip rk-tip-${placement}`}>{text}</span>}
    </span>
  )
}
