# Step 2 — JSON Studio upgrade (both master prompts) + lesson page / builder / mobile

## JSON Studio (data model — `src/lib/jsonStudio.js`)
* Section types: `heading_paragraph`, `structured_header`, `heading_list`, `heading_table`, `callout_formula` (badge EQ), `heading_example`.
  **No image / YouTube sections** (they stay in their own blocks).
* Bilingual Odia: `odiaHeading` (all), `odiaSubHeading` (header), `odiaText` (paragraph + list items), `odiaExplain` (formula + example items), `odiaNote` (table).
* Repeatable boxes: `formulas: [{id, expression, explanation, odiaExplain}]`, `examples: [{id, title, detail, odiaExplain}]`.
* `paragraphs` / `items` accept plain strings **or** `{text, odiaText}`. Plain strings are written back as plain strings (only items that have Odia text become objects).
* Old data still loads: `text` → `paragraphs`, `formulaOrQuote` → `formulas[]`, `exampleText` → `examples[]`, string arrays, missing Odia/textStyle/theme. Nothing is rewritten until the author edits.
* Per-section `theme` (optional) + block `theme`; block `textStyle` (font, heading/body size, line height, letter spacing, align, weight, 3 colours).
* Drag & drop helpers (`arrayMove`, `moveSectionTo`, `moveItemTo`), item helpers (duplicate with new id, swap, delete).

## Builder (artboard + sidebar)
* Artboard is native React (no iframe); scrolls at 1000px; every section and every paragraph / list item / table row / formula box / example box has a ⋮⋮ grip + Duplicate / Up / Down / Delete (+ `+ Odia`).
* Click a section → sidebar shows **Section #N Theme Override** + *Use Block Default*; nothing selected → block theme (8 dark + 8 light, 4 + "Show 4 More").
* Text on the artboard registers with the sticky Rich Text toolbar (bold, colours, links…) and is saved into the JSON.
* Right sidebar: spacious section cards (grip, number, badge, title, theme pill, actions), full-width **Select Section Type** + **Add Section**, sticky **Save Block**, working **Style** tab (Text Style) for studio blocks, updated Format Guide (Odia keys, per-type *Copy sample*, template).
* Mobile (<992px): Structure and Properties are slide-over drawers with backdrop and × button. Rich Text bar hidden under 768px.

## Lesson page
* JSON Studio blocks render natively (`StudioView`, no iframe, natural height, per-section "Add note").
* Sidebar (`CourseTree`): colour-coded block badges, expandable JSON sub-sections, smooth scroll, scroll-spy highlight, seen markers.
* Study Tools start **closed** (pill bottom-right; never covers Save PDF / Previous / Next). `StudentHome` never rendered Study Tools.

## Not changed / limits
* Classic (non-studio) JSON lessons, and studio blocks that use custom JS or packages, still render in the sandbox (they need it).
* Drag & drop is HTML5 (mouse). On touch screens use the ↑ ↓ buttons. Items move within their own section list.
* The Style tab of ordinary text blocks (ReadyBlockEditor) was not touched.
* `npm run build` could not be run where this zip was made (no registry access): run `npm install && npm run build` once. `npm run build` also runs `sync:css` first (keeps `styles/jsonStudio.css` in step with `studioCss()`).
* Tests: `npm test` → 36/36 pass (`tests/jsonStudio.test.mjs` rewritten, 22 tests). `tests/firestoreSafe.test.js` was already failing before (not part of `npm test`).
