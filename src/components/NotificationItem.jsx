import { LuBell, LuBookOpenCheck, LuMessageCircle, LuUserPlus } from 'react-icons/lu'
import { absoluteTime, relativeTime } from '../lib/notifications'

const ICONS = { chat: LuMessageCircle, enrol: LuUserPlus, exam: LuBookOpenCheck, 'exam-added': LuBookOpenCheck, content: LuBell }

/** One row, used by the dropdown and the full page. Text is rendered by React (escaped) — never as HTML. */
export default function NotificationItem({ item, onOpen, compact = false }) {
  const Icon = ICONS[item.kind] || LuBell
  return (
    <button type="button" className={`nt-item${item.read ? '' : ' unread'}${compact ? ' compact' : ''}`} onClick={() => onOpen(item)}>
      <span className="nt-ico" aria-hidden="true"><Icon /></span>
      <span className="nt-main">
        <span className="nt-title">{item.title}{!item.read && <span className="visually-hidden"> (unread)</span>}</span>
        {item.body && <span className="nt-body">{item.body}</span>}
        <span className="nt-meta">
          {item.actor && <span>{item.actor}</span>}
          <time dateTime={new Date(item.at).toISOString()} title={absoluteTime(item.at)}>{relativeTime(item.at)}{!compact && ` · ${absoluteTime(item.at)}`}</time>
        </span>
      </span>
      {!item.read && <span className="nt-dot" aria-hidden="true" />}
    </button>
  )
}
