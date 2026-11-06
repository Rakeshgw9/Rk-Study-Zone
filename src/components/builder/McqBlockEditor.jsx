import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { LuCircleAlert, LuCircleCheck, LuCopy, LuDownload, LuEraser, LuEye, LuPlus, LuSave, LuSquarePen, LuTrash2, LuUpload, LuWandSparkles } from 'react-icons/lu'
import { downloadText, readFileText, uid } from '../../lib/id'
import { DEFAULT_MCQ_DISPLAY, DEFAULT_MCQ_RESULT, DEFAULT_MCQ_SETTINGS, MCQ_JSON_HELP, exportMcqJson, parseMcqJson, validateQuestions } from '../../lib/mcq'
import McqPlayer from '../mcq/McqPlayer'
import { Field, NumberField, Section, Tabs, Toggle } from '../ui/Controls'
import { useConfirm } from '../ui/Confirm'
import { useToast } from '../Toast'
import { EditorFallback } from './HtmlBlockEditor'

const CodeEditor = lazy(() => import('../ui/CodeEditor'))
const L = 'ABCDEFGH'
const blankQ = () => ({ id: uid('q'), question: '', options: ['', '', '', ''], answer: -1, explanation: '' })

export function McqCenter({ block, setData, ui, setUi }) {
  const d = block.data
  const qs = d.questions
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef(null)
  const mode = ui.mcqMode || 'preview'
  const sel = Math.min(ui.mcqSel ?? 0, Math.max(0, qs.length - 1))
  const [jsonText, setJsonText] = useState(() => exportMcqJson(block))
  const [check, setCheck] = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [extracting, setExtracting] = useState(false)
  const [ocrText, setOcrText] = useState('')
  useEffect(() => { if (mode === 'json') { try { const parsed = parseMcqJson(jsonText); setCheck(parsed) } catch { setCheck(null) } } }, [jsonText, mode])

  const setQs = (next) => setData({ questions: next })
  const updQ = (i, patch) => setQs(qs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addQ = () => { setQs([...qs, blankQ()]); setUi({ mcqSel: qs.length, mcqMode: 'manual' }) }
  const dupQ = (i) => { const n = [...qs]; n.splice(i + 1, 0, { ...qs[i], id: uid('q') }); setQs(n); setUi({ mcqSel: i + 1 }) }
  const delQ = async (i) => { if (await confirm({ title: 'Delete question?', message: `Question ${i + 1} will be removed.`, danger: true, confirmText: 'Delete' })) { setQs(qs.filter((_, j) => j !== i)); setUi({ mcqSel: Math.max(0, i - 1) }) } }

  const applyJson = (text, how = 'replace') => {
    const r = parseMcqJson(text); setCheck(r)
    if (!r.ok) return false
    setData({ questions: how === 'append' ? [...qs, ...r.data.questions] : r.data.questions, ...(r.data.title && how === 'replace' ? { title: r.data.title } : {}), ...(r.data.description && how === 'replace' ? { description: r.data.description } : {}) })
    toast(`${r.data.questions.length} questions ${how === 'append' ? 'added' : 'loaded'}`); return true
  }
  const onFile = async (f) => {
    if (!f) return
    if (f.type === 'application/pdf' || f.type.startsWith('image/')) {
      setExtracting(true)
      try {
        const { extractMcqText } = await import('../../lib/ocr')
        const text = await extractMcqText(f); setOcrText(text)
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
        const extracted = []
        let current = null
        const flush = () => { if (current?.question) extracted.push({ id: uid('q'), question: current.question.trim(), options: current.options.length >= 2 ? current.options : ['', '', '', ''], answer: current.answer, explanation: current.explanation || '' }) }
        for (const line of lines) {
          const qMatch = line.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3})[.)]\s*(.*)$/i)
          const optMatch = line.match(/^(?:\(?([A-H])\)?[.)]?|([A-H])[):.-])\s+(.*)$/i)
          const ansMatch = line.match(/^(?:correct\s+)?answer\s*[:.-]?\s*([A-H]|[1-8])\b/i)
          if (qMatch) { flush(); current = { question: qMatch[2] || '', options: [], answer: -1, explanation: '' }; continue }
          if (!current) current = { question: line, options: [], answer: -1, explanation: '' }
          else if (optMatch) current.options.push(optMatch[3] || '')
          else if (ansMatch) { const a = ansMatch[1].toUpperCase(); current.answer = /^[A-H]$/.test(a) ? a.charCodeAt(0) - 65 : Number(a) - 1 }
          else if (!current.options.length) current.question += ` ${line}`
          else current.options[current.options.length - 1] += ` ${line}`
        }
        flush()
        if (!extracted.length && text.trim()) extracted.push({ id: uid('q'), question: text.trim(), options: ['', '', '', ''], answer: -1, explanation: '' })
        const draft = { title: 'Extracted MCQs', description: 'Review OCR-extracted questions, options and answers before saving.', questions: extracted }
        if (draft.questions.length) { setData({ questions: draft.questions, title: draft.title, description: draft.description }); setUi({ mcqMode: 'manual', mcqSel: 0 }); toast(`Extracted ${draft.questions.length} question candidates. Review every question, option and correct answer before saving.`) }
        else toast('Text was extracted, but question numbering was not recognized. Use the extracted source text below and add questions manually.', 'error')
      } catch (e) { toast(e.message || 'Could not extract text from this file.', 'error') }
      finally { setExtracting(false) }
      return
    }
    if (f.size > 500 * 1024) return toast('JSON file must be under 500 KB', 'error')
    const t = await readFileText(f); setJsonText(t); if (applyJson(t)) setUi({ mcqMode: 'preview' }); else setUi({ mcqMode: 'json' })
  }
  const validate = () => {
    if (mode === 'json') { const r = parseMcqJson(jsonText); setCheck(r); return }
    const errs = validateQuestions(qs); setCheck({ ok: !errs.length, errors: errs })
  }
  const q = qs[sel]

  return (
    <div className="editor-stack">
      <div className="ed-card">
        <div className="ed-card-head flex-wrap">
          <Tabs value={mode} onChange={(v) => { if (v === 'json') setJsonText(exportMcqJson(block)); setCheck(null); setUi({ mcqMode: v }) }} size="sm" items={[
            { value: 'preview', label: 'Live Preview' }, { value: 'manual', label: 'Manual Editor' }, { value: 'json', label: 'JSON Input' }, { value: 'upload', label: 'Upload JSON' }]} />
          <span className="pill pill-info">Questions: {qs.length}</span>
        </div>
        <div className="mcq-ed-grid">
          <div className="mcq-ed-main">
            {mode === 'preview' && <div className="light-canvas p-2 p-md-3 rounded-3"><McqPlayer key={previewKey} data={d} mode="preview" autoStart /></div>}
            {mode === 'manual' && (q ? (
              <div className="q-editor">
                <Field label={`Question ${sel + 1}`} required><textarea className="ui-input ui-textarea" rows={3} value={q.question} onChange={(e) => updQ(sel, { question: e.target.value })} placeholder="Type the question…" /></Field>
                <div className="ui-label mb-1">Options <span className="text-soft small">(select the correct answer)</span></div>
                {q.options.map((o, oi) => (
                  <div key={oi} className={`opt-row ${q.answer === oi ? 'right' : ''}`}>
                    <button type="button" className="opt-radio" onClick={() => updQ(sel, { answer: oi })} aria-label={`Mark option ${L[oi]} correct`} aria-pressed={q.answer === oi}>{q.answer === oi ? <LuCircleCheck /> : L[oi]}</button>
                    <input className="ui-input" value={o} placeholder={`Option ${L[oi]}`} onChange={(e) => updQ(sel, { options: q.options.map((x, j) => (j === oi ? e.target.value : x)) })} />
                    <button type="button" className="icon-mini danger" disabled={q.options.length <= 2} onClick={() => updQ(sel, { options: q.options.filter((_, j) => j !== oi), answer: q.answer === oi ? -1 : q.answer > oi ? q.answer - 1 : q.answer })} aria-label="Remove option"><LuTrash2 /></button>
                  </div>
                ))}
                {q.options.length < 8 && <button type="button" className="btn ui-btn ui-btn-ghost btn-sm mb-3" onClick={() => updQ(sel, { options: [...q.options, ''] })}><LuPlus /> Add option</button>}
                <Field label="Explanation / Solution"><textarea className="ui-input ui-textarea" rows={2} value={q.explanation} onChange={(e) => updQ(sel, { explanation: e.target.value })} placeholder="Shown after submit (optional)" /></Field>
              </div>
            ) : <div className="text-center text-soft p-4">No questions yet. <button className="btn ui-btn ui-btn-primary btn-sm ms-2" onClick={addQ}><LuPlus /> Add question</button></div>)}
            {mode === 'json' && (
              <>
                <Suspense fallback={<EditorFallback />}><CodeEditor lang="json" value={jsonText} onChange={(v) => { setJsonText(v); setCheck(null) }} height="320px" ariaLabel="MCQ JSON" /></Suspense>
                <div className="d-flex gap-2 flex-wrap mt-2">
                  <button className="btn ui-btn ui-btn-primary" onClick={() => applyJson(jsonText, 'replace')}><LuCircleCheck /> Apply (Replace)</button>
                  <button className="btn ui-btn ui-btn-secondary" onClick={() => applyJson(jsonText, 'append')}><LuPlus /> Append</button>
                </div>
                <details className="mt-2"><summary className="small text-soft">JSON format</summary><pre className="json-help">{MCQ_JSON_HELP}</pre></details>
              </>
            )}
            {mode === 'upload' && (
              <div className="drop-zone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }} role="button" tabIndex={0}>
                <LuUpload className="fs-2" /><strong>{extracting ? 'Extracting text…' : 'Drop MCQ JSON, PDF or image here, or click to browse'}</strong><span className="small text-soft">JSON imports directly. PDF/images use OCR; extracted questions must be reviewed.</span>
              </div>
            )}
            {ocrText && mode === 'manual' && <details className="mt-2"><summary className="small text-soft">View extracted source text</summary><pre className="json-help">{ocrText}</pre></details>}
            {check && (
              <div className={`json-check ${check.ok ? 'ok' : 'bad'}`} role="status">
                {check.ok ? <><LuCircleCheck /> All questions are valid.</> : <><LuCircleAlert /><ul>{check.errors.slice(0, 8).map((e, i) => <li key={i}>{typeof e === 'string' ? e : e.message}</li>)}</ul></>}
              </div>
            )}
          </div>
          <div className="mcq-ed-list">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="ui-label">Questions</span>
              <button className="btn ui-btn ui-btn-primary btn-sm" onClick={addQ}><LuPlus /> Add</button>
            </div>
            <ol className="q-list">
              {qs.map((x, i) => {
                const bad = !x.question.trim() || x.answer < 0
                return (
                  <li key={x.id} className={`${i === sel ? 'on' : ''} ${bad ? 'bad' : ''}`}>
                    <button type="button" className="q-main" onClick={() => setUi({ mcqSel: i, mcqMode: 'manual' })}><span className="n">{i + 1}</span><span className="t">{x.question || 'Untitled question'}</span></button>
                    <span className="q-acts">
                      <button className="icon-mini" onClick={() => setUi({ mcqSel: i, mcqMode: 'manual' })} aria-label="Edit"><LuSquarePen /></button>
                      <button className="icon-mini" onClick={() => dupQ(i)} aria-label="Duplicate"><LuCopy /></button>
                      <button className="icon-mini danger" onClick={() => delQ(i)} aria-label="Delete"><LuTrash2 /></button>
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
        <div className="ed-toolbar">
          <button className="btn ui-btn ui-btn-ghost" onClick={() => fileRef.current?.click()}><LuUpload /> Import JSON</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={() => downloadText(`${(d.title || 'mcq').replace(/\W+/g, '-')}.json`, exportMcqJson(block))}><LuDownload /> Export JSON</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={() => { try { setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2)); setUi({ mcqMode: 'json' }) } catch { setUi({ mcqMode: 'json' }); setCheck(parseMcqJson(jsonText)) } }}><LuWandSparkles /> Format JSON</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={validate}><LuCircleCheck /> Validate</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={async () => { if (await confirm({ title: 'Clear all questions?', message: 'All questions in this test will be removed.', danger: true, confirmText: 'Clear' })) setQs([]) }}><LuEraser /> Clear</button>
          <button className="btn ui-btn ui-btn-ghost" onClick={() => { setUi({ mcqMode: 'preview' }); setPreviewKey((k) => k + 1) }}><LuEye /> Preview</button>
          <input ref={fileRef} type="file" accept=".json,application/json,.pdf,application/pdf,image/*" hidden onChange={(e) => { onFile(e.target.files[0]); e.target.value = '' }} />
        </div>
      </div>
    </div>
  )
}

export function McqProps({ block, setBlock, setData, ui, setUi, onSave, dirty }) {
  const d = block.data
  const s = { ...DEFAULT_MCQ_SETTINGS, ...d.settings }
  const dp = { ...DEFAULT_MCQ_DISPLAY, ...d.display }
  const r = { ...DEFAULT_MCQ_RESULT, ...d.result }
  const setS = (p) => setData({ settings: { ...s, ...p } })
  const setD = (p) => setData({ display: { ...dp, ...p } })
  const setR = (p) => setData({ result: { ...r, ...p } })
  const tab = ui.mcqProps || 'content'
  const Row = ({ label, k, obj = s, set = setS }) => <div className="prop-row"><span>{label}</span><Toggle checked={obj[k]} onChange={(v) => set({ [k]: v })} small /></div>
  return (
    <div className="props">
      <Tabs value={tab} onChange={(v) => setUi({ mcqProps: v })} items={[{ value: 'content', label: 'Content' }, { value: 'style', label: 'Style' }, { value: 'advanced', label: 'Advanced' }]} className="props-tabs" />
      {tab === 'content' && <>
        <Section title="Test Information">
          <Field label="Test Title"><input className="ui-input" value={d.title} onChange={(e) => { setData({ title: e.target.value }); setBlock({ title: e.target.value || 'MCQ Test' }) }} /></Field>
          <Field label="Description"><textarea className="ui-input ui-textarea" rows={2} value={d.description} onChange={(e) => setData({ description: e.target.value })} /></Field>
        </Section>
        <Section title="Test Settings">
          <div className="row g-2 mb-2">
            <div className="col-6"><NumberField label="Total Questions" value={s.totalQuestions || d.questions.length} min={1} max={d.questions.length || 1} onChange={(v) => setS({ totalQuestions: v >= d.questions.length ? 0 : v })} /></div>
            <div className="col-6"><NumberField label="Marks / Question" value={s.marksPerQuestion} min={0.25} step={0.25} max={100} onChange={(v) => setS({ marksPerQuestion: v })} /></div>
          </div>
          {Row({ label: 'Negative Marking', k: 'negativeMarking' })}
          {s.negativeMarking && <div className="mb-2"><NumberField label="Negative marks per wrong answer" value={s.negativeValue} min={0} step={0.25} max={10} onChange={(v) => setS({ negativeValue: v })} /></div>}
          <div className="mb-2"><NumberField label="Attempt Limit (0 = unlimited)" value={s.attemptLimit} min={0} max={50} onChange={(v) => setS({ attemptLimit: v })} /></div>
          {Row({ label: 'Time Limit', k: 'timeLimitOn' })}
          {s.timeLimitOn && <div className="mb-2"><NumberField label="Minutes" value={s.timeLimit} min={1} max={300} onChange={(v) => setS({ timeLimit: v })} suffix="min" /></div>}
          {Row({ label: 'Auto Submit on time up', k: 'autoSubmit' })}
          {Row({ label: 'Show Solution After Submit', k: 'showSolution' })}
          {Row({ label: 'Randomize Questions', k: 'randomizeQuestions' })}
          {Row({ label: 'Randomize Options', k: 'randomizeOptions' })}
          {Row({ label: 'Allow Pause', k: 'allowPause' })}
        </Section>
        <Section title="Display Settings" defaultOpen={false}>
          {Row({ label: 'One question at a time', k: 'oneAtATime', obj: dp, set: setD })}
          {Row({ label: 'Progress bar', k: 'showProgressBar', obj: dp, set: setD })}
          {Row({ label: 'Show timer', k: 'showTimer', obj: dp, set: setD })}
          {Row({ label: 'Question navigator', k: 'showQuestionNav', obj: dp, set: setD })}
          {Row({ label: 'Allow skip', k: 'allowSkip', obj: dp, set: setD })}
        </Section>
        <Section title="Result & Feedback" defaultOpen={false}>
          <div className="mb-2"><NumberField label="Pass percentage" value={r.passPercent} min={0} max={100} onChange={(v) => setR({ passPercent: v })} suffix="%" /></div>
          {Row({ label: 'Show score', k: 'showScore', obj: r, set: setR })}
          {Row({ label: 'Show correct answers', k: 'showCorrectAnswers', obj: r, set: setR })}
          <Field label="Pass message"><input className="ui-input" value={r.passMessage} onChange={(e) => setR({ passMessage: e.target.value })} /></Field>
          <Field label="Fail message"><input className="ui-input" value={r.failMessage} onChange={(e) => setR({ failMessage: e.target.value })} /></Field>
        </Section>
      </>}
      {tab === 'style' && <Section title="Colors">
        <label className="ui-color"><span>Accent color</span><span className="box"><input type="color" value={dp.accent} onChange={(e) => setD({ accent: e.target.value })} /><code>{dp.accent}</code></span></label>
      </Section>}
      {tab === 'advanced' && <Section title="Other Options">
        <div className="prop-row"><span>Show in Chapter</span><Toggle checked={block.visible} onChange={(v) => setBlock({ visible: v })} small /></div>
        <Field label="Block Title (in CMS tree)"><input className="ui-input" value={block.title} onChange={(e) => setBlock({ title: e.target.value })} /></Field>
      </Section>}
      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave}><LuSave /> {dirty ? 'Save Block' : 'Saved'}</button>
    </div>
  )
}
