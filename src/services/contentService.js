import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { emptyContent, migrateReadyMadeBlocks } from '../lib/content'
import { patchPortal } from './portalService'

/*
  portalContent/{portalId}   { units:[...], updatedAt, updatedBy }   ← DRAFT (CMS only)
  portalPublished/{portalId} { units:[...], publishedAt, publishedBy } ← students read this
  Each document can hold up to ~1 MB.
*/
const LIMIT = 950 * 1024
const dKey = (id) => `rk_demo_content_${id}`
const pKey = (id) => `rk_demo_published_${id}`
const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }

export function contentSize(content) { return new Blob([JSON.stringify(content)]).size }

function checkSize(content) {
  const size = contentSize(content)
  if (size > LIMIT) throw new Error(`Portal content is ${(size / 1024).toFixed(0)} KB — over the 950 KB limit. Use image URLs instead of uploaded images, or split content into another portal.`)
}

export async function loadDraft(portalId) {
  if (!isFirebaseConfigured) return migrateReadyMadeBlocks(readLS(dKey(portalId)) || emptyContent())
  const s = await getDoc(doc(db, 'portalContent', portalId))
  return s.exists() ? migrateReadyMadeBlocks({ units: s.data().units || [] }) : emptyContent()
}

export async function saveDraft(portalId, content, user) {
  checkSize(content)
  const at = Date.now()
  if (!isFirebaseConfigured) { localStorage.setItem(dKey(portalId), JSON.stringify(content)) }
  else await setDoc(doc(db, 'portalContent', portalId), { units: content.units, updatedAt: serverTimestamp(), updatedBy: user?.uid || null })
  await patchPortal(portalId, { draftUpdatedAt: at, unitsCount: content.units.length })
  return at
}

export async function loadPublished(portalId) {
  if (!isFirebaseConfigured) { const data = readLS(pKey(portalId)); return data ? migrateReadyMadeBlocks(data) : null }
  const s = await getDoc(doc(db, 'portalPublished', portalId))
  return s.exists() ? { ...migrateReadyMadeBlocks({ units: s.data().units || [] }), publishedAt: s.data().publishedAt } : null
}

export async function publish(portalId, content, user) {
  checkSize(content)
  const at = Date.now()
  if (!isFirebaseConfigured) {
    localStorage.setItem(dKey(portalId), JSON.stringify(content))
    localStorage.setItem(pKey(portalId), JSON.stringify({ ...content, publishedAt: at }))
  } else {
    await setDoc(doc(db, 'portalContent', portalId), { units: content.units, updatedAt: serverTimestamp(), updatedBy: user?.uid || null })
    await setDoc(doc(db, 'portalPublished', portalId), { units: content.units, publishedAt: serverTimestamp(), publishedBy: user?.uid || null })
  }
  await patchPortal(portalId, { publishedAt: at, draftUpdatedAt: at, unitsCount: content.units.length })
  return at
}

export function copyContentLocal(fromId, toId) {
  if (isFirebaseConfigured) return
  const d = localStorage.getItem(dKey(fromId)); if (d) localStorage.setItem(dKey(toId), d)
}
export async function duplicateContent(fromId, toId, user) {
  const c = await loadDraft(fromId)
  if (c.units.length) await saveDraft(toId, c, user)
}
