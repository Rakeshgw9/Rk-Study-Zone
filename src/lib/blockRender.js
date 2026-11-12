import { DEFAULT_JSON_DISPLAY, DEFAULT_JSON_STYLE, LESSON_JS, hasFormula, hasLessonMcq, lessonCss, renderLessonHtml, validateLessonJson } from './jsonLesson'
import { PACKAGE_PRESETS } from './packages'
import { tagImages } from './editBridge'

const BI = { id: 'bootstrap-icons', name: 'Bootstrap Icons', type: 'css', url: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css' }
const KATEX = ['katex-css', 'katex-js', 'katex-auto'].map((id) => PACKAGE_PRESETS.find((p) => p.id === id)).filter(Boolean)
const mergePackages = (...lists) => { const seen = new Set(); return lists.flat().filter((p) => p && !seen.has(p.url) && seen.add(p.url)) }

/** "asset:<id>" tokens in code are replaced by the uploaded image data when the block is rendered. */
export function resolveAssets(text, assets = []) {
  if (!text || !assets.length || !String(text).includes('asset:')) return text
  return String(text).replace(/asset:([A-Za-z0-9_-]+)/g, (m, id) => assets.find((a) => a.id === id)?.src || m)
}

export function htmlBlockStyleCss(style = {}) {
  const s = { background: '#ffffff', textColor: '#0f172a', fontFamily: 'Inter', fontSize: 16, textAlign: 'left', borderColor: '#dbe4f3', borderWidth: 0, borderRadius: 12, ...style }
  const safeFont = ['Inter', 'Poppins', 'Georgia', 'Arial', 'system-ui', 'Noto Sans Oriya'].includes(s.fontFamily) ? s.fontFamily : 'Inter'
  const safeAlign = ['left', 'center', 'right', 'justify'].includes(s.textAlign) ? s.textAlign : 'left'
  return `html,body{min-height:100%;}body{box-sizing:border-box;background:${s.background};color:${s.textColor};font-family:'${safeFont}',sans-serif;font-size:${Number(s.fontSize) || 16}px;text-align:${safeAlign};border:${Math.max(0, Number(s.borderWidth) || 0)}px solid ${s.borderColor};border-radius:${Math.max(0, Number(s.borderRadius) || 0)}px;padding:${Math.max(0, Number(s.padding) || 0)}px;margin:0;}`
}

/** Props for <SandboxFrame/> for html/json blocks (same in CMS preview and student view).
 *  opts.editImages  → HTML preview: hover actions on images
 *  opts.textEdit    → on-canvas text editing (scripts are switched off so the DOM matches the source) */
export function frameProps(block, opts = {}) {
  const d = block.data
  if (block.type === 'html') {
    const assets = d.assets || []
    let html = opts.editImages ? tagImages(d.html || '') : (d.html || '')
    const css = `${resolveAssets(d.css || '', assets)}\n${htmlBlockStyleCss({ ...(d.style || {}), padding: d.padding })}`
    const base = { html: resolveAssets(html, assets), css, js: resolveAssets(d.js || '', assets), packages: d.packages || [], padding: 0, copyButtons: d.copyButton, imageTools: !!opts.editImages }
    if (opts.textEdit) return { ...base, js: '', packages: (d.packages || []).filter((p) => p.type === 'css'), copyButtons: false, editMode: 'html' }
    return base
  }
  if (block.type === 'json') {
    const v = validateLessonJson(d.json)
    const style = { ...DEFAULT_JSON_STYLE, ...d.style }
    if (!v.data) return { html: `<div style="padding:16px;border:1px dashed #f87171;border-radius:10px;color:#b91c1c;font:14px Inter,sans-serif">JSON error: ${(v.errors[0]?.message || '').replace(/</g, '&lt;')}</div>`, css: '', js: '', packages: [] }
    const packages = mergePackages([BI], hasFormula(v.data) ? KATEX : [], d.packages || [])
    const html = renderLessonHtml(v.data, style, { display: { ...DEFAULT_JSON_DISPLAY, ...(d.display || {}) }, template: d.renderer, editable: !!opts.textEdit })
    const css = `${lessonCss(style)}\n${d.customCss || ''}`
    if (opts.textEdit) return { html, css, js: '', packages: packages.filter((p) => p.type === 'css'), padding: 0, editMode: 'json' }
    return { html, css, js: `${hasLessonMcq(v.data) ? LESSON_JS : ''}\n${d.customJs || ''}`, packages, padding: 0 }
  }
  return null
}
