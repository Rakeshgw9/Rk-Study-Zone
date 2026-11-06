import { useLayoutEffect, useRef, useState } from 'react'
import { LuImage, LuUpload, LuTrash2, LuPlus, LuX, LuSave, LuMoon, LuSun } from 'react-icons/lu'
import { Field, NumberField, Section, Tabs, Toggle } from '../ui/Controls'
import { ColorSwatchField } from '../ui/SettingsControls'
import { uploadImage } from '../../services/storageService'
import { DARK_STYLE, THEME_TEMPLATES, isLegacyLightStyle, themeTemplateStyle } from '../../lib/blockTheme'

// Light-grey hints only. They are drawn by CSS and are NEVER stored as block content.
export const PLACEHOLDERS = {
  heading: 'Enter section heading', body: 'Write your lesson explanation here…', item: 'List item',
  exampleTitle: 'Example label', exampleText: 'Add a practical example here…', caption: 'Add a caption (optional)', imageAlt: 'Describe the image',
}
const defaults = {
  heading: '', body: '', image: '', imageAlt: '', caption: '', listStyle: 'bullet',
  items: ['', '', ''],
  exampleTitle: 'Example', exampleText: '',
  sections: [{ heading: '', level: 'h2', body: '' }],
  style: { ...DARK_STYLE, fontFamily: 'Inter', fontSize: 16, headingSize: 24, textAlign: 'left', headingAlign: 'left', lineHeight: 1.65, fontWeight: 400, shadow: 'none', imageFit: 'contain' },
  spacing: { padding: 24, marginTop: 0, marginBottom: 18, maxWidth: 1000, itemGap: 8 }
}
// Dark is the default look. Older blocks that still carry the untouched white defaults (and were never themed) are shown dark too.
const mergedStyle = (raw={}) => ({ ...defaults.style, ...raw, ...(!raw.theme && isLegacyLightStyle(raw) ? DARK_STYLE : {}) })
const merged = (d={}) => ({ ...defaults, ...d, style: mergedStyle(d.style||{}), spacing: { ...defaults.spacing, ...(d.spacing||{}) }, items: d.items || defaults.items, sections: d.sections || defaults.sections })
const FieldInput = ({label,value,onChange,placeholder,...props}) => <Field label={label}><input className="ui-input" value={value ?? ''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} {...props}/></Field>
const TextArea = ({label,value,onChange,rows=4,placeholder}) => <Field label={label}><textarea className="ui-input ui-textarea" rows={rows} value={value ?? ''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></Field>
/** Single-line-looking textarea that grows with its content */
function AutoGrow({ label, value, onChange, placeholder }) {
  const ref = useRef(null)
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px` }, [value])
  return <Field label={label}><textarea ref={ref} rows={1} className="ui-input ui-autogrow" value={value ?? ''} placeholder={placeholder} onChange={e=>onChange(e.target.value.replace(/\n/g, ' '))} onKeyDown={e=>{ if (e.key === 'Enter') e.preventDefault() }}/></Field>
}
const Color = ({label,value,onChange}) => <ColorSwatchField label={label} value={value} onChange={onChange}/>

/** Text typed in a contentEditable element. Trailing line-breaks added by the browser are removed. */
const readText = (el) => (el.innerText || '').replace(/\u00a0/g, ' ').replace(/^\n+|\n+$/g, '')

/** Editable text node. Empty fields show a CSS placeholder (never stored). In read-only student view empty fields are not rendered. */
function Editable({ as: Tag = 'div', value, placeholder, editable, show, onCommit, className, style }) {
  const text = value ?? ''
  if (!String(text).trim() && !show) return null
  return <Tag key={text} className={className} style={style} contentEditable={editable || undefined} suppressContentEditableWarning data-placeholder={placeholder} onBlur={editable ? (e) => onCommit?.(readText(e.currentTarget)) : undefined}>{text}</Tag>
}

export function ReadyBlockView({ block, onEdit, onUploadImage, placeholders = false }) {
  const imageInput = useRef(null)
  const d = merged(block.data)
  const st = d.style, sp = d.spacing
  const editable = !!onEdit, show = editable || placeholders
  const commit = (key) => (v) => onEdit?.({ [key]: v })
  const boxStyle = { background: st.background, color: st.textColor, fontFamily: st.fontFamily, fontSize: `${st.fontSize}px`, fontWeight: st.fontWeight, lineHeight: st.lineHeight, textAlign: st.textAlign, boxShadow: st.shadow === 'none' ? 'none' : st.shadow === 'soft' ? '0 8px 24px rgba(15,23,42,.10)' : '0 14px 36px rgba(15,23,42,.18)', border: `${st.borderWidth}px solid ${st.borderColor}`, borderRadius: `${st.borderRadius}px`, padding: `${sp.padding}px`, margin: `${sp.marginTop}px auto ${sp.marginBottom}px`, maxWidth: d.fullWidth ? '100%' : `${sp.maxWidth}px`, '--ready-item-gap': `${sp.itemGap}px`, width: '100%', boxSizing: 'border-box' }
  const headingStyle = { color: st.headingColor, fontSize: `${st.headingSize}px`, borderColor: st.accentColor, textAlign: st.headingAlign }
  const heading = <Editable as="h2" value={d.heading} placeholder={PLACEHOLDERS.heading} editable={editable} show={show} onCommit={commit('heading')} style={headingStyle} />
  const setItem = (i) => (v) => onEdit?.({ items: d.items.map((x, n) => (n === i ? v : x)) })
  const t = block.template || block.type
  return <article className={`ready-block ready-${t}`} style={boxStyle}>
    {t === 'heading-paragraph' && <>{heading}<Editable value={d.body} placeholder={PLACEHOLDERS.body} editable={editable} show={show} onCommit={commit('body')} className="ready-richtext" /></>}
    {t === 'heading-image' && <>{heading}
      {editable ? <>
        <input ref={imageInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{onUploadImage?.(e.target.files?.[0]);e.target.value=''}}/>
        <button type="button" className="ready-artboard-image" onClick={()=>imageInput.current?.click()} aria-label="Upload or replace image">{d.image ? <img src={d.image} alt={d.imageAlt || 'Lesson image'} style={{objectFit:st.imageFit}}/> : <span className="ready-image-empty"><LuImage/><b>Click to upload image</b><small>PNG, JPG or WebP</small></span>}</button>
      </> : (d.image ? <figure className="ready-figure"><img src={d.image} alt={d.imageAlt || 'Lesson image'} style={{objectFit:st.imageFit}}/></figure> : placeholders ? <div className="ready-artboard-image"><span className="ready-image-empty"><LuImage/><b>No image yet</b></span></div> : null)}
      <Editable as="p" value={d.caption} placeholder={PLACEHOLDERS.caption} editable={editable} show={false} onCommit={commit('caption')} className="ready-caption" />
      <Editable value={d.body} placeholder={PLACEHOLDERS.body} editable={editable} show={show} onCommit={commit('body')} className="ready-richtext" /></>}
    {t === 'heading-list' && <>{heading}{d.body && <Editable as="p" value={d.body} editable={editable} show={show} onCommit={commit('body')} />}
      {(() => { const List = d.listStyle === 'number' ? 'ol' : 'ul'; const rows = d.items.map((x, i) => ({ x, i })).filter(({ x }) => show || String(x).trim()); return rows.length ? <List>{rows.map(({ x, i }) => <Editable as="li" key={i} value={x} placeholder={PLACEHOLDERS.item} editable={editable} show={show} onCommit={setItem(i)} />)}</List> : null })()}</>}
    {t === 'heading-example' && <>{heading}<Editable as="p" value={d.body} placeholder={PLACEHOLDERS.body} editable={editable} show={show} onCommit={commit('body')} />
      {(show || String(d.exampleText).trim()) && <div className="ready-example" style={{borderLeftColor:st.accentColor}}><Editable as="strong" value={d.exampleTitle} placeholder={PLACEHOLDERS.exampleTitle} editable={editable} show={show} onCommit={commit('exampleTitle')} /><Editable as="p" value={d.exampleText} placeholder={PLACEHOLDERS.exampleText} editable={editable} show={show} onCommit={commit('exampleText')} /></div>}</>}
    {t === 'multi-heading' && <>{d.sections.map((x,i)=><section key={i}><HeadingTag level={x.level} color={st.headingColor} editable={editable} show={show} value={x.heading} onCommit={v=>onEdit?.({sections:d.sections.map((item,n)=>n===i?{...item,heading:v}:item)})}/><Editable as="p" value={x.body} placeholder={PLACEHOLDERS.body} editable={editable} show={show} onCommit={v=>onEdit?.({sections:d.sections.map((item,n)=>n===i?{...item,body:v}:item)})}/></section>)}</>}
  </article>
}
function HeadingTag({level='h2',value,color,editable,show,onCommit}) { const Tag = ['h1','h2','h3','h4','h5','h6'].includes(level) ? level : 'h2'; return <Editable as={Tag} value={value} placeholder={PLACEHOLDERS.heading} editable={editable} show={show} onCommit={onCommit} style={{color}}/> }

export function ReadyBlockCenter({block}) {
  return <div className="ready-center"><div className="ready-preview-stage"><ReadyBlockView block={block} placeholders/></div></div>
}

const isLightHex = (hex) => { let h = String(hex || '').replace('#',''); if (h.length === 3) h = [...h].map(c => c + c).join(''); if (!/^[0-9a-f]{6}$/i.test(h)) return false; const n = parseInt(h, 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255 > 0.6 }
const layoutPresets = (template) => (template === 'heading-list' ? [['Numbered', {listStyle:'number',style:{accentColor:'#2563eb',background:'#fff',borderWidth:1,borderColor:'#dbeafe',borderRadius:12}}],['Icon List',{listStyle:'bullet',style:{accentColor:'#0d9488',background:'#f0fdfa',borderWidth:1,borderColor:'#99f6e4',borderRadius:14}}],['Checklist',{listStyle:'bullet',style:{accentColor:'#16a34a',background:'#f0fdf4',borderWidth:1,borderColor:'#bbf7d0',borderRadius:10}}],['Timeline',{listStyle:'number',style:{accentColor:'#7c3aed',background:'#faf5ff',borderWidth:1,borderColor:'#ddd6fe',borderRadius:10}}]] : template === 'heading-example' ? [['Highlight Box',{style:{accentColor:'#d97706',background:'#fffbeb',borderWidth:1,borderColor:'#fde68a',borderRadius:12}}],['Note Card',{style:{accentColor:'#0284c7',background:'#f0f9ff',borderWidth:1,borderColor:'#bae6fd',borderRadius:12}}],['Pro Tip',{style:{accentColor:'#16a34a',background:'#f0fdf4',borderWidth:1,borderColor:'#bbf7d0',borderRadius:12}}],['Case Study',{style:{accentColor:'#7c3aed',background:'#faf5ff',borderWidth:1,borderColor:'#ddd6fe',borderRadius:12}}]] : template === 'heading-image' ? [['Image Left',{style:{imageFit:'contain',accentColor:'#2563eb',background:'#eff6ff',borderRadius:12}}],['Image Right',{style:{imageFit:'cover',accentColor:'#0d9488',background:'#f0fdfa',borderRadius:12}}],['Full Width',{imageFit:'cover',fullWidth:true,style:{accentColor:'#2563eb',background:'#fff',borderRadius:8}}],['Image Card',{style:{imageFit:'cover',accentColor:'#7c3aed',background:'#faf5ff',borderWidth:1,borderRadius:16,shadow:'soft'}}]] : [['Modern',{style:{accentColor:'#2563eb',background:'#eff6ff',borderWidth:1,borderColor:'#bfdbfe',borderRadius:12,shadow:'soft'}}],['Minimal',{style:{accentColor:'#64748b',background:'#fff',borderWidth:0,borderRadius:4,shadow:'none'}}],['Bordered',{style:{accentColor:'#0d9488',background:'#fff',borderWidth:2,borderColor:'#99f6e4',borderRadius:8}}],['Gradient',{style:{accentColor:'#7c3aed',background:'#f5f3ff',borderWidth:0,borderRadius:14,shadow:'soft'}}],['Card',{style:{accentColor:'#2563eb',background:'#fff',borderWidth:1,borderColor:'#dbe4f3',borderRadius:16,shadow:'soft'}}]])

/** Dark / Light ready-made designs. Switching the tab only changes which templates are listed; a template is applied only when clicked. */
function ReadyDesigns({ block, d, patch, ui, setUi }) {
  const mode = ui.designTheme === 'light' ? 'light' : 'dark'
  const layouts = layoutPresets(block.template)
  return <Section title="Ready-made Designs">
    <div className="design-tabs" role="tablist" aria-label="Design theme">
      <button type="button" role="tab" aria-selected={mode==='dark'} className={mode==='dark'?'on':''} onClick={()=>setUi({designTheme:'dark'})}><LuMoon/> Dark Themes</button>
      <button type="button" role="tab" aria-selected={mode==='light'} className={mode==='light'?'on':''} onClick={()=>setUi({designTheme:'light'})}><LuSun/> Light Themes</button>
    </div>
    <div className="ready-design-grid themed">{THEME_TEMPLATES.map(t=><button type="button" key={t.id} title={t.sub} onClick={()=>patch({style:{...d.style,...themeTemplateStyle(t,mode)}})}><span className="ready-design-swatch" style={{background:t[mode].background,borderColor:t[mode].accentColor}}/><span className="ready-design-name"><b>{t.label}</b></span></button>)}</div>
    <p className="ui-hint">Dark is the default. A template is applied only when you click it.</p>
    <span className="sc-label d-block mt-2 mb-1">Layout styles</span>
    <div className="ready-design-grid">{layouts.map(([name,preset])=><button type="button" key={name} onClick={()=>{const {style:stPatch,...rest}=preset;patch({...rest,style:{...d.style,...(stPatch||{}),...(isLightHex(stPatch?.background) ? {textColor:'#0f172a',headingColor:'#0f172a'} : {}),theme:'custom'}})}}><span className="ready-design-swatch" style={{background:preset.style?.background||d.style.background,borderColor:preset.style?.accentColor||d.style.accentColor}}/><b>{name}</b></button>)}</div>
  </Section>
}

export function ReadyBlockProps({block,setBlock,setData,ui,setUi,onSave,dirty}) {
  const d = merged(block.data), [uploading,setUploading] = useState(false)
  const tab = ui.readyPropsTab || 'content'
  const patch = p => setData(p)
  const style = p => patch({style:{...d.style,...p}})
  const spacing = p => patch({spacing:{...d.spacing,...p}})
  const upload = async file => {
    if (!file) return
    setUploading(true)
    try { const image = await uploadImage(file,'lesson-block-image',{max:1600}); patch({image}) }
    catch(e) { window.alert(e.message || 'Image upload failed.') }
    finally { setUploading(false) }
  }
  const title = block.template === 'heading-paragraph' ? 'Heading & Paragraph' : block.template === 'heading-image' ? 'Heading & Image' : block.template === 'heading-list' ? 'Heading & List' : block.template === 'heading-example' ? 'Heading & Example' : 'Multiple Heading Sections'
  const setItem = (i,v) => patch({items:d.items.map((x,n)=>n===i?v:x)})
  const setSection = (i,p) => patch({sections:d.sections.map((x,n)=>n===i?{...x,...p}:x)})
  return <div className="ready-props">
    <div className="ready-props-title"><b title={title}>{title}</b><span className="pill pill-info pill-xs">Ready-made block</span></div>
    <Tabs value={tab} onChange={v=>setUi({readyPropsTab:v})} items={[{value:'content',label:'Content'},{value:'style',label:'Style'},{value:'spacing',label:'Spacing'},{value:'advanced',label:'Advanced'}]} className="props-tabs"/>
    <ReadyDesigns block={block} d={d} patch={patch} ui={ui} setUi={setUi}/>
    {tab === 'content' && <>
      {block.template === 'multi-heading' ? <Section title="Heading Sections">{d.sections.map((x,i)=><div className="ready-edit-card" key={i}><div className="d-flex justify-content-between align-items-center mb-2"><b>Section {i+1}</b><button className="icon-mini danger" onClick={()=>patch({sections:d.sections.filter((_,n)=>n!==i)})}><LuTrash2/></button></div><FieldInput label="Heading" value={x.heading} placeholder={PLACEHOLDERS.heading} onChange={v=>setSection(i,{heading:v})}/><Field label="Heading Level"><select className="ui-input ui-select" value={x.level} onChange={e=>setSection(i,{level:e.target.value})}>{['h1','h2','h3','h4','h5','h6'].map(v=><option key={v}>{v}</option>)}</select></Field><TextArea label="Section Text" value={x.body} placeholder={PLACEHOLDERS.body} onChange={v=>setSection(i,{body:v})}/></div>)}<button className="btn ui-btn ui-btn-secondary w-100" onClick={()=>patch({sections:[...d.sections,{heading:'',level:'h2',body:''}]})}><LuPlus/> Add Section</button></Section> :
      <>
        <AutoGrow label="Section Heading" value={d.heading} placeholder={PLACEHOLDERS.heading} onChange={v=>patch({heading:v})}/>
        {block.template !== 'heading-list' && <TextArea label={block.template === 'heading-image' ? 'Description / Explanation' : 'Paragraph Content'} value={d.body} placeholder={PLACEHOLDERS.body} onChange={v=>patch({body:v})}/>}
        {block.template === 'heading-image' && <Section title="Image Content"><div className="ready-upload">{d.image ? <img src={d.image} alt={d.imageAlt || 'Uploaded lesson image'}/> : <div><LuImage/><span>No image selected</span></div>}<label className="btn ui-btn ui-btn-secondary w-100">{uploading ? 'Uploading…' : <><LuUpload/> Choose Image</>}<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{upload(e.target.files?.[0]);e.target.value=''}}/></label>{d.image && <button className="btn ui-btn ui-btn-danger w-100 mt-2" onClick={()=>patch({image:''})}><LuTrash2/> Remove Image</button>}</div><FieldInput label="Image Alt Text" value={d.imageAlt} placeholder={PLACEHOLDERS.imageAlt} onChange={v=>patch({imageAlt:v})}/><FieldInput label="Image Caption" value={d.caption} placeholder={PLACEHOLDERS.caption} onChange={v=>patch({caption:v})}/><Field label="Image Fit"><select className="ui-input ui-select" value={d.style.imageFit} onChange={e=>style({imageFit:e.target.value})}><option value="contain">Contain</option><option value="cover">Cover</option></select></Field></Section>}
        {block.template === 'heading-list' && <Section title="List Items"><Field label="List Style"><div className="ui-chip-row"><button className={`ui-chip ${d.listStyle==='bullet'?'on':''}`} onClick={()=>patch({listStyle:'bullet'})}>Bullets</button><button className={`ui-chip ${d.listStyle==='number'?'on':''}`} onClick={()=>patch({listStyle:'number'})}>Numbered</button></div></Field>{d.items.map((x,i)=><div className="d-flex gap-2 align-items-center mb-2" key={i}><span className="text-soft">{i+1}.</span><input className="ui-input" value={x} placeholder={PLACEHOLDERS.item} onChange={e=>setItem(i,e.target.value)}/><button className="icon-mini danger" onClick={()=>patch({items:d.items.filter((_,n)=>n!==i)})}><LuX/></button></div>)}<button className="btn ui-btn ui-btn-secondary w-100" onClick={()=>patch({items:[...d.items,'']})}><LuPlus/> Add Item</button></Section>}
        {block.template === 'heading-example' && <Section title="Example Box"><FieldInput label="Example Label" value={d.exampleTitle} placeholder={PLACEHOLDERS.exampleTitle} onChange={v=>patch({exampleTitle:v})}/><TextArea label="Example Explanation" value={d.exampleText} placeholder={PLACEHOLDERS.exampleText} onChange={v=>patch({exampleText:v})}/></Section>}
      </>}
      <div className="prop-row"><span>Show in Chapter</span><Toggle checked={block.visible !== false} onChange={v=>setBlock({visible:v})} small/></div>
    </>}
    {tab === 'style' && <><Section title="Typography"><Field label="Font Family"><select className="ui-input ui-select" value={d.style.fontFamily} onChange={e=>style({fontFamily:e.target.value})}>{['Inter','Poppins','Noto Sans Oriya','Arial','Georgia','system-ui'].map(x=><option key={x}>{x}</option>)}</select></Field><div className="row g-2"><div className="col-6"><NumberField label="Body Font Size" value={d.style.fontSize} min={10} max={32} onChange={v=>style({fontSize:v})} suffix="px"/></div><div className="col-6"><NumberField label="Heading Size" value={d.style.headingSize} min={16} max={48} onChange={v=>style({headingSize:v})} suffix="px"/></div></div><Field label="Text Alignment"><select className="ui-input ui-select" value={d.style.textAlign} onChange={e=>style({textAlign:e.target.value})}>{['left','center','right','justify'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Heading Alignment"><select className="ui-input ui-select" value={d.style.headingAlign} onChange={e=>style({headingAlign:e.target.value})}>{['left','center','right'].map(x=><option key={x}>{x}</option>)}</select></Field><div className="row g-2"><div className="col-6"><NumberField label="Line Height" value={d.style.lineHeight} min={1} max={2.5} step={0.05} onChange={v=>style({lineHeight:v})}/></div><div className="col-6"><Field label="Font Weight"><select className="ui-input ui-select" value={d.style.fontWeight} onChange={e=>style({fontWeight:Number(e.target.value)})}>{[400,500,600,700].map(x=><option key={x} value={x}>{x}</option>)}</select></Field></div><div className="col-6"><Color label="Heading Color" value={d.style.headingColor} onChange={v=>style({headingColor:v})}/></div><div className="col-6"><Color label="Body Text Color" value={d.style.textColor} onChange={v=>style({textColor:v})}/></div><div className="col-6"><Color label="Accent Color" value={d.style.accentColor} onChange={v=>style({accentColor:v})}/></div><div className="col-6"><Color label="Background Color" value={d.style.background} onChange={v=>style({background:v})}/></div></div></Section><Section title="Border & Shape"><div className="row g-2"><div className="col-6"><NumberField label="Border Width" value={d.style.borderWidth} min={0} max={8} onChange={v=>style({borderWidth:v})} suffix="px"/></div><div className="col-6"><NumberField label="Border Radius" value={d.style.borderRadius} min={0} max={40} onChange={v=>style({borderRadius:v})} suffix="px"/></div><div className="col-12"><Color label="Border Color" value={d.style.borderColor} onChange={v=>style({borderColor:v})}/></div><div className="col-12"><Field label="Shadow"><select className="ui-input ui-select" value={d.style.shadow} onChange={e=>style({shadow:e.target.value})}><option value="none">None</option><option value="soft">Soft</option><option value="strong">Strong</option></select></Field></div></div></Section></>}
    {tab === 'spacing' && <Section title="Layout & Spacing"><div className="row g-2"><div className="col-6"><NumberField label="Padding" value={d.spacing.padding} min={0} max={100} onChange={v=>spacing({padding:v})} suffix="px"/></div><div className="col-6"><NumberField label="Top Margin" value={d.spacing.marginTop} min={0} max={120} onChange={v=>spacing({marginTop:v})} suffix="px"/></div><div className="col-6"><NumberField label="Bottom Margin" value={d.spacing.marginBottom} min={0} max={120} onChange={v=>spacing({marginBottom:v})} suffix="px"/></div><div className="col-6"><NumberField label="Maximum Width" value={d.spacing.maxWidth} min={320} max={1600} onChange={v=>spacing({maxWidth:v})} suffix="px"/></div><div className="col-6"><NumberField label="List / Item Gap" value={d.spacing.itemGap} min={0} max={40} onChange={v=>spacing({itemGap:v})} suffix="px"/></div></div><div className="prop-row"><span>Full Width</span><Toggle checked={!!d.fullWidth} onChange={v=>patch({fullWidth:v})} small/></div></Section>}
    {tab === 'advanced' && <><Section title="Visibility"><div className="prop-row"><span>Show in Chapter</span><Toggle checked={block.visible !== false} onChange={v=>setBlock({visible:v})} small/></div><p className="ui-hint">Hidden blocks stay in the builder but students do not see them.</p></Section><Section title="Block Metadata"><FieldInput label="Accessible Label" value={d.ariaLabel || ''} onChange={v=>patch({ariaLabel:v})}/><p className="ui-hint">This block is stored as structured content. No HTML/CSS code editor is used.</p></Section></>}
    <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave} disabled={!dirty}><LuSave/>{dirty ? 'Save Block' : 'Saved'}</button>
  </div>
}
