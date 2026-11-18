import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext({ theme: 'dark', toggle: () => {} })
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('rk_theme') || 'dark')
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('rk_theme', theme) }, [theme])
  return <Ctx.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>{children}</Ctx.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(Ctx)
