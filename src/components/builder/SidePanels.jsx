import { LuArrowDown, LuArrowUp, LuBookOpen, LuCheck, LuCirclePlus, LuCopy, LuLayers, LuMove, LuPalette, LuRocket, LuSettings, LuTrash2, LuWandSparkles } from 'react-icons/lu'

export function SetupGuide({ content, published, headRight }) {
  const units = content.units.length
  const chapters = content.units.reduce((s, u) => s + u.chapters.length, 0)
  const blocks = content.units.reduce((s, u) => s + u.chapters.reduce((a, c) => a + c.blocks.length, 0), 0)
  const steps = [
    { t: 'Create Unit', d: 'Add units to organize your subject.', done: units > 0 },
    { t: 'Add Chapters', d: 'Add chapters inside each unit.', done: chapters > 0 },
    { t: 'Add Content Blocks', d: 'Add ready-made lessons, JSON or MCQ content.', done: blocks > 0 },
    { t: 'Publish Portal', d: 'Make your portal live for students.', done: !!published },
  ]
  const done = steps.filter((s) => s.done).length
  return (
    <div className="panel-card">
      <div className="panel-title"><LuRocket /> <span className="panel-title-text">Portal Setup Guide</span>{headRight}</div>
      <div className="guide-progress"><span style={{ width: `${(done / 4) * 100}%` }} /></div>
      <div className="small text-soft mb-3">{done} of 4 steps completed</div>
      <ol className="guide">
        {steps.map((s, i) => (
          <li key={s.t} className={s.done ? 'done' : i === done ? 'cur' : ''}>
            <span className="num">{s.done ? <LuCheck /> : i + 1}</span>
            <span><b>{s.t}</b><small>{s.d}</small></span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Action({ icon, label, sub, onClick, danger, right, disabled, disabledHint }) {
  return (
    <div className={`act ${danger ? 'danger' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <button type="button" className="act-main" onClick={onClick} disabled={disabled} title={disabled ? disabledHint : undefined}>
        <span className="act-ico">{icon}</span>
        <span className="min-w-0"><b>{label}</b>{(disabled ? disabledHint : sub) && <small>{disabled ? disabledHint : sub}</small>}</span>
      </button>
      {right}
    </div>
  )
}
const MoveBtns = ({ onUp, onDown, upOff, downOff }) => (
  <span className="act-move">
    <button className="icon-mini" disabled={upOff} onClick={onUp} aria-label="Move up" title="Move up"><LuArrowUp /></button>
    <button className="icon-mini" disabled={downOff} onClick={onDown} aria-label="Move down" title="Move down"><LuArrowDown /></button>
  </span>
)

export function UnitActions({ unit, index, count, act, headRight }) {
  return (
    <div className="panel-card">
      <div className="panel-title"><LuLayers /> <span className="panel-title-text">Unit Actions</span>{headRight}</div>
      <Action icon={<LuWandSparkles />} label="Design Content" sub="Open the first chapter's content" onClick={() => act.designUnit(unit)} disabled={unit.chapters.length === 0} disabledHint="Add a chapter first" />
      <Action icon={<LuSettings />} label="Unit Settings" sub="Title, icon, color, description" onClick={() => act.editUnit(unit)} />
      <Action icon={<LuCopy />} label="Duplicate Unit" sub="Copy with all chapters & blocks" onClick={() => act.duplicate('unit', unit.id)} />
      <Action icon={<LuMove />} label="Move Unit" sub={`Position ${index + 1} of ${count}`} onClick={() => {}} disabled={false} right={<MoveBtns upOff={index === 0} downOff={index === count - 1} onUp={() => act.move('unit', 'root', index, index - 1)} onDown={() => act.move('unit', 'root', index, index + 1)} />} />
      <Action danger icon={<LuTrash2 />} label="Delete Unit" sub="Remove unit and its content" onClick={() => act.remove('unit', unit.id)} />
    </div>
  )
}

export function ChapterActions({ unit, chapter, index, act, headRight }) {
  return (
    <div className="panel-card">
      <div className="panel-title"><LuBookOpen /> <span className="panel-title-text">Chapter Actions</span>{headRight}</div>
      <Action icon={<LuCirclePlus />} label="Add Block" sub="Ready-made, JSON or MCQ content" onClick={() => act.addBlock(unit.id, chapter.id)} />
      <Action icon={<LuBookOpen />} label="Add Chapter" sub="New chapter in this unit" onClick={() => act.addChapter(unit.id)} />
      <Action icon={<LuPalette />} label="Design Content" sub="Open the chapter content canvas" onClick={() => act.designChapter(unit, chapter)} />
      <Action icon={<LuSettings />} label="Chapter Settings" sub="Title, color, background" onClick={() => act.editChapter(chapter, unit)} />
      <Action icon={<LuCopy />} label="Duplicate Chapter" sub="Copy with all blocks" onClick={() => act.duplicate('chapter', chapter.id)} />
      <Action icon={<LuMove />} label="Move Chapter" sub={`Position ${index + 1} of ${unit.chapters.length}`} onClick={() => {}} right={<MoveBtns upOff={index === 0} downOff={index === unit.chapters.length - 1} onUp={() => act.move('chapter', unit.id, index, index - 1)} onDown={() => act.move('chapter', unit.id, index, index + 1)} />} />
      <Action danger icon={<LuTrash2 />} label="Delete Chapter" sub="Remove chapter and its blocks" onClick={() => act.remove('chapter', chapter.id)} />
    </div>
  )
}
