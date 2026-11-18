import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LuArrowDown, LuArrowUp, LuCircleCheck, LuCircleX, LuFileText, LuImage, LuInfo, LuLoaderCircle,
  LuPlus, LuRotateCcw, LuSmartphone, LuTrash2, LuTriangleAlert, LuUpload, LuWandSparkles,
} from 'react-icons/lu'
import { Field, Section, Toggle } from '../ui/Controls'
import { ReadyBlockProps } from './ReadyBlockEditor'
import { OCR_LANGUAGES, OCR_LIMITS, readPdfPages, recognizePages, validateOcrFile } from '../../lib/pageOcr'
import { blocksToBlockData, ocrWarnings, structureOcrText } from '../../lib/notesFormatter'
import { escapeText, hasMarkup, isRichEmpty } from '../../lib/richText'
import { uid } from '../../lib/id'
import '../../styles/imageToText.css'

/* Image → Text block
 * ------------------------------------------------------------------
 * A normal "Heading & Paragraph" style block (type 'image-to-text', template 'heading-paragraph') so it is
 * rendered, edited, exported to PDF and shown to students by the EXISTING renderer. This file only adds the
 * converter panel: pick pages → read text (OCR, in the browser) → check/correct → apply to the block.
 * Page images are never uploaded or stored — only the resulting text is saved in the lesson. */

const NO_CROP = { top: 0, bottom: 0, left: 0, right: 0 }
const mkPage = (blob, name, extra = {}) => ({ id: uid('pg'), blob, name, url: URL.createObjectURL(blob), rotate: 0, crop: { ...NO_CROP }, textLayer: '', ...extra })

function Thumb({ page }) {
  const { top, right, bottom, left } = page.crop
  const odd = (page.rotate / 90) % 2 !== 0
  return (
    <div className="itt-thumb">
      <img
        src={page.url}
        alt={page.name}
        style={{ clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)`, transform: `rotate(${page.rotate}deg) scale(${odd ? 0.72 : 1})` }}
      />
    </div>
  )
}

function Msg({ m }) {
  const Icon = m.type === 'error' ? LuCircleX : m.type === 'warn' ? LuTriangleAlert : m.type === 'ok' ? LuCircleCheck : LuInfo
  return <div className={`itt-msg ${m.type}`} role={m.type === 'error' ? 'alert' : 'status'}><Icon aria-hidden="true" /><span>{m.text}</span></div>
}

export function OcrConverter({ block, setData }) {
  const d = block.data || {}
  const [pages, setPages] = useState([])
  const [msgs, setMsgs] = useState([])
  const [busy, setBusy] = useState('') // '' | 'loading' | 'ocr'
  const [busyText, setBusyText] = useState('')
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState(d.ocr?.rawText || '')
  const [lang, setLang] = useState(d.ocr?.lang || 'eng')
  const [layout, setLayout] = useState('auto')
  const [enhance, setEnhance] = useState(true)
  const [smart, setSmart] = useState(true)
  const [mode, setMode] = useState('replace')
  const [pdfRange, setPdfRange] = useState('')
  const [cropOpen, setCropOpen] = useState('')
  const camRef = useRef(null), galRef = useRef(null), pdfRef = useRef(null), fileRef = useRef(null), replaceRef = useRef(null)
  const replaceId = useRef('')
  const abortRef = useRef(null)
  const pagesRef = useRef(pages)
  pagesRef.current = pages

  // Free object URLs and stop any running OCR when the panel closes / another block is selected.
  useEffect(() => () => { abortRef.current?.abort(); pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)) }, [])

  const busyNow = !!busy
  const patchPage = (id, p) => setPages((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const movePage = (id, dir) => setPages((list) => { const i = list.findIndex((x) => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= list.length) return list; const n = list.slice();[n[i], n[j]] = [n[j], n[i]]; return n })
  const removePage = (id) => setPages((list) => { const p = list.find((x) => x.id === id); if (p) URL.revokeObjectURL(p.url); return list.filter((x) => x.id !== id) })
  const rotate = (id, dir) => setPages((list) => list.map((x) => (x.id === id ? { ...x, rotate: (x.rotate + dir + 360) % 360, textLayer: '' } : x)))
  const setCrop = (id, k, v) => setPages((list) => list.map((x) => (x.id === id ? { ...x, crop: { ...x.crop, [k]: Number(v) }, textLayer: '' } : x)))

  /* ---------- add pages (camera / gallery / pdf / file picker) ---------- */
  const addFiles = useCallback(async (fileList) => {
    const files = [...(fileList || [])]
    if (!files.length || busyNow) return
    setMsgs([]); setBusy('loading')
    const problems = []; const added = []
    try {
      for (const f of files) {
        const err = validateOcrFile(f)
        if (err) { problems.push({ type: 'error', text: err }); continue }
        if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
          try {
            setBusyText(`Reading ${f.name}…`)
            const r = await readPdfPages(f, pdfRange, (n, t) => setBusyText(`Reading PDF page ${n} of ${t}…`))
            r.pages.forEach((p) => added.push(mkPage(p.blob, `${f.name} · page ${p.pdfPage}`, { textLayer: p.textLayer })))
            if (r.truncated) problems.push({ type: 'warn', text: `${f.name}: only the first ${OCR_LIMITS.maxPages} pages were added.` })
          } catch (e) { problems.push({ type: 'error', text: e.message }) }
        } else added.push(mkPage(f, f.name || 'Photo'))
      }
    } finally { setBusy(''); setBusyText('') }
    const room = Math.max(0, OCR_LIMITS.maxPages - pagesRef.current.length)
    if (added.length > room) {
      added.slice(room).forEach((p) => URL.revokeObjectURL(p.url))
      problems.push({ type: 'warn', text: `A maximum of ${OCR_LIMITS.maxPages} pages can be converted at once. Extra pages were not added.` })
    }
    setPages((list) => [...list, ...added.slice(0, room)])
    if (added.length && !problems.length) setMsgs([{ type: 'ok', text: `${Math.min(added.length, room)} page${added.length === 1 ? '' : 's'} added.` }])
    else setMsgs(problems)
  }, [busyNow, pdfRange])

  const onPick = (e) => { addFiles(e.target.files); e.target.value = '' }
  const onReplace = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    const id = replaceId.current
    if (!f || !id) return
    const err = validateOcrFile(f, { allowPdf: false })
    if (err) { setMsgs([{ type: 'error', text: err }]); return }
    setPages((list) => list.map((x) => { if (x.id !== id) return x; URL.revokeObjectURL(x.url); const n = mkPage(f, f.name || 'Photo'); return { ...n, id: x.id } }))
  }
  const askReplace = (id) => { replaceId.current = id; replaceRef.current?.click() }

  /* ---------- read text (OCR) ---------- */
  const extract = async () => {
    if (busyNow || !pages.length) return
    const ctrl = new AbortController(); abortRef.current = ctrl
    setBusy('ocr'); setMsgs([]); setProgress(0); setBusyText('Starting…')
    try {
      const { results } = await recognizePages(
        pages.map((p) => ({ id: p.id, blob: p.blob, rotate: p.rotate, crop: p.crop, enhance, textLayer: p.textLayer })),
        { lang, layout, signal: ctrl.signal, onProgress: ({ index, total, status, fraction }) => { setBusyText(`${status} — page ${Math.min(index + 1, total)} of ${total}`); setProgress(Math.min(100, ((index + (fraction || 0)) / total) * 100)) } },
      )
      const out = []; const notes = []; const confs = []
      results.forEach((r, i) => {
        if (r.error) { notes.push({ type: 'error', text: `Page ${i + 1}: ${r.error}` }); return }
        ocrWarnings({ text: r.text, confidence: r.confidence, pageNo: pages.length > 1 ? i + 1 : 0 }).forEach((w) => notes.push({ type: 'warn', text: w }))
        if (r.text.trim()) { out.push(r.text.trim()); if (typeof r.confidence === 'number') confs.push(r.confidence) }
      })
      if (!out.length) { setMsgs(notes.length ? notes : [{ type: 'error', text: 'No readable text was found. Your pages are still here — try a sharper, brighter, straight-on photo or crop closer to the text.' }]); return }
      const joined = out.join('\n\n')
      const avg = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null
      setText(mode === 'append' && text.trim() ? `${text.trim()}\n\n${joined}` : joined)
      setData({ ocr: { rawText: joined, lang, pages: pages.length, confidence: avg, at: Date.now() } }) // original OCR text is kept separately
      setMsgs([{ type: 'ok', text: `Text read from ${out.length} of ${pages.length} page${pages.length === 1 ? '' : 's'}${avg !== null ? ` (confidence ${avg}%)` : ''}. Check and correct it below, then apply it to the block.` }, ...notes])
    } catch (e) {
      if (e.cancelled) setMsgs([{ type: 'info', text: 'Cancelled. Your pages and text are unchanged.' }])
      else setMsgs([{ type: 'error', text: `${e.message || 'Reading the text failed.'} Your pages are still here — press “Read text” to try again.` }])
    } finally { setBusy(''); setBusyText(''); abortRef.current = null }
  }
  const cancel = () => abortRef.current?.abort()

  /* ---------- apply the (corrected) text to the lesson block ---------- */
  const apply = () => {
    if (!text.trim()) { setMsgs([{ type: 'error', text: 'There is no text to apply. Read a page first or type the text above.' }]); return }
    const blocks = smart ? structureOcrText(text) : text.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map((t) => ({ kind: 'paragraph', text: t.replace(/\s*\n\s*/g, ' ') }))
    const hasHeading = !isRichEmpty(d.heading)
    const hasBody = !isRichEmpty(d.body)
    if (mode === 'replace' && (hasHeading || hasBody) && !window.confirm('Replace the heading and text currently in this block?')) return
    if (mode === 'append') {
      const out = blocksToBlockData(blocks, { useFirstHeading: smart && !hasHeading })
      const old = hasBody ? (hasMarkup(d.body) ? d.body : `<p>${escapeText(d.body)}</p>`) : ''
      setData({ heading: hasHeading ? d.heading : out.heading, body: old + out.body })
    } else {
      const out = blocksToBlockData(blocks, { useFirstHeading: smart })
      setData({ heading: out.heading, body: out.body })
    }
    setMsgs([{ type: 'ok', text: 'Applied to the block. You can still edit it directly on the page, then press “Save Block”.' }])
  }

  const words = (text.match(/\S+/g) || []).length
  const pct = Math.round(progress)

  return (
    <>
      <Section title="1 · Add book pages">
        <div className="itt-pick">
          <button type="button" className="itt-pick-btn" disabled={busyNow} onClick={() => camRef.current?.click()}><LuSmartphone /><b>Take Photo</b><small>Use the camera</small></button>
          <button type="button" className="itt-pick-btn" disabled={busyNow} onClick={() => galRef.current?.click()}><LuImage /><b>Gallery</b><small>One or many images</small></button>
          <button type="button" className="itt-pick-btn" disabled={busyNow} onClick={() => pdfRef.current?.click()}><LuFileText /><b>PDF</b><small>Multi-page PDF</small></button>
          <button type="button" className="itt-pick-btn" disabled={busyNow} onClick={() => fileRef.current?.click()}><LuUpload /><b>Choose File</b><small>Image or PDF</small></button>
        </div>
        <input ref={camRef} hidden type="file" accept="image/*" capture="environment" onChange={onPick} />
        <input ref={galRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onPick} />
        <input ref={pdfRef} hidden type="file" accept="application/pdf" onChange={onPick} />
        <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={onPick} />
        <input ref={replaceRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/*" onChange={onReplace} />
        <Field label="PDF pages (optional)" hint="Leave empty for all pages, or type e.g. 1-3, 5. Set it before choosing the PDF.">
          <input className="ui-input" value={pdfRange} placeholder="All pages" inputMode="text" disabled={busyNow} onChange={(e) => setPdfRange(e.target.value)} />
        </Field>
        <p className="ui-hint">JPG, PNG or WEBP up to {OCR_LIMITS.maxImageMB} MB · PDF up to {OCR_LIMITS.maxPdfMB} MB · {OCR_LIMITS.maxPages} pages at most. Photos stay in your browser and are not uploaded or saved.</p>
        {busy === 'loading' && <div className="itt-msg info" role="status"><LuLoaderCircle className="itt-spin" /><span>{busyText || 'Loading…'}</span></div>}
      </Section>

      {pages.length > 0 && (
        <Section title={`2 · Pages (${pages.length})`}>
          <ol className="itt-pages">
            {pages.map((p, i) => (
              <li key={p.id} className="itt-page">
                <span className="itt-page-no">{i + 1}</span>
                <Thumb page={p} />
                <div className="itt-page-main">
                  <b title={p.name}>{p.name}</b>
                  <div className="itt-page-actions">
                    <button type="button" className="icon-mini" title="Rotate left" aria-label={`Rotate page ${i + 1} left`} disabled={busyNow} onClick={() => rotate(p.id, -90)}><LuRotateCcw /></button>
                    <button type="button" className="icon-mini" title="Rotate right" aria-label={`Rotate page ${i + 1} right`} disabled={busyNow} onClick={() => rotate(p.id, 90)}><LuRotateCcw style={{ transform: 'scaleX(-1)' }} /></button>
                    <button type="button" className="icon-mini" title="Move up" aria-label={`Move page ${i + 1} up`} disabled={busyNow || i === 0} onClick={() => movePage(p.id, -1)}><LuArrowUp /></button>
                    <button type="button" className="icon-mini" title="Move down" aria-label={`Move page ${i + 1} down`} disabled={busyNow || i === pages.length - 1} onClick={() => movePage(p.id, 1)}><LuArrowDown /></button>
                    <button type="button" className="icon-mini" title="Retake / replace this page" aria-label={`Replace page ${i + 1}`} disabled={busyNow} onClick={() => askReplace(p.id)}><LuUpload /></button>
                    <button type="button" className="icon-mini danger" title="Remove page" aria-label={`Remove page ${i + 1}`} disabled={busyNow} onClick={() => removePage(p.id)}><LuTrash2 /></button>
                  </div>
                  <button type="button" className="itt-link" onClick={() => setCropOpen(cropOpen === p.id ? '' : p.id)}>{cropOpen === p.id ? 'Close crop' : 'Crop'}</button>
                  {p.textLayer && <span className="itt-chip" title="This PDF page has real text, so it is read directly (more accurate than OCR).">PDF text</span>}
                  {cropOpen === p.id && (
                    <div className="itt-crop">
                      {['top', 'bottom', 'left', 'right'].map((k) => (
                        <label key={k}><span>{k[0].toUpperCase() + k.slice(1)} {p.crop[k]}%</span><input type="range" min="0" max="40" step="1" value={p.crop[k]} onChange={(e) => setCrop(p.id, k, e.target.value)} /></label>
                      ))}
                      <button type="button" className="itt-link" onClick={() => patchPage(p.id, { crop: { ...NO_CROP } })}>Reset crop</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn ui-btn ui-btn-secondary w-100" disabled={busyNow || pages.length >= OCR_LIMITS.maxPages} onClick={() => galRef.current?.click()}><LuPlus /> Add more pages</button>
        </Section>
      )}

      <Section title="3 · Read the text">
        <Field label="Language of the book page">
          <select className="ui-input ui-select" value={lang} disabled={busyNow} onChange={(e) => setLang(e.target.value)}>{OCR_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
        </Field>
        {lang !== 'eng' && <p className="ui-hint">Odia reading downloads a language file the first time and is less exact than English. Always check the result.</p>}
        <Field label="Page layout">
          <select className="ui-input ui-select" value={layout} disabled={busyNow} onChange={(e) => setLayout(e.target.value)}>
            <option value="auto">Automatic (handles columns)</option>
            <option value="single">Single block of text</option>
          </select>
        </Field>
        <div className="prop-row"><span>Brighten &amp; sharpen photo</span><Toggle checked={enhance} onChange={setEnhance} small /></div>
        <div className="prop-row"><span>Add to existing text</span><Toggle checked={mode === 'append'} onChange={(v) => setMode(v ? 'append' : 'replace')} small /></div>
        {busy === 'ocr' ? (
          <div className="itt-run">
            <div className="itt-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
            <div className="itt-run-row"><span><LuLoaderCircle className="itt-spin" /> {busyText}</span><button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={cancel}>Cancel</button></div>
          </div>
        ) : (
          <button type="button" className="btn ui-btn ui-btn-primary w-100 itt-big" disabled={busyNow || !pages.length} onClick={extract}><LuWandSparkles /> Read text from {pages.length || 'the'} page{pages.length === 1 ? '' : 's'}</button>
        )}
        {msgs.map((m, i) => <Msg key={i} m={m} />)}
      </Section>

      <Section title="4 · Check &amp; apply">
        <Field label={`Extracted text${words ? ` · ${words} words` : ''}`} hint="Fix any reading mistakes here. Headings, lists and tables are detected from the layout.">
          <textarea className="ui-input ui-textarea itt-text" rows={10} value={text} placeholder="The text read from your pages appears here. You can also type or paste text." onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="prop-row"><span>Detect headings, lists &amp; tables</span><Toggle checked={smart} onChange={setSmart} small /></div>
        <div className="itt-apply-row">
          <button type="button" className="btn ui-btn ui-btn-primary flex-grow-1" disabled={!text.trim()} onClick={apply}><LuCircleCheck /> Apply to block</button>
          <button type="button" className="btn ui-btn ui-btn-secondary" disabled={!d.ocr?.rawText || text === d.ocr.rawText} title="Put back the text exactly as it was read from the pages" onClick={() => setText(d.ocr.rawText)}>Original</button>
        </div>
        <p className="ui-hint">Nothing is summarised, translated or invented — every line that was read is kept, in reading order.</p>
      </Section>
    </>
  )
}

export function OcrProps(props) {
  return (
    <div className="itt-wrap">
      <div className="ready-props-title"><b title="Image to Text">Image to Text</b><span className="pill pill-info pill-xs">New block</span></div>
      <OcrConverter key={props.block.id} block={props.block} setData={props.setData} />
      <ReadyBlockProps {...props} />
    </div>
  )
}
