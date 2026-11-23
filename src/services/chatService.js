import {
  collection, doc, getDocs, increment, limit, onSnapshot, orderBy, query, serverTimestamp, startAfter, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { toMillis } from '../lib/id'
import { cleanText } from '../lib/profile'
import { cleanMessage, PAGE_SIZE, preview, threadIdOf } from '../lib/chat'
import { sendNotification } from './notificationService'

/*
  chatThreads/{portalId}_{studentUid}            { portalId, portalName, studentUid, studentName, teacherUid, status, lastMessage, lastMessageAt,
                                                   lastSender, unreadForTeacher, unreadForStudent, readByStudentAt, readByTeacherAt,
                                                   typingStudentAt, typingTeacherAt, context:{unitId,unitTitle,chapterId,chapterTitle,blockId} }
  chatThreads/{id}/messages/{messageId}          { senderUid, senderRole, text, imageUrl, context, createdAt }       (never edited or deleted)
  Cost: 1 message write + 1 thread write per message (+1 notification write when the other side had nothing unread).
        Listeners (thread + newest 30 messages) exist only while a chat panel / the inbox is open.
        "Delivered" = the server confirmed the write. "Read" = the other person's readBy…At is newer than the message.
*/
const LS = 'rk_demo_chat' // { threads:{id:thread}, messages:{id:[message]} }
const readLS = () => { try { return JSON.parse(localStorage.getItem(LS)) ?? { threads: {}, messages: {} } } catch { return { threads: {}, messages: {} } } }
const writeLS = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)) } catch { throw new Error('Demo storage is full.') } }
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
const subscribeDemo = (fn) => {
  const onStorage = (e) => { if (e.key === LS) fn() }
  listeners.add(fn); window.addEventListener('storage', onStorage); fn()
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage) }
}
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const ctxOf = (c) => {
  const out = {}
  for (const k of ['unitId', 'unitTitle', 'chapterId', 'chapterTitle', 'blockId']) if (c?.[k]) out[k] = cleanText(c[k], 120)
  return out
}
const SNAP = { serverTimestamps: 'estimate' }
const toThread = (id, d) => ({ ...d, id, lastAt: toMillis(d.lastMessageAt), readByStudentAt: toMillis(d.readByStudentAt), readByTeacherAt: toMillis(d.readByTeacherAt), typingStudentAt: toMillis(d.typingStudentAt), typingTeacherAt: toMillis(d.typingTeacherAt) })
const toMessage = (id, d, pending = false) => ({ id, ...d, at: toMillis(d.createdAt), pending })

/* ---------------- reading (listeners only while the UI is open) ---------------- */
export function watchThread(id, callback, onError) {
  if (!isFirebaseConfigured) return subscribeDemo(() => { const t = readLS().threads[id]; callback(t ? toThread(id, t) : null) })
  return onSnapshot(doc(db, 'chatThreads', id), (s) => callback(s.exists() ? toThread(s.id, s.data(SNAP)) : null), (e) => onError?.(e))
}

export function watchMessages(id, callback, onError) {
  if (!isFirebaseConfigured) return subscribeDemo(() => callback((readLS().messages[id] || []).slice(-PAGE_SIZE).map((m) => toMessage(m.id, m))))
  return onSnapshot(
    query(collection(db, 'chatThreads', id, 'messages'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)),
    (snap) => callback(snap.docs.map((d) => toMessage(d.id, d.data(SNAP), d.metadata.hasPendingWrites)).reverse()),
    (e) => onError?.(e),
  )
}

/** One older page (oldest → newest) before `beforeMs`. */
export async function loadOlderMessages(id, beforeMs) {
  if (!isFirebaseConfigured) {
    const all = (readLS().messages[id] || []).filter((m) => toMillis(m.createdAt) < beforeMs)
    return { messages: all.slice(-PAGE_SIZE).map((m) => toMessage(m.id, m)), hasMore: all.length > PAGE_SIZE }
  }
  const snap = await getDocs(query(collection(db, 'chatThreads', id, 'messages'), orderBy('createdAt', 'desc'), startAfter(Timestamp.fromMillis(beforeMs)), limit(PAGE_SIZE)))
  return { messages: snap.docs.map((d) => toMessage(d.id, d.data(SNAP))).reverse(), hasMore: snap.docs.length === PAGE_SIZE }
}

/** Teacher: own portals' threads. Admin / super admin: everything. (≤ 100 newest; no composite index needed.) */
export function watchInbox(user, callback, onError) {
  const isAdmin = user.role === 'admin' || user.role === 'superAdmin'
  if (!isFirebaseConfigured) {
    return subscribeDemo(() => callback(Object.entries(readLS().threads).map(([id, t]) => toThread(id, t)).filter((t) => isAdmin || t.teacherUid === user.uid)))
  }
  const q = isAdmin
    ? query(collection(db, 'chatThreads'), orderBy('lastMessageAt', 'desc'), limit(100))
    : query(collection(db, 'chatThreads'), where('teacherUid', '==', user.uid), limit(100))
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => toThread(d.id, d.data(SNAP)))), (e) => onError?.(e))
}

/* ---------------- writing ---------------- */
/** role: 'student' (creates / updates own thread) | 'teacher' (portal owner or admin replying). */
export async function sendMessage({ user, role, portal, thread, text, imageUrl = '', context }) {
  const studentUid = role === 'student' ? user.uid : thread.studentUid
  const id = threadIdOf(portal.id, studentUid)
  const clean = cleanMessage(text)
  if (!clean && !imageUrl) throw new Error('Type a message first.')
  const ctx = ctxOf(context)
  const last = preview(clean || 'Sent a screenshot', 180)
  const msg = { senderUid: user.uid, senderRole: role, text: clean, imageUrl: imageUrl || '', context: ctx }

  if (!isFirebaseConfigured) {
    const all = readLS()
    const now = Date.now()
    const t = all.threads[id] || { portalId: portal.id, portalName: portal.name, studentUid, studentName: user.name || 'Student', teacherUid: portal.ownerId, unreadForTeacher: 0, unreadForStudent: 0, status: 'open' }
    all.threads[id] = role === 'student'
      ? { ...t, status: 'open', lastMessage: last, lastMessageAt: now, lastSender: 'student', unreadForTeacher: (t.unreadForTeacher || 0) + 1, unreadForStudent: 0, readByStudentAt: now, context: ctx }
      : { ...t, lastMessage: last, lastMessageAt: now, lastSender: 'teacher', unreadForStudent: (t.unreadForStudent || 0) + 1, unreadForTeacher: 0, readByTeacherAt: now }
    all.messages[id] = [...(all.messages[id] || []), { ...msg, id: newId(), createdAt: now }].slice(-300)
    writeLS(all); emit()
  } else {
    const batch = writeBatch(db)
    batch.set(doc(collection(db, 'chatThreads', id, 'messages')), { ...msg, createdAt: serverTimestamp() })
    const base = { lastMessage: last, lastMessageAt: serverTimestamp() }
    batch.set(doc(db, 'chatThreads', id), role === 'student'
      ? { ...base, portalId: portal.id, portalName: cleanText(portal.name, 120), studentUid, studentName: cleanText(user.name || 'Student', 80), teacherUid: portal.ownerId, status: 'open', lastSender: 'student', unreadForTeacher: increment(1), unreadForStudent: 0, readByStudentAt: serverTimestamp(), context: ctx }
      : { ...base, lastSender: 'teacher', unreadForStudent: increment(1), unreadForTeacher: 0, readByTeacherAt: serverTimestamp() }, { merge: true })
    await batch.commit()
  }

  // one notice per "burst": only when the other side had nothing unread yet (keeps writes low)
  const otherUnread = role === 'student' ? thread?.unreadForTeacher : thread?.unreadForStudent
  if (!otherUnread) {
    const chapter = ctx.chapterId ? `/${ctx.chapterId}` : ''
    sendNotification(role === 'student'
      ? { recipientUid: portal.ownerId, kind: 'chat', title: `${user.name || 'A student'} asked a question`, body: clean || 'Sent a screenshot', link: `/admin/messages/${id}`, portalId: portal.id, actor: user }
      : { recipientUid: studentUid, kind: 'chat', title: `${user.name || 'Your teacher'} replied to your question`, body: clean || 'Sent a screenshot', link: `/learn/${portal.id}${chapter}?chat=1`, portalId: portal.id, actor: user })
  }
  return id
}

export async function markThreadRead(role, id) {
  const patch = role === 'student' ? { unreadForStudent: 0, readByStudentAt: Date.now() } : { unreadForTeacher: 0, readByTeacherAt: Date.now() }
  try {
    if (!isFirebaseConfigured) {
      const all = readLS(); if (!all.threads[id]) return
      all.threads[id] = { ...all.threads[id], ...patch }; writeLS(all); emit(); return
    }
    await updateDoc(doc(db, 'chatThreads', id), { ...patch, [role === 'student' ? 'readByStudentAt' : 'readByTeacherAt']: serverTimestamp() })
  } catch (e) { console.warn('Could not mark the chat as read', e) }
}

const typingSent = new Map()
/** Lightweight typing signal: at most one tiny write every 4 s, and only while typing. */
export function sendTyping(role, id) {
  const now = Date.now()
  if (now - (typingSent.get(id) || 0) < 4000) return
  typingSent.set(id, now)
  const field = role === 'student' ? 'typingStudentAt' : 'typingTeacherAt'
  if (!isFirebaseConfigured) {
    const all = readLS(); if (!all.threads[id]) return
    all.threads[id][field] = now; writeLS(all); emit(); return
  }
  updateDoc(doc(db, 'chatThreads', id), { [field]: serverTimestamp() }).catch(() => {})
}

export async function setThreadStatus(id, status) {
  if (!['open', 'resolved'].includes(status)) return
  if (!isFirebaseConfigured) {
    const all = readLS(); if (all.threads[id]) { all.threads[id].status = status; writeLS(all); emit() }
    return
  }
  await updateDoc(doc(db, 'chatThreads', id), { status })
}
