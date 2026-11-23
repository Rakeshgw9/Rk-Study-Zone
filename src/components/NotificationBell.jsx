import { useEffect, useRef, useState } from 'react'
import { LuBell, LuCheckCheck } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router-dom'
import NotificationItem from './NotificationItem'
import { useNotifications } from '../context/NotificationsContext'

/** Bell with unread badge + dropdown of the latest items. variant: 'student' | 'admin' (decides "View all" target). */
export default function NotificationBell({ variant = 'student', className = '' }) {
  const { items, unread, loading, markRead, markAllRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const all = variant === 'admin' ? '/admin/notifications' : '/notifications'

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const toggle = () => { setOpen((o) => !o); if (!open) refresh() }
  const openItem = async (item) => {
    setOpen(false)
    markRead(item)
    if (item.link) navigate(item.link)
  }

  return (
    <div className={`position-relative nt-bell ${className}`} ref={ref}>
      <button type="button" className="icon-btn position-relative" onClick={toggle} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open}>
        <LuBell />
        {unread > 0 && <span className="nt-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">{unread ? `${unread} unread notifications` : ''}</span>
      {open && (
        <div className="nt-pop" role="dialog" aria-label="Notifications">
          <div className="nt-pop-head">
            <b>Notifications</b>
            <button type="button" className="nt-link" onClick={markAllRead} disabled={!unread}><LuCheckCheck /> Mark all read</button>
          </div>
          <div className="nt-pop-list">
            {loading && !items.length ? <div className="nt-empty">Loading…</div>
              : items.length === 0 ? <div className="nt-empty">You are all caught up.</div>
                : items.slice(0, 8).map((it) => <NotificationItem key={it.id} item={it} onOpen={openItem} compact />)}
          </div>
          <Link to={all} className="nt-pop-foot" onClick={() => setOpen(false)}>View all notifications</Link>
        </div>
      )}
    </div>
  )
}
