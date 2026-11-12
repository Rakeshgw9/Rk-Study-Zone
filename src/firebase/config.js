
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/*
  DEMO / LOCAL mode:
  - Firebase keys are missing
  - VITE_USE_LOCAL_DATA=true
  - URL contains ?demo=1

  Use ?demo=0 to switch back to Firebase mode.
*/
function demoForced() {
  try {
    const queryString =
      window.location.search ||
      window.location.hash.split('?')[1] ||
      ''

    const params = new URLSearchParams(queryString)

    if (params.get('demo') === '1') {
      localStorage.setItem('rk_force_demo', '1')
    }

    if (params.get('demo') === '0') {
      localStorage.removeItem('rk_force_demo')
    }

    return localStorage.getItem('rk_force_demo') === '1'
  } catch {
    return false
  }
}

const hasKeys = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
)

export const isFirebaseConfigured =
  hasKeys &&
  import.meta.env.VITE_USE_LOCAL_DATA !== 'true' &&
  !demoForced()

export const firebaseProjectId = firebaseConfig.projectId || ''

// Firebase App
export const app = isFirebaseConfigured
  ? initializeApp(firebaseConfig)
  : null

// Firebase Authentication
export const auth = app
  ? getAuth(app)
  : null

// Firebase Firestore Database
export const db = app
  ? getFirestore(app)
  : null

// Firebase Storage is no longer used.
// All media uploads are handled through Cloudinary.
export const storage = null
