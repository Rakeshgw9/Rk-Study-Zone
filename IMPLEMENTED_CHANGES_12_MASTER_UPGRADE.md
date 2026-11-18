# Master upgrade (`new_changes`) — what was done

## 1. Left sidebar (`StructureTree.jsx`) — layer tree
* Every `{ } JSON Content` (Studio) block gets a ▾ / ▸ chevron (collapsed by default, open for the block you are editing).
* Each section is ONE compact row: `⋮⋮` drag handle · colour badge (`HDR H+P LIST TB EQ EX IMG YT`) · single-line title with `…` ellipsis · `⋮` menu with **Duplicate** and **Delete** only (no arrows, no theme pill).
* Drag the `⋮⋮` handle to reorder sections inside their block.
* Click a row → the block is selected, the artboard scrolls smoothly to that section and the right sidebar switches to **Section #N Theme Override**. Clicking a section on the artboard highlights/scrolls its row in the tree (both directions).
* Duplicate / Delete / reorder go through the normal undo history (`BuilderPage.act.editSections`). Classic (non-Studio) JSON lessons have no layers and are never rewritten.

## 2. Right sidebar — Sections list removed, 8 Preset Section Blocks
* `SectionsManager` and the `Sections (N)` panel are gone.
* New 2-column grid (below Theme): Heading + Para, Header / Title, Heading + List, Heading + Table, Formula Box, Example Box, Heading + Image (optional), Heading + YouTube (optional).
* Drag a card over the artboard → glowing insertion line → drop inserts at that exact position and rewrites the JSON live. Click a card → adds below the selected section (or at the end). The new section is selected and scrolled into view.

## 3. Odia backgrounds
* `.js-odia-text` now has `padding:4px 8px; margin-top:4px; border-radius:6px` + a tinted `color-mix(accent 10%, var(--js-surface))` background.
  (A flat `var(--js-surface)` would be invisible on the section card, which already uses that colour, so it is mixed with the theme accent — still fully theme-aware for all 16 themes.)
* Same classes are used by the builder canvas, `StudioView` (lesson page), PDF / print, so all three match.

## 4. Optional media sections
* `heading_image` `{ imageUrl, caption?, odiaCaption?, layout: top | split-left | split-right }` — URL or Upload (media service), split layouts stack on phones.
* `heading_youtube` `{ youtubeUrl, caption?, odiaCaption?, showWatchLink, controls:{showControls,autoplay,mute,loop,startTime} }` — watch / youtu.be / shorts / embed links, 16:9 privacy-friendly player, "Watch on YouTube ↗" button. Autoplay is never played while editing; autoplay implies mute. PDF / print show the link instead of the frame.
* They are NOT in the default Format Guide, template, `SECTION_TYPE_IDS` or the quick-add menu (still the 6 core types). Validation accepts them.

## 5. Lesson page / mobile — verified, already in place
Study Tools start closed (not on StudentHome) · Rich Text bar hidden < 768px · Structure / Properties are slide-over drawers < 992px · JSON tables scroll sideways and expand in PDF. Locked in by `tests/changes12.test.mjs`.

## Also fixed
* `tests/firestoreSafe.test.js` was failing because `src/lib/firestoreSafe.js` did not exist. It now does and is used by `contentService` (nested arrays such as table rows are stored as `{__rkArray:[…]}`; old documents read back unchanged).

## Files
`src/lib/jsonStudio.js` (schema, helpers, CSS) · `src/lib/jsonStudioDom.js` (new) · `src/lib/firestoreSafe.js` (new) · `src/components/builder/{StructureTree,JsonStudioPanels,JsonStudioCanvas,JsonBlockEditor}.jsx` · `src/components/ui/StudioView.jsx` · `src/pages/BuilderPage.jsx` · `src/services/contentService.js` · `src/styles/jsonStudio.css` · `tests/*` · `package.json` (test script)

## Run
`npm install && npm test && npm run build`  (`npm test` = 54 tests; use it instead of bare `node --test`, it registers the extension-less import hook.)
