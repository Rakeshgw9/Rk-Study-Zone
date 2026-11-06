import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { EditorView } from '@codemirror/view'

const langs = { html: () => html(), css: () => css(), js: () => javascript(), json: () => json() }

export default function CodeEditor({ value, onChange, lang = 'html', height = '260px', placeholder, ariaLabel }) {
  return (
    <div className="code-editor" aria-label={ariaLabel}>
      <CodeMirror
        value={value}
        height={height}
        theme={vscodeDark}
        extensions={[langs[lang](), EditorView.lineWrapping]}
        onChange={onChange}
        placeholder={placeholder}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true, bracketMatching: true, closeBrackets: true, tabSize: 2 }}
      />
    </div>
  )
}
