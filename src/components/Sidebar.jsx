import { LuChartColumn, LuHouse, LuLayers, LuLogOut, LuSettings } from 'react-icons/lu'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LuHouse },
  { to: '/admin/portals', label: 'Portals', icon: LuLayers },
  { to: '/admin/reports', label: 'Reports', icon: LuChartColumn },
  { to: '/admin/settings', label: 'Settings', icon: LuSettings },
]

export default function Sidebar({ open, collapsed, onNavigate, onLogout }) {
  return (
    <>
      <div className={`sidebar-scrim ${open ? 'show' : ''}`} onClick={onNavigate} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Main navigation">
        <nav className="d-flex flex-column gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="side-link" onClick={onNavigate} title={label}>
              <Icon className="side-icon" /> <span className="side-label">{label}</span>
            </NavLink>
          ))}
          <hr className="side-sep" />
          <button className="side-link" onClick={onLogout} title="Log Out">
            <LuLogOut className="side-icon" /> <span className="side-label">Log Out</span>
          </button>
        </nav>
      </aside>
    </>
  )
}
