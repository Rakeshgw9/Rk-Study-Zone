// Mirrors lib/jsonStudio.js → studioCss() into src/styles/jsonStudio.css (between the markers).
// Run:  npm run sync:css      (tests/jsonStudio.test.mjs fails if the file is out of date)
import { readFileSync, writeFileSync } from 'node:fs'
import { studioCss } from '../src/lib/jsonStudio.js'

export const START = '/* @studio-css:start — generated from studioCss() in src/lib/jsonStudio.js. Do not edit by hand: run `npm run sync:css`. */'
export const END = '/* @studio-css:end */'
const file = new URL('../src/styles/jsonStudio.css', import.meta.url)
const css = readFileSync(file, 'utf8')
const block = `${START}${studioCss()}${END}`
const a = css.indexOf('/* @studio-css:start'); const b = css.indexOf(END)
const next = a >= 0 && b > a ? css.slice(0, a) + block + css.slice(b + END.length) : `${css.trimEnd()}\n\n${block}\n`
if (next !== css) writeFileSync(file, next)
console.log(next === css ? 'jsonStudio.css already up to date' : 'jsonStudio.css updated')
