/* Rich text helpers — pure string code (no DOM) so the same sanitizer runs in the builder, the student page and tests. */
const TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup', 'span', 'br', 'p', 'div', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'code', 'pre', 'blockquote', 'hr', 'small', 'font'])
const VOID = new Set(['br', 'img', 'hr'])
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template'])
const STYLE_PROPS = new Set(['color', 'background-color', 'background', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align', 'line-height', 'vertical-align'])
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

export const escapeText = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const decodeEntities = (s = '') => String(s).replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m] ?? m)

export function cleanStyle(style = '') {
  const out = []
  String(style).split(';').forEach((decl) => {
    const i = decl.indexOf(':'); if (i < 1) return
    const prop = decl.slice(0, i).trim().toLowerCase(); const val = decl.slice(i + 1).trim()
    if (!STYLE_PROPS.has(prop) || !val) return
    if (/url\s*\(|expression|javascript|@import|[<>\\]/i.test(val) || !/^[\w\s#%.,()'"+/-]*$/.test(val)) return
    out.push(`${prop}:${val}`)
  })
  return out.join(';')
}
const safeHref = (u = '') => (/^(https?:\/\/|mailto:|tel:|#)/i.test(u.trim()) ? u.trim() : '')
export const safeImgSrc = (u = '') => (/^(https?:\/\/|data:image\/(png|jpe?g|gif|webp);base64,|asset:)/i.test(u.trim()) ? u.trim() : '')

function parseAttrs(raw) {
  const attrs = {}
  const re = /([^\s=/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let m
  while ((m = re.exec(raw))) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  return attrs
}

/** Allow-list sanitizer. Unknown tags are unwrapped, scripts removed, event handlers/unsafe URLs/styles dropped. */
export function sanitizeHtml(html = '') {
  const src = String(html ?? '')
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+|</g
  const stack = []; let out = ''; let skip = null; let m
  while ((m = re.exec(src))) {
    const tok = m[0]
    if (tok.startsWith('<!--')) continue
    if (!m[1]) { if (!skip) out += tok === '<' ? '&lt;' : tok.replace(/>/g, '&gt;'); continue }
    const name = m[1].toLowerCase(); const closing = tok[1] === '/'
    if (skip) { if (closing && name === skip) skip = null; continue }
    if (DROP_WITH_CONTENT.has(name)) { if (!closing && !tok.endsWith('/>')) skip = name; continue }
    if (!TAGS.has(name)) continue
    if (closing) {
      const at = stack.lastIndexOf(name); if (at < 0 || VOID.has(name)) continue
      while (stack.length > at) out += `</${stack.pop()}>`
      continue
    }
    const attrs = parseAttrs(m[2] || ''); let a = ''
    const st = attrs.style ? cleanStyle(attrs.style) : ''
    if (st) a += ` style="${escAttr(st)}"`
    if (name === 'a') { const h = safeHref(attrs.href); if (h) a += ` href="${escAttr(h)}" target="_blank" rel="noopener noreferrer"` }
    if (name === 'img') { const s = safeImgSrc(attrs.src); if (!s) continue; a += ` src="${escAttr(s)}" alt="${escAttr(attrs.alt || '')}"`; if (/^\d{1,4}$/.test(attrs.width || '')) a += ` width="${attrs.width}"`; if (/^\d{1,4}$/.test(attrs.height || '')) a += ` height="${attrs.height}"` }
    if ((name === 'td' || name === 'th')) { if (/^\d{1,2}$/.test(attrs.colspan || '')) a += ` colspan="${attrs.colspan}"`; if (/^\d{1,2}$/.test(attrs.rowspan || '')) a += ` rowspan="${attrs.rowspan}"` }
    if (name === 'font') { const c = attrs.color && /^#?[\w]+$/.test(attrs.color) ? attrs.color : ''; if (c) a += ` color="${escAttr(c)}"` }
    out += `<${name}${a}>`
    if (!VOID.has(name)) stack.push(name)
  }
  while (stack.length) out += `</${stack.pop()}>`
  return out
}

export const hasMarkup = (s = '') => /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(String(s))
/** Value stored in a block → safe HTML. Legacy plain text (with line breaks) keeps working. */
export function richHtml(v) {
  const s = String(v ?? '')
  if (!s) return ''
  return hasMarkup(s) ? sanitizeHtml(s) : escapeText(s).replace(/\r?\n/g, '<br>')
}
export const richToText = (v = '') => decodeEntities(String(v).replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
export const isRichEmpty = (v) => !richToText(v) && !/<img\b/i.test(String(v ?? ''))

/** innerHTML of a contentEditable → value to store. Pure plain text stays plain; anything formatted is stored as safe HTML. */
export function fromEditable(html = '') {
  let h = sanitizeHtml(html)
  h = h.replace(/<div><br><\/div>/gi, '<br>').replace(/<\/div><div>/gi, '<br>').replace(/<\/?div>/gi, '<br>').replace(/(<br>)+$/i, '').replace(/^(<br>)+/i, '')
  if (!/<(?!br\b)[a-z]/i.test(h)) return decodeEntities(h.replace(/<br>/gi, '\n'))
  return h
}
