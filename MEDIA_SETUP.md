# Media uploads without Firebase Storage (GitHub)

Every image / PDF / JSON file you upload (profile photo, portal cover, lesson images, sliders, heading backgrounds,
syllabus files …) is now saved in a **GitHub repository**. The browser never sees your GitHub token: it sends the file to a
small Netlify Function (`netlify/functions/upload-media.mjs`) which checks the signed-in Firebase user and commits the file.
The saved link looks like `https://cdn.jsdelivr.net/gh/<you>/<repo>@main/media/...`.

> If you skip this setup the app still works: images are compressed and stored inline (inside Firestore). That is fine for a few
> small pictures, but GitHub storage is the right choice for real use (Firestore documents are limited to 1 MB).

## One-time setup (10 minutes)

1. **Create the media repository** on GitHub, e.g. `rk-study-zone-media`.
   * Visibility: **Public** (so students can see the images).
   * Tick **“Add a README file”** — the repo needs a `main` branch.
   * Use a *separate* repo from the website so uploads do not trigger a new Netlify build each time.
2. **Create a token**: GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → Generate.
   * Repository access: *Only select repositories* → your media repo.
   * Permissions → Repository permissions → **Contents: Read and write**.
   * Copy the token (starts with `github_pat_…`).
3. **Netlify** → your site → *Site configuration → Environment variables* → add:

   | Name | Value |
   |------|-------|
   | `GITHUB_TOKEN` | the token from step 2 |
   | `GITHUB_REPO` | `your-github-name/rk-study-zone-media` |
   | `GITHUB_BRANCH` | *(optional)* `main` |
   | `MEDIA_DIR` | *(optional)* folder inside the repo, default `media` |
   | `MEDIA_CDN` | *(optional)* `jsdelivr` (default) or `raw` |

   The `VITE_FIREBASE_*` variables you already have on Netlify are reused to verify the user — nothing else to add.
4. **Push this project to GitHub** (it contains `netlify.toml` + the function) and let Netlify redeploy.
5. Open **Settings → Media Storage → Check**. It must show **GitHub (live)**. Then upload a profile photo to test.

## Good to know
* Who may upload: any signed-in user can upload their own profile photo; only **teachers and admins** can upload lesson media.
* Max size per file: 4.5 MB (images are shrunk in the browser first). Syllabus PDFs up to 4 MB go to GitHub; bigger ones (up to 5 MB) fall back to Firestore.
* Deleting a block / portal does not delete the file in GitHub (you can clean the repo any time).
* Local development: plain `npm run dev` has no Netlify function, so uploads are stored inline. To test GitHub uploads locally run `npx netlify dev`.
* Firebase Storage is **not used any more**. (Set `VITE_USE_FIREBASE_STORAGE=true` only if you ever upgrade to a paid plan and want it back.)
