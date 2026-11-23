import { createContext, useCallback, useContext, useState } from 'react'
import { LuCircleAlert, LuCircleCheck, LuX } from 'react-icons/lu'

const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // opts.action = { label, onClick } adds a button (e.g. Retry); toasts with an action stay a little longer
  const push = useCallback((message, type = 'success', opts = {}) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type, action: opts.action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.action ? 9000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="rk-toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rk-toast rk-toast-${t.type}`}>
            {t.type === 'error' ? <LuCircleAlert /> : <LuCircleCheck />}
            <span>{t.message}</span>
            {t.action && (
              <button type="button" className="rk-toast-action" onClick={() => { setToasts((x) => x.filter((y) => y.id !== t.id)); t.action.onClick?.() }}>{t.action.label}</button>
            )}
            <button className="btn-close-plain" aria-label="Close" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><LuX /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastCtx)
