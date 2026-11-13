# Image to Text block (book page → editable text)

## How to use
1. Open a chapter in the Builder → **Add Block → Image to Text**.
2. In the right-hand panel choose **Take Photo** (phone camera), **Gallery** (one or many images), **PDF** (optionally type pages like `1-3, 5` first) or **Choose File**.
3. Reorder / rotate / crop / replace / remove pages, pick the language (English, Odia, or both), press **Read text**.
4. Check and correct the **Extracted text**, then **Apply to block**. Headings, lists and tables are detected automatically; turn that off to get plain paragraphs.
5. Edit directly on the page if you like, then **Save Block**. Autosave, draft, publish, PDF export and the student view all work as for any Heading & Paragraph block.

## What is stored
Only the text (`heading`, `body`) plus a small `ocr` record (`rawText`, `lang`, `pages`, `confidence`, `at`) — the untouched OCR output is kept in `ocr.rawText`, separate from your edited body.
Photos/PDFs are **not uploaded or saved anywhere** (no Firebase Storage, no GitHub media).

## Technical notes
* Block type `image-to-text` uses `template: 'heading-paragraph'`, so the existing renderer (`ReadyBlockView`), rich-text sanitizer, PDF export and student page render it. No new Firestore fields outside the block's own `data`.
* OCR runs **in the browser** with Tesseract.js and PDF.js loaded on demand from jsDelivr (same pinned approach as `src/lib/ocr.js`). No API key, no cost, no new npm dependency. The first run downloads the OCR engine/language data, so internet is needed.
* PDF pages that contain real text are read directly from the PDF (more accurate than OCR).
* New files: `src/components/builder/ImageToTextBlock.jsx`, `src/lib/pageOcr.js`, `src/lib/notesFormatter.js`, `src/styles/imageToText.css`, `tests/imageToText.test.mjs`.
* Modified (additive, one-line each): `content.js`, `blockLabel.js`, `pdfExport.js`, `LessonPage.jsx`, `Workspace.jsx`, `BuilderPage.jsx`, `AddBlockModal.jsx`, `package.json` (test script only).

## Not included (needs a server-side API key — say the word and I will add it as a Netlify Function)
English → Odia translation, "simple Odia explanation", and AI-based structure detection. Heading/list/table detection here is rule-based, so very unusual layouts may need a manual fix in the text box.
