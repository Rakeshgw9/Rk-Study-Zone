/**
 * Finds the "sections" of a custom lesson (HTML) page: the biggest group of repeated sibling cards.
 * Used for (a) the per-section "Add note" buttons and (b) page-break control in the PDF export.
 *
 * IMPORTANT: this function is self-contained (no imports / outer variables) because frameDoc.js
 * copies its source into the sandboxed lesson iframe with Function.prototype.toString().
 */
export function findSectionGroup(root) {
  var SKIP = /^(SCRIPT|STYLE|LINK|BR|HR|IMG|SVG|BUTTON|INPUT|SELECT|TEXTAREA|NOSCRIPT)$/
  var NO_PARENT = /^(UL|OL|TABLE|TBODY|THEAD|TFOOT|TR|DL|SELECT|HEAD)$/
  var best = null
  var bestScore = 0
  var parents = [root]
  var all = root.querySelectorAll('*')
  for (var i = 0; i < all.length; i++) parents.push(all[i])
  for (var p = 0; p < parents.length; p++) {
    var parent = parents[p]
    if (NO_PARENT.test(parent.tagName) || SKIP.test(parent.tagName)) continue
    var groups = {}
    var kids = parent.children
    for (var c = 0; c < kids.length; c++) {
      var el = kids[c]
      if (SKIP.test(el.tagName) || (el.className && typeof el.className === 'string' && el.className.indexOf('rk-note-btn') !== -1)) continue
      if (el.offsetHeight < 80) continue
      if (((el.textContent || '').replace(/\s+/g, ' ').trim()).length < 30) continue
      var key = el.tagName + '.' + ((el.classList && el.classList[0]) || '')
      if (!groups[key]) groups[key] = []
      groups[key].push(el)
    }
    for (var k in groups) {
      var g = groups[k]
      if (g.length < 2) continue
      var score = 0
      for (var j = 0; j < g.length; j++) score += g[j].offsetHeight
      if (score > bestScore) { bestScore = score; best = g }
    }
  }
  return best || []
}

/* ------------------------------------------------------------------ outline of a JSON block (lesson sidebar)
 * NOTE: these imports/exports sit outside findSectionGroup, which must stay self-contained (frameDoc copies its source into the iframe). */
import { nativeStudio, normalizeToSections, sectionTitle } from './jsonStudio'

/** Sub-sections of a JSON Content Block for the student sidebar: [{ id, title, anchor }].
 *  anchor = element id on the lesson page (Studio blocks render every section natively with id "sec-<blockId>-<sectionId>").
 *  Classic JSON blocks render inside a sandbox, so their sub-items scroll to the block itself (anchor = "b-<blockId>"). */
export function jsonOutline(block) {
  if (!block || block.type !== 'json') return []
  const native = nativeStudio(block.data)
  let n = native
  if (!n) {
    try { n = normalizeToSections(JSON.parse(block.data?.json || '{}')) } catch { return [] }
  }
  const list = (n?.sections || []).filter((s) => s && sectionTitle(s))
  if (!native && list.length < 2) return []
  return list.map((s, i) => ({ id: s.id, title: sectionTitle(s).slice(0, 80) || `Section ${i + 1}`, anchor: native ? `sec-${block.id}-${s.id}` : `b-${block.id}` }))
}
