import { describeSeries, shortDay } from '../../lib/activity'

const W = 640
const H = 230
const P = { l: 34, r: 12, t: 14, b: 28 }

/** Dependency-free SVG chart (no chart library → nothing extra to download). Bars = active students, line = new enrolments.
 *  Colours come from CSS variables so it follows the light / dark theme. Includes a text alternative + data table. */
export default function ActivityChart({ data }) {
  const { series } = data
  const max = Math.max(4, ...series.map((r) => Math.max(r.active, r.enrolments)))
  const niceMax = max <= 8 ? max : Math.ceil(max / 4) * 4
  const iw = W - P.l - P.r
  const ih = H - P.t - P.b
  const step = iw / series.length
  const bw = Math.max(4, Math.min(28, step * 0.55))
  const y = (v) => P.t + ih - (v / niceMax) * ih
  const x = (i) => P.l + step * i + step / 2
  const ticks = [0, 0.5, 1].map((t) => Math.round(niceMax * t))
  const every = series.length > 14 ? 5 : 1
  const line = series.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(r.enrolments).toFixed(1)}`).join('')
  return (
    <figure className="act-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describeSeries(data)} preserveAspectRatio="xMidYMid meet">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="act-grid" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="act-axis">{t}</text>
          </g>
        ))}
        {series.map((r, i) => (
          <g key={r.day}>
            <rect x={x(i) - bw / 2} y={y(r.active)} width={bw} height={Math.max(0, P.t + ih - y(r.active))} rx="3" className="act-bar"><title>{`${r.day}: ${r.active} active`}</title></rect>
            {i % every === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" className="act-axis">{shortDay(r.day)}</text>}
          </g>
        ))}
        <path d={line} fill="none" className="act-line" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((r, i) => <circle key={r.day} cx={x(i)} cy={y(r.enrolments)} r="3.2" className="act-dot"><title>{`${r.day}: ${r.enrolments} new enrolments`}</title></circle>)}
      </svg>
      <figcaption className="act-legend"><span><i className="lg-bar" /> Students active</span><span><i className="lg-line" /> New enrolments</span></figcaption>
      <table className="visually-hidden">
        <caption>Daily activity</caption>
        <thead><tr><th>Day</th><th>Active students</th><th>New enrolments</th><th>Completions</th></tr></thead>
        <tbody>{series.map((r) => <tr key={r.day}><td>{r.day}</td><td>{r.active}</td><td>{r.enrolments}</td><td>{r.completions}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
