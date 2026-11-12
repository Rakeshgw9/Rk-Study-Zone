import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

import { db, isFirebaseConfigured } from '../firebase/config'
import { isAdminRole } from './authService'
import { uploadDocument, uploadImage } from './storageService'
import { deleteCloudinaryAsset } from './mediaService'
import { toMillis } from '../lib/id'

/*
  portals/{id}
  {
    name, slug, description, category, accessType,
    status: 'active'|'draft',
    coverUrl, ownerId, ownerName,
    studentsCount, enrollmentsCount, loginsToday,
    publishedAt, draftUpdatedAt, createdAt, updatedAt
  }
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

export const demoRead = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

const writeAll = (list) => {
  localStorage.setItem(KEY, JSON.stringify(list))
  demoListeners.forEach((fn) => fn())
}

export const notifyDemoPortals = () =>
  demoListeners.forEach((fn) => fn())

const sortNewest = (list) =>
  [...list].sort(
    (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
  )

/** Live list of portals the user manages (admin = all) */
export function watchPortals(user, callback, onError) {
  if (!user) return () => {}

  if (!isFirebaseConfigured) {
    const emit = () => {
      const all = demoRead()

      callback(
        sortNewest(
          isAdminRole(user.role)
            ? all
            : all.filter((p) => p.ownerId === user.uid)
        )
      )
    }

    demoListeners.add(emit)
    emit()

    return () => demoListeners.delete(emit)
  }

  const base = collection(db, 'portals')

  const q = isAdminRole(user.role)
    ? query(base)
    : query(base, where('ownerId', '==', user.uid))

  return onSnapshot(
    q,
    (snap) =>
      callback(
        sortNewest(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        )
      ),
    (err) => {
      console.error(err)
      onError?.(err)
    }
  )
}

/** Active portals visible to students */
export async function listActivePortals() {
  if (!isFirebaseConfigured) {
    return sortNewest(
      demoRead().filter((p) => p.status === 'active')
    )
  }

  const snap = await getDocs(
    query(
      collection(db, 'portals'),
      where('status', '==', 'active')
    )
  )

  return sortNewest(
    snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))
  )
}

export async function getPortal(id) {
  if (!isFirebaseConfigured) {
    return demoRead().find((p) => p.id === id) || null
  }

  const s = await getDoc(doc(db, 'portals', id))

  return s.exists()
    ? { id: s.id, ...s.data() }
    : null
}

export async function isSlugTaken(slug, ignoreId) {
  if (!isFirebaseConfigured) {
    return demoRead().some(
      (p) => p.slug === slug && p.id !== ignoreId
    )
  }

  const snap = await getDocs(
    query(
      collection(db, 'portals'),
      where('slug', '==', slug)
    )
  )

  return snap.docs.some((d) => d.id !== ignoreId)
}

const coverPath = (uid, id) =>
  `portal-covers/${uid}/${id}`

export async function createPortal(data, coverFile, user, extra = {}) {
  const payload = {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    description: data.description.trim(),
    category: data.category,
    accessType: data.accessType,
    status: data.active ? 'active' : 'draft',
    coverUrl: extra.coverUrl || null,
    ownerId: user.uid,
    ownerName: user.name || user.email,
    studentsCount: 0,
    enrollmentsCount: 0,
    loginsToday: 0,
    publishedAt: null,
  }

  if (!isFirebaseConfigured) {
    const id = 'p_' + Date.now()

    const coverUrl = coverFile
      ? await uploadImage(
          coverFile,
          coverPath(user.uid, id)
        )
      : payload.coverUrl

    writeAll([
      ...demoRead(),
      {
        ...payload,
        id,
        coverUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ])

    return id
  }

  const ref = await addDoc(
    collection(db, 'portals'),
    {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  )

  if (coverFile) {
    const coverUrl = await uploadImage(
      coverFile,
      coverPath(user.uid, ref.id)
    )

    await updateDoc(ref, { coverUrl })
  }

  return ref.id
}

export async function updatePortal(id, data, coverFile, user) {
  const patch = {
    name: data.name.trim(),
    slug: data.slug.trim().toLowerCase(),
    description: data.description.trim(),
    category: data.category,
    accessType: data.accessType,
    status: data.active ? 'active' : 'draft',
  }

  if (coverFile) {
    patch.coverUrl = await uploadImage(
      coverFile,
      coverPath(user.uid, id)
    )
  }

  return patchPortal(id, patch)
}

/** Low-level partial update */
export async function patchPortal(id, patch) {
  if (!isFirebaseConfigured) {
    writeAll(
      demoRead().map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              updatedAt: Date.now(),
            }
          : p
      )
    )

    return
  }

  await updateDoc(
    doc(db, 'portals', id),
    {
      ...patch,
      updatedAt: serverTimestamp(),
    }
  )
}

/* =========================================================
   SYLLABUS STORAGE
   New uploads: Cloudinary
   Metadata: Firestore
   Old Base64 files: Backward compatible
========================================================= */

export const SYLLABUS_MAX = 5 * 1024 * 1024

const SYLLABUS_EXT = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  json: 'application/json',
}

const sylKey = (id) =>
  `rk_demo_syllabus_${id}`

/** Returns the normalized MIME type */
export function syllabusType(file) {
  const ext = (
    file?.name?.split('.').pop() || ''
  ).toLowerCase()

  return SYLLABUS_EXT[ext] || ''
}

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()

    r.onload = () => resolve(r.result)

    r.onerror = () =>
      reject(
        new Error('Could not read the syllabus file.')
      )

    r.readAsDataURL(file)
  })

/** Upload a single syllabus file */
export async function saveSyllabus(portalId, file) {
  const type = syllabusType(file)

  if (!type) {
    throw new Error(
      'Syllabus must be a PDF, JPG, PNG or JSON file.'
    )
  }

  if (file.size > SYLLABUS_MAX) {
    throw new Error(
      'Syllabus must be 5 MB or smaller.'
    )
  }

  const meta = {
    name: file.name,
    type,
    size: file.size,
  }

  // Local demo mode
  if (!isFirebaseConfigured) {
    const data = (
      await readDataUrl(file)
    ).replace(/^data:[^;,]*/, `data:${type}`)

    try {
      localStorage.setItem(
        sylKey(portalId),
        JSON.stringify({
          ...meta,
          data,
        })
      )
    } catch {
      throw new Error(
        'Browser storage is full. Please upload a smaller syllabus file.'
      )
    }
  } else {
    // Production: upload to Cloudinary
    const blob =
      file.type === type
        ? file
        : new Blob([file], { type })

    const normalizedFile = new File(
      [blob],
      file.name,
      { type }
    )

    const uploaded = await uploadDocument(
      normalizedFile,
      `syllabus/${portalId}`
    )

    const baseRef = doc(
      db,
      'portalSyllabus',
      portalId
    )

    const old = await getDoc(baseRef)

    // Store only URL and metadata in Firestore
    await updateSyllabusDocument(
      baseRef,
      {
        ...meta,
        url: uploaded.url,
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        storage: 'cloudinary',
        updatedAt: serverTimestamp(),
      }
    )

    // Clean old Firestore Base64 chunks
    const oldParts = Number(
      old.data()?.parts
    ) || 0

    for (let i = 0; i < oldParts; i += 1) {
      await deleteDoc(
        doc(
          db,
          'portalSyllabus',
          portalId,
          'parts',
          String(i)
        )
      ).catch(() => {})
    }
  }

  await patchPortal(portalId, {
    hasSyllabus: true,
    syllabusName: meta.name,
    syllabusType: meta.type,
  })
}

/** Create or update syllabus metadata */
async function updateSyllabusDocument(ref, data) {
  const existing = await getDoc(ref)

  if (existing.exists()) {
    await updateDoc(ref, data)
  } else {
    await setDoc(ref, data)
  }
}

/** Load single syllabus (new Cloudinary + old Base64) */
export async function loadSyllabus(portalId) {
  if (!isFirebaseConfigured) {
    try {
      return JSON.parse(
        localStorage.getItem(sylKey(portalId))
      )
    } catch {
      return null
    }
  }

  const base = await getDoc(
    doc(db, 'portalSyllabus', portalId)
  )

  if (!base.exists()) return null

  const m = base.data()

  // New Cloudinary file
  if (m.url) {
    return {
      name: m.name,
      type: m.type,
      size: m.size,
      url: m.url,
      publicId: m.publicId || null,
      storage: m.storage || 'cloudinary',
    }
  }

  // Old Firestore Base64 chunks
  const parts = await Promise.all(
    Array.from(
      {
        length: Number(m.parts) || 0,
      },
      (_, i) =>
        getDoc(
          doc(
            db,
            'portalSyllabus',
            portalId,
            'parts',
            String(i)
          )
        )
    )
  )

  return {
    name: m.name,
    type: m.type,
    size: m.size,
    data: parts
      .map((p) => p.data()?.data || '')
      .join(''),
  }
}

async function removeSyllabusData(portalId) {
  if (!isFirebaseConfigured) {
    localStorage.removeItem(sylKey(portalId))
    return
  }

  const base = await getDoc(
    doc(db, 'portalSyllabus', portalId)
  )

  if (!base.exists()) return

  const baseData = base.data()
  if (baseData.publicId) {
    await deleteCloudinaryAsset(
      baseData.publicId,
      baseData.resourceType || 'raw'
    ).catch((error) => {
      console.warn('Could not delete Cloudinary syllabus asset:', error)
    })
  }

  const n = Number(baseData.parts) || 0

  await Promise.allSettled(
    Array.from(
      { length: n },
      (_, i) =>
        deleteDoc(
          doc(
            db,
            'portalSyllabus',
            portalId,
            'parts',
            String(i)
          )
        )
    )
  )

  await deleteDoc(
    doc(db, 'portalSyllabus', portalId)
  )
}

export async function deleteSyllabus(portalId) {
  await removeSyllabusData(portalId)

  await patchPortal(portalId, {
    hasSyllabus: false,
    syllabusName: null,
    syllabusType: null,
  })
}

/* =========================================================
   MULTIPLE SYLLABUS FILES PER PORTAL

   New files -> Cloudinary
   Firestore -> metadata + URL
   Old Firestore chunks -> backward compatibility
========================================================= */

export const SYLLABUS_LIMIT = 10

const newFileId = () =>
  `s${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`

const fileKey = (portalId, id) =>
  `rk_demo_syllabus_${portalId}_${id}`

/** Get all syllabus files for a portal */
export function syllabusFilesOf(portal) {
  if (!portal) return []

  if (
    Array.isArray(portal.syllabusFiles) &&
    portal.syllabusFiles.length
  ) {
    return portal.syllabusFiles
  }

  // Old single syllabus compatibility
  if (portal.hasSyllabus) {
    return [
      {
        id: 'main',
        name: portal.syllabusName || 'Syllabus',
        type:
          portal.syllabusType ||
          'application/pdf',
        size: 0,
        legacy: true,
      },
    ]
  }

  return []
}

/** Upload one syllabus file */
async function storeSyllabusFile(portalId, file) {
  const type = syllabusType(file)

  if (!type) {
    throw new Error(
      `${file.name}: only PDF, JPG, PNG or JSON files are allowed.`
    )
  }

  if (file.size > SYLLABUS_MAX) {
    throw new Error(
      `${file.name}: must be 5 MB or smaller.`
    )
  }

  const id = newFileId()

  const meta = {
    id,
    name: file.name,
    type,
    size: file.size,
  }

  // Local demo mode
  if (!isFirebaseConfigured) {
    const data = (
      await readDataUrl(file)
    ).replace(/^data:[^;,]*/, `data:${type}`)

    try {
      localStorage.setItem(
        fileKey(portalId, id),
        JSON.stringify({
          ...meta,
          data,
        })
      )
    } catch {
      throw new Error(
        `${file.name}: browser storage is full.`
      )
    }

    return meta
  }

  // Production: Cloudinary upload
  const blob =
    file.type === type
      ? file
      : new Blob([file], { type })

  const normalizedFile = new File(
    [blob],
    file.name,
    { type }
  )

  const uploaded = await uploadDocument(
    normalizedFile,
    `syllabus/${portalId}`
  )

  return {
    ...meta,
    url: uploaded.url,
    publicId: uploaded.publicId,
    resourceType: uploaded.resourceType,
    storage: 'cloudinary',
  }
}

/** Remove a syllabus file's Firestore or local data */
async function removeSyllabusFileData(portalId, f) {
  if (f.legacy || f.id === 'main') {
    return removeSyllabusData(portalId)
  }

  if (!isFirebaseConfigured) {
    localStorage.removeItem(
      fileKey(portalId, f.id)
    )
    return
  }

  // Remove old Base64 chunks if this is a legacy file
  if (f.parts) {
    await Promise.allSettled(
      Array.from(
        { length: f.parts },
        (_, i) =>
          deleteDoc(
            doc(
              db,
              'portalSyllabus',
              portalId,
              'parts',
              `${f.id}_${i}`
            )
          )
      )
    )
  }

  if (f.publicId) {
    await deleteCloudinaryAsset(
      f.publicId,
      f.resourceType || 'raw'
    )
  }
}

/** Apply staged syllabus changes */
export async function applySyllabusChanges(
  portalId,
  current,
  { add = [], removeIds = [] } = {}
) {
  const errors = []
  let files = [...current]

  // Remove selected files
  for (const id of removeIds) {
    const f = files.find((x) => x.id === id)

    if (!f) continue

    try {
      await removeSyllabusFileData(portalId, f)
    } catch (e) {
      console.warn(
        'Could not remove syllabus data',
        e
      )
    }

    files = files.filter(
      (x) => x.id !== id
    )
  }

  // Add new files
  for (const file of add) {
    if (files.length >= SYLLABUS_LIMIT) {
      errors.push(
        `Only ${SYLLABUS_LIMIT} syllabus files are allowed per portal.`
      )
      break
    }

    try {
      const uploaded = await storeSyllabusFile(
        portalId,
        file
      )

      files.push(uploaded)
    } catch (e) {
      errors.push(
        e.message ||
        `${file.name}: could not be saved.`
      )
    }
  }

  await patchPortal(portalId, {
    syllabusFiles: files,
    hasSyllabus: files.length > 0,
    syllabusName: files[0]?.name || null,
    syllabusType: files[0]?.type || null,
  })

  return {
    files,
    errors,
  }
}

/** Load one syllabus file for viewing */
export async function loadSyllabusFile(portalId, f) {
  // Cloudinary URL
  if (f.url) {
    return {
      name: f.name,
      type: f.type,
      size: f.size,
      url: f.url,
    }
  }

  // Old single syllabus
  if (f.legacy || f.id === 'main') {
    const old = await loadSyllabus(portalId)

    if (!old) return null

    return {
      name: old.name,
      type: old.type,
      size: old.size,
      url: old.url || old.data || null,
    }
  }

  // Local demo mode
  if (!isFirebaseConfigured) {
    try {
      const d = JSON.parse(
        localStorage.getItem(
          fileKey(portalId, f.id)
        )
      )

      return d?.data
        ? {
            name: d.name,
            type: d.type,
            size: d.size,
            url: d.data,
          }
        : null
    } catch {
      return null
    }
  }

  // Old Firestore Base64 chunks
  const parts = await Promise.all(
    Array.from(
      {
        length: f.parts || 0,
      },
      (_, i) =>
        getDoc(
          doc(
            db,
            'portalSyllabus',
            portalId,
            'parts',
            `${f.id}_${i}`
          )
        )
    )
  )

  const data = parts
    .map((p) => p.data()?.data || '')
    .join('')

  return data
    ? {
        name: f.name,
        type: f.type,
        size: f.size,
        url: data,
      }
    : null
}

/** Remove all old Firestore syllabus chunks */
async function removeAllSyllabusParts(portalId) {
  const snap = await getDocs(
    collection(
      db,
      'portalSyllabus',
      portalId,
      'parts'
    )
  )

  await Promise.allSettled(
    snap.docs.map((d) => deleteDoc(d.ref))
  )
}

/** Delete portal and its draft + published content */
export async function deletePortal(id) {
  if (!isFirebaseConfigured) {
    localStorage.removeItem(sylKey(id))

    Object.keys(localStorage)
      .filter((k) =>
        k.startsWith(`rk_demo_syllabus_${id}_`)
      )
      .forEach((k) =>
        localStorage.removeItem(k)
      )

    localStorage.removeItem(
      `rk_demo_content_${id}`
    )

    localStorage.removeItem(
      `rk_demo_published_${id}`
    )

    writeAll(
      demoRead().filter((p) => p.id !== id)
    )

    return
  }

  const portalRef = doc(db, 'portals', id)
  const portalSnap = await getDoc(portalRef)
  const syllabusFiles = portalSnap.exists()
    ? portalSnap.data()?.syllabusFiles || []
    : []

  await Promise.allSettled(
    syllabusFiles
      .filter((file) => file?.publicId)
      .map((file) =>
        deleteCloudinaryAsset(
          file.publicId,
          file.resourceType || 'raw'
        )
      )
  )

  await Promise.allSettled([
    deleteDoc(doc(db, 'portalContent', id)),
    deleteDoc(doc(db, 'portalPublished', id)),
    removeSyllabusData(id),
    removeAllSyllabusParts(id),
  ])

  await deleteDoc(portalRef)
}

/** Duplicate a portal (details + draft content) */
export async function duplicatePortal(p, user) {
  let slug = `${p.slug}-copy`
  let n = 2

  while (await isSlugTaken(slug)) {
    slug = `${p.slug}-copy${n++}`
  }

  const id = await createPortal(
    {
      name: `${p.name} (Copy)`,
      slug,
      description: p.description || '',
      category: p.category,
      accessType: p.accessType,
      active: false,
    },
    null,
    user,
    {
      coverUrl: p.coverUrl,
    }
  )

  return id
}

export function computeStats(portals) {
  return {
    totalStudents: portals.reduce(
      (s, p) => s + (p.studentsCount || 0),
      0
    ),

    newEnrollments: portals.reduce(
      (s, p) => s + (p.enrollmentsCount || 0),
      0
    ),

    studentLogins: portals.reduce(
      (s, p) => s + (p.loginsToday || 0),
      0
    ),

    activePortals: portals.filter(
      (p) => p.status === 'active'
    ).length,
  }
}