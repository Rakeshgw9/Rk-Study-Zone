import { useEffect, useRef, useState } from 'react'
import { LuBell, LuBookmark, LuBookOpen, LuChartColumn, LuChevronDown, LuClipboardList, LuEllipsisVertical, LuHouse, LuLayoutDashboard, LuLogOut, LuMoon, LuNotebookPen, LuSearch, LuSun, LuTarget, LuUser } from 'react-icons/lu'
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
  const [moreOpen, setMoreOpen] = useState(false)
  const ref = useRef(null)
  const moreRef = useRef(null)
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
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
          <button className="icon-btn d-none d-lg-inline-flex" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <LuMoon /> : <LuSun />}</button>
          <button className="icon-btn position-relative d-none d-lg-inline-flex" aria-label="Notifications"><LuBell /><span className="bell-dot" /></button>
          <div className="position-relative d-lg-none st-more" ref={moreRef}>
            <button className="icon-btn" onClick={() => setMoreOpen((o) => !o)} aria-label="More" aria-haspopup="true" aria-expanded={moreOpen}><LuEllipsisVertical /></button>
            {moreOpen && (
              <div className="user-menu st-more-menu" role="menu">
                {onSearch && <div className="st-more-search d-md-none"><LuSearch /><input placeholder="Search chapters…" value={search} onChange={(e) => onSearch(e.target.value)} aria-label="Search chapters" /></div>}
                <button role="menuitem" onClick={() => { setMoreOpen(false); toggle() }}>{theme === 'dark' ? <LuSun /> : <LuMoon />} {theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
                <button role="menuitem" onClick={() => setMoreOpen(false)}><LuBell /> Notifications</button>
                <button role="menuitem" onClick={() => { setMoreOpen(false); onNav('bookmarks') }}><LuBookmark /> Bookmarks</button>
                <button role="menuitem" onClick={() => { setMoreOpen(false); onNav('home') }}><LuHouse /> Dashboard</button>
              </div>
            )}
          </div>
          <div className="position-relative" ref={ref}>
            <button className="user-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              <span className="avatar">
                {user?.photoURL ? <img src={user.photoURL} alt={user.name || ''} className="avatar-img" /> : <LuUser />}
              </span>
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
        {STUDENT_NAV.filter((n) => n.key !== 'home').map((item) => {
          const isBm = item.key === 'bookmarks'
          const key = isBm ? 'notes' : item.key
          const label = isBm ? 'My Notes' : item.label.replace('My ', '')
          const I = isBm ? LuNotebookPen : item.icon
          return <button key={key} className={active === key ? 'on' : ''} onClick={() => onNav(key)}><I /><span>{label}</span></button>
        })}
      </nav>
    </>
  )
}
