import { IMAGE_TYPES, uploadBlob, uploadImageFile } from './mediaService'

/*
  Image upload helpers used everywhere in the app (builder, portals, profile …).
  Files are stored in GitHub (via the Netlify upload function) — Firebase Storage is NOT used any more,
  because it needs a paid plan. The function names are unchanged so every caller keeps working.
*/

/** Uploads an image and returns its URL. `path` is the logical folder (e.g. 'html-block'). */
export async function uploadImage(file, path = 'uploads', { max = 1200, quality = 0.82 } = {}) {
  if (!file) return null
  return uploadImageFile(file, { folder: path, max, quality })
}

/** Uploads a user's profile photo (square-ish, small). */
export async function uploadProfilePhoto(uid, file) {
  if (!file) return null
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Only JPG, PNG or WEBP images are allowed.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile photo must be 5 MB or smaller.')
  return uploadImageFile(file, { kind: 'profile', folder: `users/${uid}`, max: 360, quality: 0.86, maxSizeMB: 5 })
}

/** Uploads a PDF / JSON / image file (e.g. a syllabus). Returns { url, storage } — storage is 'github' or 'inline'. */
export async function uploadDocument(file, folder = 'syllabus') {
  return uploadBlob(file, { kind: 'media', folder, name: file.name, allowInline: true })
}
