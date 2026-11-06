import { useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowLeft, LuArrowRight, LuCircleCheck, LuCircleX, LuClock, LuFlag, LuPause, LuPlay, LuRotateCcw, LuSkipForward, LuTrophy } from 'react-icons/lu'
import { DEFAULT_MCQ_DISPLAY, DEFAULT_MCQ_RESULT, DEFAULT_MCQ_SETTINGS, buildPaper, scorePaper } from '../../lib/mcq'

const L = 'ABCDEFGH'
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/**
 * MCQ test player.
 * mode: 'preview' (CMS — no limits saved) | 'student'
 * attemptsUsed: number, onSubmit(result)
 */
export default function McqPlayer({ data, mode = 'student', attemptsUsed = 0, lastResult, onSubmit, compact = false, autoStart = false }) {
  const s = { ...DEFAULT_MCQ_SETTINGS, ...data.settings }
  const d = { ...DEFAULT_MCQ_DISPLAY, ...data.display }
  const r = { ...DEFAULT_MCQ_RESULT, ...data.result }
  const limit = Number(s.attemptLimit) || 0
  const left = limit ? Math.max(0, limit - attemptsUsed) : Infinity
  const [phase, setPhase] = useState(autoStart ? 'run' : 'intro')
  const [paperSeed, setPaperSeed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paper = useMemo(() => buildPaper(data), [data, paperSeed])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [secs, setSecs] = useState(0)
  const [paused, setPaused] = useState(false)
  const [result, setResult] = useState(null)
  const submitted = useRef(false)

  const total = s.timeLimitOn ? Math.max(1, Number(s.timeLimit) || 1) * 60 : 0
  const remaining = total ? Math.max(0, total - secs) : secs

  useEffect(() => { if (phase !== 'run') return; setIdx(0); setAnswers({}); setSecs(0); setPaused(false); submitted.current = false }, [phase, paperSeed])
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
    setResult(res); setPhase('result'); onSubmit?.(res)
  }
  useEffect(() => { if (phase === 'run' && total && secs >= total && s.autoSubmit) finish() }) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { setPaperSeed((x) => x + 1); setResult(null); setPhase('run') }
  const accent = { '--mcq': d.accent || '#2563eb' }

  if (!paper.length) return <div className="mcq-box p-4 text-center text-muted" style={accent}>No questions added yet.</div>

  if (phase === 'intro') {
    return (
      <div className={`mcq-box mcq-intro ${compact ? 'compact' : ''}`} style={accent}>
        <div className="mcq-intro-icon"><LuFlag /></div>
        <h3>{data.title || 'Practice Test'}</h3>
        {data.description && <p className="text-muted mb-3">{data.description}</p>}
        <ul className="mcq-facts">
          <li><b>{paper.length}</b><span>Questions</span></li>
          <li><b>{(Number(s.marksPerQuestion) || 1) * paper.length}</b><span>Marks</span></li>
          <li><b>{s.timeLimitOn ? `${s.timeLimit} min` : 'No limit'}</b><span>Time</span></li>
          <li><b>{s.negativeMarking ? `-${s.negativeValue}` : 'None'}</b><span>Negative</span></li>
        </ul>
        {lastResult && <div className="mcq-last">Last score: <b>{lastResult.score}/{lastResult.total}</b> ({lastResult.percent}%)</div>}
        {mode === 'student' && limit > 0 && <div className="small text-muted mb-2">Attempts left: <b>{left}</b> of {limit}</div>}
        <button className="btn mcq-btn-primary" disabled={mode === 'student' && left <= 0} onClick={start}>
          <LuPlay /> {left <= 0 && mode === 'student' ? 'No attempts left' : lastResult ? 'Start Again' : 'Start Test'}
        </button>
      </div>
    )
  }

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
        {(s.showSolution || r.showCorrectAnswers) && !compact && (
          <ol className="mcq-review">
            {paper.map((x) => {
              const a = answers[x.id]
              return (
                <li key={x.id}>
                  <div className="q">{x.question}</div>
                  <div className="opts">
                    {x.order.map((oi, k) => (
                      <span key={oi} className={`o ${oi === x.answer ? 'right' : ''} ${a === oi && a !== x.answer ? 'wrong' : ''}`}>{L[k]}. {x.options[oi]}</span>
                    ))}
                  </div>
                  {s.showSolution && x.explanation && <div className="exp"><b>Solution:</b> {x.explanation}</div>}
                </li>
              )
            })}
          </ol>
        )}
        <div className="d-flex gap-2 justify-content-center flex-wrap mt-3">
          {(mode === 'preview' || left - 1 > 0 || limit === 0) && <button className="btn mcq-btn-primary" onClick={start}><LuRotateCcw /> Try Again</button>}
          <button className="btn mcq-btn-ghost" onClick={() => setPhase('intro')}>Done</button>
        </div>
      </div>
    )
  }

  const q = paper[idx]
  const answered = Object.keys(answers).length
  const choose = (oi) => setAnswers((a) => ({ ...a, [q.id]: oi }))
  const last = idx === paper.length - 1

  const QuestionView = ({ x, n }) => (
    <div className="mcq-q">
      <div className="mcq-qtext"><span className="n">{n}.</span> {x.question}</div>
      <div className="mcq-opts" role="radiogroup">
        {x.order.map((oi, k) => (
          <button key={oi} type="button" role="radio" aria-checked={answers[x.id] === oi} className={`mcq-opt ${answers[x.id] === oi ? 'on' : ''}`} onClick={() => setAnswers((a) => ({ ...a, [x.id]: oi }))} disabled={paused}>
            <span className="l">{L[k]}</span><span>{x.options[oi]}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className={`mcq-box mcq-run ${compact ? 'compact' : ''}`} style={accent}>
      <div className="mcq-top">
        <span className="qn">{d.oneAtATime ? <>Question <b>{idx + 1}</b> of {paper.length}</> : <>{answered} / {paper.length} answered</>}</span>
        <span className="d-flex align-items-center gap-2">
          {d.showTimer && <span className={`mcq-timer ${total && remaining < 60 ? 'low' : ''}`}><LuClock /> {fmt(remaining)}</span>}
          {s.allowPause && <button className="mcq-icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <LuPlay /> : <LuPause />}</button>}
        </span>
      </div>
      {d.showProgressBar && <div className="mcq-progress"><span style={{ width: `${((d.oneAtATime ? idx + 1 : answered) / paper.length) * 100}%` }} /></div>}
      {paused ? <div className="mcq-paused"><LuPause /> Paused — press play to continue.</div> : d.oneAtATime ? QuestionView({ x: q, n: idx + 1 }) : paper.map((x, i) => <div key={x.id}>{QuestionView({ x, n: i + 1 })}</div>)}
      {d.oneAtATime && d.showQuestionNav && !compact && (
        <div className="mcq-nav">{paper.map((x, i) => <button key={x.id} className={`${i === idx ? 'cur' : ''} ${answers[x.id] !== undefined ? 'done' : ''}`} onClick={() => setIdx(i)} aria-label={`Question ${i + 1}`}>{i + 1}</button>)}</div>
      )}
      <div className="mcq-actions">
        {d.oneAtATime ? (
          <>
            <button className="btn mcq-btn-ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}><LuArrowLeft /> Previous</button>
            <div className="d-flex gap-2">
              {d.allowSkip && !last && <button className="btn mcq-btn-ghost" onClick={() => { setAnswers((a) => { const n = { ...a }; delete n[q.id]; return n }); setIdx((i) => i + 1) }}>Skip <LuSkipForward /></button>}
              {last ? <button className="btn mcq-btn-primary" onClick={finish}><LuFlag /> Submit</button>
                : <button className="btn mcq-btn-primary" onClick={() => setIdx((i) => i + 1)} disabled={!d.allowSkip && answers[q.id] === undefined}>Next <LuArrowRight /></button>}
            </div>
          </>
        ) : <button className="btn mcq-btn-primary ms-auto" onClick={finish}><LuFlag /> Submit</button>}
      </div>
      {choose && null}
    </div>
  )
}
