import { createHash } from 'node:crypto'

const env = (key) => process.env[key] || ''
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

function signParams(params, secret) {
  const text = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&')
  return createHash('sha1').update(text + secret).digest('hex')
}

async function verifyUser(idToken) {
  const apiKey = env('VITE_FIREBASE_API_KEY')
  if (!apiKey) throw new Error('Firebase API key is missing on the server.')
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) throw new Error('Please sign in again.')
  const user = (await response.json())?.users?.[0]
  if (!user?.localId) throw new Error('Invalid Firebase user.')
  return user.localId
}

async function getUserRole(uid, idToken) {
  const projectId = env('VITE_FIREBASE_PROJECT_ID')
  if (!projectId) throw new Error('Firebase project ID is missing.')
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`, {
    headers: { authorization: `Bearer ${idToken}` },
  })
  if (!response.ok) return ''
  const doc = await response.json()
  return doc?.fields?.role?.stringValue || ''
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' })
  const cloudName = env('CLOUDINARY_CLOUD_NAME')
  const apiKey = env('CLOUDINARY_API_KEY')
  const apiSecret = env('CLOUDINARY_API_SECRET')
  if (!cloudName || !apiKey || !apiSecret) return json(500, { error: 'Cloudinary credentials are not configured.' })

  try {
    const idToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!idToken) return json(401, { error: 'Please sign in first.' })
    const body = await req.json().catch(() => null)
    const publicId = String(body?.publicId || '')
    const resourceType = String(body?.resourceType || 'raw')
    if (!publicId.startsWith('media/') || publicId.length > 500 || !['image', 'video', 'raw'].includes(resourceType)) {
      return json(400, { error: 'Invalid Cloudinary asset.' })
    }

    const uid = await verifyUser(idToken)
    const role = await getUserRole(uid, idToken)
    if (!['teacher', 'admin', 'superAdmin'].includes(role)) {
      return json(403, { error: 'Only teachers and admins can delete media.' })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const params = { public_id: publicId, timestamp }
    const signature = signParams(params, apiSecret)
    const form = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: apiKey,
      signature,
    })
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/destroy`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !['ok', 'not found'].includes(result.result)) {
      console.error('Cloudinary delete failed:', result)
      return json(502, { error: 'Cloudinary could not delete this file.' })
    }
    return json(200, { ok: true, result: result.result })
  } catch (error) {
    console.error('Cloudinary delete error:', error.message)
    return json(500, { error: 'Could not delete Cloudinary media.' })
  }
}
