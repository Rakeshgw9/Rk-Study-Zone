import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../firebase/config'
import { uploadProfilePhoto } from './storageService'

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
const fbListeners = new Set()

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

export async function loginWithGoogle(accountType = 'student') {
  const role = accountType === 'teacher' ? 'teacher' : 'student'
  if (!isFirebaseConfigured) {
    const users = read(DEMO_USERS, [])
    const existing = users.find((x) => x.email === 'google.user@rkstudyzone.com')
    if (existing) {
      const { password: _p, ...profile } = existing
      write(DEMO_SESSION, profile)
      emitDemo()
      return profile
    }
    const profile = {
      uid: 'demo_google_' + Date.now(),
      name: 'Google Student',
      email: 'google.user@rkstudyzone.com',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=RKStudyZone',
      role: users.length === 0 ? 'superAdmin' : role,
      createdAt: Date.now(),
    }
    write(DEMO_USERS, [...users, profile])
    write(DEMO_SESSION, profile)
    emitDemo()
    return profile
  }

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const cred = await signInWithPopup(auth, provider)
  const user = cred.user

  try {
    const userRef = doc(db, 'users', user.uid)
    const snap = await getDoc(userRef)
    if (!snap.exists()) {
      // First time Google sign in: create profile with chosen role
      const profile = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: (user.email || '').toLowerCase(),
        photoURL: user.photoURL || '',
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(userRef, profile)
    } else {
      // Existing account: sync photo and name from Google if missing
      const data = snap.data()
      const patch = {}
      if (!data.photoURL && user.photoURL) patch.photoURL = user.photoURL
      if (!data.name && user.displayName) patch.name = user.displayName
      if (Object.keys(patch).length > 0) {
        await updateDoc(userRef, { ...patch, updatedAt: serverTimestamp() })
      }
    }
  } catch (e) {
    console.warn('Could not sync Google user profile with Firestore:', e)
  }

  await reloadProfile()
  return user
}

export async function register({ name, email, password, accountType = 'student', photoFile = null }) {
  const role = accountType === 'teacher' ? 'teacher' : 'student'
  if (!isFirebaseConfigured) {
    const users = read(DEMO_USERS, [])
    if (users.some((x) => x.email === email.toLowerCase())) fail('auth/email-already-in-use')
    let photoURL = ''
    if (photoFile) {
      photoURL = await uploadProfilePhoto('demo_' + Date.now(), photoFile)
    }
    const profile = {
      uid: 'demo_' + Date.now(),
      name,
      email: email.toLowerCase(),
      photoURL,
      role: users.length === 0 ? 'superAdmin' : role,
      createdAt: Date.now(),
    }
    write(DEMO_USERS, [...users, { ...profile, password }])
    write(DEMO_SESSION, profile)
    emitDemo()
    return profile
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password)
  let photoURL = ''
  if (photoFile) {
    try {
      photoURL = await uploadProfilePhoto(cred.user.uid, photoFile)
    } catch (e) {
      console.warn('Profile photo upload during registration failed:', e)
    }
  }

  await updateProfile(cred.user, {
    displayName: name,
    photoURL: photoURL || undefined,
  })

  try {
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name,
      email: email.toLowerCase(),
      photoURL: photoURL || '',
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.warn('Could not create user profile in Firestore (check rules):', e)
  }

  await reloadProfile()
  return cred.user
}

export async function updateUserProfile({ name, photoURL, photoFile }) {
  let finalPhoto = photoURL
  if (!isFirebaseConfigured) {
    const session = read(DEMO_SESSION, null)
    if (!session) return null
    if (photoFile) {
      finalPhoto = await uploadProfilePhoto(session.uid, photoFile)
    }
    const updated = {
      ...session,
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(finalPhoto !== undefined ? { photoURL: finalPhoto } : {}),
    }
    write(DEMO_SESSION, updated)
    const users = read(DEMO_USERS, []).map((u) => (u.uid === session.uid ? { ...u, ...updated } : u))
    write(DEMO_USERS, users)
    emitDemo()
    return updated
  }

  const currentUser = auth?.currentUser
  if (!currentUser) return null

  if (photoFile) {
    try {
      finalPhoto = await uploadProfilePhoto(currentUser.uid, photoFile)
    } catch (e) {
      console.warn('Profile photo upload failed:', e)
    }
  }

  const authPatch = {}
  if (name !== undefined) authPatch.displayName = name.trim()
  if (finalPhoto !== undefined) authPatch.photoURL = finalPhoto || ''
  await updateProfile(currentUser, authPatch)

  try {
    const fsPatch = { updatedAt: serverTimestamp() }
    if (name !== undefined) fsPatch.name = name.trim()
    if (finalPhoto !== undefined) fsPatch.photoURL = finalPhoto || ''
    await setDoc(doc(db, 'users', currentUser.uid), fsPatch, { merge: true })
  } catch (e) {
    console.warn('Could not update profile in Firestore:', e)
  }

  await reloadProfile()
  return await loadProfile(currentUser)
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
    demoListeners.add(callback)
    callback(read(DEMO_SESSION, null))
    return () => demoListeners.delete(callback)
  }
  fbListeners.add(callback)
  const off = onAuthStateChanged(auth, async (user) => {
    callback(user ? await loadProfile(user) : null)
  })
  return () => {
    fbListeners.delete(callback)
    off()
  }
}

async function loadProfile(user) {
  let profile = {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    email: user.email,
    photoURL: user.photoURL || '',
    role: 'student',
  }
  try {
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (snap.exists()) {
      profile = { ...profile, ...snap.data() }
    }
  } catch (e) {
    console.warn('Profile load failed', e)
  }
  return profile
}

/** Re-read the signed-in user's profile and notify listeners */
export async function reloadProfile() {
  if (!isFirebaseConfigured) {
    emitDemo()
    return
  }
  if (!auth.currentUser) return
  const p = await loadProfile(auth.currentUser)
  fbListeners.forEach((cb) => cb(p))
}

/** Demo-only helpers for Settings → Users */
export const demoListUsers = () => read(DEMO_USERS, []).map(({ password: _p, ...u }) => u)
export function demoSetRole(uid, role) {
  write(DEMO_USERS, read(DEMO_USERS, []).map((u) => (u.uid === uid ? { ...u, role } : u)))
  const s = read(DEMO_SESSION, null)
  if (s?.uid === uid) {
    write(DEMO_SESSION, { ...s, role })
    emitDemo()
  }
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
    'auth/operation-not-allowed': 'Sign-in method is not enabled in Firebase Authentication.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before finishing.',
    'auth/cancelled-popup-request': 'Popup was cancelled. Please try again.',
  }
  return map[err?.code] || err?.message || 'Something went wrong.'
}
