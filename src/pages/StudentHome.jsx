import { useEffect, useMemo, useState } from 'react'
import { CourseGridSkeleton, PageLoader } from '../components/ui/Loaders'
import { LuArrowRight, LuBookmark, LuBookOpen, LuChartColumn, LuCircleAlert, LuInfo, LuSearch, LuTrophy } from 'react-icons/lu'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import StudentHeader from '../components/student/StudentHeader'
import { portalVisual } from '../components/portalIcon'
import { useAuth } from '../context/AuthContext'
import { flatChapters } from '../lib/content'
import { overallProgress, visibleContent } from '../lib/progress'
import { loadPublished } from '../services/contentService'
import { listActivePortals } from '../services/portalService'
import { plural } from '../lib/blockLabel'
import PortalDetailsModal from '../components/student/PortalDetailsModal'
import StudentOverview from '../components/student/StudentOverview'
import TeacherBadge from '../components/student/TeacherBadge'
import { createdAtOf, facets, filterPortals, SORTS, updatedAtOf } from '../lib/portalDiscovery'
import { CATEGORIES } from '../services/portalService'
import { loadStudentData } from '../services/studentService'

export default function StudentHome() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'courses'
  const [items, setItems] = useState(null)
  const [err, setErr] = useState(false)
  const [q, setQ] = useState('')
  const [flt, setFlt] = useState({ specialization: '', category: '', teacher: '', sort: 'updated' })
  const [details, setDetails] = useState(null)

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const portals = await listActivePortals()
        const rows = await Promise.all(portals.map(async (p) => {
          const c = await loadPublished(p.id).catch(() => null)
          if (!c?.units?.length) return null
          const vc = visibleContent(c)
          const sd = await loadStudentData(user.uid, p.id)
          const flat = flatChapters(vc)
          return { portal: p, content: vc, sd, prog: overallProgress(vc, sd.completed), flat, chapters: flat.length }
        }))
        if (alive) setItems(rows.filter(Boolean))
      } catch (e) { console.error(e); if (alive) { setErr(true); setItems([]) } }
    })()
    return () => { alive = false }
  }, [user])

  const filtered = useMemo(() => filterPortals(items || [], { search: q, ...flt }), [items, q, flt])
  const fac = useMemo(() => facets(items || []), [items])
  const dateFmt = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/" replace />

  const onNav = (k) => setParams(k === 'progress' || k === 'bookmarks' ? { tab: k } : k === 'notes' ? { tab: 'bookmarks' } : k === 'practice' || k === 'mock' ? { tab: 'progress' } : {})
  const open = (x, chId) => navigate(`/learn/${x.portal.id}${chId ? `/${chId}` : x.sd.lastChapterId ? `/${x.sd.lastChapterId}` : ''}`)
  const active = tab === 'progress' ? 'progress' : tab === 'bookmarks' ? 'bookmarks' : 'courses'

  return (
    <div className="st-shell">
      <StudentHeader active={active} onNav={onNav} user={user} search={q} onSearch={setQ} />
      <main className="st-home container-xl">
        <div className="st-home-head">
          <div><h1>Hello, {user.name?.split(' ')[0] || 'Student'}</h1><p>Continue learning where you left off.</p></div>
          <div className="ui-input-icon d-md-none w-100"><LuSearch /><input className="ui-input" placeholder="Search courses…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="ui-tabs mb-3" role="tablist">
          {[['courses', 'My Courses', LuBookOpen], ['progress', 'Progress & Scores', LuChartColumn], ['bookmarks', 'Bookmarks', LuBookmark]].map(([k, l, I]) => (
            <button key={k} role="tab" aria-selected={active === k} className={`ui-tab ${active === k ? 'on' : ''}`} onClick={() => onNav(k)}><I /> <span>{l}</span></button>
          ))}
        </div>
        {items?.length > 0 && active === 'courses' && <StudentOverview items={items} onOpen={open} onDetails={setDetails} />}
        {items?.length > 0 && active === 'courses' && (
          <div className="st-filters" role="search" aria-label="Filter courses">
            <select className="form-select" aria-label="Specialization" value={flt.specialization} onChange={(e) => setFlt((f) => ({ ...f, specialization: e.target.value }))}>
              <option value="">All specializations</option>{fac.specializations.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="form-select" aria-label="Category" value={flt.category} onChange={(e) => setFlt((f) => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>{fac.categories.map((c) => <option key={c} value={c}>{CATEGORIES.find((x) => x.value === c)?.label || c}</option>)}
            </select>
            <select className="form-select" aria-label="Teacher" value={flt.teacher} onChange={(e) => setFlt((f) => ({ ...f, teacher: e.target.value }))}>
              <option value="">All teachers</option>{fac.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="form-select" aria-label="Sort by" value={flt.sort} onChange={(e) => setFlt((f) => ({ ...f, sort: e.target.value }))}>
              {SORTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        )}
        {items === null ? <CourseGridSkeleton withOverview={active === 'courses'} />
          : err ? <div className="st-empty"><LuCircleAlert /> Could not load courses. Please try again.</div>
            : filtered.length === 0 ? <div className="st-empty"><LuBookOpen /><b>{items.length ? 'No courses match your filters' : 'No courses available yet'}</b><span>{items.length ? 'Try clearing the search or a filter.' : 'Published study portals will appear here.'}</span></div>
              : active === 'courses' ? (
                <div className="row g-3">
                  {filtered.map((x) => {
                    const { Icon, tone } = portalVisual(x.portal)
                    return (
                      <div key={x.portal.id} className="col-md-6 col-lg-4">
                        <div className="course-card course-card-rich">
                          <button type="button" className="cc-main" onClick={() => open(x)} aria-label={`Open ${x.portal.name}`}>
                            <div className={`cc-cover tone-${tone}`}>{x.portal.coverUrl ? <img src={x.portal.coverUrl} alt="" loading="lazy" decoding="async" width="320" height="180" /> : <Icon />}</div>
                            <div className="cc-body">
                              <b>{x.portal.name}</b>
                              <TeacherBadge portal={x.portal} />
                              <small>{plural(x.content.units.length, 'unit')} · {plural(x.chapters, 'chapter')}{x.portal.accessType && x.portal.accessType !== 'free' ? ` · ${x.portal.accessType}` : ''}</small>
                              <small className="cc-dates">Created {dateFmt(createdAtOf(x.portal)) || '—'} · Updated {dateFmt(updatedAtOf(x.portal)) || '—'}</small>
                              <div className="bar my-2"><span style={{ width: `${x.prog.pct}%` }} /></div>
                              <div className="d-flex justify-content-between align-items-center"><span className="small text-soft">{x.prog.pct}% complete</span><span className="cc-go">{x.prog.done ? 'Continue' : 'Start'} <LuArrowRight /></span></div>
                            </div>
                          </button>
                          <button type="button" className="cc-info" onClick={() => setDetails(x)} aria-label={`Details of ${x.portal.name}`} title="Portal details"><LuInfo /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : active === 'progress' ? (
                <div className="st-table-card">
                  {filtered.map((x) => {
                    const tests = x.flat.flatMap((f) => f.chapter.blocks.filter((b) => b.type === 'mcq').map((b) => ({ b, f })))
                    return (
                      <div key={x.portal.id} className="prog-row">
                        <div className="d-flex justify-content-between align-items-center gap-2 mb-2"><b>{x.portal.name}</b><span className="pill pill-info">{x.prog.pct}%</span></div>
                        <div className="bar mb-2"><span style={{ width: `${x.prog.pct}%` }} /></div>
                        {tests.length === 0 ? <small className="text-soft">No tests in this course.</small> : (
                          <ul className="score-list">{tests.map(({ b, f }) => { const s = x.sd.scores[b.id]; return (
                            <li key={b.id}><button onClick={() => open(x, f.chapter.id)}><LuTrophy /> <span className="flex-grow-1 text-start">{b.data.title} <small>· {f.chapter.title}</small></span><b>{s ? `${s.score}/${s.total} (${s.percent}%)` : 'Not attempted'}</b></button></li>
                          ) })}</ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="st-table-card">
                  {filtered.every((x) => !x.sd.bookmarks.length) && <p className="text-soft mb-0 p-3">No bookmarks yet.</p>}
                  {filtered.filter((x) => x.sd.bookmarks.length).map((x) => (
                    <div key={x.portal.id} className="prog-row">
                      <b className="d-block mb-2">{x.portal.name}</b>
                      <ul className="score-list">{x.flat.filter((f) => x.sd.bookmarks.includes(f.chapter.id)).map((f) => (
                        <li key={f.chapter.id}><button onClick={() => open(x, f.chapter.id)}><LuBookmark /> <span className="flex-grow-1 text-start">{f.chapter.title} <small>· Unit {f.unitIndex + 1}</small></span><LuArrowRight /></button></li>
                      ))}</ul>
                    </div>
                  ))}
                </div>
              )}
      </main>
      <PortalDetailsModal item={details} onClose={() => setDetails(null)} onOpen={(x) => { setDetails(null); open(x) }} />
    </div>
  )
}
