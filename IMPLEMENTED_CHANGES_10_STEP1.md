# Step 1 — JSON Content Block: multi-section Studio (16 themes, click-to-edit)

* New format: `{ "type": "studio", "theme": "midnight-slate", "sections": [ { "type": "heading_paragraph", ... } ] }`
  (sections are typed; see the in-app **Format Guide** for every field and the 16 theme IDs: 8 dark + 8 light).
* **Artboard**: click any text to edit it; changes sync to the JSON code. Hover a section for duplicate / move / add / remove.
* **Properties panel** (Studio lessons): Theme picker, Sections manager, JSON Format Guide (copy / insert template). Style and Spacing tabs are hidden for Studio lessons (the theme controls the look).
* **Classic lessons keep working unchanged.** They are normalised in memory only; a banner offers *Upgrade to Studio* (with a warning when some parts would be dropped).
* Student chapter page and block preview use the same theme markup/CSS as the builder artboard.
* Validation: unknown theme falls back to Midnight Slate (warning); each section is validated by one shared schema.

## Files
New: `src/lib/jsonStudio.js`, `src/components/builder/JsonStudioCanvas.jsx`, `src/components/builder/JsonStudioPanels.jsx`, `src/styles/jsonStudio.css`, `tests/jsonStudio.test.mjs`
Changed: `JsonBlockEditor.jsx`, `lib/{blockLabel,blockRender,content,jsonLesson}.js`, `main.jsx`
Not touched: `.env`, Firebase config/rules, stored data, publish/draft logic.

## Checked
* `node --import ./tests/_register.mjs --test tests/jsonStudio.test.mjs` → 10/10 pass.
* All changed/new files parse cleanly (TypeScript JSX parser).
* `npm run build` could NOT be run in the environment that produced this zip (no registry access) — please run `npm install && npm run build` once locally.
* `tests/firestoreSafe.test.js` was already failing before these changes (not part of `npm test`).
