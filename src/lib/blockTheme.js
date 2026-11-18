/* Default (dark) look of every ready-made content block. Light styling is only used when the author applies a Light template. */
export const DARK_STYLE = {
  background: '#05070d', textColor: '#d8e9ff', headingColor: '#cdfcff', accentColor: '#0c366d',
  borderColor: '#08264e', borderWidth: 1, borderRadius: 14, theme: 'dark',
}

/** Older blocks were created with the white defaults and never themed. Only those untouched defaults are shown dark. */
export function isLegacyLightStyle(s = {}) {
  const eq = (a, b) => String(a ?? '').toLowerCase() === b
  return eq(s.background, '#ffffff') && eq(s.textColor, '#0f172a') && eq(s.headingColor, '#0f172a')
    && eq(s.accentColor, '#2563eb') && eq(s.borderColor, '#dbe4f3')
}

/** Dark + Light "ready-made designs" (Highlight Box, Note Card, Pro Tip, Case Study) */
const T = (dark, light) => ({ dark, light })
export const THEME_TEMPLATES = [
  { id: 'highlight', label: 'Highlight', sub: 'Important concept or key point.', ...T(
    { background: '#1a1405', accentColor: '#684303', borderColor: '#3f1c01', headingColor: '#f7e8ae', textColor: '#e1e9f1' },
    { background: '#faf4da', accentColor: '#d1b492', borderColor: '#9c9166', headingColor: '#34380c', textColor: '#0f172a' }) },
  { id: 'note', label: 'Notes', sub: 'This is a note or additional information.', ...T(
    { background: '#07162b', accentColor: '#126f97', borderColor: '#004164', headingColor: '#b9ddf5', textColor: '#c5d7f0' },
    { background: '#d4eeff', accentColor: '#b4d9eb', borderColor: '#d5f0fd', headingColor: '#0f172a', textColor: '#0f172a' }) },
  { id: 'protip', label: 'Insight', sub: 'Useful tip for better understanding.', ...T(
    { background: '#06180f', accentColor: '#074d20', borderColor: '#033616', headingColor: '#c5eed3', textColor: '#c9dbf1' },
    { background: '#f0fdf4', accentColor: '#bddfca', borderColor: '#c6f3d6', headingColor: '#0f172a', textColor: '#0f172a' }) },
  { id: 'case', label: 'Analysis', sub: 'A real-life example or case study.', ...T(
    { background: '#120a24', accentColor: '#553aa8', borderColor: '#370d7a', headingColor: '#d9d2f8', textColor: '#cbdef7' },
    { background: '#faf5ff', accentColor: '#d0b5ff', borderColor: '#e2dbff', headingColor: '#0f172a', textColor: '#0f172a' }) },
]
export const themeTemplateStyle = (t, mode) => ({ ...t[mode], borderWidth: 1, borderRadius: 14, theme: mode })
