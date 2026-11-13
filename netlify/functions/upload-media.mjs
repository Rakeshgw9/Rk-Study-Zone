/**
 * RK Study Zone — media upload to GitHub (Netlify Function)
 *
 * The browser sends an image / PDF / JSON file (base64) together with the signed-in user's
 * Firebase ID token. This function checks the token, then commits the file into a GitHub
 * repository using a token that only lives on the server (Netlify environment variable).
 * The browser gets back a public CDN URL that is saved inside the lesson / profile / portal.
 *
 * Required Netlify environment variables (Site configuration → Environment variables):
 *   GITHUB_TOKEN     fine-grained or classic token with "Contents: read & write" on the media repo
 *   GITHUB_REPO      owner/repo   e.g.  Rakeshgw9/rk-study-zone-media   (must be a PUBLIC repo)
 * Optional:
 *   GITHUB_BRANCH    default "main"
 *   MEDIA_DIR        default "media"
 *   MEDIA_CDN        "jsdelivr" (default) or "raw"
 *   FIREBASE_API_KEY / FIREBASE_PROJECT_ID   (default: the VITE_FIREBASE_* values already on the site)
 */

const MAX_BYTES = 4.5 * 1024 * 1024 // Netlify Functions accept ~6 MB request bodies (base64 adds 33 %)

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/json': 'json',
}

const json = (status, body) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  })

const env = (k, d = '') => (typeof process !== 'undefined' && process.env && process.env[k]) || d
const cfg = () => ({
  token: env('GITHUB_TOKEN'),
  repo: env('GITHUB_REPO'),
  branch: env('GITHUB_BRANCH', 'main'),
  dir: env('MEDIA_DIR', 'media').replace(/^\/+|\/+$/g, ''),
  cdn: env('MEDIA_CDN', 'jsdelivr'),
  apiKey: env('FIREBASE_API_KEY') || env('VITE_FIREBASE_API_KEY'),
  projectId: env('FIREBASE_PROJECT_ID') || env('VITE_FIREBASE_PROJECT_ID'),
})

const cleanSegment = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

export function cleanFolder(folder) {
  const parts = String(folder || 'uploads')
    .split('/')
    .map(cleanSegment)
    .filter(Boolean)
    .slice(0, 4)
  return parts.length ? parts.join('/') : 'uploads'
}

export function publicUrl({ repo, branch, cdn }, path) {
  const enc = path.split('/').map(encodeURIComponent).join('/')
  return cdn === 'raw'
    ? `https://raw.githubusercontent.com/${repo}/${branch}/${enc}`
    : `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${enc}`
}

async function verifyUser(c, idToken) {
  if (!c.apiKey) throw Object.assign(new Error('Server is missing the Firebase API key.'), { status: 500 })
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(c.apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!r.ok) throw Object.assign(new Error('Please sign in again.'), { status: 401 })
  const u = (await r.json())?.users?.[0]
  if (!u?.localId) throw Object.assign(new Error('Please sign in again.'), { status: 401 })
  return u.localId
}

async function userRole(c, uid, idToken) {
  if (!c.projectId) return ''
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(c.projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
    { headers: { authorization: `Bearer ${idToken}` } }
  )
  if (!r.ok) return ''
  return (await r.json())?.fields?.role?.stringValue || ''
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json(204, {})
  const c = cfg()
  const configured = Boolean(c.token && /^[\w.-]+\/[\w.-]+$/.test(c.repo))

  if (req.method === 'GET') {
    return json(200, { ok: true, configured, repo: configured ? c.repo : '', branch: c.branch, dir: c.dir, cdn: c.cdn, maxMB: 4.5 })
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!configured) return json(501, { error: 'GitHub media storage is not configured (set GITHUB_TOKEN and GITHUB_REPO in Netlify).' })

  try {
    const auth = req.headers.get('authorization') || ''
    const idToken = auth.replace(/^Bearer\s+/i, '')
    if (!idToken) return json(401, { error: 'Please sign in first.' })

    let body
    try { body = await req.json() } catch { return json(400, { error: 'Invalid request.' }) }
    const { kind = 'media', folder, contentType, data, name } = body || {}
    const ext = TYPES[contentType]
    if (!ext) return json(415, { error: 'Only JPG, PNG, WEBP, GIF, PDF or JSON files are allowed.' })
    if (typeof data !== 'string' || !data) return json(400, { error: 'No file data received.' })
    const bytes = Buffer.from(data, 'base64')
    if (!bytes.length) return json(400, { error: 'The file is empty.' })
    if (bytes.length > MAX_BYTES) return json(413, { error: 'File is too large (max 4.5 MB).' })

    const uid = await verifyUser(c, idToken)

    let target
    if (kind === 'profile') {
      if (!contentType.startsWith('image/')) return json(415, { error: 'Profile photo must be an image.' })
      target = `users/${cleanSegment(uid)}`
    } else {
      const role = await userRole(c, uid, idToken)
      if (!['teacher', 'admin', 'superAdmin'].includes(role)) return json(403, { error: 'Only teachers and admins can upload lesson media.' })
      target = cleanFolder(folder)
    }

    const base = cleanSegment(String(name || '').replace(/\.[^.]+$/, '')) || 'file'
    const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${base}.${ext}`
    const path = [c.dir, target, fileName].filter(Boolean).join('/')

    const put = await fetch(`https://api.github.com/repos/${c.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${c.token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'rk-study-zone-media',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ message: `media: add ${fileName}`, content: data, branch: c.branch }),
    })
    if (!put.ok) {
      const detail = await put.text().catch(() => '')
      console.error('GitHub upload failed', put.status, detail.slice(0, 300))
      const hint = put.status === 404 ? 'Repository or branch not found, or the token has no access.' : put.status === 401 || put.status === 403 ? 'GitHub token was refused (check its Contents: write permission).' : 'GitHub refused the upload.'
      return json(502, { error: hint })
    }
    return json(200, { ok: true, url: publicUrl(c, path), path })
  } catch (e) {
    console.error('upload-media error', e)
    return json(e.status || 500, { error: e.message || 'Upload failed.' })
  }
}
