# Phase B — Teacher profile, portal identity, student discovery, dashboards

## Status of this build (read first)
- Same constraint as Phase A: written without a working `npm install`, so `npm run lint` / `npm run build` / Lighthouse were NOT run and nothing was clicked in a browser. All source files parse; 8 new unit tests pass (98 tests total, 84 pass). The same 14 tests that failed in your original zip still fail (identical list, none new).
- **Charts: no library added.** Instead of Chart.js/Recharts the activity chart is a small dependency-free SVG component, lazy-loaded as its own chunk. Reason: nothing to install, nothing extra to download, theme-aware through CSS variables. If you later want zoom/tooltips, Chart.js (~70 KB gz) is the lighter library to add.
- Needs `firebase deploy --only firestore:rules` (new `portalActivity` block).

## What was built
**3.1 Teacher profile.** New fields `specialization`, `qualification`, `experienceYears`, `subjects`, `languages`, `availability`, `website` (+ existing `bio`) in `users/{uid}`. Settings → Profile has a "Teacher profile" section for staff. Text is cleaned to plain text (no HTML), length-limited, website must be http(s). Teachers (role `teacher`) without a name/specialization see a "Complete your profile" modal once per session and cannot **create** (Portals → New) or **publish** (builder) until done; viewing / editing existing portals is never blocked. Admins and super admins are not forced to fill a specialization.

**3.2 Identity on portals.** `ownerName`, `ownerPhoto`, `ownerSpecialization`, `ownerQualification` are written on portal creation and kept in sync after a profile edit (`syncOwnerIdentity`, batches of ≤ 400 with progress shown on the Save button). A once-per-session silent backfill runs for the signed-in owner's older portals. `ownerPhoto` is only copied when it is a short http(s) URL (inline data: photos are not copied, to keep portal documents small). `users` rules are untouched.

**3.3 Student view.** My Courses cards show cover, name, teacher (photo + name + specialization), units/chapters, access type, created and last-updated dates and the student's progress. Filters: specialization, category, teacher, sort (recently updated / newest / name / my progress) and search by portal **or teacher name** (header search). The ⓘ button (and "Recommended" cards) open **Portal Details**: description, category, access, teacher summary, created/updated, outline (units → chapters), syllabus viewer, and Enrol & start / Continue learning (enrolment is created when the lesson opens, as before).

**3.4 Dashboards.**
- Teacher (Dashboard page): profile completeness, KPIs (published, draft, active today, avg completion / avg exam score), **live activity chart** (7 / 30 days, active students + new enrolments, listener on ≤ 10 portals × ≤ 30 day documents, only while the page is open), per-portal performance table, recent-activity feed, quick actions. Skeleton, empty and error (with Retry) states; text alternative + hidden data table for screen readers; light/dark through CSS variables.
- Student (My Courses): continue reading, overall progress, recent results, bookmarks count, recommended portals (same specialization / category as portals you started).
- Not included yet: "unanswered doubts" KPI and notifications widget — they arrive with Phases C and D.

## Data model (all additive, optional)
- `users/{uid}`: the new profile fields above.
- `portals/{id}`: `ownerName` (already existed), `ownerPhoto`, `ownerSpecialization`, `ownerQualification`.
- `enrollments/{uid}_{portalId}`: `progressPct`, `avgScore`, `progressAt` — the student's own summary, written by the student (existing update rule already allows extra fields). This is what lets the teacher table show completion/score with **no extra reads**.
- `portalActivity/{portalId}/days/{yyyy-mm-dd}`: `{ day, enrolments, active, completions, updatedAt }` counters; markers `.../days/{day}/actives/{uid}` and `portalActivity/{portalId}/completers/{uid}` make "active" count once per student per day and "completion" once per student.

## Firestore rules (plain language)
New block `portalActivity` only: portal owner/admins may **read** the counters; any signed-in user may create/update a day counter but only with the known fields, matching `day`, and by **at most +1 per write per counter** (cannot rewrite or lower it); marker documents are create-only and only for your own uid (a second create is an update → denied, which is what makes a batch "once only"). Nothing existing was loosened. Limitation: counters are client-written, so a determined student could inflate them slowly — they are informational. The "teacher must have a specialization" rule is enforced in the app, not in rules (changing the existing `portals` create rule would tighten an existing rule, which the brief did not allow).

## Cost
- Enrol: +1 write (counter). First visit of the day per portal: 1 batched write (2 docs). Completion: once per student. Progress summary: 1 write to the enrollment doc, debounced 2.5 s and only when the numbers changed.
- Teacher dashboard: ≤ 10 listeners × ≤ 30 docs initially, then 1 read per counter change; no listener when the page is closed. Performance table / feed reuse the existing `enrollmentStats` read.
- Student home: unchanged reads (it already loads every active portal's published content — a known N+1; left as is).
- Profile save: 1 query + 1 write per portal whose copy is outdated.

## Files
New: `lib/profile.js`, `lib/portalDiscovery.js`, `lib/activity.js`, `services/activityService.js`, `components/ProfileCompleteModal.jsx`, `components/TeacherProfileFields.jsx`, `components/student/{TeacherBadge,PortalDetailsModal,StudentOverview}.jsx`, `components/dashboard/{TeacherInsights,ActivityChart}.jsx`, `styles/phaseB.css`, `tests/phaseB.test.mjs`.
Modified: `services/{authService,portalService,studentService}.js`, `pages/{SettingsPage,AdminLayout,PortalsPage,BuilderPage,DashboardPage,StudentHome,LessonPage}.jsx`, `main.jsx`, `package.json` (test script), `firestore.rules`.

## Optional / required steps
- REQUIRED: deploy the updated `firestore.rules`.
- OPTIONAL: backfill is automatic (per session, per owner). Admins' portals owned by other teachers are filled when that teacher next opens the admin area.
- Existing teachers see the "Complete your profile" modal on next login.

## Manual test checklist
1. Teacher without specialization: modal appears; "New portal" and "Publish" re-open it; after saving both work; old portals open normally.
2. Edit specialization in Settings → portals update (toast "Updated … portals"); student card shows the new text.
3. Student home: teacher name/photo/specialization, created/updated dates; filter by specialization, teacher, category; search a teacher name; ⓘ opens Portal Details (description, outline, syllabus, teacher).
4. Two browsers: teacher on Dashboard, student enrols/opens a chapter → "Students active" bar and "New enrolments" point update without refresh (demo mode: two tabs of the same browser).
5. Dashboard with no activity → empty message; offline/rules error → error card with Retry.
6. Screen reader: chart announces the summary; the hidden table lists each day.
7. 360 / 768 / 1440 px: filters wrap, overview cards stack, details modal scrolls inside.

## Intentionally not done
- Lint/build/Lighthouse run; browser verification.
- Server-side (rules) enforcement of "teacher needs specialization".
- "Unanswered doubts" KPI and student notifications widget (Phases C / D).
- A Cloud-Function-free way to make activity counters tamper-proof.
