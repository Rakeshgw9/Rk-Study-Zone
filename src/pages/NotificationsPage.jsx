import { useState } from 'react'
import { LuBellOff, LuCheckCheck } from 'react-icons/lu'
import { useNavigate, useOutletContext } from 'react-router-dom'
import NotificationItem from '../components/NotificationItem'
import NotificationPrefs from '../components/NotificationPrefs'
import StudentHeader from '../components/student/StudentHeader'
import { SkeletonList } from '../components/ui/Loaders'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { filterNotifications } from '../lib/notifications'
import { isStaffRole } from '../services/authService'

const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['messages', 'Messages'], ['content', 'Content updates']]

function Body({ staff }) {
  const { items, unread, loading, error, markRead, markAllRead, refresh } = useNotifications()
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()
  const list = filterNotifications(items, filter)
  const open = (it) => { markRead(it); if (it.link) navigate(it.link) }
  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Notifications</h1><p className="page-sub">{unread ? `${unread} unread` : 'You are all caught up'} · items are kept for 60 days</p></div>
        <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={markAllRead} disabled={!unread}><LuCheckCheck /> Mark all as read</button>
      </div>
      <div className="ui-tabs mb-3" role="tablist" aria-label="Filter notifications">
        {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} className={`ui-tab ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <div className="glass-panel p-2 p-md-3 mb-4" aria-live="polite">
        {loading && !items.length ? <SkeletonList rows={4} />
          : error && !items.length ? <div className="st-empty" role="alert"><LuBellOff /><b>Could not load notifications</b><button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={() => refresh(true)}>Retry</button></div>
            : list.length === 0 ? <div className="st-empty"><LuBellOff /><b>{filter === 'all' ? 'No notifications yet' : 'Nothing here'}</b><span>{filter === 'messages' ? 'Chat messages will appear here.' : 'New activity will show up here.'}</span></div>
              : <div className="nt-list">{list.map((it) => <NotificationItem key={it.id} item={it} onOpen={open} />)}</div>}
      </div>
      <div className="glass-panel p-3 p-md-4"><NotificationPrefs staff={staff} /></div>
    </>
  )
}

/** Admin version renders inside AdminLayout; the student version brings its own header. */
export function AdminNotificationsPage() {
  const { user } = useOutletContext()
  return <Body staff={isStaffRole(user.role)} />
}

export default function StudentNotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  if (!user) { navigate('/', { replace: true }); return null }
  return (
    <div className="st-shell">
      <StudentHeader active="" user={user} onNav={(k) => navigate(k === 'progress' || k === 'bookmarks' ? `/learn?tab=${k}` : '/learn')} />
      <main className="st-home container-xl"><Body staff={isStaffRole(user.role)} /></main>
    </div>
  )
}
