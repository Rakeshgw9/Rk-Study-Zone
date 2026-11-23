import {
  addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { toMillis } from '../lib/id'
import { cleanText } from '../lib/profile'
import { contentSignature, diffSignatures, summarizeDiff } from '../lib/publishDiff'
import { DAY_MS, emptyState, normalizeState, pruneReadFeed, RETENTION_DAYS } from '../lib/notifications'
import { visibleContent } from '../lib/progress'

/*
  Data model (all new, nothing existing is touched)
    users/{uid}/notifications/{id}     direct notice for ONE person  { kind, title, body, link, portalId, actorUid, actorName, read, createdAt, expireAt }
    notificationState/{uid}            { lastSeenAt, readFeed:{itemId:ms}, enrolled:{portalId:ms}, prefs:{…}, backfilled }
    portalUpdates/{portalId}           { signature, publishedAt }                     ← what the last publish looked like (for the diff)
    portalUpdates/{portalId}/items/{id}  ONE feed item per publish { portalId, portalName, title, summary, lines[], chapterId, hasExam, teacherUid, teacherName, createdAt, expireAt }
  Students never get one document per notification for content updates: they read the feed of the portals they joined and
  compare with their own lastSeenAt / readFeed (no per-student fan-out).
  `expireAt` lets you switch on a Firestore TTL policy (Console → Firestore → TTL) to delete items after 60 days at no cost.
*/
const LS_DIRECT = 'rk_demo_notifications' // { [recipientUid]: [notice] }
const LS_FEED = 'rk_demo_feed' // { [portalId]: [item] }
const LS_SIG = 'rk_demo_pubsig' // { [portalId]: signature }
const lsState = (uid) => `rk_demo_notifstate_${uid}`
const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full */ } }
const demoListeners = new Set()
const emitDemo = () => demoListeners.forEach((fn) => fn())
const expire = () => Timestamp.fromMillis(Date.now() + RETENTION_DAYS * DAY_MS)
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/* ---------------- per-user state (lastSeenAt, read ids, joined portals, preferences) ---------------- */
export async function loadState(uid) {
  if (!isFirebaseConfigured) return normalizeState(readLS(lsState(uid), {}))
  try {
    const s = await getDoc(doc(db, 'notificationState', uid))
    return normalizeState(s.exists() ? s.data() : {})
  } catch (e) { console.warn('Notification state unavailable', e); return emptyState() }
}

export async function saveState(uid, patch) {
  if (!isFirebaseConfigured) {
    const cur = normalizeState(readLS(lsState(uid), {}))
    writeLS(lsState(uid), { ...cur, ...patch, prefs: { ...cur.prefs, ...(patch.prefs || {}) }, enrolled: { ...cur.enrolled, ...(patch.enrolled || {}) }, readFeed: { ...cur.readFeed, ...(patch.readFeed || {}) } })
    emitDemo()
    return
  }
  await setDoc(doc(db, 'notificationState', uid), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
}

/** Remember that the student joined a portal (feed items older than this are not shown). */
export const markEnrolled = (uid, portalId) => saveState(uid, { enrolled: { [portalId]: Date.now() } }).catch((e) => console.warn('markEnrolled failed', e))

/** One-time: students who enrolled before this feature existed → work out which portals they joined. */
export async function backfillEnrolled(user, activePortals) {
  const enrolled = {}
  await Promise.all(activePortals.map(async (p) => {
    try {
      if (!isFirebaseConfigured) {
        const e = readLS('rk_demo_enrollments', {})[`${user.uid}_${p.id}`]
        if (e) enrolled[p.id] = toMillis(e.createdAt) || Date.now()
      } else {
        const s = await getDoc(doc(db, 'enrollments', `${user.uid}_${p.id}`))
        if (s.exists()) enrolled[p.id] = toMillis(s.data().createdAt) || Date.now()
      }
    } catch { /* not enrolled / not readable */ }
  }))
  await saveState(user.uid, { enrolled, backfilled: true })
  return enrolled
}

/* ---------------- direct notifications (one recipient) ---------------- */
export async function sendNotification({ recipientUid, kind, title, body = '', link = '', portalId = '', actor }) {
  if (!recipientUid || !actor?.uid || recipientUid === actor.uid) return false
  const doc_ = {
    kind, title: cleanText(title, 120), body: cleanText(body, 300), link: String(link).slice(0, 200), portalId: String(portalId || ''),
    actorUid: actor.uid, actorName: cleanText(actor.name || actor.email || '', 80), read: false,
  }
  try {
    if (!isFirebaseConfigured) {
      const all = readLS(LS_DIRECT, {})
      all[recipientUid] = [{ ...doc_, id: newId(), createdAt: Date.now() }, ...(all[recipientUid] || [])].slice(0, 200)
      writeLS(LS_DIRECT, all)
      emitDemo()
      return true
    }
    await addDoc(collection(db, 'users', recipientUid, 'notifications'), { ...doc_, createdAt: serverTimestamp(), expireAt: expire() })
    return true
  } catch (e) { console.warn('Notification not sent', e); return false }
}

const fromDirect = (id, d) => ({ id, ...d, at: toMillis(d.createdAt) })

/** Live list of the 30 newest direct notices (bounded listener). Returns unsubscribe. */
export function watchDirect(uid, callback, onError) {
  if (!isFirebaseConfigured) {
    const emit = () => callback((readLS(LS_DIRECT, {})[uid] || []).map((d) => fromDirect(d.id, d)))
    const onStorage = (e) => { if (e.key === LS_DIRECT) emit() }
    demoListeners.add(emit); window.addEventListener('storage', onStorage); emit()
    return () => { demoListeners.delete(emit); window.removeEventListener('storage', onStorage) }
  }
  return onSnapshot(
    query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(30)),
    (snap) => callback(snap.docs.map((d) => fromDirect(d.id, d.data({ serverTimestamps: 'estimate' })))),
    (err) => onError?.(err),
  )
}

export async function markDirectRead(uid, ids) {
  if (!ids.length) return
  if (!isFirebaseConfigured) {
    const all = readLS(LS_DIRECT, {})
    all[uid] = (all[uid] || []).map((d) => (ids.includes(d.id) ? { ...d, read: true } : d))
    writeLS(LS_DIRECT, all); emitDemo(); return
  }
  const batch = writeBatch(db)
  ids.slice(0, 400).forEach((id) => batch.update(doc(db, 'users', uid, 'notifications', id), { read: true }))
  await batch.commit()
}

/* ---------------- content-update feed (one item per publish) ---------------- */
/** The signature of what students currently see (stored at the last publish; rebuilt once for older portals). */
export async function getPreviousSignature(portalId, loadPublishedFn) {
  try {
    if (!isFirebaseConfigured) {
      const s = readLS(LS_SIG, {})[portalId]
      if (s) return s
    } else {
      const s = await getDoc(doc(db, 'portalUpdates', portalId))
      if (s.exists() && s.data().signature) return JSON.parse(s.data().signature)
    }
    const published = await loadPublishedFn?.()
    return published?.units?.length ? contentSignature(visibleContent(published)) : null
  } catch (e) { console.warn('Previous publish state unavailable', e); return null }
}

/** Call right AFTER a successful publish. Writes 1 signature doc + (if something changed) 1 feed item. */
export async function recordPublishUpdate({ portal, content, user, prev }) {
  const signature = contentSignature(visibleContent(content))
  const diff = diffSignatures(prev, signature)
  const sigJson = JSON.stringify(signature)
  const keepSig = sigJson.length < 900 * 1024 // very large portals: skip the stored signature (next publish rebuilds it)
  let created = null
  if (!diff.first && !diff.empty) {
    const s = summarizeDiff(diff, portal.name)
    created = {
      portalId: portal.id, portalName: cleanText(portal.name, 120), title: cleanText(s.title, 140), summary: cleanText(s.summary, 400),
      lines: s.lines.map((l) => cleanText(l, 160)), chapterId: s.chapterId || '', hasExam: !!s.hasExam,
      teacherUid: user.uid, teacherName: cleanText(user.name || user.email || 'Teacher', 80),
    }
  }
  if (!isFirebaseConfigured) {
    const sigs = readLS(LS_SIG, {}); if (keepSig) sigs[portal.id] = signature; writeLS(LS_SIG, sigs)
    if (created) { const feed = readLS(LS_FEED, {}); feed[portal.id] = [{ ...created, id: newId(), createdAt: Date.now() }, ...(feed[portal.id] || [])].slice(0, 50); writeLS(LS_FEED, feed) }
    emitDemo()
    return created ? { created: true, summary: created.summary } : { created: false }
  }
  const batch = writeBatch(db)
  batch.set(doc(db, 'portalUpdates', portal.id), { signature: keepSig ? sigJson : '', publishedAt: serverTimestamp() })
  if (created) batch.set(doc(collection(db, 'portalUpdates', portal.id, 'items')), { ...created, createdAt: serverTimestamp(), expireAt: expire() })
  await batch.commit()
  return created ? { created: true, summary: created.summary } : { created: false }
}

/** Newest feed items of the portals the student joined. Cost: 1 query per joined portal (≤ 10 docs each). */
export async function fetchFeed(portalIds) {
  const ids = (portalIds || []).slice(0, 20)
  if (!isFirebaseConfigured) {
    const feed = readLS(LS_FEED, {})
    return ids.flatMap((id) => (feed[id] || []).map((x) => ({ ...x, at: toMillis(x.createdAt) })))
  }
  const lists = await Promise.all(ids.map(async (id) => {
    try {
      const snap = await getDocs(query(collection(db, 'portalUpdates', id, 'items'), orderBy('createdAt', 'desc'), limit(10)))
      return snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }), at: toMillis(d.data({ serverTimestamps: 'estimate' }).createdAt) }))
    } catch { return [] } // not joined / no rule access
  }))
  return lists.flat()
}

export const trimReadFeed = pruneReadFeed
