/* Live-chat helpers (pure): ids, text rules, rate limit, message state, thread filters. */
export const MAX_MESSAGE = 1000
export const RATE_LIMIT = { max: 6, windowMs: 60_000 } // messages per minute per student
export const TYPING_TTL = 6000
export const PAGE_SIZE = 30
export const MAX_IMAGE_URL = 450_000 // inline (data:) screenshots must stay small

export const threadIdOf = (portalId, studentUid) => `${portalId}_${studentUid}`

/** Plain text only: control characters removed, line breaks kept (max 2 in a row), trimmed. Rendered by React, never as HTML. */
export function cleanMessage(text, max = MAX_MESSAGE) {
  return String(text ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

export function validateMessage(text, { hasImage = false } = {}) {
  const t = cleanMessage(text)
  if (!t && !hasImage) return { ok: false, error: 'Type a message first.' }
  if (String(text ?? '').trim().length > MAX_MESSAGE) return { ok: false, error: `Messages can be up to ${MAX_MESSAGE} characters.` }
  return { ok: true, text: t }
}

/** history: timestamps (ms) of the messages this person sent recently. */
export function checkRate(history = [], now = Date.now(), { max, windowMs } = RATE_LIMIT) {
  const recent = history.filter((t) => now - t < windowMs).sort((a, b) => a - b)
  if (recent.length < max) return { ok: true, recent: [...recent, now], retryInMs: 0 }
  return { ok: false, recent, retryInMs: windowMs - (now - recent[recent.length - max]) }
}

export const contextLabel = (c) => {
  if (!c) return ''
  const parts = [c.unitTitle, c.chapterTitle].filter(Boolean)
  return parts.join(' › ')
}
export const sameContext = (a, b) => (a?.chapterId || '') === (b?.chapterId || '') && (a?.blockId || '') === (b?.blockId || '')

/** sending → sent (server confirmed) → read (the other person opened the thread after it was sent) */
export function messageState(msg, otherReadAt = 0) {
  if (msg.pending) return 'sending'
  if (otherReadAt && msg.at && otherReadAt >= msg.at) return 'read'
  return 'sent'
}
export const stateLabel = { sending: 'Sending…', sent: 'Delivered', read: 'Read' }

export const typingActive = (typingAt, now = Date.now(), ttl = TYPING_TTL) => !!typingAt && now - typingAt < ttl

/** Merge live + older pages: unique by id, oldest → newest. A confirmed copy replaces a pending one. */
export function mergeMessages(...lists) {
  const map = new Map()
  for (const list of lists) for (const m of list || []) { const old = map.get(m.id); if (!old || (old.pending && !m.pending)) map.set(m.id, m) }
  return [...map.values()].sort((a, b) => (a.at || Infinity) - (b.at || Infinity))
}

export function filterThreads(threads = [], { filter = 'all', portalId = '', search = '' } = {}) {
  const q = String(search).trim().toLowerCase()
  return threads
    .filter((t) => {
      if (filter === 'unread' && !(t.unreadForTeacher > 0)) return false
      if (filter === 'unanswered' && !(t.lastSender === 'student' && t.status !== 'resolved')) return false
      if (filter === 'resolved' && t.status !== 'resolved') return false
      if (portalId && t.portalId !== portalId) return false
      if (q && !`${t.studentName || ''} ${t.lastMessage || ''} ${t.portalName || ''} ${contextLabel(t.context)}`.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
}
export const unreadThreads = (threads = []) => threads.reduce((n, t) => n + (t.unreadForTeacher > 0 ? 1 : 0), 0)
export const unansweredThreads = (threads = []) => threads.filter((t) => t.lastSender === 'student' && t.status !== 'resolved').length
export const preview = (text, n = 120) => { const s = cleanMessage(text, 2000).replace(/\s+/g, ' '); return s.length > n ? `${s.slice(0, n - 1)}…` : s }
