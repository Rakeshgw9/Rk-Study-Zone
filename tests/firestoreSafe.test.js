import test from 'node:test'
import assert from 'node:assert/strict'
import { fromFirestoreSafe, toFirestoreSafe } from '../src/lib/firestoreSafe.js'

function assertNoDirectNestedArrays(value, path = 'root') {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      assert.equal(Array.isArray(child), false, `Nested array at ${path}[${index}]`)
      assertNoDirectNestedArrays(child, `${path}[${index}]`)
    })
    return
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, child] of Object.entries(value)) assertNoDirectNestedArrays(child, `${path}.${key}`)
  }
}

test('table rows are Firestore-safe and restore to the editor schema', () => {
  const content = {
    units: [{
      chapters: [{
        blocks: [{
          id: 'table-1',
          type: 'table',
          data: {
            rows: [
              ['S. No.', 'Activity', 'Purpose'],
              ['1', 'Aerobic', 'Heart health'],
              ['2', 'Strength', 'Muscle strength']
            ],
            merges: { '0:0': { rowSpan: 1, colSpan: 2 }, '0:1': { hidden: true } }
          }
        }]
      }]
    }]
  }
  const stored = toFirestoreSafe(content)
  assertNoDirectNestedArrays(stored)
  assert.deepEqual(fromFirestoreSafe(stored), content)
})

test('nested arrays in objects and arrays round-trip without changing ordinary arrays', () => {
  const content = {
    plain: ['a', 'b'],
    matrix: [[1, 2], [3, 4]],
    nested: [{ values: [['x'], ['y']] }]
  }
  assert.deepEqual(fromFirestoreSafe(toFirestoreSafe(content)), content)
})

test('undefined object fields are omitted and undefined array entries become null', () => {
  const safe = toFirestoreSafe({ omitted: undefined, values: [undefined, 'ok'] })
  assert.deepEqual(safe, { values: [null, 'ok'] })
})
