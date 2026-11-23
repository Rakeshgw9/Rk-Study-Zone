# Phase D — Live chat with teachers (Ask-a-Doubt)

## Status of this build (read first)
- Same constraint as before: written without a working `npm install`, so `npm run lint` / `npm run build` were NOT run and nothing was clicked in a browser. All source files parse; 10 new unit tests pass (118 total, 104 pass). The same 14 tests that fail in your original zip still fail (identical list, none new).
- **The Firestore rules for chat could not be run against the emulator here.** They were checked for balance and read through carefully, but please run the manual rules test below before going live.
- Deploy the updated rules: `firebase deploy --only firestore:rules`.

## Student experience
- Floating chat button bottom-right on the lesson page (above the "go to top" button); opens a compact panel, **full-screen on phones**. Hidden in draft preview and for the portal's own teacher.
- One thread per student per portal, addressed to the portal owner. A chip "Asking about: Unit 2 › Chapter 3" follows the chapter being read; the student can remove it (×) or bring it back ("Ask about this chapter").
- Enter sends, Shift+Enter = new line, 1000-character limit with counter, timestamps (relative; exact time on hover), **Sending… → Delivered → Read** ticks, typing indicator, auto-scroll (stays put if you scroll up to read old messages), "Load older messages" (30 per page), polite empty state, unread badge on the button, teacher availability line (from the teacher's profile "Availability note"), client rate limit (6 messages / minute).
- Optional screenshot (JPG/PNG/WEBP) compressed to 1000 px and uploaded through the existing **media service** (not Firebase Storage). If the media service falls back to inline images, anything over ~450 KB is rejected.
- Opening the chat marks it read and clears the bell notices of that portal. A chat reply notification deep-links to `/learn/{portal}/{chapter}?chat=1`, which opens the box.

## Teacher / admin experience
- **Messages** in the admin sidebar (unread badge) → `/admin/messages`. Conversation list with filters **All / Unread / Unanswered / Resolved**, portal filter, search (student, question text, portal, chapter), the context chip and unread count per row; newest first.
- Open a thread → reply live, typing indicator, **Resolve / Reopen**, **Chapter** (opens the chapter the student was reading) and **Builder** buttons. A student writing again reopens a resolved thread. On phones the list and the conversation are separate screens.
- Teachers receive only threads of their own portals (the query filters by `teacherUid`, and rules enforce it); admins / super admins see all.
- Teacher dashboard: new KPI **Unanswered doubts** and an "Open inbox" action.

## Notifications for chat (reuses Phase C)
- Student asks → teacher gets "<name> asked a question" (bell, Messages badge, dashboard KPI). Teacher replies → student gets "<teacher> replied to your question".
- **To keep writes low, a notice is created only when the other side had nothing unread yet** (first message of a burst). Later messages in the same burst update the thread counters but do not create more notices.

## Data model
- `chatThreads/{portalId}_{studentUid}`: `portalId, portalName, studentUid, studentName, teacherUid, status (open|resolved), lastMessage, lastMessageAt, lastSender, unreadForTeacher, unreadForStudent, readByStudentAt, readByTeacherAt, typingStudentAt, typingTeacherAt, context{unitId,unitTitle,chapterId,chapterTitle,blockId}`.
- `chatThreads/{id}/messages/{messageId}`: `senderUid, senderRole, text, imageUrl, context, createdAt` — append-only.
- Differences from the suggested model (and why): per-message `readAt` was replaced by two thread-level timestamps (`readByStudentAt` / `readByTeacherAt`) — a message is "Read" when the other side's timestamp is newer, which costs one write per open instead of one per message. `typing…At` fields and `portalName` were added (typing indicator; inbox without extra reads).
- `portals/{id}.ownerAvailability` (new, optional) is copied from the teacher's profile so students can see it; existing portals get it through the normal identity backfill.

## Firestore rules (plain language)
- **Read a thread:** the thread's student, the thread's teacher, admins. Nobody else, so no student can read another student's thread, and a teacher cannot read threads of someone else's portal. (Before a student's first question the thread does not exist; a student may only listen to their own, still-empty thread id.)
- **Create a thread:** only the student, only for their own id (`portalId_theirUid`), only if enrolled in the portal, and `teacherUid` must be the portal's owner; starts open with exactly 1 unread for the teacher.
- **Update a thread:** the student may change only student-side fields (own read/typing time, status, context, last message); the teacher side likewise. The *other* side's unread counter can only go up by 1 per write; your own counter can only go down. Nobody can change `studentUid`, `teacherUid`, `portalId`.
- **Delete a thread:** nobody.
- **Messages:** append-only (no edit, no delete — so nobody can alter another person's message). Sender id must be the signed-in user; a "student" message needs `senderRole = student` in the student's own thread, a "teacher" message needs the thread's teacher or an admin. Text ≤ 1000 characters, image link ≤ 500 000 characters, at least one of the two.
- **Chat notices (`users/{uid}/notifications`, kind `chat`):** only between the two sides of an existing thread (student → that thread's teacher; teacher/admin → that thread's student). `enrol` / `exam` notices keep their Phase C rules.

### Manual rules test (do this once; or use the Firebase Emulator)
1. Student A (enrolled) sends a question → thread `p1_A` exists.
2. Signed in as student B, in the browser console / emulator: `getDoc(doc(db,'chatThreads','p1_A'))` → must be **denied**; `getDocs(collection(db,'chatThreads','p1_A','messages'))` → **denied**; `addDoc` a message into `p1_A` → **denied**.
3. As teacher T2 who does not own p1: read `p1_A` → **denied**. As the owner / an admin → allowed.
4. Try `updateDoc(p1_A, { unreadForTeacher: 0 })` as student A → **denied**; `updateDoc(msg…)` / `deleteDoc(msg…)` as anyone → **denied**.

## Cost (Firebase free plan)
- Closed chat: **0 reads, 0 writes** (badge comes from the notification listener Phase C already runs).
- Open chat panel: 1 listener on the thread doc + 1 on the newest 30 messages; then 1 read per new message / per thread change (typing signals add a thread-doc read for the other side).
- Sending a message: 2 writes (message + thread) + 1 notice write only for the first message of a burst. Marking read: 1 write, only when there are unread messages. Typing: at most 1 tiny write per 4 s while typing.
- Teacher inbox: one listener on ≤ 100 threads, only while the page is open (no composite index needed; sorted in the browser for teachers).

## Demo mode
Threads and messages live in `localStorage` (`rk_demo_chat`); two tabs of the same browser (student in one, teacher in the other) update each other through the `storage` event.

## Files
New: `lib/chat.js`, `services/chatService.js`, `components/chat/{ChatThreadView.jsx,ChatWidget.jsx,useThread.js}`, `pages/MessagesPage.jsx`, `styles/phaseD.css`, `tests/phaseD.test.mjs`.
Modified: `App.jsx` (routes), `components/Sidebar.jsx` (Messages + badge), `context/NotificationsContext.jsx` (`markMatchingRead`), `pages/LessonPage.jsx` (lazy chat widget), `components/dashboard/TeacherInsights.jsx` (doubts KPI), `lib/profile.js` + `tests/phaseB.test.mjs` (`ownerAvailability`), `styles/phaseB.css`, `firestore.rules`, `main.jsx`, `package.json`.

## Manual test checklist
1. Student opens a chapter → floating button → send a question: it appears with "Sending…" then "Delivered"; the context chip shows the chapter.
2. Teacher (other browser) sees the thread in Messages live, with the unread badge, the chip, and a bell notice. Opening it clears the badge and the student sees "Read".
3. Teacher types → student sees the typing dots; teacher replies → student gets the message live and a notification; clicking it opens the chat.
4. Resolve → the student sees "Marked resolved"; the student writes again → the thread reopens.
5. Filters: Unread, Unanswered, Resolved, portal, search. "Chapter" opens the referenced chapter.
6. Send 7 messages within a minute → the 7th is refused with a friendly message. Shift+Enter makes a new line; 1000-character limit.
7. Attach a screenshot; remove it before sending; send one.
8. Phone width (360 / 390): chat is full-screen; inbox shows list then conversation with a back button.
9. Run the manual rules test above.

## Intentionally not done / known limits
- Lint, build, browser verification and rules-emulator tests (see top).
- Per-block context ("asking about this block"): the data model and rules support `blockId`, but the UI only sets unit + chapter.
- Typing indicator and "Read" depend on both sides having the thread open (by design — no background listeners).
- Chat text and notice titles are English only (Odia translations still open).
- A student can message again right after "Resolve"; there is no block / mute of a student.
- Chat history is never deleted automatically (messages carry no `expireAt`); add a retention policy later if volume grows.
