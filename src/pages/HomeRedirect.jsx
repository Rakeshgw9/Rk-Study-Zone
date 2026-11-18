import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isStaffRole } from '../services/authService'
import { auth, isFirebaseConfigured } from '../firebase/config'

/** After sign-in: staff → CMS, students → My Courses */
export default function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading || (!user && isFirebaseConfigured && auth?.currentUser)) return <div className="page-loader"><span className="spinner-border text-info" /></div>
  if (!user) return <Navigate to="/" replace />
  return <Navigate to={isStaffRole(user.role) ? '/admin/portals' : '/learn'} replace />
}
