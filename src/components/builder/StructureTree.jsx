import { useEffect, useRef, useState } from 'react'
import { LuArrowDown, LuArrowUp, LuBookOpen, LuChevronDown, LuChevronRight, LuCirclePlus, LuCopy, LuEllipsisVertical, LuGripVertical, LuListTree, LuPlus, LuSearch, LuSquarePen, LuTrash2 } from 'react-icons/lu'
import { BLOCK_TYPES } from '../../lib/content'
import { blockBadge, blockHeading, plural } from '../../lib/blockLabel'
import { IconOf } from '../ui/icons'

export function BlockBadge({ type }) {
  return <span className={`blk-badge t-${type}`} title={BLOCK_TYPES[type]?.label}>{blockBadge(type)}</span>
}

function Kebab({ items, label }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const hide = () => setOpen(false)
    document.addEventListener('mousedown', close); window.addEventListener('resize', hide); document.addEventListener('scroll', hide, true)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('resize', hide); document.removeEventListener('scroll', hide, true) }
  }, [open])
  const toggleMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const n = items.filter(Boolean).length, h = n * 36 + 12
    const top = r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4
    setPos({ top, left: Math.max(8, Math.min(r.right - 190, window.innerWidth - 198)) })
    setOpen((o) => !o)
  }
  return (
    <div className="kebab" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="icon-mini" onClick={toggleMenu} aria-label={label} aria-expanded={open}><LuEllipsisVertical /></button>
      {open && (
        <div className="kebab-menu kebab-fixed" role="menu" style={pos ? { top: pos.top, left: pos.left } : undefined}>
          {items.filter(Boolean).map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled} className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick() }}>{it.icon}{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Left panel — Portal → Units → Chapters → Blocks, with search, menus and drag reorder */
export default function StructureTree({ content, sel, onSelect, act, workingBlock, headRight }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const isOpen = (id) => open[id] !== false
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !isOpen(id) }))
  const term = q.trim().toLowerCase()
  const units = content.units.map((u, ui) => ({ u, ui })).filter(({ u }) => !term || u.title.toLowerCase().includes(term) || u.chapters.some((c) => c.title.toLowerCase().includes(term)))

  const dragProps = (kind, index, parent) => ({
    draggable: true,
    onDragStart: (e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', kind); setDrag({ kind, index, parent }) },
    onDragOver: (e) => { if (drag?.kind === kind && drag.parent === parent) { e.preventDefault(); e.stopPropagation(); setOver(`${kind}-${parent}-${index}`) } },
    onDragLeave: () => setOver(null),
    onDrop: (e) => { e.preventDefault(); e.stopPropagation(); if (drag?.kind === kind && drag.parent === parent && drag.index !== index) act.move(kind, parent, drag.index, index); setDrag(null); setOver(null) },
    onDragEnd: () => { setDrag(null); setOver(null) },
  })
  const overCls = (kind, parent, index) => (over === `${kind}-${parent}-${index}` ? 'drop-over' : '')

  return (
    <div className="tree">
      <div className="tree-head">
        <span className="tree-head-title"><LuListTree /> <span>Portal Structure</span></span>
        <span className="pill pill-info ms-auto">{plural(content.units.length, 'unit')}</span>
        {headRight}
      </div>
      <button className="btn ui-btn ui-btn-primary w-100" onClick={act.createUnit}><LuCirclePlus /> Create New Unit</button>
      {content.units.length > 0 && (
        <div className="ui-input-icon mt-2"><LuSearch /><input className="ui-input" placeholder="Search units..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search units" /></div>
      )}

      {content.units.length === 0 ? (
        <div className="tree-empty">
          <div className="tree-empty-art"><LuListTree /></div>
          <strong>No units created yet</strong>
          <span>Start by creating your first unit to organize your study content.</span>
        </div>
      ) : (
        <ul className="tree-list">
          {units.length === 0 && <li className="text-soft small p-2">No units match “{q}”.</li>}
          {units.map(({ u, ui }) => (
            <li key={u.id} className={`tree-unit ${overCls('unit', 'root', ui)}`} {...(term ? {} : dragProps('unit', ui, 'root'))}>
              <div className={`tree-row unit ${sel.unitId === u.id && !sel.chapterId ? 'on' : ''}`} style={{ '--c': u.color }} onClick={() => onSelect({ unitId: u.id })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect({ unitId: u.id })}>
                <LuGripVertical className="grip d-none d-lg-block" aria-hidden="true" />
                <span className="unit-ico"><IconOf name={u.icon} /></span>
                <span className="min-w-0 flex-grow-1">
                  <span className="t">{u.title}</span>
                  <span className="s">{plural(u.chapters.length, 'chapter')}</span>
                </span>
                <button type="button" className="icon-mini" onClick={(e) => { e.stopPropagation(); toggle(u.id) }} aria-label={isOpen(u.id) ? 'Collapse' : 'Expand'}>{isOpen(u.id) ? <LuChevronDown /> : <LuChevronRight />}</button>
                <Kebab label={`Unit options for ${u.title}`} items={[
                  { label: 'Edit Unit', icon: <LuSquarePen />, onClick: () => act.editUnit(u) },
                  { label: 'Add Chapter', icon: <LuPlus />, onClick: () => act.addChapter(u.id) },
                  { label: 'Duplicate', icon: <LuCopy />, onClick: () => act.duplicate('unit', u.id) },
                  { label: 'Move Up', icon: <LuArrowUp />, disabled: ui === 0, onClick: () => act.move('unit', 'root', ui, ui - 1) },
                  { label: 'Move Down', icon: <LuArrowDown />, disabled: ui === content.units.length - 1, onClick: () => act.move('unit', 'root', ui, ui + 1) },
                  { label: 'Delete Unit', icon: <LuTrash2 />, danger: true, onClick: () => act.remove('unit', u.id) },
                ]} />
              </div>

              {isOpen(u.id) && (
                <ul className="tree-chapters">
                  {u.chapters.map((ch, ci) => (
                    <li key={ch.id} className={overCls('chapter', u.id, ci)} {...dragProps('chapter', ci, u.id)}>
                      <div className={`tree-row chapter ${sel.chapterId === ch.id && !sel.blockId ? 'on' : ''}`} style={{ '--c': ch.color }} onClick={() => onSelect({ unitId: u.id, chapterId: ch.id })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect({ unitId: u.id, chapterId: ch.id })}>
                        <LuGripVertical className="grip d-none d-lg-block" aria-hidden="true" />
                        <span className="ch-ico"><LuBookOpen /></span>
                        <span className="t flex-grow-1 min-w-0">{ch.title}</span>
                        <button type="button" className="icon-mini" onClick={(e) => { e.stopPropagation(); toggle(ch.id) }} aria-label={isOpen(ch.id) ? 'Collapse' : 'Expand'}>{isOpen(ch.id) ? <LuChevronDown /> : <LuChevronRight />}</button>
                        <Kebab label={`Chapter options for ${ch.title}`} items={[
                          { label: 'Edit Chapter', icon: <LuSquarePen />, onClick: () => act.editChapter(ch, u) },
                          { label: 'Add Block', icon: <LuPlus />, onClick: () => act.addBlock(u.id, ch.id) },
                          { label: 'Duplicate', icon: <LuCopy />, onClick: () => act.duplicate('chapter', ch.id) },
                          { label: 'Move Up', icon: <LuArrowUp />, disabled: ci === 0, onClick: () => act.move('chapter', u.id, ci, ci - 1) },
                          { label: 'Move Down', icon: <LuArrowDown />, disabled: ci === u.chapters.length - 1, onClick: () => act.move('chapter', u.id, ci, ci + 1) },
                          { label: 'Delete Chapter', icon: <LuTrash2 />, danger: true, onClick: () => act.remove('chapter', ch.id) },
                        ]} />
                      </div>
                      {isOpen(ch.id) && (
                        <ul className="tree-blocks">
                          {ch.blocks.map((src, bi) => { const b = workingBlock?.id === src.id ? workingBlock : src; const label = blockHeading(b, bi); return (
                            <li key={b.id} className={overCls('block', ch.id, bi)} {...dragProps('block', bi, ch.id)}>
                              <div className={`tree-row block ${sel.blockId === b.id ? 'on' : ''} ${b.visible === false ? 'hidden-blk' : ''}`} onClick={() => onSelect({ unitId: u.id, chapterId: ch.id, blockId: b.id })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect({ unitId: u.id, chapterId: ch.id, blockId: b.id })} title={`${label}${b.visible === false ? ' (hidden from students)' : ''}`}>
                                <LuGripVertical className="grip d-none d-lg-block" aria-hidden="true" />
                                <BlockBadge type={b.type} />
                                <span className="min-w-0 flex-grow-1 tree-block-line"><span className="t">{label}</span>{b.visible === false && <span className="tree-hidden-tag">hidden</span>}</span>
                                <Kebab label={`Block options for ${label}`} items={[
                                  { label: 'Duplicate', icon: <LuCopy />, onClick: () => act.duplicate('block', b.id) },
                                  { label: 'Move Up', icon: <LuArrowUp />, disabled: bi === 0, onClick: () => act.move('block', ch.id, bi, bi - 1) },
                                  { label: 'Move Down', icon: <LuArrowDown />, disabled: bi === ch.blocks.length - 1, onClick: () => act.move('block', ch.id, bi, bi + 1) },
                                  { label: 'Delete Block', icon: <LuTrash2 />, danger: true, onClick: () => act.remove('block', b.id) },
                                ]} />
                              </div>
                            </li>
                          ) })}
                          <li><button type="button" className="tree-add" onClick={() => act.addBlock(u.id, ch.id)}><LuPlus /> Add block</button></li>
                        </ul>
                      )}
                    </li>
                  ))}
                  <li><button type="button" className="tree-add chapter-add" onClick={() => act.addChapter(u.id)}><LuCirclePlus /> Add Chapter</button></li>
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
