# RK Study Zone — Changes 9

1. **Uploads fixed everywhere (profile photo, portal cover, image blocks, sliders, heading backgrounds, unit backgrounds, JSON/HTML/MCQ images, rich-text images, syllabus)**
   Firebase Storage (paid) is no longer used. Files go to a GitHub repo through a Netlify Function (`netlify/functions/upload-media.mjs`, setup in `MEDIA_SETUP.md`).
   If GitHub is not set up / unreachable, images fall back to compressed inline images — an upload can no longer hang on "Uploading…" (30 s timeout).
   Profile photos: the Firebase Auth `photoURL` limit (it rejected inline photos) is handled — the photo is stored in `users/{uid}` and shown everywhere.
2. **Profile details** — Settings → Profile: name, phone, alternative email, school/institution, address, city, state, PIN, about-me (stored in `users/{uid}`), validation, Save Profile.
3. **Several syllabus files per portal** — Edit Portal → Syllabus → *Manage* popup: add many files, Replace, Delete (with a confirm popup). Applied when you press Save Changes. Students see a file list (tabs) with View / Download. Old single-syllabus portals keep working.
4. **Settings page** — Appearance & Accessibility (text size, reduce animations), Learning (auto-complete, highlight/pen toolbar, focus mode), Builder (autosave delay), Media Storage status check, Security (password reset email), Data & Firebase info, Reset preferences.
5. **Notes on every block and section** — "Add note" button on each block; inside custom HTML / JSON lessons every detected section/card gets its own button (bottom-right). *My Notes* popup lists all notes chapter-wise (chapter note + block/section notes) with search, Go to, Edit, Delete.
6. **Save PDF fixed** — all block types read from their real fields (the old export looked for wrong field names, so most content was missing), custom lessons are copied as students see them in an isolated shadow DOM, `100vh`/fixed/sticky neutralised, long blocks flow across pages (no half-empty pages / 36 pages), small cards kept together, fonts + images awaited.
7. **MCQ option-wise explanations** — each option can have its own explanation (bookmark icon on the option row). Exam result: *Show all explanations* button + per-question *Explain every option*. JSON: `"optionExplanations": ["…","…","…","…"]` (also accepts `explanations` as array or `{A:…,B:…}`, or options written as `{ "text": "…", "explanation": "…" }`). Template "With option-wise explanations" added in the MCQ JSON tab; export includes them.

## New / changed files
New: `netlify.toml`, `netlify/functions/upload-media.mjs`, `MEDIA_SETUP.md`, `src/services/mediaService.js`, `src/context/PrefsContext.jsx`, `src/components/SyllabusManagerModal.jsx`, `src/lib/sectionFinder.js`, `src/styles/changes9.css`, `tests/changes9.test.mjs`.
Changed: `storageService`, `authService`, `portalService`, `firebase/config`, `SettingsPage`, `PortalFormModal`, `SyllabusModal`, `LessonPage`, `BuilderPage` (autosave delay), `SandboxFrame`, `frameDoc`, `pdfExport`, `mcq.js`, `McqBlockEditor`, `McqExamModal`, `McqPlayer`, `studentService`, `App.jsx`, `main.jsx`.
Not touched: Firestore data schema of existing blocks, publish/draft logic, auth flow, rules (existing rules already allow all new fields).
The stale `dist/` folder was removed — Netlify rebuilds it.
