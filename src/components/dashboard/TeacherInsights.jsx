import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { LuActivity, LuCircleAlert, LuPlus, LuRefreshCw, LuSettings, LuUserCheck } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { buildSeries } from '../../lib/activity'
import { profileCompleteness } from '../../lib/profile'
import { toMillis } from '../../lib/id'
import { useNotifications } from '../../context/NotificationsContext'
import { watchActivity } from '../../services/activityService'
import { isStaffRole } from '../../services/authService'
import { SkeletonCard } from '../ui/Loaders'

// The chart is a separate chunk: it is only downloaded when the dashboard is opened
const ActivityChart = lazy(() => import('./ActivityChart'))

const ago = (ms) => {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export default function TeacherInsights({ user, portals, enrollStats }) {
  const { items: notices } = useNotifications()
  const unreadDoubts = notices.filter((x) => x.source === 'direct' && !x.read && x.kind === 'chat').length
  const [range, setRange] = useState(7)
  const [docs, setDocs] = useState(null) // null = loading
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const own = useMemo(() => portals.filter((p) => p.status === 'active' || p.publishedAt).slice(0, 10).map((p) => p.id), [portals])
  const idsKey = own.join(',')

  // live listener on a small, bounded set (≤ 10 portals × ≤ 30 day docs) — only while this page is open
  useEffect(() => {
    setDocs(null); setError(false)
    return watchActivity(own, 30, setDocs, () => { setError(true); setDocs([]) })
  }, [idsKey, retry]) // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => (docs ? buildSeries(docs, range) : null), [docs, range])
  const completeness = profileCompleteness(user)
  const published = portals.filter((p) => p.publishedAt || p.status === 'active').length
  const perf = enrollStats?.performance || {}
  const perfRows = Object.values(perf)
  const avg = (f) => { const v = perfRows.map((r) => r[f]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null }
  const names = useMemo(() => Object.fromEntries(portals.map((p) => [p.id, p.name])), [portals])
  const todayActive = data ? data.series[data.series.length - 1].active : null

  return (
    <section className="ti-wrap" aria-label="Teaching insights">
      {isStaffRole(user.role) && completeness.pct < 100 && (
        <div className="ti-profile" role="note">
          <div className="flex-grow-1">
            <b>Your profile is {completeness.pct}% complete</b>
            <div className="bar my-1" role="progressbar" aria-valuenow={completeness.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness"><span style={{ width: `${completeness.pct}%` }} /></div>
            <small className="text-muted-soft">Add: {completeness.missing.join(', ')}</small>
          </div>
          <Link to="/admin/settings" className="btn ui-btn ui-btn-secondary btn-sm"><LuUserCheck /> Complete</Link>
        </div>
      )}

      <div className="ti-kpis">
        <div className="ti-kpi"><small>Published</small><b>{published}</b><span>of {portals.length} portals</span></div>
        <div className="ti-kpi"><small>Unanswered doubts</small><b>{unreadDoubts}</b><span><Link to="/admin/messages">Open inbox</Link></span></div>
        <div className="ti-kpi"><small>Draft</small><b>{portals.length - published}</b><span>not live yet</span></div>
        <div className="ti-kpi"><small>Active today</small><b>{todayActive ?? '—'}</b><span>students opened a portal</span></div>
        <div className="ti-kpi"><small>Avg completion</small><b>{avg('avgProgress') == null ? '—' : `${avg('avgProgress')}%`}</b><span>{avg('avgScore') == null ? 'no exam scores yet' : `avg exam score ${avg('avgScore')}%`}</span></div>
      </div>

      <div className="glass-panel p-3 p-md-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 className="h6 fw-semibold mb-0"><LuActivity /> Live activity <span className="live-dot" aria-hidden="true" /></h2>
          <div className="ui-tabs ti-range" role="tablist" aria-label="Date range">
            {[7, 30].map((n) => <button key={n} role="tab" aria-selected={range === n} className={`ui-tab ${range === n ? 'on' : ''}`} onClick={() => setRange(n)}>{n} days</button>)}
          </div>
        </div>
        {error ? (
          <div className="st-empty" role="alert"><LuCircleAlert /><b>Could not load activity</b><span>Check your connection or Firestore rules.</span>
            <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}><LuRefreshCw /> Retry</button></div>
        ) : !data ? <SkeletonCard />
          : own.length === 0 ? <p className="text-muted-soft mb-0">Publish a portal to start seeing student activity.</p>
            : data.empty ? <p className="text-muted-soft mb-0">No student activity in the last {range} days yet. It appears here live as students enrol and open chapters.</p>
              : <Suspense fallback={<SkeletonCard />}><ActivityChart data={data} /></Suspense>}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <div className="glass-panel p-3 p-md-4 h-100">
            <h2 className="h6 fw-semibold mb-2">Portal performance</h2>
            {portals.length === 0 ? <p className="text-muted-soft mb-0">No portals yet.</p> : (
              <div className="table-responsive">
                <table className="table ti-table align-middle mb-0">
                  <thead><tr><th scope="col">Portal</th><th scope="col" className="text-end">Students</th><th scope="col" className="text-end">Completion</th><th scope="col" className="text-end">Avg score</th></tr></thead>
                  <tbody>
                    {portals.slice(0, 8).map((p) => {
                      const r = perf[p.id]
                      return <tr key={p.id}><td><Link to={`/admin/builder/${p.id}`}>{p.name}</Link></td><td className="text-end">{r?.students ?? 0}</td><td className="text-end">{r?.avgProgress == null ? '—' : `${r.avgProgress}%`}</td><td className="text-end">{r?.avgScore == null ? '—' : `${r.avgScore}%`}</td></tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <div className="col-lg-5">
          <div className="glass-panel p-3 p-md-4 h-100">
            <h2 className="h6 fw-semibold mb-2">Recent activity</h2>
            {!enrollStats ? <SkeletonCard /> : enrollStats.recent?.length ? (
              <ul className="ti-feed list-unstyled mb-0" aria-live="polite">
                {enrollStats.recent.slice(0, 6).map((r, i) => (
                  <li key={`${r.uid}${r.portalId}${r.kind}${i}`}><b>{r.name}</b> {r.kind === 'enrolled' ? 'enrolled in' : 'was active in'} <span>{names[r.portalId] || 'a portal'}</span><small>{ago(toMillis(r.at))}</small></li>
                ))}
              </ul>
            ) : <p className="text-muted-soft mb-0">Nothing yet — students will show up here.</p>}
          </div>
        </div>
      </div>

      <div className="ti-actions">
        <Link to="/admin/portals" className="btn ui-btn ui-btn-primary btn-sm"><LuPlus /> New portal</Link>
        <Link to="/admin/messages" className="btn ui-btn ui-btn-secondary btn-sm">Open inbox</Link>
        <Link to="/admin/portals" className="btn ui-btn ui-btn-secondary btn-sm">Manage portals &amp; share links</Link>
        <Link to="/admin/settings" className="btn ui-btn ui-btn-secondary btn-sm"><LuSettings /> Profile</Link>
      </div>
    </section>
  )
}
