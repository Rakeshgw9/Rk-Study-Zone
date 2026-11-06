import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../firebase/config'

/*
  Roles
   superAdmin / admin → full CMS, sees every portal, manages users
   teacher            → CMS for own portals
   student            → learner (My Courses / lesson pages)
  New sign-ups choose student or teacher. Super Admin is set manually in Firestore.
*/
export const isAdminRole = (r) => r === 'admin' || r === 'superAdmin'
export const isStaffRole = (r) => isAdminRole(r) || r === 'teacher'
export const roleLabel = (r) => (isAdminRole(r) ? 'Super Admin' : r === 'teacher' ? 'Teacher' : 'Student')

const DEMO_USERS = 'rk_demo_users'
const DEMO_SESSION = 'rk_demo_session'
const demoListeners = new Set()
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const emitDemo = () => { const u = read(DEMO_SESSION, null); demoListeners.forEach((cb) => cb(u)) }
const fail = (code) => { const e = new Error(code); e.code = code; throw e }

export async function login(email, password) {
  if (!isFirebaseConfigured) {
    const u = read(DEMO_USERS, []).find((x) => x.email === email.toLowerCase())
    if (!u) fail('auth/user-not-found')
    if (u.password !== password) fail('auth/wrong-password')
    const { password: _p, ...profile } = u
    write(DEMO_SESSION, profile); emitDemo(); return profile
  }
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function register({ name, email, password, accountType = 'student' }) {
  const role = accountType === 'teacher' ? 'teacher' : 'student'
  if (!isFirebaseConfigured) {
    const users = read(DEMO_USERS, [])
    if (users.some((x) => x.email === email.toLowerCase())) fail('auth/email-already-in-use')
    // demo: first account becomes Super Admin so the CMS can be tried immediately
    const profile = { uid: 'demo_' + Date.now(), name, email: email.toLowerCase(), role: users.length === 0 ? 'superAdmin' : role }
    write(DEMO_USERS, [...users, { ...profile, password }])
    write(DEMO_SESSION, profile); emitDemo(); return profile
  }
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })
  try {
    await setDoc(doc(db, 'users', cred.user.uid), { uid: cred.user.uid, name, email: email.toLowerCase(), role, createdAt: serverTimestamp() })
  } catch (e) { console.warn('Could not create user profile (check Firestore rules):', e) }
  await reloadProfile()
  return cred.user
}

export async function resetPassword(email) {
  if (!isFirebaseConfigured) return true
  await sendPasswordResetEmail(auth, email)
  return true
}

export async function logout() {
  if (!isFirebaseConfigured) { localStorage.removeItem(DEMO_SESSION); emitDemo(); return }
  await signOut(auth)
}

export function watchAuth(callback) {
  if (!isFirebaseConfigured) {
    demoListeners.add(callback); callback(read(DEMO_SESSION, null))
    return () => demoListeners.delete(callback)
  }
  fbListeners.add(callback)
  const off = onAuthStateChanged(auth, async (user) => { callback(user ? await loadProfile(user) : null) })
  return () => { fbListeners.delete(callback); off() }
}

const fbListeners = new Set()
async function loadProfile(user) {
  let profile = { uid: user.uid, name: user.displayName || user.email.split('@')[0], email: user.email, role: 'student' }
  try {
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (snap.exists()) profile = { ...profile, ...snap.data() }
  } catch (e) { console.warn('Profile load failed', e) }
  return profile
}
/** Re-read the signed-in user's profile (e.g. right after registration) */
export async function reloadProfile() {
  if (!isFirebaseConfigured || !auth.currentUser) return
  const p = await loadProfile(auth.currentUser)
  fbListeners.forEach((cb) => cb(p))
}

/** Demo-only helpers for Settings → Users */
export const demoListUsers = () => read(DEMO_USERS, []).map(({ password: _p, ...u }) => u)
export function demoSetRole(uid, role) {
  write(DEMO_USERS, read(DEMO_USERS, []).map((u) => (u.uid === uid ? { ...u, role } : u)))
  const s = read(DEMO_SESSION, null); if (s?.uid === uid) { write(DEMO_SESSION, { ...s, role }); emitDemo() }
}

export function authErrorMessage(err) {
  const map = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-login-credentials': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'This email is already registered. Please sign in.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/operation-not-allowed': 'Email/Password sign-in is not enabled in Firebase Authentication.',
  }
  return map[err?.code] || err?.message || 'Something went wrong.'
}
