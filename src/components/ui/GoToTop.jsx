import { useEffect, useState } from 'react'
import { LuArrowUp } from 'react-icons/lu'

/**
 * Floating Go-to-Top button that works for both window scroll (mobile) and inner scroll panes (desktop).
 */
export default function GoToTop({ containerSelector = '.bld-center, .st-main' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const check = () => {
      const winY = window.scrollY || document.documentElement.scrollTop || 0
      const el = containerSelector ? document.querySelector(containerSelector) : null
      const elY = el ? el.scrollTop : 0
      setVisible(winY > 240 || elY > 240)
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    const el = containerSelector ? document.querySelector(containerSelector) : null
    el?.addEventListener('scroll', check, { passive: true })
    return () => {
      window.removeEventListener('scroll', check)
      el?.removeEventListener('scroll', check)
    }
  }, [containerSelector])

  if (!visible) return null

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (containerSelector) {
      document.querySelectorAll(containerSelector).forEach((el) => {
        el.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }

  return (
    <button
      type="button"
      className="rk-go-top-btn"
      onClick={scrollToTop}
      aria-label="Go to top"
      title="Go to top"
    >
      <LuArrowUp />
    </button>
  )
}
