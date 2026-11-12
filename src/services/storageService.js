import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { isFirebaseConfigured, storage } from '../firebase/config'
import { resizeImage } from '../lib/id'

/** Uploads an image to Firebase Storage when configured, with seamless fallback
 * to local compressed data URLs in demo or unconfigured mode. */
export async function uploadImage(file, path = 'uploads', { max = 1200, quality = 0.82 } = {}) {
  if (!file) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPG, PNG or WEBP images are allowed.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5 MB or smaller.')
  }

  if (isFirebaseConfigured && storage) {
    try {
      const ext = (file.name || 'image.jpg').split('.').pop() || 'jpg'
      const cleanPath = path.replace(/^\/+|\/+$/g, '')
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const fileRef = ref(storage, `${cleanPath}/${fileName}`)
      await uploadBytes(fileRef, file, { contentType: file.type })
      return await getDownloadURL(fileRef)
    } catch (e) {
      console.warn('Firebase Storage upload failed, falling back to local image data:', e)
    }
  }

  return resizeImage(file, Math.min(max, 1200), quality)
}

/** Uploads a user profile photo specifically to their users/{uid}/ directory */
export async function uploadProfilePhoto(uid, file) {
  if (!file) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPG, PNG or WEBP images are allowed.')
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Profile photo must be 2 MB or smaller.')
  }

  if (isFirebaseConfigured && storage) {
    try {
      const ext = (file.name || 'avatar.jpg').split('.').pop() || 'jpg'
      const fileRef = ref(storage, `users/${uid}/profile_${Date.now()}.${ext}`)
      await uploadBytes(fileRef, file, { contentType: file.type })
      return await getDownloadURL(fileRef)
    } catch (e) {
      console.warn('Firebase Storage profile upload failed, falling back to compressed local data:', e)
    }
  }

  return resizeImage(file, 300, 0.85)
}
