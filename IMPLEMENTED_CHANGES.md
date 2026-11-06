# RK Study Zone — Changes 5

This ZIP is based on the user-provided `CHANGES_4.zip`. Existing application structure, Firebase services, routing, theme system, portal structure, MCQ editor, JSON editor, and custom HTML/CSS/JS editor are retained.

## Implemented

1. **Ready-made lesson blocks**
   - Heading & Paragraph
   - Heading & Image
   - Heading & List
   - Heading & Example
   - These are now structured block types, not HTML/CSS/JS blocks.
   - The new block editor has a live preview and right-side Content, Style, Spacing, and Advanced tabs.
   - The properties panel includes editable text, list items, image/alt/caption, example fields, typography, text/heading alignment, colours, borders, shadow, padding, margins, max width, and visibility.

2. **Existing template content**
   - Legacy HTML-backed built-in templates are migrated into structured ready-made blocks when draft/published content is loaded.
   - Custom HTML/CSS/JS blocks are not migrated or changed.
   - The Multiple Heading Sections card is no longer offered for new blocks. Legacy data remains readable.

3. **Student-side rendering**
   - Ready-made blocks render as normal lesson content, not a sandboxed code block.
   - Uploaded image blocks display their image, alt text, and optional caption.

4. **Unit settings**
   - The Full Unit Background controls remain distinct from the Unit Heading Appearance controls.
   - The Live Preview now shows the heading banner over the selected full-unit background.
   - Removed the duplicate preview from the Full Unit Background section.
   - Settings sections are kept at their natural height and the dialog body scrolls, rather than clipping the section contents.

5. **Builder drawers**
   - Left and right side panels animate closed.
   - The centre workspace expands to use the available width.

6. **JSON image helper**
   - Image insertion now supports both object-root JSON and array-root JSON.
   - It validates the resulting JSON before updating the editor and preview.
   - Existing JSON content remains editable in the JSON editor.

## Validation performed

- Parsed all 60 JavaScript/JSX source files with the installed TypeScript JSX parser: no syntax errors.
- Checked all relative source imports: no unresolved relative imports.
- Full `vite build` and browser interaction tests could not be completed in this environment because dependency installation timed out. The project declares Node.js `>=24.12.0`; this environment has Node.js `22.16.0`.

## Run locally

Use Node.js 24.12.0 or newer, then run:

```bash
npm install
npm run dev
```

Before replacing the existing project, keep a backup and test the new ZIP locally. Firebase credentials and environment variables are not embedded; configure them as in the original project.
