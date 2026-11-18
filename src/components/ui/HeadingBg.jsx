import { headingLayers, usesHeadingImage } from '../../lib/chapterHeading'

/** Image / overlay / effect layers for a chapter heading banner. The parent needs the `has-hb` class. */
export default function HeadingBgLayers({ chapter }) {
  if (!usesHeadingImage(chapter)) return null
  const l = headingLayers(chapter)
  return (
    <>
      <span className="hb-layer hb-image" style={l.image} aria-hidden="true" />
      {l.effect && <span className="hb-layer hb-effect" style={l.effect} aria-hidden="true" />}
      <span className="hb-layer hb-overlay" style={l.overlay} aria-hidden="true" />
    </>
  )
}
