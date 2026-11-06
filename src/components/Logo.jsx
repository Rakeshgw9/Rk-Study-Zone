export default function Logo({ size = 'md', className = '' }) {
  return (
    <div className={`rk-logo rk-logo-${size} ${className}`} aria-label="RK Study Zone">
      <img src="./logo.png" alt="" className="rk-logo-mark" />
      <span className="rk-logo-divider" aria-hidden="true" />
      <span className="rk-logo-text">
        RK Study <span className="rk-logo-zone">Zone</span>
      </span>
    </div>
  )
}
