import { useEffect, useRef, useState } from 'react'
import { LuBell, LuChevronDown, LuLogOut, LuMenu, LuSearch, LuSettings, LuUser } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { isAdminRole, roleLabel as labelOf } from '../services/authService'
import { useTheme } from '../context/ThemeContext'
import { LuMoon, LuSun, LuBookOpen } from 'react-icons/lu'

export default function Topbar({ user, search, onSearch, onMenu, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const roleLabel = labelOf(user?.role)
  const displayName = isAdminRole(user?.role) ? 'Super Admin' : (user?.name || 'Teacher')
  const { theme, toggle } = useTheme()

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setMenuOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <header className="topbar">
      <div className="d-flex align-items-center gap-2 gap-md-3 topbar-left">
        <button className="icon-btn" onClick={onMenu} aria-label="Toggle menu"><LuMenu /></button>
        <Logo size="sm" />
      </div>

      <div className="topbar-search d-none d-md-flex">
        <LuSearch className="rk-input-icon" />
        <input
          className="rk-input"
          placeholder="Search portals..."
          value={search}
          onChange={(e) => { onSearch(e.target.value); navigate('/admin/portals') }}
          aria-label="Search portals"
        />
      </div>

      <div className="d-flex align-items-center gap-2 gap-md-3">
        <button className="icon-btn" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <LuMoon /> : <LuSun />}</button>
        <button className="icon-btn position-relative d-none d-sm-inline-flex" aria-label="Notifications">
          <LuBell /><span className="bell-dot" />
        </button>
        <div className="position-relative" ref={ref}>
          <button className="user-chip" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
            <span className="avatar">
              {user?.photoURL ? <img src={user.photoURL} alt={displayName} className="avatar-img" /> : <LuUser />}
            </span>
            <span className="d-none d-sm-inline user-name">{displayName}</span>
            <LuChevronDown className="d-none d-sm-inline" />
          </button>
          {menuOpen && (
            <div className="user-menu">
              <div className="user-menu-head">
                <strong>{user?.name || user?.email}</strong>
                <small>{user?.email}</small>
                <span className="role-pill">{roleLabel}</span>
              </div>
              <button onClick={() => { setMenuOpen(false); navigate('/learn') }}><LuBookOpen /> Student View</button>
              <button onClick={() => { setMenuOpen(false); navigate('/admin/settings') }}><LuSettings /> Settings</button>
              <button onClick={onLogout} className="text-danger-soft"><LuLogOut /> Log Out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
