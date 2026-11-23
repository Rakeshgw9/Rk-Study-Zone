import { useEffect, useMemo, useState } from 'react'
import { LuArrowLeft, LuBookOpen, LuCheck, LuMessagesSquare, LuRotateCcw, LuSearch, LuWrench } from 'react-icons/lu'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import ChatThreadView from '../components/chat/ChatThreadView'
import useThread from '../components/chat/useThread'
import { SkeletonList } from '../components/ui/Loaders'
import { useNotifications } from '../context/NotificationsContext'
import { contextLabel, filterThreads, typingActive, unansweredThreads, unreadThreads } from '../lib/chat'
import { relativeTime } from '../lib/notifications'
import { markThreadRead, sendMessage, sendTyping, setThreadStatus, watchInbox } from '../services/chatService'
import { useToast } from '../components/Toast'

const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['unanswered', 'Unanswered'], ['resolved', 'Resolved']]

function ThreadDetail({ summary, user, portals, onBack }) {
  const toast = useToast()
  const { markMatchingRead } = useNotifications()
  const { thread: live, messages, hasMore, loadOlder, loading, error } = useThread(summary.id, true)
  const [now, setNow] = useState(Date.now())
  const t = live || summary
  const portal = portals.find((p) => p.id === t.portalId) || { id: t.portalId, name: t.portalName, ownerId: t.teacherUid }
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 2000); return () => clearInterval(i) }, [])
  useEffect(() => {
    if (t.unreadForTeacher > 0) markThreadRead('teacher', t.id)
    markMatchingRead((x) => x.kind === 'chat' && String(x.link).includes(t.id))
  }, [t.id, t.unreadForTeacher]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => { try { await setThreadStatus(t.id, t.status === 'resolved' ? 'open' : 'resolved') } catch (e) { toast(e.message || 'Could not update the thread', 'error') } }
  const ctx = t.context || {}
  return (
    <div className="msg-detail">
      <header className="msg-detail-head">
        <button type="button" className="icon-btn d-md-none" onClick={onBack} aria-label="Back to the list"><LuArrowLeft /></button>
        <div className="min-w-0 flex-grow-1">
          <b>{t.studentName || 'Student'}</b>
          <small>{t.portalName}{contextLabel(ctx) ? ` · ${contextLabel(ctx)}` : ''}</small>
        </div>
        <div className="msg-actions">
          {ctx.chapterId && <Link className="btn ui-btn ui-btn-secondary btn-sm" to={`/learn/${t.portalId}/${ctx.chapterId}`} title="Open the chapter the student was reading"><LuBookOpen /> <span className="d-none d-lg-inline">Chapter</span></Link>}
          <Link className="btn ui-btn ui-btn-secondary btn-sm" to={`/admin/builder/${t.portalId}`} title="Open this portal in the builder"><LuWrench /> <span className="d-none d-lg-inline">Builder</span></Link>
          <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={toggle}>{t.status === 'resolved' ? <><LuRotateCcw /> Reopen</> : <><LuCheck /> Resolve</>}</button>
        </div>
      </header>
      {error && <div className="chat-error" role="alert">Could not load this conversation.</div>}
      <ChatThreadView
        role="teacher" messages={messages} loading={loading} hasMore={hasMore} onLoadOlder={loadOlder}
        otherReadAt={t.readByStudentAt || 0} otherTyping={typingActive(t.typingStudentAt, now)} placeholder="Write your reply…"
        onSend={({ text, imageUrl }) => sendMessage({ user, role: 'teacher', portal, thread: t, text, imageUrl, context: ctx })}
        onTyping={() => sendTyping('teacher', t.id)}
      />
    </div>
  )
}

/** Teacher / admin inbox. Teachers only receive threads of their own portals (query + rules); admins see all. */
export default function MessagesPage() {
  const { user, portals } = useOutletContext()
  const { threadId } = useParams()
  const navigate = useNavigate()
  const [threads, setThreads] = useState(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [filter, setFilter] = useState('all')
  const [portalId, setPortalId] = useState('')
  const [search, setSearch] = useState('')

  // live only while the inbox is open
  useEffect(() => {
    setThreads(null); setError(false)
    return watchInbox(user, setThreads, () => { setError(true); setThreads([]) })
  }, [user.uid, user.role, retry]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => filterThreads(threads || [], { filter, portalId, search }), [threads, filter, portalId, search])
  const selected = (threads || []).find((t) => t.id === threadId)
  const portalOptions = useMemo(() => [...new Map((threads || []).map((t) => [t.portalId, t.portalName])).entries()], [threads])

  return (
    <>
      <div className="page-head">
        <div><h1 className="page-title">Messages</h1><p className="page-sub">{threads ? `${unreadThreads(threads)} unread · ${unansweredThreads(threads)} waiting for your reply` : 'Student doubts from your portals'}</p></div>
      </div>
      <div className={`msg-shell glass-panel${threadId ? ' has-detail' : ''}`}>
        <aside className="msg-list" aria-label="Conversations">
          <div className="msg-filters">
            <div className="ui-tabs" role="tablist" aria-label="Filter conversations">
              {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} className={`ui-tab ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
            </div>
            <div className="msg-search"><LuSearch aria-hidden="true" /><input placeholder="Search students or questions" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search conversations" /></div>
            {portalOptions.length > 1 && (
              <select className="form-select" value={portalId} onChange={(e) => setPortalId(e.target.value)} aria-label="Filter by portal">
                <option value="">All portals</option>{portalOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            )}
          </div>
          <div className="msg-items">
            {threads === null ? <SkeletonList rows={4} />
              : error ? <div className="st-empty" role="alert"><LuMessagesSquare /><b>Could not load messages</b><button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>Retry</button></div>
                : list.length === 0 ? <div className="st-empty"><LuMessagesSquare /><b>{threads.length ? 'No conversations match' : 'No questions yet'}</b><span>{threads.length ? 'Try another filter.' : 'When a student asks a doubt while reading, it appears here live.'}</span></div>
                  : list.map((t) => (
                    <button key={t.id} type="button" className={`msg-row${t.id === threadId ? ' on' : ''}${t.unreadForTeacher > 0 ? ' unread' : ''}`} onClick={() => navigate(`/admin/messages/${t.id}`)} aria-current={t.id === threadId}>
                      <span className="msg-row-top"><b>{t.studentName || 'Student'}</b><small>{relativeTime(t.lastAt)}</small></span>
                      <span className="msg-row-text">{t.lastSender === 'teacher' ? 'You: ' : ''}{t.lastMessage}</span>
                      <span className="msg-row-meta">
                        <small>{t.portalName}{contextLabel(t.context) ? ` · ${contextLabel(t.context)}` : ''}</small>
                        {t.status === 'resolved' && <em>Resolved</em>}
                        {t.unreadForTeacher > 0 && <span className="nt-badge static" aria-label={`${t.unreadForTeacher} unread`}>{t.unreadForTeacher}</span>}
                      </span>
                    </button>
                  ))}
          </div>
        </aside>
        <section className="msg-pane" aria-label="Conversation">
          {selected ? <ThreadDetail key={selected.id} summary={selected} user={user} portals={portals} onBack={() => navigate('/admin/messages')} />
            : <div className="st-empty"><LuMessagesSquare /><b>{threadId && threads ? 'Conversation not found' : 'Select a conversation'}</b><span>Replies you send are delivered live to the student and they get a notification.</span></div>}
        </section>
      </div>
    </>
  )
}
