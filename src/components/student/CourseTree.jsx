import { useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronDown, LuChevronRight, LuCircle, LuCircleCheck, LuX } from 'react-icons/lu'
import { blockBadge, blockHeading, blockTypeLabel, plural } from '../../lib/blockLabel'
import { jsonOutline } from '../../lib/sectionFinder'
import { chapterProgress, overallProgress, unitProgress } from '../../lib/progress'
import { IconOf } from '../ui/icons'

/** Scroll to an element id (smooth, below the sticky header). Returns false when it is not on the page (yet). */
function scrollToAnchor(id) {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}
let pendingAnchor = null // clicked sub-section of a chapter that is still loading

export default function CourseTree({ portal, content, done, currentId, onOpen, onToggleBlock, onPickSection, search, open, onClose, headRight }) {
  const curUnit = content.units.find((u) => u.chapters.some((c) => c.id === currentId))?.id
  const [exp, setExp] = useState({})
  const isUnitOpen = (id) => (exp[`u:${id}`] ?? (id === curUnit))
  const isChapterOpen = (id) => (exp[`c:${id}`] ?? (id === currentId))
  useEffect(() => {
    if (!currentId) return
    setExp((prev) => {
      const next = {}
      Object.keys(prev).forEach((k) => {
        if (!k.startsWith('c:')) next[k] = prev[k]
      })
      if (curUnit) next[`u:${curUnit}`] = true
      next[`c:${currentId}`] = true
      return next
    })
  }, [currentId, curUnit])
  const ov = overallProgress(content, done)
  const term = (search || '').trim().toLowerCase()

  // sub-sections (JSON blocks) of the chapter being read → scroll-spy + "seen" markers
  const curChapter = useMemo(() => content.units.flatMap((u) => u.chapters).find((c) => c.id === currentId), [content, currentId])
  const outlines = useMemo(() => Object.fromEntries((curChapter?.blocks || []).map((b) => [b.id, jsonOutline(b)]).filter(([, o]) => o.length)), [curChapter])
  const [activeSec, setActiveSec] = useState(null)
  const [seenSecs, setSeenSecs] = useState({})
  const spyKey = Object.values(outlines).flat().map((o) => o.anchor).join('|')
  const seenRef = useRef({})
  useEffect(() => {
    seenRef.current = {}; setSeenSecs({}); setActiveSec(null)
    if (pendingAnchor) { const a = pendingAnchor; pendingAnchor = null; setTimeout(() => scrollToAnchor(a), 450) }
  }, [currentId])
  useEffect(() => {
    const ids = [...new Set(Object.values(outlines).flat().map((o) => o.anchor))].filter((a) => a.startsWith('sec-'))
    if (!ids.length || !('IntersectionObserver' in window)) return undefined
    let raf = 0
    const order = ids
    const pick = () => {
      // the last section whose top has passed the upper third of the viewport is the one being read
      const line = window.innerHeight * 0.33
      let cur = null
      const seen = {}
      order.forEach((id) => { const el = document.getElementById(id); if (!el) return; const r = el.getBoundingClientRect(); if (r.top <= line) cur = id; if (r.bottom <= line) seen[id] = true })
      setActiveSec(cur)
      const next = { ...seenRef.current, ...seen }
      if (Object.keys(next).length !== Object.keys(seenRef.current).length) { seenRef.current = next; setSeenSecs(next) }
    }
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(pick) }
    const targets = []
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll)
    const t = setTimeout(pick, 400)
    return () => { clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll, { capture: true }); window.removeEventListener('resize', onScroll); targets.length = 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spyKey, currentId])

  const openSub = (c, b, o) => {
    onPickSection?.({ chapterId: c.id, blockId: b.id, anchorId: o.anchor })
    if (c.id !== currentId) { pendingAnchor = o.anchor; onOpen(c.id); return }
    scrollToAnchor(o.anchor)
    if (window.matchMedia?.('(max-width: 1199.98px)').matches) onClose?.()
  }
  return (
    <>
      <div className={`st-scrim ${open ? 'show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`st-tree ${open ? 'open' : ''}`} aria-label="Course content">
        <div className="st-course">
          {portal.coverUrl ? <img src={portal.coverUrl} alt="" loading="lazy" decoding="async" width="64" height="64" /> : <span className="ph"><IconOf name="book" /></span>}
          <div className="min-w-0 flex-grow-1"><b title={portal.name}>{portal.name}</b><small>{plural(content.units.length, 'unit')}</small></div>
          {headRight}
          <button className="icon-mini d-xl-none" onClick={onClose} aria-label="Close course content"><LuX /></button>
        </div>
        <div className="st-overall">
          <div className="d-flex justify-content-between"><span>Overall Progress</span><b>{ov.pct}%</b></div>
          <div className="bar"><span style={{ width: `${ov.pct}%` }} /></div>
        </div>
        <ul className="st-units">
          {content.units.map((u, ui) => {
            const chs = u.chapters.filter((c) => !term || c.title.toLowerCase().includes(term) || u.title.toLowerCase().includes(term))
            if (term && !chs.length) return null
            const up = unitProgress(u, done)
            const uo = term ? true : isUnitOpen(u.id)
            return (
              <li key={u.id}>
                <button className="st-unit" style={{ '--c': u.color }} onClick={() => setExp((e) => {
                  const next = {}
                  Object.keys(e).forEach((k) => { if (!k.startsWith('u:')) next[k] = e[k] })
                  if (!uo) {
                    content.units.forEach((other) => { next[`u:${other.id}`] = other.id === u.id })
                  } else {
                    next[`u:${u.id}`] = false
                  }
                  return next
                })} aria-expanded={uo}>
                  <span className="ico"><IconOf name={u.icon} /></span>
                  <span className="min-w-0 flex-grow-1 text-start"><small>Unit {ui + 1}</small><b title={u.title}>{u.title}</b></span>
                  <span className={`pct ${up.pct === 100 ? 'full' : ''}`}>{up.pct}%</span>
                  {uo ? <LuChevronDown /> : <LuChevronRight />}
                </button>
                {uo && (
                  <ul className="st-chapters">
                    {chs.map((c) => {
                      const cp = chapterProgress(c, done)
                      const cur = c.id === currentId
                      const co = term ? true : isChapterOpen(c.id)
                      return (
                        <li key={c.id} className={cur ? 'cur' : ''}>
                          <div className="st-ch-row">
                            <button className="st-ch" onClick={() => onOpen(c.id)} aria-current={cur ? 'page' : undefined}>
                              {cp.pct === 100 ? <LuCircleCheck className="ok" /> : <span className="ring" style={{ '--p': cp.pct }} />}
                              <span className="t" title={c.title}>{c.title}</span>
                              <span className="pct">{cp.pct}%</span>
                            </button>
                            {c.blocks.length > 0 && <button className="icon-mini" onClick={() => setExp((e) => {
                  const next = {}
                  Object.keys(e).forEach((k) => { if (!k.startsWith('c:')) next[k] = e[k] })
                  if (!co) {
                    content.units.forEach((uu) => uu.chapters.forEach((cc) => { next[`c:${cc.id}`] = cc.id === c.id }))
                  } else {
                    next[`c:${c.id}`] = false
                  }
                  return next
                })} aria-label={co ? 'Hide blocks' : 'Show blocks'}>{co ? <LuChevronDown /> : <LuChevronRight />}</button>}
                          </div>
                          {co && c.blocks.length > 0 && (
                            <ul className="st-blocks">
                              {c.blocks.map((b, bi) => { const label = blockHeading(b, bi); const subs = c.id === currentId ? outlines[b.id] || [] : jsonOutline(b); return (
                                <li key={b.id}>
                                  <button onClick={() => onToggleBlock(c.id, b)} aria-pressed={!!done[b.id]} title={`${blockTypeLabel(b.type)}: ${label} — ${done[b.id] ? 'completed (click to mark as not done)' : 'click to mark as done'}`}>
                                    {done[b.id] ? <LuCircleCheck className="ok" /> : <LuCircle />}
                                    <span className={`blk-badge t-${b.type}`}>{blockBadge(b.type)}</span>
                                    <span className="st-blk-label">{label}</span>
                                  </button>
                                  {subs.length > 0 && (
                                    <ul className="st-subsecs" aria-label={`Sections in ${label}`}>
                                      {subs.map((o, oi) => {
                                        const on = c.id === currentId && activeSec === o.anchor && o.anchor.startsWith('sec-')
                                        const doneSub = !!done[b.id] || !!seenSecs[o.anchor]
                                        return (
                                          <li key={o.id}>
                                            <button type="button" className={`st-sub${on ? ' on' : ''}`} onClick={() => openSub(c, b, o)} aria-current={on ? 'location' : undefined} title={o.title}>
                                              {doneSub ? <LuCircleCheck className="ok" /> : <LuCircle />}
                                              <span>{o.title || `Section ${oi + 1}`}</span>
                                            </button>
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  )}
                                </li>
                              ) })}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </aside>
    </>
  )
}
