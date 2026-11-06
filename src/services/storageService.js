import { resizeImage } from '../lib/id'

/** Local-first image handling. Data URLs keep previews working in Vite/local mode;
 * the service boundary can be switched back to Firebase Storage during deployment. */
export async function uploadImage(file, _path, { max = 1200, quality = 0.82 } = {}) {
  if (!file) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Only JPG, PNG or WEBP images are allowed.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.')
  return resizeImage(file, Math.min(max, 1200), quality)
}
