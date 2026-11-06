import { LuPlus } from 'react-icons/lu'

export function EmptyIllustration() {
  return (
    <svg viewBox="0 0 340 190" className="empty-illus" aria-hidden="true">
      {/* leaves */}
      <g fill="#3b6fd8" opacity=".85">
        <path d="M70 150c-8-30 6-58 30-66-4 26-10 48-30 66z" />
        <path d="M58 152c-22-14-28-40-18-60 12 20 20 40 18 60z" opacity=".7" />
        <path d="M270 150c8-30-6-58-30-66 4 26 10 48 30 66z" />
        <path d="M282 152c22-14 28-40 18-60-12 20-20 40-18 60z" opacity=".7" />
      </g>
      {/* sparks */}
      <g stroke="#f5b400" strokeWidth="4" strokeLinecap="round">
        <path d="M250 10l-4 14" /><path d="M268 22l-12 8" /><path d="M272 42l-14-2" />
      </g>
      {/* laptop */}
      <rect x="92" y="36" width="156" height="110" rx="10" fill="#cfe2ff" stroke="#e8f1ff" strokeWidth="4" />
      <rect x="100" y="44" width="140" height="94" rx="4" fill="#b9d4fb" />
      <rect x="100" y="44" width="140" height="14" fill="#3b82f6" />
      <circle cx="110" cy="51" r="3" fill="#ff7a59" /><circle cx="120" cy="51" r="3" fill="#fff" /><circle cx="130" cy="51" r="3" fill="#fff" />
      <path d="M78 146h184l-10 14H88z" fill="#e8f1ff" />
      <rect x="150" y="146" width="40" height="5" rx="2" fill="#9cbcf0" />
      {/* layers icon */}
      <g fill="none" stroke="#1d6fe0" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M170 72l26 13-26 13-26-13z" />
        <path d="M144 97l26 13 26-13" />
        <path d="M144 108l26 13 26-13" />
      </g>
    </svg>
  )
}

export default function EmptyState({ onCreate }) {
  return (
    <div className="glass-panel empty-state">
      <EmptyIllustration />
      <h3>No Portal Yet</h3>
      <p>You haven&apos;t created any study portal. Create your first portal<br className="d-none d-md-inline" /> to add subjects, study materials and manage access.</p>
      <button className="btn rk-btn-primary px-4" onClick={onCreate}><LuPlus className="me-2" />Create Your First Portal</button>
    </div>
  )
}
