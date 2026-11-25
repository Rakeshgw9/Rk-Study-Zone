import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const KEY = 'rk_theme'
const COLORS = { dark: '#030b1a', light: '#f2f5fa' }
const Ctx = createContext({ theme: 'dark', toggle: () => {}, setTheme: () => {} })

// The first paint is already themed by the inline script in index.html; this keeps React in sync.
const initial = () => {
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage blocked */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme])
    try { localStorage.setItem(KEY, theme) } catch { /* storage blocked */ }
  }, [theme])

  // Keep several open tabs in step.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) setTheme(e.newValue) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(Ctx)
