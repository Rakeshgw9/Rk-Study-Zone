/* Small DOM helpers shared by the builder canvas, the right-sidebar presets and the left-sidebar layer tree. */

/** Smoothly scroll the artboard section card into view (centre of the screen) and flash it. Retries while the block is still mounting.
 *  Returns a cancel function. */
export function scrollToStudioSection(id, { tries = 12, delay = 60 } = {}) {
  let n = 0
  let timer = 0
  const run = () => {
    const el = document.getElementById(`js-sec-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('js-flash')
      setTimeout(() => el.classList.remove('js-flash'), 900)
      return
    }
    if (++n < tries) timer = setTimeout(run, delay)
  }
  run()
  return () => clearTimeout(timer)
}
