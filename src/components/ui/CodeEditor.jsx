import { useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript, javascriptLanguage, scopeCompletionSource } from '@codemirror/lang-javascript'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { Decoration, EditorView, ViewPlugin, WidgetType, hoverTooltip, keymap } from '@codemirror/view'
import { EditorState, Prec } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { snippetCompletion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { linter, lintGutter } from '@codemirror/lint'
import { CSS_DOCS, HTML_DOCS, JS_DOCS, JSON_KEYS, SNIPPETS, UNITS, collectNames, lintCssProps, lintHtml } from '../../lib/codeHints'
import { abbrBefore, expandEmmet } from '../../lib/emmet'

const langs = { html: () => html({ autoCloseTags: true, matchClosingTags: true }), css: () => css(), js: () => javascript(), json: () => json() }
const DOCS = { css: CSS_DOCS, js: JS_DOCS, html: HTML_DOCS }

/* ---- completion sources (added through language data, so they work next to the built-in HTML / CSS / JS completions) ---- */
const snippetSource = (lang) => {
  const items = (SNIPPETS[lang] || []).map((s) => snippetCompletion(s.apply, { label: s.label, detail: s.detail, type: 'text', boost: -2 }))
  return (ctx) => {
    const w = ctx.matchBefore(/[\w-]+/)
    if (!w || (w.from === w.to && !ctx.explicit)) return null
    if (lang === 'html') { const line = ctx.state.doc.lineAt(ctx.pos); if (/<[^>]*$/.test(line.text.slice(0, ctx.pos - line.from))) return null }
    return { from: w.from, options: items, validFor: /^[\w-]*$/ }
  }
}
const cssNamesSource = (getHtml) => (ctx) => {
  const w = ctx.matchBefore(/[.#][\w-]*/); if (!w) return null
  const line = ctx.state.doc.lineAt(ctx.pos); const before = line.text.slice(0, w.from - line.from)
  if (/[\w)]$/.test(before) || /:[^;{}]*$/.test(before)) return null
  const { classes, ids } = collectNames(getHtml?.() || '', 'html'); const list = w.text[0] === '.' ? classes : ids
  return list.length ? { from: w.from + 1, options: list.map((n) => ({ label: n, type: w.text[0] === '.' ? 'class' : 'constant', detail: 'from HTML' })), validFor: /^[\w-]*$/ } : null
}
const htmlAttrSource = (getCss) => (ctx) => {
  const line = ctx.state.doc.lineAt(ctx.pos); const before = line.text.slice(0, ctx.pos - line.from)
  const m = /\b(class|id)\s*=\s*(["'])([^"']*)$/.exec(before); if (!m) return null
  const word = /[\w-]*$/.exec(before)[0]; const names = collectNames(getCss?.() || '', 'css'); const own = collectNames(ctx.state.doc.toString(), 'html')
  const list = [...new Set([...(m[1] === 'class' ? names.classes : names.ids), ...(m[1] === 'class' ? own.classes : [])])]
  return list.length ? { from: ctx.pos - word.length, options: list.map((n) => ({ label: n, type: m[1] === 'class' ? 'class' : 'constant', detail: 'from CSS' })), validFor: /^[\w-]*$/ } : null
}
const unitSource = (ctx) => {
  const w = ctx.matchBefore(/-?\d+(\.\d+)?[a-z%]*$/); if (!w) return null
  const num = /^-?\d+(\.\d+)?/.exec(w.text)[0]
  return { from: w.from + num.length, options: UNITS.map((u) => ({ label: u, type: 'keyword', detail: 'unit' })), validFor: /^[a-z%]*$/ }
}
const jsonKeySource = (keys) => (ctx) => {
  const w = ctx.matchBefore(/"[\w-]*$/); if (!w) return null
  const line = ctx.state.doc.lineAt(ctx.pos); if (/:\s*"[^"]*$/.test(line.text.slice(0, ctx.pos - line.from))) return null // value, not a key
  return { from: w.from + 1, options: keys.map((k) => ({ label: k, type: 'property' })), validFor: /^[\w-]*$/ }
}

/* ---- hover documentation ---- */
const hoverDocs = (lang) => hoverTooltip((view, pos) => {
  const docs = DOCS[lang]; if (!docs) return null
  const line = view.state.doc.lineAt(pos); const off = pos - line.from; const re = /[\w-]+/g; let m
  while ((m = re.exec(line.text))) {
    if (m.index <= off && off <= m.index + m[0].length) {
      const text = docs[m[0]]; if (!text) return null
      return { pos: line.from + m.index, end: line.from + m.index + m[0].length, above: true, create() { const dom = document.createElement('div'); dom.className = 'cm-hover-doc'; const b = document.createElement('b'); b.textContent = m[0]; const s = document.createElement('span'); s.textContent = ` — ${text}`; dom.append(b, s); return { dom } } }
    }
  }
  return null
}, { hoverTime: 250 })

/* ---- diagnostics ---- */
const lintExt = (lang) => {
  if (lang === 'json') return linter(jsonParseLinter(), { delay: 300 })
  return linter((view) => {
    const doc = view.state.doc; const text = doc.toString(); const out = []
    const clamp = (d) => ({ ...d, from: Math.max(0, Math.min(d.from, doc.length)), to: Math.max(0, Math.min(Math.max(d.to, d.from + 1), doc.length)) })
    syntaxTree(view.state).iterate({ enter(n) { if (n.type.isError && out.length < 15) out.push({ from: n.from, to: n.to, severity: 'error', message: 'Syntax error — check brackets, quotes and commas.' }) } })
    if (lang === 'html') out.push(...lintHtml(text))
    if (lang === 'css') out.push(...lintCssProps(text))
    if (lang === 'js' && !out.length && text.trim()) { try { new Function(text) } catch (e) { out.push({ from: 0, to: Math.min(doc.length, 1), severity: 'error', message: `Syntax error: ${e.message}` }) } }
    return out.map(clamp).slice(0, 40)
  }, { delay: 450 })
}

/* ---- inline colour picker for CSS ---- */
const full = (c) => (c.length === 4 ? `#${[...c.slice(1)].map((x) => x + x).join('')}` : c)
class Swatch extends WidgetType {
  constructor(color, from, to) { super(); this.color = color; this.from = from; this.to = to }
  eq(o) { return o.color === this.color && o.from === this.from }
  toDOM(view) {
    const i = document.createElement('input'); i.type = 'color'; i.className = 'cm-swatch'; i.value = full(this.color); i.title = 'Pick colour'
    i.addEventListener('change', () => view.dispatch({ changes: { from: this.from, to: this.to, insert: i.value } }))
    return i
  }
  ignoreEvent() { return true }
}
const buildSwatches = (view) => {
  const out = []
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to); const re = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g; let m
    while ((m = re.exec(text))) { const a = from + m.index; out.push(Decoration.widget({ widget: new Swatch(m[0], a, a + m[0].length), side: -1 }).range(a)) }
  }
  return Decoration.set(out, true)
}
const colorPicker = ViewPlugin.fromClass(class { constructor(view) { this.decorations = buildSwatches(view) } update(u) { if (u.docChanged || u.viewportChanged) this.decorations = buildSwatches(u.view) } }, { decorations: (v) => v.decorations })

/* ---- Emmet: Tab expands e.g. ul>li*3 ---- */
const emmetTab = (view) => {
  const sel = view.state.selection.main; if (!sel.empty) return false
  const line = view.state.doc.lineAt(sel.head); const before = line.text.slice(0, sel.head - line.from)
  const { abbr, offset } = abbrBefore(before); if (!abbr) return false
  const res = expandEmmet(abbr); if (!res) return false
  const indent = /^\s*/.exec(line.text)[0]
  const text = res.text.replace(/\n/g, `\n${indent}`)
  const cursor = res.cursor + (res.text.slice(0, res.cursor).match(/\n/g) || []).length * indent.length
  const from = line.from + offset
  view.dispatch({ changes: { from, to: sel.head, insert: text }, selection: { anchor: from + cursor }, scrollIntoView: true })
  return true
}

const baseTheme = EditorView.theme({ '&': { fontSize: '13.5px' }, '.cm-scroller': { fontFamily: "'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace", lineHeight: '1.55' } })

/**
 * Professional code editor (CodeMirror 6): auto-complete, snippets, Emmet (Tab), auto-close tags/brackets, folding, bracket matching,
 * find & replace (Ctrl+F), multi-cursor (Ctrl+D / Alt+click), hover docs, inline errors, CSS colour picker, light & dark themes.
 */
export default function CodeEditor({ value, onChange, lang = 'html', height = '260px', placeholder, ariaLabel, dark = true, onReady, getHtml, getCss, onFormat, jsonKeys }) {
  const refs = useRef({})
  refs.current = { getHtml, getCss, onFormat }
  const extensions = useMemo(() => {
    const ext = [baseTheme, EditorView.lineWrapping, langs[lang](), lintExt(lang), lintGutter(), hoverDocs(lang)]
    ext.push(Prec.high(keymap.of([{ key: 'Mod-Shift-f', preventDefault: true, run: () => { refs.current.onFormat?.(); return true } }])))
    const sources = []
    if (lang === 'html') { ext.push(Prec.high(keymap.of([{ key: 'Tab', run: emmetTab }]))); sources.push(snippetSource('html'), htmlAttrSource(() => refs.current.getCss?.())) }
    if (lang === 'css') { ext.push(colorPicker); sources.push(snippetSource('css'), cssNamesSource(() => refs.current.getHtml?.()), unitSource) }
    if (lang === 'js') { ext.push(javascriptLanguage.data.of({ autocomplete: scopeCompletionSource(globalThis) })); sources.push(snippetSource('js')) }
    if (lang === 'json') sources.push(jsonKeySource(jsonKeys || JSON_KEYS))
    ext.push(EditorState.languageData.of(() => sources.map((s) => ({ autocomplete: s }))))
    ext.push(keymap.of([indentWithTab]))
    return ext
  }, [lang, jsonKeys])

  return (
    <div className={`code-editor ${dark ? '' : 'is-light'}`} aria-label={ariaLabel}>
      <CodeMirror
        value={value}
        height={height}
        theme={dark ? vscodeDark : 'light'}
        extensions={extensions}
        onChange={onChange}
        placeholder={placeholder}
        onCreateEditor={(view) => onReady?.(view)}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, highlightActiveLineGutter: true, autocompletion: true, bracketMatching: true, closeBrackets: true, indentOnInput: true, allowMultipleSelections: true, rectangularSelection: true, crosshairCursor: true, highlightSelectionMatches: true, searchKeymap: true, tabSize: 2 }}
      />
    </div>
  )
}
