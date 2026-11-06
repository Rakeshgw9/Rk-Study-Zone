import { useMemo } from 'react'
import { LuArrowRight, LuHouse } from 'react-icons/lu'
import { Link, useOutletContext } from 'react-router-dom'
import StatCards from '../components/StatCards'
import { computeStats } from '../services/portalService'

export default function DashboardPage() {
  const { user, portals, enrollStats } = useOutletContext()
  const stats = useMemo(() => (enrollStats ? { ...computeStats(portals), totalStudents: enrollStats.totalStudents, newEnrollments: enrollStats.newEnrollments, studentLogins: enrollStats.studentLogins } : computeStats(portals)), [portals, enrollStats])
  const first = (user?.name || 'Teacher').split(' ')[0]
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><LuHouse /> Dashboard</h1>
          <p className="page-sub">Welcome back, {first}. Here is a quick overview.</p>
        </div>
      </div>
      <StatCards stats={stats} />
      <div className="glass-panel p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0 fw-semibold">Recent Portals</h2>
          <Link to="/admin/portals" className="rk-link">View all <LuArrowRight /></Link>
        </div>
        {portals.length === 0 ? <p className="text-muted-soft mb-0">No portals yet. <Link to="/admin/portals" className="rk-link">Create your first portal</Link>.</p> : (
          <ul className="list-unstyled mb-0 recent-list">
            {portals.slice(0, 5).map((p) => (
              <li key={p.id}><Link to={`/admin/builder/${p.id}`}>{p.name}</Link><span className={`status-badge ${p.status === 'active' ? 'is-active' : 'is-draft'}`}>{p.status === 'active' ? 'Active' : 'Draft'}</span></li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
