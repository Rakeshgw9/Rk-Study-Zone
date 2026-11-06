import { useState } from 'react'
import { LuChevronDown, LuChevronRight, LuCircle, LuCircleCheck, LuX } from 'react-icons/lu'
import { blockHeading, plural } from '../../lib/blockLabel'
import { chapterProgress, overallProgress, unitProgress } from '../../lib/progress'
import { IconOf } from '../ui/icons'

export default function CourseTree({ portal, content, done, currentId, onOpen, onToggleBlock, search, open, onClose, headRight }) {
  const curUnit = content.units.find((u) => u.chapters.some((c) => c.id === currentId))?.id
  const [exp, setExp] = useState({})
  const isOpen = (id) => (exp[id] ?? (id === curUnit || id === currentId))
  const ov = overallProgress(content, done)
  const term = (search || '').trim().toLowerCase()
  return (
    <>
      <div className={`st-scrim ${open ? 'show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`st-tree ${open ? 'open' : ''}`} aria-label="Course content">
        <div className="st-course">
          {portal.coverUrl ? <img src={portal.coverUrl} alt="" /> : <span className="ph"><IconOf name="book" /></span>}
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
            const uo = term ? true : isOpen(u.id)
            return (
              <li key={u.id}>
                <button className="st-unit" style={{ '--c': u.color }} onClick={() => setExp((e) => ({ ...e, [u.id]: !uo }))} aria-expanded={uo}>
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
                      const co = term ? true : isOpen(c.id)
                      return (
                        <li key={c.id} className={cur ? 'cur' : ''}>
                          <div className="st-ch-row">
                            <button className="st-ch" onClick={() => onOpen(c.id)} aria-current={cur ? 'page' : undefined}>
                              {cp.pct === 100 ? <LuCircleCheck className="ok" /> : <span className="ring" style={{ '--p': cp.pct }} />}
                              <span className="t" title={c.title}>{c.title}</span>
                              <span className="pct">{cp.pct}%</span>
                            </button>
                            {c.blocks.length > 0 && <button className="icon-mini" onClick={() => setExp((e) => ({ ...e, [c.id]: !co }))} aria-label={co ? 'Hide blocks' : 'Show blocks'}>{co ? <LuChevronDown /> : <LuChevronRight />}</button>}
                          </div>
                          {co && c.blocks.length > 0 && (
                            <ul className="st-blocks">
                              {c.blocks.map((b, bi) => { const label = blockHeading(b, bi); return (
                                <li key={b.id}>
                                  <button onClick={() => onToggleBlock(c.id, b)} aria-pressed={!!done[b.id]} title={`${label} — ${done[b.id] ? 'completed (click to mark as not done)' : 'click to mark as done'}`}>
                                    {done[b.id] ? <LuCircleCheck className="ok" /> : <LuCircle />}
                                    <span>{label}</span>
                                  </button>
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
