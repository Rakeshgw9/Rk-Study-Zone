import { useState } from 'react'
import { LuArrowRight, LuCalendarDays, LuFileText, LuLock, LuX } from 'react-icons/lu'
import Modal from '../Modal'
import SyllabusModal from './SyllabusModal'
import TeacherBadge from './TeacherBadge'
import { createdAtOf, updatedAtOf } from '../../lib/portalDiscovery'
import { plural } from '../../lib/blockLabel'
import { ACCESS_TYPES, CATEGORIES, syllabusFilesOf } from '../../services/portalService'

const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const labelOf = (list, v) => list.find((x) => x.value === v)?.label || v || '—'

/** Portal Details: everything the teacher entered when creating the portal + teacher summary + content outline. */
export default function PortalDetailsModal({ item, onClose, onOpen }) {
  const [sylOpen, setSylOpen] = useState(false)
  if (!item) return null
  const { portal: p, content, prog, chapters } = item
  const started = (prog?.done || 0) > 0
  const hasSyl = syllabusFilesOf(p).length > 0
  const access = labelOf(ACCESS_TYPES, p.accessType)
  return (
    <>
      <Modal show={!!item} onClose={onClose} className="pd-modal" labelledBy="pd-title">
        <div className="pd-head">
          <div className="min-w-0">
            <h2 id="pd-title" className="pd-title">{p.name}</h2>
            <p className="pd-cat">{labelOf(CATEGORIES, p.category)}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><LuX /></button>
        </div>

        <div className="pd-body">
          {p.description ? <p className="pd-desc">{p.description}</p> : <p className="pd-desc text-muted-soft">The teacher has not added a description yet.</p>}

          <section aria-label="Teacher" className="pd-sec">
            <h3>Taught by</h3>
            <TeacherBadge portal={p} size={44} showQualification />
          </section>

          <dl className="pd-facts">
            <div><dt><LuCalendarDays aria-hidden="true" /> Created</dt><dd>{fmt(createdAtOf(p))}</dd></div>
            <div><dt><LuCalendarDays aria-hidden="true" /> Last updated</dt><dd>{fmt(updatedAtOf(p))}</dd></div>
            <div><dt><LuLock aria-hidden="true" /> Access</dt><dd>{access}</dd></div>
            <div><dt>Content</dt><dd>{plural(content.units.length, 'unit')} · {plural(chapters, 'chapter')}</dd></div>
          </dl>

          {hasSyl && <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={() => setSylOpen(true)}><LuFileText /> View syllabus</button>}

          <section aria-label="Course outline" className="pd-sec">
            <h3>What you will learn</h3>
            <ol className="pd-outline">
              {content.units.map((u, i) => (
                <li key={u.id}>
                  <b>{u.title || `Unit ${i + 1}`}</b>
                  <ul>{(u.chapters || []).map((c) => <li key={c.id}>{c.title}</li>)}</ul>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="pd-foot">
          {started && <span className="small text-soft me-auto">{prog.pct}% complete</span>}
          <button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn ui-btn ui-btn-primary" onClick={() => onOpen(item)}>{started ? 'Continue learning' : 'Enrol & start'} <LuArrowRight /></button>
        </div>
      </Modal>
      <SyllabusModal show={sylOpen} onClose={() => setSylOpen(false)} portal={p} />
    </>
  )
}
