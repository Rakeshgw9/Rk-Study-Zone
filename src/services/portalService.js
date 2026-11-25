import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { isAdminRole } from './authService'
import { uploadDocument, uploadImage } from './storageService'
import { toMillis } from '../lib/id'
import { toFirestoreSafe } from '../lib/firestoreSafe'
import { identityDiffers, ownerIdentity } from '../lib/profile'
import { beginUpload } from '../lib/uploadActivity'

/*
  portals/{id}
  { name, slug, description, category, accessType, status: 'active'|'draft',
    coverUrl, ownerId, ownerName, studentsCount, enrollmentsCount, loginsToday,
    publishedAt, draftUpdatedAt, createdAt, updatedAt }
*/
export const CATEGORIES = [
  { value: 'teacher-eligibility', label: 'Teacher Eligibility (OSSTET / OTET)' },
  { value: 'recruitment', label: 'Recruitment Exam (OAVS / OSSSC)' },
  { value: 'subject', label: 'Subject (Physical Education, Odia…)' },
  { value: 'pedagogy', label: 'Pedagogy & Education' },
  { value: 'course', label: 'Course / Test Series' },
  { value: 'other', label: 'Other' },
]
export const ACCESS_TYPES = [
  { value: 'free', label: 'Free — anyone can join' },
  { value: 'paid', label: 'Paid — enrollment required' },
  { value: 'private', label: 'Private — invite / code only' },
]

const KEY = 'rk_demo_portals'
const demoListeners = new Set()
export const demoRead = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? [] } catch { return [] } }
const writeAll = (list) => { localStorage.setItem(KEY, JSON.stringify(list)); demoListeners.forEach((fn) => fn()) }
export const notifyDemoPortals = () => demoListeners.forEach((fn) => fn())
const sortNewest = (list) => [...list].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))

/** Live list of portals the user manages (admin = all) */
export function watchPortals(user, callback, onError) {
  if (!user) return () => {}
  if (!isFirebaseConfigured) {
    const emit = () => { const all = demoRead(); callback(sortNewest(isAdminRole(user.role) ? all : all.filter((p) => p.ownerId === user.uid))) }
    demoListeners.add(emit); emit()
    return () => demoListeners.delete(emit)
  }
  const base = collection(db, 'portals')
  const q = isAdminRole(user.role) ? query(base) : query(base, where('ownerId', '==', user.uid))
  return onSnapshot(q, (snap) => callback(sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })))), (err) => { console.error(err); onError?.(err) })
}

/** Active portals visible to students */
// Landing, My Courses and notifications all need the same list: share one read for a short time.
// Every write in this module clears it, so a teacher's change is never hidden behind the cache.
const ACTIVE_TTL = 30000
let activeCache = null
const bustActive = () => { activeCache = null }

export async function listActivePortals() {
  if (!isFirebaseConfigured) return sortNewest(demoRead().filter((p) => p.status === 'active'))
  if (activeCache && Date.now() - activeCache.at < ACTIVE_TTL) return activeCache.promise.then((l) => l.slice())
  const promise = getDocs(query(collection(db, 'portals'), where('status', '==', 'active')))
    .then((snap) => sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  activeCache = { at: Date.now(), promise }
  promise.catch(() => { if (activeCache?.promise === promise) activeCache = null })
  return promise.then((l) => l.slice())
}

export async function getPortal(id) {
  if (!isFirebaseConfigured) return demoRead().find((p) => p.id === id) || null
  const s = await getDoc(doc(db, 'portals', id))
  return s.exists() ? { id: s.id, ...s.data() } : null
}

export async function isSlugTaken(slug, ignoreId) {
  if (!isFirebaseConfigured) return demoRead().some((p) => p.slug === slug && p.id !== ignoreId)
  const snap = await getDocs(query(collection(db, 'portals'), where('slug', '==', slug)))
  return snap.docs.some((d) => d.id !== ignoreId)
}

const coverPath = (uid, id) => `portal-covers/${uid}/${id}`

export async function createPortal(data, coverFile, user, extra = {}) {
  bustActive()
  const payload = {
    name: data.name.trim(), slug: data.slug.trim().toLowerCase(), description: (data.description || '').trim(),
    category: data.category || 'other', accessType: data.accessType || 'free', status: data.active ? 'active' : 'draft',
    coverUrl: extra.coverUrl || null, ownerId: user.uid, ...ownerIdentity(user),
    studentsCount: 0, enrollmentsCount: 0, loginsToday: 0, publishedAt: null,
  }
  if (!isFirebaseConfigured) {
    const id = 'p_' + Date.now()
    const coverUrl = coverFile ? await uploadImage(coverFile, coverPath(user.uid, id)) : payload.coverUrl
    writeAll([...demoRead(), { ...payload, id, coverUrl, createdAt: Date.now(), updatedAt: Date.now() }])
    return id
  }
  const ref = await addDoc(collection(db, 'portals'), toFirestoreSafe({ ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }))
  if (coverFile) await updateDoc(ref, toFirestoreSafe({ coverUrl: await uploadImage(coverFile, coverPath(user.uid, ref.id)) }))
  return ref.id
}

export async function updatePortal(id, data, coverFile, user) {
  bustActive()
  const patch = {
    name: data.name.trim(), slug: data.slug.trim().toLowerCase(), description: (data.description || '').trim(),
    category: data.category || 'other', accessType: data.accessType || 'free', status: data.active ? 'active' : 'draft',
  }
  if (coverFile) patch.coverUrl = await uploadImage(coverFile, coverPath(user.uid, id))
  return patchPortal(id, patch)
}

/** Low-level partial update */
export async function patchPortal(id, patch) {
  bustActive()
  if (!isFirebaseConfigured) { writeAll(demoRead().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p))); return }
  await updateDoc(doc(db, 'portals', id), toFirestoreSafe({ ...patch, updatedAt: serverTimestamp() }))
}

/* ---------- Syllabus (optional PDF / JPG / PNG / JSON per portal) ----------
  portalSyllabus/{portalId}            { name, type, size, parts, updatedAt }
  portalSyllabus/{portalId}/parts/{n}  { i, data }   ← the file as a data URL, split into ~600 KB pieces (Firestore 1 MB document limit)
  portals/{id} also gets { hasSyllabus, syllabusName, syllabusType } so the student page can show / hide the button. */
export const SYLLABUS_MAX = 5 * 1024 * 1024
const SYLLABUS_CHUNK = 600 * 1024
const SYLLABUS_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', json: 'application/json' }
const sylKey = (id) => `rk_demo_syllabus_${id}`

/** Returns the normalised mime type for an allowed syllabus file, or '' when the file is not allowed. */
export function syllabusType(file) {
  const ext = (file?.name?.split('.').pop() || '').toLowerCase()
  return SYLLABUS_EXT[ext] || ''
}
const readDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('Could not read the syllabus file.')); r.readAsDataURL(file) })

export async function saveSyllabus(portalId, file) {
  const type = syllabusType(file)
  if (!type) throw new Error('Syllabus must be a PDF, JPG, PNG or JSON file.')
  if (file.size > SYLLABUS_MAX) throw new Error('Syllabus must be 5 MB or smaller.')
  const data = (await readDataUrl(file)).replace(/^data:[^;,]*/, `data:${type}`)
  const meta = { name: file.name, type, size: file.size }
  if (!isFirebaseConfigured) {
    try { localStorage.setItem(sylKey(portalId), JSON.stringify({ ...meta, data })) } catch { throw new Error('Browser storage is full. Please upload a smaller syllabus file.') }
  } else {
    const parts = []
    for (let i = 0; i < data.length; i += SYLLABUS_CHUNK) parts.push(data.slice(i, i + SYLLABUS_CHUNK))
    const baseRef = doc(db, 'portalSyllabus', portalId)
    const old = await getDoc(baseRef)
    const job = beginUpload('Uploading syllabus')
    try {
      let done = 0
      await Promise.all(parts.map((chunk, i) => setDoc(doc(db, 'portalSyllabus', portalId, 'parts', String(i)), toFirestoreSafe({ i, data: chunk })).then(() => job.progress((++done / parts.length) * 100))))
    } finally { job.end() }
    await setDoc(baseRef, toFirestoreSafe({ ...meta, parts: parts.length, updatedAt: serverTimestamp() }))
    const oldParts = old.exists() ? Number(old.data().parts) || 0 : 0
    for (let i = parts.length; i < oldParts; i += 1) await deleteDoc(doc(db, 'portalSyllabus', portalId, 'parts', String(i))).catch(() => {})
  }
  await patchPortal(portalId, { hasSyllabus: true, syllabusName: meta.name, syllabusType: meta.type })
}

export async function loadSyllabus(portalId) {
  if (!isFirebaseConfigured) { try { return JSON.parse(localStorage.getItem(sylKey(portalId))) } catch { return null } }
  const base = await getDoc(doc(db, 'portalSyllabus', portalId))
  if (!base.exists()) return null
  const m = base.data()
  const parts = await Promise.all(Array.from({ length: Number(m.parts) || 0 }, (_, i) => getDoc(doc(db, 'portalSyllabus', portalId, 'parts', String(i)))))
  return { name: m.name, type: m.type, size: m.size, data: parts.map((p) => p.data()?.data || '').join('') }
}

async function removeSyllabusData(portalId) {
  if (!isFirebaseConfigured) { localStorage.removeItem(sylKey(portalId)); return }
  const base = await getDoc(doc(db, 'portalSyllabus', portalId))
  if (!base.exists()) return
  const n = Number(base.data().parts) || 0
  await Promise.allSettled(Array.from({ length: n }, (_, i) => deleteDoc(doc(db, 'portalSyllabus', portalId, 'parts', String(i)))))
  await deleteDoc(doc(db, 'portalSyllabus', portalId))
}

export async function deleteSyllabus(portalId) {
  await removeSyllabusData(portalId)
  await patchPortal(portalId, { hasSyllabus: false, syllabusName: null, syllabusType: null })
}

/* ---------- Several syllabus files per portal ----------
  portals/{id}.syllabusFiles = [ { id, name, type, size, url? , parts? } ]   (small metadata, readable by students)
    url    → file stored in the GitHub media repo (preferred, any size up to 4 MB)
    parts  → fallback: the file stored as data-URL pieces in portalSyllabus/{portalId}/parts/{fileId}_{n}
  Portals created before this change keep their single legacy syllabus (id 'main') — it still opens and can be removed. */
export const SYLLABUS_LIMIT = 10
const SYLLABUS_GITHUB_MAX = 4 * 1024 * 1024
const newFileId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const fileKey = (portalId, id) => `rk_demo_syllabus_${portalId}_${id}`

/** The syllabus files of a portal (handles portals that only have the old single syllabus) */
export function syllabusFilesOf(portal) {
  if (!portal) return []
  if (Array.isArray(portal.syllabusFiles) && portal.syllabusFiles.length) return portal.syllabusFiles
  if (portal.hasSyllabus) return [{ id: 'main', name: portal.syllabusName || 'Syllabus', type: portal.syllabusType || 'application/pdf', size: 0, legacy: true }]
  return []
}

async function storeSyllabusFile(portalId, file) {
  const type = syllabusType(file)
  if (!type) throw new Error(`${file.name}: only PDF, JPG, PNG or JSON files are allowed.`)
  if (file.size > SYLLABUS_MAX) throw new Error(`${file.name}: must be 5 MB or smaller.`)
  const id = newFileId()
  const meta = { id, name: file.name, type, size: file.size }
  if (isFirebaseConfigured && file.size <= SYLLABUS_GITHUB_MAX) {
    try {
      const blob = file.type === type ? file : new Blob([file], { type })
      const up = await uploadDocument(new File([blob], file.name, { type }), `syllabus/${portalId}`)
      if (up.storage === 'github') return { ...meta, url: up.url }
    } catch (e) { console.warn('Syllabus GitHub upload failed, keeping it in Firestore:', e.message) }
  }
  const data = (await readDataUrl(file)).replace(/^data:[^;,]*/, `data:${type}`)
  if (!isFirebaseConfigured) {
    try { localStorage.setItem(fileKey(portalId, id), JSON.stringify({ ...meta, data })) } catch { throw new Error(`${file.name}: browser storage is full.`) }
    return meta
  }
  const parts = []
  for (let i = 0; i < data.length; i += SYLLABUS_CHUNK) parts.push(data.slice(i, i + SYLLABUS_CHUNK))
  await Promise.all(parts.map((chunk, i) => setDoc(doc(db, 'portalSyllabus', portalId, 'parts', `${id}_${i}`), toFirestoreSafe({ i, data: chunk }))))
  return { ...meta, parts: parts.length }
}

async function removeSyllabusFileData(portalId, f) {
  if (f.legacy || f.id === 'main') return removeSyllabusData(portalId)
  if (!isFirebaseConfigured) { localStorage.removeItem(fileKey(portalId, f.id)); return }
  if (f.parts) await Promise.allSettled(Array.from({ length: f.parts }, (_, i) => deleteDoc(doc(db, 'portalSyllabus', portalId, 'parts', `${f.id}_${i}`))))
}

/** Apply staged syllabus changes: files to add (File[]) and ids to remove. Returns { files, errors }. */
export async function applySyllabusChanges(portalId, current, { add = [], removeIds = [] } = {}) {
  const errors = []
  let files = [...current]
  for (const id of removeIds) {
    const f = files.find((x) => x.id === id)
    if (!f) continue
    try { await removeSyllabusFileData(portalId, f) } catch (e) { console.warn('Could not remove syllabus data', e) }
    files = files.filter((x) => x.id !== id)
  }
  for (const file of add) {
    if (files.length >= SYLLABUS_LIMIT) { errors.push(`Only ${SYLLABUS_LIMIT} syllabus files are allowed per portal.`); break }
    try { files.push(await storeSyllabusFile(portalId, file)) } catch (e) { errors.push(e.message || `${file.name}: could not be saved.`) }
  }
  await patchPortal(portalId, {
    syllabusFiles: files,
    hasSyllabus: files.length > 0,
    syllabusName: files[0]?.name || null,
    syllabusType: files[0]?.type || null,
  })
  return { files, errors }
}

/** Load one syllabus file for viewing → { name, type, size, url } (url may be a data: URL) */
export async function loadSyllabusFile(portalId, f) {
  if (f.url) return { name: f.name, type: f.type, size: f.size, url: f.url }
  if (f.legacy || f.id === 'main') { const old = await loadSyllabus(portalId); return old?.data ? { name: old.name, type: old.type, size: old.size, url: old.data } : null }
  if (!isFirebaseConfigured) { try { const d = JSON.parse(localStorage.getItem(fileKey(portalId, f.id))); return d?.data ? { name: d.name, type: d.type, size: d.size, url: d.data } : null } catch { return null } }
  const parts = await Promise.all(Array.from({ length: f.parts || 0 }, (_, i) => getDoc(doc(db, 'portalSyllabus', portalId, 'parts', `${f.id}_${i}`))))
  const data = parts.map((p) => p.data()?.data || '').join('')
  return data ? { name: f.name, type: f.type, size: f.size, url: data } : null
}

async function removeAllSyllabusParts(portalId) {
  const snap = await getDocs(collection(db, 'portalSyllabus', portalId, 'parts'))
  await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)))
}

async function removeSubcollectionDocs(colName, portalId, subName) {
  const snap = await getDocs(collection(db, colName, portalId, subName))
  await Promise.allSettled(snap.docs.map((d) => deleteDoc(d.ref)))
}

/** Deletes the portal and its draft + published content (including chapter subcollections) */
export async function deletePortal(id) {
  bustActive()
  if (!isFirebaseConfigured) {
    localStorage.removeItem(sylKey(id))
    Object.keys(localStorage).filter((k) => k.startsWith(`rk_demo_syllabus_${id}_`)).forEach((k) => localStorage.removeItem(k))
    localStorage.removeItem(`rk_demo_content_${id}`); localStorage.removeItem(`rk_demo_published_${id}`)
    writeAll(demoRead().filter((p) => p.id !== id)); return
  }
  await Promise.allSettled([
    removeSubcollectionDocs('portalContent', id, 'chapters'),
    removeSubcollectionDocs('portalPublished', id, 'chapters'),
    deleteDoc(doc(db, 'portalContent', id)),
    deleteDoc(doc(db, 'portalPublished', id)),
    removeSyllabusData(id),
    removeAllSyllabusParts(id),
  ])
  await deleteDoc(doc(db, 'portals', id))
}

/** Copy a portal (details + draft content). Students/enrollments are not copied. */
export async function duplicatePortal(p, user) {
  let slug = `${p.slug}-copy`; let n = 2
  while (await isSlugTaken(slug)) slug = `${p.slug}-copy${n++}`
  const id = await createPortal({ name: `${p.name} (Copy)`, slug, description: p.description || '', category: p.category, accessType: p.accessType, active: false }, null, user, { coverUrl: p.coverUrl })
  return id
}

export function computeStats(portals) {
  return {
    totalStudents: portals.reduce((s, p) => s + (p.studentsCount || 0), 0),
    newEnrollments: portals.reduce((s, p) => s + (p.enrollmentsCount || 0), 0),
    studentLogins: portals.reduce((s, p) => s + (p.loginsToday || 0), 0),
    activePortals: portals.filter((p) => p.status === 'active').length,
  }
}
/* ---------- Teacher identity on portals (denormalised: students cannot read /users) ----------
  Copies name / photo / specialization / qualification onto every portal the user owns.
  Used after a profile edit and as a one-time backfill for portals created before this field existed.
  Cost: 1 query read (own portals) + 1 write per portal whose copy is out of date, in batches of 400. */
export async function syncOwnerIdentity(user, { onProgress } = {}) {
  bustActive()
  if (!user?.uid) return 0
  const identity = ownerIdentity(user)
  if (!isFirebaseConfigured) {
    const all = demoRead()
    const todo = all.filter((p) => p.ownerId === user.uid && identityDiffers(p, identity))
    if (!todo.length) return 0
    writeAll(all.map((p) => (todo.includes(p) ? { ...p, ...identity } : p)))
    onProgress?.(100, todo.length, todo.length)
    return todo.length
  }
  const snap = await getDocs(query(collection(db, 'portals'), where('ownerId', '==', user.uid)))
  const todo = snap.docs.filter((d) => identityDiffers(d.data(), identity))
  for (let i = 0; i < todo.length; i += 400) {
    const batch = writeBatch(db)
    todo.slice(i, i + 400).forEach((d) => batch.update(d.ref, toFirestoreSafe(identity)))
    await batch.commit()
    onProgress?.(Math.round((Math.min(i + 400, todo.length) / todo.length) * 100), Math.min(i + 400, todo.length), todo.length)
  }
  return todo.length
}

/** Teacher preference "notify me when a student submits an exam": copied to the teacher's portals so the student's
    browser knows whether to send the notice (students cannot read the teacher's private settings). */
export async function syncExamFlag(user, value) {
  bustActive()
  if (!user?.uid) return 0
  const flag = !!value
  if (!isFirebaseConfigured) {
    const all = demoRead()
    const todo = all.filter((p) => p.ownerId === user.uid && !!p.notifyExamSubmit !== flag)
    if (todo.length) writeAll(all.map((p) => (todo.includes(p) ? { ...p, notifyExamSubmit: flag } : p)))
    return todo.length
  }
  const snap = await getDocs(query(collection(db, 'portals'), where('ownerId', '==', user.uid)))
  const todo = snap.docs.filter((d) => !!d.data().notifyExamSubmit !== flag)
  for (let i = 0; i < todo.length; i += 400) {
    const batch = writeBatch(db)
    todo.slice(i, i + 400).forEach((d) => batch.update(d.ref, { notifyExamSubmit: flag }))
    await batch.commit()
  }
  return todo.length
}
