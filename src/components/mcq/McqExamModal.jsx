import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LuTriangleAlert,
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
  LuRotateCcw,
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

/**
 * 90%-width Professional MCQ Examination Modal (Changes 4 & 5)
 * Centered popup with blurred backdrop, 3-panel layout, auto-save answers,
 * accurate timer, negative marking, attempt limits, confirmation warning on close, and full result screen.
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
  const questions = data.questions || []
  const paper = useMemo(() => buildPaper(data), [data])

  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [marked, setMarked] = useState({})
  const [secs, setSecs] = useState(0)
  const [phase, setPhase] = useState('run') // run | result
  const [result, setResult] = useState(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [showAllExp, setShowAllExp] = useState(false) // result: open option-wise explanations of every question
  const [openExp, setOpenExp] = useState({}) // result: per-question toggle
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const submitted = useRef(false)

  const timeLimitMin = Number(settings.timeLimit) || 15
  const totalSecs = settings.timeLimitOn ? Math.max(1, timeLimitMin) * 60 : 0
  const remainingSecs = totalSecs ? Math.max(0, totalSecs - secs) : secs

  // Timer interval
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
  }, [phase, totalSecs, settings.autoSubmit])

  // Negative marking value
  const negVal = settings.negativeMarking
    ? Number(settings.negativeValue || 0.25)
    : 0

  // Total possible marks
  const totalMarks = paper.reduce((sum, q) => sum + questionMarks(q, settings), 0)

  // Attempts limit
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
    submitted.current = false
    setPhase('run')
  }

  const answeredCount = paper.filter((q) => isAnswered(answers[q.id])).length
  const unansweredCount = paper.length - answeredCount
  const markedCount = paper.filter((q) => marked[q.id]).length

  const curQ = paper[idx] || paper[0]

  return (
    <div
      className="mcq-exam-overlay"
      onClick={(e) => {
        // Prevent closing when clicking outside the popup modal!
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
            <div>
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
              <div
                className={`mcq-exam-timer-pill ${
                  totalSecs && remainingSecs < 120 ? 'is-urgent' : ''
                }`}
              >
                <LuClock />
                <span>Time Left: {fmt(remainingSecs)}</span>
              </div>
            )}

            <div className="mcq-exam-stat-item">
              <span className="lbl">Attempts:</span>
              <b>
                {currentAttempt}/{attemptLimit || '∞'}
              </b>
            </div>

            <div className="mcq-exam-stat-item">
              <span className="lbl">Total:</span>
              <b>{paper.length}</b>
            </div>

            <div className="mcq-exam-stat-item">
              <span className="lbl">Marks:</span>
              <b>{totalMarks}</b>
            </div>

            <div className="mcq-exam-stat-item">
              <span className="lbl">Negative:</span>
              <b>{negVal ? `-${negVal}` : 'None'}</b>
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
            {/* Left Panel: Question Navigator */}
            <aside className="mcq-panel-navigator" aria-label="Question Navigator">
              <h3 className="mcq-panel-title">
                <LuBookmark /> Question Navigator
              </h3>

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
                      onClick={() => setIdx(i)}
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
                  <span>Answered ({answeredCount})</span>
                </div>
                <div className="legend-row">
                  <span className="box unanswered" />
                  <span>Not Answered ({unansweredCount})</span>
                </div>
                <div className="legend-row">
                  <span className="box marked" />
                  <span>Marked for Review ({markedCount})</span>
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
            </aside>

            {/* Center Panel: Question, Options & Actions */}
            <main className="mcq-panel-question" aria-label="Current Question">
              {curQ && (
                <>
                  <div className="mcq-question-header">
                    <span className="mcq-q-count">
                      Question {idx + 1} of {paper.length}
                    </span>
                    <div className="d-flex gap-1">
                      <button
                        type="button"
                        className="btn ui-btn ui-btn-ghost btn-sm p-1"
                        disabled={idx === 0}
                        onClick={() => setIdx((i) => Math.max(0, i - 1))}
                        aria-label="Previous question"
                      >
                        <LuChevronLeft />
                      </button>
                      <button
                        type="button"
                        className="btn ui-btn ui-btn-ghost btn-sm p-1"
                        disabled={idx === paper.length - 1}
                        onClick={() => setIdx((i) => Math.min(paper.length - 1, i + 1))}
                        aria-label="Next question"
                      >
                        <LuChevronRight />
                      </button>
                    </div>
                  </div>

                  <div className="mcq-question-content">
                    <h4 className="mcq-question-text">
                      <span className="q-num">{idx + 1}. </span>
                      <RichHtml as="span" value={curQ.question} />
                    </h4>

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
                            <span className="opt-text">
                              <RichHtml as="span" value={curQ.options[oi]} />
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="mcq-review-check">
                      <label className="d-inline-flex align-items-center gap-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={!!marked[curQ.id]}
                          onChange={() => toggleMarkForReview(curQ.id)}
                        />
                        <span>Mark for Review</span>
                      </label>
                    </div>
                  </div>

                  <div className="mcq-question-footer">
                    <button
                      type="button"
                      className="btn ui-btn ui-btn-secondary"
                      disabled={idx === 0}
                      onClick={() => setIdx((i) => i - 1)}
                    >
                      <LuArrowLeft /> Previous
                    </button>
                    <button
                      type="button"
                      className="btn ui-btn ui-btn-primary"
                      disabled={idx === paper.length - 1}
                      onClick={() => setIdx((i) => i + 1)}
                    >
                      Next Question <LuArrowRight />
                    </button>
                  </div>
                </>
              )}
            </main>

            {/* Right Panel: Exam Information, Instructions & Submit */}
            <aside className="mcq-panel-info" aria-label="Exam Information">
              <div className="mcq-info-card">
                <h4 className="info-card-title">
                  <LuInfo /> Exam Information
                </h4>
                <div className="info-kv-row">
                  <span>Total Questions</span>
                  <b>{paper.length}</b>
                </div>
                <div className="info-kv-row">
                  <span>Total Marks</span>
                  <b>{totalMarks}</b>
                </div>
                <div className="info-kv-row">
                  <span>Negative Marking</span>
                  <b>{negVal ? `-${negVal}` : 'None'}</b>
                </div>
                <div className="info-kv-row">
                  <span>Time Limit</span>
                  <b>{timeLimitMin} Minutes</b>
                </div>
                <div className="info-kv-row">
                  <span>Attempts Allowed</span>
                  <b>{attemptLimit || 'Unlimited'}</b>
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
          /* Result Screen (Requirement 6) */
          <div className="mcq-result-screen">
            <div className={`mcq-result-banner ${result?.passed ? 'passed' : 'failed'}`}>
              <div className="result-trophy">
                <LuTrophy />
              </div>
              <div>
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
                <div>
                  <b>{result?.correct}</b>
                  <span>Correct</span>
                </div>
              </div>
              <div className="res-stat-card bad">
                <LuCircleX />
                <div>
                  <b>{result?.wrong}</b>
                  <span>Incorrect</span>
                </div>
              </div>
              <div className="res-stat-card skip">
                <LuCircleAlert />
                <div>
                  <b>{result?.skipped}</b>
                  <span>Unanswered</span>
                </div>
              </div>
              <div className="res-stat-card time">
                <LuClock />
                <div>
                  <b>{fmt(result?.timeTaken || 0)}</b>
                  <span>Time Taken</span>
                </div>
              </div>
            </div>

            {/* Answer Review Section */}
            <div className="mcq-result-review-section">
              <div className="review-head">
                <h4 className="review-title mb-0">Question Breakdown & Solutions</h4>
                {paper.some(hasOptionExplanations) && (
                  <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={() => { setShowAllExp((v) => !v); setOpenExp({}) }} aria-pressed={showAllExp}>
                    {showAllExp ? 'Hide all explanations' : 'Show all explanations'}
                  </button>
                )}
              </div>
              <div className="review-list">
                {paper.map((q, i) => {
                  const ans = answers[q.id]
                  const answered = isAnswered(ans)
                  const right = answered && isCorrect(q, ans)
                  const canExp = hasOptionExplanations(q)
                  const expOn = canExp && (openExp[q.id] ?? showAllExp)
                  return (
                    <div
                      key={q.id}
                      className={`review-item ${!answered ? 'skipped' : right ? 'correct' : 'wrong'}`}
                    >
                      <div className="review-q-head">
                        <b>Question {i + 1}:</b>
                        <span className="ms-2">
                          <RichHtml as="span" value={q.question} />
                        </span>
                        <span className={`review-badge ${!answered ? 'skipped' : right ? 'correct' : 'wrong'}`}>
                          {!answered ? 'Unanswered' : right ? `+${questionMarks(q, settings)}` : `-${questionNegative(q, settings)}`}
                        </span>
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
                              <span className="bubble">{L[k]}</span>
                              <span><RichHtml as="span" value={q.options[oi]} /></span>
                              {isSol && <span className="ms-auto text-success fw-bold">✓ Correct</span>}
                              {picked && !isSol && <span className="ms-auto text-danger fw-bold">✗ Selected</span>}
                              {expOn && String(q.optionExplanations?.[oi] || '').trim() !== '' && (
                                <div className="review-opt-exp w-100">
                                  <b>Why {L[k]}?</b> <RichHtml as="span" value={q.optionExplanations[oi]} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {q.explanation && (
                        <div className="review-explanation">
                          <b>Solution:</b> <RichHtml as="span" value={q.explanation} />
                        </div>
                      )}
                      {canExp && (
                        <button type="button" className="btn ui-btn ui-btn-ghost btn-sm mt-2" onClick={() => setOpenExp((m) => ({ ...m, [q.id]: !expOn }))} aria-expanded={expOn}>
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

        {/* Confirmation Exit Warning (Requirement 5) */}
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
              <div className="d-flex gap-2 justify-content-center">
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
                {markedCount > 0 && <span> (<b>{markedCount}</b> marked for review).</span>}
                <br />
                Once submitted, you cannot change your answers.
              </p>
              <div className="d-flex gap-2 justify-content-center">
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
