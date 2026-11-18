# Diagnostic & Fix Report

## 4. Verification results (read this first)
| Check | Result |
|---|---|
| `npm test` | **PASS — 65 / 65** (54 existing + 11 new regression tests in `tests/diagnostic.test.mjs`) |
| `sync:css` | PASS — `jsonStudio.css` regenerated from `studioCss()`; drift test passes |
| Syntax parse of all 104 `src/tests/scripts/netlify` files (JS + JSX) | PASS — 0 errors |
| Static import/export resolution across `src/` | PASS — 0 missing files / names |
| `npm run lint` (oxlint) | **NOT RUN** — the sandbox has no npm-registry access, so `oxlint` could not be installed |
| `npm run build` (vite) | **NOT RUN** — same reason (`vite` could not be installed) |

Please run `npm ci && npm run lint && npm test && npm run build` once on your machine (Node >= 24.12).
Stale `dist/` and `node_modules/` were left out of the zip.

## 1. Critical bugs fixed
| File | Root cause | Fix |
|---|---|---|
| `lib/pdfExport.js` `cleanHtml` | Regex sanitiser missed `<img/onerror=…>`, `<svg/onload>`; output is written into a same-origin print frame -> stored XSS | DOM-based cleaner (removes dangerous tags, every `on*`, `srcdoc`, script URLs); stricter regex fallback without DOM |
| `lib/pdfExport.js` `downloadChapterPdf` | Images inside Shadow-DOM lessons were not in `doc.images`; `loading="lazy"` images never load in the off-screen frame -> blank images in PDF | Collect shadow-root images, force eager loading, wait for all; `print()` wrapped so the frame is cleaned up on error |
| `lib/jsonStudio.js` `renderStudioHtml` | Image / YouTube / id values were escaped for text, not attributes (`"` not escaped) -> attribute injection | `escAttr` for every attribute |
| `lib/jsonStudio.js`, `lib/jsonLesson.js` `fmt` / `inline` | `==x==`, `**x**`, `` `x` `` replaced inside tag attributes: links such as `?t=a==b==c` were corrupted | Tags are parked while marks are applied |
| `lib/content.js` `move` + reducer | Out-of-range `from` inserted `undefined` into units / chapters / blocks; actions on deleted ids threw inside the reducer | Integer + bounds guards; missing targets return the old state |
| `lib/jsonStudio.js` `arrayMove`, `moveSectionIndex` | `NaN` / fractional indexes moved items to index 0 | `Number.isInteger` guards |
| `lib/jsonStudio.js` `setSectionValue` | Path `__proto__.x` could pollute `Object.prototype` | Reserved keys rejected |
| `lib/richText.js` `richToText` / `isRichEmpty` | `null` rendered as the text "null" (null `odia*` / heading fields) | `String(v ?? '')` |
| `lib/blockLabel.js` | `sections` containing `null` or a non-array crashed the sidebar label | Array / null guards |
| `lib/blockRender.js` | `frameProps(block)` crashed when `block.data` was missing; unvalidated colours went into generated CSS (`background:undefined`) | Guards + colour whitelist |
| `lib/jsonLesson.js` | `hasFormula`, `hasLessonMcq`, `renderLessonHtml` crashed on non-array `sections` / `paragraphs` / `columns`; `{text, odiaText}` items printed `[object Object]` | Array guards; object items render, Odia line shown under paragraphs / list items |
| `lib/id.js`, `services/mediaService.js` | Transparent PNG/WEBP turned black when converted to JPEG; `resizeImage` leaked its object URL on error | White backdrop before JPEG export; URL always revoked |
| `lib/pageOcr.js` | PDF text layer joined Odia glyph fragments with spaces (broken words); `pdf.numPages` read after `destroy()`; PDF not destroyed on error; canvases kept | Gap-aware joining, `try/finally`, canvases released |
| `lib/blockRender.js` / `components/ui/StudioView.jsx` | Author CSS with a stray `}` could escape its block scope | `safeScopedCss` drops unbalanced / `@import` CSS |
| `services/authService.js` | A slow auth-state profile load could overwrite the fresher profile loaded after registration (teacher shown as student) | Reload counter ignores stale loads |

## 2. Security / Firestore / API hardening
* `firestoreSafe.js`: now also drops functions / symbols, turns `NaN` / `Infinity` into `null`, `bigint` into string, breaks circular references.
* **Every** `addDoc` / `setDoc` / `updateDoc` in `portalService`, `studentService` (this one previously wrote raw data), `userService`, `authService`, `contentService` goes through `toFirestoreSafe`; student data is restored with `fromFirestoreSafe` on read. A test fails if a new unwrapped write is added.
* `createPortal` no longer sends `undefined` (`ownerName`, `description`, `category`, `accessType`).
* `firestore.rules`: portal `ownerId` is immutable for non-admins; enrollment `portalId` / `ownerId` are immutable on update. All collections used by the services have matching rules; no public writes.
* `SandboxFrame.jsx`: messages are accepted only from the frame's own `contentWindow` (frames are sandboxed -> origin is `"null"`, so identity is the correct check); non-finite heights ignored.
* `upload-media.mjs`: size cap lowered 4.5 -> 4 MB (4.5 MB base64 exceeded Netlify's 6 MB body limit), early `content-length` check, magic-byte check of the declared type, one retry on GitHub 409/422, rate-limit message, generic message for unexpected errors, CORS `max-age`, `nosniff`. Client mirrors the cap and times out the health check.
* `.env.example` / `netlify.toml` / `firebase.json` reviewed: consistent, no change needed.

## 3. UI / JSON Studio / bilingual rendering
* Classic JSON renderer now shows `odiaText` under paragraphs and list items; null-safe for all Odia fields.
* All 16 themes (incl. `midnight-slate`) verified to have valid tokens and a rule in the one shared stylesheet used by the builder canvas, `StudioView` (lesson page) and the PDF; a test guards this.
* Fixed one brittle test (formatted CSS no longer matches a minified-only regex).

## Not changed (by design / needs your decision)
* Demo mode (`localStorage`) keeps demo passwords in plain text — it is a local-only fallback; never used when Firebase is configured.
* Custom HTML/JS blocks still run author JavaScript inside the sandboxed iframe (that is the feature).
* Uploaded GitHub files are not deleted when a block / portal is removed (documented in `MEDIA_SETUP.md`).
