import { collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { demoListUsers, demoSetRole } from './authService'

export async function listUsers() {
  if (!isFirebaseConfigured) return demoListUsers()
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}
export async function setUserRole(uid, role) {
  if (!isFirebaseConfigured) return demoSetRole(uid, role)
  await updateDoc(doc(db, 'users', uid), { role })
}
