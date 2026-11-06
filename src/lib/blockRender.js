import { DEFAULT_JSON_STYLE, lessonCss, renderLessonHtml, validateLessonJson } from './jsonLesson'

const BI = { id: 'bootstrap-icons', name: 'Bootstrap Icons', type: 'css', url: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css' }

/** Props for <SandboxFrame/> for html/json blocks (same in CMS preview and student view) */
export function htmlBlockStyleCss(style = {}) {
  const s = { background: '#ffffff', textColor: '#0f172a', fontFamily: 'Inter', fontSize: 16, textAlign: 'left', borderColor: '#dbe4f3', borderWidth: 0, borderRadius: 12, ...style }
  const safeFont = ['Inter', 'Poppins', 'Georgia', 'Arial', 'system-ui', 'Noto Sans Oriya'].includes(s.fontFamily) ? s.fontFamily : 'Inter'
  const safeAlign = ['left', 'center', 'right', 'justify'].includes(s.textAlign) ? s.textAlign : 'left'
  return `html,body{min-height:100%;}body{box-sizing:border-box;background:${s.background};color:${s.textColor};font-family:'${safeFont}',sans-serif;font-size:${Number(s.fontSize) || 16}px;text-align:${safeAlign};border:${Math.max(0, Number(s.borderWidth) || 0)}px solid ${s.borderColor};border-radius:${Math.max(0, Number(s.borderRadius) || 0)}px;padding:${Math.max(0, Number(s.padding) || 0)}px;margin:0;}`
}

export function frameProps(block) {
  const d = block.data
  if (block.type === 'html') return { html: d.html, css: `${d.css || ''}\n${htmlBlockStyleCss({ ...(d.style || {}), padding: d.padding })}`, js: d.js, packages: d.packages || [], padding: 0, copyButtons: d.copyButton }
  if (block.type === 'json') {
    const v = validateLessonJson(d.json)
    const style = { ...DEFAULT_JSON_STYLE, ...d.style }
    const pk = d.packages || []
    const packages = pk.some((p) => p.url === BI.url) ? pk : [BI, ...pk]
    if (!v.data) return { html: `<div style="padding:16px;border:1px dashed #f87171;border-radius:10px;color:#b91c1c;font:14px Inter,sans-serif">JSON error: ${(v.errors[0]?.message || '').replace(/</g, '&lt;')}</div>`, css: '', js: '', packages: [] }
    return { html: renderLessonHtml(v.data, style), css: lessonCss(style) + '\n' + (d.customCss || ''), js: d.customJs || '', packages, padding: 0 }
  }
  return null
}
