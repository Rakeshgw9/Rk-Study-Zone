/* Share-link builders for the "Portal Published" modal.
   The app uses a HashRouter, so public links look like  <origin><path>#/learn/<portalId>/<chapterId> */

/** Base URL of the deployed app (origin + pathname, no hash / query). */
export function appBaseUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return ''
  const origin = loc.origin && loc.origin !== 'null' ? loc.origin : `${loc.protocol}//${loc.host}`
  const path = (loc.pathname || '/').replace(/index\.html$/, '')
  return `${origin}${path}`
}

const seg = (v) => encodeURIComponent(String(v))

export const portalLink = (base, portalId) => `${base}#/learn/${seg(portalId)}`
export const chapterLink = (base, portalId, chapterId) => `${base}#/learn/${seg(portalId)}/${seg(chapterId)}`

/** A unit link opens the unit's first chapter (null when the unit has no chapters yet). */
export function unitLink(base, portalId, unit) {
  const first = unit?.chapters?.[0]
  return first ? chapterLink(base, portalId, first.id) : null
}

/** Counts used by the success summary. */
export function contentCounts(content) {
  const units = content?.units || []
  let chapters = 0
  let blocks = 0
  for (const u of units) {
    for (const c of u.chapters || []) {
      chapters += 1
      blocks += Array.isArray(c.blocks) ? c.blocks.length : 0
    }
  }
  return { units: units.length, chapters, blocks }
}

/** Everything the modal needs: portal link, unit options and chapter options grouped by unit. */
export function buildShareModel(base, portalId, content) {
  const units = (content?.units || []).map((u, ui) => ({
    id: u.id,
    title: u.title || `Unit ${ui + 1}`,
    link: unitLink(base, portalId, u),
    chapters: (u.chapters || []).map((c, ci) => ({
      id: c.id,
      title: c.title || `Chapter ${ci + 1}`,
      link: chapterLink(base, portalId, c.id),
    })),
  }))
  return { portalUrl: portalLink(base, portalId), units, counts: contentCounts(content) }
}

/** Plain-language access notice, or null for a public / free portal. */
export function accessNotice(portal) {
  if (!portal) return null
  const notes = []
  if (portal.status && portal.status !== 'active') notes.push('This portal is inactive, so students cannot open it yet.')
  if (portal.accessType === 'paid') notes.push('Paid portal: students must sign in and enrol before they can read it.')
  else if (portal.accessType === 'private') notes.push('Private portal: students must sign in and have an invite or code.')
  else if (portal.accessType === 'free') notes.push('Students need to sign in to read lessons.')
  return notes
}
