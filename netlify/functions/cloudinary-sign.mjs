
import { createHash, randomUUID } from 'node:crypto'

/*
  RK Study Zone
  Secure Cloudinary signed upload authorization.
  API Secret stays on Netlify server only.
*/

const env = (key) => process.env[key] || ''

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

const cleanSegment = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

function cleanFolder(value) {
  const parts = String(value || 'uploads')
    .split('/')
    .map(cleanSegment)
    .filter(Boolean)
    .slice(0, 4)

  return parts.length ? parts.join('/') : 'uploads'
}

// Verify Firebase ID token
async function verifyUser(idToken) {
  const apiKey = env('VITE_FIREBASE_API_KEY')

  if (!apiKey) {
    throw new Error('Firebase API key is missing on the server.')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    }
  )

  if (!response.ok) {
    throw new Error('Please sign in again.')
  }

  const user = (await response.json())?.users?.[0]

  if (!user?.localId) {
    throw new Error('Invalid Firebase user.')
  }

  return user.localId
}

// Read user's role from Firestore
async function getUserRole(uid, idToken) {
  const projectId = env('VITE_FIREBASE_PROJECT_ID')

  if (!projectId) {
    throw new Error('Firebase project ID is missing.')
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
    {
      headers: {
        authorization: `Bearer ${idToken}`,
      },
    }
  )

  if (!response.ok) return ''

  const document = await response.json()

  return document?.fields?.role?.stringValue || ''
}

// Cloudinary signature generation
function signParams(params, apiSecret) {
  const text = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')

  return createHash('sha1')
    .update(text + apiSecret)
    .digest('hex')
}

export default async function handler(req) {
  // Check Cloudinary configuration
  const cloudName = env('CLOUDINARY_CLOUD_NAME')
  const apiKey = env('CLOUDINARY_API_KEY')
  const apiSecret = env('CLOUDINARY_API_SECRET')

  const configured = Boolean(cloudName && apiKey && apiSecret)

  // Settings page health check
  if (req.method === 'GET') {
    return json(200, {
      configured,
      provider: 'cloudinary',
    })
  }

  if (req.method !== 'POST') {
    return json(405, {
      error: 'Method not allowed.',
    })
  }

  if (!configured) {
    return json(500, {
      error: 'Cloudinary credentials are not configured.',
    })
  }

  try {
    // 1. Firebase authentication
    const authorization =
      req.headers.get('authorization') || ''

    const idToken = authorization.replace(
      /^Bearer\s+/i,
      ''
    )

    if (!idToken) {
      return json(401, {
        error: 'Please sign in before uploading.',
      })
    }

    // 2. Request data
    let body

    try {
      body = await req.json()
    } catch {
      return json(400, {
        error: 'Invalid request data.',
      })
    }

    const {
      kind = 'media',
      folder = 'uploads',
      name = 'file',
      contentType = '',
    } = body || {}

    if (!['media', 'profile'].includes(kind)) {
      return json(400, {
        error: 'Invalid upload category.',
      })
    }

    // 3. Allowed file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/json',
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'audio/mpeg',
    ]

    if (!allowedTypes.includes(contentType)) {
      return json(415, {
        error: 'Unsupported file type.',
      })
    }

    if (
      kind === 'profile' &&
      !contentType.startsWith('image/')
    ) {
      return json(415, {
        error: 'Profile photo must be an image.',
      })
    }

    // 4. Verify Firebase user
    const uid = await verifyUser(idToken)

    // 5. Verify upload permission
    if (kind === 'media') {
      const role = await getUserRole(uid, idToken)

      if (!['teacher', 'admin', 'superAdmin'].includes(role)) {
        return json(403, {
          error: 'Only teachers and admins can upload media.',
        })
      }
    }

    // 6. Generate safe Cloudinary folder
    const targetFolder = kind === 'profile'
      ? `users/${cleanSegment(uid)}`
      : `media/${cleanFolder(folder)}`

    // 7. Generate unique public ID
    const extension = String(name)
      .split('.')
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    const baseName = cleanSegment(
      String(name).replace(/\.[^.]+$/, '')
    ) || 'file'

    const rawFile =
      contentType === 'application/pdf' ||
      contentType === 'application/json'

    const publicId = [
      Date.now(),
      randomUUID(),
      baseName,
    ].join('-') + (
      rawFile && extension
        ? `.${extension}`
        : ''
    )

    // 8. Generate signed upload parameters
    const timestamp = Math.floor(Date.now() / 1000)

    const params = {
      folder: targetFolder,
      public_id: publicId,
      timestamp,
    }

    const signature = signParams(
      params,
      apiSecret
    )

    // 9. Return temporary upload authorization
    return json(200, {
      cloudName,
      apiKey,
      timestamp,
      folder: targetFolder,
      publicId,
      signature,
    })

  } catch (error) {
    console.error(
      'Cloudinary signing error:',
      error.message
    )

    return json(500, {
      error: 'Could not authorize Cloudinary upload.',
    })
  }
}
