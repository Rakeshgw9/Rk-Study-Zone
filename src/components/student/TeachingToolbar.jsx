import { useEffect, useRef, useState } from 'react'
import {
  LuChevronRight,
  LuCircle,
  LuEraser,
  LuPencil,
  LuPencilLine,
  LuRotateCcw,
  LuTrash2,
  LuType,
  LuX,
} from 'react-icons/lu'

const COLORS = [
  { label: 'Red', value: '#ef4444' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#ffffff' },
]

const STROKES = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
]

function MousePointerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="m13 13 6 6" />
    </svg>
  )
}

function ArrowUpRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

function SquareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  )
}

/**
 * Floating Teaching & Annotation Toolbar (Change 2)
 * Allows teachers and students to draw, highlight, annotate with text, shapes and arrows
 * directly over the lesson content. Annotations scroll seamlessly with lesson content.
 */
export default function TeachingToolbar({ containerRef }) {
  const [activeTool, setActiveTool] = useState('pointer') // pointer | pen | highlighter | text | arrow | rect | circle | eraser
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [collapsed, setCollapsed] = useState(false)
  const [colorMenuOpen, setColorMenuOpen] = useState(false)
  const [strokeMenuOpen, setStrokeMenuOpen] = useState(false)

  // Elements: array of { id, type, points, text, x, y, w, h, color, width, opacity }
  const [elements, setElements] = useState([])
  const [undoStack, setUndoStack] = useState([]) // array of elements snapshots
  const [redoStack, setRedoStack] = useState([])
  const [currentElement, setCurrentElement] = useState(null)
  const [activeTextId, setActiveTextId] = useState(null)

  const isDrawing = useRef(false)
  const svgRef = useRef(null)

  // Record history snapshot before mutating
  const pushHistory = (newElems) => {
    setUndoStack((prev) => [...prev.slice(-25), elements])
    setRedoStack([])
    setElements(newElems)
  }

  const undo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((r) => [...r, elements])
    setUndoStack((u) => u.slice(0, -1))
    setElements(prev)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((u) => [...u, elements])
    setRedoStack((r) => r.slice(0, -1))
    setElements(next)
  }

  const clearAll = () => {
    if (elements.length === 0) return
    pushHistory([])
  }

  // Get coords relative to the SVG / container
  const getCoords = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleMouseDown = (e) => {
    if (activeTool === 'pointer') return
    if (e.target.closest('.teaching-text-input')) return

    const { x, y } = getCoords(e)

    if (activeTool === 'eraser') {
      const id = e.target.getAttribute('data-annotation-id')
      if (id) {
        pushHistory(elements.filter((el) => el.id !== id))
      }
      return
    }

    if (activeTool === 'text') {
      const newText = {
        id: 'txt_' + Date.now(),
        type: 'text',
        x,
        y,
        text: 'Click to type',
        color,
        fontSize: Math.max(14, strokeWidth * 5),
      }
      pushHistory([...elements, newText])
      setActiveTextId(newText.id)
      return
    }

    isDrawing.current = true

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setCurrentElement({
        id: 'draw_' + Date.now(),
        type: activeTool,
        points: [{ x, y }],
        color,
        width: activeTool === 'highlighter' ? strokeWidth * 3.5 : strokeWidth,
        opacity: activeTool === 'highlighter' ? 0.38 : 1,
      })
    } else if (activeTool === 'arrow') {
      setCurrentElement({
        id: 'arrow_' + Date.now(),
        type: 'arrow',
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color,
        width: strokeWidth,
      })
    } else if (activeTool === 'rect') {
      setCurrentElement({
        id: 'rect_' + Date.now(),
        type: 'rect',
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color,
        width: strokeWidth,
      })
    } else if (activeTool === 'circle') {
      setCurrentElement({
        id: 'circle_' + Date.now(),
        type: 'circle',
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        color,
        width: strokeWidth,
      })
    }
  }

  const handleMouseMove = (e) => {
    if (!isDrawing.current || !currentElement) return
    const { x, y } = getCoords(e)

    if (currentElement.type === 'pen' || currentElement.type === 'highlighter') {
      setCurrentElement((prev) => ({
        ...prev,
        points: [...prev.points, { x, y }],
      }))
    } else if (currentElement.type === 'arrow' || currentElement.type === 'rect' || currentElement.type === 'circle') {
      setCurrentElement((prev) => ({
        ...prev,
        x2: x,
        y2: y,
      }))
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing.current || !currentElement) return
    isDrawing.current = false
    pushHistory([...elements, currentElement])
    setCurrentElement(null)
  }

  const getPathData = (points) => {
    if (!points || points.length === 0) return ''
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`
    return points.reduce(
      (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
      ''
    )
  }

  const renderArrow = (el) => {
    const { x1, y1, x2, y2, color, width, id } = el
    const headLength = Math.max(12, width * 3)
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const arrowX1 = x2 - headLength * Math.cos(angle - Math.PI / 6)
    const arrowY1 = y2 - headLength * Math.sin(angle - Math.PI / 6)
    const arrowX2 = x2 - headLength * Math.cos(angle + Math.PI / 6)
    const arrowY2 = y2 - headLength * Math.sin(angle + Math.PI / 6)

    return (
      <g key={id} data-annotation-id={id} className="annotation-shape">
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
        />
        <polygon
          points={`${x2},${y2} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
          fill={color}
        />
      </g>
    )
  }

  const renderRect = (el) => {
    const { x1, y1, x2, y2, color, width, id } = el
    const x = Math.min(x1, x2)
    const y = Math.min(y1, y2)
    const w = Math.abs(x2 - x1)
    const h = Math.abs(y2 - y1)
    return (
      <rect
        key={id}
        data-annotation-id={id}
        x={x}
        y={y}
        width={w}
        height={h}
        fill="transparent"
        stroke={color}
        strokeWidth={width}
        rx={4}
        className="annotation-shape"
      />
    )
  }

  const renderCircle = (el) => {
    const { x1, y1, x2, y2, color, width, id } = el
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    const rx = Math.abs(x2 - x1) / 2
    const ry = Math.abs(y2 - y1) / 2
    return (
      <ellipse
        key={id}
        data-annotation-id={id}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="transparent"
        stroke={color}
        strokeWidth={width}
        className="annotation-shape"
      />
    )
  }

  return (
    <>
      {/* 1. Floating Annotation Toolbar */}
      <aside
        className={`teaching-floating-toolbar ${collapsed ? 'is-collapsed' : ''}`}
        aria-label="Teaching and Annotation Toolbar"
      >
        {collapsed ? (
          <button
            type="button"
            className="teaching-toolbar-expand-btn"
            onClick={() => setCollapsed(false)}
            title="Open Teaching & Annotation Toolbar"
            aria-label="Open Teaching Toolbar"
          >
            <LuPencil />
            <span className="expand-label">Study Tools</span>
          </button>
        ) : (
          <div className="teaching-toolbar-bar">
            {/* Pointer */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'pointer' ? 'on' : ''}`}
              onClick={() => setActiveTool('pointer')}
              title="Pointer / Select (Browse normally)"
              aria-label="Pointer"
            >
              <MousePointerIcon />
            </button>

            {/* Pen */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'pen' ? 'on' : ''}`}
              onClick={() => setActiveTool('pen')}
              title="Freehand Drawing (Pen)"
              aria-label="Pen"
            >
              <LuPencil />
            </button>

            {/* Highlighter */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'highlighter' ? 'on' : ''}`}
              onClick={() => setActiveTool('highlighter')}
              title="Highlighter"
              aria-label="Highlighter"
            >
              <LuPencilLine />
            </button>

            {/* Text Annotation */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'text' ? 'on' : ''}`}
              onClick={() => setActiveTool('text')}
              title="Text Annotation (Click to type)"
              aria-label="Text"
            >
              <LuType />
            </button>

            {/* Arrow */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'arrow' ? 'on' : ''}`}
              onClick={() => setActiveTool('arrow')}
              title="Draw Arrow"
              aria-label="Arrow"
            >
              <ArrowUpRightIcon />
            </button>

            {/* Rectangle */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'rect' ? 'on' : ''}`}
              onClick={() => setActiveTool('rect')}
              title="Draw Rectangle"
              aria-label="Rectangle"
            >
              <SquareIcon />
            </button>

            {/* Circle */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'circle' ? 'on' : ''}`}
              onClick={() => setActiveTool('circle')}
              title="Draw Circle"
              aria-label="Circle"
            >
              <LuCircle />
            </button>

            <span className="tt-sep" aria-hidden="true" />

            {/* Color Swatch / Picker */}
            <div className="position-relative">
              <button
                type="button"
                className="tt-btn tt-color-trigger"
                onClick={() => {
                  setColorMenuOpen((o) => !o)
                  setStrokeMenuOpen(false)
                }}
                title="Choose Color"
                aria-label="Color Picker"
              >
                <span className="tt-color-dot" style={{ backgroundColor: color }} />
              </button>
              {colorMenuOpen && (
                <div className="tt-dropdown tt-color-menu">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={`tt-color-opt ${color === c.value ? 'selected' : ''}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => {
                        setColor(c.value)
                        setColorMenuOpen(false)
                      }}
                      title={c.label}
                      aria-label={c.label}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Stroke Size */}
            <div className="position-relative">
              <button
                type="button"
                className="tt-btn"
                onClick={() => {
                  setStrokeMenuOpen((o) => !o)
                  setColorMenuOpen(false)
                }}
                title="Stroke Width"
                aria-label="Stroke Width"
              >
                <span className="tt-stroke-preview" style={{ height: Math.min(8, Math.max(2, strokeWidth)) }} />
              </button>
              {strokeMenuOpen && (
                <div className="tt-dropdown tt-stroke-menu">
                  {STROKES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`tt-stroke-opt ${strokeWidth === s.value ? 'selected' : ''}`}
                      onClick={() => {
                        setStrokeWidth(s.value)
                        setStrokeMenuOpen(false)
                      }}
                    >
                      <span className="tt-stroke-line" style={{ height: s.value }} />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="tt-sep" aria-hidden="true" />

            {/* Undo */}
            <button
              type="button"
              className="tt-btn"
              disabled={undoStack.length === 0}
              onClick={undo}
              title="Undo annotation"
              aria-label="Undo"
            >
              <LuRotateCcw />
            </button>

            {/* Redo */}
            <button
              type="button"
              className="tt-btn"
              disabled={redoStack.length === 0}
              onClick={redo}
              title="Redo annotation"
              aria-label="Redo"
            >
              <LuRotateCcw style={{ transform: 'scaleX(-1)' }} />
            </button>

            {/* Eraser */}
            <button
              type="button"
              className={`tt-btn ${activeTool === 'eraser' ? 'on' : ''}`}
              onClick={() => setActiveTool(activeTool === 'eraser' ? 'pointer' : 'eraser')}
              title="Eraser (Click any drawing to erase)"
              aria-label="Eraser"
            >
              <LuEraser />
            </button>

            {/* Clear All */}
            <button
              type="button"
              className="tt-btn text-danger-soft"
              disabled={elements.length === 0}
              onClick={clearAll}
              title="Clear all annotations"
              aria-label="Clear All"
            >
              <LuTrash2 />
            </button>

            <span className="tt-sep" aria-hidden="true" />

            {/* Collapse */}
            <button
              type="button"
              className="tt-btn"
              onClick={() => {
                setCollapsed(true)
                setColorMenuOpen(false)
                setStrokeMenuOpen(false)
              }}
              title="Collapse Toolbar"
              aria-label="Collapse Toolbar"
            >
              <LuChevronRight />
            </button>
          </div>
        )}
      </aside>

      {/* 2. Annotation SVG Overlay positioned over lesson content */}
      <svg
        ref={svgRef}
        className={`teaching-annotation-overlay ${activeTool !== 'pointer' ? 'active-drawing' : ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: activeTool === 'pointer' ? 'none' : 'auto',
          cursor:
            activeTool === 'eraser'
              ? 'cell'
              : activeTool === 'text'
              ? 'text'
              : activeTool === 'pointer'
              ? 'default'
              : 'crosshair',
          zIndex: 10,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {elements.map((el) => {
          if (el.type === 'pen' || el.type === 'highlighter') {
            return (
              <path
                key={el.id}
                data-annotation-id={el.id}
                d={getPathData(el.points)}
                fill="none"
                stroke={el.color}
                strokeWidth={el.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={el.opacity || 1}
                className="annotation-path"
              />
            )
          }
          if (el.type === 'arrow') return renderArrow(el)
          if (el.type === 'rect') return renderRect(el)
          if (el.type === 'circle') return renderCircle(el)
          return null
        })}

        {currentElement && (
          <>
            {(currentElement.type === 'pen' || currentElement.type === 'highlighter') && (
              <path
                d={getPathData(currentElement.points)}
                fill="none"
                stroke={currentElement.color}
                strokeWidth={currentElement.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={currentElement.opacity || 1}
              />
            )}
            {currentElement.type === 'arrow' && renderArrow(currentElement)}
            {currentElement.type === 'rect' && renderRect(currentElement)}
            {currentElement.type === 'circle' && renderCircle(currentElement)}
          </>
        )}
      </svg>

      {/* 3. Text annotations overlay */}
      <div
        className="teaching-text-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 11,
        }}
      >
        {elements
          .filter((el) => el.type === 'text')
          .map((txt) => (
            <div
              key={txt.id}
              style={{
                position: 'absolute',
                left: txt.x,
                top: txt.y,
                pointerEvents: activeTool !== 'pointer' ? 'auto' : 'none',
              }}
              className="teaching-text-bubble"
            >
              {activeTextId === txt.id ? (
                <input
                  type="text"
                  autoFocus
                  className="teaching-text-input"
                  defaultValue={txt.text}
                  style={{ color: txt.color, fontSize: txt.fontSize }}
                  onBlur={(e) => {
                    const val = e.target.value.trim() || 'Note'
                    pushHistory(
                      elements.map((el) => (el.id === txt.id ? { ...el, text: val } : el))
                    )
                    setActiveTextId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur()
                  }}
                />
              ) : (
                <span
                  style={{ color: txt.color, fontSize: txt.fontSize }}
                  onClick={() => {
                    if (activeTool === 'eraser') {
                      pushHistory(elements.filter((el) => el.id !== txt.id))
                    } else if (activeTool === 'text' || activeTool === 'pen') {
                      setActiveTextId(txt.id)
                    }
                  }}
                  className="teaching-text-span"
                >
                  {txt.text}
                </span>
              )}
            </div>
          ))}
      </div>
    </>
  )
}
