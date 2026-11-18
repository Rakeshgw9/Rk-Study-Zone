import { useEffect } from 'react'

/** Lightweight Bootstrap-styled modal controlled by React state */
export default function Modal({ show, onClose, children, className = '', labelledBy }) {
  useEffect(() => {
    if (!show) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [show, onClose])

  if (!show) return null
  return (
    <div className="rk-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`rk-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  )
}
