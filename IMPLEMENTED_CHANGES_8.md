# RK Study Zone — Changes 8

1. **Block navigation + auto scroll** – clicking a unit / chapter / block in the left tree (or in the breadcrumb, or after adding a block) smoothly scrolls the artboard to it. The scroll offset is measured from the real header + breadcrumb height, so the block never hides behind them. Clicking *inside* the artboard does not jump the page.
2. **Natural scroll + fixed breadcrumb** – the artboard scrolls normally; the breadcrumb (`Units › Unit › Chapter › Block`) is sticky under the header. Active highlight in the tree and the properties panel behave as before.
3. **Dark by default** – new ready-made blocks start dark; older blocks that still have the untouched white defaults are *displayed* dark (stored data is not rewritten). Properties → *Ready-made Designs* now has **Dark Themes / Light Themes** tabs (Highlight Box, Note Card, Pro Tip, Case Study). Switching the tab changes nothing; a template is applied only when clicked.
4. **Chapter heading background image** – Chapter Settings → Heading → *Image*: 5 education images, custom upload, position grid, size, repeat, blend, dark overlay on/off + colour + opacity, style (Default / Pattern / Gradient / Blurred), Desktop / Mobile live preview, Reset. New chapters default to the education image. Shown in the builder and in the student banner.
5. **Portal syllabus** – *Create/Edit Portal* has an optional Syllabus box (PDF, JPG, PNG, JSON, max 5 MB). Student lesson page shows **Syllabus – View / Download** under Study Tools only when a syllabus exists (PDF/image preview, JSON as text).
6. **YouTube Video + Image Slider / Carousel blocks** – added to Add Block, builder properties, artboard preview and student page.
7. **Popups** – the old `.rk-modal { max-width: 100vw }` rule was forcing every popup to full width; removed. Add Block, Login, Create Unit, Create Portal etc. are now centered with sensible max widths.
8. **Content block design** – floating title pill (top-left, no number), floating action icons (top-right), black container with thin blue border, purple heading divider, cyan "Insert block after this" button at the bottom centre. Applied to all blocks.

## Deploy note — Firestore rules
Syllabus files are stored in a new collection `portalSyllabus`. **Publish the updated `firestore.rules`** (`firebase deploy --only firestore:rules`) or syllabus upload/view will be refused.

## New / changed files
New: `lib/chapterHeading.js`, `lib/blockTheme.js`, `components/builder/MediaBlocks.jsx`, `components/ui/HeadingBg.jsx`, `components/student/SyllabusModal.jsx`, `assets/chapter-bg/*.svg`.
Changed: `BuilderPage`, `Workspace`, `ReadyBlockEditor`, `ChapterModal`, `UnitModal` (class only), `AddBlockModal`, `PortalFormModal`, `LessonPage`, `portalService`, `storageService` (optional quality arg), `content.js`, `blockLabel.js`, `cms.css` (new section at the end), `firestore.rules`.
Not touched: Firebase config, data schema of existing blocks, autosave / Save Draft / Publish, progress logic, HTML / JSON / MCQ blocks.
