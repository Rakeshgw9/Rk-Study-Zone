# Phase A — Performance, feedback UX, Publish popup, large chapters

## Status of this build (read first)
- Written and checked WITHOUT a working `npm install` (the authoring sandbox had no registry access).
- Verified: every `src/**/*.js(x)` parses (TypeScript syntax check), the 12 new unit tests pass, and the QR generator was decoded successfully with OpenCV.
- NOT run: `npm run lint`, `npm run build`, Lighthouse, browser/manual UI tests. Run `npm ci && npm run lint && npm test && npm run build` first.
- `npm test`: 14 tests fail in the ORIGINAL zip too (identical list — stale source-text assertions, e.g. test 21 expects `setDoc` in contentService). Phase A adds 12 passing tests and no new failures.

## New files
| File | Purpose |
|---|---|
| `src/lib/shareLinks.js` | HashRouter link builders (portal / unit / chapter), counts, access notices |
| `src/lib/sizeMeter.js` | byte sizes, "412 KB of 950 KB", warn at 80 %, chunked / over levels |
| `src/lib/chapterChunks.js` | split a chapter's blocks into parts < 950 KB and join them back |
| `src/lib/qr.js` | dependency-free QR code (byte mode, level M, up to ~213 chars) |
| `src/lib/saveStatus.js` | autosave chip model, progress labels, step counter |
| `src/lib/jsonWorkerClient.js`, `src/workers/json.worker.js` | JSON parse + format in a Web Worker (inline fallback) |
| `src/components/ui/Loaders.jsx` | `ButtonLoader`, `ProgressButton`, `InlineLoader`, `PageLoader`, `UploadProgress`, `SkeletonCard/List/Editor` |
| `src/components/ui/Tooltip.jsx` | hover / focus / long-press tooltip, Esc closes |
| `src/components/ui/SaveStatusChip.jsx`, `SizeMeter.jsx` | autosave chip with Retry; chapter size meter |
| `src/components/PublishedModal.jsx` | "Portal Published" + "Share links" modal (copy, open, Web Share, QR) |
| `src/styles/phaseA.css` | styles for all of the above + touch-target / safe-area rules |
| `tests/phaseA.test.mjs` | 12 tests |

## Modified files
- `src/services/contentService.js` — chunked chapters, progress callbacks, size-aware batches, skips unchanged chapters on autosave, friendly demo-mode quota error.
- `src/pages/BuilderPage.jsx` — progress on Save/Publish, Retry toasts, status chip, size meter, Publish + Share-links modal, `beforeunload` while busy / save failed, publish-validation errors are now shown (they were silently ignored before).
- `src/pages/PortalsPage.jsx`, `src/components/PortalTable.jsx` — "Share links" action for published portals.
- `src/components/builder/JsonBlockEditor.jsx` — deferred validation for big JSON, worker-based Format / Save / Import, JSON file limit 500 KB → 6 MB.
- `src/components/ui/SandboxFrame.jsx` — iframe document built only when near the viewport; edits applied at low priority.
- `src/App.jsx` — admin pages are now lazy routes (smaller initial JS for `/` and `/learn`).
- `src/components/Toast.jsx` — optional action button (`toast(msg, type, { action })`); old calls unchanged.
- `src/pages/StudentHome.jsx`, `LessonPage.jsx`, `CourseTree.jsx`, `PortalTable.jsx` — lazy images / skeleton / PageLoader.
- `index.html` — `viewport-fit=cover` (safe-area), `src/main.jsx` — imports `phaseA.css`, `package.json` — test script includes the new test file. No new npm packages.

## Data-model change (additive, backward compatible)
`portalContent|portalPublished/{id}/chapters/{chapterId}` — small chapters are stored exactly as before.
A chapter bigger than 950 KB is stored as `{ blocks: [], partCount: n }` plus `chapters/{id}/parts/{000..}` → `{ index, blocks }`.
Old single-document chapters have no `partCount` and are read unchanged. Limits: one block < 950 KB, one chapter < 12 MB.

## Firestore rules (additive)
`firestore.rules` gains two nested `match /parts/{partId}` blocks: under `portalContent` only the portal owner / admins read and write (same as chapters); under `portalPublished` any signed-in user reads, only the owner / admins write. Nothing existing was loosened. Deploy with `firebase deploy --only firestore:rules`.

## Cost
- Save: 1 read (list chapters) + writes only for chapters that changed since the last successful save in this tab (first save after opening writes all, as before).
- Open chapter list: 1 read per chapter doc + 1 extra read per part of big chapters only.
- Publish: 2 passes (draft + published) in batches of ≤ 400 ops / 8 MB; progress = batches committed.

## Manual test checklist
1. Open a portal → Save Draft: button shows "Saving n%", chip shows "Saved · last saved at hh:mm".
2. Disconnect network → edit → chip turns "Save failed — Retry", toast has Retry; reconnect and click.
3. Paste a ≥ 2 MB JSON into a JSON block → Format: UI stays responsive, button disabled while formatting; Save + Publish succeed; meter reads "x MB · saved in n parts"; reload and confirm the chapter is intact; students can open it.
4. Publish: "Portal Published" modal — copy portal / unit / chapter links, open in new tab, QR (scan it), Share (phones). Unit link opens its first chapter.
5. Reopen later: builder "Share links" button, and Portals list ⋮ → Share links.
6. Close the tab mid-publish: browser asks for confirmation.
7. Portal that is paid / private / inactive shows the notice in the modal.
8. Check 360 / 390 / 768 / 1024 / 1440 px on landing, portals, builder, lesson, modals.

## Intentionally NOT done in this build
- `manualChunks` tuning (cannot verify Vite 8 / Rolldown syntax without a build — risk of breaking the build); before/after bundle sizes and Lighthouse numbers.
- Deep memoisation / list virtualisation of `BuilderPage` and `LessonPage` (large, risky without running the app); only deferred values were added.
- `UploadProgress` and `InlineLoader` exist but are not yet wired into image / syllabus / profile uploads, PDF export or exam submit.
- Skeletons only on lesson loading; dashboards and notifications get them in Phases B–C.
- Full 5-width responsive audit — only global touch-target / overflow / safe-area rules were added.
