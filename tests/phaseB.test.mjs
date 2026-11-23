// Run with: node --import ./tests/_register.mjs --test tests/phaseB.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanText, identityDiffers, needsTeacherProfile, ownerIdentity, profileCompleteness, safeWebsite, validateProfile } from '../src/lib/profile.js'
import { averagePct, continueReading, facets, filterPortals, recommend, updatedAtOf } from '../src/lib/portalDiscovery.js'
import { averageScore, buildSeries, dayKey, describeSeries, lastDays, portalPerformance } from '../src/lib/activity.js'

test('cleanText strips HTML and control characters', () => {
  assert.equal(cleanText('  <b>Maths</b> <script>alert(1)</script> teacher  '), 'Maths alert(1) teacher')
  assert.equal(cleanText('a\u0000b'), 'ab')
  assert.equal(cleanText('x'.repeat(500), 10).length, 10)
  assert.equal(cleanText(null), '')
})

test('teacher must have name + specialization; other roles are not blocked', () => {
  assert.equal(needsTeacherProfile({ role: 'teacher', name: 'Asha', specialization: '' }), true)
  assert.equal(needsTeacherProfile({ role: 'teacher', name: 'Asha', specialization: ' <i> </i> ' }), true)
  assert.equal(needsTeacherProfile({ role: 'teacher', name: 'Asha', specialization: 'Physics' }), false)
  assert.equal(needsTeacherProfile({ role: 'admin', name: 'A' }), false)
  assert.equal(needsTeacherProfile({ role: 'student', name: 'S' }), false)
  assert.equal(needsTeacherProfile(null), false)
})

test('validateProfile: required fields, experience, website', () => {
  const bad = validateProfile({ name: '', specialization: '' }, 'teacher')
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.name && bad.errors.specialization)
  assert.equal(validateProfile({ name: 'Asha Rao', specialization: 'Math' }, 'teacher').ok, true)
  assert.equal(validateProfile({ name: 'Asha Rao' }, 'admin').ok, true) // specialization only for teachers
  assert.ok(validateProfile({ name: 'Asha Rao', specialization: 'M', experienceYears: '-3' }, 'teacher').errors.experienceYears)
  assert.ok(validateProfile({ name: 'Asha Rao', specialization: 'M', experienceYears: '2.5' }, 'teacher').errors.experienceYears)
  const w = validateProfile({ name: 'Asha Rao', specialization: 'M', website: 'example.com/me' }, 'teacher')
  assert.equal(w.values.website, 'https://example.com/me')
  assert.ok(validateProfile({ name: 'Asha Rao', specialization: 'M', website: 'javascript:alert(1)' }, 'teacher').errors.website)
  assert.equal(safeWebsite(''), '')
})

test('profile completeness and owner identity', () => {
  assert.equal(profileCompleteness({ name: 'A', specialization: 'M', qualification: 'B', photoURL: 'x', bio: 'b', experienceYears: '3' }).pct, 100)
  const c = profileCompleteness({ name: 'A' })
  assert.deepEqual(c.missing, ['Specialization', 'Qualification', 'Photo', 'Short bio', 'Experience'])
  const id = ownerIdentity({ name: 'Asha <b>R</b>', photoURL: 'https://img/x.png', specialization: 'Maths', qualification: 'M.Sc' })
  assert.deepEqual(id, { ownerName: 'Asha R', ownerPhoto: 'https://img/x.png', ownerSpecialization: 'Maths', ownerQualification: 'M.Sc', ownerAvailability: '' })
  assert.equal(ownerIdentity({ name: 'A', photoURL: 'data:image/png;base64,AAAA' }).ownerPhoto, '') // inline photos are not copied to portals
  assert.equal(identityDiffers({ ownerName: 'A' }, { ownerName: 'A', ownerPhoto: '', ownerSpecialization: '', ownerQualification: '', ownerAvailability: '' }), false)
  assert.equal(identityDiffers({}, { ownerName: 'A' }), true)
})

const mk = (id, over = {}, pct = 0) => ({ portal: { id, name: `Portal ${id}`, ownerId: 'u1', ownerName: 'Asha', ownerSpecialization: 'Maths', category: 'subject', createdAt: 1000, updatedAt: 2000, ...over }, prog: { pct, done: pct ? 1 : 0 }, sd: {} })

test('filterPortals: search by portal or teacher, filters, sorting', () => {
  const items = [mk('a', { name: 'Algebra', createdAt: 5, updatedAt: 9 }), mk('b', { name: 'Poems', ownerId: 'u2', ownerName: 'Bikash', ownerSpecialization: 'Odia', category: 'other', createdAt: 8, updatedAt: 6 }, 40)]
  assert.equal(filterPortals(items, { search: 'bikash' }).length, 1)
  assert.equal(filterPortals(items, { search: 'ALGE' })[0].portal.id, 'a')
  assert.equal(filterPortals(items, { specialization: 'odia' }).length, 1)
  assert.equal(filterPortals(items, { category: 'other' })[0].portal.id, 'b')
  assert.equal(filterPortals(items, { teacher: 'u1' })[0].portal.id, 'a')
  assert.equal(filterPortals(items, { sort: 'updated' })[0].portal.id, 'a')
  assert.equal(filterPortals(items, { sort: 'newest' })[0].portal.id, 'b')
  assert.equal(filterPortals(items, { sort: 'name' })[0].portal.id, 'a')
  assert.equal(filterPortals(items, { sort: 'progress' })[0].portal.id, 'b')
  assert.equal(updatedAtOf({ publishedAt: 50, updatedAt: 10 }), 50)
  const f = facets(items)
  assert.deepEqual(f.specializations, ['Maths', 'Odia'])
  assert.equal(f.teachers.length, 2)
})

test('recommend prefers portals matching what the student started; continueReading picks latest', () => {
  const items = [mk('a', {}, 50), mk('b', { ownerSpecialization: 'Maths' }, 0), mk('c', { ownerSpecialization: 'Odia', category: 'other' }, 0)]
  assert.equal(recommend(items, 2)[0].portal.id, 'b')
  assert.equal(recommend(items, 1).length, 1)
  items[0].sd = { lastChapterId: 'ch1', lastReading: { at: 500 } }
  assert.equal(continueReading(items).chapterId, 'ch1')
  assert.equal(continueReading([mk('z')]), null)
  assert.equal(averagePct(items), 50)
})

test('activity series: fixed length, filled with zeros, totals, accessibility text', () => {
  const today = new Date(2026, 10, 22)
  assert.equal(dayKey(today), '2026-11-22')
  assert.deepEqual(lastDays(3, today), ['2026-11-20', '2026-11-21', '2026-11-22'])
  const d = buildSeries([{ day: '2026-11-22', active: 3, enrolments: 1 }, { day: '2026-11-22', active: 2 }, { day: '2026-11-21', completions: 1 }, { day: '2020-01-01', active: 99 }], 7, today)
  assert.equal(d.series.length, 7)
  assert.equal(d.totals.active, 5)
  assert.equal(d.totals.enrolments, 1)
  assert.equal(d.totals.completions, 1)
  assert.equal(d.empty, false)
  assert.equal(buildSeries([], 30, today).empty, true)
  assert.match(describeSeries(d), /5 active visits, 1 new enrolments, busiest day 2026-11-22/)
})

test('portal performance aggregates enrollment summaries', () => {
  const p = portalPerformance([
    { portalId: 'p1', progressPct: 100, avgScore: 80 }, { portalId: 'p1', progressPct: 50 }, { portalId: 'p1' }, { portalId: 'p2', progressPct: 20, avgScore: 60 },
  ])
  assert.deepEqual(p.p1, { students: 3, completed: 1, avgProgress: 75, avgScore: 80 })
  assert.equal(p.p2.avgProgress, 20)
  assert.equal(averageScore({ a: { percent: 80 }, b: { percent: 60 }, c: {} }), 70)
  assert.equal(averageScore({}), null)
})
