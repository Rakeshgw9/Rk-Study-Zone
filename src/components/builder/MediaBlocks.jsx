import { useCallback, useEffect, useRef, useState } from 'react'
import { LuArrowDown, LuArrowUp, LuChevronLeft, LuChevronRight, LuExternalLink, LuImage, LuSave, LuTrash2, LuUpload, LuCirclePlay } from 'react-icons/lu'
import { Field, NumberField, Section, Toggle } from '../ui/Controls'
import { SLIDER_DEFAULTS, YOUTUBE_DEFAULTS } from '../../lib/content'
import { DARK_STYLE } from '../../lib/blockTheme'
import { uid } from '../../lib/id'
import { uploadImage } from '../../services/storageService'

/* ---------------------------------------------------------------- helpers */
const ID_RE = /^[\w-]{11}$/

/** Accepts a full YouTube link (watch / youtu.be / embed / shorts) or a bare 11 character video id. */
export function parseYoutubeId(input = '') {
  const s = String(input).trim()
  if (!s) return ''
  if (ID_RE.test(s)) return s
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    let id = ''
    if (host === 'youtu.be') id = u.pathname.slice(1, 12)
    else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      id = u.searchParams.get('v') || (/^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname) || [])[1] || ''
    }
    return ID_RE.test(id) ? id : ''
  } catch { return '' }
}

export function youtubeEmbedUrl(id, d, preview) {
  const q = new URLSearchParams({ rel: '0', playsinline: '1', controls: d.controls === false ? '0' : '1', mute: d.mute ? '1' : '0', autoplay: !preview && d.autoplay ? '1' : '0' })
  if (d.loop) { q.set('loop', '1'); q.set('playlist', id) }
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`
}

const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '')
const blockBox = (d) => ({ background: DARK_STYLE.background, color: DARK_STYLE.textColor, border: `1px solid ${DARK_STYLE.borderColor}`, borderRadius: DARK_STYLE.borderRadius, padding: `${d.spacing?.padding ?? 24}px`, width: '100%', boxSizing: 'border-box' })
const headingStyle = { color: DARK_STYLE.headingColor, borderColor: DARK_STYLE.accentColor }
const mergedYt = (d = {}) => ({ ...YOUTUBE_DEFAULTS, ...d })
const mergedSl = (d = {}) => ({ ...SLIDER_DEFAULTS, ...d, slides: Array.isArray(d.slides) ? d.slides : [] })

/* ---------------------------------------------------------------- YouTube */
export function YoutubeView({ block, preview = false }) {
  const d = mergedYt(block.data)
  const id = parseYoutubeId(d.url)
  const frameStyle = d.aspect === 'custom' ? { height: `${Math.max(120, Number(d.height) || 360)}px` } : { aspectRatio: d.aspect || '16/9' }
  return (
    <article className="ready-block media-block yt-block" style={blockBox(d)}>
      {d.heading && <h2 style={headingStyle}>{d.heading}</h2>}
      {id ? (
        <figure className="yt-figure" style={{ width: `${Math.min(100, Math.max(30, Number(d.widthPct) || 100))}%` }}>
          <div className="yt-frame" style={frameStyle}>
            <iframe src={youtubeEmbedUrl(id, d, preview)} title={d.heading || 'YouTube video'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          {d.caption && <figcaption className="media-caption">{d.caption}</figcaption>}
        </figure>
      ) : (
        <div className="media-empty"><LuCirclePlay /><b>{d.url ? 'This YouTube link or video ID is not valid' : 'No video yet'}</b><small>Paste a YouTube link or video ID in the properties panel.</small></div>
      )}
      {d.description && <div className="yt-about"><b>About this video</b><p>{d.description}</p></div>}
    </article>
  )
}

export const YoutubeCenter = ({ block }) => <div className="ready-center"><div className="ready-preview-stage"><YoutubeView block={block} preview /></div></div>

export function YoutubeProps({ block, setBlock, setData, onSave, dirty }) {
  const d = mergedYt(block.data)
  const id = parseYoutubeId(d.url)
  return (
    <div className="ready-props">
      <div className="ready-props-title"><b title="YouTube Video">YouTube Video</b><span className="pill pill-info pill-xs">New block</span></div>
      <Section title="Video">
        <Field label="Video Heading / Title"><input className="ui-input" value={d.heading} placeholder="Enter video heading" onChange={(e) => setData({ heading: e.target.value })} /></Field>
        <Field label="YouTube Embed URL or Video ID" error={d.url && !id ? 'Enter a valid YouTube link or 11 character video ID.' : ''} hint={id ? `Video ID: ${id}` : 'Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ'}>
          <input className="ui-input" value={d.url} placeholder="Paste YouTube link or video ID" onChange={(e) => setData({ url: e.target.value })} />
        </Field>
        <Field label="Video Description (About this video)"><textarea className="ui-input ui-textarea" rows={3} value={d.description} placeholder="Write a short description about this video…" onChange={(e) => setData({ description: e.target.value })} /></Field>
        <Field label="Caption (below the video)"><input className="ui-input" value={d.caption} placeholder="Add a caption (optional)" onChange={(e) => setData({ caption: e.target.value })} /></Field>
      </Section>
      <Section title="Player Settings">
        <div className="prop-row"><span>Autoplay</span><Toggle checked={d.autoplay} onChange={(v) => setData({ autoplay: v, mute: v ? true : d.mute })} small /></div>
        {d.autoplay && <p className="ui-hint">Browsers only autoplay muted videos, so Mute is switched on. Autoplay does not run inside the builder preview.</p>}
        <div className="prop-row"><span>Play / Pause controls</span><Toggle checked={d.controls !== false} onChange={(v) => setData({ controls: v })} small /></div>
        <div className="prop-row"><span>Loop</span><Toggle checked={d.loop} onChange={(v) => setData({ loop: v })} small /></div>
        <div className="prop-row"><span>Mute</span><Toggle checked={d.mute} onChange={(v) => setData({ mute: v })} small /></div>
      </Section>
      <Section title="Video Size">
        <Field label="Aspect Ratio"><select className="ui-input ui-select" value={d.aspect} onChange={(e) => setData({ aspect: e.target.value })}><option value="16/9">16:9 (Widescreen)</option><option value="4/3">4:3</option><option value="1/1">1:1 (Square)</option><option value="21/9">21:9 (Cinema)</option><option value="custom">Custom height</option></select></Field>
        <div className="row g-2">
          <div className="col-6"><NumberField label="Width" value={d.widthPct} min={30} max={100} onChange={(v) => setData({ widthPct: v })} suffix="%" /></div>
          {d.aspect === 'custom' && <div className="col-6"><NumberField label="Height" value={d.height} min={120} max={900} onChange={(v) => setData({ height: v })} suffix="px" /></div>}
        </div>
      </Section>
      <div className="prop-row"><span>Show in Chapter</span><Toggle checked={block.visible !== false} onChange={(v) => setBlock({ visible: v })} small /></div>
      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave} disabled={!dirty}><LuSave />{dirty ? 'Save Block' : 'Saved'}</button>
    </div>
  )
}

/* ---------------------------------------------------------------- Slider */
export function SliderView({ block, preview = false }) {
  const d = mergedSl(block.data)
  const slides = d.slides.filter((s) => s.src)
  const wrap = useRef(null)
  const [w, setW] = useState(900)
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const per = d.layout === 'item' ? (w >= 900 ? 3 : w >= 560 ? 2 : 1) : 1
  const maxIdx = Math.max(0, slides.length - per)
  const cur = Math.min(idx, maxIdx)
  const go = useCallback((n) => setIdx(() => (d.loop ? (n < 0 ? maxIdx : n > maxIdx ? 0 : n) : Math.max(0, Math.min(maxIdx, n)))), [d.loop, maxIdx])
  useEffect(() => {
    if (!d.autoplay || paused || slides.length <= per) return
    const t = setInterval(() => setIdx((i) => (Math.min(i, maxIdx) >= maxIdx ? (d.loop ? 0 : maxIdx) : Math.min(i, maxIdx) + 1)), Math.max(2, Number(d.speed) || 5) * 1000)
    return () => clearInterval(t)
  }, [d.autoplay, d.speed, d.loop, paused, slides.length, per, maxIdx])
  const url = safeUrl(d.buttonUrl)
  return (
    <article className="ready-block media-block slider-block" style={blockBox(d)}>
      {d.heading && <h2 style={headingStyle}>{d.heading}</h2>}
      {slides.length === 0 ? (
        <div className="media-empty"><LuImage /><b>No images yet</b><small>Upload 4–5 or more images in the properties panel.</small></div>
      ) : (
        <div className="sl-wrap" ref={wrap} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} role="region" aria-roledescription="carousel" aria-label={d.heading || 'Image slider'}>
          <div className="sl-viewport">
            <div className="sl-track" style={{ transform: `translateX(-${(cur * 100) / per}%)` }}>
              {slides.map((s, i) => (
                <div className="sl-slide" key={s.id || i} style={{ flex: `0 0 ${100 / per}%` }} aria-hidden={i < cur || i >= cur + per} role="group" aria-label={`Slide ${i + 1} of ${slides.length}`}>
                  <figure className="sl-card" style={{ height: `${Math.max(160, Number(d.height) || 380)}px` }}>
                    <img src={s.src} alt={s.title || `Slide ${i + 1}`} style={{ objectFit: d.fit === 'contain' ? 'contain' : 'cover' }} draggable="false" />
                    {(s.title || s.caption) && <figcaption className="sl-caption">{s.title && <b>{s.title}</b>}{s.caption && <span>{s.caption}</span>}</figcaption>}
                  </figure>
                </div>
              ))}
            </div>
            {d.arrows && slides.length > per && <>
              <button type="button" className="sl-arrow prev" onClick={() => go(cur - 1)} disabled={!d.loop && cur === 0} aria-label="Previous slide"><LuChevronLeft /></button>
              <button type="button" className="sl-arrow next" onClick={() => go(cur + 1)} disabled={!d.loop && cur === maxIdx} aria-label="Next slide"><LuChevronRight /></button>
            </>}
          </div>
          {d.dots && maxIdx > 0 && <div className="sl-dots" role="tablist" aria-label="Choose slide">{Array.from({ length: maxIdx + 1 }, (_, i) => <button type="button" key={i} role="tab" aria-selected={i === cur} className={i === cur ? 'on' : ''} onClick={() => setIdx(i)} aria-label={`Go to slide ${i + 1}`} />)}</div>}
        </div>
      )}
      {d.buttonOn && d.buttonLabel && (url
        ? <a className="sl-action" href={url} target="_blank" rel="noopener noreferrer">{d.buttonLabel} <LuExternalLink /></a>
        : preview ? <span className="sl-action disabled" title="Add a valid https:// link in the properties panel">{d.buttonLabel}</span> : null)}
    </article>
  )
}

export const SliderCenter = ({ block }) => <div className="ready-center"><div className="ready-preview-stage"><SliderView block={block} preview /></div></div>

export function SliderProps({ block, setBlock, setData, onSave, dirty }) {
  const d = mergedSl(block.data)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const setSlide = (i, p) => setData({ slides: d.slides.map((s, n) => (n === i ? { ...s, ...p } : s)) })
  const move = (i, to) => { if (to < 0 || to >= d.slides.length) return; const a = [...d.slides]; const [x] = a.splice(i, 1); a.splice(to, 0, x); setData({ slides: a }) }
  const upload = async (files) => {
    const list = [...(files || [])]
    if (!list.length) return
    setBusy(true); setErr('')
    try {
      const added = []
      for (const f of list) added.push({ id: uid('sl'), src: await uploadImage(f, 'slider-image', { max: 1000, quality: 0.7 }), title: '', caption: '' })
      setData({ slides: [...d.slides, ...added] })
    } catch (e) { setErr(e.message || 'Image upload failed.') } finally { setBusy(false) }
  }
  return (
    <div className="ready-props">
      <div className="ready-props-title"><b title="Image Slider / Carousel">Image Slider / Carousel</b><span className="pill pill-info pill-xs">New block</span></div>
      <Section title="Images">
        <Field label="Block Heading (optional)"><input className="ui-input" value={d.heading} placeholder="Enter slider heading" onChange={(e) => setData({ heading: e.target.value })} /></Field>
        {d.slides.map((s, i) => (
          <div className="ready-edit-card slide-card" key={s.id || i}>
            <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
              <b>Slide {i + 1}</b>
              <span className="d-flex gap-1">
                <button type="button" className="icon-mini" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move slide up" title="Move up"><LuArrowUp /></button>
                <button type="button" className="icon-mini" disabled={i === d.slides.length - 1} onClick={() => move(i, i + 1)} aria-label="Move slide down" title="Move down"><LuArrowDown /></button>
                <button type="button" className="icon-mini danger" onClick={() => setData({ slides: d.slides.filter((_, n) => n !== i) })} aria-label="Remove slide" title="Remove"><LuTrash2 /></button>
              </span>
            </div>
            {s.src && <img className="slide-thumb" src={s.src} alt="" />}
            <Field label="Heading / Title"><input className="ui-input" value={s.title || ''} placeholder="Slide title" onChange={(e) => setSlide(i, { title: e.target.value })} /></Field>
            <Field label="Caption"><input className="ui-input" value={s.caption || ''} placeholder="Slide caption" onChange={(e) => setSlide(i, { caption: e.target.value })} /></Field>
          </div>
        ))}
        <label className="btn ui-btn ui-btn-secondary w-100">{busy ? <span className="spinner-border spinner-border-sm" /> : <LuUpload />} {busy ? 'Uploading…' : d.slides.length ? 'Add More Images' : 'Upload Images (4–5 or more)'}<input hidden type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = '' }} /></label>
        {err && <div className="ui-error mt-2">{err}</div>}
        <p className="ui-hint">Images are compressed to keep the lesson light. Very many large images can exceed the portal size limit.</p>
      </Section>
      <Section title="Slider Layout">
        <Field label="Layout"><select className="ui-input ui-select" value={d.layout} onChange={(e) => setData({ layout: e.target.value })}><option value="full">Full-width slider</option><option value="item">Item-based carousel</option></select></Field>
        <div className="row g-2">
          <div className="col-6"><NumberField label="Slide Height" value={d.height} min={160} max={800} onChange={(v) => setData({ height: v })} suffix="px" /></div>
          <div className="col-6"><Field label="Image Fit"><select className="ui-input ui-select" value={d.fit} onChange={(e) => setData({ fit: e.target.value })}><option value="cover">Cover</option><option value="contain">Contain</option></select></Field></div>
        </div>
      </Section>
      <Section title="Behaviour">
        <div className="prop-row"><span>Autoplay</span><Toggle checked={d.autoplay} onChange={(v) => setData({ autoplay: v })} small /></div>
        {d.autoplay && <Field label="Autoplay Speed"><div className="ui-chip-row">{[3, 5, 8].map((n) => <button type="button" key={n} className={`ui-chip ${Number(d.speed) === n ? 'on' : ''}`} onClick={() => setData({ speed: n })}>{n}s</button>)}</div></Field>}
        <div className="prop-row"><span>Infinite loop</span><Toggle checked={d.loop} onChange={(v) => setData({ loop: v })} small /></div>
        <div className="prop-row"><span>Previous / Next arrows</span><Toggle checked={d.arrows} onChange={(v) => setData({ arrows: v })} small /></div>
        <div className="prop-row"><span>Dot indicators</span><Toggle checked={d.dots} onChange={(v) => setData({ dots: v })} small /></div>
      </Section>
      <Section title="Action Button" defaultOpen={false}>
        <div className="prop-row"><span>Show button</span><Toggle checked={d.buttonOn} onChange={(v) => setData({ buttonOn: v })} small /></div>
        {d.buttonOn && <>
          <Field label="Button Label"><input className="ui-input" value={d.buttonLabel} placeholder="View More" onChange={(e) => setData({ buttonLabel: e.target.value })} /></Field>
          <Field label="Button Link" error={d.buttonUrl && !safeUrl(d.buttonUrl) ? 'Link must start with http:// or https://' : ''}><input className="ui-input" value={d.buttonUrl} placeholder="https://" onChange={(e) => setData({ buttonUrl: e.target.value })} /></Field>
        </>}
      </Section>
      <div className="prop-row"><span>Show in Chapter</span><Toggle checked={block.visible !== false} onChange={(v) => setBlock({ visible: v })} small /></div>
      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave} disabled={!dirty}><LuSave />{dirty ? 'Save Block' : 'Saved'}</button>
    </div>
  )
}
