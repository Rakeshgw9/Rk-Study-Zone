/* Compact Emmet engine for the HTML editor (Tab expands abbreviations such as  ul>li.item*3  or  div.container>h1{Title}+p ).
   Returns text containing one \u0001 cursor marker. */
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'])
const INLINE = new Set(['a', 'span', 'b', 'i', 'em', 'strong', 'small', 'code', 'img', 'br', 'input', 'label', 'button', 'sub', 'sup', 'mark', 'u', 's', 'abbr', 'q'])
export const KNOWN_TAGS = new Set(['a', 'abbr', 'article', 'aside', 'audio', 'b', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'code', 'div', 'em', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'label', 'li', 'link', 'main', 'mark', 'meta', 'nav', 'ol', 'option', 'p', 'pre', 'script', 'section', 'select', 'small', 'span', 'strong', 'style', 'sub', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'title', 'tr', 'u', 'ul', 'video', 'figure', 'figcaption', 'details', 'summary', 'dl', 'dt', 'dd', 'btn', 'bq'])
const ALIAS = { btn: 'button', bq: 'blockquote' }
const DEFAULT_ATTRS = { a: [['href', '']], img: [['src', ''], ['alt', '']], input: [['type', 'text']], link: [['rel', 'stylesheet'], ['href', '']], form: [['action', '']], iframe: [['src', '']], script: [], label: [], select: [], textarea: [['name', ''], ['cols', '30'], ['rows', '10']] }
const CHILD_DEFAULT = { ul: 'li', ol: 'li', table: 'tr', tbody: 'tr', thead: 'tr', tr: 'td', select: 'option', dl: 'dt', p: 'span', span: 'span', em: 'span', strong: 'span', a: 'span', b: 'span', i: 'span', button: 'span', label: 'span' }
const LOREM = 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Quo dolorum ut eaque magnam accusamus voluptates quibusdam sapiente repellat officia deleniti neque molestias'.split(' ')
const lorem = (n) => Array.from({ length: n }, (_, i) => LOREM[i % LOREM.length]).join(' ').replace(/^./, (c) => c.toUpperCase())

export const BOILERPLATE = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>\u0001</title>\n</head>\n<body>\n  \n</body>\n</html>'

function closeIndex(s, i, open, close) { let d = 0; for (let k = i; k < s.length; k++) { if (s[k] === open) d++; else if (s[k] === close && --d === 0) return k } return -1 }

function parseElement(src, i) {
  const el = { tag: '', id: '', classes: [], attrs: [], text: '', repeat: 1, children: [] }
  let m = /^[A-Za-z][\w:-]*/.exec(src.slice(i)); if (m) { el.tag = m[0]; i += m[0].length }
  for (;;) {
    const c = src[i]
    if (c === '#' || c === '.') { const r = /^[\w$@-]+/.exec(src.slice(i + 1)); if (!r) return null; if (c === '#') el.id = r[0]; else el.classes.push(r[0]); i += 1 + r[0].length }
    else if (c === '[') { const e = closeIndex(src, i, '[', ']'); if (e < 0) return null; const body = src.slice(i + 1, e); const re = /([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s\]]*)))?/g; let a; while ((a = re.exec(body))) el.attrs.push([a[1], a[2] ?? a[3] ?? a[4] ?? '']); i = e + 1 }
    else if (c === '{') { const e = closeIndex(src, i, '{', '}'); if (e < 0) return null; el.text += src.slice(i + 1, e); i = e + 1 }
    else break
  }
  if (!el.tag && !el.id && !el.classes.length && !el.attrs.length && !el.text) return null
  return { el, i }
}
function readRepeat(src, i) { const m = /^\*(\d{1,3})/.exec(src.slice(i)); return m ? { n: Number(m[1]), i: i + m[0].length } : { n: 1, i } }

/** Parse into a tree; each node is {tag,id,classes,attrs,text,repeat,children} or a group {group:[...nodes],repeat}. */
export function parseAbbr(src) {
  const root = { children: [] }; const stack = [root]; let i = 0; let last = null
  while (i < src.length) {
    let term
    if (src[i] === '(') {
      const e = closeIndex(src, i, '(', ')'); if (e < 0) return null
      const inner = parseAbbr(src.slice(i + 1, e)); if (!inner) return null
      const r = readRepeat(src, e + 1); term = { group: inner.children, repeat: r.n, children: [] }; i = r.i
    } else {
      const p = parseElement(src, i); if (!p) return null
      const r = readRepeat(src, p.i); p.el.repeat = r.n; term = p.el; i = r.i
    }
    stack[stack.length - 1].children.push(term); last = term
    const op = src[i]
    if (i >= src.length) break
    if (op === '>') { stack.push(term.group ? { children: term.group[term.group.length - 1]?.children ?? term.children } : term); i++ }
    else if (op === '+') { i++ }
    else if (op === '^') { while (src[i] === '^') { if (stack.length > 1) stack.pop(); i++ } }
    else return null
    if (i >= src.length) return null
  }
  return last ? root : null
}

const num = (s, n, total) => s.replace(/\$+/g, (m) => String(n + 1).padStart(m.length, '0')).replace(/\$@-?\d*/g, String(n + 1)) + (total ? '' : '')
const esc = (s) => String(s).replace(/"/g, '&quot;')

function renderNodes(nodes, parentTag, depth, ind) {
  const out = []
  for (const node of nodes) {
    for (let n = 0; n < node.repeat; n++) {
      if (node.group) { out.push(...renderNodes(node.group, parentTag, depth, ind)); continue }
      out.push(renderEl(node, n, parentTag, depth, ind))
    }
  }
  return out
}
function renderEl(node, n, parentTag, depth, ind) {
  let tag = node.tag || CHILD_DEFAULT[parentTag] || (INLINE.has(parentTag) ? 'span' : 'div'); tag = ALIAS[tag] || tag
  const attrs = []
  if (node.id) attrs.push(['id', num(node.id, n)])
  if (node.classes.length) attrs.push(['class', node.classes.map((c) => num(c, n)).join(' ')])
  const given = node.attrs.map(([k, v]) => [k, num(v, n)])
  ;(DEFAULT_ATTRS[tag] || []).forEach(([k, v]) => { if (!given.some(([g]) => g === k)) attrs.push([k, v]) })
  attrs.push(...given)
  const attrStr = attrs.map(([k, v]) => (v === '' && !DEFAULT_ATTRS[tag]?.some(([d]) => d === k) && !given.some(([g, gv]) => g === k && gv === '' && node.attrs.find((a) => a[0] === k && a[1] === '') && false) ? ` ${k}` : ` ${k}="${v === '' ? '\u0001' : esc(v)}"`)).join('')
  const open = `<${tag}${attrStr}>`
  if (VOID.has(tag)) return open
  const text = num(node.text, n)
  if (!node.children.length) return `${open}${text || '\u0001'}</${tag}>`
  const kids = renderNodes(node.children, tag, depth + 1, ind)
  const inline = INLINE.has(tag) || kids.every((k) => /^<(a|span|b|i|em|strong|small|code|img|br|input|label|button|sub|sup|mark|u|s|abbr|q)[\s>]/.test(k) && !k.includes('\n'))
  if (inline || (text && kids.length === 0)) return `${open}${text}${kids.join('')}</${tag}>`
  return `${open}${text ? text : ''}\n${kids.map((k) => k.split('\n').map((l) => ind + l).join('\n')).join('\n')}\n</${tag}>`
}

/** abbr → expanded text (with one \u0001 cursor marker) or null when it is not an abbreviation. */
export function expandEmmet(abbr, indent = '  ') {
  abbr = String(abbr || '').trim()
  if (!abbr) return null
  const fin = (t) => { const at = t.indexOf('\u0001'); const text = t.replace(/\u0001/g, ''); return { text, cursor: at < 0 ? text.length : at } }
  if (abbr === '!' || abbr === 'html:5') return fin(BOILERPLATE)
  const lm = /^lorem(\d*)$/.exec(abbr); if (lm) return fin(lorem(Number(lm[1]) || 30) + '\u0001')
  if (abbr === 'link:css') return fin('<link rel="stylesheet" href="\u0001">')
  if (abbr === 'script:src') return fin('<script src="\u0001"></script>')
  if (/^[a-z][a-z0-9]*$/i.test(abbr) && !KNOWN_TAGS.has(abbr.toLowerCase())) return null
  if (!/^[\w.#>+*^\[\]{}()=\-:$@"' !]+$/.test(abbr)) return null
  const tree = parseAbbr(abbr); if (!tree) return null
  let text = renderNodes(tree.children, '', 0, indent).join('\n')
  const at = text.indexOf('\u0001'); text = text.replace(/\u0001/g, '')
  return { text, cursor: at < 0 ? text.length : at }
}

/** Find the abbreviation that ends at the cursor ("<div>ul>li*3|" → "ul>li*3"). */
export function abbrBefore(lineText) {
  let depth = 0; let i = lineText.length
  while (i > 0) {
    const ch = lineText[i - 1]
    if (ch === ']' || ch === '}' || ch === ')') depth++
    else if (ch === '[' || ch === '{' || ch === '(') { if (depth === 0) break; depth-- }
    else if (depth === 0) {
      if (/\s/.test(ch)) break
      if (ch === '<') break
      if (ch === '>' && /<[^<>]*$/.test(lineText.slice(0, i - 1))) break
    }
    i--
  }
  return { abbr: lineText.slice(i), offset: i }
}
