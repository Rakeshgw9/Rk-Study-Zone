import { useEffect, useState } from 'react'
import { LuMessageCircle, LuX } from 'react-icons/lu'
import ChatThreadView from './ChatThreadView'
import useThread from './useThread'
import { useNotifications } from '../../context/NotificationsContext'
import { contextLabel, threadIdOf, typingActive } from '../../lib/chat'
import { markThreadRead, sendMessage, sendTyping } from '../../services/chatService'

/** Floating "Ask your teacher" chat (bottom-right; full-screen sheet on phones).
 *  One thread per student per portal. Listeners are attached only while the panel is open. */
export default function ChatWidget({ user, portal, context, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen)
  const [ctxOn, setCtxOn] = useState(true)
  const [now, setNow] = useState(Date.now())
  const id = threadIdOf(portal.id, user.uid)
  const { thread, messages, hasMore, loadOlder, loading, error } = useThread(id, open)
  const { items, markMatchingRead } = useNotifications()
  const badge = items.filter((x) => x.source === 'direct' && !x.read && x.kind === 'chat' && x.portalId === portal.id).length
  const ctx = ctxOn ? context : null

  // opening the chat = reading it (resets the unread counter and the bell notices of this portal)
  useEffect(() => {
    if (!open) return
    if (thread?.unreadForStudent > 0) markThreadRead('student', id)
    if (badge) markMatchingRead((x) => x.kind === 'chat' && x.portalId === portal.id)
  }, [open, thread?.unreadForStudent, badge]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined
    const t = setInterval(() => setNow(Date.now()), 2000)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', esc)
    return () => { clearInterval(t); document.removeEventListener('keydown', esc) }
  }, [open])

  const send = ({ text, imageUrl }) => sendMessage({ user, role: 'student', portal, thread, text, imageUrl, context: ctx })
  const teacher = portal.ownerName || 'your teacher'

  return (
    <>
      {!open && (
        <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-label={badge ? `Ask your teacher, ${badge} unread reply` : 'Ask your teacher'} aria-haspopup="dialog">
          <LuMessageCircle />
          {badge > 0 && <span className="chat-fab-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
        </button>
      )}
      {open && (
        <section className="chat-panel" role="dialog" aria-label={`Chat with ${teacher}`}>
          <header className="chat-head">
            <div className="min-w-0">
              <b>Ask {teacher}</b>
              <small>{thread?.status === 'resolved' ? 'Marked resolved — write again to reopen' : (portal.ownerAvailability || 'Your teacher replies here and you get a notification.')}</small>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close chat"><LuX /></button>
          </header>

          <div className="chat-ctx">
            {ctx && contextLabel(ctx)
              ? <span className="chat-chip">Asking about: {contextLabel(ctx)}<button type="button" onClick={() => setCtxOn(false)} aria-label="Remove the chapter context"><LuX /></button></span>
              : <button type="button" className="chat-chip off" onClick={() => setCtxOn(true)} disabled={!context}>Ask about this chapter</button>}
          </div>

          {error && <div className="chat-error" role="alert">Could not load the chat. Check your connection, then close and reopen it.</div>}
          <ChatThreadView
            role="student" messages={messages} loading={loading} hasMore={hasMore} onLoadOlder={loadOlder}
            otherReadAt={thread?.readByTeacherAt || 0} otherTyping={typingActive(thread?.typingTeacherAt, now)}
            onSend={send} onTyping={() => thread && sendTyping('student', id)}
          >
            <div className="chat-empty"><LuMessageCircle /><b>No questions yet</b><span>Ask anything about what you are reading. {teacher} will reply here.</span></div>
          </ChatThreadView>
        </section>
      )}
    </>
  )
}
