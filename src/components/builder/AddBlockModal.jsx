import { useEffect, useState } from 'react'
import { LuCirclePlus, LuLayers, LuX } from 'react-icons/lu'
import Modal from '../Modal'

const TYPES = [
  { type: 'html', badge: '</>', title: 'HTML / CSS / JS', desc: 'Custom interactive content.', tone: 'blue' },
  { type: 'json', badge: '{ }', title: 'JSON Content', desc: 'Structured lesson data.', tone: 'purple' },
  { type: 'mcq', badge: 'MCQ', title: 'MCQ Quiz', desc: 'Practice tests and exams.', tone: 'teal' },
  { type: 'table', badge: 'TB', title: 'Table', desc: 'Editable advanced tables.', tone: 'teal', isNew: true },
  { type: 'heading-paragraph', badge: 'H+P', title: 'Heading & Text', desc: 'Formatted lesson text.', tone: 'blue' },
  { type: 'heading-image', badge: 'IMG', title: 'Heading & Image', desc: 'Images with headings.', tone: 'purple' },
  { type: 'heading-list', badge: 'LIST', title: 'Heading & List', desc: 'Bullet and numbered lists.', tone: 'teal' },
  { type: 'heading-example', badge: 'EX', title: 'Example', desc: 'Highlighted examples.', tone: 'blue' },
  { type: 'youtube', badge: 'YT', title: 'YouTube', desc: 'Embedded video content.', tone: 'pink', isNew: true },
  { type: 'slider', badge: 'SLD', title: 'Image Slider', desc: 'Image carousel with autoplay.', tone: 'purple', isNew: true },
  { type: 'image-to-text', badge: 'OCR', title: 'Image to Text', desc: 'Book page photo or PDF to editable text.', tone: 'teal', isNew: true },
];
function Art({ type }) {
  if (type === 'image-to-text') return <div className="ab-art ready-art"><span className="ra-image"><i /></span><b className="ra-heading" /><i /><i className="short" /></div>
  if (type === 'youtube') return <div className="ab-art ready-art"><span className="ra-video"><i /></span><b className="ra-heading" /></div>
  if (type === 'slider') return <div className="ab-art ready-art"><span className="ra-slider"><i className="l" /><i className="r" /></span><span className="ra-dots"><i className="on" /><i /><i /><i /></span></div>
  if (type === 'table') return <div className="ab-art ready-art"><span className="ra-table"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span></div>
  if (type === 'mcq') return <div className="ab-art mcq"><div><i /><b /></div><div className="on"><i /><b /></div><div><i /><b /></div></div>
  if (type === 'heading-paragraph') return <div className="ab-art ready-art"><b className="ra-heading"/><i/><i/><i className="short"/></div>
  if (type === 'heading-image') return <div className="ab-art ready-art"><b className="ra-heading"/><span className="ra-image"><i/></span><i className="short"/></div>
  if (type === 'heading-list') return <div className="ab-art ready-art"><b className="ra-heading"/><span className="ra-list"><i/><i/><i/></span></div>
  if (type === 'heading-example') return <div className="ab-art ready-art"><b className="ra-heading"/><i/><span className="ra-example"><b/><i/><i/></span></div>
  return <div className="ab-art"><div className="dots"><i /><i /><i /></div><div className="code"><span>&lt;/&gt;</span><div><b className="c1" /><b className="c2" /><b className="c3" /></div></div></div>
}

export default function AddBlockModal({ show, onClose, onAdd, chapterTitle }) {
  const [sel, setSel] = useState(null)
  useEffect(() => { if (show) setSel(null) }, [show])
  return (
    <Modal show={show} onClose={onClose} className="ui-modal ui-modal-lg ab-modal" labelledBy="ab-title">
      <div className="ui-modal-head">
        <span className="ui-modal-icon purple"><LuLayers /></span>
        <div className="flex-grow-1"><h2 id="ab-title">Add Block</h2><p>Choose a content block to add in {chapterTitle ? <b>{chapterTitle}</b> : 'this chapter'}.</p></div>
        <button type="button" className="ui-x" onClick={onClose} aria-label="Close"><LuX /></button>
      </div>
      <div className="ui-modal-body">
        <div className="ab-grid" role="radiogroup" aria-label="Block type">
          {TYPES.map((t) => (
            <button key={t.type} type="button" role="radio" aria-checked={sel === t.type} className={`ab-card ab-tone-${t.tone} ${sel === t.type ? 'on' : ''}`} onClick={() => setSel(t.type)} onDoubleClick={() => onAdd(t.type)}>
             
             
             <div className='pop_flex'>
              <div className='left_icon'>
              <span className="ab-badge">{t.badge}</span>
              </div>
              <div className='right_text'>
              <strong>{t.title}{t.isNew && <em className="ab-new">NEW</em>}</strong>
              <span className="ab-desc">{t.desc}</span>
              </div>
              </div>


              <Art type={t.type} />
            </button>
          ))}
        </div>
      </div>
      <div className="ui-modal-foot">
        <button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}><LuX /> Cancel</button>
        <button type="button" className="btn ui-btn ui-btn-primary" disabled={!sel} onClick={() => onAdd(sel)}><LuCirclePlus /> Add Selected Block</button>
      </div>
    </Modal>
  )
}
