import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/*
  App preferences (per device, saved in localStorage).
  Used by Settings → Appearance / Learning / Builder and read by the lesson page and the builder.
*/
export const DEFAULT_PREFS = {
  fontScale: 'normal', // normal | large | xlarge
  reduceMotion: false,
  autoComplete: true, // lesson page: mark a block done after it has been read
  teachingToolbar: true, // lesson page: floating highlight / pen toolbar
  focusMode: false, // lesson page: open with both side panels hidden
  autosaveMs: 1200, // builder: wait before autosaving the draft
}
export const FONT_SCALES = { normal: '100%', large: '112.5%', xlarge: '125%' }

const KEY = 'rk_prefs'
const read = () => {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) } } catch { return { ...DEFAULT_PREFS } }
}

const Ctx = createContext({ prefs: DEFAULT_PREFS, setPref: () => {}, resetPrefs: () => {} })

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(read)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* storage full / blocked */ }
    const root = document.documentElement
    root.style.fontSize = FONT_SCALES[prefs.fontScale] || '100%'
    root.classList.toggle('rk-reduce-motion', !!prefs.reduceMotion)
  }, [prefs])

  const setPref = useCallback((k, v) => setPrefs((p) => ({ ...p, [k]: v })), [])
  const resetPrefs = useCallback(() => setPrefs({ ...DEFAULT_PREFS }), [])
  const value = useMemo(() => ({ prefs, setPref, resetPrefs }), [prefs, setPref, resetPrefs])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export const usePrefs = () => useContext(Ctx)
