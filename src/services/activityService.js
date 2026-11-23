import { collection, doc, increment, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { dayKey, lastDays } from '../lib/activity'

/*
  Small per-day counters that power the teacher's live activity chart.
    portalActivity/{portalId}/days/{yyyy-mm-dd}            { day, enrolments, active, completions, updatedAt }
    portalActivity/{portalId}/days/{day}/actives/{uid}      marker → a student is counted once per portal per day
    portalActivity/{portalId}/completers/{uid}              marker → a completion is counted once per student
  Cost per student: ≤ 1 batched write (2 docs) per portal per day for "active", 1 for enrolment, 1 for completion.
  The teacher dashboard listens to ≤ 10 portals × ≤ 30 day docs, and only while the dashboard is open.
  Counters are client-written, so they are informational (not tamper-proof) — see docs.
*/
const LS = 'rk_demo_activity'
const readLS = () => { try { return JSON.parse(localStorage.getItem(LS)) ?? {} } catch { return {} } }
const demoListeners = new Set()
const bumpDemo = (portalId, field) => {
  const all = readLS()
  const day = dayKey()
  const row = ((all[portalId] ||= {})[day] ||= { day, enrolments: 0, active: 0, completions: 0 })
  row[field] += 1
  try { localStorage.setItem(LS, JSON.stringify(all)) } catch { /* storage full — ignore */ }
  demoListeners.forEach((fn) => fn())
}
const flagKey = (kind, uid, portalId, day = '') => `rk_act_${kind}_${uid}_${portalId}_${day}`
const dayRef = (portalId, day) => doc(db, 'portalActivity', portalId, 'days', day)

export async function recordEnrolment(portalId) {
  try {
    if (!isFirebaseConfigured) return bumpDemo(portalId, 'enrolments')
    const day = dayKey()
    await setDoc(dayRef(portalId, day), { day, enrolments: increment(1), updatedAt: serverTimestamp() }, { merge: true })
  } catch (e) { console.warn('Activity (enrolment) not recorded', e) }
}

/** Counts the student once per portal per day. */
export async function recordActive(user, portalId) {
  const day = dayKey()
  const key = flagKey('a', user.uid, portalId, day)
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    if (!isFirebaseConfigured) return bumpDemo(portalId, 'active')
    const batch = writeBatch(db)
    batch.set(doc(db, 'portalActivity', portalId, 'days', day, 'actives', user.uid), { uid: user.uid, at: serverTimestamp() })
    batch.set(dayRef(portalId, day), { day, active: increment(1), updatedAt: serverTimestamp() }, { merge: true })
    await batch.commit()
  } catch (e) { console.warn('Activity (active) not recorded', e) }
}

/** Counts the first time a student reaches 100 % in a portal. */
export async function recordCompletion(user, portalId) {
  const key = flagKey('c', user.uid, portalId)
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    if (!isFirebaseConfigured) return bumpDemo(portalId, 'completions')
    const day = dayKey()
    const batch = writeBatch(db)
    batch.set(doc(db, 'portalActivity', portalId, 'completers', user.uid), { uid: user.uid, at: serverTimestamp() })
    batch.set(dayRef(portalId, day), { day, completions: increment(1), updatedAt: serverTimestamp() }, { merge: true })
    await batch.commit()
  } catch (e) { console.warn('Activity (completion) not recorded', e) }
}

/** Live subscription → callback(dayDocs[]) with docs of the given portals for the last `days` days. Returns unsubscribe. */
export function watchActivity(portalIds, days, callback, onError) {
  const ids = (portalIds || []).slice(0, 10)
  const start = lastDays(days)[0]
  if (!ids.length) { callback([]); return () => {} }
  if (!isFirebaseConfigured) {
    const emit = () => { const all = readLS(); callback(ids.flatMap((id) => Object.values(all[id] || {}))) }
    const onStorage = (e) => { if (e.key === LS) emit() } // another tab in the same browser
    demoListeners.add(emit)
    window.addEventListener('storage', onStorage)
    emit()
    return () => { demoListeners.delete(emit); window.removeEventListener('storage', onStorage) }
  }
  const per = new Map()
  const emit = () => callback([...per.values()].flat())
  const offs = ids.map((id) => onSnapshot(
    query(collection(db, 'portalActivity', id, 'days'), where('day', '>=', start)),
    (snap) => { per.set(id, snap.docs.map((d) => d.data())); emit() },
    (err) => onError?.(err),
  ))
  return () => offs.forEach((off) => off())
}
