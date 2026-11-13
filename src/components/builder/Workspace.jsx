import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowUp,
  LuBookOpen,
  LuChevronRight,
  LuCirclePlus,
  LuClock,
  LuCopy,
  LuEye,
  LuEyeOff,
  LuFileText,
  LuImage,
  LuLayers,
  LuPencilLine,
  LuPlus,
  LuSquarePen,
  LuTrash2,
} from 'react-icons/lu'
import HeadingBgLayers from '../ui/HeadingBg'
import { SliderView, YoutubeView } from './MediaBlocks'
import builderHero from '../../assets/builder-hero.jpg'
import { unitStats } from '../../lib/content'
import { blockTypeLabel, plural } from '../../lib/blockLabel'
import { ReadyBlockView } from './ReadyBlockEditor'
import McqPlayer from '../mcq/McqPlayer'
import SandboxFrame from '../ui/SandboxFrame'
import TableView from '../ui/TableView'
import { RichToolbar } from '../ui/RichText'
import { isExamBlock } from '../../lib/mcq'
import { frameProps } from '../../lib/blockRender'
import { timeAgo } from '../../lib/id'
import { IconOf } from '../ui/icons'
import { BlockBadge } from './StructureTree'

export function Welcome({ onCreate }) {
  return (
    <div className="ws-welcome">
      <div
        className="ws-hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(4,10,24,.15), rgba(4,10,24,.85)), url(${builderHero})`,
        }}
      >
        <div className="ws-hero-inner">
          <span className="ws-hero-ico">
            <LuLayers />
          </span>
          <h2>Start Building Your Study Portal</h2>
          <p>Create units, add chapters and design engaging content for your students.</p>
          <button type="button" className="btn ui-btn ui-btn-primary btn-lg" onClick={onCreate}>
            <LuCirclePlus /> Create First Unit
          </button>
        </div>
      </div>
      <div className="ws-features">
        <div>
          <span className="f-ico blue">
            <LuLayers />
          </span>
          <b>Units</b>
          <small>Group your subject into major parts</small>
        </div>
        <div>
          <span className="f-ico purple">
            <LuBookOpen />
          </span>
          <b>Chapters</b>
          <small>Organize topics inside each unit</small>
        </div>
        <div>
          <span className="f-ico teal">
            <LuFileText />
          </span>
          <b>Content Blocks</b>
          <small>Ready-made lessons, JSON and MCQ tests</small>
        </div>
      </div>
    </div>
  )
}

/**
 * Breadcrumb Component (Screenshot 1 Fix)
 * Uses clean .crumb styling without white button outlines, matching RK dark navy theme.
 */
export function Crumbs({ unit, chapter, block, onSelect, badge }) {
  return (
    <div className="ws-crumbs">
      <nav aria-label="Content path" className="d-flex align-items-center flex-wrap gap-1">
        <button type="button" className="crumb" onClick={() => onSelect({})}>
          Units
        </button>
        {unit && (
          <>
            <LuChevronRight className="sep" />
            <button
              type="button"
              className={`crumb ${!chapter ? 'cur' : ''}`}
              onClick={() => onSelect({ unitId: unit.id })}
            >
              {unit.title}
            </button>
          </>
        )}
        {chapter && (
          <>
            <LuChevronRight className="sep" />
            <button
              type="button"
              className={`crumb ${!block ? 'cur' : ''}`}
              onClick={() => onSelect({ unitId: unit.id, chapterId: chapter.id })}
            >
              {chapter.title}
            </button>
          </>
        )}
        {block && (
          <>
            <LuChevronRight className="sep" />
            <span className="crumb cur">{blockTypeLabel(block.type)}</span>
          </>
        )}
      </nav>
      {badge}
    </div>
  )
}

export function StatsRow({ unit }) {
  const s = unitStats(unit)
  const last = Math.max(
    unit.updatedAt || 0,
    unit.createdAt || 0,
    ...unit.chapters.flatMap((c) => c.blocks.map((b) => b.updatedAt || 0))
  )
  return (
    <div className="ws-stats">
      <div>
        <span className="i blue">
          <LuBookOpen />
        </span>
        <span>
          <small>Chapters</small>
          <b>{s.chapters}</b>
        </span>
      </div>
      <div>
        <span className="i purple">
          <LuFileText />
        </span>
        <span>
          <small>Blocks</small>
          <b>{s.contents}</b>
        </span>
      </div>
      <div>
        <span className="i pink">
          <LuImage />
        </span>
        <span>
          <small>Media</small>
          <b>{s.media}</b>
        </span>
      </div>
      <div>
        <span className="i teal">
          <LuClock />
        </span>
        <span>
          <small>Last Updated</small>
          <b className="sm">{timeAgo(last)}</b>
        </span>
      </div>
    </div>
  )
}

/**
 * Unit Page View (Screenshot 2 Fix)
 * Completely eliminates white bootstrap cards and restores dark navy surface with ws-list and ws-item buttons.
 */
export function UnitView({ unit, onSelect, onAddChapter, onEdit }) {
  const fullBg =
    unit.fullBackgroundMode === 'image' && unit.fullBackgroundImage
      ? `linear-gradient(90deg,rgba(4,10,24,.55),rgba(4,10,24,.15)),url(${unit.fullBackgroundImage})`
      : unit.fullBackgroundMode === 'gradient'
      ? `linear-gradient(120deg,${unit.fullStartColor || '#0d47a1'},${unit.fullEndColor || '#1976d2'})`
      : unit.fullBackgroundMode === 'color'
      ? unit.fullBackgroundColor || 'transparent'
      : 'transparent'

  return (
    <div
      className="ws-unit-surface"
      style={{
        background: fullBg,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: '14px',
        padding: '12px',
      }}
    >
      <StatsRow unit={unit} />
      <div
        className="ws-banner"
        style={{
          '--c': unit.color,
          color: unit.headingTextColor || '#fff',
          borderColor: unit.headingAccentColor || unit.color,
          background:
            unit.headingBackgroundMode === 'image' && unit.headingBackgroundImage
              ? `linear-gradient(90deg,rgba(4,10,24,.72),rgba(4,10,24,.28)),url(${unit.headingBackgroundImage}) center/cover`
              : unit.headingBackgroundMode === 'solid'
              ? unit.headingSolidColor || '#0d47a1'
              : `linear-gradient(110deg, ${unit.headingStartColor || '#0756b9'}, ${
                  unit.headingEndColor || '#087fcb'
                })`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <span className="b-ico" style={{ background: unit.color }}>
          <IconOf name={unit.icon} />
        </span>
        <div className="min-w-0">
          <h2
            title={unit.title}
            style={{
              fontSize: unit.headingSize || Math.max(18, (unit.titleSize || 18) + 6),
              color: unit.headingTextColor || '#fff',
            }}
          >
            {unit.title}
          </h2>
          {unit.description && (
            <p style={{ fontSize: unit.descSize, color: unit.headingTextColor || '#fff' }}>
              {unit.description}
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-mini b-edit"
          onClick={onEdit}
          aria-label="Edit unit"
          title="Edit unit"
        >
          <LuSquarePen />
        </button>
      </div>

      {unit.chapters.length === 0 ? (
        <div className="ws-empty">
          <div className="ws-empty-art">
            <LuBookOpen />
            <span className="plus">
              <LuPlus />
            </span>
          </div>
          <h3>No Chapters Added Yet</h3>
          <p>Start adding chapters to organize your unit content.</p>
          <button type="button" className="btn ui-btn ui-btn-primary" onClick={onAddChapter}>
            <LuCirclePlus /> Add Chapter
          </button>
        </div>
      ) : (
        <div className="ws-list">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h3 className="ws-h">Chapters ({unit.chapters.length})</h3>
            <button
              type="button"
              className="btn ui-btn ui-btn-secondary btn-sm"
              onClick={onAddChapter}
            >
              <LuPlus /> Add Chapter
            </button>
          </div>
          {unit.chapters.map((ch, i) => (
            <button
              key={ch.id}
              type="button"
              className="ws-item"
              style={{ '--c': ch.color }}
              onClick={() => onSelect({ unitId: unit.id, chapterId: ch.id })}
            >
              <span className="n">{i + 1}</span>
              <span className="min-w-0 flex-grow-1 text-start">
                <b>{ch.title}</b>
                <small>{plural(ch.blocks.length, 'block')}</small>
              </span>
              <LuChevronRight />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChapterBar({ chapter, onEdit, onDuplicate, onDelete, back }) {
  return (
    <div
      className={`ws-chbar chbg-${chapter.headingBackgroundMode || 'gradient'} ${
        chapter.headingBackgroundMode === 'image' ? 'has-hb' : ''
      }`}
      style={{
        '--c': chapter.headingAccentColor || chapter.color,
        color: chapter.headingTextColor || '#fff',
        background:
          chapter.headingBackgroundMode === 'image'
            ? '#0b1f44'
            : chapter.headingBackgroundMode === 'solid'
            ? chapter.headingSolidColor || '#173b83'
            : `linear-gradient(110deg, ${
                chapter.headingStartColor || '#087f5b'
              }, ${chapter.headingEndColor || '#0d6efd'})`,
        borderColor: chapter.headingAccentColor || chapter.color,
      }}
    >
      <HeadingBgLayers chapter={chapter} />
      {back && (
        <button
          type="button"
          className="icon-mini"
          onClick={back}
          aria-label="Back to chapter"
        >
          <LuArrowLeft />
        </button>
      )}
      <span className="ch-ico">
        <LuBookOpen />
      </span>
      <span className="ch-heading-copy">
        <span
          className="t"
          style={{
            fontSize: chapter.headingSize || chapter.titleSize || 18,
            color: chapter.headingTextColor || '#fff',
          }}
        >
          {chapter.title}
        </span>
        {chapter.description && <small>{chapter.description}</small>}
      </span>
      <span className="ms-auto d-flex gap-1">
        <button
          type="button"
          className="icon-mini"
          onClick={onEdit}
          aria-label="Edit chapter"
          title="Edit"
        >
          <LuPencilLine />
        </button>
        <button
          type="button"
          className="icon-mini"
          onClick={onDuplicate}
          aria-label="Duplicate chapter"
          title="Duplicate"
        >
          <LuCopy />
        </button>
        <button
          type="button"
          className="icon-mini danger"
          onClick={onDelete}
          aria-label="Delete chapter"
          title="Delete"
        >
          <LuTrash2 />
        </button>
      </span>
    </div>
  )
}

function ChapterBlockContent({ block, onEditData, onUploadImage, editor }) {
  if (editor) return editor
  if (
    [
      'heading-paragraph',
      'heading-image',
      'heading-list',
      'heading-example',
      'multi-heading',
      'image-to-text',
    ].includes(block.type)
  ) {
    return <ReadyBlockView block={block} onEdit={onEditData} onUploadImage={onUploadImage} />
  }
  if (block.type === 'mcq') {
    return (
      <>
        {isExamBlock(block) && (
          <div className="exam-flag">
            Chapter exam — students open it from the “Take Exam” button in the lesson sidebar.
          </div>
        )}
        <McqPlayer data={block.data} mode="preview" compact />
      </>
    )
  }
  if (block.type === 'table') return <TableView data={block.data} />
  if (block.type === 'youtube') return <YoutubeView block={block} preview />
  if (block.type === 'slider') return <SliderView block={block} preview />
  const props = frameProps(block)
  if (props)
    return <SandboxFrame {...props} title={block.title || 'Lesson content'} minHeight={120} />
  return <div className="chapter-block-unsupported">Preview is not available for this block type.</div>
}

/**
 * Chapter Artboard Workspace
 * Screenshot 3 Fix: RichToolbar is moved right above "Chapter content" and given
 * sticky behavior via .rt-sticky, appearing only when a rich-text block is selected!
 */
export function ChapterView({
  unit,
  chapter,
  selectedBlockId,
  workingBlock,
  onSelect,
  onEditData,
  onUploadImage,
  onAddBlock,
  act,
  renderEditor,
  showFormattingToolbar,
}) {
  return (
    <div
      className="ws-blocks chapter-artboard"
      style={{
        background:
          chapter.fullBackgroundMode === 'solid'
            ? chapter.fullSolidColor || 'transparent'
            : chapter.fullBackgroundMode === 'gradient'
            ? `linear-gradient(120deg,${chapter.fullStartColor || '#0d47a1'},${
                chapter.fullEndColor || '#1976d2'
              })`
            : undefined,
      }}
    >
      {/* Screenshot 3 requirement: Sticky Formatting Toolbar placed above Chapter Content */}
      {showFormattingToolbar && (
        <div className="rt-sticky">
          <RichToolbar />
        </div>
      )}

      <div className="chapter-artboard-head">
        <div>
          <b>Chapter content</b>
          <small>
            {plural(chapter.blocks.length, 'content block')} · all blocks are shown below
          </small>
        </div>
        <button
          type="button"
          className="btn ui-btn ui-btn-secondary btn-sm"
          onClick={() => onAddBlock()}
        >
          <LuCirclePlus /> Add Block
        </button>
      </div>

      {chapter.blocks.length === 0 && (
        <p className="text-soft text-center my-3">
          This chapter has no content yet. Add HTML, JSON, MCQ or a ready-made lesson block.
        </p>
      )}

      {chapter.blocks.map((sourceBlock, i) => {
        const b = workingBlock?.id === sourceBlock.id ? workingBlock : sourceBlock
        const open = () =>
          onSelect({ unitId: unit.id, chapterId: chapter.id, blockId: b.id })
        return (
          <article
            key={b.id}
            id={`blk-${b.id}`}
            data-block-id={b.id}
            className={`chapter-artboard-block blk-${b.type} ${
              selectedBlockId === b.id ? 'is-selected' : ''
            } ${b.visible === false ? 'is-hidden' : ''}`}
            onClick={() => {
              if (selectedBlockId !== b.id) open()
            }}
          >
            <button
              type="button"
              className="blk-pill"
              title={`${blockTypeLabel(b.type)}${
                b.visible === false ? ' (hidden from students)' : ''
              }`}
              onClick={open}
            >
              <BlockBadge type={b.type} />
              <b>{blockTypeLabel(b.type)}</b>
              {b.visible === false && <em className="hidden-tag">Hidden</em>}
            </button>
            <span
              className="blk-actions ws-block-acts"
              role="toolbar"
              aria-label={`${blockTypeLabel(b.type)} actions`}
            >
              <button
                type="button"
                className="icon-mini"
                onClick={() => act.toggleVisible(b)}
                aria-label={b.visible !== false ? 'Hide block' : 'Show block'}
                title={
                  b.visible !== false
                    ? 'Preview: visible to students (click to hide)'
                    : 'Hidden from students (click to show)'
                }
              >
                {b.visible !== false ? <LuEye /> : <LuEyeOff />}
              </button>
              <button
                type="button"
                className="icon-mini"
                disabled={i === 0}
                onClick={() => act.move('block', chapter.id, i, i - 1)}
                aria-label="Move up"
                title="Move up"
              >
                <LuArrowUp />
              </button>
              <button
                type="button"
                className="icon-mini"
                disabled={i === chapter.blocks.length - 1}
                onClick={() => act.move('block', chapter.id, i, i + 1)}
                aria-label="Move down"
                title="Move down"
              >
                <LuArrowDown />
              </button>
              <button
                type="button"
                className="icon-mini"
                onClick={() => act.duplicate('block', b.id)}
                aria-label="Duplicate block"
                title="Duplicate"
              >
                <LuCopy />
              </button>
              <button
                type="button"
                className="icon-mini danger"
                onClick={() => act.remove('block', b.id)}
                aria-label="Delete block"
                title="Delete"
              >
                <LuTrash2 />
              </button>
            </span>
            <div className="chapter-artboard-content">
              <ChapterBlockContent
                block={b}
                onEditData={onEditData}
                onUploadImage={(file) => onUploadImage?.(file, b.id)}
                editor={selectedBlockId === b.id && renderEditor ? renderEditor(b) : null}
              />
            </div>
            <button
              type="button"
              className="ws-insert-block chapter-insert"
              onClick={() => onAddBlock(i + 1)}
            >
              <LuCirclePlus /> Insert block after this
            </button>
          </article>
        )
      })}
      <button type="button" className="ws-add-block" onClick={() => onAddBlock()}>
        <LuCirclePlus /> Add Block
      </button>
    </div>
  )
}
