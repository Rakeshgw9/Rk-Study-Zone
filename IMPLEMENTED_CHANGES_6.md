# RK Study Zone — Builder refinements (changes5)

## Implemented
- Selecting a chapter from the structure tree keeps the chapter selected and shows the chapter artboard; it no longer jumps directly into the first block editor.
- The Chapter Actions "Design Content" action now opens the chapter artboard instead of selecting the first block.
- The chapter artboard now renders every block's actual content in order: ready-made lesson blocks, HTML/JSON sandbox previews, and MCQ preview players.
- Each block retains its own edit, visibility, reorder, duplicate, and delete controls. Selecting Edit opens that block's existing editor and contextual properties.
- Removed the repeated Portal Setup Guide card from the right panel while a unit or chapter is selected, reducing duplicated sidebar content.
- Added an independent image background option for the Unit Heading banner, including upload, preview, and remove controls. The existing Full Unit Background image setting remains available.
- Slightly reduced desktop side-panel widths and gaps to give the central artboard more room.

## Existing project behaviour retained
- Existing content model, Firestore services, authentication, draft autosave, publishing, routes, and editor components were not replaced.
- Existing Unit Full Background image/gradient/color options remain intact.

## Validation
- JSX syntax transpilation passed for the three modified React files using the installed TypeScript compiler parser.
- A full Vite production build could not be run in this environment: dependency installation timed out, and the available Node runtime is v22.16.0 while this project declares Node >=24.12.0.
- Use Node 24.12 or newer, then run `npm ci` and `npm run build` locally before deployment.
