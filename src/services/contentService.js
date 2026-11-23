import {
  collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { emptyContent, migrateReadyMadeBlocks } from '../lib/content'
import { fromFirestoreSafe, toFirestoreSafe } from '../lib/firestoreSafe'
import { assertChapterFits, joinParts, partId, splitBlocks } from '../lib/chapterChunks'
import { byteLength, DOC_LIMIT_BYTES } from '../lib/sizeMeter'
import { patchPortal } from './portalService'

/*
  portalContent/{portalId}                       { units:[...metadata only...], updatedAt, updatedBy }
  portalContent/{portalId}/chapters/{chapterId}  { unitId, chapterId, blocks:[...], updatedAt }
  portalPublished/{portalId}                     { units:[...metadata only...], publishedAt, publishedBy }
  portalPublished/{portalId}/chapters/{chapterId}{ unitId, chapterId, blocks:[...], publishedAt }
*/
const dKey = (id) => `rk_demo_content_${id}`
const pKey = (id) => `rk_demo_published_${id}`
const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const BATCH_OPS = 400 // Firestore allows 500 operations per batch
const BATCH_BYTES = 8 * 1024 * 1024 // and ~10 MiB per commit — stay well under

export function contentSize(content) {
  return new Blob([JSON.stringify(content)]).size
}

/* Remembers what was last written for each chapter, so an autosave only re-writes the chapters that changed
   (big cost saver on the Firestore free plan). Recorded only after the batch commit succeeded. */
const writtenHash = new Map()
function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return `${str.length}:${(h >>> 0).toString(36)}`
}

/* Splits units into lightweight metadata + per-chapter block payloads.
   A chapter bigger than one document is split into several `parts` (see lib/chapterChunks). */
function splitUnitsAndBlocks(units = []) {
  const chapterPayloads = []
  const metaUnits = units.map((u) => ({
    ...u,
    chapters: (u.chapters || []).map((ch) => {
      const blocks = Array.isArray(ch.blocks) ? ch.blocks : []
      const split = splitBlocks(blocks)
      assertChapterFits(ch.title || ch.id, split)
      chapterPayloads.push({
        chapterId: String(ch.id),
        unitId: String(u.id),
        parts: split.parts,
        hash: hashString(JSON.stringify(blocks)),
        bytes: split.total,
      })
      const { blocks: _omitted, ...chapterMeta } = ch
      return { ...chapterMeta, _splitBlocks: true }
    }),
  }))

  const metaBytes = new Blob([JSON.stringify(metaUnits)]).size
  if (metaBytes > DOC_LIMIT_BYTES) {
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

/* onProgress(pct 0-100, step, totalSteps) is called after every committed batch.
   `range` maps this pass onto part of a bigger progress bar (publish = two passes). */
async function writeSplitContent(rootCol, portalId, content, metaFields, { onProgress, range = [0, 100] } = {}) {
  const { metaUnits, chapterPayloads } = splitUnitsAndBlocks(content.units || [])
  const chaptersCol = collection(db, rootCol, portalId, 'chapters')

  // Existing chapter docs: needed to clean up deleted chapters and leftover parts
  const existingSnap = await getDocs(chaptersCol)
  const existing = new Map(existingSnap.docs.map((d) => [d.id, d]))
  const activeIds = new Set(chapterPayloads.map((c) => c.chapterId))

  const ops = []
  for (const item of chapterPayloads) {
    const key = `${rootCol}/${portalId}/${item.chapterId}`
    const old = existing.get(item.chapterId)
    const oldParts = Number(old?.data()?.partCount) || 0
    const multi = item.parts.length > 1
    if (old && writtenHash.get(key) === item.hash) continue // unchanged since the last successful write
    const chapterRef = doc(db, rootCol, portalId, 'chapters', item.chapterId)
    ops.push({
      type: 'set',
      ref: chapterRef,
      bytes: multi ? 400 : item.bytes,
      data: toFirestoreSafe({
        unitId: item.unitId,
        chapterId: item.chapterId,
        blocks: multi ? [] : item.parts[0] || [],
        ...(multi ? { partCount: item.parts.length } : {}),
        updatedAt: serverTimestamp(),
      }),
    })
    if (multi) {
      item.parts.forEach((blocks, i) => {
        ops.push({
          type: 'set',
          ref: doc(db, rootCol, portalId, 'chapters', item.chapterId, 'parts', partId(i)),
          bytes: byteLength(blocks),
          data: toFirestoreSafe({ index: i, blocks, updatedAt: serverTimestamp() }),
        })
      })
    }
    // chapter shrank (or is now a single doc): remove leftover part documents
    for (let i = multi ? item.parts.length : 0; i < oldParts; i++) {
      ops.push({ type: 'delete', ref: doc(db, rootCol, portalId, 'chapters', item.chapterId, 'parts', partId(i)), bytes: 0 })
    }
    // remembered only once the LAST operation of this chapter (main doc + parts + cleanup) has been committed
    ops[ops.length - 1].onDone = () => writtenHash.set(key, item.hash)
  }
  for (const [id, d] of existing) {
    if (activeIds.has(id)) continue
    const n = Number(d.data()?.partCount) || 0
    for (let i = 0; i < n; i++) ops.push({ type: 'delete', ref: doc(db, rootCol, portalId, 'chapters', id, 'parts', partId(i)), bytes: 0 })
    ops.push({ type: 'delete', ref: d.ref, bytes: 0 })
    writtenHash.delete(`${rootCol}/${portalId}/${id}`)
  }
  // the structure document is written last, so readers never see units whose chapters are missing
  ops.push({ type: 'set', ref: doc(db, rootCol, portalId), bytes: 2000, data: { units: toFirestoreSafe(metaUnits), ...metaFields } })

  // group into batches by operation count AND payload size
  const batches = []
  let cur = []
  let curBytes = 0
  for (const op of ops) {
    if (cur.length && (cur.length >= BATCH_OPS || curBytes + op.bytes > BATCH_BYTES)) { batches.push(cur); cur = []; curBytes = 0 }
    cur.push(op)
    curBytes += op.bytes
  }
  if (cur.length) batches.push(cur)

  const [from, to] = range
  const report = (done) => onProgress?.(Math.round(from + ((to - from) * done) / batches.length), done, batches.length)
  report(0)
  for (let i = 0; i < batches.length; i++) {
    const batch = writeBatch(db)
    for (const op of batches[i]) {
      if (op.type === 'set') batch.set(op.ref, op.data)
      else batch.delete(op.ref)
    }
    await batch.commit()
    batches[i].forEach((op) => op.onDone?.())
    report(i + 1)
  }
}

async function readSplitContent(rootCol, portalId) {
  const [rootSnap, chaptersSnap] = await Promise.all([
    getDoc(doc(db, rootCol, portalId)),
    getDocs(collection(db, rootCol, portalId, 'chapters')),
  ])
  if (!rootSnap.exists()) return null

  const blocksMap = new Map()
  const bigOnes = []
  chaptersSnap.forEach((d) => {
    const data = d.data()
    if (Number(data.partCount) > 0) bigOnes.push(d) // big chapter: blocks live in parts/{n}
    else blocksMap.set(d.id, fromFirestoreSafe(data.blocks || []))
  })
  // only chapters that were chunked cost extra reads
  await Promise.all(bigOnes.map(async (d) => {
    const partsSnap = await getDocs(collection(db, rootCol, portalId, 'chapters', d.id, 'parts'))
    blocksMap.set(d.id, fromFirestoreSafe(joinParts(partsSnap.docs.map((p) => p.data()))))
  }))

  const rawUnits = fromFirestoreSafe(rootSnap.data().units || [])
  const mergedUnits = mergeUnitsAndBlocks(rawUnits, blocksMap)
  return { rootData: rootSnap.data(), units: mergedUnits }
}

export async function loadDraft(portalId) {
  if (!isFirebaseConfigured) return migrateReadyMadeBlocks(readLS(dKey(portalId)) || emptyContent())
  const res = await readSplitContent('portalContent', portalId)
  return res ? migrateReadyMadeBlocks({ units: res.units }) : emptyContent()
}

function setDemo(key, value) {
  try { localStorage.setItem(key, value) } catch {
    throw new Error('Demo mode storage is full (browser limit ~5 MB). Connect Firebase to save very large chapters.')
  }
}

export async function saveDraft(portalId, content, user, { onProgress } = {}) {
  const at = Date.now()
  if (!isFirebaseConfigured) {
    onProgress?.(10, 0, 1)
    setDemo(dKey(portalId), JSON.stringify(content))
    onProgress?.(100, 1, 1)
  } else {
    await writeSplitContent('portalContent', portalId, content, {
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    }, { onProgress })
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

export async function publish(portalId, content, user, { onProgress } = {}) {
  const at = Date.now()
  if (!isFirebaseConfigured) {
    onProgress?.(10, 0, 2)
    setDemo(dKey(portalId), JSON.stringify(content))
    onProgress?.(55, 1, 2)
    setDemo(pKey(portalId), JSON.stringify({ ...content, publishedAt: at }))
    onProgress?.(100, 2, 2)
  } else {
    // draft = first half of the progress bar, published copy = second half
    await writeSplitContent('portalContent', portalId, content, {
      updatedAt: serverTimestamp(),
      updatedBy: user?.uid || null,
    }, { onProgress, range: [0, 50] })
    await writeSplitContent('portalPublished', portalId, content, {
      publishedAt: serverTimestamp(),
      publishedBy: user?.uid || null,
    }, { onProgress, range: [50, 100] })
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