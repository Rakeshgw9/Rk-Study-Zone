/* Teacher profile rules (pure functions — validation, completeness, denormalised portal identity). */
export const SPECIALIZATION_SUGGESTIONS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Odia', 'Hindi', 'History', 'Geography', 'Civics',
  'Computer Science', 'Web Development', 'Data Science', 'Commerce & Accountancy', 'Economics', 'Competitive Exams', 'Primary Education',
]
export const PROFILE_LIMITS = { name: 80, specialization: 80, qualification: 120, experienceYears: 2, bio: 400, subjects: 160, languages: 120, availability: 160, website: 200 }

/** Removes tags / angle brackets / control characters and collapses whitespace. Output is always plain text. */
export function cleanText(value, max = 200) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max)
}

export const isRole = (user, role) => user?.role === role
/** Only role "teacher" is forced to fill the specialization (admins / super admins are not blocked). */
export const needsTeacherProfile = (user) => !!user && user.role === 'teacher' && (!cleanText(user.specialization) || !cleanText(user.name))

export function safeWebsite(v) {
  const s = cleanText(v, PROFILE_LIMITS.website)
  if (!s) return ''
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try { const u = new URL(withProto); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString() : null } catch { return null }
}

/** → { ok, errors:{field:message}, values:{cleaned values} } */
export function validateProfile(input = {}, role = 'teacher') {
  const errors = {}
  const values = {}
  values.name = cleanText(input.name, PROFILE_LIMITS.name)
  if (!values.name) errors.name = 'Full name is required.'
  else if (values.name.length < 2) errors.name = 'Please enter your full name.'
  values.specialization = cleanText(input.specialization, PROFILE_LIMITS.specialization)
  if (role === 'teacher' && !values.specialization) errors.specialization = 'Specialization is required for teachers (e.g. Mathematics).'
  values.qualification = cleanText(input.qualification, PROFILE_LIMITS.qualification)
  const exp = String(input.experienceYears ?? '').trim()
  if (exp !== '') {
    const n = Number(exp)
    if (!Number.isInteger(n) || n < 0 || n > 70) errors.experienceYears = 'Experience must be a whole number of years (0–70).'
    else values.experienceYears = String(n)
  } else values.experienceYears = ''
  for (const k of ['bio', 'subjects', 'languages', 'availability']) values[k] = cleanText(input[k], PROFILE_LIMITS[k])
  const site = safeWebsite(input.website)
  if (site === null) errors.website = 'Enter a valid website link (https://…).'
  values.website = site || ''
  return { ok: Object.keys(errors).length === 0, errors, values }
}

/** Percentage + missing items, shown on the teacher dashboard. */
export function profileCompleteness(user) {
  const checks = [
    ['Full name', !!cleanText(user?.name)],
    ['Specialization', !!cleanText(user?.specialization)],
    ['Qualification', !!cleanText(user?.qualification)],
    ['Photo', !!user?.photoURL],
    ['Short bio', !!cleanText(user?.bio)],
    ['Experience', String(user?.experienceYears ?? '') !== ''],
  ]
  const done = checks.filter(([, ok]) => ok).length
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([l]) => l) }
}

/** Teacher identity copied onto each portal (students cannot read /users, so it is denormalised). */
export function ownerIdentity(user) {
  const photo = typeof user?.photoURL === 'string' && /^https?:\/\//i.test(user.photoURL) && user.photoURL.length < 500 ? user.photoURL : ''
  return {
    ownerName: cleanText(user?.name || user?.email, PROFILE_LIMITS.name),
    ownerPhoto: photo,
    ownerSpecialization: cleanText(user?.specialization, PROFILE_LIMITS.specialization),
    ownerQualification: cleanText(user?.qualification, PROFILE_LIMITS.qualification),
    ownerAvailability: cleanText(user?.availability, PROFILE_LIMITS.availability), // shown in the student chat box
  }
}
export const IDENTITY_KEYS = ['ownerName', 'ownerPhoto', 'ownerSpecialization', 'ownerQualification', 'ownerAvailability']
export const identityDiffers = (portal, identity) => IDENTITY_KEYS.some((k) => (portal?.[k] ?? '') !== (identity[k] ?? ''))
