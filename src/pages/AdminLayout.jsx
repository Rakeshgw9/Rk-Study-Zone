import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { useAuth } from '../context/AuthContext'
import { logout } from '../services/authService'
import { watchPortals } from '../services/portalService'
import { useToast } from '../components/Toast'
import { isStaffRole } from '../services/authService'
import { enrollmentStats } from '../services/studentService'

export default function AdminLayout() {
  const { user, loading } = useAuth()
  const [portals, setPortals] = useState([])
  const [portalsLoading, setPortalsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [enrollStats, setEnrollStats] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()

  useEffect(() => {
    if (!user) return
    setPortalsLoading(true)
    return watchPortals(user, (list) => { setPortals(list); setPortalsLoading(false) }, () => {
      setPortalsLoading(false)
      toast('Could not load portals. Check Firestore rules.', 'error')
    })
  }, [user, toast])

  useEffect(() => {
    if (!user || !isStaffRole(user.role)) return
    enrollmentStats(user).then(setEnrollStats).catch(() => {})
  }, [user, location.pathname])

  useEffect(() => setMobileOpen(false), [location.pathname])

  if (loading) return <div className="page-loader"><span className="spinner-border text-info" /></div>
  if (!user) return <Navigate to="/" replace />
  if (!isStaffRole(user.role)) return <Navigate to="/learn" replace />

  const toggleMenu = () => (window.innerWidth < 992 ? setMobileOpen((o) => !o) : setCollapsed((c) => !c))
  const handleLogout = async () => { await logout(); navigate('/') }

  return (
    <div className="admin-shell">
      <Topbar user={user} search={search} onSearch={setSearch} onMenu={toggleMenu} onLogout={handleLogout} />
      <div className="admin-body">
        <Sidebar open={mobileOpen} collapsed={collapsed} onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
        <main className={`admin-main ${collapsed ? 'wide' : ''}`}>
          <Outlet context={{ user, portals, portalsLoading, search, setSearch, enrollStats }} />
        </main>
      </div>
    </div>
  )
}
