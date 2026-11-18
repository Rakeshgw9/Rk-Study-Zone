/* Static knowledge for the code editors: snippets, hover documentation and known CSS properties. */
export const CSS_PROPS = `align-content align-items align-self all animation animation-delay animation-direction animation-duration animation-fill-mode animation-iteration-count animation-name animation-play-state animation-timing-function appearance aspect-ratio backdrop-filter backface-visibility background background-attachment background-blend-mode background-clip background-color background-image background-origin background-position background-position-x background-position-y background-repeat background-size block-size border border-block border-bottom border-bottom-color border-bottom-left-radius border-bottom-right-radius border-bottom-style border-bottom-width border-collapse border-color border-image border-inline border-left border-left-color border-left-style border-left-width border-radius border-right border-right-color border-right-style border-right-width border-spacing border-style border-top border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width border-width bottom box-decoration-break box-shadow box-sizing break-after break-before break-inside caption-side caret-color clear clip clip-path color color-scheme column-count column-fill column-gap column-rule column-span column-width columns contain container container-name container-type content counter-increment counter-reset cursor direction display empty-cells fill filter flex flex-basis flex-direction flex-flow flex-grow flex-shrink flex-wrap float font font-family font-feature-settings font-kerning font-size font-size-adjust font-stretch font-style font-variant font-variant-numeric font-weight gap grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column grid-column-end grid-column-gap grid-column-start grid-gap grid-row grid-row-end grid-row-gap grid-row-start grid-template grid-template-areas grid-template-columns grid-template-rows height hyphens image-rendering inline-size inset inset-block inset-inline isolation justify-content justify-items justify-self left letter-spacing line-break line-height list-style list-style-image list-style-position list-style-type margin margin-block margin-bottom margin-inline margin-left margin-right margin-top mask mask-image max-block-size max-height max-inline-size max-width min-block-size min-height min-inline-size min-width mix-blend-mode object-fit object-position offset opacity order orphans outline outline-color outline-offset outline-style outline-width overflow overflow-anchor overflow-wrap overflow-x overflow-y overscroll-behavior padding padding-block padding-bottom padding-inline padding-left padding-right padding-top page-break-after page-break-before page-break-inside paint-order perspective perspective-origin place-content place-items place-self pointer-events position quotes resize right rotate row-gap scale scroll-behavior scroll-margin scroll-padding scroll-snap-align scroll-snap-type shape-outside stroke stroke-width tab-size table-layout text-align text-align-last text-decoration text-decoration-color text-decoration-line text-decoration-style text-decoration-thickness text-indent text-justify text-overflow text-shadow text-transform text-underline-offset top touch-action transform transform-origin transform-style transition transition-delay transition-duration transition-property transition-timing-function translate unicode-bidi user-select vertical-align visibility white-space widows width will-change word-break word-spacing word-wrap writing-mode z-index zoom`.split(/\s+/)

export const CSS_DOCS = {
  display: 'Sets how the element is laid out: block, inline, flex, grid, none …',
  position: 'Positioning scheme: static, relative, absolute, fixed or sticky.',
  flex: 'Shorthand for flex-grow, flex-shrink and flex-basis.',
  'flex-direction': 'Main axis of a flex container: row, row-reverse, column, column-reverse.',
  'justify-content': 'Aligns flex/grid items along the main axis (center, space-between, space-around …).',
  'align-items': 'Aligns flex/grid items along the cross axis (center, flex-start, stretch …).',
  gap: 'Space between rows and columns in flex and grid layouts.',
  grid: 'Shorthand for the grid layout properties.',
  'grid-template-columns': 'Defines the columns of a grid, e.g. repeat(3, 1fr).',
  margin: 'Outer spacing around an element. Shorthand for top / right / bottom / left.',
  padding: 'Inner spacing between the border and the content.',
  border: 'Shorthand: width style colour, e.g. 1px solid #ccc.',
  'border-radius': 'Rounds the corners of an element (use 50% for a circle).',
  background: 'Shorthand for colour, image, position, size and repeat of the background.',
  'background-color': 'Background colour of the element.',
  color: 'Text colour.',
  'font-size': 'Size of the text (px, rem, em, %).',
  'font-weight': 'Boldness of the text: 100–900, normal, bold.',
  'font-family': 'Font list in priority order, e.g. Inter, sans-serif.',
  'line-height': 'Height of each line of text; unitless values scale with font-size.',
  'text-align': 'Horizontal alignment of text: left, center, right, justify.',
  width: 'Width of the element.', height: 'Height of the element.', 'max-width': 'Largest width the element may grow to.',
  overflow: 'What happens when content is larger than the box: visible, hidden, scroll, auto.',
  'box-shadow': 'Adds a shadow: x y blur spread colour.',
  'box-sizing': 'border-box makes width/height include padding and border.',
  opacity: 'Transparency from 0 (invisible) to 1 (solid).',
  transition: 'Animates property changes: property duration timing-function delay.',
  transform: 'Moves, rotates, scales or skews an element.',
  animation: 'Runs a @keyframes animation.',
  cursor: 'Mouse pointer shown over the element.',
  'z-index': 'Stacking order of positioned elements.',
  'object-fit': 'How an image fills its box: cover, contain, fill, none.',
  'white-space': 'Controls wrapping of text and white-space handling.',
  'text-decoration': 'Underline, overline or line-through for text.',
  visibility: 'Hides an element but keeps its space (hidden / visible).',
}
export const JS_DOCS = {
  getElementById: 'document.getElementById(id) — returns the element with that id, or null.',
  querySelector: 'querySelector(css) — first element matching the CSS selector.',
  querySelectorAll: 'querySelectorAll(css) — a static NodeList of all matching elements.',
  addEventListener: 'target.addEventListener(type, handler, options) — runs handler when the event happens.',
  removeEventListener: 'Removes a handler added with addEventListener.',
  createElement: 'document.createElement(tag) — creates a new element.',
  appendChild: 'parent.appendChild(node) — adds a node as the last child.',
  classList: 'element.classList — add(), remove(), toggle(), contains() CSS classes.',
  innerHTML: 'Gets or sets the HTML inside an element (never insert untrusted text).',
  textContent: 'Gets or sets the plain text of an element.',
  setAttribute: 'element.setAttribute(name, value).',
  getAttribute: 'element.getAttribute(name).',
  setTimeout: 'setTimeout(fn, ms) — runs fn once after ms milliseconds.',
  setInterval: 'setInterval(fn, ms) — runs fn repeatedly every ms milliseconds.',
  clearInterval: 'Stops a timer created with setInterval.', clearTimeout: 'Cancels a timer created with setTimeout.',
  fetch: 'fetch(url, options) — returns a Promise<Response>. Cross-site requests need CORS.',
  log: 'console.log(…) — prints values to the console panel below the editor.',
  error: 'console.error(…) — prints an error message to the console panel.',
  parseInt: 'parseInt(text, radix) — converts text to an integer.', parseFloat: 'parseFloat(text) — converts text to a decimal number.',
  isNaN: 'isNaN(value) — true when the value is not a number.',
  random: 'Math.random() — a number from 0 (inclusive) to 1 (exclusive).', floor: 'Math.floor(x) — rounds down.', round: 'Math.round(x) — rounds to nearest integer.',
  map: 'array.map(fn) — new array with fn applied to every item.', filter: 'array.filter(fn) — new array of items for which fn returns true.',
  forEach: 'array.forEach(fn) — runs fn for each item.', reduce: 'array.reduce(fn, start) — folds an array into one value.',
  push: 'array.push(item) — adds to the end.', join: 'array.join(sep) — joins items into a string.',
  JSON: 'JSON.parse(text) / JSON.stringify(value).', Date: 'new Date() — current date and time.',
  alert: 'alert(message) — shows a dialog.', confirm: 'confirm(message) — returns true/false.',
}
export const HTML_DOCS = {
  div: 'Generic block container.', span: 'Generic inline container.', p: 'Paragraph.', a: 'Hyperlink — use the href attribute.',
  img: 'Image — needs src and alt.', ul: 'Unordered (bulleted) list.', ol: 'Ordered (numbered) list.', li: 'List item.',
  table: 'Table of rows and cells.', tr: 'Table row.', td: 'Table data cell.', th: 'Table header cell.',
  h1: 'Top-level heading.', h2: 'Section heading.', h3: 'Sub-section heading.', button: 'Clickable button.', input: 'Form input field.',
  form: 'Form that groups inputs.', label: 'Caption for a form control.', section: 'Thematic section of a page.', header: 'Introductory content.',
  footer: 'Footer content.', nav: 'Navigation links.', strong: 'Important text (bold).', em: 'Emphasised text (italic).',
  video: 'Embedded video player.', iframe: 'Embedded page.', canvas: 'Drawing surface for JavaScript.', pre: 'Preformatted text.', code: 'Inline code.',
  class: 'CSS class names for the element.', id: 'Unique identifier of the element.', href: 'Link destination.', src: 'Address of the resource.', alt: 'Alternative text for accessibility.', style: 'Inline CSS.',
}

export const SNIPPETS = {
  html: [
    { label: 'html5', detail: 'HTML5 page', apply: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${1:Title}</title>\n</head>\n<body>\n  ${2}\n</body>\n</html>' },
    { label: 'card', detail: 'Bootstrap-style card', apply: '<div class="card">\n  <div class="card-body">\n    <h5 class="card-title">${1:Title}</h5>\n    <p class="card-text">${2:Text}</p>\n  </div>\n</div>' },
    { label: 'table', detail: 'Table 2×2', apply: '<table>\n  <thead>\n    <tr><th>${1:Head}</th><th>Head</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>${2:Cell}</td><td>Cell</td></tr>\n  </tbody>\n</table>' },
    { label: 'form', detail: 'Form with input', apply: '<form>\n  <label for="${1:name}">${2:Name}</label>\n  <input type="text" id="${1:name}" name="${1:name}">\n  <button type="submit">Submit</button>\n</form>' },
    { label: 'list', detail: 'Unordered list', apply: '<ul>\n  <li>${1:Item}</li>\n  <li>Item</li>\n</ul>' },
    { label: 'image', detail: 'Figure with caption', apply: '<figure>\n  <img src="${1}" alt="${2}">\n  <figcaption>${3:Caption}</figcaption>\n</figure>' },
    { label: 'details', detail: 'Collapsible section', apply: '<details>\n  <summary>${1:Title}</summary>\n  ${2:Content}\n</details>' },
    { label: 'button-js', detail: 'Button + id for JS', apply: '<button id="${1:btn}" class="${2:btn}">${3:Click me}</button>' },
  ],
  css: [
    { label: 'flex-center', detail: 'Centre with flexbox', apply: 'display: flex;\nalign-items: center;\njustify-content: center;' },
    { label: 'grid-3', detail: '3-column grid', apply: 'display: grid;\ngrid-template-columns: repeat(3, 1fr);\ngap: ${1:16px};' },
    { label: 'media-mobile', detail: '@media (max-width)', apply: '@media (max-width: ${1:600px}) {\n  ${2}\n}' },
    { label: 'keyframes', detail: '@keyframes animation', apply: '@keyframes ${1:fade} {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}' },
    { label: 'transition', detail: 'Smooth transition', apply: 'transition: ${1:all} ${2:0.3s} ${3:ease};' },
    { label: 'card-shadow', detail: 'Card look', apply: 'background: #fff;\nborder-radius: 12px;\nbox-shadow: 0 6px 18px rgba(15, 23, 42, 0.1);\npadding: 16px;' },
    { label: 'text-ellipsis', detail: 'Single-line ellipsis', apply: 'white-space: nowrap;\noverflow: hidden;\ntext-overflow: ellipsis;' },
    { label: 'root-vars', detail: ':root variables', apply: ':root {\n  --primary: ${1:#2563eb};\n}' },
  ],
  js: [
    { label: 'onclick', detail: 'Click handler by id', apply: "document.getElementById('${1:id}').addEventListener('click', () => {\n  ${2}\n})" },
    { label: 'qsa-loop', detail: 'Loop over elements', apply: "document.querySelectorAll('${1:.item}').forEach((el) => {\n  ${2}\n})" },
    { label: 'for-of', detail: 'for…of loop', apply: 'for (const ${1:item} of ${2:items}) {\n  ${3}\n}' },
    { label: 'fn', detail: 'Function', apply: 'function ${1:name}(${2}) {\n  ${3}\n}' },
    { label: 'arrow', detail: 'Arrow function', apply: 'const ${1:name} = (${2}) => {\n  ${3}\n}' },
    { label: 'fetch-json', detail: 'fetch JSON', apply: "fetch('${1:https://}')\n  .then((r) => r.json())\n  .then((data) => {\n    console.log(data)\n  })\n  .catch((err) => console.error(err))" },
    { label: 'toggle-class', detail: 'Toggle CSS class', apply: "${1:el}.classList.toggle('${2:active}')" },
    { label: 'timeout', detail: 'setTimeout', apply: 'setTimeout(() => {\n  ${1}\n}, ${2:1000})' },
    { label: 'clog', detail: 'console.log', apply: 'console.log(${1})' },
  ],
}

export const UNITS = ['px', 'em', 'rem', '%', 'vh', 'vw', 'vmin', 'vmax', 'ch', 'fr', 's', 'ms', 'deg']
export const JSON_KEYS = ['type', 'title', 'summary', 'description', 'hero', 'label', 'heading', 'image', 'src', 'alt', 'caption', 'points', 'keyPoints', 'pointsTitle', 'sections', 'text', 'paragraphs', 'list', 'takeaway', 'note', 'example', 'formula', 'quote', 'table', 'columns', 'rows', 'mcq', 'question', 'options', 'answer', 'explanation', 'html', 'keyTakeaway', 'allowHtml', 'icon']

/** class names / ids found in a piece of HTML or CSS source */
export function collectNames(src = '', kind = 'html') {
  const classes = new Set(); const ids = new Set(); let m
  if (kind === 'html') {
    const ce = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi; while ((m = ce.exec(src))) String(m[1] ?? m[2]).split(/\s+/).filter(Boolean).forEach((c) => classes.add(c))
    const ie = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi; while ((m = ie.exec(src))) { const v = (m[1] ?? m[2]).trim(); if (v) ids.add(v) }
  } else {
    const re = /([.#])(-?[_a-zA-Z][\w-]*)(?=[^{};]*\{)/g; while ((m = re.exec(src))) (m[1] === '.' ? classes : ids).add(m[2])
  }
  return { classes: [...classes], ids: [...ids] }
}

/** Structural HTML checks: unclosed / unexpected tags, duplicate ids, images without alt. Returns [{from,to,severity,message}] */
export function lintHtml(src) {
  const out = []; const stack = []; const ids = new Map()
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param'])
  const OPTIONAL = new Set(['li', 'p', 'td', 'th', 'tr', 'tbody', 'thead', 'tfoot', 'option', 'dt', 'dd', 'colgroup', 'caption'])
  const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g
  let m
  while ((m = re.exec(src))) {
    if (!m[2]) continue
    const name = m[2].toLowerCase(); const closing = m[0][1] === '/'; const selfClose = /\/\s*>$/.test(m[0])
    if (!closing) {
      const idm = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[3] || ''); const idv = idm && (idm[1] ?? idm[2])
      if (idv) { if (ids.has(idv)) out.push({ from: m.index, to: m.index + m[0].length, severity: 'warning', message: `Duplicate id "${idv}" — ids must be unique.` }); else ids.set(idv, m.index) }
      if (name === 'img' && !/\balt\s*=/i.test(m[3] || '')) out.push({ from: m.index, to: m.index + m[0].length, severity: 'info', message: 'Image has no alt text (needed for accessibility).' })
      if (!VOID.has(name) && !selfClose) stack.push({ name, from: m.index, to: m.index + m[0].length })
    } else if (!VOID.has(name)) {
      let k = stack.length - 1; while (k >= 0 && stack[k].name !== name) k--
      if (k < 0) { out.push({ from: m.index, to: m.index + m[0].length, severity: 'error', message: `Unexpected closing tag </${name}> — there is no matching <${name}>.` }); continue }
      for (let j = stack.length - 1; j > k; j--) { const o = stack[j]; if (!OPTIONAL.has(o.name)) out.push({ from: o.from, to: o.to, severity: 'error', message: `<${o.name}> is not closed.` }) }
      stack.length = k
    }
  }
  stack.forEach((o) => { if (!OPTIONAL.has(o.name)) out.push({ from: o.from, to: o.to, severity: 'error', message: `<${o.name}> is not closed.` }) })
  return out
}
const PROP_SET = new Set(CSS_PROPS)
/** Warn about unknown CSS properties (typos) */
export function lintCssProps(src) {
  const out = []
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length))
  const re = /([{;]\s*)([a-zA-Z-][\w-]*)\s*:(?!\s*:)/g; let m
  while ((m = re.exec(clean))) {
    const prop = m[2].toLowerCase()
    if (prop.startsWith('-') || PROP_SET.has(prop)) continue
    // skip selectors like  a:hover {  — a real declaration is followed by a value and ends with ; or }
    const rest = clean.slice(m.index + m[0].length, m.index + m[0].length + 200); const end = rest.search(/[;}{]/)
    if (end < 0 || rest[end] === '{') continue
    const from = m.index + m[1].length
    out.push({ from, to: from + prop.length, severity: 'warning', message: `Unknown CSS property "${prop}". Check the spelling.` })
  }
  return out
}
