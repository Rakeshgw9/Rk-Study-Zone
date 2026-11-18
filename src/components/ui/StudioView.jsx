import { LuPencil } from 'react-icons/lu'
import { IMAGE_LAYOUTS, LIST_STYLES, SECTION_SCHEMA, fmt, safeImageUrl, safeScopedCss, sectionTitle, tableCols, textStyleVars, youtubeEmbedUrl, youtubeWatchUrl } from '../../lib/jsonStudio'

/* Native (iframe-free) renderer for JSON Studio lessons. It prints the same classes studioCss() styles, so the builder artboard,
 * the student lesson page and the PDF all look identical. Every text goes through fmt() (sanitised HTML only). */
const Html = ({ as: Tag = 'div', v, className }) => (v ? <Tag className={className} dangerouslySetInnerHTML={{ __html: fmt(v) }} /> : null)
const Odia = ({ v, className = '' }) => (v ? <div className={`js-odia-text ${className}`.trim()} lang="or" dangerouslySetInnerHTML={{ __html: fmt(v) }} /> : null)

function Head({ s }) {
  return (
    <>
      <Html as="span" className="js-pill" v={s.label} />
      {s.heading ? <h3 className="js-h" dangerouslySetInnerHTML={{ __html: fmt(s.heading) }} /> : null}
      <Odia v={s.odiaHeading} className="js-odia-h" />
      <Html className="js-sub" v={s.subHeading} />
      <Odia v={s.odiaSubHeading} />
    </>
  )
}

const plain = (v) => String(v || '').replace(/<[^>]*>/g, '').trim()

/** heading_image: URL image with caption; layout top | split-left | split-right (stacks on phones). */
export function ImageBody({ s }) {
  const src = safeImageUrl(s.imageUrl)
  const layout = IMAGE_LAYOUTS.includes(s.layout) ? s.layout : 'top'
  const fig = src ? <figure className="js-media js-img"><img src={src} alt={plain(s.heading || s.caption) || 'Image'} loading="lazy" /></figure> : null
  const caps = (
    <>
      <Html className="js-caption" v={s.caption} />
      <Odia v={s.odiaCaption} />
    </>
  )
  if (layout === 'top') return <>{fig}{caps}</>
  return <div className={`js-split js-${layout}`}>{fig}<div className="js-split-text">{caps}</div></div>
}

/** heading_youtube: responsive 16:9 privacy-friendly player + optional "Watch on YouTube ↗" link. Print / PDF show the link instead of the frame. */
export function YouTubeBody({ s }) {
  const embed = youtubeEmbedUrl(s.youtubeUrl, s.controls)
  const watch = youtubeWatchUrl(s.youtubeUrl, s.controls)
  if (!embed) return null
  return (
    <>
      <div className="js-media js-yt">
        <iframe src={embed} title={plain(s.heading) || 'YouTube video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <div className="js-yt-print">▶ Video: <a href={watch}>{watch}</a></div>
      <Html className="js-caption" v={s.caption} />
      <Odia v={s.odiaCaption} />
      {s.showWatchLink !== false && <div className="js-yt-link"><a href={watch} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></div>}
    </>
  )
}

function Body({ s }) {
  if (s.type === 'heading_image') return <ImageBody s={s} />
  if (s.type === 'heading_youtube') return <YouTubeBody s={s} />
  if (s.type === 'heading_paragraph')
    return (s.paragraphs || []).map((p, k) => (
      <div className="js-pi" key={k}>
        <Html as="p" className="js-p" v={p.text} />
        <Odia v={p.odiaText} />
      </div>
    ))
  if (s.type === 'heading_list') {
    const style = LIST_STYLES.includes(s.listStyle) ? s.listStyle : 'bullet'
    return (
      <ul className={`js-list ${style}`}>
        {(s.items || []).map((it, k) => (
          <li key={k}>
            <div className="js-li-body">
              <div dangerouslySetInnerHTML={{ __html: fmt(it.text) }} />
              <Odia v={it.odiaText} />
            </div>
          </li>
        ))}
      </ul>
    )
  }
  if (s.type === 'heading_table') {
    const cols = tableCols(s)
    const pad = (r) => Array.from({ length: cols }, (_, c) => r[c] ?? '')
    return (
      <>
        <div className="js-table-scroll js-table-wrap table-responsive">
          <table className="js-table">
            {(s.headers || []).length > 0 && (
              <thead>
                <tr>{pad(s.headers).map((h, c) => <th key={c} dangerouslySetInnerHTML={{ __html: fmt(h) }} />)}</tr>
              </thead>
            )}
            <tbody>
              {(s.rows || []).map((r, ri) => (
                <tr key={ri}>{pad(r).map((c, ci) => <td key={ci} dangerouslySetInnerHTML={{ __html: fmt(c) }} />)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <Odia v={s.odiaNote} className="js-odia-note" />
      </>
    )
  }
  if (s.type === 'callout_formula')
    return (s.formulas || []).map((x, k) => (
      <div className="js-fbox" key={x.id || k}>
        <div className="js-formula" dangerouslySetInnerHTML={{ __html: fmt(x.expression) }} />
        <Html className="js-expl" v={x.explanation} />
        <Odia v={x.odiaExplain} />
      </div>
    ))
  if (s.type === 'heading_example')
    return (s.examples || []).map((x, k) => (
      <div className="js-ex-item" key={x.id || k}>
        <Html className="js-ex-title" v={x.title} />
        <div className="js-ex-body" dangerouslySetInnerHTML={{ __html: fmt(x.detail) }} />
        <Odia v={x.odiaExplain} />
      </div>
    ))
  return null
}

/** Element id of a section on the page (used by the lesson sidebar for scroll-to / scroll-spy). */
export const studioSecId = (blockId, secId) => `sec-${blockId}-${secId}`

/**
 * props: sections, theme, textStyle (normalised, from normalizeToSections)   blockId – makes element ids unique per block
 *  full – true: natural height (student page, PDF);  false: the 1000px scrollable artboard (builder preview)
 *  customCss – optional author CSS, scoped to this block   onNote({ key, title }) / noteKeys – per-section "Add note" buttons
 */
export default function StudioView({ sections, theme, textStyle, blockId = 'x', full = true, customCss = '', onNote, noteKeys = [] }) {
  const safeId = String(blockId).replace(/[^\w-]/g, '')
  const notes = !!onNote && sections.length >= 2
  return (
    <>
      {safeScopedCss(customCss) ? <style>{`[data-js-block="${safeId}"]{${safeScopedCss(customCss)}}`}</style> : null}
      <div className={`json-artboard-content${full ? ' js-full' : ''}`} data-theme={theme} data-js-block={safeId} style={textStyleVars(textStyle)}>
        {sections.map((s) => {
          const has = noteKeys.includes(s.id)
          return (
            <section key={s.id} id={studioSecId(blockId, s.id)} className={`js-sec js-${s.type.replace(/_/g, '-')}${notes ? ' js-has-note' : ''}`} data-theme={s.theme || undefined} aria-label={SECTION_SCHEMA[s.type]?.label}>
              <Head s={s} />
              <Body s={s} />
              {notes && (
                <button type="button" className={`blk-note-btn js-note-btn ${has ? 'has' : ''}`} onClick={() => onNote({ key: s.id, title: sectionTitle(s).slice(0, 90) })} title={has ? 'Edit your note' : 'Add a note'}>
                  <LuPencil /> <span>{has ? 'Note saved' : 'Add note'}</span>
                </button>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
