# RK Study Zone — Study Portal CMS
React + Vite · Bootstrap 5 · Bootstrap Icons · React Icons · Firebase (Auth, Firestore, Storage)

Structure: **Portal → Unit → Chapter → ordered Content Blocks (HTML/CSS/JS · JSON lesson · MCQ test)**.
Teachers/admins edit in the CMS (draft). **Publish** copies the draft to the published version that students read.

## Screens (design steps 1–15)
| # | Screen | Route |
|---|--------|-------|
| 1–2 | Landing + Sign-in / Create account popup (Student / Teacher) | `/` |
| 3–5 | Portals (empty state, Create Portal popup, list with search / filter / duplicate / delete) | `/admin/portals` |
| 6 | Portal builder — Structure tree · workspace · Setup guide, Preview / Save Draft / Publish | `/admin/builder/:portalId` |
| 7 | Create / edit Unit (title + font size, description, icon, colour) | builder |
| 8 | Unit workspace + Unit Actions (add chapter, settings, duplicate, move, delete) | builder |
| 9 | Create / edit Chapter (title, colour, background) | builder |
| 10 | Chapter workspace + Chapter Actions | builder |
| 11 | Add Block popup (HTML/CSS/JS · JSON · MCQ) | builder |
| 12 | HTML/CSS/JS editor — live preview, device toggle, packages, spacing, advanced | builder |
| 13 | JSON lesson editor — code / upload / URL import, format, validate, style presets | builder |
| 14 | MCQ editor — manual / JSON / upload, test settings, display, result & feedback | builder |
| 15 | Student lesson page — course tree, progress, MCQ tests, notes, bookmarks, prev/next | `/learn/:portalId/:chapterId` |
| — | Student home (My Courses / Progress / Bookmarks), Settings (users & roles), Reports | `/learn`, `/admin/settings`, `/admin/reports` |

Packages: HTML and JSON blocks have a **Packages / Libraries** panel — pick a ready package (Bootstrap, Bootstrap Icons, Font Awesome, Chart.js, KaTeX, Prism, GSAP, AOS, Swiper, Odia font …) or paste any `https://` CSS/JS URL.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill Firebase keys (leave empty = DEMO mode)
npm run dev                  # http://localhost:5173
npm run build                # production build → dist/
```
**DEMO mode** (data stays in the browser, nothing goes to Firebase) is used when the keys are empty,
when `VITE_USE_LOCAL_DATA=true`, or when you open the site with `?demo=1` (`?demo=0` switches back).
In demo mode the first account you create becomes Super Admin.

## Firebase setup (one time)
1. Console → **Authentication → Sign-in method → Email/Password → Enable**.
2. **Firestore Database** → create (production mode, `asia-south1`).
3. **Rules**: copy `firestore.rules` → Firestore → Rules → **Publish**.
   (or `firebase deploy --only firestore:rules,storage`)
4. **Storage** (optional): new projects need the **Blaze** plan for Storage. Without it, cover images
   and lesson images are automatically saved as compressed inline images, so the app still works.
   If you enable Storage, publish `storage.rules` too.
5. **Make yourself Super Admin**: sign up in the app as Teacher → Firestore → `users/{your uid}` →
   change `role` to `superAdmin` → refresh the app. After that you can change other users' roles from **Settings → Users & Roles**.

### Roles
| Role | Can do |
|------|--------|
| superAdmin / admin | everything, all portals, change user roles |
| teacher | create portals, edit/publish only own portals, see own students |
| student | read published portals, own progress, notes, bookmarks, test results |

## Firestore data model
```
users/{uid}                      name, email, role, createdAt
portals/{id}                     name, slug, description, category, accessType, status,
                                 coverUrl, ownerId, ownerName, publishedAt, counters
portalContent/{portalId}         { units:[ {id,title,…, chapters:[ {id,…, blocks:[…]} ]} ] }   ← DRAFT
portalPublished/{portalId}       same shape                                                 ← STUDENTS
enrollments/{uid}_{portalId}     uid, portalId, ownerId, name, email, createdAt, lastLoginAt
studentData/{uid}_{portalId}     completed, notes, bookmarks, attempts / results
Storage  portal-covers/{uid}/{portalId}/…   media/{portalId}/…
```
Note: one Firestore document can hold up to 1 MB. Keep big images in Storage or as image URLs.

## Folder structure
```
src/
  firebase/config.js     Firebase init + demo mode switch
  services/              auth, portal, content (draft/publish), student, user, storage
  lib/                   ids, content model + validation, json lessons, mcq, packages, progress
  context/               Auth, Theme (dark / light)
  components/ui/         shared Controls, Confirm dialog, CodeEditor, SandboxFrame, PackageManager, icons
  components/builder/    StructureTree, Workspace, SidePanels, Unit/Chapter/AddBlock modals, 3 block editors
  components/mcq/        McqPlayer (test runner)
  components/student/    StudentHeader, CourseTree
  pages/                 Landing, Portals, Dashboard, Builder, Lesson, StudentHome, Settings, Reports
  styles/theme.css       shell + steps 1–5;  styles/cms.css  design tokens + builder + student
```

## UI fixes and enhancements (November 2026)

This revision keeps the existing React/Vite + Bootstrap 5 architecture and current Firebase configuration. Key additions include full-width admin content, safer fixed-position portal action menus, responsive builder pane collapse controls, expanded editable HTML lesson templates, insertion controls between chapter blocks, chapter background colour/image customization, local-first image processing, publish link sharing, automatic MCQ JSON validation, and optional browser-side PDF/image OCR extraction.

### Local development

```bash
npm install
npm run dev
```

PDF/image OCR is loaded on demand from public CDN ESM builds; an internet connection is required for OCR. PDF text extraction is attempted first, then OCR is used for image-based pages. OCR results are draft candidates only and must be reviewed and completed (especially answer keys/options) before saving.

### Notes
- Uploaded portal/chapter images are compressed into data URLs by the existing image service boundary. For production-scale image libraries, switch that service boundary to Firebase Storage or another object store.
- Unit preview links use `?unit=<unitId>` and open the first chapter in that unit.
- The original Firebase configuration and Firestore services remain in place.


## Local development runtime

Use Node.js **24.12.0 or newer** for this project. The current Firebase dependency tree declares this minimum runtime.

```bash
npm install
npm run dev
```

For a production build, run `npm run build`. Portal, chapter and unit background images are currently processed locally in the browser and stored with the content draft; Firebase configuration remains available for future storage integration.


## CMS upgrade (rich text, code editor, JSON, MCQ, tables, chapter exams)
See **UPGRADE_NOTES.md** for setup (`npm install`), file map, behaviour and limitations.
