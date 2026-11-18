// Master upgrade checks: layer tree, preset blocks, media sections, Odia backgrounds, lesson page / mobile rules.
// Source-level checks for the React files (no DOM needed) + behaviour checks for the pure helpers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { studioCss, studioSectionList, moveSectionIndex, STUDIO_TEMPLATE_JSON, PRESET_BLOCKS, PRESET_MIME, SECTION_SCHEMA } from '../src/lib/jsonStudio.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('left sidebar: JSON blocks are expandable folders with single-line rows and only Duplicate / Delete', () => {
  const t = read('src/components/builder/StructureTree.jsx')
  assert.ok(t.includes('studioSectionList(b.data?.json)'))
  assert.ok(t.includes('tree-sections') && t.includes('tree-row tree-sec'))
  assert.ok(t.includes('⋮⋮') && t.includes('tree-sec-t') && t.includes('jt-badge'))
  const menu = t.slice(t.indexOf('Section options for'), t.indexOf('Section options for') + 420)
  assert.ok(menu.includes("'Duplicate'") && menu.includes("'Delete'"))
  assert.ok(!/Move (Up|Down)/.test(menu), 'no swap arrows in the section row menu')
  const css = read('src/styles/jsonStudio.css')
  assert.ok(/\.tree-row\.tree-sec \.tree-sec-t\s*\{[^}]*white-space:\s*nowrap[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis/.test(css))
  const b = read('src/pages/BuilderPage.jsx')
  assert.ok(b.includes('selectSection') && b.includes('scrollToStudioSection') && b.includes("setUi({ jsonSec: sectionId })"))
})

test('layer tree helpers: sections list is cached, only Studio blocks have layers, reorder lands on the final index', () => {
  const list = studioSectionList(STUDIO_TEMPLATE_JSON)
  assert.equal(list.length, 5)
  assert.equal(studioSectionList(STUDIO_TEMPLATE_JSON), list)
  assert.equal(studioSectionList('{bad'), null)
  assert.equal(studioSectionList(JSON.stringify({ title: 'Classic', summary: 'x' })), null)
  const moved = moveSectionIndex(list, 0, 3)
  assert.equal(moved[3].id, list[0].id); assert.equal(moved[0].id, list[1].id)
  assert.equal(moveSectionIndex(list, 2, 2), list)
})

test('right sidebar: no Sections list, 8 draggable Preset Section Blocks', () => {
  const e = read('src/components/builder/JsonBlockEditor.jsx')
  assert.ok(!e.includes('SectionsManager') && !e.includes('Sections (${'))
  assert.ok(e.includes('<PresetBlocks onAdd={addPreset} />'))
  const p = read('src/components/builder/JsonStudioPanels.jsx')
  assert.ok(!p.includes('SectionsManager'))
  assert.ok(p.includes('PRESET_BLOCKS.map') && p.includes('draggable') && p.includes('PRESET_MIME'))
  assert.equal(PRESET_BLOCKS.length, 8)
  assert.ok(PRESET_MIME.length > 5)
  const c = read('src/components/builder/JsonStudioCanvas.jsx')
  assert.ok(c.includes('onDragOver={onPresetOver}') && c.includes('onDrop={onPresetDrop}') && c.includes('js-drop-line'))
  assert.ok(studioCss().includes('.js-drop-line::before') && studioCss().includes('box-shadow'))
})

test('default Format Guide lists only the 5 core types; callout_formula and media presets are optional', () => {
  const p = read('src/components/builder/JsonStudioPanels.jsx')
  assert.ok(p.includes('SECTION_TYPE_IDS.map'))
  assert.ok(!p.includes('ALL_SECTION_TYPE_IDS'))
  PRESET_BLOCKS.filter((x) => x.media).forEach((x) => assert.equal(SECTION_SCHEMA[x.type].media, true))
  assert.ok(!/callout_formula|heading_image|heading_youtube/.test(STUDIO_TEMPLATE_JSON))
})

test('Odia text: framed, theme-aware background in builder and lesson page (same classes)', () => {
  const css = studioCss()
  assert.ok(/\.js-odia-text\{[^}]*background:color-mix\(in srgb,var\(--js-accent\) 10%,var\(--js-surface\)\)/.test(css))
  const view = read('src/components/ui/StudioView.jsx'); const canvas = read('src/components/builder/JsonStudioCanvas.jsx')
  assert.ok(view.includes('js-odia-text') && canvas.includes('js-odia-text'))
  assert.ok(view.includes('odiaCaption') && canvas.includes('odiaCaption'))
})

test('media renderers exist for the lesson page and the builder', () => {
  const view = read('src/components/ui/StudioView.jsx')
  assert.ok(view.includes('Watch on YouTube ↗') && view.includes('heading_image') && view.includes('heading_youtube'))
  assert.ok(studioCss().includes('aspect-ratio:16/9'))
  const c = read('src/components/builder/JsonStudioCanvas.jsx')
  assert.ok(c.includes('onUploadImage') && c.includes('IMAGE_LAYOUTS') && c.includes('startTime'))
})

test('lesson page + mobile: Study Tools closed by default, absent from StudentHome, rich text bar hidden < 768px, drawers < 992px', () => {
  assert.ok(/useState\(true\)[^\n]*Study Tools start closed/.test(read('src/components/student/TeachingToolbar.jsx')))
  assert.ok(!/TeachingToolbar/.test(read('src/pages/StudentHome.jsx')))
  const css = read('src/styles/cms.css')
  assert.ok(/@media \(max-width: 767\.98px\) \{\s*\.rt-sticky, \.chapter-artboard \.rt-sticky, \.rt-toolbar \{ display: none !important; \}/.test(css))
  assert.ok(css.includes('@media (max-width: 991.98px) {\n  .bld-grid { grid-template-columns: 1fr; }'))
  const s = studioCss()
  assert.ok(s.includes('overflow-x:auto') && s.includes('@media print'))
})
