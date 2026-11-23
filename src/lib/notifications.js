/* Notification helpers (pure): merge, filter, unread counts, retention and time formatting. */
export const RETENTION_DAYS = 60
export const DAY_MS = 86400000
export const DEFAULT_PREFS = { muteContent: false, muteChat: false, muteEnrol: false, examSubmit: false }
export const emptyState = () => ({ lastSeenAt: 0, readFeed: {}, enrolled: {}, prefs: { ...DEFAULT_PREFS }, backfilled: false })
export const normalizeState = (s = {}) => ({ ...emptyState(), ...s, readFeed: s.readFeed || {}, enrolled: s.enrolled || {}, prefs: { ...DEFAULT_PREFS, ...(s.prefs || {}) } })

export const isRetained = (ms, now = Date.now(), days = RETENTION_DAYS) => !!ms && now - ms <= days * DAY_MS

export function relativeTime(ms, now = Date.now()) {
  if (!ms) return ''
  const s = Math.round((now - ms) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.round(s / 86400)} d ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
export const absoluteTime = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

/** direct: [{id,kind,title,body,link,portalId,actorName,read,at}], feed: [{id,portalId,portalName,summary,title,chapterId,teacherName,at,hasExam}] */
export function mergeNotifications({ direct = [], feed = [], state = emptyState(), now = Date.now() } = {}) {
  const st = normalizeState(state)
  const out = []
  for (const d of direct) {
    if (!isRetained(d.at, now)) continue
    if (d.kind === 'chat' && st.prefs.muteChat) continue
    if (d.kind === 'enrol' && st.prefs.muteEnrol) continue
    out.push({ id: `d:${d.id}`, rawId: d.id, source: 'direct', kind: d.kind, title: d.title, body: d.body || '', at: d.at, link: d.link || '', read: !!d.read, portalId: d.portalId || '', actor: d.actorName || '' })
  }
  if (!st.prefs.muteContent) {
    for (const f of feed) {
      if (!isRetained(f.at, now)) continue
      const since = st.enrolled[f.portalId]
      if (since && f.at < since) continue // updates from before the student joined are not news
      out.push({
        id: `f:${f.id}`, rawId: f.id, source: 'feed', kind: f.hasExam ? 'exam-added' : 'content', title: f.title, body: f.summary || '', at: f.at,
        link: f.portalId ? `/learn/${f.portalId}${f.chapterId ? `/${f.chapterId}` : ''}` : '', read: !!st.readFeed[f.id] || f.at <= st.lastSeenAt, portalId: f.portalId, actor: f.teacherName || '',
      })
    }
  }
  return out.sort((a, b) => b.at - a.at)
}

export const unreadCount = (items) => items.reduce((n, x) => n + (x.read ? 0 : 1), 0)

export function filterNotifications(items, filter = 'all') {
  switch (filter) {
    case 'unread': return items.filter((x) => !x.read)
    case 'messages': return items.filter((x) => x.kind === 'chat')
    case 'content': return items.filter((x) => x.source === 'feed')
    default: return items
  }
}

/** Keeps the read-map small: newest `keep` entries only. */
export function pruneReadFeed(readFeed = {}, keep = 200) {
  const entries = Object.entries(readFeed)
  if (entries.length <= keep) return readFeed
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, keep))
}
