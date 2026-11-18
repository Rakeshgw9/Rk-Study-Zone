// Run with:  npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DARK_THEMES, LIGHT_THEMES, JSON_THEMES, DEFAULT_THEME, STUDIO_TEMPLATE, STUDIO_TEMPLATE_JSON,
  normalizeToSections, normalizeSection, buildStudioJson, duplicateSection, moveSection, moveSectionTo, arrayMove, removeSection, addSectionBelow,
  setSectionValue, setSectionTheme, tableAddRow, tableAddCol, tableRemoveCol, mutateSection, renderStudioHtml, studioCss, SECTION_TYPE_IDS, newSection,
  dupItem, moveItem, moveItemTo, removeItem, addParagraph, addFormula, addExample, normalizeTextStyle, textStyleVars, nativeStudio, studioFromJson,
  SECTION_SCHEMA, QUICK_ADD, fmt, sectionTitle,
  OPTIONAL_SECTION_TYPE_IDS, MEDIA_SECTION_TYPE_IDS, PRESET_BLOCKS, insertSectionAt, duplicateSectionById, removeSectionById, editStudioJson, parseYouTube, youtubeEmbedUrl, youtubeWatchUrl, safeImageUrl, normalizeControls, compactSections,
} from '../src/lib/jsonStudio.js'
import { validateLessonJson, SAMPLE_LESSON } from '../src/lib/jsonLesson.js'
import { frameProps } from '../src/lib/blockRender.js'
import { jsonOutline } from '../src/lib/sectionFinder.js'

const studio = (sections, extra = {}) => JSON.stringify({ type: 'studio', ...extra, sections })

test('theme registry: 8 dark + 8 light, midnight-slate is the default', () => {
  assert.equal(DARK_THEMES.length, 8)
  assert.equal(LIGHT_THEMES.length, 8)
  assert.equal(new Set(JSON_THEMES.map((t) => t.id)).size, 16)
  assert.equal(DEFAULT_THEME, 'midnight-slate')
  assert.ok(DARK_THEMES.every((t) => t.mode === 'dark') && LIGHT_THEMES.every((t) => t.mode === 'light'))
  const css = studioCss()
  JSON_THEMES.forEach((t) => {
    assert.ok(css.includes(`.json-artboard-content[data-theme="${t.id}"]`), t.id)
    assert.ok(css.includes(`.js-sec[data-theme="${t.id}"]`), `${t.id} per-section override`)
  })
  assert.ok(css.includes('max-height:1000px') && css.includes('overflow-y:auto'))
  assert.ok(css.includes('.js-full{max-height:none') || css.includes('.js-full{') )
})

test('default guide / template / quick-add stay on the 5 core types; callout_formula and media sections are optional presets', () => {
  assert.deepEqual(SECTION_TYPE_IDS, ['heading_paragraph', 'structured_header', 'heading_list', 'heading_table', 'heading_example'])
  assert.ok(!SECTION_TYPE_IDS.some((t) => /callout_formula|image|youtube/.test(t)))
  assert.ok(!QUICK_ADD.some((q) => /callout_formula|image|youtube/.test(q.type)))
  assert.ok(!/callout_formula|heading_image|heading_youtube|imageUrl/.test(STUDIO_TEMPLATE_JSON))
  const v = validateLessonJson(STUDIO_TEMPLATE_JSON)
  assert.equal(v.ok, true, JSON.stringify(v.errors))
  SECTION_TYPE_IDS.forEach((t) => {
    const r = validateLessonJson(studio([newSection(t)]))
    assert.equal(r.ok, true, t + JSON.stringify(r.errors))
  })
  OPTIONAL_SECTION_TYPE_IDS.forEach((t) => {
    const r = validateLessonJson(studio([newSection(t)]))
    assert.equal(r.ok, true, t + JSON.stringify(r.errors))
  })
})

test('validation catches bad studio sections', () => {
  const bad = (s) => validateLessonJson(JSON.stringify({ sections: [s] }))
  assert.equal(bad({ type: 'heading_list', heading: 'x', listStyle: 'dots', items: [] }).ok, false)
  assert.equal(bad({ type: 'heading_table', headers: 'a', rows: [] }).ok, false)
  assert.equal(bad({ type: 'heading_table', headers: ['a'], rows: ['x'] }).ok, false)
  assert.equal(bad({ type: 'nope', heading: 'x' }).ok, false)
  assert.equal(bad({ type: 'heading_paragraph', heading: 5 }).ok, false)
  assert.equal(bad({ type: 'heading_paragraph', heading: 'x', paragraphs: [{ odiaText: 'ok' }] }).ok, false) // item needs "text"
  assert.equal(bad({ type: 'heading_paragraph', heading: 'x', paragraphs: [5] }).ok, false)
  assert.equal(bad({ type: 'callout_formula', formulas: 'x' }).ok, false)
  assert.equal(bad({ type: 'callout_formula', formulas: [{ expression: 5 }] }).ok, false)
  assert.equal(bad({ type: 'heading_example', examples: [{ detail: 'x', odiaExplain: 5 }] }).ok, false)
  const w = validateLessonJson(JSON.stringify({ theme: 'nope', sections: [{ type: 'heading_paragraph', heading: 'x', paragraphs: ['y'], theme: 'also-nope' }] }))
  assert.equal(w.ok, true)
  assert.ok(w.warnings.some((m) => /theme/i.test(m)))
  assert.ok(w.warnings.some((m) => /sections\[0\]\.theme/.test(m)))
})

test('backward compatible: older shapes normalise in memory without errors', () => {
  const n = normalizeSection({ type: 'heading_paragraph', heading: 'H', text: 'Old single text' })
  assert.deepEqual(n.paragraphs, [{ text: 'Old single text', odiaText: '' }])
  assert.equal(n.text, undefined)
  assert.deepEqual(normalizeSection({ type: 'heading_paragraph', paragraphs: ['a', { text: 'b', odiaText: 'ଓ' }] }).paragraphs, [{ text: 'a', odiaText: '' }, { text: 'b', odiaText: 'ଓ' }])
  assert.deepEqual(normalizeSection({ type: 'heading_list', items: ['x', 'y'] }).items.map((i) => i.text), ['x', 'y'])
  const f = normalizeSection({ type: 'callout_formula', heading: 'F', formulaOrQuote: 'a=b', explanation: 'because' })
  assert.deepEqual(f.formulas.map((x) => [x.expression, x.explanation]), [['a=b', 'because']])
  assert.ok(f.formulas[0].id)
  const e = normalizeSection({ type: 'heading_example', heading: 'E', exampleText: 'detail here' })
  assert.deepEqual(e.examples.map((x) => x.detail), ['detail here'])
  // missing optional Odia fields never throw
  assert.equal(normalizeSection({ type: 'structured_header', heading: 'H' }).odiaHeading, '')
  assert.equal(normalizeSection({ type: 'heading_table', headers: ['a'], rows: [['1']] }).odiaNote, '')
  // blocks without textStyle / theme normalise cleanly
  const ns = normalizeToSections({ type: 'studio', sections: [{ type: 'heading_paragraph', heading: 'x', text: 'y' }] })
  assert.deepEqual(ns.textStyle, {})
  assert.equal(ns.theme, 'midnight-slate')
})

test('saved data is compact: plain strings stay strings, empty Odia keys are not written', () => {
  const legacy = { type: 'studio', title: 'T', theme: 'sky-pastel', sections: [
    { id: 'a', type: 'heading_paragraph', heading: 'H', subHeading: '', paragraphs: ['p1', 'p2'] },
    { id: 'b', type: 'heading_list', heading: 'L', listStyle: 'check', items: ['i1'] },
    { id: 'c', type: 'callout_formula', heading: 'F', formulas: [{ id: 'f1', expression: 'x' }] },
  ] }
  const n = normalizeToSections(legacy)
  const out = JSON.parse(buildStudioJson(legacy, n.sections, n.theme, true))
  assert.deepEqual(out.sections[0].paragraphs, ['p1', 'p2'])
  assert.deepEqual(out.sections[1].items, ['i1'])
  assert.equal(out.sections[0].odiaHeading, undefined)
  assert.deepEqual(out.sections[2].formulas, [{ id: 'f1', expression: 'x' }])
  assert.equal(out.theme, 'sky-pastel')
  // once Odia text is added the item becomes an object
  const edited = setSectionValue(n.sections, 0, 'paragraphs.1.odiaText', 'ଓଡ଼ିଆ')
  const out2 = JSON.parse(buildStudioJson(legacy, edited, n.theme, true))
  assert.deepEqual(out2.sections[0].paragraphs, ['p1', { text: 'p2', odiaText: 'ଓଡ଼ିଆ' }])
})

test('bilingual Odia fields work on every section type', () => {
  const t = JSON.parse(STUDIO_TEMPLATE_JSON)
  const n = normalizeToSections(t).sections
  const by = (type) => n.find((s) => s.type === type)
  assert.ok(by('structured_header').odiaHeading && by('structured_header').odiaSubHeading)
  assert.ok(by('heading_paragraph').odiaHeading && by('heading_paragraph').paragraphs[0].odiaText)
  assert.ok(by('heading_list').items[1].odiaText)
  assert.ok(by('heading_table').odiaNote)
  assert.ok(normalizeSection({ type: 'callout_formula', formulas: [{ id: 'f1', expression: 'a=b', odiaExplain: 'ଓ' }] }).formulas[0].odiaExplain)
  assert.ok(by('heading_example').examples[0].odiaExplain)
  const html = renderStudioHtml(n, 'midnight-slate')
  assert.ok((html.match(/js-odia-text/g) || []).length >= 7)
  assert.ok(html.includes('ଶାରୀରିକ ଶିକ୍ଷା'))
  assert.ok(studioCss().includes("'Noto Sans Oriya'") && studioCss().includes('.js-odia-text'))
})

test('legacy lessons normalise in memory and are not treated as studio', () => {
  const n = normalizeToSections(SAMPLE_LESSON)
  assert.equal(n.studio, false)
  assert.equal(n.lossless, false)
  assert.deepEqual(n.sections.map((s) => s.type), ['structured_header', 'heading_list', 'heading_paragraph', 'heading_table'])
  assert.deepEqual(n.sections[3].headers, ['Expert', 'Definition'])
  const old = normalizeToSections({ title: 'T', sections: [{ heading: 'H', text: 'P', list: ['a', { text: 'b' }], example: 'E' }] })
  assert.deepEqual(old.sections.map((s) => s.type), ['structured_header', 'heading_paragraph', 'heading_list', 'heading_example'])
  assert.deepEqual(old.sections[2].items.map((i) => i.text), ['a', 'b'])
  assert.equal(old.sections[2].heading, '')
  assert.equal(old.sections[3].examples[0].detail, 'E')
})

test('legacy lessons with features that have no studio section are flagged lossy', () => {
  for (const s of [{ heading: 'x', mcq: [] }, { heading: 'x', note: 'n' }, { heading: 'x', image: 'https://a/b.png' }, { heading: 'x', formula: 'a' }, { heading: 'x', takeaway: 't' }]) {
    assert.equal(normalizeToSections({ sections: [s] }).lossless, false, JSON.stringify(s))
  }
  assert.equal(normalizeToSections({ title: 't', keyTakeaway: 'k' }).lossless, false)
})

test('studio detection, theme fallback and unique ids', () => {
  const n = normalizeToSections({ theme: 'sky-pastel', sections: [{ type: 'heading_paragraph', id: 'a', heading: 'x' }, { type: 'heading_paragraph', id: 'a', heading: 'y' }, { heading: 'no type' }] })
  assert.equal(n.studio, true)
  assert.equal(n.theme, 'sky-pastel')
  assert.deepEqual(n.sections.map((s) => s.id), ['a', 'a-2', 'sec-3'])
  assert.equal(normalizeToSections({ theme: 'bogus', type: 'studio' }).theme, 'midnight-slate')
})

test('per-section theme override: set, reset, unknown ids ignored, order of keys kept', () => {
  const base = normalizeToSections(STUDIO_TEMPLATE).sections
  const one = setSectionTheme(base, 1, 'deep-ocean')
  assert.equal(one[1].theme, 'deep-ocean')
  assert.equal(base[1].theme, undefined)
  assert.deepEqual(Object.keys(one[1]).slice(0, 3), ['id', 'type', 'theme'])
  const two = setSectionTheme(one, 3, 'warm-ivory')
  assert.deepEqual(two.map((s) => s.theme), [undefined, 'deep-ocean', undefined, 'warm-ivory', undefined])
  assert.equal(setSectionTheme(two, 1, null)[1].theme, undefined)
  assert.equal('theme' in setSectionTheme(two, 1, 'not-a-theme')[1], false)
  const json = JSON.parse(buildStudioJson(STUDIO_TEMPLATE, two, 'midnight-slate', true))
  assert.equal(json.theme, 'midnight-slate')
  assert.equal(json.sections[1].theme, 'deep-ocean')
  assert.equal(json.sections[0].theme, undefined)
  assert.equal(normalizeSection({ type: 'heading_paragraph', theme: 'bogus' }).theme, undefined)
  const html = renderStudioHtml(two, 'midnight-slate')
  assert.ok(html.includes('data-theme="deep-ocean"') && html.includes('data-theme="warm-ivory"'))
})

test('section operations: duplicate, move, add, remove, edit', () => {
  const base = normalizeToSections(STUDIO_TEMPLATE).sections
  const dup = duplicateSection(base, 1)
  assert.equal(dup.length, base.length + 1)
  assert.equal(dup[2].heading, base[1].heading)
  assert.notEqual(dup[2].id, base[1].id)
  dup[2].heading = 'changed'
  assert.equal(base[1].heading, 'Meaning of Physical Education')
  assert.deepEqual(moveSection(base, 0, 1).map((s) => s.id).slice(0, 2), [base[1].id, base[0].id])
  assert.equal(moveSection(base, 0, -1), base)
  const added = addSectionBelow(base, 0, 'callout_formula')
  assert.equal(added[1].type, 'callout_formula')
  assert.equal(added[1].formulas.length, 1)
  assert.equal(removeSection(added, 1).length, base.length)
  const ed = setSectionValue(base, 3, 'rows.1.2', 'X')
  assert.equal(ed[3].rows[1][2], 'X')
  assert.equal(base[3].rows[1][2], 'Muscle strength')
  assert.equal(setSectionValue(base, 3, 'rows.9.2', 'X'), base)
  // duplicating a formula section gives its boxes fresh ids
  const withFormula = addSectionBelow(base, 0, 'callout_formula')
  const fi = withFormula.findIndex((s) => s.type === 'callout_formula')
  const fd = duplicateSection(withFormula, fi)
  assert.notEqual(fd[fi + 1].formulas[0].id, fd[fi].formulas[0].id)
})

test('drag & drop reordering: arrayMove semantics, sections and inner items', () => {
  const a = ['a', 'b', 'c', 'd']
  assert.deepEqual(arrayMove(a, 0, 2), ['b', 'a', 'c', 'd']) // drop before "c"
  assert.deepEqual(arrayMove(a, 0, 4), ['b', 'c', 'd', 'a']) // drop after the last
  assert.deepEqual(arrayMove(a, 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(arrayMove(a, 2, 1), ['a', 'c', 'b', 'd'])
  assert.equal(arrayMove(a, 1, 1), a) // dropped on itself
  assert.equal(arrayMove(a, 1, 2), a) // "before the next one" = same place
  assert.equal(arrayMove(a, 9, 0), a)
  assert.deepEqual(a, ['a', 'b', 'c', 'd']) // never mutates
  const secs = normalizeToSections(STUDIO_TEMPLATE).sections
  const moved = moveSectionTo(secs, 0, secs.length)
  assert.equal(moved.at(-1).id, secs[0].id)
  assert.equal(moved.length, secs.length)
  let s = normalizeToSections({ type: 'studio', sections: [{ type: 'heading_paragraph', paragraphs: ['p1', 'p2', 'p3'] }, { type: 'heading_table', headers: ['h'], rows: [['r1'], ['r2'], ['r3']] }] }).sections
  s = mutateSection(s, 0, (x) => moveItemTo(x, 'paragraphs', 2, 0))
  assert.deepEqual(s[0].paragraphs.map((p) => p.text), ['p3', 'p1', 'p2'])
  s = mutateSection(s, 1, (x) => moveItemTo(x, 'rows', 0, 3))
  assert.deepEqual(s[1].rows, [['r2'], ['r3'], ['r1']])
  const out = JSON.parse(buildStudioJson({ type: 'studio' }, s, 'midnight-slate', true))
  assert.deepEqual(out.sections[0].paragraphs, ['p3', 'p1', 'p2']) // the new order is what is written to the JSON
})

test('paragraph / list item / table row: duplicate, swap, delete', () => {
  let s = normalizeToSections({ type: 'studio', sections: [{ type: 'heading_paragraph', paragraphs: [{ text: 'a', odiaText: 'ଏ' }, 'b'] }, { type: 'heading_list', items: ['x', 'y'] }, { type: 'heading_table', headers: ['h'], rows: [['1'], ['2']] }] }).sections
  s = mutateSection(s, 0, (x) => dupItem(x, 'paragraphs', 0))
  assert.deepEqual(s[0].paragraphs.map((p) => [p.text, p.odiaText]), [['a', 'ଏ'], ['a', 'ଏ'], ['b', '']])
  s = mutateSection(s, 0, (x) => moveItem(x, 'paragraphs', 2, -1))
  assert.deepEqual(s[0].paragraphs.map((p) => p.text), ['a', 'b', 'a'])
  s = mutateSection(s, 0, (x) => moveItem(x, 'paragraphs', 0, -1)) // nothing above → unchanged
  assert.deepEqual(s[0].paragraphs.map((p) => p.text), ['a', 'b', 'a'])
  s = mutateSection(s, 0, (x) => removeItem(x, 'paragraphs', 1))
  assert.deepEqual(s[0].paragraphs.map((p) => p.text), ['a', 'a'])
  s = mutateSection(s, 0, addParagraph)
  assert.equal(s[0].paragraphs.length, 3)
  s = mutateSection(s, 1, (x) => dupItem(x, 'items', 1))
  assert.deepEqual(s[1].items.map((i) => i.text), ['x', 'y', 'y'])
  s = mutateSection(s, 2, (x) => dupItem(x, 'rows', 0))
  assert.deepEqual(s[2].rows, [['1'], ['1'], ['2']])
  s = mutateSection(s, 2, (x) => removeItem(x, 'rows', 0))
  assert.deepEqual(s[2].rows, [['1'], ['2']])
})

test('formula & example items: add, duplicate (new id), swap, delete, Odia explanation, legacy single field', () => {
  let s = normalizeToSections({ type: 'studio', sections: [
    { type: 'callout_formula', heading: 'F', formulas: [{ id: 'f1', expression: 'E=mc²', explanation: 'energy', odiaExplain: 'ଶକ୍ତି' }, { id: 'f2', expression: 'F=ma' }] },
    { type: 'heading_example', heading: 'E', examples: [{ id: 'e1', title: 'One', detail: 'first' }, { id: 'e2', detail: 'second', odiaExplain: 'ଦ୍ୱିତୀୟ' }] },
  ] }).sections
  s = mutateSection(s, 0, (x) => dupItem(x, 'formulas', 0))
  assert.equal(s[0].formulas.length, 3)
  assert.equal(s[0].formulas[1].expression, 'E=mc²')
  assert.equal(s[0].formulas[1].odiaExplain, 'ଶକ୍ତି')
  assert.notEqual(s[0].formulas[1].id, s[0].formulas[0].id)
  s = mutateSection(s, 0, (x) => moveItem(x, 'formulas', 2, -1)) // swap
  assert.deepEqual(s[0].formulas.map((f) => f.expression), ['E=mc²', 'F=ma', 'E=mc²'])
  s = mutateSection(s, 0, (x) => removeItem(x, 'formulas', 0))
  assert.equal(s[0].formulas.length, 2)
  s = mutateSection(s, 0, addFormula)
  assert.equal(s[0].formulas.length, 3)
  assert.equal(new Set(s[0].formulas.map((f) => f.id)).size, 3)
  s = setSectionValue(s, 1, 'examples.0.odiaExplain', 'ପ୍ରଥମ')
  s = mutateSection(s, 1, (x) => moveItem(x, 'examples', 0, 1))
  assert.deepEqual(s[1].examples.map((x) => x.detail), ['second', 'first'])
  assert.equal(s[1].examples[1].odiaExplain, 'ପ୍ରଥମ')
  s = mutateSection(s, 1, addExample)
  assert.equal(s[1].examples.length, 3)
  const formulaHtml = renderStudioHtml([s[0]], 'midnight-slate')
  assert.ok(!formulaHtml.includes('<ol') && !formulaHtml.includes('<li') && !/\b1\.\s/.test(formulaHtml.replace(/<[^>]+>/g, ' ').replace(/\d\.\d/g, ''))) // no stray "1." artefacts
  // compact JSON keeps ids + Odia
  const out = JSON.parse(buildStudioJson({ type: 'studio' }, s, 'midnight-slate', true))
  assert.ok(out.sections[0].formulas.every((f) => f.id && f.expression !== undefined))
  assert.equal(out.sections[1].examples[1].odiaExplain, 'ପ୍ରଥମ')
})

test('tables: responsive scroll wrapper, rectangular rows, Odia note', () => {
  let s = normalizeToSections(STUDIO_TEMPLATE).sections
  const ti = s.findIndex((x) => x.type === 'heading_table')
  s = mutateSection(s, ti, tableAddCol)
  assert.equal(s[ti].headers.length, 4)
  assert.ok(s[ti].rows.every((r) => r.length === 4))
  s = mutateSection(s, ti, tableRemoveCol)
  assert.ok(s[ti].rows.every((r) => r.length === 3))
  s = mutateSection(s, ti, tableAddRow)
  assert.equal(s[ti].rows.at(-1).length, 3)
  const html = renderStudioHtml([s[ti]], 'midnight-slate')
  assert.ok(html.includes('js-table-scroll'))
  const css = studioCss()
  assert.ok(/\.js-table-scroll[^{]*\{[^}]*overflow-x:auto/.test(css))
  assert.ok(css.includes('-webkit-overflow-scrolling:touch'))
  assert.ok(/\.js-table th,[^{]*td\{[^}]*min-width:140px/.test(css) && css.includes('word-break:normal'))
  assert.ok(/@media print\{[^]*\.js-table-scroll[^}]*overflow:visible!important/.test(css))
  assert.ok(css.includes('.pdf-export .json-artboard-content .js-table{width:100%!important'))
})

test('text style: validated, clamped, written to JSON and applied as CSS variables', () => {
  assert.deepEqual(normalizeTextStyle(undefined), {})
  assert.deepEqual(normalizeTextStyle({ fontFamily: 'Comic Sans', headingSize: 'abc', textAlign: 'diagonal', headingColor: 'red' }), {})
  const ts = normalizeTextStyle({ fontFamily: 'Merriweather', headingSize: 99, bodySize: 3, lineHeight: 1.8, letterSpacing: 0.5, textAlign: 'justify', fontWeight: 600, headingColor: '#ff0000', textColor: '#abc', accentColor: 'javascript:1' })
  assert.deepEqual(ts, { fontFamily: 'Merriweather', headingSize: 36, bodySize: 14, lineHeight: 1.8, letterSpacing: 0.5, textAlign: 'justify', fontWeight: '600', headingColor: '#ff0000', textColor: '#abc' })
  ;['Inter', 'Poppins', 'Noto Sans Oriya', 'Merriweather', 'JetBrains Mono'].forEach((f) => assert.equal(normalizeTextStyle({ fontFamily: f }).fontFamily, f))
  const vars = textStyleVars(ts)
  assert.equal(vars['--js-h-size'], '36px')
  assert.equal(vars['--js-b-size'], '14px')
  assert.equal(vars['--js-lh'], '1.8')
  assert.equal(vars['--js-align'], 'justify')
  assert.ok(vars['--js-font'].startsWith('Merriweather'))
  assert.deepEqual(textStyleVars({}), {})
  const base = { type: 'studio', sections: [] }
  const withTs = JSON.parse(buildStudioJson(base, [], 'midnight-slate', true, ts))
  assert.deepEqual(withTs.textStyle, ts)
  assert.equal(normalizeToSections(withTs).textStyle.bodySize, 14)
  assert.equal(JSON.parse(buildStudioJson(withTs, [], 'midnight-slate', true)).textStyle.fontFamily, 'Merriweather') // untouched when not passed
  assert.equal(JSON.parse(buildStudioJson(withTs, [], 'midnight-slate', true, {})).textStyle, undefined) // "Reset Style"
  const html = renderStudioHtml([], 'midnight-slate', { textStyle: ts })
  assert.ok(html.includes('--js-b-size:14px'))
  const css = studioCss()
  ;['--js-font', '--js-h-size', '--js-b-size', '--js-lh', '--js-ls', '--js-align', '--js-weight'].forEach((v) => assert.ok(css.includes(`var(${v}`), v))
})

test('buildStudioJson: round trips, keeps title, drops folded legacy keys on upgrade', () => {
  const legacy = { title: 'My lesson', summary: 'S', points: ['a'], sections: [{ heading: 'H', text: 'P' }] }
  const n = normalizeToSections(legacy)
  const out = JSON.parse(buildStudioJson(legacy, n.sections, n.theme, false))
  assert.equal(out.type, 'studio')
  assert.equal(out.title, 'My lesson')
  assert.equal(out.summary, undefined)
  assert.equal(normalizeToSections(out).studio, true)
  const again = JSON.parse(buildStudioJson(out, normalizeToSections(out).sections, 'warm-ivory', true))
  assert.equal(again.theme, 'warm-ivory')
  assert.deepEqual(again.sections.map((s) => s.type), n.sections.map((s) => s.type))
  assert.equal(JSON.parse(buildStudioJson({ type: 'studio', custom: 1, sections: [] }, [], 'x', true)).custom, 1)
})

test('native rendering: studio blocks have no iframe; classic blocks keep the sandbox', () => {
  const studioBlock = { type: 'json', data: { json: studio([{ type: 'heading_table', heading: 'T', headers: ['Type of Activity', 'B'], rows: [['Aerobic Activities', '<script>x</script>y']] }], { theme: 'deep-ocean' }) } }
  const ns = nativeStudio(studioBlock.data)
  assert.ok(ns && ns.studio && ns.theme === 'deep-ocean')
  const html = renderStudioHtml(ns.sections, ns.theme, { textStyle: ns.textStyle })
  assert.ok(!/<iframe/i.test(html) && !html.includes('<script'))
  assert.ok(html.includes('data-theme="deep-ocean"'))
  assert.equal(nativeStudio({ json: studioBlock.data.json, customJs: 'alert(1)' }), null) // custom JS needs a sandbox
  assert.equal(nativeStudio({ json: studioBlock.data.json, packages: [{ url: 'x' }] }), null)
  assert.equal(nativeStudio({ json: JSON.stringify(SAMPLE_LESSON) }), null) // classic lesson
  assert.equal(studioFromJson('{bad'), null)
  const legacy = frameProps({ type: 'json', data: { json: JSON.stringify(SAMPLE_LESSON), style: {} } })
  assert.ok(legacy.html.startsWith('<article class="lsn'))
  // the PDF path still gets static HTML + CSS
  const fp = frameProps(studioBlock)
  assert.ok(fp.html.includes('js-table-scroll') && fp.css.includes('.json-artboard-content'))
})

test('lesson sidebar outline: studio sections get anchors, classic lessons scroll to the block', () => {
  const block = { id: 'b1', type: 'json', data: { json: studio([{ id: 'x', type: 'heading_paragraph', heading: 'Meaning', paragraphs: ['p'] }, { id: 'y', type: 'callout_formula', heading: '', formulas: [{ id: 'f', expression: 'a=b' }] }, { id: 'z', type: 'structured_header', heading: '' }]) } }
  const o = jsonOutline(block)
  assert.deepEqual(o.map((x) => x.title), ['Meaning', 'a=b']) // untitled sections are skipped
  assert.deepEqual(o.map((x) => x.anchor), ['sec-b1-x', 'sec-b1-y'])
  assert.deepEqual(jsonOutline({ id: 'h', type: 'html', data: {} }), [])
  const classic = jsonOutline({ id: 'c', type: 'json', data: { json: JSON.stringify(SAMPLE_LESSON) } })
  assert.ok(classic.every((x) => x.anchor === 'b-c'))
  assert.equal(sectionTitle({ heading: '<b>Hi</b>' }), 'Hi')
})

test('fmt keeps rich text safe', () => {
  assert.ok(!fmt('<img src=x onerror=alert(1)>').includes('onerror'))
  assert.ok(!fmt('<script>1</script>ok').includes('<script'))
  assert.equal(fmt('**b** ==m==').includes('<strong>b</strong>'), true)
  assert.ok(fmt('<span style="color:#ff0000">r</span>').includes('color:#ff0000'))
})

test('src/styles/jsonStudio.css contains the current studioCss() (run `npm run sync:css` if this fails)', () => {
  const file = readFileSync(new URL('../src/styles/jsonStudio.css', import.meta.url), 'utf8')
  assert.ok(file.includes(studioCss()), 'jsonStudio.css is out of date')
  assert.ok(file.includes('@studio-css:start') && file.includes('@studio-css:end'))
})

test('every schema field has a description and a sample (Format Guide never drifts)', () => {
  SECTION_TYPE_IDS.forEach((t) => {
    const def = SECTION_SCHEMA[t]
    assert.ok(def.label && def.short && def.desc, t)
    def.fields.forEach((f) => assert.ok(f.key && f.kind && f.desc, `${t}.${f.key}`))
  })
  assert.equal(SECTION_SCHEMA.callout_formula.short, 'EQ')
})

test('8 preset blocks: 6 core + optional image / YouTube, each creates a valid section', () => {
  assert.deepEqual(PRESET_BLOCKS.map((p) => p.short), ['H+P', 'HDR', 'LIST', 'TB', 'EQ', 'EX', 'IMG', 'YT'])
  assert.deepEqual(PRESET_BLOCKS.filter((p) => p.media).map((p) => p.type), ['heading_image', 'heading_youtube'])
  PRESET_BLOCKS.forEach((p) => assert.equal(SECTION_SCHEMA[p.type].short, p.short))
})

test('insertSectionAt drops a new section exactly at the drop position (clamped)', () => {
  const base = normalizeToSections(JSON.parse(STUDIO_TEMPLATE_JSON)).sections
  const a = insertSectionAt(base, 2, 'heading_image')
  assert.equal(a.length, base.length + 1)
  assert.equal(a[2].type, 'heading_image')
  assert.equal(a[1].id, base[1].id); assert.equal(a[3].id, base[2].id)
  assert.equal(insertSectionAt(base, 0, 'heading_list')[0].type, 'heading_list')
  assert.equal(insertSectionAt(base, 99, 'heading_youtube').at(-1).type, 'heading_youtube')
  assert.equal(insertSectionAt(base, -5, 'heading_table')[0].type, 'heading_table')
  assert.equal(insertSectionAt([], 0, 'heading_paragraph').length, 1)
})

test('heading_image schema: round-trips, layout falls back to top, unsafe urls are not rendered', () => {
  const n = normalizeSection({ type: 'heading_image', heading: 'Fig', odiaHeading: 'ଚିତ୍ର', imageUrl: ' https://x.test/a.png ', caption: 'Cap', odiaCaption: 'ବର୍ଣ୍ଣନା', layout: 'weird' })
  assert.equal(n.imageUrl, 'https://x.test/a.png'); assert.equal(n.layout, 'top')
  const out = compactSections([{ ...n, layout: 'split-left' }])[0]
  assert.equal(out.layout, 'split-left'); assert.equal(out.odiaCaption, 'ବର୍ଣ୍ଣନା')
  assert.ok(!('caption' in compactSections([{ ...n, caption: '', odiaCaption: '' }])[0]))
  const html = renderStudioHtml([{ ...n, layout: 'split-right' }])
  assert.ok(html.includes('js-split-right') && html.includes('<img src="https://x.test/a.png"'))
  assert.ok(html.includes('js-odia-text'))
  assert.equal(safeImageUrl('javascript:alert(1)'), ''); assert.equal(safeImageUrl('//evil.test/a.png'), '')
  assert.ok(!renderStudioHtml([{ ...n, imageUrl: 'javascript:alert(1)' }]).includes('<img'))
  assert.equal(inferred('imageUrl', 'https://x.test/a.png'), 'heading_image')
})
const inferred = (k, v) => normalizeSection({ heading: 'x', [k]: v }).type

test('YouTube url parsing: watch / youtu.be / shorts / embed / start time; bad links are rejected', () => {
  const id = 'dQw4w9WgXcQ'
  ;[`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}?si=abc`, `https://m.youtube.com/watch?v=${id}&feature=share`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `youtube.com/watch?v=${id}`, id]
    .forEach((u) => assert.equal(parseYouTube(u)?.id, id, u))
  assert.equal(parseYouTube(`https://youtu.be/${id}?t=1m30s`).start, 90)
  assert.equal(parseYouTube(`https://www.youtube.com/watch?v=${id}&t=42`).start, 42)
  ;['', 'hello', 'https://vimeo.com/123456789', 'https://evil.test/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=short'].forEach((u) => assert.equal(parseYouTube(u), null, u))
})

test('heading_youtube: 16:9 player, controls map to embed params, watch link is optional', () => {
  const url = 'https://youtu.be/dQw4w9WgXcQ'
  const e = youtubeEmbedUrl(url, { showControls: false, autoplay: true, mute: false, loop: true, startTime: 12 })
  assert.ok(e.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?'))
  assert.ok(e.includes('controls=0') && e.includes('autoplay=1') && e.includes('mute=1') && e.includes('loop=1') && e.includes('playlist=dQw4w9WgXcQ') && e.includes('start=12'))
  assert.ok(youtubeEmbedUrl(url).includes('controls=1') && !youtubeEmbedUrl(url).includes('autoplay'))
  assert.equal(youtubeWatchUrl(url, { startTime: 5 }), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s')
  assert.deepEqual(normalizeControls({ startTime: -3, loop: 'yes' }), { showControls: true, autoplay: false, mute: false, loop: false, startTime: 0 })
  const sec = normalizeSection({ type: 'heading_youtube', heading: 'Video', youtubeUrl: url, caption: 'c', odiaCaption: 'ଓ' })
  assert.equal(sec.showWatchLink, true)
  const html = renderStudioHtml([sec])
  assert.ok(html.includes('class="js-media js-yt"') && html.includes('Watch on YouTube ↗') && html.includes('rel="noopener noreferrer"'))
  assert.ok(!renderStudioHtml([{ ...sec, showWatchLink: false }]).includes('Watch on YouTube'))
  assert.ok(!renderStudioHtml([{ ...sec, youtubeUrl: 'https://evil.test/x' }]).includes('<iframe'))
  const bad = validateLessonJson(studio([{ type: 'heading_youtube', heading: 'x', controls: { autoplay: 'yes' }, showWatchLink: 'maybe' }]))
  assert.equal(bad.ok, false)
  assert.ok(validateLessonJson(studio([{ ...sec }])).ok)
})

test('studio json edits by id (left-sidebar tree): duplicate / delete never touch classic lessons', () => {
  const json = STUDIO_TEMPLATE_JSON
  const first = JSON.parse(json).sections[1].id
  const dup = JSON.parse(editStudioJson(json, (l) => duplicateSectionById(l, first)))
  assert.equal(dup.sections.length, JSON.parse(json).sections.length + 1)
  assert.equal(dup.type, 'studio'); assert.equal(dup.title, STUDIO_TEMPLATE.title)
  const del = JSON.parse(editStudioJson(json, (l) => removeSectionById(l, first)))
  assert.ok(!del.sections.some((s) => s.id === first))
  assert.equal(editStudioJson('{bad', (l) => l), null)
  assert.equal(editStudioJson(JSON.stringify(SAMPLE_LESSON), (l) => l), null)
})

test('Odia text has a theme-aware framed background in the shared stylesheet', () => {
  const css = studioCss()
  const rule = css.match(/\.js-odia-text\{[^}]*\}/)[0]
  assert.ok(rule.includes('background:color-mix(in srgb,var(--js-accent) 10%,var(--js-surface))'))
  assert.ok(rule.includes('border-radius:6px') && rule.includes('padding:4px 8px') && rule.includes('margin-top:4px'))
  const html = renderStudioHtml(normalizeToSections(JSON.parse(STUDIO_TEMPLATE_JSON)).sections)
  assert.ok((html.match(/js-odia-text/g) || []).length >= 7)
})

test('format guide data: default template has no optional sections; optional schemas are available for the presets only', () => {
  assert.ok(MEDIA_SECTION_TYPE_IDS.every((t) => SECTION_SCHEMA[t].media === true))
  assert.equal(SECTION_SCHEMA.callout_formula.optional, true)
  const t = normalizeToSections(JSON.parse(STUDIO_TEMPLATE_JSON)).sections
  assert.ok(!t.some((s) => OPTIONAL_SECTION_TYPE_IDS.includes(s.type)))
})
