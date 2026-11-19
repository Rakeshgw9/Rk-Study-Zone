import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LuArrowLeft,
  LuArrowRight,
  LuBookmark,
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleX,
  LuClock,
  LuEraser,
  LuFlag,
  LuInfo,
  LuLayoutGrid,
  LuRotateCcw,
  LuTriangleAlert,
  LuTrophy,
  LuX,
} from 'react-icons/lu'
import {
  DEFAULT_MCQ_SETTINGS,
  buildPaper,
  hasOptionExplanations,
  isAnswered,
  isCorrect,
  questionMarks,
  questionNegative,
  scorePaper,
} from '../../lib/mcq'
import { RichHtml } from '../ui/RichText'

const L = 'ABCDEFGH'
const fmt = (s) =>
  `${String(Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : '')}${String(
    Math.floor((s % 3600) / 60)
  ).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const stripOdia = (html = '') =>
  String(html).replace(/<span[^>]*class=["']?mcq-odia-tr["']?[^>]*>[\s\S]*?<\/span>/gi, '')

/**
 * Full-Featured MCQ Examination Modal (Desktop 3-panel + Mobile Native Full-Screen App View)
 */
export default function McqExamModal({
  show,
  onClose,
  block,
  chapter,
  portal,
  attemptsUsed = 0,
  onSubmit,
}) {
  if (!show || !block) return null

  const data = block.data || {}
  const settings = { ...DEFAULT_MCQ_SETTINGS, ...data.settings }
  const paper = useMemo(() => buildPaper(data), [data])

  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [marked, setMarked] = useState({})
  const [secs, setSecs] = useState(0)
  const [phase, setPhase] = useState('run') // run | result
  const [result, setResult] = useState(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [showAllExp, setShowAllExp] = useState(false)
  const [openExp, setOpenExp] = useState({})
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [navDrawerOpen, setNavDrawerOpen] = useState(false)
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false)
  const submitted = useRef(false)

  const timeLimitMin = Number(settings.timeLimit) || 15
  const totalSecs = settings.timeLimitOn ? Math.max(1, timeLimitMin) * 60 : 0
  const remainingSecs = totalSecs ? Math.max(0, totalSecs - secs) : secs

  useEffect(() => {
    if (phase !== 'run') return
    const timer = setInterval(() => {
      setSecs((s) => {
        const next = s + 1
        if (totalSecs && next >= totalSecs && settings.autoSubmit) {
          clearInterval(timer)
          handleFinish(next)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, totalSecs, settings.autoSubmit]) // eslint-disable-line react-hooks/exhaustive-deps

  const negVal = settings.negativeMarking
    ? Number(settings.negativeValue || 0.25)
    : 0

  const totalMarks = paper.reduce((sum, q) => sum + questionMarks(q, settings), 0)
  const attemptLimit = Number(settings.attemptLimit) || 3
  const currentAttempt = Math.min(attemptLimit, attemptsUsed + 1)

  const chooseOption = (q, oi) => {
    if (q.type === 'multiple') {
      const cur = Array.isArray(answers[q.id]) ? answers[q.id] : []
      const next = cur.includes(oi) ? cur.filter((v) => v !== oi) : [...cur, oi]
      setAnswers((prev) => {
        const n = { ...prev }
        if (next.length) n[q.id] = next
        else delete n[q.id]
        return n
      })
    } else {
      setAnswers((prev) => ({ ...prev, [q.id]: oi }))
    }
  }

  const clearCurrentAnswer = (qId) => {
    setAnswers((prev) => {
      const n = { ...prev }
      delete n[qId]
      return n
    })
  }

  const isSelected = (q, oi) => {
    if (q.type === 'multiple') {
      return (answers[q.id] || []).includes(oi)
    }
    return answers[q.id] === oi
  }

  const toggleMarkForReview = (qId) => {
    setMarked((prev) => ({ ...prev, [qId]: !prev[qId] }))
  }

  const clearAllMarks = () => {
    setMarked({})
  }

  const handleFinish = (finalSecs = secs) => {
    if (submitted.current) return
    submitted.current = true
    const res = {
      ...scorePaper(paper, answers, settings),
      timeTaken: finalSecs,
      at: Date.now(),
    }
    const passPct = Number(data.result?.passPercent) || 50
    res.passed = res.percent >= passPct
    setResult(res)
    setPhase('result')
    setConfirmSubmit(false)
    setNavDrawerOpen(false)
    setInfoDrawerOpen(false)
    onSubmit?.(res)
  }

  const handleCloseAttempt = () => {
    if (phase === 'result') {
      onClose()
    } else {
      setConfirmExit(true)
    }
  }

  const retakeExam = () => {
    setAnswers({})
    setMarked({})
    setSecs(0)
    setIdx(0)
    setResult(null)
    setShowAllExp(false)
    setOpenExp({})
    setNavDrawerOpen(false)
    setInfoDrawerOpen(false)
    submitted.current = false
    setPhase('run')
  }

  const answeredCount = paper.filter((q) => isAnswered(answers[q.id])).length
  const unansweredCount = paper.length - answeredCount
  const markedCount = paper.filter((q) => marked[q.id]).length

  const curQ = paper[idx] || paper[0]
  const curAnswered = curQ ? isAnswered(answers[curQ.id]) : false
  const curMarked = curQ ? !!marked[curQ.id] : false
  const isLast = idx >= paper.length - 1

  const renderExamInfoCards = () => (
    <>
      <div className="mcq-info-card">
        <h4 className="info-card-title">
          <LuInfo /> Exam Information
        </h4>
        <div className="info-kv-row">
          <span className="mcq-info-label">Total Questions</span>
          <strong className="mcq-info-val">{paper.length}</strong>
        </div>
        <div className="info-kv-row">
          <span className="mcq-info-label">Total Marks</span>
          <strong className="mcq-info-val">{totalMarks}</strong>
        </div>
        <div className="info-kv-row">
          <span className="mcq-info-label">Negative Marking</span>
          <strong className="mcq-info-val">{negVal ? `-${negVal}` : 'None'}</strong>
        </div>
        <div className="info-kv-row">
          <span className="mcq-info-label">Time Limit</span>
          <strong className="mcq-info-val">{timeLimitMin} Minutes</strong>
        </div>
        <div className="info-kv-row">
          <span className="mcq-info-label">Attempts Allowed</span>
          <strong className="mcq-info-val">{attemptLimit || 'Unlimited'}</strong>
        </div>
      </div>

      <div className="mcq-info-card instructions-card">
        <h4 className="info-card-title">
          <LuBookmark /> Instructions
        </h4>
        <ul className="info-bullet-list">
          <li>Choose the best answer for each question.</li>
          <li>Each correct answer carries 1 mark.</li>
          {negVal > 0 && (
            <li>For each wrong answer, {negVal} mark will be deducted.</li>
          )}
          <li>You can mark a question for review anytime.</li>
          <li>Click &quot;Submit Exam&quot; to finish and see results.</li>
        </ul>
      </div>
    </>
  )

  return (
    <div
      className="mcq-exam-overlay"
      onClick={(e) => {
        e.stopPropagation()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="mcq-exam-modal-container">
        {/* Header */}
        <header className="mcq-exam-header">
          <div className="mcq-exam-header-left">
            <div className="mcq-exam-badge-icon">
              <LuFlag />
            </div>
            <div className="mcq-exam-title-wrap">
              <h2 className="mcq-exam-title">
                {data.title || `MCQ: ${chapter?.title || 'Examination'}`}
              </h2>
              <div className="mcq-exam-subtitle">
                {chapter?.title ? `${chapter.title}` : 'Chapter Practice Test'}
                {portal?.name ? ` • ${portal.name}` : ''}
              </div>
            </div>
          </div>

          <div className="mcq-exam-header-right">
            {phase === 'run' && (
              <>
                <div
                  className={`mcq-exam-timer-pill ${
                    totalSecs && remainingSecs < 120 ? 'is-urgent' : ''
                  }`}
                >
                  <LuClock />
                  <span className="mcq-timer-label">
                    <span className="mcq-timer-prefix">Time Left: </span>
                    {fmt(remainingSecs)}
                  </span>
                </div>

                <button
                  type="button"
                  className="mcq-mobile-nav-trigger d-md-none"
                  onClick={() => setNavDrawerOpen(true)}
                  aria-label="Open question palette"
                >
                  <LuLayoutGrid />
                  <span className="mcq-mobile-q-counter">
                    {idx + 1}/{paper.length}
                  </span>
                </button>

                <button
                  type="button"
                  className="mcq-mobile-info-trigger d-md-none"
                  onClick={() => setInfoDrawerOpen(true)}
                  aria-label="Exam information and instructions"
                  title="Exam Info"
                >
                  <LuInfo />
                </button>
              </>
            )}

            <div className="mcq-exam-stat-item d-none d-md-flex">
              <span className="lbl">Attempts:</span>
              <strong className="mcq-stat-val">
                {currentAttempt}/{attemptLimit || '∞'}
              </strong>
            </div>

            <div className="mcq-exam-stat-item d-none d-md-flex">
              <span className="lbl">Total:</span>
              <strong className="mcq-stat-val">{paper.length}</strong>
            </div>

            <div className="mcq-exam-stat-item d-none d-md-flex">
              <span className="lbl">Marks:</span>
              <strong className="mcq-stat-val">{totalMarks}</strong>
            </div>

            <div className="mcq-exam-stat-item d-none d-md-flex">
              <span className="lbl">Negative:</span>
              <strong className="mcq-stat-val">{negVal ? `-${negVal}` : 'None'}</strong>
            </div>

            <button
              type="button"
              className="mcq-exam-close-btn"
              onClick={handleCloseAttempt}
              aria-label="Close Exam"
              title="Close Exam"
            >
              <LuX />
            </button>
          </div>
        </header>

        {/* Modal Body */}
        {phase === 'run' ? (
          <div className="mcq-exam-body-grid">
            {/* Left Panel: Question Navigator (desktop inline, mobile slide-over/bottom sheet) */}
            {navDrawerOpen && (
              <div
                className="mcq-drawer-backdrop d-md-none"
                onClick={() => setNavDrawerOpen(false)}
                aria-hidden="true"
              />
            )}
            <aside
              className={`mcq-panel-navigator ${navDrawerOpen ? 'is-drawer-open' : ''}`}
              aria-label="Question Navigator"
            >
              <div className="mcq-panel-nav-head">
                <h3 className="mcq-panel-title mb-0">
                  <LuBookmark /> Question Navigator
                </h3>
                <button
                  type="button"
                  className="mcq-drawer-close d-md-none"
                  onClick={() => setNavDrawerOpen(false)}
                  aria-label="Close navigator"
                >
                  <LuX />
                </button>
              </div>

              <div className="mcq-nav-grid">
                {paper.map((q, i) => {
                  const done = isAnswered(answers[q.id])
                  const isMarked = marked[q.id]
                  const isCur = i === idx
                  let statusClass = 'unanswered'
                  if (isMarked) statusClass = 'marked'
                  else if (done) statusClass = 'answered'

                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`mcq-nav-btn ${statusClass} ${isCur ? 'active' : ''}`}
                      onClick={() => {
                        setIdx(i)
                        setNavDrawerOpen(false)
                      }}
                      aria-label={`Go to Question ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>

              <div className="mcq-nav-legend">
                <div className="legend-row">
                  <span className="box answered" />
                  <span className="mcq-legend-label">Answered ({answeredCount})</span>
                </div>
                <div className="legend-row">
                  <span className="box unanswered" />
                  <span className="mcq-legend-label">Not Answered ({unansweredCount})</span>
                </div>
                <div className="legend-row">
                  <span className="box marked" />
                  <span className="mcq-legend-label">Marked for Review ({markedCount})</span>
                </div>
              </div>

              <button
                type="button"
                className="btn ui-btn ui-btn-ghost btn-sm w-100 mt-3"
                onClick={clearAllMarks}
                disabled={markedCount === 0}
              >
                <LuEraser /> Clear All Marks
              </button>

              <button
                type="button"
                className="btn mcq-submit-green-btn w-100 mt-2 d-md-none"
                onClick={() => {
                  setNavDrawerOpen(false)
                  setConfirmSubmit(true)
                }}
              >
                <LuCheck /> Submit Exam
              </button>
            </aside>

            {/* Center Panel: Question, Options & Actions */}
            <main className="mcq-panel-question" aria-label="Current Question">
              {curQ && (
                <>
                  <div className="mcq-question-header">
                    <span className="mcq-q-count">
                      Question {idx + 1} of {paper.length}
                    </span>
                    <div className="mcq-q-head-actions">
                      <button
                        type="button"
                        className="btn ui-btn ui-btn-secondary btn-sm d-md-none mcq-top-submit-btn"
                        onClick={() => setConfirmSubmit(true)}
                      >
                        <LuCheck /> Submit
                      </button>
                      <button
                        type="button"
                        className="btn ui-btn ui-btn-ghost btn-sm p-1 d-none d-md-inline-flex"
                        disabled={idx === 0}
                        onClick={() => setIdx((i) => Math.max(0, i - 1))}
                        aria-label="Previous question"
                      >
                        <LuChevronLeft />
                      </button>
                      <button
                        type="button"
                        className="btn ui-btn ui-btn-ghost btn-sm p-1 d-none d-md-inline-flex"
                        disabled={idx === paper.length - 1}
                        onClick={() => setIdx((i) => Math.min(paper.length - 1, i + 1))}
                        aria-label="Next question"
                      >
                        <LuChevronRight />
                      </button>
                    </div>
                  </div>

                  <div className="mcq-question-content">
                    <div className="mcq-question-text">
                      <span className="q-num">{idx + 1}.</span>
                      <RichHtml as="div" className="mcq-q-body" value={stripOdia(curQ.question)} />
                    </div>

                    {curQ.image && (
                      <div className="mcq-q-image-box">
                        <img src={curQ.image} alt="Question illustration" />
                      </div>
                    )}

                    <div className="mcq-options-list">
                      {curQ.order.map((oi, k) => {
                        const selected = isSelected(curQ, oi)
                        return (
                          <button
                            key={oi}
                            type="button"
                            className={`mcq-option-card ${selected ? 'is-selected' : ''}`}
                            onClick={() => chooseOption(curQ, oi)}
                          >
                            <span className="opt-bubble">{L[k]}</span>
                            <RichHtml as="div" className="opt-text" value={stripOdia(curQ.options[oi])} />
                          </button>
                        )
                      })}
                    </div>

                    <div className="mcq-review-check d-none d-md-block">
                      <label className="d-inline-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={curMarked}
                          onChange={() => toggleMarkForReview(curQ.id)}
                        />
                        <span className="mcq-mark-label">Mark for Review</span>
                      </label>
                    </div>
                  </div>

                  <div className="mcq-question-footer">
                    <button
                      type="button"
                      className="btn ui-btn ui-btn-secondary mcq-foot-btn"
                      disabled={idx === 0}
                      onClick={() => setIdx((i) => i - 1)}
                    >
                      <LuArrowLeft /> <span className="mcq-foot-label">Previous</span>
                    </button>

                    <div className="mcq-foot-mid d-md-none">
                      <button
                        type="button"
                        className={`btn ui-btn mcq-foot-btn ${curMarked ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                        onClick={() => toggleMarkForReview(curQ.id)}
                        aria-pressed={curMarked}
                      >
                        <LuBookmark /> <span className="mcq-foot-label">{curMarked ? 'Marked' : 'Mark'}</span>
                      </button>
                      {curAnswered && (
                        <button
                          type="button"
                          className="btn ui-btn ui-btn-ghost mcq-foot-btn"
                          onClick={() => clearCurrentAnswer(curQ.id)}
                          aria-label="Clear answer"
                        >
                          <LuEraser /> <span className="mcq-foot-label">Clear</span>
                        </button>
                      )}
                    </div>

                    {isLast ? (
                      <button
                        type="button"
                        className="btn mcq-submit-green-btn mcq-foot-btn"
                        onClick={() => setConfirmSubmit(true)}
                      >
                        <LuCheck /> <span className="mcq-foot-label">Submit Exam</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn ui-btn ui-btn-primary mcq-foot-btn"
                        onClick={() => setIdx((i) => i + 1)}
                      >
                        <span className="mcq-foot-label">Next</span> <LuArrowRight />
                      </button>
                    )}
                  </div>
                </>
              )}
            </main>

            {/* Right Panel: Exam Information, Instructions & Submit (Desktop) */}
            <aside className="mcq-panel-info d-none d-lg-flex" aria-label="Exam Information">
              {renderExamInfoCards()}
              <button
                type="button"
                className="btn mcq-submit-green-btn w-100"
                onClick={() => setConfirmSubmit(true)}
              >
                <LuCheck /> Submit Exam
              </button>
            </aside>
          </div>
        ) : (
          /* Result Screen */
          <div className="mcq-result-screen">
            <div className={`mcq-result-banner ${result?.passed ? 'passed' : 'failed'}`}>
              <div className="result-trophy">
                <LuTrophy />
              </div>
              <div className="mcq-result-banner-body">
                <h3 className="result-headline">
                  {result?.passed ? 'Exam Completed Successfully!' : 'Exam Completed'}
                </h3>
                <div className="result-score-big">
                  Score: <b>{result?.score}</b> / {result?.total}
                  <span className="result-pct">({result?.percent}%)</span>
                </div>
              </div>
            </div>

            <div className="mcq-result-stats-row">
              <div className="res-stat-card ok">
                <LuCircleCheck />
                <div className="res-stat-meta">
                  <strong className="res-stat-val">{result?.correct}</strong>
                  <span className="res-stat-lbl">Correct</span>
                </div>
              </div>
              <div className="res-stat-card bad">
                <LuCircleX />
                <div className="res-stat-meta">
                  <strong className="res-stat-val">{result?.wrong}</strong>
                  <span className="res-stat-lbl">Incorrect</span>
                </div>
              </div>
              <div className="res-stat-card skip">
                <LuCircleAlert />
                <div className="res-stat-meta">
                  <strong className="res-stat-val">{result?.skipped}</strong>
                  <span className="res-stat-lbl">Unanswered</span>
                </div>
              </div>
              <div className="res-stat-card time">
                <LuClock />
                <div className="res-stat-meta">
                  <strong className="res-stat-val">{fmt(result?.timeTaken || 0)}</strong>
                  <span className="res-stat-lbl">Time Taken</span>
                </div>
              </div>
            </div>

            {/* Answer Review Section */}
            <div className="mcq-result-review-section">
              <div className="review-head">
                <h4 className="review-title mb-0">Question Breakdown &amp; Solutions</h4>
                {settings.showSolution && (
                  <button
                    type="button"
                    className="mcq-opt-toggle-btn"
                    onClick={() => {
                      setShowAllExp((v) => !v)
                      setOpenExp({})
                    }}
                    aria-pressed={showAllExp}
                  >
                    {showAllExp ? 'Hide all option explanations' : 'Show all option explanations'}
                  </button>
                )}
              </div>
              <div className="review-list">
                {paper.map((q, i) => {
                  const ans = answers[q.id]
                  const answered = isAnswered(ans)
                  const right = answered && isCorrect(q, ans)
                  const hasOdia = /mcq-odia-tr/i.test(`${q.question || ''}${(q.options || []).join('')}`)
                  const hasOptExp = hasOptionExplanations(q)
                  const canExp = settings.showSolution
                  const expOn = canExp && (openExp[q.id] ?? showAllExp)
                  return (
                    <div
                      key={q.id}
                      className={`review-item ${!answered ? 'skipped' : right ? 'correct' : 'wrong'} ${expOn ? 'show-odia-tr' : ''}`}
                    >
                      <div className="review-q-head">
                        <div className="mcq-review-top">
                          <strong className="mcq-review-qnum">Question {i + 1}:</strong>
                          <span className={`review-badge ${!answered ? 'skipped' : right ? 'correct' : 'wrong'}`}>
                            {!answered ? 'Unanswered' : right ? `+${questionMarks(q, settings)}` : `-${questionNegative(q, settings)}`}
                          </span>
                        </div>
                        <RichHtml
                          as="div"
                          className="mcq-review-question"
                          value={expOn ? q.question : stripOdia(q.question)}
                        />
                      </div>
                      <div className="review-options">
                        {q.order.map((oi, k) => {
                          const picked = q.type === 'multiple' ? (ans || []).includes(oi) : ans === oi
                          const isSol = q.type === 'multiple' ? q.answers.includes(oi) : q.answer === oi
                          return (
                            <div
                              key={oi}
                              className={`review-opt ${isSol ? 'is-correct' : ''} ${picked && !isSol ? 'is-wrong' : ''} ${picked ? 'is-picked' : ''}`}
                            >
                              <div className="mcq-review-opt-row">
                                <span className="bubble">{L[k]}</span>
                                <RichHtml
                                  as="div"
                                  className="mcq-review-opt-body"
                                  value={expOn ? q.options[oi] : stripOdia(q.options[oi])}
                                />
                                {isSol && <span className="mcq-opt-badge is-correct">✓ Correct</span>}
                                {picked && !isSol && <span className="mcq-opt-badge is-wrong">✗ Selected</span>}
                              </div>
                              {expOn && String(q.optionExplanations?.[oi] || '').trim() !== '' && (
                                <div className="review-opt-exp">
                                  <strong className="mcq-exp-label">Why {L[k]}?</strong>
                                  <RichHtml as="div" className="mcq-exp-body" value={q.optionExplanations[oi]} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {settings.showSolution && q.explanation && (
                        <div className="review-explanation">
                          <strong className="mcq-exp-label">Solution:</strong>
                          <RichHtml as="div" className="mcq-exp-body" value={q.explanation} />
                        </div>
                      )}
                      {expOn && !hasOptExp && !hasOdia && (
                        <div className="review-opt-exp-empty">
                          Per-option explanations are not added for this question.
                        </div>
                      )}

                      {canExp && (
                        <button
                          type="button"
                          className="mcq-opt-toggle-btn mt-2"
                          onClick={() => setOpenExp((m) => ({ ...m, [q.id]: !expOn }))}
                          aria-expanded={expOn}
                        >
                          {expOn ? 'Hide option explanations' : 'Explain every option'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mcq-result-actions">
              <button
                type="button"
                className="btn ui-btn ui-btn-secondary"
                onClick={retakeExam}
              >
                <LuRotateCcw /> Retake Exam
              </button>
              <button
                type="button"
                className="btn ui-btn ui-btn-primary"
                onClick={onClose}
              >
                Done / Back to Lesson
              </button>
            </div>
          </div>
        )}

        {/* Mobile Exam Info & Instructions Modal */}
        {infoDrawerOpen && (
          <div className="mcq-confirm-dialog-overlay" onClick={() => setInfoDrawerOpen(false)}>
            <div className="mcq-confirm-box mcq-info-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="mcq-info-sheet-head">
                <h3 className="mb-0">Exam Details</h3>
                <button
                  type="button"
                  className="mcq-drawer-close"
                  onClick={() => setInfoDrawerOpen(false)}
                  aria-label="Close exam details"
                >
                  <LuX />
                </button>
              </div>
              <div className="mcq-info-sheet-body">
                {renderExamInfoCards()}
              </div>
              <button
                type="button"
                className="btn mcq-submit-green-btn w-100 mt-3"
                onClick={() => {
                  setInfoDrawerOpen(false)
                  setConfirmSubmit(true)
                }}
              >
                <LuCheck /> Submit Exam
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Exit Warning */}
        {confirmExit && (
          <div className="mcq-confirm-dialog-overlay" onClick={() => setConfirmExit(false)}>
            <div className="mcq-confirm-box" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-icon text-warning">
                <LuTriangleAlert />
              </div>
              <h3>Exit Exam?</h3>
              <p>
                Your answers will not be submitted and your progress in this attempt will be lost.
                Are you sure you want to exit?
              </p>
              <div className="mcq-confirm-actions">
                <button
                  type="button"
                  className="btn ui-btn ui-btn-secondary"
                  onClick={() => setConfirmExit(false)}
                >
                  Continue Exam
                </button>
                <button
                  type="button"
                  className="btn ui-btn ui-btn-danger"
                  onClick={() => {
                    setConfirmExit(false)
                    onClose()
                  }}
                >
                  Exit Exam
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Submit Dialog */}
        {confirmSubmit && (
          <div className="mcq-confirm-dialog-overlay" onClick={() => setConfirmSubmit(false)}>
            <div className="mcq-confirm-box" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-icon text-info">
                <LuFlag />
              </div>
              <h3>Submit Your Examination?</h3>
              <p>
                You have answered <b>{answeredCount}</b> of <b>{paper.length}</b> questions.
                {markedCount > 0 && (
                  <span className="mcq-confirm-marked"> (<b>{markedCount}</b> marked for review).</span>
                )}
                <br />
                Once submitted, you cannot change your answers.
              </p>
              <div className="mcq-confirm-actions">
                <button
                  type="button"
                  className="btn ui-btn ui-btn-secondary"
                  onClick={() => setConfirmSubmit(false)}
                >
                  Return to Questions
                </button>
                <button
                  type="button"
                  className="btn mcq-submit-green-btn"
                  onClick={() => handleFinish()}
                >
                  Yes, Submit Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}