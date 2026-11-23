import { LuArrowRight, LuBookmark, LuFlame, LuTrophy } from 'react-icons/lu'
import TeacherBadge from './TeacherBadge'
import { averagePct, continueReading, recommend } from '../../lib/portalDiscovery'

/** Student dashboard strip: continue reading, overall progress, latest results, bookmarks, recommended portals. */
export default function StudentOverview({ items, onOpen, onDetails }) {
  const cont = continueReading(items)
  const avg = averagePct(items)
  const bookmarks = items.reduce((n, x) => n + (x.sd?.bookmarks?.length || 0), 0)
  const results = items
    .flatMap((x) => Object.values(x.sd?.scores || {}).map((s) => ({ ...s, portal: x.portal.name })))
    .filter((s) => Number.isFinite(s.percent))
    .sort((a, b) => (Number(b.at || b.updatedAt || 0) || 0) - (Number(a.at || a.updatedAt || 0) || 0))
    .slice(0, 3)
  const recs = recommend(items, 3)
  const chapterTitle = cont ? cont.x.flat.find((f) => f.chapter.id === cont.chapterId)?.chapter.title : ''

  return (
    <section className="st-overview" aria-label="Your learning overview">
      <div className="so-grid">
        <div className="so-card so-continue">
          <small>Continue reading</small>
          {cont ? (
            <>
              <b title={cont.x.portal.name}>{cont.x.portal.name}</b>
              <span className="so-sub">{chapterTitle || 'Last chapter'}</span>
              <button type="button" className="btn ui-btn ui-btn-primary btn-sm" onClick={() => onOpen(cont.x, cont.chapterId)}>Resume <LuArrowRight /></button>
            </>
          ) : <span className="so-sub">Open any course below to begin.</span>}
        </div>
        <div className="so-card">
          <small><LuFlame aria-hidden="true" /> Overall progress</small>
          <b className="so-big">{avg}%</b>
          <div className="bar"><span style={{ width: `${avg}%` }} /></div>
        </div>
        <div className="so-card">
          <small><LuTrophy aria-hidden="true" /> Recent results</small>
          {results.length ? <ul className="so-list">{results.map((r, i) => <li key={i}><span>{r.portal}</span><b>{r.percent}%</b></li>)}</ul> : <span className="so-sub">No exams attempted yet.</span>}
        </div>
        <div className="so-card">
          <small><LuBookmark aria-hidden="true" /> Bookmarks</small>
          <b className="so-big">{bookmarks}</b>
        </div>
      </div>
      {recs.length > 0 && (
        <div className="so-recs">
          <h2 className="h6 fw-semibold mb-2">Recommended for you</h2>
          <div className="so-rec-row">
            {recs.map((x) => (
              <button type="button" key={x.portal.id} className="so-rec" onClick={() => onDetails(x)}>
                <b>{x.portal.name}</b>
                <TeacherBadge portal={x.portal} size={22} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
