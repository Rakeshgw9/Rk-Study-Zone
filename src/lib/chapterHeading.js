import educationBg from '../assets/chapter-bg/education.svg'
import libraryBg from '../assets/chapter-bg/library.svg'
import deskBg from '../assets/chapter-bg/study-desk.svg'
import abstractBg from '../assets/chapter-bg/abstract.svg'
import sportsBg from '../assets/chapter-banner.jpg'

/** Ready-made, education themed heading backgrounds. Only the preset id is stored in the chapter. */
export const HEADING_PRESETS = [
  { id: 'education', label: 'Education', src: educationBg },
  { id: 'library', label: 'Books & Library', src: libraryBg },
  { id: 'study-desk', label: 'Study Desk', src: deskBg },
  { id: 'sports', label: 'Sports', src: sportsBg },
  { id: 'abstract', label: 'Abstract', src: abstractBg },
]

export const HEADING_IMAGE_DEFAULTS = {
  headingBgPreset: 'education', headingBackgroundImage: '', headingImgPosition: 'center center', headingImgSize: 'cover',
  headingImgRepeat: 'no-repeat', headingImgBlend: 'normal', headingOverlayColor: '#000000', headingOverlayOn: true, headingOverlayOpacity: 30, headingImgStyle: 'default',
}
export const HEADING_IMAGE_KEYS = Object.keys(HEADING_IMAGE_DEFAULTS)

export const POSITIONS = [
  ['left top', 'Top left'], ['center top', 'Top center'], ['right top', 'Top right'],
  ['left center', 'Middle left'], ['center center', 'Center'], ['right center', 'Middle right'],
  ['left bottom', 'Bottom left'], ['center bottom', 'Bottom center'], ['right bottom', 'Bottom right'],
]
export const BLEND_MODES = [['normal', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['luminosity', 'Luminosity']]
export const IMAGE_STYLES = [['default', 'Default'], ['pattern', 'Pattern'], ['gradient', 'Gradient'], ['blurred', 'Blurred']]

const hexToRgba = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return `rgba(0,0,0,${a})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** The image to show: custom upload wins, otherwise the chosen preset. */
export function headingImageSrc(ch = {}) {
  if (ch.headingBackgroundImage) return ch.headingBackgroundImage
  const id = ch.headingBgPreset || HEADING_IMAGE_DEFAULTS.headingBgPreset
  return (HEADING_PRESETS.find((p) => p.id === id) || HEADING_PRESETS[0]).src
}

/** True when the chapter heading should render with an image background */
export const usesHeadingImage = (ch = {}) => ch.headingBackgroundMode === 'image'

/** Inline styles for the three absolutely positioned layers (image, overlay, effect). */
export function headingLayers(ch = {}) {
  const style = ch.headingImgStyle || 'default'
  const on = ch.headingOverlayOn !== false
  const op = on ? Math.max(0, Math.min(100, Number(ch.headingOverlayOpacity ?? HEADING_IMAGE_DEFAULTS.headingOverlayOpacity))) / 100 : 0
  const size = ch.headingImgSize || 'cover'
  return {
    image: {
      backgroundImage: `url("${headingImageSrc(ch)}")`,
      backgroundPosition: ch.headingImgPosition || 'center center',
      backgroundSize: size === 'auto' ? 'auto' : size,
      backgroundRepeat: ch.headingImgRepeat || 'no-repeat',
      backgroundBlendMode: ch.headingImgBlend || 'normal',
      backgroundColor: ch.headingSolidColor || '#0b1f44',
      filter: style === 'blurred' ? 'blur(5px)' : undefined,
      transform: style === 'blurred' ? 'scale(1.08)' : undefined,
    },
    overlay: { background: hexToRgba(ch.headingOverlayColor || '#000000', op) },
    effect: style === 'pattern'
      ? { backgroundImage: 'radial-gradient(rgba(255,255,255,.22) 1px, transparent 1.4px)', backgroundSize: '14px 14px' }
      : style === 'gradient'
        ? { backgroundImage: 'linear-gradient(90deg, rgba(4,10,24,.85), rgba(4,10,24,.15))' }
        : null,
  }
}
