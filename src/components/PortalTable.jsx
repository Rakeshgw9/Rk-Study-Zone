import { useEffect, useRef, useState } from 'react'
import { LuCopy, LuEllipsisVertical, LuPencil, LuSettings2, LuSquareArrowOutUpRight, LuTrash2 } from 'react-icons/lu'
import { portalVisual } from './portalIcon'

function Thumb({ portal }) {
  const { Icon, tone } = portalVisual(portal)
  if (portal.coverUrl) return <img src={portal.coverUrl} alt="" className={`portal-thumb tone-${tone}`} />
  return <span className={`portal-thumb tone-${tone}`}><Icon /></span>
}

const StatusBadge = ({ status, published }) => (
  <span className="d-inline-flex flex-column align-items-center gap-1">
    <span className={`status-badge ${status === 'active' ? 'is-active' : 'is-draft'}`}>{status === 'active' ? 'Active' : 'Draft'}</span>
    {!published && <small className="text-muted-soft" style={{ fontSize: 11 }}>Not published</small>}
  </span>
)

function More({ p, onDetails, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="kebab" ref={ref}>
      <button className="action-btn" onClick={(e) => { const r=e.currentTarget.getBoundingClientRect(); const h=132; setPos({ top: r.bottom + h > window.innerHeight ? Math.max(8, r.top-h-4) : r.bottom+4, left: Math.max(8, Math.min(r.right-190, window.innerWidth-198)) }); setOpen((o) => !o) }} aria-label={`More actions for ${p.name}`} aria-expanded={open}><LuEllipsisVertical /></button>
      {open && (
        <div className="kebab-menu kebab-fixed" style={{ top: pos.top, left: pos.left }} role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); onDetails(p) }}><LuSettings2 /> Edit details</button>
          <button role="menuitem" onClick={() => { setOpen(false); onDuplicate(p) }}><LuCopy /> Duplicate</button>
          <button role="menuitem" className="danger" onClick={() => { setOpen(false); onDelete(p) }}><LuTrash2 /> Delete</button>
        </div>
      )}
    </div>
  )
}

export default function PortalTable({ portals, onEdit, onOpen, onDetails, onDuplicate, onDelete }) {
  const more = (p) => <More p={p} onDetails={onDetails} onDuplicate={onDuplicate} onDelete={onDelete} />
  return (
    <div className="glass-panel p-0 overflow-hidden">
      {/* Desktop / tablet table */}
      <div className="table-responsive d-none d-md-block">
        <table className="table portal-table mb-0 align-middle">
          <thead>
            <tr>
              <th className="ps-4">Portal Name</th>
              <th>Description</th>
              <th className="text-center">Students</th>
              <th className="text-center">Enrollments</th>
              <th className="text-center">Status</th>
              <th className="text-center pe-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {portals.map((p) => (
              <tr key={p.id}>
                <td className="ps-3">
                  <div className="d-flex align-items-center gap-3">
                    <Thumb portal={p} />
                    <div className="min-w-0">
                      <div className="portal-name">{p.name}</div>
                      <div className="portal-slug">{p.slug}.rkstudyzone.com</div>
                    </div>
                  </div>
                </td>
                <td className="portal-desc">{p.description || <span className="text-muted-soft">—</span>}</td>
                <td className="text-center num">{(p.studentsCount || 0).toLocaleString('en-IN')}</td>
                <td className="text-center num">{(p.enrollmentsCount || 0).toLocaleString('en-IN')}</td>
                <td className="text-center"><StatusBadge status={p.status} published={!!p.publishedAt} /></td>
                <td className="text-center pe-4">
                  <div className="d-inline-flex gap-2">
                    <button className="action-btn" onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`} title="Edit content (Portal builder)"><LuPencil /></button>
                    <button className="action-btn action-open" onClick={() => onOpen(p)} aria-label={`Open ${p.name}`} title="Open student view"><LuSquareArrowOutUpRight /></button>
                    {more(p)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="portal-cards d-md-none list-unstyled mb-0">
        {portals.map((p) => (
          <li key={p.id} className="portal-card">
            <div className="d-flex align-items-start gap-3">
              <Thumb portal={p} />
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="portal-name">{p.name}</div>
                  <StatusBadge status={p.status} published={!!p.publishedAt} />
                </div>
                {p.description && <p className="portal-desc mb-2 mt-1">{p.description}</p>}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div className="portal-meta">
                    <span><strong>{p.studentsCount || 0}</strong> Students</span>
                    <span><strong>{p.enrollmentsCount || 0}</strong> Enrolled</span>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="action-btn" onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`}><LuPencil /></button>
                    <button className="action-btn action-open" onClick={() => onOpen(p)} aria-label={`Open ${p.name}`}><LuSquareArrowOutUpRight /></button>
                    {more(p)}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
