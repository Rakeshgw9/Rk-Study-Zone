import { LuLoaderCircle } from 'react-icons/lu'

/** Spinner (optionally with a percentage) that sits inside a button. */
export function ButtonLoader({ pct = null, label = 'Loading' }) {
  return (
    <span className="rk-btn-loader" role="status" aria-label={label}>
      <LuLoaderCircle className="spin" aria-hidden="true" />
      {Number.isFinite(pct) && <span className="rk-btn-pct">{Math.round(pct)}%</span>}
    </span>
  )
}

/** A button that shows real progress (or an indeterminate spinner) while `busy`, and is disabled meanwhile. */
export function ProgressButton({ busy = false, pct = null, busyLabel, icon = null, children, className = '', disabled, type = 'button', ...rest }) {
  const determinate = busy && Number.isFinite(pct)
  return (
    <button
      type={type}
      className={`${className} rk-progress-btn${busy ? ' is-busy' : ''}`}
      disabled={disabled || busy}
      aria-busy={busy}
      {...rest}
    >
      {determinate && <span className="rk-progress-fill" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} aria-hidden="true" />}
      <span className="rk-progress-content">
        {busy ? <ButtonLoader pct={pct} /> : icon}
        <span>{busy && busyLabel ? busyLabel : children}</span>
      </span>
    </button>
  )
}

export function InlineLoader({ label = 'Loading…' }) {
  return (
    <span className="rk-inline-loader" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" /> {label}
    </span>
  )
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="spinner-border text-info" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  )
}

/** Upload / long task progress bar with a text alternative. */
export function UploadProgress({ pct = null, label = 'Uploading', sub = '' }) {
  const determinate = Number.isFinite(pct)
  return (
    <div className="rk-upload-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate ? Math.round(pct) : undefined}>
      <div className="rk-upload-row"><span>{label}{sub ? ` · ${sub}` : ''}</span>{determinate && <strong>{Math.round(pct)}%</strong>}</div>
      <div className="rk-upload-track"><div className={`rk-upload-bar${determinate ? '' : ' indeterminate'}`} style={determinate ? { width: `${pct}%` } : undefined} /></div>
    </div>
  )
}

const Bar = ({ w = '100%', h = 12, style }) => <span className="rk-skel" style={{ width: w, height: h, ...style }} aria-hidden="true" />

export function SkeletonCard() {
  return (
    <div className="rk-skel-card" aria-hidden="true">
      <Bar h={110} style={{ borderRadius: 10 }} />
      <Bar w="70%" h={16} />
      <Bar w="45%" />
    </div>
  )
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div className="rk-skel-list" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="rk-skel-row" key={i}><Bar w={36} h={36} style={{ borderRadius: 8, flex: 'none' }} /><div style={{ flex: 1, display: 'grid', gap: 6 }}><Bar w={`${60 + ((i * 13) % 30)}%`} h={14} /><Bar w="40%" /></div></div>
      ))}
      <span className="visually-hidden">Loading…</span>
    </div>
  )
}

export function SkeletonEditor() {
  return (
    <div className="rk-skel-editor" role="status" aria-label="Loading editor">
      <Bar w="40%" h={22} />
      <Bar h={14} /><Bar w="92%" h={14} /><Bar w="84%" h={14} />
      <Bar h={220} style={{ borderRadius: 10 }} />
      <span className="visually-hidden">Loading…</span>
    </div>
  )
}
