/** Ready-made CDN packages a teacher can attach to an HTML or JSON block */
export const PACKAGE_PRESETS = [
  { id: 'bootstrap-css', name: 'Bootstrap 5 CSS', type: 'css', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css' },
  { id: 'bootstrap-js', name: 'Bootstrap 5 JS (bundle)', type: 'js', url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js' },
  { id: 'bootstrap-icons', name: 'Bootstrap Icons', type: 'css', url: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css' },
  { id: 'fontawesome', name: 'Font Awesome 6', type: 'css', url: 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css' },
  { id: 'animate', name: 'Animate.css', type: 'css', url: 'https://cdn.jsdelivr.net/npm/animate.css@4.1.1/animate.min.css' },
  { id: 'jquery', name: 'jQuery 3', type: 'js', url: 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js' },
  { id: 'chartjs', name: 'Chart.js', type: 'js', url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js' },
  { id: 'katex-css', name: 'KaTeX CSS (Math)', type: 'css', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css' },
  { id: 'katex-js', name: 'KaTeX JS (Math)', type: 'js', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js' },
  { id: 'katex-auto', name: 'KaTeX Auto-render', type: 'js', url: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js', init: 'window.renderMathInElement&&renderMathInElement(document.body,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}]})' },
  { id: 'prism-css', name: 'Prism Code Highlight CSS', type: 'css', url: 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css' },
  { id: 'prism-js', name: 'Prism Code Highlight JS', type: 'js', url: 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js' },
  { id: 'gsap', name: 'GSAP Animation', type: 'js', url: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js' },
  { id: 'aos-css', name: 'AOS Scroll CSS', type: 'css', url: 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css' },
  { id: 'aos-js', name: 'AOS Scroll JS', type: 'js', url: 'https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js', init: 'window.AOS&&AOS.init({once:true})' },
  { id: 'swiper-css', name: 'Swiper Slider CSS', type: 'css', url: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css' },
  { id: 'swiper-js', name: 'Swiper Slider JS', type: 'js', url: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js' },
  { id: 'font-odia', name: 'Noto Sans Oriya (ଓଡ଼ିଆ font)', type: 'css', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Oriya:wght@400;600;700&display=swap' },
]

export function validatePackageUrl(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return 'Only https:// links are allowed.'
    return ''
  } catch { return 'Enter a valid URL (https://...).' }
}
export const guessType = (url) => (/\.css(\?|$)|fonts\.googleapis/i.test(url) ? 'css' : 'js')
