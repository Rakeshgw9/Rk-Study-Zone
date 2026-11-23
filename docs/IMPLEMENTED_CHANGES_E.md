# Cleanup pass (after Phases A–D)

## Status (read first)
Still no working `npm install` in the authoring sandbox (the registry cannot be reached), so `npm run lint` and `npm run build` have NOT been run on any phase. All source and test files parse; 119 unit tests run, 106 pass.

## Done in this pass
- **App-wide upload feedback + leave-page warning.** Every upload that goes through the media service (cover images, lesson images, profile photo, chat screenshots, media blocks) now shows a small "Uploading … please keep this tab open" bar and the browser warns before the tab is closed while it runs. Syllabus upload shows real progress (parts written / total). The tracker (`lib/uploadActivity.js`) always clears itself, also when an upload fails, so the bar can never get stuck. Image/media uploads are a single request, so their bar is indeterminate (true byte-by-byte progress would need replacing `fetch` with `XMLHttpRequest`; not done).
- **Help text for "Access type"** in the portal form (what Free / Paid / Private mean for the share link).
- **Preview frames are memoised** (`SandboxFrame`): a block's preview no longer re-renders when a different block is edited and its own content is unchanged.
- **Test fix:** the stale assertion in `tests/diagnostic.test.mjs` ("every Firestore write goes through toFirestoreSafe") expected single-line `setDoc/addDoc/updateDoc` in `contentService`, which writes through batches. It now checks what it was meant to. Failing tests went from 14 to 13.
- **Correction about Odia:** the app has no UI-translation system (no language switch); "Odia" in the app is lesson *content* (Odia fields in JSON Studio). That content is untouched, so there is nothing to translate for the new screens unless you decide to add a UI language switch.
- **Checked, nothing to add:** Portals list and Dashboard already had loading skeletons; the PDF button already shows a spinner and is disabled while exporting; exam scoring is instant (the toast confirms it, saving is debounced), so there is no waiting step to show progress for.

## Not done (and why)
| Item | Reason |
|---|---|
| `manualChunks` tuning, before/after bundle sizes, Lighthouse estimate | Needs a working build; a wrong Vite 8 setting could break your build |
| Deep memoisation / virtualised lists in `BuilderPage` and `LessonPage` | Large refactor, unsafe without running the app; only `SandboxFrame` was memoised |
| Single block above 950 KB | Chunking splits between blocks, not inside one; the editor shows a clear message |
| Full 360 / 390 / 768 / 1024 / 1440 px visual audit | Needs a browser; only global touch-target / overflow / safe-area rules and responsive CSS for the new screens were added |
| Per-block chat context | Data model and rules support `blockId`; UI sets unit + chapter only |
| Server-side (rules) enforcement of "teacher needs a specialization" | Would tighten an existing rule |
| 13 failing tests | They fail in your ORIGINAL zip too and cover existing features (JSON Studio themes such as `midnight-slate`, `--js-font` text style, sidebar structure, tables). Either the tests or those features are out of date; I did not change features to make tests pass. Tell me which side is right and I will fix it |
| Lint / build / browser / rules-emulator runs | Not possible in the authoring sandbox |
