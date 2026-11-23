import { LuChartColumn, LuHouse, LuLayers, LuLogOut, LuMessagesSquare, LuSettings } from 'react-icons/lu'
import { useNotifications } from '../context/NotificationsContext'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LuHouse },
  { to: '/admin/portals', label: 'Portals', icon: LuLayers },
  { to: '/admin/messages', label: 'Messages', icon: LuMessagesSquare, badge: 'chat' },
  { to: '/admin/reports', label: 'Reports', icon: LuChartColumn },
  { to: '/admin/settings', label: 'Settings', icon: LuSettings },
]

export default function Sidebar({ open, collapsed, onNavigate, onLogout }) {
  const { items: notices } = useNotifications()
  // unread doubts = unread chat notices (no extra listener needed)
  const chatUnread = notices.filter((x) => x.source === 'direct' && !x.read && x.kind === 'chat').length
  return (
    <>
      <div className={`sidebar-scrim ${open ? 'show' : ''}`} onClick={onNavigate} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Main navigation">
        <nav className="d-flex flex-column gap-1">
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className="side-link" onClick={onNavigate} title={label}>
              <Icon className="side-icon" /> <span className="side-label">{label}</span>
              {badge === 'chat' && chatUnread > 0 && <span className="nt-badge static" aria-label={`${chatUnread} unread`}>{chatUnread > 9 ? '9+' : chatUnread}</span>}
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
