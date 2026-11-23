import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { isAdminRole } from './authService'
import { fromFirestoreSafe, toFirestoreSafe } from '../lib/firestoreSafe'
import { portalPerformance } from '../lib/activity'
import { recordActive, recordCompletion, recordEnrolment } from './activityService'
import { markEnrolled, sendNotification } from './notificationService'

const notifyEnrolment = (user, portal) => {
  markEnrolled(user.uid, portal.id)
  sendNotification({ recipientUid: portal.ownerId, kind: 'enrol', title: 'New student enrolled', body: `${user.name || 'A student'} joined ${portal.name}`, link: '/admin/dashboard', portalId: portal.id, actor: user })
}

/*
  enrollments/{uid}_{portalId}  { uid, portalId, ownerId, name, email, createdAt, lastLoginAt }
  studentData/{uid}_{portalId}  { uid, portalId, completed:{blockId:true}, notes:{chapterId:text}, blockNotes:{key:{chapterId,blockId,label,text,updatedAt}},
                                  bookmarks:[chapterId], attempts:{blockId:n}, scores:{blockId:{...}}, lastChapterId }
*/
const sKey = (uid, pid) => `rk_demo_student_${uid}_${pid}`
const eKey = 'rk_demo_enrollments'
const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const emptyData = (uid, portalId) => ({ uid, portalId, completed: {}, notes: {}, blockNotes: {}, bookmarks: [], attempts: {}, scores: {}, lastChapterId: null, lastReading: null, chapterReading: {} })

export async function enroll(user, portal) {
  const id = `${user.uid}_${portal.id}`
  const now = Date.now()
  if (!isFirebaseConfigured) {
    const all = readLS(eKey, {})
    if (!all[id]) { recordEnrolment(portal.id); notifyEnrolment(user, portal) }
    recordActive(user, portal.id)
    all[id] = { ...(all[id] || { uid: user.uid, portalId: portal.id, ownerId: portal.ownerId, name: user.name, email: user.email, createdAt: now }), lastLoginAt: now }
    localStorage.setItem(eKey, JSON.stringify(all)); return
  }
  const ref = doc(db, 'enrollments', id)
  try {
    const s = await getDoc(ref)
    if (s.exists()) await updateDoc(ref, toFirestoreSafe({ lastLoginAt: serverTimestamp() }))
    else {
      await setDoc(ref, toFirestoreSafe({ uid: user.uid, portalId: portal.id, ownerId: portal.ownerId || null, name: user.name || '', email: user.email || '', createdAt: serverTimestamp(), lastLoginAt: serverTimestamp() }))
      recordEnrolment(portal.id)
      notifyEnrolment(user, portal)
    }
    recordActive(user, portal.id)
  } catch (e) { console.warn('Enrollment not saved', e) }
}

/** Real counts for the admin stat cards */
export async function enrollmentStats(user) {
  let list = []
  if (!isFirebaseConfigured) list = Object.values(readLS(eKey, {}))
  else {
    try {
      const base = collection(db, 'enrollments')
      const snap = await getDocs(isAdminRole(user.role) ? base : query(base, where('ownerId', '==', user.uid)))
      list = snap.docs.map((d) => d.data())
    } catch (e) { console.warn('Enrollment stats unavailable', e); return null }
  }
  const ms = (t) => (typeof t === 'number' ? t : t?.toMillis ? t.toMillis() : 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const month = new Date(today.getFullYear(), today.getMonth(), 1).getTime()
  const byPortal = {}
  list.forEach((e) => { byPortal[e.portalId] = byPortal[e.portalId] || { students: 0, thisMonth: 0, today: 0 }; const b = byPortal[e.portalId]; b.students++; if (ms(e.createdAt) >= month) b.thisMonth++; if (ms(e.lastLoginAt) >= today.getTime()) b.today++ })
  const recent = list
    .flatMap((e) => {
      const rows = [{ uid: e.uid, name: e.name || 'A student', portalId: e.portalId, kind: 'enrolled', at: ms(e.createdAt) }]
      if (ms(e.lastLoginAt) - ms(e.createdAt) > 60000) rows.push({ uid: e.uid, name: e.name || 'A student', portalId: e.portalId, kind: 'active', at: ms(e.lastLoginAt) })
      return rows
    })
    .filter((r) => r.at)
    .sort((a, b) => b.at - a.at)
    .slice(0, 10)
  return {
    byPortal,
    performance: portalPerformance(list),
    recent,
    totalStudents: new Set(list.map((e) => e.uid)).size,
    newEnrollments: list.filter((e) => ms(e.createdAt) >= month).length,
    studentLogins: list.filter((e) => ms(e.lastLoginAt) >= today.getTime()).length,
  }
}

export async function loadStudentData(uid, portalId) {
  if (!isFirebaseConfigured) return { ...emptyData(uid, portalId), ...readLS(sKey(uid, portalId), {}) }
  try {
    const s = await getDoc(doc(db, 'studentData', `${uid}_${portalId}`))
    return s.exists() ? { ...emptyData(uid, portalId), ...fromFirestoreSafe(s.data()) } : emptyData(uid, portalId)
  } catch (e) { console.warn(e); return emptyData(uid, portalId) }
}

export async function saveStudentData(data) {
  if (!isFirebaseConfigured) { localStorage.setItem(sKey(data.uid, data.portalId), JSON.stringify(data)); return }
  await setDoc(doc(db, 'studentData', `${data.uid}_${data.portalId}`), toFirestoreSafe({ ...data, updatedAt: serverTimestamp() }))
}

/** Writes the student's own progress summary onto their enrollment (so the teacher dashboard needs no extra reads). */
const lastSynced = new Map()
export async function syncEnrollmentProgress(user, portal, { pct, avgScore }) {
  const id = `${user.uid}_${portal.id}`
  const sig = `${pct}|${avgScore}`
  if (lastSynced.get(id) === sig) return
  lastSynced.set(id, sig)
  const patch = { progressPct: pct, ...(avgScore == null ? {} : { avgScore }) }
  try {
    if (!isFirebaseConfigured) {
      const all = readLS(eKey, {})
      if (all[id]) { all[id] = { ...all[id], ...patch }; localStorage.setItem(eKey, JSON.stringify(all)) }
    } else {
      await updateDoc(doc(db, 'enrollments', id), toFirestoreSafe({ ...patch, progressAt: serverTimestamp() }))
    }
    if (pct >= 100) recordCompletion(user, portal.id)
  } catch (e) { lastSynced.delete(id); console.warn('Progress summary not synced', e) }
}
