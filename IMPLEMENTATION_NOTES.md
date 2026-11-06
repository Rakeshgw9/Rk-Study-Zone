# RK Study Zone – Change Set 4

## Changes included

- Reworked Chapter Settings into General Information, Chapter Heading Appearance, Full Chapter Background, and Chapter Link Preview sections.
- Added separate heading and full-unit background settings, icon/color selection, image upload/removal, live preview, and unit link preview.
- Applied chapter and unit appearance settings to the builder and student lesson views.
- Added generic block-level Content, Style, Spacing, and Advanced properties for HTML-based content blocks, including the Heading & Paragraph/Image/List/Example and Multiple Heading Sections presets.
- Added collapsible course navigation and study-tools sidebars; the central lesson area expands when drawers are hidden.
- Added a working account dropdown with Settings and Log Out actions in the builder header.
- Improved MCQ OCR extraction so numbered questions, option lines, and answer labels are separated into editable question records for review.
- Changed JSON lesson image helper uploads to insert the selected local image into the first JSON section and refresh the live preview.
- Kept image handling local-first through the storage service abstraction; Firebase configuration remains in place.
- Added chapter/unit slug routing support for the generated preview links.

## Runtime

Use Node.js 24.12.0 or newer, then run:

```bash
npm install
npm run dev
```

## Verification performed

- Parsed all 59 JavaScript/JSX source files with the TypeScript transpiler: no syntax diagnostics.
- Checked all relative imports: no unresolved relative imports.
- Confirmed `package.json` and `package-lock.json` are valid JSON.

A full Vite production build and browser regression run could not be completed in the packaging environment: dependency installation did not finish before the environment timeout. Please run `npm install` and `npm run build` locally with Node.js 24.12.0+ before deployment.
