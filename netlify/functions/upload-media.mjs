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

// Netlify Functions accept ~6 MB request bodies and base64 adds 33 %, so 4 MB of file data (≈5.4 MB encoded + JSON) is the safe ceiling.
const MAX_BYTES = 4 * 1024 * 1024
const MAX_BODY_BYTES = 6 * 1024 * 1024

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
      'access-control-max-age': '86400',
      'x-content-type-options': 'nosniff',
    },
  })

/** The declared content type must match the real bytes (so a renamed file cannot be committed as an image / PDF). */
export function sniffMatches(contentType, bytes) {
  const b = bytes
  const at = (i, s) => s.split('').every((ch, k) => b[i + k] === ch.charCodeAt(0))
  switch (contentType) {
    case 'image/jpeg': return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    case 'image/png': return b.length > 8 && b[0] === 0x89 && at(1, 'PNG')
    case 'image/gif': return b.length > 6 && at(0, 'GIF8')
    case 'image/webp': return b.length > 12 && at(0, 'RIFF') && at(8, 'WEBP')
    case 'application/pdf': return b.length > 5 && at(0, '%PDF')
    case 'application/json': { try { JSON.parse(Buffer.from(b).toString('utf8')); return true } catch { return false } }
    default: return false
  }
}

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
    return json(200, { ok: true, configured, repo: configured ? c.repo : '', branch: c.branch, dir: c.dir, cdn: c.cdn, maxMB: 4 })
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  if (!configured) return json(501, { error: 'GitHub media storage is not configured (set GITHUB_TOKEN and GITHUB_REPO in Netlify).' })

  try {
    const auth = req.headers.get('authorization') || ''
    const idToken = auth.replace(/^Bearer\s+/i, '')
    if (!idToken) return json(401, { error: 'Please sign in first.' })

    const declared = Number(req.headers.get('content-length') || 0)
    if (declared > MAX_BODY_BYTES) return json(413, { error: 'File is too large (max 4 MB).' })

    let body
    try { body = await req.json() } catch { return json(400, { error: 'Invalid request.' }) }
    const { kind = 'media', folder, contentType, data, name } = body || {}
    const ext = TYPES[contentType]
    if (!ext) return json(415, { error: 'Only JPG, PNG, WEBP, GIF, PDF or JSON files are allowed.' })
    if (typeof data !== 'string' || !data) return json(400, { error: 'No file data received.' })
    const bytes = Buffer.from(data, 'base64')
    if (!bytes.length) return json(400, { error: 'The file is empty.' })
    if (bytes.length > MAX_BYTES) return json(413, { error: 'File is too large (max 4 MB).' })
    if (!sniffMatches(contentType, bytes)) return json(415, { error: 'The file content does not match its type.' })

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

    const putOnce = () => fetch(`https://api.github.com/repos/${c.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
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
    let put = await putOnce()
    // two uploads at the same moment can race on the branch head (409 / 422) — one quick retry fixes it
    if (put.status === 409 || put.status === 422) { await new Promise((r) => setTimeout(r, 350)); put = await putOnce() }
    if (!put.ok) {
      const detail = await put.text().catch(() => '')
      console.error('GitHub upload failed', put.status, detail.slice(0, 300))
      const limited = put.status === 429 || put.headers.get('x-ratelimit-remaining') === '0'
      const hint = limited ? 'GitHub is rate-limiting uploads. Please try again in a minute.' : put.status === 404 ? 'Repository or branch not found, or the token has no access.' : put.status === 401 || put.status === 403 ? 'GitHub token was refused (check its Contents: write permission).' : 'GitHub refused the upload.'
      return json(limited ? 503 : 502, { error: hint })
    }
    return json(200, { ok: true, url: publicUrl(c, path), path })
  } catch (e) {
    console.error('upload-media error', e)
    // only our own deliberate errors (they carry a status) are shown; unexpected failures stay generic
    return json(e.status || 500, { error: e.status ? e.message : 'Upload failed. Please try again.' })
  }
}
