# RK Study Zone CMS — Upgrade notes

## Setup
```bash
npm install        # NOT "npm ci": new dependencies were added (see below)
npm run dev        # development
npm run build      # production build
```
Node.js 24.12+ (unchanged). Firebase config, routes, Firestore rules and stored data are untouched.

**New dependencies** (all already in your lockfile as transitive packages except Prettier):
`@codemirror/{autocomplete,commands,language,search,state,view}` (now declared directly) and `prettier` (code formatting, loaded on demand only when you press *Format*).

## Where things are
| Feature | Files |
|---|---|
| Universal rich-text toolbar | `components/ui/RichText.jsx`, `lib/richText.js` (sanitiser), `lib/editBridge.js` |
| HTML/CSS/JS block | `components/builder/HtmlBlockEditor.jsx`, `components/ui/CodeEditor.jsx`, `lib/{emmet,codeHints,formatCode,cmActions}.js` |
| JSON block | `components/builder/JsonBlockEditor.jsx`, `lib/jsonLesson.js` |
| MCQ block + exam | `components/builder/McqBlockEditor.jsx`, `components/mcq/McqPlayer.jsx`, `lib/mcq.js` |
| Table block (new) | `components/builder/TableBlockEditor.jsx`, `components/ui/TableView.jsx`, `lib/table.js` |
| Student page / Take Exam | `pages/LessonPage.jsx` |
| Styles | `styles/editors.css` (imported after `cms.css`) |

## How it behaves
* **Selecting a block** in the artboard now opens its editor *in place* (preview on top, editor below – as in your screenshots). The old `HtmlCenter / JsonCenter / McqCenter` components already existed but were not mounted anywhere.
* **One formatting toolbar** sits above the artboard and formats whichever text is focused: Heading/Paragraph/List/Example blocks, table cells, MCQ question/option/explanation fields, properties-panel text fields, and — via *Edit text on canvas* — text inside HTML and JSON blocks.
* Rich text is stored as sanitised HTML inside the same fields as before. Existing plain-text content keeps working and is only converted when you apply formatting. Students see exactly the same HTML (always sanitised: no scripts, event handlers, unsafe links or styles).
* **HTML block**: images you upload are stored once as `asset:ID` and used in HTML/CSS/JS like `<img src="asset:ast_123">`; replacing an asset updates every use. Hover an image in the preview for Edit / Change / Upload / Remove.
* **Chapter exam**: open an MCQ block → *Chapter Examination* → *Use as chapter exam*. After publishing, students see **Take Exam** at the top of the right sidebar (instructions → timer → palette → mark for review → submit summary → results with negative marking). By default the block is hidden from the lesson body (*Show only via Take Exam*).
* **Table block**: Add Block → *Advanced Table Block*. Merge/split, sorting, drag-reorder, undo/redo, CSV import/export, per-cell styling, scoped custom CSS, student-side sortable headers.

## Honest limitations
* ESLint and Stylelint are **not** bundled in the browser (very large). Equivalent live diagnostics are provided with CodeMirror/Lezer: syntax errors, HTML tag/duplicate-id checks, unknown-CSS-property warnings, JSON validation, and runtime JS errors + `console.log` capture.
* Emmet is a built-in compact engine (tags, `.class`, `#id`, `>`, `+`, `^`, `*N`, `$` numbering, `{text}`, `[attrs]`, groups, `!`, `lorem`) rather than the full Emmet package.
* On-canvas text editing in HTML blocks pauses scripts while active (so the preview DOM matches the source) and re-serialises the edited HTML.
