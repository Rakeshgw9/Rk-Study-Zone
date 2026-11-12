
import {
  IMAGE_TYPES,
  uploadBlob,
  uploadImageFile,
} from './mediaService'

/*
  RK Study Zone Media Service

  Images       -> Cloudinary
  Profile Photo -> Cloudinary
  PDF / JSON   -> Cloudinary
  Videos       -> Cloudinary

  Firebase Storage is not required.
*/

/** Upload an image and return its Cloudinary URL. */
export async function uploadImage(
  file,
  path = 'uploads',
  { max = 1200, quality = 0.82 } = {}
) {
  if (!file) return null

  return uploadImageFile(file, {
    folder: path,
    kind: 'media',
    max,
    quality,
  })
}

/** Upload a user's profile photo. */
export async function uploadProfilePhoto(uid, file) {
  if (!file) return null

  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      'Only JPG, PNG or WEBP images are allowed.'
    )
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      'Profile photo must be 5 MB or smaller.'
    )
  }

  return uploadImageFile(file, {
    kind: 'profile',
    folder: `users/${uid}`,
    max: 360,
    quality: 0.86,
    maxSizeMB: 5,
  })
}

/** Upload a PDF, JSON or other supported document.
 * Returns Cloudinary metadata including URL and publicId.
 */
export async function uploadDocument(
  file,
  folder = 'syllabus'
) {
  if (!file) return null

  return uploadBlob(file, {
    kind: 'media',
    folder,
    name: file.name,
  })
}
