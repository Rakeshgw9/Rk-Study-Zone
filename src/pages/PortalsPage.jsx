import { useMemo, useState } from 'react'
import { LuChevronDown, LuLayers, LuPlus, LuSearch } from 'react-icons/lu'
import { useNavigate, useOutletContext } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import PortalFormModal from '../components/PortalFormModal'
import PortalTable from '../components/PortalTable'
import StatCards from '../components/StatCards'
import { computeStats, deletePortal, duplicatePortal } from '../services/portalService'
import { duplicateContent } from '../services/contentService'
import { useConfirm } from '../components/ui/Confirm'
import { useToast } from '../components/Toast'

export default function PortalsPage() {
  const { user, portals: rawPortals, portalsLoading, search, setSearch, enrollStats } = useOutletContext()
  const [status, setStatus] = useState('all')
  const [modal, setModal] = useState({ open: false, portal: null })
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const portals = useMemo(() => rawPortals.map((p) => {
    const e = enrollStats?.byPortal?.[p.id]
    return e ? { ...p, studentsCount: e.students, enrollmentsCount: e.thisMonth, loginsToday: e.today } : p
  }), [rawPortals, enrollStats])
  const onDuplicate = async (p) => {
    try { const id = await duplicatePortal(p, user); await duplicateContent(p.id, id, user); toast('Portal duplicated as Draft') } catch (e) { toast(e.message || 'Could not duplicate', 'error') }
  }
  const onDelete = async (p) => {
    if (!(await confirm({ title: 'Delete portal?', message: `“${p.name}” and all of its units, chapters and blocks will be permanently deleted. Students will lose access.`, danger: true, confirmText: 'Delete portal' }))) return
    try { await deletePortal(p.id); toast('Portal deleted') } catch (e) { toast(e.message || 'Could not delete', 'error') }
  }

  const stats = useMemo(() => (enrollStats ? { ...computeStats(portals), totalStudents: enrollStats.totalStudents, newEnrollments: enrollStats.newEnrollments, studentLogins: enrollStats.studentLogins } : computeStats(portals)), [portals, enrollStats])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return portals.filter((p) => (status === 'all' || p.status === status) &&
      (!q || p.name.toLowerCase().includes(q) || p.slug.includes(q) || (p.description || '').toLowerCase().includes(q)))
  }, [portals, search, status])

  const openCreate = () => setModal({ open: true, portal: null })

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><LuLayers /> Portals</h1>
          <p className="page-sub">Create and manage your study portals.</p>
        </div>
        <button className="btn rk-btn-primary btn-lg-soft" onClick={openCreate}><LuPlus className="me-2" />Create Portal</button>
      </div>

      <StatCards stats={stats} />

      {portalsLoading ? (
        <div className="glass-panel p-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : portals.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <>
          <div className="row g-2 g-md-3 mb-3">
            <div className="col-12 col-md">
              <div className="rk-input-group">
                <LuSearch className="rk-input-icon" />
                <input className="rk-input" placeholder="Search portal by name..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search portal by name" />
              </div>
            </div>
            <div className="col-12 col-md-auto status-filter">
              <div className="select-wrap">
                <select className="rk-field rk-select no-icon" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
                <LuChevronDown className="select-caret" />
              </div>
            </div>
          </div>
          {filtered.length === 0
            ? <div className="glass-panel text-center py-5 text-muted-soft">No portals match “{search || status}”.</div>
            : <PortalTable portals={filtered} onEdit={(p) => navigate(`/admin/builder/${p.id}`)} onOpen={(p) => window.open(`${window.location.pathname}#/learn/${p.id}${p.publishedAt ? '' : '?draft=1'}`, '_blank', 'noopener')} onDetails={(p) => setModal({ open: true, portal: p })} onDuplicate={onDuplicate} onDelete={onDelete} />}
        </>
      )}

      <PortalFormModal show={modal.open} portal={modal.portal} user={user} onClose={() => setModal({ open: false, portal: null })} />
    </>
  )
}
