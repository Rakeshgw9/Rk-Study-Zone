import { jsonError, uid } from './id'

export const DEFAULT_MCQ_SETTINGS = {
  totalQuestions: 0, // 0 = all
  marksPerQuestion: 1,
  negativeMarking: true, negativeValue: 0.25,
  attemptLimit: 3,
  timeLimitOn: true, timeLimit: 15,
  autoSubmit: true, showSolution: true,
  randomizeQuestions: false, randomizeOptions: false, allowPause: true,
}
export const DEFAULT_MCQ_DISPLAY = { oneAtATime: true, showProgressBar: true, showTimer: true, showQuestionNav: true, allowSkip: true, accent: '#2563eb' }
export const DEFAULT_MCQ_RESULT = { passPercent: 40, showScore: true, showCorrectAnswers: true, passMessage: 'Great job! You passed.', failMessage: 'Keep practising — you can do it!' }

const q = (question, options, answer, explanation = '') => ({ id: uid('q'), question, options, answer, explanation })
export const SAMPLE_QUESTIONS = () => [
  q('Which of the following is the correct meaning of Physical Education?', ['Only physical exercises', 'Development of the body only', 'A systematic process for all-round development', 'Training for sports competition only'], 2, 'Physical Education aims at the all-round development — physical, mental, social and emotional.'),
  q('The main aim of Physical Education is…', ['Winning medals', 'All-round development of the individual', 'Building muscles', 'Recreation only'], 1, 'The aim is the total (all-round) development of personality.'),
  q('Which one is NOT a component of physical fitness?', ['Strength', 'Speed', 'Flexibility', 'Intelligence quotient'], 3, 'IQ is a mental measure, not a physical fitness component.'),
  q('Physical Education helps in…', ['Only physical growth', 'Social and emotional development as well', 'Only academic marks', 'None of these'], 1),
  q('“Physical Education is that phase of general education which deals with large muscle activities” — said by:', ['J. B. Nash', 'C. C. Cowell', 'Clarke H. Harrison', 'Charles Bucher'], 0),
]

export const MCQ_JSON_HELP = `{
  "title": "Chapter Practice Test",
  "description": "Attempt the following MCQs.",
  "questions": [
    {
      "question": "Question text?",
      "options": ["A", "B", "C", "D"],
      "answer": 2,            // index (0 = first) or "C" / option text
      "explanation": "optional"
    }
  ]
}`

/** Normalise any accepted answer format to an index */
function answerIndex(ans, options) {
  if (typeof ans === 'number') return ans
  if (typeof ans === 'string') {
    const t = ans.trim()
    if (/^[A-Ha-h]$/.test(t)) return t.toUpperCase().charCodeAt(0) - 65
    if (/^\d+$/.test(t)) return Number(t)
    const i = options.findIndex((o) => String(o).trim().toLowerCase() === t.toLowerCase())
    return i
  }
  return -1
}

export function validateQuestions(questions) {
  const errors = []
  if (!Array.isArray(questions) || questions.length === 0) return ['Add at least one question.']
  questions.forEach((qq, i) => {
    const n = i + 1
    if (!qq.question || !String(qq.question).trim()) errors.push(`Q${n}: question text is empty.`)
    const opts = (qq.options || []).filter((o) => String(o).trim() !== '')
    if (opts.length < 2) errors.push(`Q${n}: needs at least 2 options.`)
    if (!(Number.isInteger(qq.answer) && qq.answer >= 0 && qq.answer < (qq.options || []).length && String(qq.options[qq.answer] || '').trim())) errors.push(`Q${n}: select the correct answer.`)
  })
  return errors
}

/** Parse MCQ JSON text → { ok, data:{title,description,questions}, errors } */
export function parseMcqJson(text) {
  if (!text || !text.trim()) return { ok: false, errors: ['JSON is empty.'] }
  let raw
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1')
  try { raw = JSON.parse(cleaned) } catch (e) { return { ok: false, errors: [jsonError(cleaned, e).message] } }
  const list = Array.isArray(raw) ? raw : raw.questions
  if (!Array.isArray(list)) return { ok: false, errors: ['Expected a "questions" array (or a top-level array).'] }
  const questions = list.map((x) => {
    const options = Array.isArray(x.options) ? x.options.map(String) : ['A', 'B', 'C', 'D'].map((k) => x[k] ?? x[k.toLowerCase()]).filter((v) => v !== undefined).map(String)
    return { id: uid('q'), question: String(x.question ?? x.q ?? ''), options, answer: answerIndex(x.answer ?? x.correct ?? x.ans, options), explanation: String(x.explanation ?? x.solution ?? '') }
  })
  const errors = validateQuestions(questions)
  return { ok: errors.length === 0, errors, data: { title: Array.isArray(raw) ? undefined : raw.title, description: Array.isArray(raw) ? undefined : raw.description, questions } }
}

export function exportMcqJson(block) {
  return JSON.stringify({
    title: block.data.title, description: block.data.description,
    questions: block.data.questions.map(({ question, options, answer, explanation }) => ({ question, options, answer, explanation })),
  }, null, 2)
}

export function shuffle(arr, seed = Math.random) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(seed() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

/** Builds the paper a student will attempt (applies randomize / total questions) */
export function buildPaper(data) {
  const s = { ...DEFAULT_MCQ_SETTINGS, ...data.settings }
  let qs = data.questions.map((x) => ({ ...x, order: x.options.map((_, i) => i) }))
  if (s.randomizeQuestions) qs = shuffle(qs)
  if (s.totalQuestions > 0) qs = qs.slice(0, s.totalQuestions)
  if (s.randomizeOptions) qs = qs.map((x) => ({ ...x, order: shuffle(x.order) }))
  return qs
}

export function scorePaper(paper, answers, settings) {
  const s = { ...DEFAULT_MCQ_SETTINGS, ...settings }
  let correct = 0; let wrong = 0; let skipped = 0
  paper.forEach((x) => { const a = answers[x.id]; if (a === undefined || a === null) skipped++; else if (a === x.answer) correct++; else wrong++ })
  const marks = Number(s.marksPerQuestion) || 1
  const neg = s.negativeMarking ? Number(s.negativeValue) || 0 : 0
  const score = Math.max(0, correct * marks - wrong * neg)
  const total = paper.length * marks
  return { correct, wrong, skipped, score: Math.round(score * 100) / 100, total, percent: total ? Math.round((score / total) * 100) : 0 }
}
