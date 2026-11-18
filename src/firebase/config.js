import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/*
  DEMO / LOCAL mode (data in browser localStorage) is used when:
   - Firebase keys are missing in .env.local, or
   - VITE_USE_LOCAL_DATA=true, or
   - the URL contains ?demo=1   (open ?demo=0 to switch back)
*/
function demoForced() {
  try {
    const q = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '')
    if (q.get('demo') === '1') localStorage.setItem('rk_force_demo', '1')
    if (q.get('demo') === '0') localStorage.removeItem('rk_force_demo')
    return localStorage.getItem('rk_force_demo') === '1'
  } catch { return false }
}

const hasKeys = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
export const isFirebaseConfigured = hasKeys && import.meta.env.VITE_USE_LOCAL_DATA !== 'true' && !demoForced()
export const firebaseProjectId = firebaseConfig.projectId || ''

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
// Firebase Storage is OFF by default (it needs a paid plan). Media goes to GitHub — see services/mediaService.js.
// Set VITE_USE_FIREBASE_STORAGE=true only if you really want Firebase Storage objects.
export const storage = app && firebaseConfig.storageBucket && import.meta.env.VITE_USE_FIREBASE_STORAGE === 'true' ? getStorage(app) : null
