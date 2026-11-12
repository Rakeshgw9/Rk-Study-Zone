import { useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowLeft, LuArrowRight, LuBookmark, LuCircleCheck, LuCircleX, LuClock, LuEraser, LuFlag, LuLightbulb, LuPause, LuPlay, LuRotateCcw, LuSkipForward, LuTrophy } from 'react-icons/lu'
import { DEFAULT_MCQ_DISPLAY, DEFAULT_MCQ_RESULT, DEFAULT_MCQ_SETTINGS, buildPaper, isAnswered, isCorrect, questionMarks, questionNegative, scorePaper } from '../../lib/mcq'
import { RichHtml } from '../ui/RichText'

const L = 'ABCDEFGH'
const fmt = (s) => `${String(Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : '')}${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const EXAM_RULES = ['Read every question carefully before answering.', 'Use “Mark for Review” for questions you want to revisit; marked questions are still evaluated if answered.', 'You can move between questions with the palette, Previous and Next.', 'The exam is submitted automatically when the timer ends.', 'Do not refresh or close the page during the exam.']
const safeImg = (u = '') => (/^(https?:\/\/|data:image\/)/i.test(u) ? u : '')

/**
 * MCQ test player (practice test and chapter exam).
 * mode: 'preview' (CMS — nothing saved) | 'student'      exam: { instructions } turns on the full chapter-exam experience
 */
export default function McqPlayer({ data, mode = 'student', attemptsUsed = 0, lastResult, onSubmit, compact = false, autoStart = false, exam = null, onClose, onPhase }) {
  const s = { ...DEFAULT_MCQ_SETTINGS, ...data.settings, ...(exam ? { autoSubmit: true } : {}) }
  const d = { ...DEFAULT_MCQ_DISPLAY, ...data.display, ...(exam ? { oneAtATime: true, showQuestionNav: true, showTimer: true } : {}) }
  const r = { ...DEFAULT_MCQ_RESULT, ...data.result }
  const limit = Number(s.attemptLimit) || 0
  const left = limit ? Math.max(0, limit - attemptsUsed) : Infinity
  const [phase, setPhase] = useState(autoStart ? 'run' : 'intro')
  const [paperSeed, setPaperSeed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paper = useMemo(() => buildPaper(data), [data, paperSeed])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [marked, setMarked] = useState({})
  const [visited, setVisited] = useState({})
  const [hints, setHints] = useState({})
  const [secs, setSecs] = useState(0)
  const [paused, setPaused] = useState(false)
  const [result, setResult] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [agree, setAgree] = useState(false)
  const submitted = useRef(false)
  useEffect(() => { onPhase?.(phase) }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = s.timeLimitOn ? Math.max(1, Number(s.timeLimit) || 1) * 60 : 0
  const remaining = total ? Math.max(0, total - secs) : secs
  const allMarks = paper.reduce((n, x) => n + questionMarks(x, s), 0)

  useEffect(() => { if (phase !== 'run') return; setIdx(0); setAnswers({}); setMarked({}); setVisited({}); setHints({}); setSecs(0); setPaused(false); setConfirming(false); submitted.current = false }, [phase, paperSeed])
  useEffect(() => { if (phase === 'run' && paper[idx]) setVisited((v) => (v[paper[idx].id] ? v : { ...v, [paper[idx].id]: true })) }, [phase, idx, paper])
  useEffect(() => {
    if (phase !== 'run' || paused) return
    const t = setInterval(() => setSecs((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [phase, paused])

  const finish = () => {
    if (submitted.current) return
    submitted.current = true
    const res = { ...scorePaper(paper, answers, s), timeTaken: secs, at: Date.now() }
    res.passed = res.percent >= (Number(r.passPercent) || 0)
    setResult(res); setConfirming(false); setPhase('result'); onSubmit?.(res)
  }
  useEffect(() => { if (phase === 'run' && total && secs >= total && s.autoSubmit) finish() }) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { setPaperSeed((x) => x + 1); setResult(null); setPhase('run') }
  const accent = { '--mcq': d.accent || '#2563eb' }
  const selected = (x, oi) => (x.type === 'multiple' ? (answers[x.id] || []).includes(oi) : answers[x.id] === oi)
  const choose = (x, oi) => setAnswers((a) => {
    if (x.type !== 'multiple') return { ...a, [x.id]: oi }
    const cur = Array.isArray(a[x.id]) ? a[x.id] : []; const next = cur.includes(oi) ? cur.filter((v) => v !== oi) : [...cur, oi]
    const n = { ...a }; if (next.length) n[x.id] = next; else delete n[x.id]; return n
  })
  const clearAnswer = (x) => setAnswers((a) => { const n = { ...a }; delete n[x.id]; return n })
  const isRight = (x, oi) => (x.type === 'multiple' ? x.answers.includes(oi) : oi === x.answer)

  if (!paper.length) return <div className="mcq-box p-4 text-center text-muted" style={accent}>No questions added yet.</div>

  /* ------------------------------------------------------------ intro */
  if (phase === 'intro') {
    const facts = (
      <ul className="mcq-facts">
        <li><b>{paper.length}</b><span>Questions</span></li>
        <li><b>{allMarks}</b><span>Marks</span></li>
        <li><b>{s.timeLimitOn ? `${s.timeLimit} min` : 'No limit'}</b><span>Time</span></li>
        <li><b>{s.negativeMarking ? `−${s.negativeValue}` : 'None'}</b><span>Negative</span></li>
      </ul>
    )
    const startBtn = (
      <button className="btn mcq-btn-primary" disabled={(mode === 'student' && left <= 0) || (exam && !agree)} onClick={start}>
        <LuPlay /> {left <= 0 && mode === 'student' ? 'No attempts left' : exam ? 'Start Exam' : lastResult ? 'Start Again' : 'Start Test'}
      </button>
    )
    const meta = (
      <>
        {lastResult && <div className="mcq-last">Last score: <b>{lastResult.score}/{lastResult.total}</b> ({lastResult.percent}%)</div>}
        {mode === 'student' && limit > 0 && <div className="small text-muted mb-2">Attempts left: <b>{left}</b> of {limit}</div>}
      </>
    )
    if (exam) {
      return (
        <div className="mcq-box mcq-intro mcq-exam-intro" style={accent}>
          <div className="mcq-intro-icon"><LuFlag /></div>
          <h3>{data.title || 'Chapter Examination'}</h3>
          {data.description && <p className="text-muted mb-3">{data.description}</p>}
          {facts}
          <div className="mcq-instructions">
            <h4>Instructions</h4>
            {exam.instructions ? <RichHtml className="mcq-instr-custom" value={exam.instructions} /> : null}
            <ul>{EXAM_RULES.map((t) => <li key={t}>{t}</li>)}
              {s.negativeMarking && <li><b>Negative marking:</b> {s.negativeValue} mark{Number(s.negativeValue) === 1 ? '' : 's'} will be deducted for each wrong answer (unless a question says otherwise).</li>}
              {s.timeLimitOn && <li>Time allowed: <b>{s.timeLimit} minutes</b>.</li>}
              {limit > 0 && <li>Attempts allowed: <b>{limit}</b> (you have <b>{left === Infinity ? limit : left}</b> left).</li>}
            </ul>
          </div>
          {meta}
          <label className="mcq-agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read and understood the instructions.</label>
          <div className="d-flex gap-2 justify-content-center flex-wrap">{onClose && <button className="btn mcq-btn-ghost" onClick={onClose}>Cancel</button>}{startBtn}</div>
        </div>
      )
    }
    const first = paper[0]
    return (
      <div className={`mcq-box mcq-intro ${compact ? 'compact' : 'mcq-intro-split'}`} style={accent}>
        <div className="mcq-info">
          <div className="mcq-intro-icon"><LuFlag /></div>
          <h3>{data.title || 'Practice Test'}</h3>
          {data.description && <p className="text-muted mb-3">{data.description}</p>}
          {facts}{meta}{startBtn}
        </div>
        {!compact && first && (
          <div className="mcq-side" aria-hidden="true">
            <div className="mcq-top"><span className="qn">Q <b>1</b> of {paper.length}</span>{s.timeLimitOn && <span className="mcq-timer"><LuClock /> {fmt(total)}</span>}</div>
            <div className="mcq-qtext"><span className="n">1.</span> <RichHtml as="span" value={first.question} /></div>
            <div className="mcq-opts">{first.order.slice(0, 4).map((oi, k) => <span key={oi} className="mcq-opt"><span className="l">{L[k]}</span><RichHtml as="span" value={first.options[oi]} /></span>)}</div>
          </div>
        )}
      </div>
    )
  }

  /* ------------------------------------------------------------ result */
  if (phase === 'result' && result) {
    return (
      <div className={`mcq-box mcq-result ${compact ? 'compact' : ''}`} style={accent}>
        <div className={`mcq-score ${result.passed ? 'pass' : 'fail'}`}>
          <LuTrophy />
          <div>
            {r.showScore && <div className="big">{result.score} / {result.total}</div>}
            <div className="pct">{result.percent}% · {result.passed ? 'Passed' : 'Not passed'}</div>
          </div>
        </div>
        <p className="mb-3 fw-semibold">{result.passed ? r.passMessage : r.failMessage}</p>
        <div className="mcq-counts">
          <span className="ok"><LuCircleCheck /> {result.correct} Correct</span>
          <span className="bad"><LuCircleX /> {result.wrong} Wrong</span>
          <span><LuSkipForward /> {result.skipped} Skipped</span>
          <span><LuClock /> {fmt(result.timeTaken)}</span>
        </div>
        {s.negativeMarking && result.wrong > 0 && <p className="small text-muted mb-2">Negative marking applied to {result.wrong} wrong answer{result.wrong > 1 ? 's' : ''}.</p>}
        {(s.showSolution || r.showCorrectAnswers) && !compact && (
          <ol className="mcq-review">
            {paper.map((x) => {
              const a = answers[x.id]; const ok = isAnswered(a) && isCorrect(x, a)
              return (
                <li key={x.id} className={!isAnswered(a) ? 'skip' : ok ? 'ok' : 'bad'}>
                  <div className="q"><RichHtml as="span" value={x.question} /> <small className="mcq-q-score">{!isAnswered(a) ? 'Not answered' : ok ? `+${questionMarks(x, s)}` : `−${questionNegative(x, s)}`}</small></div>
                  {safeImg(x.image) && <img className="mcq-img" src={safeImg(x.image)} alt="" />}
                  <div className="opts">
                    {x.order.map((oi, k) => {
                      const picked = x.type === 'multiple' ? (a || []).includes(oi) : a === oi
                      return <span key={oi} className={`o ${r.showCorrectAnswers && isRight(x, oi) ? 'right' : ''} ${picked && !isRight(x, oi) ? 'wrong' : ''} ${picked ? 'picked' : ''}`}>{L[k]}. <RichHtml as="span" value={x.options[oi]} />{s.showSolution && String(x.optionExplanations?.[oi] || '').trim() !== '' && <small className="d-block mcq-opt-exp"><b>Why {L[k]}?</b> <RichHtml as="span" value={x.optionExplanations[oi]} /></small>}</span>
                    })}
                  </div>
                  {s.showSolution && x.explanation && <div className="exp"><b>Solution:</b> <RichHtml as="span" value={x.explanation} /></div>}
                </li>
              )
            })}
          </ol>
        )}
        <div className="d-flex gap-2 justify-content-center flex-wrap mt-3">
          {(mode === 'preview' || left - 1 > 0 || limit === 0) && <button className="btn mcq-btn-primary" onClick={() => { setAgree(true); start() }}><LuRotateCcw /> {exam ? 'Retake Exam' : 'Try Again'}</button>}
          <button className="btn mcq-btn-ghost" onClick={() => { if (exam && onClose) onClose(); else setPhase('intro') }}>Done</button>
        </div>
      </div>
    )
  }

  /* ------------------------------------------------------------ running */
  const q = paper[idx]
  const answeredCount = paper.filter((x) => isAnswered(answers[x.id])).length
  const markedCount = paper.filter((x) => marked[x.id]).length
  const last = idx === paper.length - 1
  const goSubmit = () => { if (exam || answeredCount < paper.length || markedCount) setConfirming(true); else finish() }
  const navClass = (x, i) => `${i === idx ? 'cur' : ''} ${isAnswered(answers[x.id]) ? 'done' : ''} ${marked[x.id] ? 'marked' : ''} ${visited[x.id] && !isAnswered(answers[x.id]) ? 'seen' : ''}`

  const renderQuestion = (x, n) => (
    <div className="mcq-q">
      <div className="mcq-qtext">{d.showQuestionNumbers && <span className="n">{n}.</span>} <RichHtml as="span" value={x.question} />
        <small className="mcq-q-score" title="Marks for this question">+{questionMarks(x, s)}{s.negativeMarking && questionNegative(x, s) > 0 ? ` / −${questionNegative(x, s)}` : ''}</small></div>
      {x.type === 'multiple' && <div className="mcq-multi-note">Select all correct answers</div>}
      {safeImg(x.image) && <img className="mcq-img" src={safeImg(x.image)} alt="Question illustration" />}
      <div className="mcq-opts" role={x.type === 'multiple' ? 'group' : 'radiogroup'}>
        {x.order.map((oi, k) => (
          <button key={oi} type="button" role={x.type === 'multiple' ? 'checkbox' : 'radio'} aria-checked={selected(x, oi)} className={`mcq-opt ${selected(x, oi) ? 'on' : ''} ${x.type === 'multiple' ? 'multi' : ''}`} onClick={() => choose(x, oi)} disabled={paused}>
            <span className="l">{L[k]}</span><RichHtml as="span" value={x.options[oi]} />
          </button>
        ))}
      </div>
      {d.showHints && x.hint && (hints[x.id] ? <div className="mcq-hint"><LuLightbulb /> <RichHtml as="span" value={x.hint} /></div> : <button type="button" className="mcq-hint-btn" onClick={() => setHints((h) => ({ ...h, [x.id]: true }))}><LuLightbulb /> Show hint</button>)}
    </div>
  )

  if (confirming) {
    return (
      <div className="mcq-box mcq-confirm" style={accent}>
        <h3>Submit {exam ? 'exam' : 'test'}?</h3>
        <ul className="mcq-facts">
          <li><b>{answeredCount}</b><span>Answered</span></li>
          <li><b>{paper.length - answeredCount}</b><span>Not answered</span></li>
          <li><b>{markedCount}</b><span>Marked for review</span></li>
          <li><b>{total ? fmt(remaining) : fmt(secs)}</b><span>{total ? 'Time left' : 'Time taken'}</span></li>
        </ul>
        <p className="text-muted">Once submitted you cannot change your answers.</p>
        <div className="d-flex gap-2 justify-content-center flex-wrap"><button className="btn mcq-btn-ghost" onClick={() => setConfirming(false)}>Continue {exam ? 'exam' : 'test'}</button><button className="btn mcq-btn-primary" onClick={finish}><LuFlag /> Submit now</button></div>
      </div>
    )
  }

  return (
    <div className={`mcq-box mcq-run ${compact ? 'compact' : ''} ${exam ? 'mcq-exam-run' : ''}`} style={accent}>
      <div className="mcq-top">
        <span className="qn">{d.oneAtATime ? <>Question <b>{idx + 1}</b> of {paper.length}</> : <>{answeredCount} / {paper.length} answered</>}</span>
        <span className="d-flex align-items-center gap-2">
          {d.showTimer && <span className={`mcq-timer ${total && remaining < 60 ? 'low' : ''}`} aria-live="off"><LuClock /> {fmt(remaining)}</span>}
          {s.allowPause && !exam && <button className="mcq-icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <LuPlay /> : <LuPause />}</button>}
        </span>
      </div>
      {d.showProgressBar && <div className="mcq-progress"><span style={{ width: `${((d.oneAtATime ? idx + 1 : answeredCount) / paper.length) * 100}%` }} /></div>}
      <div className={exam ? 'mcq-exam-body' : ''}>
        <div className="mcq-exam-main">
          {paused ? <div className="mcq-paused"><LuPause /> Paused — press play to continue.</div> : d.oneAtATime ? renderQuestion(q, idx + 1) : paper.map((x, i) => <div key={x.id}>{renderQuestion(x, i + 1)}</div>)}
          <div className="mcq-actions">
            {d.oneAtATime ? (
              <>
                <button className="btn mcq-btn-ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}><LuArrowLeft /> Previous</button>
                <div className="d-flex gap-2 flex-wrap justify-content-end">
                  {d.allowClear && <button className="btn mcq-btn-ghost" disabled={!isAnswered(answers[q.id])} onClick={() => clearAnswer(q)}><LuEraser /> Clear</button>}
                  {d.allowReview && <button className={`btn mcq-btn-ghost ${marked[q.id] ? 'is-marked' : ''}`} onClick={() => setMarked((m) => ({ ...m, [q.id]: !m[q.id] }))} aria-pressed={!!marked[q.id]}><LuBookmark /> {marked[q.id] ? 'Marked' : 'Mark for Review'}</button>}
                  {d.allowSkip && !last && !exam && <button className="btn mcq-btn-ghost" onClick={() => { clearAnswer(q); setIdx((i) => i + 1) }}>Skip <LuSkipForward /></button>}
                  {last ? <button className="btn mcq-btn-primary" onClick={goSubmit}><LuFlag /> Submit</button>
                    : <button className="btn mcq-btn-primary" onClick={() => setIdx((i) => i + 1)} disabled={!d.allowSkip && !isAnswered(answers[q.id])}>Next <LuArrowRight /></button>}
                </div>
              </>
            ) : <button className="btn mcq-btn-primary ms-auto" onClick={goSubmit}><LuFlag /> Submit</button>}
          </div>
        </div>
        {d.oneAtATime && d.showQuestionNav && !compact && (
          <aside className="mcq-palette" aria-label="Question palette">
            <div className="mcq-nav">{paper.map((x, i) => <button key={x.id} className={navClass(x, i)} onClick={() => setIdx(i)} aria-label={`Question ${i + 1}${marked[x.id] ? ', marked for review' : ''}${isAnswered(answers[x.id]) ? ', answered' : ''}`}>{i + 1}</button>)}</div>
            <div className="mcq-legend"><span><i className="done" /> Answered</span><span><i className="seen" /> Not answered</span><span><i className="marked" /> Marked</span><span><i /> Not visited</span></div>
            {exam && <button className="btn mcq-btn-primary w-100 mt-2" onClick={goSubmit}><LuFlag /> Submit Exam</button>}
          </aside>
        )}
      </div>
    </div>
  )
}
