/* Tiny HTML5 drag & drop helper for reordering (sections, paragraphs, list items, table rows, formula / example boxes).
 * One drag at a time:  handleProps()  → spread on the ⋮⋮ grip,   targetProps()  → spread on every element that can receive the drop.
 * The drop indicator is drawn by toggling .js-drop-before / .js-drop-after classes straight on the DOM (no re-render while dragging).
 * Elements only accept drops of the same `kind` and `scope` (e.g. kind "item", scope "<sectionId>:paragraphs"). */
let cur = null

const clear = () => { document.querySelectorAll('.js-drop-before,.js-drop-after,.dd-before,.dd-after').forEach((el) => el.classList.remove('js-drop-before', 'js-drop-after', 'dd-before', 'dd-after')) }
const markClass = (cls) => (cls === 'dd' ? ['dd-before', 'dd-after'] : ['js-drop-before', 'js-drop-after'])

/** props for the drag grip. `host` = selector of the element that is dragged (its look becomes the drag image). */
export function handleProps({ kind, scope, index, host = '.js-el,.js-sec,tr,.dd-row' }) {
  return {
    draggable: true,
    onDragStart: (e) => {
      cur = { kind, scope, index }
      const el = e.currentTarget.closest(host)
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${kind}:${scope}:${index}`); if (el) e.dataTransfer.setDragImage(el, 16, 16) } catch { /* old browsers */ }
      if (el) setTimeout(() => el.classList.add('js-dragging'), 0)
      e.stopPropagation()
    },
    onDragEnd: () => { cur = null; clear(); document.querySelectorAll('.js-dragging').forEach((el) => el.classList.remove('js-dragging')) },
    onMouseDown: (e) => e.stopPropagation(),
  }
}

/** props for a drop target. onMove(from, to): `to` is the insertion index in the ORIGINAL array (use arrayMove). */
export function targetProps({ kind, scope, index, onMove, cls = 'js' }) {
  const [before, after] = markClass(cls)
  const ok = () => cur && cur.kind === kind && cur.scope === scope
  return {
    onDragOver: (e) => {
      if (!ok()) return
      e.preventDefault(); e.stopPropagation()
      try { e.dataTransfer.dropEffect = 'move' } catch { /* ignore */ }
      const r = e.currentTarget.getBoundingClientRect()
      const isAfter = e.clientY > r.top + r.height / 2
      if (e.currentTarget.classList.contains(isAfter ? after : before)) return
      clear()
      e.currentTarget.classList.add(isAfter ? after : before)
    },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove(before, after) },
    onDrop: (e) => {
      if (!ok()) return
      e.preventDefault(); e.stopPropagation()
      const r = e.currentTarget.getBoundingClientRect()
      const isAfter = e.clientY > r.top + r.height / 2
      const from = cur.index
      cur = null; clear()
      document.querySelectorAll('.js-dragging').forEach((el) => el.classList.remove('js-dragging'))
      onMove(from, isAfter ? index + 1 : index)
    },
  }
}
