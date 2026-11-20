/* Small DOM helpers shared by the builder canvas, the right-sidebar presets and the left-sidebar layer tree. */

/** Find a Studio section element in either the live editor canvas (#js-sec-<id>) or the read-only artboard (#sec-<blockId>-<id>). */
export function findStudioSectionEl(id, blockId) {
  if (!id) return null
  const direct = document.getElementById(`js-sec-${id}`)
  if (direct) return direct
  if (blockId) {
    const native = document.getElementById(`sec-${blockId}-${id}`)
    if (native) return native
  }
  const safe = String(id).replace(/"/g, '\\"')
  return document.querySelector(`[id^="sec-"][id$="-${safe}"]`)
}

/** Smoothly scroll the artboard section card into view (using CSS scroll-margin-top) and flash it. Retries briefly while the block mounts.
 *  Returns a cancel function. */
export function scrollToStudioSection(id, { blockId = null, tries = 12, delay = 60 } = {}) {
  let n = 0
  let timer = 0
  let flashTimer = 0
  const run = () => {
    const el = findStudioSectionEl(id, blockId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el.classList.add('js-flash')
      flashTimer = setTimeout(() => el.classList.remove('js-flash'), 900)
      return
    }
    if (++n < tries) timer = setTimeout(run, delay)
  }
  run()
  return () => {
    clearTimeout(timer)
    clearTimeout(flashTimer)
  }
}
