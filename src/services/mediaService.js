
import { auth, isFirebaseConfigured } from '../firebase/config'

/*
  Media storage:
  Images, PDFs, JSON and videos -> Cloudinary.
  Firebase Auth is used for upload authorization.
  Firestore stores only media URLs and metadata.
*/

const ENDPOINT = '/.netlify/functions/cloudinary-sign'

export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

const ALLOWED_TYPES = [
  ...IMAGE_TYPES,
  'image/gif',
  'application/pdf',
  'application/json',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
]

const UPLOAD_TIMEOUT = 120000

let lastStatus = null

export const getMediaStatus = () => lastStatus

/** Resize + compress an image file -> Blob */
export function compressImage(file, max = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          max / Math.max(img.width, img.height)
        )

        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * scale))
        c.height = Math.max(1, Math.round(img.height * scale))

        c.getContext('2d').drawImage(
          img,
          0,
          0,
          c.width,
          c.height
        )

        const keepPng =
          file.type === 'image/png' &&
          file.size < 700 * 1024

        const type = keepPng ? 'image/png' : 'image/jpeg'

        c.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error('Could not compress the image.')),
          type,
          quality
        )
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This image could not be read.'))
    }

    img.src = url
  })
}

/** Get a signed Cloudinary upload authorization */
async function getUploadSignature({
  kind,
  folder,
  name,
  contentType,
}) {
  if (!isFirebaseConfigured || !auth?.currentUser) {
    throw new Error('Please sign in before uploading.')
  }

  const token = await auth.currentUser.getIdToken()

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      kind,
      folder,
      name,
      contentType,
    }),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      result.error || `Upload authorization failed (${response.status}).`
    )
  }

  if (
    !result.cloudName ||
    !result.apiKey ||
    !result.signature ||
    !result.timestamp ||
    !result.publicId
  ) {
    throw new Error('Invalid Cloudinary upload signature.')
  }

  return result
}

/** Upload an image, PDF, JSON or video directly to Cloudinary */
export async function uploadBlob(
  blob,
  {
    kind = 'media',
    folder = 'uploads',
    name = 'file',
  } = {}
) {
  if (!blob || !blob.size) {
    throw new Error('Please select a valid file.')
  }

  if (!ALLOWED_TYPES.includes(blob.type)) {
    throw new Error('This file type is not supported.')
  }

  const signed = await getUploadSignature({
    kind,
    folder,
    name,
    contentType: blob.type,
  })

  const formData = new FormData()

  formData.append('file', blob, name)
  formData.append('api_key', signed.apiKey)
  formData.append('timestamp', String(signed.timestamp))
  formData.append('signature', signed.signature)
  formData.append('folder', signed.folder)
  formData.append('public_id', signed.publicId)

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    UPLOAD_TIMEOUT
  )

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }
    )

    const result = await response.json().catch(() => ({}))

    if (!response.ok || !result.secure_url) {
      throw new Error(
        result.error?.message || 'Cloudinary upload failed.'
      )
    }

    const uploaded = {
      url: result.secure_url,
      storage: 'cloudinary',
      publicId: result.public_id,
      resourceType: result.resource_type,
      format: result.format,
      size: result.bytes,
    }

    lastStatus = {
      ok: true,
      provider: 'cloudinary',
    }

    return uploaded
  } catch (error) {
    lastStatus = {
      ok: false,
      reason: error.message,
    }

    if (error.name === 'AbortError') {
      throw new Error('Upload timed out. Please try again.')
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Compress + upload an image. Returns URL string. */
export async function uploadImageFile(
  file,
  {
    folder = 'uploads',
    kind = 'media',
    max = 1400,
    quality = 0.82,
    maxSizeMB = 8,
  } = {}
) {
  if (!file) return null

  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error('Only JPG, PNG or WEBP images are allowed.')
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(
      `Image must be ${maxSizeMB} MB or smaller.`
    )
  }

  const blob = await compressImage(file, max, quality)

  const uploaded = await uploadBlob(blob, {
    kind,
    folder,
    name: file.name,
  })

  return uploaded.url
}


/** Delete a Cloudinary media asset through the authenticated Netlify function. */
export async function deleteCloudinaryAsset(publicId, resourceType = 'raw') {
  if (!publicId) return { ok: true, skipped: true }
  if (!isFirebaseConfigured || !auth?.currentUser) {
    throw new Error('Please sign in before deleting media.')
  }

  const token = await auth.currentUser.getIdToken()
  const response = await fetch('/.netlify/functions/cloudinary-delete', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ publicId, resourceType }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Could not delete Cloudinary media.')
  }
  return result
}

/** Check Cloudinary configuration for Settings page */
export async function checkMediaStorage() {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        reachable: false,
        configured: false,
      }
    }

    const result = await response.json()

    return {
      reachable: true,
      configured: !!result.configured,
      provider: result.provider || 'cloudinary',
    }
  } catch {
    return {
      reachable: false,
      configured: false,
    }
  }
}
