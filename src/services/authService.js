
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

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

import { auth, db, isFirebaseConfigured } from '../firebase/config'
import { uploadProfilePhoto } from './storageService'

/*
 Roles
 superAdmin / admin → full CMS, sees every portal, manages users
 teacher             → CMS for own portals
 student             → learner (My Courses / lesson pages)
 New sign-ups choose student or teacher. Super Admin is set manually in Firestore.
*/

export const isAdminRole = (r) => r === 'admin' || r === 'superAdmin'
export const isStaffRole = (r) => isAdminRole(r) || r === 'teacher'

export const roleLabel = (r) =>
  isAdminRole(r) ? 'Super Admin' : r === 'teacher' ? 'Teacher' : 'Student'

/** Extra profile fields stored in users/{uid} */
export const PROFILE_FIELDS = [
  'phone',
  'altEmail',
  'address',
  'city',
  'state',
  'pincode',
  'institution',
  'bio',
]

const FIELD_MAX = {
  phone: 20,
  altEmail: 120,
  address: 240,
  city: 60,
  state: 60,
  pincode: 12,
  institution: 120,
  bio: 400,
}

export function cleanDetails(details = {}) {
  const out = {}

  PROFILE_FIELDS.forEach((k) => {
    if (details[k] !== undefined) {
      out[k] = String(details[k] ?? '')
        .trim()
        .slice(0, FIELD_MAX[k])
    }
  })

  return out
}

/**
 * Firebase Auth accepts only valid HTTP/HTTPS photo URLs.
 * Cloudinary URLs are supported.
 */
const authPhoto = (u) =>
  typeof u === 'string' &&
  /^https?:\/\//i.test(u) &&
  u.length < 1800
    ? u
    : null

const DEMO_USERS = 'rk_demo_users'
const DEMO_SESSION = 'rk_demo_session'

const demoListeners = new Set()
const fbListeners = new Set()

const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d
  } catch {
    return d
  }
}

const write = (k, v) =>
  localStorage.setItem(k, JSON.stringify(v))

const emitDemo = () => {
  const u = read(DEMO_SESSION, null)
  demoListeners.forEach((cb) => cb(u))
}

const fail = (code) => {
  const e = new Error(code)
  e.code = code
  throw e
}

/* ---------------- LOGIN ---------------- */

export async function login(email, password) {
  if (!isFirebaseConfigured) {
    const u = read(DEMO_USERS, []).find(
      (x) => x.email === email.toLowerCase()
    )

    if (!u) fail('auth/user-not-found')
    if (u.password !== password) fail('auth/wrong-password')

    const { password: _p, ...profile } = u

    write(DEMO_SESSION, profile)
    emitDemo()

    return profile
  }

  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

/* ---------------- GOOGLE LOGIN ---------------- */

export async function loginWithGoogle(accountType = 'student') {
  const role = accountType === 'teacher' ? 'teacher' : 'student'

  if (!isFirebaseConfigured) {
    const users = read(DEMO_USERS, [])

    const existing = users.find(
      (x) => x.email === 'google.user@rkstudyzone.com'
    )

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
      photoURL:
        'https://api.dicebear.com/7.x/bottts/svg?seed=RKStudyZone',
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
      const data = snap.data()
      const patch = {}

      if (!data.photoURL && user.photoURL) {
        patch.photoURL = user.photoURL
      }

      if (!data.name && user.displayName) {
        patch.name = user.displayName
      }

      if (Object.keys(patch).length > 0) {
        await updateDoc(userRef, {
          ...patch,
          updatedAt: serverTimestamp(),
        })
      }
    }
  } catch (e) {
    console.warn(
      'Could not sync Google user profile with Firestore:',
      e
    )
  }

  await reloadProfile()
  return user
}

/* ---------------- REGISTER ---------------- */

export async function register({
  name,
  email,
  password,
  accountType = 'student',
  photoFile = null,
}) {
  const role = accountType === 'teacher' ? 'teacher' : 'student'

  if (!isFirebaseConfigured) {
    const users = read(DEMO_USERS, [])

    if (users.some((x) => x.email === email.toLowerCase())) {
      fail('auth/email-already-in-use')
    }

    const uid = 'demo_' + Date.now()
    let photoURL = ''

    if (photoFile) {
      photoURL = await uploadProfilePhoto(uid, photoFile)
    }

    const profile = {
      uid,
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

  const cred = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  )

  let photoURL = ''

  if (photoFile) {
    try {
      photoURL = await uploadProfilePhoto(cred.user.uid, photoFile)
    } catch (e) {
      console.warn(
        'Profile photo upload during registration failed:',
        e
      )
    }
  }

  try {
    await updateProfile(cred.user, {
      displayName: name,
      photoURL: authPhoto(photoURL) || undefined,
    })
  } catch (e) {
    console.warn('Could not update the Auth profile:', e)
  }

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
    console.warn(
      'Could not create user profile in Firestore (check rules):',
      e
    )
  }

  await reloadProfile()
  return cred.user
}

/* ---------------- UPDATE PROFILE ---------------- */

export async function updateUserProfile({
  name,
  photoURL,
  photoFile,
  details,
}) {
  let finalPhoto = photoURL
  const extra = details ? cleanDetails(details) : {}

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
      ...extra,
    }

    write(DEMO_SESSION, updated)

    const users = read(DEMO_USERS, []).map((u) =>
      u.uid === session.uid ? { ...u, ...updated } : u
    )

    write(DEMO_USERS, users)
    emitDemo()

    return updated
  }

  const currentUser = auth?.currentUser

  if (!currentUser) return null

  // Upload photo to Cloudinary before updating the profile.
  // A failed upload must be reported.
  if (photoFile) {
    finalPhoto = await uploadProfilePhoto(currentUser.uid, photoFile)
  }

  const authPatch = {}

  if (name !== undefined) {
    authPatch.displayName = name.trim()
  }

  if (finalPhoto !== undefined) {
    authPatch.photoURL = authPhoto(finalPhoto) || ''
  }

  if (Object.keys(authPatch).length) {
    try {
      await updateProfile(currentUser, authPatch)
    } catch (e) {
      console.warn(
        'Auth profile not updated (Firestore copy is used):',
        e
      )
    }
  }

  const fsPatch = {
    updatedAt: serverTimestamp(),
    ...extra,
  }

  if (name !== undefined) {
    fsPatch.name = name.trim()
  }

  if (finalPhoto !== undefined) {
    fsPatch.photoURL = finalPhoto || ''
  }

  try {
    await setDoc(
      doc(db, 'users', currentUser.uid),
      fsPatch,
      { merge: true }
    )
  } catch (e) {
    console.error('Could not update profile in Firestore:', e)

    throw new Error(
      'Could not save your profile. Please check your connection and try again.'
    )
  }

  await reloadProfile()

  return await loadProfile(currentUser)
}

/* ---------------- RESET PASSWORD ---------------- */

export async function resetPassword(email) {
  if (!isFirebaseConfigured) return true

  await sendPasswordResetEmail(auth, email)
  return true
}

/* ---------------- LOGOUT ---------------- */

export async function logout() {
  if (!isFirebaseConfigured) {
    localStorage.removeItem(DEMO_SESSION)
    emitDemo()
    return
  }

  await signOut(auth)
}

/* ---------------- WATCH AUTH ---------------- */

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

/* ---------------- LOAD PROFILE ---------------- */

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

/* ---------------- RELOAD PROFILE ---------------- */

export async function reloadProfile() {
  if (!isFirebaseConfigured) {
    emitDemo()
    return
  }

  if (!auth.currentUser) return

  const p = await loadProfile(auth.currentUser)

  fbListeners.forEach((cb) => cb(p))
}

/* ---------------- DEMO USERS HELPERS ---------------- */

export const demoListUsers = () =>
  read(DEMO_USERS, []).map(({ password: _p, ...u }) => u)

export function demoSetRole(uid, role) {
  write(
    DEMO_USERS,
    read(DEMO_USERS, []).map((u) =>
      u.uid === uid ? { ...u, role } : u
    )
  )

  const s = read(DEMO_SESSION, null)

  if (s?.uid === uid) {
    write(DEMO_SESSION, { ...s, role })
    emitDemo()
  }
}

/* ---------------- AUTH ERROR MESSAGE ---------------- */

export function authErrorMessage(err) {
  const map = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-login-credentials': 'Email or password is incorrect.',
    'auth/email-already-in-use':
      'This email is already registered. Please sign in.',
    'auth/weak-password':
      'Password should be at least 6 characters.',
    'auth/too-many-requests':
      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed':
      'Network error. Check your internet connection.',
    'auth/operation-not-allowed':
      'Sign-in method is not enabled in Firebase Authentication.',
    'auth/popup-closed-by-user':
      'Sign-in popup was closed before finishing.',
    'auth/cancelled-popup-request':
      'Popup was cancelled. Please try again.',
  }

  return map[err?.code] || err?.message || 'Something went wrong.'
}
