/* Day-bucket helpers for the activity charts (pure).  Day docs: portalActivity/{portalId}/days/{yyyy-mm-dd} */
export const dayKey = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Oldest → newest list of day keys ending today. */
export function lastDays(n, today = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    out.push(dayKey(d))
  }
  return out
}

/** dayDocs: [{day, active, enrolments, completions}] from one or many portals → fixed-length series. */
export function buildSeries(dayDocs = [], n = 7, today = new Date()) {
  const keys = lastDays(n, today)
  const map = new Map(keys.map((k) => [k, { day: k, active: 0, enrolments: 0, completions: 0 }]))
  for (const d of dayDocs) {
    const row = map.get(d.day)
    if (!row) continue
    row.active += Number(d.active) || 0
    row.enrolments += Number(d.enrolments) || 0
    row.completions += Number(d.completions) || 0
  }
  const series = keys.map((k) => map.get(k))
  const sum = (f) => series.reduce((s, r) => s + r[f], 0)
  return { series, totals: { active: sum('active'), enrolments: sum('enrolments'), completions: sum('completions') }, empty: series.every((r) => !r.active && !r.enrolments && !r.completions) }
}

export const shortDay = (key) => { const [, m, d] = key.split('-'); return `${Number(d)}/${Number(m)}` }

/** Plain-text alternative for screen readers. */
export function describeSeries({ series, totals }, label = 'Student activity') {
  const peak = series.reduce((a, r) => (r.active > a.active ? r : a), series[0] || { active: 0, day: '' })
  return `${label} over ${series.length} days: ${totals.active} active visits, ${totals.enrolments} new enrolments${peak.active ? `, busiest day ${peak.day} with ${peak.active}` : ''}.`
}

/** Aggregates enrollment docs into per-portal teacher stats (no extra reads). */
export function portalPerformance(enrollments = []) {
  const by = {}
  for (const e of enrollments) {
    const b = (by[e.portalId] = by[e.portalId] || { students: 0, progressSum: 0, progressN: 0, scoreSum: 0, scoreN: 0, completed: 0 })
    b.students++
    if (Number.isFinite(e.progressPct)) { b.progressSum += e.progressPct; b.progressN++; if (e.progressPct >= 100) b.completed++ }
    if (Number.isFinite(e.avgScore)) { b.scoreSum += e.avgScore; b.scoreN++ }
  }
  const out = {}
  for (const [id, b] of Object.entries(by)) {
    out[id] = { students: b.students, completed: b.completed, avgProgress: b.progressN ? Math.round(b.progressSum / b.progressN) : null, avgScore: b.scoreN ? Math.round(b.scoreSum / b.scoreN) : null }
  }
  return out
}

/** Average percent of attempted exams in studentData.scores */
export function averageScore(scores = {}) {
  const list = Object.values(scores || {}).map((s) => Number(s?.percent)).filter(Number.isFinite)
  return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null
}
