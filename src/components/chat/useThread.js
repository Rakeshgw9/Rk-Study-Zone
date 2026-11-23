import { useCallback, useEffect, useState } from 'react'
import { loadOlderMessages, watchMessages, watchThread } from '../../services/chatService'
import { mergeMessages, PAGE_SIZE } from '../../lib/chat'

/** Live thread + newest 30 messages + "load older" pages. Listeners exist ONLY while `active` is true. */
export default function useThread(id, active) {
  const [thread, setThread] = useState(null)
  const [live, setLive] = useState([])
  const [older, setOlder] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setThread(null); setLive([]); setOlder([]); setHasMore(false); setError(false)
    if (!id || !active) return undefined
    setLoading(true)
    const offT = watchThread(id, setThread, () => setError(true))
    const offM = watchMessages(id, (list) => { setLive(list); setHasMore((h) => h || list.length >= PAGE_SIZE); setLoading(false) }, () => { setError(true); setLoading(false) })
    return () => { offT(); offM() }
  }, [id, active])

  const messages = mergeMessages(older, live)
  const loadOlder = useCallback(async () => {
    const first = messages[0]
    if (!first?.at) return
    try { const r = await loadOlderMessages(id, first.at); setOlder((o) => mergeMessages(r.messages, o)); setHasMore(r.hasMore) } catch { setError(true) }
  }, [id, messages])

  return { thread, messages, hasMore, loadOlder, loading, error }
}
