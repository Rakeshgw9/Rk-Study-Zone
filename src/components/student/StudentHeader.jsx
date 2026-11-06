import { useEffect, useRef, useState } from 'react'
import { LuBell, LuBookmark, LuBookOpen, LuChartColumn, LuChevronDown, LuClipboardList, LuHouse, LuLayoutDashboard, LuLogOut, LuMoon, LuSearch, LuSun, LuTarget, LuUser } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { isStaffRole, logout, roleLabel } from '../../services/authService'

export const STUDENT_NAV = [
  { key: 'home', label: 'Home', icon: LuHouse },
  { key: 'courses', label: 'My Courses', icon: LuBookOpen },
  { key: 'practice', label: 'Practice', icon: LuTarget },
  { key: 'mock', label: 'Mock Test', icon: LuClipboardList },
  { key: 'progress', label: 'Progress', icon: LuChartColumn },
  { key: 'bookmarks', label: 'Bookmarks', icon: LuBookmark },
]

export default function StudentHeader({ title = 'RK Study Zone', subtitle = 'Learn · Practice · Achieve', logo, active, onNav, search, onSearch, user }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <>
      <header className="st-header">
        <button className="st-brand" onClick={() => onNav('home')}>
          {logo ? <img src={logo} alt="" className="st-brand-img" /> : <img src="./logo.png" alt="" className="st-brand-img" />}
          <span className="min-w-0"><b>{title}</b><small>{subtitle}</small></span>
        </button>
        <nav className="st-nav d-none d-xl-flex" aria-label="Student navigation">
          {STUDENT_NAV.map(({ key, label, icon: I }) => <button key={key} className={active === key ? 'on' : ''} onClick={() => onNav(key)}><I /> {label}</button>)}
        </nav>
        <div className="d-flex align-items-center gap-2 ms-auto">
          {onSearch && <div className="st-search d-none d-md-flex"><LuSearch /><input placeholder="Search chapters…" value={search} onChange={(e) => onSearch(e.target.value)} aria-label="Search chapters" /></div>}
          <button className="icon-btn" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <LuMoon /> : <LuSun />}</button>
          <button className="icon-btn position-relative d-none d-sm-inline-flex" aria-label="Notifications"><LuBell /><span className="bell-dot" /></button>
          <div className="position-relative" ref={ref}>
            <button className="user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <span className="avatar"><LuUser /></span>
              <span className="d-none d-lg-inline user-name">{user?.name || 'Student'}</span>
              <LuChevronDown className="d-none d-lg-inline" />
            </button>
            {open && (
              <div className="user-menu">
                <div className="user-menu-head"><strong>{user?.name}</strong><small>{user?.email}</small><span className="role-pill">{roleLabel(user?.role)}</span></div>
                <button onClick={() => navigate('/learn')}><LuBookOpen /> My Courses</button>
                {isStaffRole(user?.role) && <button onClick={() => navigate('/admin/portals')}><LuLayoutDashboard /> Teacher CMS</button>}
                <button className="text-danger-soft" onClick={async () => { await logout(); navigate('/') }}><LuLogOut /> Log Out</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="st-bottom d-xl-none" aria-label="Student navigation">
        {STUDENT_NAV.filter((n) => n.key !== 'home').map(({ key, label, icon: I }) => <button key={key} className={active === key ? 'on' : ''} onClick={() => onNav(key)}><I /><span>{label.replace('My ', '')}</span></button>)}
      </nav>
    </>
  )
}
