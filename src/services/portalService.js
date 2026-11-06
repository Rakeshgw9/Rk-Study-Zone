import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { isAdminRole } from './authService'
import { uploadImage } from './storageService'
import { toMillis } from '../lib/id'

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
export async function listActivePortals() {
  if (!isFirebaseConfigured) return sortNewest(demoRead().filter((p) => p.status === 'active'))
  const snap = await getDocs(query(collection(db, 'portals'), where('status', '==', 'active')))
  return sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
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
  const payload = {
    name: data.name.trim(), slug: data.slug.trim().toLowerCase(), description: data.description.trim(),
    category: data.category, accessType: data.accessType, status: data.active ? 'active' : 'draft',
    coverUrl: extra.coverUrl || null, ownerId: user.uid, ownerName: user.name || user.email,
    studentsCount: 0, enrollmentsCount: 0, loginsToday: 0, publishedAt: null,
  }
  if (!isFirebaseConfigured) {
    const id = 'p_' + Date.now()
    const coverUrl = coverFile ? await uploadImage(coverFile, coverPath(user.uid, id)) : payload.coverUrl
    writeAll([...demoRead(), { ...payload, id, coverUrl, createdAt: Date.now(), updatedAt: Date.now() }])
    return id
  }
  const ref = await addDoc(collection(db, 'portals'), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  if (coverFile) await updateDoc(ref, { coverUrl: await uploadImage(coverFile, coverPath(user.uid, ref.id)) })
  return ref.id
}

export async function updatePortal(id, data, coverFile, user) {
  const patch = {
    name: data.name.trim(), slug: data.slug.trim().toLowerCase(), description: data.description.trim(),
    category: data.category, accessType: data.accessType, status: data.active ? 'active' : 'draft',
  }
  if (coverFile) patch.coverUrl = await uploadImage(coverFile, coverPath(user.uid, id))
  return patchPortal(id, patch)
}

/** Low-level partial update */
export async function patchPortal(id, patch) {
  if (!isFirebaseConfigured) { writeAll(demoRead().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p))); return }
  await updateDoc(doc(db, 'portals', id), { ...patch, updatedAt: serverTimestamp() })
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
    await Promise.all(parts.map((chunk, i) => setDoc(doc(db, 'portalSyllabus', portalId, 'parts', String(i)), { i, data: chunk })))
    await setDoc(baseRef, { ...meta, parts: parts.length, updatedAt: serverTimestamp() })
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

/** Deletes the portal and its draft + published content */
export async function deletePortal(id) {
  if (!isFirebaseConfigured) {
    localStorage.removeItem(sylKey(id))
    localStorage.removeItem(`rk_demo_content_${id}`); localStorage.removeItem(`rk_demo_published_${id}`)
    writeAll(demoRead().filter((p) => p.id !== id)); return
  }
  await Promise.allSettled([deleteDoc(doc(db, 'portalContent', id)), deleteDoc(doc(db, 'portalPublished', id)), removeSyllabusData(id)])
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
