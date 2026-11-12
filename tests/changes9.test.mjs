// Run with:  npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMcqJson, exportMcqJson, normalizeQuestion } from '../src/lib/mcq.js'

test('MCQ JSON: option explanations (array, object, option objects)', () => {
  const r = parseMcqJson(JSON.stringify({ questions: [
    { question: 'Q1?', options: ['a', 'b', 'c', 'd'], answer: 2, optionExplanations: ['ea', 'eb', 'ec', 'ed'] },
    { question: 'Q2?', options: [{ text: 'x', explanation: 'ex' }, { text: 'y' }], answer: 'A' },
    { question: 'Q3?', options: ['p', 'q'], answer: 1, explanations: { A: 'pa', B: 'qb' } },
  ] }))
  assert.equal(r.ok, true)
  assert.deepEqual(r.data.questions[0].optionExplanations, ['ea', 'eb', 'ec', 'ed'])
  assert.deepEqual(r.data.questions[1].optionExplanations, ['ex', ''])
  assert.deepEqual(r.data.questions[2].optionExplanations, ['pa', 'qb'])
  const back = JSON.parse(exportMcqJson({ data: { title: 't', description: '', questions: r.data.questions } }))
  assert.deepEqual(back.questions[0].optionExplanations, ['ea', 'eb', 'ec', 'ed'])
})

test('old questions without option explanations still work', () => {
  assert.deepEqual(normalizeQuestion({ options: ['a', 'b', 'c'] }).optionExplanations, ['', '', ''])
})
