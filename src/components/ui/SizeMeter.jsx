import { sizeMeter } from '../../lib/sizeMeter'
import Tooltip from './Tooltip'

/** Chapter size meter: "412 KB of 950 KB", warns at 80%, explains chunking when a chapter outgrows one document. */
export default function SizeMeter({ bytes }) {
  const m = sizeMeter(bytes)
  const help = {
    ok: 'Size of this chapter’s blocks. One database document holds up to 950 KB.',
    warn: 'Getting close to 950 KB. Bigger chapters are still saved automatically in several parts.',
    chunked: 'This chapter is bigger than one document, so it is saved transparently in several parts. Nothing to do.',
    over: 'This chapter is over the 12 MB chapter limit. Split it into more chapters.',
  }[m.level]
  return (
    <Tooltip text={help}>
      <span className={`size-meter lvl-${m.level}`} role="img" aria-label={`Chapter size ${m.label}`} tabIndex={0}>
        <span className="size-meter-bar"><span style={{ width: `${m.pct}%` }} /></span>
        <span className="size-meter-text">{m.label}</span>
      </span>
    </Tooltip>
  )
}
