/* Shared helpers for rich editing. The three functions below are SELF-CONTAINED on purpose:
   they run in the app (local contentEditable) AND are serialised into the sandboxed preview iframe with Function#toString(). */
import { sanitizeHtml } from './richText'

/** Run one formatting command on the current selection of `doc`. */
export function execRich(doc, name, value) {
  var run = function (c, v) { try { return doc.execCommand(c, false, v) } catch (e) { return false } }
  run('styleWithCSS', true)
  if (name === 'fontSizePx') {
    run('fontSize', '7')
    var nodes = doc.querySelectorAll('font[size="7"], span[style*="xxx-large"]')
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]
      if (n.tagName === 'FONT') { var sp = doc.createElement('span'); sp.style.fontSize = value + 'px'; while (n.firstChild) sp.appendChild(n.firstChild); n.parentNode.replaceChild(sp, n) } else { n.style.fontSize = value + 'px' }
    }
    return
  }
  if (name === 'hiliteColor') { if (!run('hiliteColor', value)) run('backColor', value); return }
  if (name === 'clearFormat') { run('removeFormat'); run('unlink'); return }
  if (name === 'tableInsert') { run('insertHTML', value); return }
  run(name, value)
}
/** Which formats are active at the caret/selection. */
export function queryRich(doc) {
  var q = function (c) { try { return !!doc.queryCommandState(c) } catch (e) { return false } }
  var align = q('justifyCenter') ? 'center' : q('justifyRight') ? 'right' : q('justifyFull') ? 'justify' : 'left'
  return { bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'), sub: q('subscript'), sup: q('superscript'), ul: q('insertUnorderedList'), ol: q('insertOrderedList'), align: align }
}
/** Outermost elements that directly contain text. Same order in the preview iframe and in a DOMParser copy of the source. */
export function collectEditable(root) {
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, SVG: 1, IFRAME: 1, HEAD: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1 }
  var out = []
  var walk = function (el) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (SKIP[c.tagName.toUpperCase()] || c.getAttribute('data-rk-ui')) continue
      var direct = false
      for (var n = c.firstChild; n; n = n.nextSibling) { if (n.nodeType === 3 && n.nodeValue.replace(/\s+/g, '') !== '') { direct = true; break } }
      if (direct) out.push(c); else walk(c)
    }
  }
  walk(root)
  return out
}

/** Replace the inner HTML of the i-th editable element of an HTML block's source. */
export function applyHtmlEdit(source, index, innerHtml) {
  if (typeof DOMParser === 'undefined') return source
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${source}</body></html>`, 'text/html')
  const el = collectEditable(doc.body)[index]
  if (!el) return source
  el.innerHTML = sanitizeHtml(innerHtml)
  return doc.body.innerHTML
}

/** Tag every <img> in the source (in order) so the preview can tell the builder which one was clicked. */
export const tagImages = (html = '') => { let i = 0; return String(html).replace(/<img\b/gi, () => `<img data-rk-img="${i++}"`) }
const IMG_RE = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi
export function listImages(html = '') {
  const out = []; let m
  IMG_RE.lastIndex = 0
  while ((m = IMG_RE.exec(html))) {
    const attrs = {}; const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g; let a
    while ((a = re.exec(m[0]))) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? ''
    out.push({ index: out.length, start: m.index, end: m.index + m[0].length, tag: m[0], attrs })
  }
  return out
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
/** Rewrite one <img> tag of the source (string edit – the rest of the user's HTML is untouched). */
export function updateImage(html, index, patch) {
  const imgs = listImages(html); const img = imgs[index]; if (!img) return html
  const attrs = { ...img.attrs, ...patch }
  const keep = ['src', 'alt', 'width', 'height', 'class', 'id', 'style', 'title', 'loading']
  const rest = Object.entries(img.attrs).filter(([k]) => !keep.includes(k) && !(k in patch)).map(([k, v]) => `${k}="${esc(v)}"`)
  const known = keep.filter((k) => attrs[k] !== undefined && attrs[k] !== '' && attrs[k] !== null).map((k) => `${k}="${esc(attrs[k])}"`)
  return html.slice(0, img.start) + `<img ${[...known, ...rest].join(' ')}>` + html.slice(img.end)
}
export function removeImage(html, index) { const img = listImages(html)[index]; return img ? html.slice(0, img.start) + html.slice(img.end) : html }

/** Set a value in parsed JSON by a dotted path like "sections.1.table.rows.0.2". Objects with a "text" field keep their shape. */
export function setByPath(root, path, value) {
  const keys = String(path).split('.'); let cur = root
  for (let i = 0; i < keys.length - 1; i++) { cur = cur?.[keys[i]]; if (cur === undefined || cur === null) return false }
  const last = keys[keys.length - 1]; const old = cur[last]
  if (old && typeof old === 'object' && !Array.isArray(old) && typeof old.text === 'string') old.text = value
  else cur[last] = value
  return true
}

/** The script injected into the preview iframe (commands + on-canvas editing + image hover actions). */
export function bridgeScript(frameId, { editMode = null, imageTools = false } = {}) {
  if (!editMode && !imageTools) return ''
  return `(function(){
var id=${JSON.stringify(frameId)};var mode=${JSON.stringify(editMode)};var imgTools=${imageTools ? 'true' : 'false'};
var execRich=${execRich.toString()};var queryRich=${queryRich.toString()};var collectEditable=${collectEditable.toString()};
function post(m){m.rkFrame=id;parent.postMessage(m,'*')}
var active=null,saved=null,timer=null;
if(mode){
  var st=document.createElement('style');st.textContent='[contenteditable="true"]{outline:1px dashed rgba(59,130,246,.55);outline-offset:2px;cursor:text;min-height:1em}[contenteditable="true"]:focus{outline:2px solid #3b82f6}';document.head.appendChild(st);
  var els=mode==='json'?[].slice.call(document.querySelectorAll('[data-rk-path]')):collectEditable(document.body);
  els.forEach(function(el,i){el.setAttribute('data-rk-i',i);el.contentEditable='true';el.spellcheck=false});
  var send=function(){if(!active)return;var p=active.getAttribute('data-rk-path');post({edit:p?{path:p,html:active.innerHTML}:{index:Number(active.getAttribute('data-rk-i')),html:active.innerHTML}})};
  var later=function(){clearTimeout(timer);timer=setTimeout(send,400)};
  document.addEventListener('focusin',function(e){var el=e.target.closest&&e.target.closest('[contenteditable="true"]');if(el){active=el;post({focus:true})}});
  document.addEventListener('focusout',function(e){if(active&&e.target===active){clearTimeout(timer);send()}});
  document.addEventListener('input',later);
  document.addEventListener('selectionchange',function(){var s=document.getSelection();if(active&&s.rangeCount&&active.contains(s.anchorNode)){saved=s.getRangeAt(0).cloneRange();post({state:queryRich(document)})}});
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(a)e.preventDefault()},true);
  window.addEventListener('message',function(e){var d=e.data;if(!d||d.rkTo!==id||d.cmd!=='exec')return;if(!active)return;active.focus();if(saved){var s=document.getSelection();s.removeAllRanges();s.addRange(saved)}execRich(document,d.name,d.value);var s2=document.getSelection();if(s2.rangeCount)saved=s2.getRangeAt(0).cloneRange();post({state:queryRich(document)});later()});
}
if(imgTools){
  var bar=document.createElement('div');bar.setAttribute('data-rk-ui','1');
  bar.style.cssText='position:absolute;z-index:99999;display:none;gap:4px;background:#111827;padding:4px;border-radius:9px;box-shadow:0 6px 18px rgba(0,0,0,.4);font:600 12px Inter,sans-serif';
  [['edit','✎ Edit'],['change','⇄ Change image'],['upload','⬆ Upload'],['remove','🗑 Remove']].forEach(function(b){var x=document.createElement('button');x.type='button';x.textContent=b[1];x.setAttribute('data-a',b[0]);x.style.cssText='border:0;border-radius:6px;padding:4px 8px;cursor:pointer;color:#fff;background:'+(b[0]==='remove'?'#b91c1c':b[0]==='change'?'#7c3aed':'#334155');bar.appendChild(x)});
  document.body.appendChild(bar);var cur=null,hideT=null;
  var hide=function(){bar.style.display='none';if(cur){cur.style.outline=cur.getAttribute('data-rk-o')||'';cur=null}};
  var show=function(img){clearTimeout(hideT);if(cur&&cur!==img)hide();cur=img;if(!img.hasAttribute('data-rk-o'))img.setAttribute('data-rk-o',img.style.outline||'');img.style.outline='2px solid #8b5cf6';bar.style.display='flex';var r=img.getBoundingClientRect();bar.style.top=Math.max(0,window.pageYOffset+r.top+6)+'px';bar.style.left=Math.max(0,window.pageXOffset+r.left+r.width/2-bar.offsetWidth/2)+'px'};
  document.addEventListener('mouseover',function(e){var t=e.target;if(t.closest&&t.closest('[data-rk-ui]')){clearTimeout(hideT);return}var img=t.closest&&t.closest('img[data-rk-img]');if(img)show(img)});
  document.addEventListener('mouseout',function(e){var t=e.target;if((t.closest&&(t.closest('img[data-rk-img]')||t.closest('[data-rk-ui]')))){clearTimeout(hideT);hideT=setTimeout(hide,350)}});
  bar.addEventListener('click',function(e){var b=e.target.closest('button');if(!b||!cur)return;e.preventDefault();e.stopPropagation();post({img:{i:Number(cur.getAttribute('data-rk-img')),action:b.getAttribute('data-a')}});hide()});
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(a)e.preventDefault()},true);
}
})();`
}
