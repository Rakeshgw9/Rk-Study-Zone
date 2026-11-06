import { useEffect, useState } from 'react'
import { LuChartColumn } from 'react-icons/lu'
import { Link, useOutletContext } from 'react-router-dom'
import StatCards from '../components/StatCards'
import { contentStats } from '../lib/content'
import { timeAgo, toMillis } from '../lib/id'
import { loadDraft } from '../services/contentService'
import { computeStats } from '../services/portalService'

export default function ReportsPage() {
  const { portals, enrollStats } = useOutletContext()
  const [cs, setCs] = useState({})
  useEffect(() => {
    let alive = true
    Promise.all(portals.map(async (p) => [p.id, contentStats(await loadDraft(p.id).catch(() => ({ units: [] })))])).then((r) => alive && setCs(Object.fromEntries(r)))
    return () => { alive = false }
  }, [portals])
  const stats = enrollStats ? { ...computeStats(portals), totalStudents: enrollStats.totalStudents, newEnrollments: enrollStats.newEnrollments, studentLogins: enrollStats.studentLogins } : computeStats(portals)
  return (
    <>
      <div className="page-head"><div><h1 className="page-title"><LuChartColumn /> Analytics</h1><p className="page-sub">Students and content across your portals.</p></div></div>
      <StatCards stats={stats} />
      <div className="glass-panel p-0 overflow-hidden">
        <div className="table-responsive">
          <table className="table portal-table mb-0 align-middle">
            <thead><tr><th className="ps-4">Portal</th><th className="text-center">Units</th><th className="text-center">Chapters</th><th className="text-center">Blocks</th><th className="text-center">Students</th><th className="text-center">Active today</th><th className="pe-4">Last published</th></tr></thead>
            <tbody>
              {portals.length === 0 && <tr><td colSpan={7} className="text-center text-muted-soft py-4">No portals yet.</td></tr>}
              {portals.map((p) => {
                const c = cs[p.id] || {}; const e = enrollStats?.byPortal?.[p.id] || {}
                return (
                  <tr key={p.id}>
                    <td className="ps-4"><Link className="portal-name rk-link" to={`/admin/builder/${p.id}`}>{p.name}</Link></td>
                    <td className="text-center num">{c.units ?? '–'}</td><td className="text-center num">{c.chapters ?? '–'}</td><td className="text-center num">{c.blocks ?? '–'}</td>
                    <td className="text-center num">{e.students || 0}</td><td className="text-center num">{e.today || 0}</td>
                    <td className="pe-4">{p.publishedAt ? timeAgo(toMillis(p.publishedAt)) : <span className="text-muted-soft">Not published</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
