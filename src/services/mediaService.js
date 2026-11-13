import { auth, isFirebaseConfigured } from '../firebase/config'

/*
  Media storage (images, PDFs, JSON files) — NO Firebase Storage needed.

  1. The file is compressed in the browser.
  2. It is sent to the Netlify Function  /.netlify/functions/upload-media  which commits it to a
     GitHub repository (token stays on the server) and returns a public CDN URL.
  3. If the function is not reachable / not configured (local `vite` dev, demo mode, GitHub down),
     images fall back to compressed inline data URLs so uploads NEVER hang or get lost.
*/
const ENDPOINT = import.meta.env.VITE_MEDIA_UPLOAD_URL || '/.netlify/functions/upload-media'
const MODE = (import.meta.env.VITE_MEDIA_STORAGE || 'auto').toLowerCase() // auto | github | inline
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const UPLOAD_TIMEOUT = 30000

let unavailable = false // set when the function is missing / not configured, so we stop retrying this session
let lastStatus = null
export const getMediaStatus = () => lastStatus

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsDataURL(blob)
  })

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsDataURL(blob)
  })

/** Resize + compress an image file → Blob (keeps PNG for transparency unless it is big) */
export function compressImage(file, max = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * scale))
        c.height = Math.max(1, Math.round(img.height * scale))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        const keepPng = file.type === 'image/png' && file.size < 700 * 1024
        const type = keepPng ? 'image/png' : 'image/jpeg'
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not compress the image.'))), type, quality)
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read.')) }
    img.src = url
  })
}

async function postToGithub(blob, { kind, folder, name }) {
  const token = await auth?.currentUser?.getIdToken?.()
  if (!token) throw Object.assign(new Error('Please sign in again.'), { soft: true })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, folder, name, contentType: blob.type, data: await toBase64(blob) }),
    })
    let body = {}
    try { body = await res.json() } catch { /* not json (e.g. 404 html) */ }
    if (res.status === 404 || res.status === 501) { unavailable = true; lastStatus = { ok: false, reason: body.error || 'Upload function not found' }; throw Object.assign(new Error(body.error || 'Upload function not available'), { soft: true }) }
    if (!res.ok || !body.url) {
      lastStatus = { ok: false, reason: body.error || `Upload failed (${res.status})` }
      // permission / validation problems are shown to the user; infrastructure problems fall back silently
      throw Object.assign(new Error(body.error || `Upload failed (${res.status})`), { soft: res.status >= 500 || res.status === 401 })
    }
    lastStatus = { ok: true, url: body.url }
    return body.url
  } catch (e) {
    if (e.name === 'AbortError') throw Object.assign(new Error('Upload timed out.'), { soft: true })
    throw e
  } finally { clearTimeout(timer) }
}

/** Upload any allowed file (image / pdf / json). Returns { url, storage: 'github' | 'inline' } */
export async function uploadBlob(blob, { kind = 'media', folder = 'uploads', name = 'file', allowInline = true } = {}) {
  if (MODE !== 'inline' && isFirebaseConfigured && auth?.currentUser && !unavailable) {
    try {
      return { url: await postToGithub(blob, { kind, folder, name }), storage: 'github' }
    } catch (e) {
      console.warn('GitHub media upload failed:', e.message)
      // permission / validation errors are shown to the user; infrastructure problems fall back to inline images
      if (MODE === 'github' || !e.soft) throw e
    }
  }
  if (!allowInline) throw new Error('Media storage is not configured. Ask the admin to set up GitHub media storage (see MEDIA_SETUP.md).')
  return { url: await toDataUrl(blob), storage: 'inline' }
}

/** Compress + upload an image. Returns the URL (string) to save in your content. */
export async function uploadImageFile(file, { folder = 'uploads', kind = 'media', max = 1400, quality = 0.82, maxSizeMB = 8 } = {}) {
  if (!file) return null
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Only JPG, PNG or WEBP images are allowed.')
  if (file.size > maxSizeMB * 1024 * 1024) throw new Error(`Image must be ${maxSizeMB} MB or smaller.`)
  const blob = await compressImage(file, max, quality)
  const { url } = await uploadBlob(blob, { kind, folder, name: file.name })
  return url
}

/** Quick health check for Settings → Media storage */
export async function checkMediaStorage() {
  try {
    const res = await fetch(ENDPOINT, { method: 'GET' })
    if (!res.ok) return { reachable: false, configured: false }
    const j = await res.json()
    return { reachable: true, configured: !!j.configured, repo: j.repo, branch: j.branch, dir: j.dir, cdn: j.cdn }
  } catch { return { reachable: false, configured: false } }
}
