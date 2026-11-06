/* Default (dark) look of every ready-made content block. Light styling is only used when the author applies a Light template. */
export const DARK_STYLE = {
  background: '#05070d', textColor: '#e2e8f0', headingColor: '#ffffff', accentColor: '#c026d3',
  borderColor: '#1d6fe0', borderWidth: 1, borderRadius: 14, theme: 'dark',
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
  { id: 'highlight', label: 'Highlight Box', sub: 'Important concept or key point.', ...T(
    { background: '#1a1405', accentColor: '#f59e0b', borderColor: '#b45309', headingColor: '#fde68a', textColor: '#f1f5f9' },
    { background: '#fffbeb', accentColor: '#d97706', borderColor: '#fde68a', headingColor: '#0f172a', textColor: '#0f172a' }) },
  { id: 'note', label: 'Note Card', sub: 'This is a note or additional information.', ...T(
    { background: '#07162b', accentColor: '#38bdf8', borderColor: '#0369a1', headingColor: '#e0f2fe', textColor: '#e2e8f0' },
    { background: '#f0f9ff', accentColor: '#0284c7', borderColor: '#bae6fd', headingColor: '#0f172a', textColor: '#0f172a' }) },
  { id: 'protip', label: 'Pro Tip', sub: 'Useful tip for better understanding.', ...T(
    { background: '#06180f', accentColor: '#22c55e', borderColor: '#15803d', headingColor: '#dcfce7', textColor: '#e2e8f0' },
    { background: '#f0fdf4', accentColor: '#16a34a', borderColor: '#bbf7d0', headingColor: '#0f172a', textColor: '#0f172a' }) },
  { id: 'case', label: 'Case Study', sub: 'A real-life example or case study.', ...T(
    { background: '#120a24', accentColor: '#a78bfa', borderColor: '#6d28d9', headingColor: '#ede9fe', textColor: '#e2e8f0' },
    { background: '#faf5ff', accentColor: '#7c3aed', borderColor: '#ddd6fe', headingColor: '#0f172a', textColor: '#0f172a' }) },
]
export const themeTemplateStyle = (t, mode) => ({ ...t[mode], borderWidth: 1, borderRadius: 14, theme: mode })
