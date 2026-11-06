# Change 6 – implementation notes

## Implemented in this update
- Chapter workspace now keeps the full chapter artboard mounted when a block is selected; selecting a block highlights it and opens its existing properties panel rather than replacing the artboard with a single-block editor.
- Selected block working state is rendered into its artboard card so changes from the properties panel are reflected in the same chapter view.
- Ready-made structured blocks support direct inline editing of headings, paragraphs, list items, example text, and multi-heading section text. Changes are committed into the existing block working state and use the existing Save Draft/autosave flow.
- Heading & Image artboard placeholder opens the local file picker; successful upload updates the same block image field used by the properties panel.
- Removed the separate Live Preview heading for ready-made structured blocks. Existing HTML, JSON and MCQ preview paths remain in the chapter artboard.
- Added block-specific ready-made design presets in a separate right-properties section, below the Content/Style/Spacing/Advanced tabs, while preserving block text and other content fields.
- Fixed visibility semantics for legacy blocks whose `visible` property is undefined: these are treated as visible until explicitly hidden.
- Added responsive four-column properties tabs and grouped Unit/Chapter settings into tabs.
- Added selected-block artboard styling and direct-edit focus affordances.

## Existing project areas intentionally retained
- Firebase configuration and service modules were not changed.
- Existing content schema, reducer, save/publish services, authentication, routing, HTML editor, JSON editor and MCQ editor were retained.

## Validation limitation
- ZIP integrity was checked after packaging.
- A full Vite production build could not be run in this environment: dependency installation timed out, and the available Node version is 22.16.0 while this project declares Node >=24.12.0. Please run `npm ci` and `npm run build` using Node 24.12.0 or newer before deploying.
- Browser-level interaction, Firebase upload, draft persistence and publish flows could not be exercised in this environment. These must be tested in the local project before replacing the original.
