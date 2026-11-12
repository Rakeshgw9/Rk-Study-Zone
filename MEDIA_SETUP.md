# RK Study Zone — Cloudinary media setup

All newly uploaded images, profile photos, PDFs, JSON files, videos and audio files are stored in Cloudinary. Firebase Authentication verifies the user; Firestore stores media URLs and metadata. Firebase Storage is not used.

## Netlify environment variables

Set these in Netlify → Site configuration → Environment variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`

Keep `CLOUDINARY_API_SECRET` server-side only. Never use a `VITE_` prefix for it and never commit it in `.env`.

The app uses these Netlify Functions:

- `/.netlify/functions/cloudinary-sign` — issues short-lived signed upload parameters.
- `/.netlify/functions/cloudinary-delete` — deletes an asset after Firebase authentication and role checks.

Only signed-in users can upload their own profile photo. Media uploads and deletes require a `teacher`, `admin`, or `superAdmin` role in `users/{uid}.role`.

## Local development

The signed functions run under Netlify Dev:

```bash
npx netlify dev
```

Plain `npm run dev` does not provide Netlify Functions, so Cloudinary upload checks will not succeed there.

## Notes

- Existing media URLs remain readable; this migration does not move or delete old GitHub-hosted files.
- Deleting a syllabus file with Cloudinary metadata (`publicId`, `resourceType`) also requests deletion of that Cloudinary asset.
- Existing GitHub URLs entered manually in the HTML block editor remain supported as external image URLs; they are not used as an upload backend.
