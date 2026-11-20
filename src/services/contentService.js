import {
  collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { emptyContent, migrateReadyMadeBlocks } from '../lib/content'
import { fromFirestoreSafe, toFirestoreSafe } from '../lib/firestoreSafe'
import { patchPortal } from './portalService'

/*
  portalContent/{portalId}                       { units:[...metadata only...], updatedAt, updatedBy }
  portalContent/{portalId}/chapters/{chapterId}  { unitId, chapterId, blocks:[...], updatedAt }
  portalPublished/{portalId}                     { units:[...metadata only...], publishedAt, publishedBy }
  portalPublished/{portalId}/chapters/{chapterId}{ unitId, chapterId, blocks:[...], publishedAt }
*/
const DOC_LIMIT = 950 * 1024
const dKey = (id) => `rk_demo_content_${id}`
const pKey = (id) => `rk_demo_published_${id}`
const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }

export function contentSize(content) {
  return new Blob([JSON.stringify(content)]).size
}

/* Splits units into lightweight metadata + per-chapter heavy block payloads */
function splitUnitsAndBlocks(units = []) {
  const chapterPayloads = []
  const metaUnits = units.map((u) => ({
    ...u,
    chapters: (u.chapters || []).map((ch) => {
      const blocks = Array.isArray(ch.blocks) ? ch.blocks : []
      const blockBytes = new Blob([JSON.stringify(blocks)]).size
      if (blockBytes > DOC_LIMIT) {
        throw new Error(
          `Chapter "${ch.title || ch.id}" is ${(blockBytes / 1024).toFixed(0)} KB — over the 950 KB single-chapter limit. Please split its blocks or use image URLs.`
        )
      }
      chapterPayloads.push({
        chapterId: String(ch.id),
        unitId: String(u.id),
        blocks,
      })
      const { blocks: _omitted, ...chapterMeta } = ch
      return { ...chapterMeta, _splitBlocks: true }
    }),
  }))

  const metaBytes = new Blob([JSON.stringify(metaUnits)]).size
  if (metaBytes > DOC_LIMIT) {
    throw new Error(`Portal structure metadata is ${(metaBytes / 1024).toFixed(0)} KB — over the 950 KB limit.`)
  }

  return { metaUnits, chapterPayloads }
}

/* Reattaches subcollection chapter blocks back into units (falls back to inline blocks for legacy portals) */
function mergeUnitsAndBlocks(rawUnits = [], blocksByChapterId = new Map()) {
  return rawUnits.map((u) => ({
    ...u,
    chapters: (u.chapters || []).map((ch) => {
      const cid = String(ch.id)
      const { _splitBlocks, ...cleanMeta } = ch
      if (blocksByChapterId.has(cid)) {
        return { ...cleanMeta, blocks: blocksByChapterId.get(cid) }
      }
      return { ...cleanMeta, blocks: Array.isArray(ch.blocks) ? ch.blocks : [] }
    }),
  }))
}

async function writeSplitContent(rootCol, portalId, content, metaFields) {
  const { metaUnits, chapterPayloads } = splitUnitsAndBlocks(content.units || [])
  const chaptersCol = collection(db, rootCol, portalId, 'chapters')

  // Find existing chapter docs so deleted chapters are cleaned up
  const existingSnap = await getDocs(chaptersCol)
  const activeIds = new Set(chapterPayloads.map((c) => c.chapterId))
  const staleDocs = existingSnap.docs.filter((d) => !activeIds.has(d.id))

  // Write in chunks of 400 operations (Firestore batch limit is 500)
  const ops = []
  for (const item of chapterPayloads) {
    ops.push({
      type: 'set',
      ref: doc(db, rootCol, portalId, 'chapters', item.chapterId),
      data: toFirestoreSafe({
        unitId: item.unitId,
        chapterId: item.chapterId,
        blocks: item.blocks,
        updatedAt: serverTimestamp(),
      }),
    })
  }
  for (const stale of staleDocs) {
    ops.push({ type: 'delete', ref: stale.ref })
  }
  ops.push({
    type: 'set',
    ref: doc(db, rootCol, portalId),
    data: {
      units: toFirestoreSafe(metaUnits),
      ...metaFields,
    },
  })

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 400)) {
      if (op.type === 'set') batch.set(op.ref, op.data)
      else batch.delete(op.ref)
    }
    await batch.commit()
  }
}

async function readSplitContent(rootCol, portalId) {
  const [rootSnap, chaptersSnap] = await Promise.all([
    getDoc(doc(db, rootCol, portalId)),
    getDocs(collection(db, rootCol, portalId, 'chapters')),
  ])
  if (!rootSnap.exists()) return null

  const blocksMap = new Map()
  chaptersSnap.forEach((d) => {
    const data = d.data()
    blocksMap.set(d.id, fromFirestoreSafe(data.blocks || []))
  })

  const rawUnits = fromFirestoreSafe(rootSnap.data().units || [])
  const mergedUnits = mergeUnitsAndBlocks(rawUnits, blocksMap)
  return { rootData: rootSnap.data(), units: mergedUnits }
}

export async function loadDraft(portalId) {
  if (!isFirebaseConfigured) return migrateReadyMadeBlocks(readLS(dKey(portalId)) || emptyContent())
  const res = await readSplitContent('portalContent', portalId)
  return res ? migrateReadyMadeBlocks({ units: res.units }) : emptyContent()
}

export async function saveDraft(portalId, content, user) {
  const at = Date.now()
  if (!isFirebaseConfigured) {
    localStorage.setItem(dKey(portalId), JSON.stringify(content))
  } else {
    await writeSplitContent('portalContent', portalId, content, {
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    })
  }
  await patchPortal(portalId, { draftUpdatedAt: at, unitsCount: content.units.length })
  return at
}

export async function loadPublished(portalId) {
  if (!isFirebaseConfigured) {
    const data = readLS(pKey(portalId))
    return data ? migrateReadyMadeBlocks(data) : null
  }
  const res = await readSplitContent('portalPublished', portalId)
  return res
    ? { ...migrateReadyMadeBlocks({ units: res.units }), publishedAt: res.rootData.publishedAt }
    : null
}

export async function publish(portalId, content, user) {
  const at = Date.now()
  if (!isFirebaseConfigured) {
    localStorage.setItem(dKey(portalId), JSON.stringify(content))
    localStorage.setItem(pKey(portalId), JSON.stringify({ ...content, publishedAt: at }))
  } else {
    await writeSplitContent('portalContent', portalId, content, {
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    })
    await writeSplitContent('portalPublished', portalId, content, {
      publishedAt: serverTimestamp(),
      publishedBy: user?.uid || null,
    })
  }
  await patchPortal(portalId, { publishedAt: at, draftUpdatedAt: at, unitsCount: content.units.length })
  return at
}

export function copyContentLocal(fromId, toId) {
  if (isFirebaseConfigured) return
  const d = localStorage.getItem(dKey(fromId))
  if (d) localStorage.setItem(dKey(toId), d)
}

export async function duplicateContent(fromId, toId, user) {
  const c = await loadDraft(fromId)
  if (c.units.length) await saveDraft(toId, c, user)
}