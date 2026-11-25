# Notification system

## Status of this build (read first)
- Same constraint as before: written without a working `npm install`, so `npm run lint` / `npm run build` were NOT run and nothing was clicked in a browser. All source files parse; 10 new unit tests pass (108 total, 94 pass). The same 14 tests that fail in your original zip still fail (identical list, none new).
- Deploy the updated rules: `firebase deploy --only firestore:rules`.
- Chat notifications (reply / new question) arrive with this release; the inbox plumbing for them is already here.

## What was built
- **Bell + dropdown** in the student header and the admin top bar: unread badge (`9+`), latest 8 items, "Mark all read", "View all". Screen readers get an `aria-live` unread count. Escape / outside click closes it.
- **Notifications page** (`/notifications` for students, `/admin/notifications` for staff): filters All / Unread / Messages / Content updates, mark as read, mark all as read, relative time ("5 min ago") plus absolute date/time, skeleton / empty / error (Retry) states, and the preference switches.
- **Clicking an item** opens its target (`/learn/{portal}/{chapter}` for content updates, dashboard / reports for teacher notices) and marks it read.
- **Content updates (students)** are created **only when the teacher presses Publish**, never on autosave. The app compares the new publish with the previous one (ids + content hashes) and writes ONE feed item, e.g. "3 new blocks in Unit 2 › Chapter 4 · 1 block updated in Unit 1 › Intro · New chapter: …". It includes teacher name, date/time (from the server time) and a deep link to the first changed chapter. New exam (MCQ) blocks are flagged. The teacher sees a toast "Students notified: …". If nothing visible changed, no item is created. Hidden blocks are ignored.
- **Teacher notices:** "New student enrolled" (always, unless muted) and "Exam submitted" (off by default; the teacher switches it on in preferences).
- **Preferences** (Settings and the Notifications page): mute content updates, mute chat, mute enrolment notices (teachers), notify on exam submit (teachers). Email / push are not offered (as agreed).
- **Retention:** items older than 60 days are hidden in the UI. Each stored item also carries `expireAt` so you can have Firestore delete them for free (see "Cleanup").

## Design choices
- **No per-student fan-out.** One feed item per publish at `portalUpdates/{portalId}/items/{id}`. Each student's browser compares it with their own `lastSeenAt` / `readFeed` (stored in `notificationState/{uid}`) and with the date they joined the portal (older updates are not shown).
- **Direct notices** (enrolment, exam, later chat) live in the recipient's own subcollection `users/{recipientUid}/notifications/{id}`. Chosen over a top-level `notifications` collection because the "newest 30" query then needs no composite index, and rules can simply say "only the owner reads".
- The last publish is stored as a compact signature in `portalUpdates/{portalId}` so the next diff needs 1 read, not a re-read of every chapter. Portals published before this feature get their signature rebuilt once, from the published copy, at the first publish after the upgrade.

## Data model (all new, additive)
| Path | Fields |
|---|---|
| `users/{uid}/notifications/{id}` | `kind` (enrol, exam; chat in D), `title`, `body`, `link`, `portalId`, `actorUid`, `actorName`, `read`, `createdAt`, `expireAt` |
| `notificationState/{uid}` | `lastSeenAt`, `readFeed{id:ms}`, `enrolled{portalId:ms}`, `prefs{muteContent,muteChat,muteEnrol,examSubmit}`, `backfilled` |
| `portalUpdates/{portalId}` | `signature` (JSON), `publishedAt` |
| `portalUpdates/{portalId}/items/{id}` | `portalId`, `portalName`, `title`, `summary`, `lines[]`, `chapterId`, `hasExam`, `teacherUid`, `teacherName`, `createdAt`, `expireAt` |
| `portals/{id}` | optional `notifyExamSubmit` (copied from the teacher's preference, so students' browsers know whether to send the notice) |

## Firestore rules (plain language)
- `users/{uid}/notifications`: only that person reads, marks read (the single field `read`) or deletes. Someone else may create a notice only if: kind is `enrol` or `exam`; they put their own uid as sender; it is unread; text lengths are capped; **they are enrolled in that portal**; and the recipient is **that portal's owner**. So nobody can message arbitrary users, and nobody can edit another person's notice.
- `notificationState/{uid}`: only that user.
- `portalUpdates/{portalId}`: portal owner / admins only. `.../items`: owner / admins create; **enrolled students** (and owner / admins) read. Nothing existing was loosened.

## Cost (Firebase free plan)
- Per user session: 1 read (state) + the bounded listener on the 30 newest direct notices (≤ 30 reads on load, then 1 per new notice) + 1 small query per joined portal (≤ 10 docs each). The feed refreshes on load, when the tab becomes visible again after ≥ 5 minutes, and when the bell is opened after ≥ 60 seconds. **No polling.**
- First load after the upgrade (students only): one-time backfill = 1 read per active portal to learn which they joined.
- Publish: +1 read (signature, or the published copy once for old portals) and +2 writes (signature + feed item).
- Enrolment: +1 write (teacher notice) +1 (state). Exam submit: +1 write, only if the teacher enabled it.

## Cleanup of old items
1. Firebase Console → Firestore → **Time-to-live (TTL)** → add a policy for collection group `notifications` on field `expireAt`, and another for collection group `items` on `expireAt`. Firestore then deletes items after 60 days automatically (can take up to ~24 h; the UI already hides them at 60 days).
2. Optional: delete `portalUpdates/{portalId}` documents of deleted portals when you remove a portal.

## Files
New: `lib/publishDiff.js`, `lib/notifications.js`, `services/notificationService.js`, `context/NotificationsContext.jsx`, `components/{NotificationBell,NotificationItem,NotificationPrefs}.jsx`, `pages/NotificationsPage.jsx`, `styles/phaseC.css`, `tests/phaseC.test.mjs`.
Modified: `App.jsx` (provider + routes), `components/Topbar.jsx`, `components/student/StudentHeader.jsx`, `pages/{BuilderPage,LessonPage,SettingsPage}.jsx`, `services/{studentService,portalService}.js`, `firestore.rules`, `main.jsx`, `package.json` (test script).

## Manual test checklist
1. Teacher edits a block → Publish → toast "Students notified: 1 block updated in …".
2. Enrolled student: bell shows a badge; the dropdown shows "Updated: <portal>" with teacher name, relative + absolute time; click → opens that chapter and the badge drops.
3. Publish again with no visible change → no new item. Autosave never creates one.
4. New student enrols → teacher bell shows "New student enrolled" live (two browsers).
5. Teacher turns on "Notify me when a student submits an exam" → a student submits an MCQ exam → teacher gets the notice.
6. Preferences: mute content → feed items disappear; unmute → they return.
7. Mark all as read; reload → still read. Filters work. Item older than 60 days is not shown.
8. Rules: as student B, try to read student A's `users/{A}/notifications` → denied; try creating a notice for a non-owner → denied.
9. Demo mode (no Firebase keys): works in two tabs of the same browser.

## Intentionally not done / known limits
- Lint, build and browser verification (see top).
- Chat reply / question notices (this release).
- New strings are English only (Odia translations still to do, listed in the remaining-work document).
- Students who never re-open the app only see new feed items on next load (no push, by design).
- Notices are client-written: a malicious enrolled student could create extra enrolment/exam notices for that portal's owner (rules cap size and shape, not frequency).
