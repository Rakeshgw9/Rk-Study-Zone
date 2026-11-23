import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { emptyState, filterNotifications, mergeNotifications, unreadCount } from '../lib/notifications'
import { backfillEnrolled, fetchFeed, loadState, markDirectRead, saveState, watchDirect } from '../services/notificationService'
import { isStaffRole } from '../services/authService'
import { listActivePortals, syncExamFlag } from '../services/portalService'

const Ctx = createContext({ items: [], unread: 0, loading: false, error: false, prefs: emptyState().prefs, markRead: () => {}, markAllRead: () => {}, markMatchingRead: () => {}, setPrefs: () => {}, refresh: () => {}, filter: filterNotifications })
const FEED_MIN_GAP = 60 * 1000 // manual refresh (opening the bell)
const FEED_AUTO_GAP = 5 * 60 * 1000 // when the tab becomes visible again

/* One shared source for the bell, the dropdown and the Notifications page.
   Cost: 1 read (state) + a bounded listener on the 30 newest direct notices + 1 small query per joined portal
   (only on load, when the tab regains focus after ≥ 5 min, and when the bell is opened after ≥ 60 s). No polling. */
export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [state, setState] = useState(emptyState())
  const [ready, setReady] = useState(false)
  const [direct, setDirect] = useState([])
  const [feed, setFeed] = useState([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const stateRef = useRef(state)
  const lastFeed = useRef(0)
  stateRef.current = state

  useEffect(() => {
    setState(emptyState()); setReady(false); setDirect([]); setFeed([]); setError(false)
    if (!uid) return undefined
    let alive = true
    setLoading(true)
    ;(async () => {
      let st = await loadState(uid)
      if (!st.backfilled && user.role === 'student') {
        try { st = { ...st, enrolled: await backfillEnrolled(user, await listActivePortals()), backfilled: true } } catch (e) { console.warn('Enrolment backfill skipped', e) }
      }
      if (!alive) return
      setState(st); setReady(true); setLoading(false)
    })()
    const off = watchDirect(uid, (list) => alive && setDirect(list), () => alive && setError(true))
    return () => { alive = false; off() }
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async (force = false) => {
    if (!uid) return
    const now = Date.now()
    if (!force && now - lastFeed.current < FEED_MIN_GAP) return
    lastFeed.current = now
    try { setFeed(await fetchFeed(Object.keys(stateRef.current.enrolled))); setError(false) } catch { setError(true) }
  }, [uid])

  useEffect(() => { if (ready) refresh(true) }, [ready, refresh, Object.keys(state.enrolled).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - lastFeed.current > FEED_AUTO_GAP) refresh(true) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  // staff: keep the "exam submitted" preference in step with their portals (once per session)
  useEffect(() => {
    if (!ready || !isStaffRole(user?.role) || !state.prefs.examSubmit) return
    const key = `rk_exam_flag_${uid}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    syncExamFlag(user, true).catch(() => {})
  }, [ready, uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => mergeNotifications({ direct, feed, state }), [direct, feed, state])
  const unread = useMemo(() => unreadCount(items), [items])

  const markRead = useCallback(async (item) => {
    if (!uid || !item || item.read) return
    if (item.source === 'direct') await markDirectRead(uid, [item.rawId]).catch(() => {})
    else {
      const readFeed = { [item.rawId]: Date.now() }
      setState((s) => ({ ...s, readFeed: { ...s.readFeed, ...readFeed } }))
      saveState(uid, { readFeed }).catch(() => {})
    }
  }, [uid])

  const markAllRead = useCallback(async () => {
    if (!uid) return
    const ids = items.filter((x) => x.source === 'direct' && !x.read).map((x) => x.rawId)
    const lastSeenAt = Date.now()
    setState((s) => ({ ...s, lastSeenAt }))
    await Promise.all([markDirectRead(uid, ids).catch(() => {}), saveState(uid, { lastSeenAt }).catch(() => {})])
  }, [uid, items])

  /** Marks unread direct notices that match (e.g. chat notices of one thread) as read — used when a chat is opened. */
  const markMatchingRead = useCallback(async (predicate) => {
    if (!uid) return
    const ids = items.filter((x) => x.source === 'direct' && !x.read && predicate(x)).map((x) => x.rawId)
    if (ids.length) await markDirectRead(uid, ids).catch(() => {})
  }, [uid, items])

  const setPrefs = useCallback(async (patch) => {
    if (!uid) return
    setState((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }))
    await saveState(uid, { prefs: patch })
    if ('examSubmit' in patch && isStaffRole(user?.role)) await syncExamFlag(user, patch.examSubmit)
  }, [uid, user])

  const value = useMemo(() => ({ items, unread, loading, error, prefs: state.prefs, markRead, markAllRead, markMatchingRead, setPrefs, refresh }), [items, unread, loading, error, state.prefs, markRead, markAllRead, markMatchingRead, setPrefs, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(Ctx)
