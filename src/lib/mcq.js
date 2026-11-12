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
export const DEFAULT_MCQ_DISPLAY = { oneAtATime: true, showProgressBar: true, showTimer: true, showQuestionNav: true, allowSkip: true, allowReview: true, allowClear: true, showQuestionNumbers: true, showHints: true, accent: '#2563eb' }
export const DEFAULT_MCQ_EXAM = { enabled: false, examOnly: true, instructions: '' }
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard']
export const QUESTION_TYPES = [{ value: 'single', label: 'Single Choice (MCQ)' }, { value: 'multiple', label: 'Multiple Choice (select all)' }]
export const DEFAULT_MCQ_RESULT = { passPercent: 40, showScore: true, showCorrectAnswers: true, passMessage: 'Great job! You passed.', failMessage: 'Keep practising — you can do it!' }

export const blankQuestion = (over = {}) => ({ id: uid('q'), type: 'single', question: '', options: ['', '', '', ''], answer: -1, answers: [], explanation: '', hint: '', image: '', difficulty: 'Medium', marks: 0, negative: '', subject: '', ...over })
const q = (question, options, answer, explanation = '') => blankQuestion({ question, options, answer, explanation })
/** Fill missing fields on old questions so every editor/player can rely on them */
export const normalizeQuestion = (x = {}) => ({ ...blankQuestion(), ...x, options: Array.isArray(x.options) ? x.options : ['', '', '', ''], answers: Array.isArray(x.answers) ? x.answers : [], type: x.type === 'multiple' ? 'multiple' : 'single' })
export const isExamBlock = (b) => b?.type === 'mcq' && !!b.data?.exam?.enabled
export const isAnswered = (a) => (Array.isArray(a) ? a.length > 0 : a !== undefined && a !== null && a !== -1)
export const questionMarks = (x, s) => (Number(x.marks) > 0 ? Number(x.marks) : Number(s.marksPerQuestion) || 1)
export const questionNegative = (x, s) => (!s.negativeMarking ? 0 : (x.negative !== '' && x.negative !== undefined && x.negative !== null && !Number.isNaN(Number(x.negative)) ? Number(x.negative) : Number(s.negativeValue) || 0))
export const isCorrect = (x, a) => (x.type === 'multiple' ? Array.isArray(a) && a.length === x.answers.length && x.answers.every((i) => a.includes(i)) : a === x.answer)
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
      "type": "single",       // or "multiple" (then use "answers": [0, 2])
      "answer": 2,            // index (0 = first) or "C" / option text
      "explanation": "optional",
      "hint": "optional",
      "image": "https://… (optional)",
      "difficulty": "Easy | Medium | Hard",
      "marks": 1, "negative": 0.25, "subject": "Concept of PE"
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
  questions.forEach((raw, i) => {
    const qq = normalizeQuestion(raw); const n = i + 1
    if (!String(qq.question).trim()) errors.push(`Q${n}: question text is empty.`)
    const filled = (k) => String(qq.options[k] ?? '').trim() !== ''
    if (qq.options.filter((_, k) => filled(k)).length < 2) errors.push(`Q${n}: needs at least 2 options.`)
    if (qq.type === 'multiple') { if (!qq.answers.length || !qq.answers.every((k) => Number.isInteger(k) && k >= 0 && k < qq.options.length && filled(k))) errors.push(`Q${n}: select at least one correct answer.`) }
    else if (!(Number.isInteger(qq.answer) && qq.answer >= 0 && qq.answer < qq.options.length && filled(qq.answer))) errors.push(`Q${n}: select the correct answer.`)
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
    const rawAns = x.answers ?? (Array.isArray(x.answer) ? x.answer : undefined)
    const multiple = x.type === 'multiple' || Array.isArray(rawAns)
    const answers = multiple ? (Array.isArray(rawAns) ? rawAns : [x.answer ?? x.correct]).map((a) => answerIndex(a, options)).filter((n) => n >= 0) : []
    const marks = Number(x.marks); const neg = x.negative
    return blankQuestion({ question: String(x.question ?? x.q ?? ''), options, type: multiple ? 'multiple' : 'single', answer: multiple ? (answers[0] ?? -1) : answerIndex(x.answer ?? x.correct ?? x.ans, options), answers, explanation: String(x.explanation ?? x.solution ?? ''), hint: String(x.hint ?? ''), image: String(x.image ?? ''), difficulty: DIFFICULTIES.includes(x.difficulty) ? x.difficulty : 'Medium', marks: marks > 0 ? marks : 0, negative: neg === undefined || neg === null || neg === '' || Number.isNaN(Number(neg)) ? '' : Number(neg), subject: String(x.subject ?? x.topic ?? '') })
  })
  const errors = validateQuestions(questions)
  return { ok: errors.length === 0, errors, data: { title: Array.isArray(raw) ? undefined : raw.title, description: Array.isArray(raw) ? undefined : raw.description, questions } }
}

export function exportMcqJson(block) {
  return JSON.stringify({
    title: block.data.title, description: block.data.description,
    questions: block.data.questions.map((raw) => {
      const x = normalizeQuestion(raw); const o = { question: x.question, options: x.options }
      if (x.type === 'multiple') { o.type = 'multiple'; o.answers = x.answers } else o.answer = x.answer
      o.explanation = x.explanation
      if (x.hint) o.hint = x.hint
      if (x.image) o.image = x.image
      o.difficulty = x.difficulty
      if (x.marks) o.marks = x.marks
      if (x.negative !== '') o.negative = x.negative
      if (x.subject) o.subject = x.subject
      return o
    }),
  }, null, 2)
}

export const MCQ_TEMPLATES = [
  { id: 'single', label: 'Single choice (A–D)', desc: 'Classic four-option questions with explanation.', json: { title: 'Chapter Practice Test', description: 'Choose the best answer.', questions: [{ question: 'Which of the following is the primary aim of Physical Education?', options: ['To develop mental and social harmony', 'To provide academic knowledge', 'To improve reading and writing skills', 'To reduce classroom workload'], answer: 0, explanation: 'Physical Education aims at all-round development.', difficulty: 'Easy', subject: 'Concept of PE' }] } },
  { id: 'multiple', label: 'Multiple correct answers', desc: 'Select-all-that-apply questions.', json: { title: 'Select all that apply', description: 'More than one option can be correct.', questions: [{ type: 'multiple', question: 'Which of these are components of physical fitness?', options: ['Strength', 'Speed', 'Flexibility', 'Intelligence quotient'], answers: [0, 1, 2], explanation: 'IQ is a mental measure.', difficulty: 'Medium' }] } },
  { id: 'truefalse', label: 'True / False', desc: 'Two-option statements.', json: { title: 'True or False', description: 'Decide whether each statement is true.', questions: [{ question: 'Physical Education develops only the body.', options: ['True', 'False'], answer: 1, explanation: 'It develops body, mind and social skills.', difficulty: 'Easy' }] } },
  { id: 'advanced', label: 'Hints, marks & images', desc: 'Per-question marks, negative marks, hint and image.', json: { title: 'Advanced Test', description: 'Questions with hints and custom marking.', questions: [{ question: 'Who said: “Physical Education is that phase of general education which deals with large muscle activities”?', options: ['J. B. Nash', 'C. C. Cowell', 'Clarke H. Harrison', 'Charles Bucher'], answer: 0, hint: 'He was an American educator.', explanation: 'This definition is by J. B. Nash.', difficulty: 'Hard', marks: 2, negative: 0.5, subject: 'Definitions' }] } },
]

export function shuffle(arr, seed = Math.random) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(seed() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

/** Builds the paper a student will attempt (applies randomize / total questions) */
export function buildPaper(data) {
  const s = { ...DEFAULT_MCQ_SETTINGS, ...data.settings }
  let qs = data.questions.map((x) => { const n = normalizeQuestion(x); return { ...n, order: n.options.map((_, i) => i) } })
  if (s.randomizeQuestions) qs = shuffle(qs)
  if (s.totalQuestions > 0) qs = qs.slice(0, s.totalQuestions)
  if (s.randomizeOptions) qs = qs.map((x) => ({ ...x, order: shuffle(x.order) }))
  return qs
}

export function scorePaper(paper, answers, settings) {
  const s = { ...DEFAULT_MCQ_SETTINGS, ...settings }
  let correct = 0; let wrong = 0; let skipped = 0; let score = 0; let total = 0
  paper.forEach((x) => {
    const a = answers[x.id]; const m = questionMarks(x, s); total += m
    if (!isAnswered(a)) skipped++
    else if (isCorrect(x, a)) { correct++; score += m } else { wrong++; score -= questionNegative(x, s) }
  })
  score = Math.max(0, score)
  return { correct, wrong, skipped, score: Math.round(score * 100) / 100, total: Math.round(total * 100) / 100, percent: total ? Math.round((score / total) * 100) : 0 }
}
