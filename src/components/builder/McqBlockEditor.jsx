import { Fragment, lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  LuArrowDown,
  LuArrowUp,
  LuBookmark,
  LuCheck,
  LuCircleAlert,
  LuCircleCheck,
  LuCopy,
  LuDownload,
  LuEraser,
  LuEye,
  LuGripVertical,
  LuImage,
  LuLightbulb,
  LuMaximize2,
  LuMinimize2,
  LuPlus,
  LuRotateCcw,
  LuSave,
  LuSearch,
  LuSquarePen,
  LuTrash2,
  LuUpload,
  LuWandSparkles,
  LuX,
} from 'react-icons/lu'
import { downloadText, readFileText, uid } from '../../lib/id'
import {
  DEFAULT_MCQ_DISPLAY,
  DEFAULT_MCQ_EXAM,
  DEFAULT_MCQ_RESULT,
  DEFAULT_MCQ_SETTINGS,
  DIFFICULTIES,
  MCQ_JSON_HELP,
  MCQ_TEMPLATES,
  QUESTION_TYPES,
  blankQuestion,
  exportMcqJson,
  normalizeQuestion,
  parseMcqJson,
  validateQuestions,
} from '../../lib/mcq'
import { uploadImage } from '../../services/storageService'
import McqPlayer from '../mcq/McqPlayer'
import { Field, NumberField, Section, Tabs, Toggle } from '../ui/Controls'
import { useConfirm } from '../ui/Confirm'
import { RichEditable, RichField } from '../ui/RichText'
import { useToast } from '../Toast'
import { EditorFallback } from './HtmlBlockEditor'

const CodeEditor = lazy(() => import('../ui/CodeEditor'))
const L = 'ABCDEFGH'
const MCQ_KEYS = [
  'title',
  'description',
  'questions',
  'question',
  'options',
  'answer',
  'answers',
  'type',
  'explanation',
  'optionExplanations',
  'explanations',
  'hint',
  'image',
  'difficulty',
  'marks',
  'negative',
  'subject',
]

/**
 * Three-Panel MCQ Builder Center Workspace (Change 7)
 * - Top Live Preview with collapse/expand and full-width toggle.
 * - Below Live Preview:
 *   1. Left Panel: Searchable Question List with numbers, reordering, duplicate, delete.
 *   2. Center Panel: Question Editor (Type, Question, Options, Solution).
 *   3. Right Panel: Individual Question Settings (Marks, Negative, Difficulty, Topic, Hint, Image).
 * - Bottom Action Bar: Validate, Clear, Cancel, Save Question.
 */
export function McqCenter({ block, setData, ui, setUi }) {
  const d = block.data
  const qs = (d.questions || []).map(normalizeQuestion)
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef(null)

  const mode = ui.mcqMode || 'manual'
  const sel = Math.min(ui.mcqSel ?? 0, Math.max(0, qs.length - 1))
  const [jsonText, setJsonText] = useState(() => exportMcqJson(block))
  const [check, setCheck] = useState(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [extracting, setExtracting] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [dragFrom, setDragFrom] = useState(null)
  const [qSearch, setQSearch] = useState('')

  // Live preview controls
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [previewFull, setPreviewFull] = useState(false)

  // Current working question draft for cancel/revert
  const [draftQ, setDraftQ] = useState(null)

  useEffect(() => {
    if (qs[sel]) {
      setDraftQ(JSON.parse(JSON.stringify(qs[sel])))
    }
  }, [sel, qs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === 'json') {
      try {
        const parsed = parseMcqJson(jsonText)
        setCheck(parsed)
      } catch {
        setCheck(null)
      }
    }
  }, [jsonText, mode])

  const setQs = (next) => {
    setData({ questions: next })
    setPreviewKey((k) => k + 1)
  }

  const [expOpen, setExpOpen] = useState({}) // which option explanations are expanded (key: questionId:optionIndex)

  const updQ = (i, patch) => {
    const next = qs.map((x, j) => (j === i ? { ...x, ...patch } : x))
    setDraftQ((prev) => (prev ? { ...prev, ...patch } : prev))
    setQs(next)
  }

  const addQ = () => {
    const fresh = blankQuestion()
    const next = [...qs, fresh]
    setQs(next)
    setUi({ mcqSel: qs.length, mcqMode: 'manual' })
    setDraftQ(fresh)
    toast('New question added')
  }

  const dupQ = (i) => {
    const n = [...qs]
    const cloned = { ...qs[i], id: uid('q') }
    n.splice(i + 1, 0, cloned)
    setQs(n)
    setUi({ mcqSel: i + 1, mcqMode: 'manual' })
    toast(`Question ${i + 1} duplicated`)
  }

  const delQ = async (i) => {
    if (
      await confirm({
        title: 'Delete question?',
        message: `Question ${i + 1} will be removed.`,
        danger: true,
        confirmText: 'Delete',
      })
    ) {
      const next = qs.filter((_, j) => j !== i)
      setQs(next)
      setUi({ mcqSel: Math.max(0, i - 1) })
      toast('Question deleted')
    }
  }

  const moveQ = (from, to) => {
    if (to < 0 || to >= qs.length || from === to) return
    const n = [...qs]
    const [x] = n.splice(from, 1)
    n.splice(to, 0, x)
    setQs(n)
    setUi({ mcqSel: to })
  }

  const applyJson = (text, how = 'replace') => {
    const r = parseMcqJson(text)
    setCheck(r)
    if (!r.ok) return false
    setData({
      questions: how === 'append' ? [...qs, ...r.data.questions] : r.data.questions,
      ...(r.data.title && how === 'replace' ? { title: r.data.title } : {}),
      ...(r.data.description && how === 'replace' ? { description: r.data.description } : {}),
    })
    setPreviewKey((k) => k + 1)
    toast(`${r.data.questions.length} questions ${how === 'append' ? 'added' : 'loaded'}`)
    return true
  }

  const onFile = async (f) => {
    if (!f) return
    if (f.type === 'application/pdf' || f.type.startsWith('image/')) {
      setExtracting(true)
      try {
        const { extractMcqText } = await import('../../lib/ocr')
        const text = await extractMcqText(f)
        setOcrText(text)
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
        const extracted = []
        let current = null
        const flush = () => {
          if (current?.question)
            extracted.push(
              blankQuestion({
                question: current.question.trim(),
                options: current.options.length >= 2 ? current.options : ['', '', '', ''],
                answer: current.answer,
                explanation: current.explanation || '',
              })
            )
        }
        for (const line of lines) {
          const qMatch = line.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3})[.)]\s*(.*)$/i)
          const optMatch = line.match(/^(?:\(?([A-H])\)?[.)]?|([A-H])[):.-])\s+(.*)$/i)
          const ansMatch = line.match(/^(?:correct\s+)?answer\s*[:.-]?\s*([A-H]|[1-8])\b/i)
          if (qMatch) {
            flush()
            current = { question: qMatch[2] || '', options: [], answer: -1, explanation: '' }
            continue
          }
          if (!current) current = { question: line, options: [], answer: -1, explanation: '' }
          else if (optMatch) current.options.push(optMatch[3] || '')
          else if (ansMatch) {
            const a = ansMatch[1].toUpperCase()
            current.answer = /^[A-H]$/.test(a) ? a.charCodeAt(0) - 65 : Number(a) - 1
          } else if (!current.options.length) current.question += ` ${line}`
          else current.options[current.options.length - 1] += ` ${line}`
        }
        flush()
        if (!extracted.length && text.trim())
          extracted.push(blankQuestion({ question: text.trim() }))

        if (extracted.length) {
          setData({ questions: extracted })
          setUi({ mcqMode: 'manual', mcqSel: 0 })
          setPreviewKey((k) => k + 1)
          toast(`Extracted ${extracted.length} question candidates.`)
        }
      } catch (e) {
        toast(e.message || 'Could not extract text.', 'error')
      } finally {
        setExtracting(false)
      }
      return
    }

    if (f.size > 500 * 1024) return toast('JSON file must be under 500 KB', 'error')
    const t = await readFileText(f)
    setJsonText(t)
    if (applyJson(t)) setUi({ mcqMode: 'manual', mcqSel: 0 })
    else setUi({ mcqMode: 'json' })
  }

  const validate = () => {
    if (mode === 'json') {
      const r = parseMcqJson(jsonText)
      setCheck(r)
      return
    }
    const errs = validateQuestions(qs)
    setCheck({ ok: !errs.length, errors: errs })
    if (!errs.length) toast('All questions are valid ✓')
    else toast(`Validation: ${errs[0]}`, 'error')
  }

  const clearCurrent = () => {
    if (!qs[sel]) return
    updQ(sel, {
      question: '',
      options: ['', '', '', ''],
      answer: -1,
      answers: [],
      explanation: '',
      hint: '',
      image: '',
    })
    toast('Question fields cleared')
  }

  const cancelEdits = () => {
    if (draftQ) {
      updQ(sel, draftQ)
      toast('Question edits reverted')
    }
  }

  const saveCurrentQuestion = () => {
    const q = qs[sel]
    if (!q) return
    const bad = !String(q.question).trim() || (q.type === 'multiple' ? !q.answers.length : q.answer < 0)
    if (bad) {
      toast('Please provide question text and mark the correct answer.', 'error')
      return
    }
    setDraftQ(JSON.parse(JSON.stringify(q)))
    setPreviewKey((k) => k + 1)
    toast(`Question ${sel + 1} saved successfully ✓`)
  }

  const exportNow = () => {
    downloadText(`${(d.title || 'mcq').replace(/\W+/g, '-')}.json`, exportMcqJson(block))
    toast('Download started')
  }

  const q = qs[sel]
  const subjects = [...new Set(qs.map((x) => x.subject).filter(Boolean))]

  const filteredQs = qs
    .map((item, idx) => ({ item, idx }))
    .filter(({ item, idx }) => {
      if (!qSearch) return true
      const text = `${idx + 1} ${item.question} ${item.subject || ''}`.toLowerCase()
      return text.includes(qSearch.toLowerCase())
    })

  const tabs = [
    { value: 'manual', label: 'Build MCQs' },
    { value: 'json', label: 'JSON Editor' },
    { value: 'upload', label: 'Import JSON' },
    { value: 'export', label: 'Export JSON' },
    { value: 'templates', label: 'Templates' },
  ]

  return (
    <div className="editor-stack mcq-builder-stack">
      {/* 1. Live Preview Section at Top */}
      <div className={`ed-card mcq-live-preview-card ${previewFull ? 'ed-fullscreen' : ''}`}>
        <div className="ed-card-head flex-wrap">
          <span className="ttl">
            <LuEye /> Live Preview{' '}
            <span className="pill pill-info ms-1">Student Exam View</span>
          </span>
          <div className="d-flex gap-2 align-items-center ms-auto">
            <span className="pill pill-info">Questions: {qs.length}</span>
            <button
              type="button"
              className="btn ui-btn ui-btn-secondary btn-sm"
              onClick={() => setPreviewKey((k) => k + 1)}
            >
              <LuRotateCcw /> Restart
            </button>
            <button
              type="button"
              className="icon-mini"
              onClick={() => setPreviewFull((v) => !v)}
              title={previewFull ? 'Exit full width' : 'Full width preview'}
            >
              {previewFull ? <LuMinimize2 /> : <LuMaximize2 />}
            </button>
            <button
              type="button"
              className="icon-mini"
              onClick={() => setPreviewCollapsed((c) => !c)}
              title={previewCollapsed ? 'Expand preview' : 'Collapse preview'}
            >
              {previewCollapsed ? <LuArrowDown /> : <LuArrowUp />}
            </button>
          </div>
        </div>

        {!previewCollapsed && (
          <div className="light-canvas p-2 p-md-3 rounded-bottom">
            <McqPlayer
              key={previewKey}
              data={d}
              mode="preview"
              exam={d.exam?.enabled ? { instructions: d.exam.instructions } : null}
            />
          </div>
        )}
      </div>

      {/* 2. Top Navigation Bar for MCQ Builder */}
      <div className="ed-card mcq-main-editor-card">
        <div className="ed-card-head flex-wrap">
          <Tabs
            value={mode}
            onChange={(v) => {
              if (v === 'json') setJsonText(exportMcqJson(block))
              setCheck(null)
              setUi({ mcqMode: v })
            }}
            size="sm"
            items={tabs}
          />
          <button type="button" className="btn ui-btn ui-btn-primary btn-sm ms-auto" onClick={addQ}>
            <LuPlus /> Add Question
          </button>
        </div>

        {mode === 'manual' ? (
          /* Requirement: Three Organised Panels Below Live Preview */
          <div className="mcq-three-panel-layout">
            {/* PANEL 1: Left Searchable Question List */}
            <aside className="mcq-p1-list" aria-label="Question List">
              <div className="mcq-p1-head">
                <div className="mcq-search-box">
                  <LuSearch />
                  <input
                    className="ui-input ui-input-sm"
                    placeholder="Search questions…"
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                  />
                  {qSearch && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setQSearch('')}
                    >
                      <LuX />
                    </button>
                  )}
                </div>
                <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                  <span className="small text-soft fw-semibold">
                    Questions ({filteredQs.length})
                  </span>
                  <button
                    type="button"
                    className="btn ui-btn ui-btn-secondary btn-sm py-0 px-2"
                    onClick={addQ}
                  >
                    <LuPlus /> Add
                  </button>
                </div>
              </div>

              <div className="mcq-p1-scroll">
                <ol className="q-list">
                  {filteredQs.map(({ item: x, idx: i }) => {
                    const bad =
                      !String(x.question).trim() ||
                      (x.type === 'multiple' ? !x.answers.length : x.answer < 0)
                    const isCur = i === sel
                    return (
                      <li
                        key={x.id}
                        className={`${isCur ? 'on' : ''} ${bad ? 'bad' : ''} ${
                          dragFrom === i ? 'dragging' : ''
                        }`}
                        draggable
                        onDragStart={() => setDragFrom(i)}
                        onDragEnd={() => setDragFrom(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragFrom !== null) moveQ(dragFrom, i)
                          setDragFrom(null)
                        }}
                      >
                        <span className="q-grip" aria-hidden="true" title="Drag to reorder">
                          <LuGripVertical />
                        </span>
                        <button
                          type="button"
                          className="q-main"
                          onClick={() => setUi({ mcqSel: i, mcqMode: 'manual' })}
                        >
                          <span className="n">{i + 1}</span>
                          <span className="t">
                            {String(x.question).replace(/<[^>]*>/g, '') || 'Untitled question'}
                          </span>
                        </button>
                        <span className="q-acts">
                          <button
                            type="button"
                            className="icon-mini"
                            onClick={() => dupQ(i)}
                            title="Duplicate question"
                          >
                            <LuCopy />
                          </button>
                          <button
                            type="button"
                            className="icon-mini danger"
                            onClick={() => delQ(i)}
                            title="Delete question"
                          >
                            <LuTrash2 />
                          </button>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </aside>

            {/* PANEL 2: Centre Question Editor */}
            <main className="mcq-p2-editor" aria-label="Question Editor">
              {q ? (
                <div className="mcq-p2-content">
                  <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                    <span className="h6 mb-0 text-white fw-bold">
                      Question {sel + 1} of {qs.length}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <label className="small text-soft me-1">Type:</label>
                      <select
                        className="ui-input ui-select ui-input-sm"
                        style={{ width: 170 }}
                        value={q.type}
                        onChange={(e) => {
                          const type = e.target.value
                          updQ(
                            sel,
                            type === 'multiple'
                              ? { type, answers: q.answer >= 0 ? [q.answer] : [] }
                              : { type, answer: q.answers[0] ?? q.answer ?? -1, answers: [] }
                          )
                        }}
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Question Text */}
                  <RichField
                    label="Question Text *"
                    value={q.question}
                    onChange={(v) => updQ(sel, { question: v })}
                    placeholder="Type the question content here…"
                    rows={3}
                  />

                  {/* Options List */}
                  <div className="mt-3">
                    <div className="ui-label mb-2 d-flex justify-content-between align-items-center">
                      <span>
                        Options{' '}
                        <small className="text-soft">
                          (Click the letter to select correct answer)
                        </small>
                      </span>
                    </div>

                    <div className="mcq-opt-editor-list">
                      {q.options.map((o, oi) => {
                        const isRight =
                          q.type === 'multiple' ? q.answers.includes(oi) : q.answer === oi
                        const oexp = q.optionExplanations?.[oi] || ''
                        const expKey = `${q.id}:${oi}`
                        const expShown = expOpen[expKey] ?? !!String(oexp).trim()
                        return (
                          <Fragment key={oi}>
                          <div
                            className={`opt-row ${isRight ? 'right is-correct' : ''}`}
                          >
                            <button
                              type="button"
                              className={`opt-radio ${q.type === 'multiple' ? 'square' : ''}`}
                              onClick={() => {
                                if (q.type === 'multiple') {
                                  const next = q.answers.includes(oi)
                                    ? q.answers.filter((v) => v !== oi)
                                    : [...q.answers, oi].sort((a, b) => a - b)
                                  updQ(sel, { answers: next, answer: next[0] ?? -1 })
                                } else {
                                  updQ(sel, { answer: oi })
                                }
                              }}
                              title="Toggle correct answer"
                            >
                              {isRight ? <LuCircleCheck /> : L[oi]}
                            </button>

                            <RichEditable
                              className="ui-input rt-field single flex-grow-1"
                              singleLine
                              value={o}
                              onCommit={(v) => {
                                const nextOpts = q.options.map((x, j) => (j === oi ? v : x))
                                updQ(sel, { options: nextOpts })
                              }}
                              placeholder={`Option ${L[oi]}`}
                            />

                            {isRight && (
                              <span className="pill pill-ok d-none d-md-inline">Correct</span>
                            )}

                            <button
                              type="button"
                              className={`icon-mini opt-exp-toggle ${String(oexp).trim() ? 'has' : ''}`}
                              onClick={() => setExpOpen((m) => ({ ...m, [expKey]: !expShown }))}
                              title={expShown ? 'Hide explanation for this option' : 'Add explanation for this option'}
                              aria-expanded={expShown}
                            >
                              <LuBookmark />
                            </button>

                            <button
                              type="button"
                              className="icon-mini danger"
                              disabled={q.options.length <= 2}
                              onClick={() => {
                                const shift = (v) => (v === oi ? null : v > oi ? v - 1 : v)
                                const answers = q.answers.map(shift).filter((v) => v !== null)
                                updQ(sel, {
                                  options: q.options.filter((_, j) => j !== oi),
                                  optionExplanations: (q.optionExplanations || []).filter((_, j) => j !== oi),
                                  answer:
                                    q.type === 'multiple'
                                      ? answers[0] ?? -1
                                      : shift(q.answer) ?? -1,
                                  answers: q.type === 'multiple' ? answers : [],
                                })
                              }}
                              title="Delete option"
                            >
                              <LuTrash2 />
                            </button>
                          </div>
                          {expShown && (
                            <div className="opt-exp-row">
                              <RichField
                                label={`Explanation for option ${L[oi]} (shown after the exam)`}
                                value={oexp}
                                onChange={(v) => updQ(sel, { optionExplanations: Array.from({ length: q.options.length }, (_, j) => (j === oi ? v : q.optionExplanations?.[j] || '')) })}
                                placeholder={isRight ? 'Why this option is correct…' : 'Why this option is wrong…'}
                                rows={2}
                              />
                            </div>
                          )}
                          </Fragment>
                        )
                      })}
                    </div>

                    {q.options.length < 8 && (
                      <button
                        type="button"
                        className="btn ui-btn ui-btn-ghost btn-sm mt-2"
                        onClick={() => updQ(sel, { options: [...q.options, ''], optionExplanations: [...(q.optionExplanations || q.options.map(() => '')), ''] })}
                      >
                        <LuPlus /> Add Option
                      </button>
                    )}
                  </div>

                  {/* Collapsible Solution / Explanation Section */}
                  <details className="mcq-solution-accordion mt-3" open={!!q.explanation}>
                    <summary className="solution-summary">
                      <LuBookmark /> Explanation & Solution (Optional)
                    </summary>
                    <div className="p-2 pt-3">
                      <RichField
                        value={q.explanation}
                        onChange={(v) => updQ(sel, { explanation: v })}
                        placeholder="Explain why the correct answer is right. Shown to students after submitting."
                        rows={3}
                      />
                    </div>
                  </details>
                </div>
              ) : (
                <div className="text-center text-soft p-5">
                  <p>No question selected.</p>
                  <button type="button" className="btn ui-btn ui-btn-primary" onClick={addQ}>
                    <LuPlus /> Create First Question
                  </button>
                </div>
              )}
            </main>

            {/* PANEL 3: Right Individual Question Settings */}
            <aside className="mcq-p3-settings" aria-label="Question Settings">
              {q ? (
                <div className="mcq-p3-content">
                  <h4 className="p3-title">
                    <LuBookmark /> Question Settings
                  </h4>

                  <div className="p3-field-group">
                    <Field label="Marks" hint="Default is 1">
                      <input
                        className="ui-input"
                        type="number"
                        min={0}
                        step={0.25}
                        value={q.marks || ''}
                        placeholder="1"
                        onChange={(e) =>
                          updQ(sel, { marks: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </Field>

                    <Field label="Negative Marks" hint="e.g. 0.25">
                      <input
                        className="ui-input"
                        type="number"
                        min={0}
                        step={0.25}
                        value={q.negative}
                        placeholder="default"
                        onChange={(e) =>
                          updQ(sel, {
                            negative:
                              e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </Field>

                    <Field label="Difficulty">
                      <select
                        className="ui-input ui-select"
                        value={q.difficulty}
                        onChange={(e) => updQ(sel, { difficulty: e.target.value })}
                      >
                        {DIFFICULTIES.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Subject / Topic">
                      <input
                        className="ui-input"
                        list="mcq-subjects"
                        value={q.subject || ''}
                        onChange={(e) => updQ(sel, { subject: e.target.value })}
                        placeholder="e.g. Concept of PE"
                      />
                      <datalist id="mcq-subjects">
                        {subjects.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </Field>
                  </div>

                  {/* Image Attachment */}
                  <div className="p3-sub-section">
                    <span className="p3-sub-title">
                      <LuImage /> Attach Image
                    </span>
                    {q.image && (
                      <div className="mcq-q-img-preview mb-2">
                        <img src={q.image} alt="Preview" />
                        <button
                          type="button"
                          className="btn ui-btn ui-btn-ghost btn-sm text-danger-soft mt-1"
                          onClick={() => updQ(sel, { image: '' })}
                        >
                          <LuTrash2 /> Remove
                        </button>
                      </div>
                    )}
                    <div className="d-flex gap-2 flex-wrap">
                      <label className="btn ui-btn ui-btn-secondary btn-sm flex-grow-1">
                        <LuUpload /> Upload
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const f = e.target.files[0]
                            if (!f) return
                            try {
                              const u = await uploadImage(f, 'mcq-question', { max: 900 })
                              updQ(sel, { image: u })
                              toast('Image uploaded')
                            } catch (err) {
                              toast(err.message, 'error')
                            }
                            e.target.value = ''
                          }}
                        />
                      </label>
                      <input
                        className="ui-input ui-input-sm flex-grow-1"
                        placeholder="Image URL (https://)"
                        value={q.image || ''}
                        onChange={(e) => updQ(sel, { image: e.target.value.trim() })}
                      />
                    </div>
                  </div>

                  {/* Hint Section */}
                  <div className="p3-sub-section">
                    <span className="p3-sub-title">
                      <LuLightbulb /> Student Hint
                    </span>
                    <textarea
                      className="ui-input ui-textarea ui-input-sm"
                      rows={2}
                      value={q.hint || ''}
                      onChange={(e) => updQ(sel, { hint: e.target.value })}
                      placeholder="Shown when student taps 'Show Hint'"
                    />
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        ) : mode === 'json' ? (
          /* JSON Mode */
          <div className="p-3">
            <Suspense fallback={<EditorFallback />}>
              <CodeEditor
                lang="json"
                jsonKeys={MCQ_KEYS}
                value={jsonText}
                onChange={(v) => {
                  setJsonText(v)
                  setCheck(null)
                }}
                height="340px"
                ariaLabel="MCQ JSON"
              />
            </Suspense>
            <div className="d-flex gap-2 flex-wrap mt-2">
              <button
                type="button"
                className="btn ui-btn ui-btn-primary"
                onClick={() => applyJson(jsonText, 'replace')}
              >
                <LuCircleCheck /> Apply (Replace)
              </button>
              <button
                type="button"
                className="btn ui-btn ui-btn-secondary"
                onClick={() => applyJson(jsonText, 'append')}
              >
                <LuPlus /> Append
              </button>
              <button
                type="button"
                className="btn ui-btn ui-btn-ghost"
                onClick={() => {
                  try {
                    setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2))
                  } catch {
                    setCheck(parseMcqJson(jsonText))
                  }
                }}
              >
                <LuWandSparkles /> Format JSON
              </button>
            </div>
            <details className="mt-2">
              <summary className="small text-soft">JSON format guide</summary>
              <pre className="json-help">{MCQ_JSON_HELP}</pre>
            </details>
          </div>
        ) : mode === 'upload' ? (
          /* Import JSON / OCR Mode */
          <div className="p-3">
            <div
              className="drop-zone"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                onFile(e.dataTransfer.files[0])
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
            >
              <LuUpload className="fs-2" />
              <strong>
                {extracting
                  ? 'Extracting text from document…'
                  : 'Drop MCQ JSON, PDF or image here, or click to browse'}
              </strong>
              <span className="small text-soft">
                JSON files import directly. PDFs/Images extract question text via OCR.
              </span>
            </div>
          </div>
        ) : mode === 'export' ? (
          /* Export Mode */
          <div className="p-3">
            <p className="mb-2">
              Download all <b>{qs.length}</b> questions with answers, marks, hints and explanations as a <code>.json</code> file.
            </p>
            <button type="button" className="btn ui-btn ui-btn-primary" onClick={exportNow}>
              <LuDownload /> Export JSON
            </button>
          </div>
        ) : (
          /* Templates Mode */
          <div className="p-3 mcq-templates">
            {MCQ_TEMPLATES.map((t) => (
              <div className="mcq-tpl" key={t.id}>
                <div>
                  <b>{t.label}</b>
                  <small>{t.desc}</small>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn ui-btn ui-btn-secondary btn-sm"
                    onClick={() => applyJson(JSON.stringify(t.json), 'append')}
                  >
                    Append
                  </button>
                  <button
                    type="button"
                    className="btn ui-btn ui-btn-primary btn-sm"
                    onClick={async () => {
                      if (
                        !qs.length ||
                        (await confirm({
                          title: 'Replace questions?',
                          message: `Replace all ${qs.length} current questions with “${t.label}”?`,
                          confirmText: 'Replace',
                        }))
                      )
                        applyJson(JSON.stringify(t.json), 'replace')
                    }}
                  >
                    Use template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Validation Errors Display */}
        {check && (
          <div className={`json-check ${check.ok ? 'ok' : 'bad'} m-2`} role="status">
            {check.ok ? (
              <>
                <LuCircleCheck /> All questions are valid.
              </>
            ) : (
              <>
                <LuCircleAlert />
                <ul>
                  {check.errors.slice(0, 6).map((e, i) => (
                    <li key={i}>{typeof e === 'string' ? e : e.message}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Bottom Action Bar: Validate, Clear, Cancel, Save Question */}
        <div className="ed-toolbar d-flex align-items-center justify-content-between p-2 px-3 border-top">
          <div className="d-flex gap-2 flex-wrap">
            <button type="button" className="btn ui-btn ui-btn-ghost btn-sm" onClick={validate}>
              <LuCircleCheck /> Validate
            </button>
            <button
              type="button"
              className="btn ui-btn ui-btn-ghost btn-sm"
              onClick={clearCurrent}
              title="Clear text and options of this question"
            >
              <LuEraser /> Clear
            </button>
            <button
              type="button"
              className="btn ui-btn ui-btn-ghost btn-sm"
              onClick={cancelEdits}
              title="Cancel changes to this question"
            >
              <LuX /> Cancel
            </button>
          </div>

          <div className="d-flex gap-2 align-items-center">
            <button
              type="button"
              className="btn ui-btn ui-btn-primary btn-sm px-3"
              onClick={saveCurrentQuestion}
            >
              <LuCheck /> Save Question
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,.pdf,application/pdf,image/*"
            hidden
            onChange={(e) => {
              onFile(e.target.files[0])
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Global Exam Settings in the Right Sidebar (Preserved per Change 7)
 */
export function McqProps({ block, setBlock, setData, ui, setUi, onSave, dirty }) {
  const d = block.data
  const s = { ...DEFAULT_MCQ_SETTINGS, ...d.settings }
  const dp = { ...DEFAULT_MCQ_DISPLAY, ...d.display }
  const r = { ...DEFAULT_MCQ_RESULT, ...d.result }
  const setS = (p) => setData({ settings: { ...s, ...p } })
  const setD = (p) => setData({ display: { ...dp, ...p } })
  const setR = (p) => setData({ result: { ...r, ...p } })
  const ex = { ...DEFAULT_MCQ_EXAM, ...d.exam }
  const setEx = (p) => setData({ exam: { ...ex, ...p } })
  const tab = ui.mcqProps || 'content'
  const Row = ({ label, k, obj = s, set = setS }) => (
    <div className="prop-row">
      <span>{label}</span>
      <Toggle checked={obj[k]} onChange={(v) => set({ [k]: v })} small />
    </div>
  )

  return (
    <div className="props">
      <Tabs
        value={tab}
        onChange={(v) => setUi({ mcqProps: v })}
        items={[
          { value: 'content', label: 'Test Info' },
          { value: 'settings', label: 'Settings' },
          { value: 'display', label: 'Display' },
          { value: 'exam', label: 'Exam Mode' },
        ]}
        className="props-tabs"
      />

      {tab === 'content' && (
        <>
          <Section title="Test Information">
            <Field label="Test Title">
              <input
                className="ui-input"
                value={d.title || ''}
                maxLength={160}
                onChange={(e) => {
                  setData({ title: e.target.value })
                  setBlock({ title: e.target.value || 'MCQ Test' })
                }}
              />
            </Field>
            <Field label="Description (optional)">
              <textarea
                className="ui-input ui-textarea"
                rows={2}
                value={d.description || ''}
                onChange={(e) => setData({ description: e.target.value })}
              />
            </Field>
            <div className="prop-row">
              <span>Show in Chapter</span>
              <Toggle
                checked={block.visible !== false}
                onChange={(v) => setBlock({ visible: v })}
                small
              />
            </div>
          </Section>

          <Section title="Quick Exam Rules">
            <div className="prop-row">
              <span>Time Limit</span>
              <Toggle
                checked={!!s.timeLimitOn}
                onChange={(v) => setS({ timeLimitOn: v })}
                small
              />
            </div>
            {s.timeLimitOn && (
              <NumberField
                label="Minutes"
                value={s.timeLimit}
                min={1}
                max={240}
                onChange={(v) => setS({ timeLimit: v })}
                suffix="min"
              />
            )}
            <div className="prop-row">
              <span>Negative Marking</span>
              <Toggle
                checked={!!s.negativeMarking}
                onChange={(v) => setS({ negativeMarking: v })}
                small
              />
            </div>
            {s.negativeMarking && (
              <NumberField
                label="Deduction per wrong answer"
                value={s.negativeValue}
                min={0.1}
                max={5}
                step={0.25}
                onChange={(v) => setS({ negativeValue: v })}
              />
            )}
          </Section>
        </>
      )}

      {tab === 'settings' && (
        <>
          <Section title="Test Settings">
            <Row label="Shuffle questions" k="shuffleQuestions" />
            <Row label="Shuffle options" k="shuffleOptions" />
            <Row label="Negative marking" k="negativeMarking" />
            <Row label="Time limit" k="timeLimitOn" />
            <Row label="Allow pause during test" k="allowPause" />
            <Row label="Auto-submit when time expires" k="autoSubmit" />
            <Row label="Show solution after submit" k="showSolution" />
          </Section>
        </>
      )}

      {tab === 'display' && (
        <>
          <Section title="Display Preferences">
            <Row label="One question at a time" k="oneAtATime" obj={dp} set={setD} />
            <Row label="Question navigation palette" k="showQuestionNav" obj={dp} set={setD} />
            <Row label="Show progress bar" k="showProgressBar" obj={dp} set={setD} />
            <Row label="Show timer" k="showTimer" obj={dp} set={setD} />
            <Row label="Show question numbers" k="showQuestionNumbers" obj={dp} set={setD} />
          </Section>
        </>
      )}

      {tab === 'exam' && (
        <>
          <Section title="Chapter Examination Mode">
            <div className="prop-row">
              <span>Enable Exam Mode</span>
              <Toggle checked={!!ex.enabled} onChange={(v) => setEx({ enabled: v })} small />
            </div>
            <p className="small text-soft">
              Exam mode requires agreeing to instructions and enforces strict timing.
            </p>
            <Field label="Special Instructions (optional)">
              <textarea
                className="ui-input ui-textarea"
                rows={3}
                value={ex.instructions || ''}
                onChange={(e) => setEx({ instructions: e.target.value })}
                placeholder="Specific examination rules for students…"
              />
            </Field>
          </Section>
        </>
      )}

      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave}>
        <LuSave /> {dirty ? 'Save Block' : 'Saved'}
      </button>
    </div>
  )
}
