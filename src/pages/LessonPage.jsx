import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuArrowLeft,
  LuArrowRight,
  LuBookmark,
  LuBookmarkCheck,
  LuBookOpenText,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuClipboardList,
  LuDownload,
    LuFlag,
  LuListTree,
  LuNotebookPen,
  LuPencil,
  LuPanelLeft,
  LuPanelRight,
  LuSquarePen,
  LuTarget,
  LuTrash2,
  LuX,
} from 'react-icons/lu'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import LoginModal from '../components/LoginModal'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import CourseTree from '../components/student/CourseTree'
import StudentHeader from '../components/student/StudentHeader'
import SyllabusModal from '../components/student/SyllabusModal'
import TeachingToolbar from '../components/student/TeachingToolbar'
import McqExamModal from '../components/mcq/McqExamModal'
import { ReadyBlockView } from '../components/builder/ReadyBlockEditor'
import { SliderView, YoutubeView } from '../components/builder/MediaBlocks'
import HeadingBgLayers from '../components/ui/HeadingBg'
import SandboxFrame from '../components/ui/SandboxFrame'
import TableView from '../components/ui/TableView'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { frameProps } from '../lib/blockRender'
import { flatChapters } from '../lib/content'
import { chapterProgress, visibleContent } from '../lib/progress'
import { isAdminRole, isStaffRole } from '../services/authService'
import { loadDraft, loadPublished } from '../services/contentService'
import { syllabusFilesOf } from '../services/portalService'
import { getPortal } from '../services/portalService'
import { enroll, loadStudentData, saveStudentData } from '../services/studentService'
import { downloadChapterPdf, requestFrameSnapshots } from '../lib/pdfExport'

/** Marks a block complete once the reader reaches its end */
function SeenSentinel({ onSeen }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    let t
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(t)
        if (e.isIntersecting) t = setTimeout(onSeen, 900)
      },
      { threshold: 1 }
    )
    io.observe(el)
    return () => {
      clearTimeout(t)
      io.disconnect()
    }
  }, [onSeen])
  return <div className="seen-sentinel" aria-hidden="true" />
}

const plain = (html = '') => String(html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
/** A short readable name for a block (used in My Notes) */
export function blockLabelText(b) {
  const d = b.data || {}
  const t = plain(d.heading) || plain(d.title) || plain(d.sections?.[0]?.heading) || ''
  if (t) return t.slice(0, 90)
  return (b.title && b.title !== 'Custom HTML / CSS / JS' ? b.title : 'Lesson block').slice(0, 90)
}
export const noteKeyOf = (blockId, sec) => (sec ? `${blockId}#${sec}` : blockId)

const noop = () => {}

function NoteButton({ has, onClick }) {
  return (
    <button type="button" className={`blk-note-btn ${has ? 'has' : ''}`} onClick={onClick} title={has ? 'Edit your note' : 'Add a note'}>
      <LuPencil /> <span>{has ? 'Note saved' : 'Add note'}</span>
    </button>
  )
}

function BlockView({ block, sd, onDone, onOpenExam, onNote }) {
  const seen = useCallback(() => onDone(block.id), [onDone, block.id])
  const [secs, setSecs] = useState(null) // number of sections found inside a custom HTML / JSON frame
  const notes = sd?.blockNotes || {}
  const hasBlockNote = !!notes[block.id]
  const sectionKeys = Object.keys(notes).filter((k) => k.startsWith(`${block.id}#`)).map((k) => k.slice(block.id.length + 1))
  const openBlockNote = () => onNote?.({ blockId: block.id, key: block.id, title: blockLabelText(block) })
  const blockBtn = onNote ? <NoteButton has={hasBlockNote} onClick={openBlockNote} /> : null

  if (block.type === 'table') {
    return (
      <section className="lesson-block table" id={`b-${block.id}`}>
        <TableView data={block.data} />
        {blockBtn}
        <SeenSentinel onSeen={seen} />
      </section>
    )
  }

  // Change 5: Remove embedded examination interface from reading content. Add Take Exam button inside block.
  if (block.type === 'mcq') {
    const qCount = block.data.questions?.length || 0
    const lastScore = sd.scores?.[block.id]
    return (
      <section className="lesson-block mcq-clean-card" id={`b-${block.id}`}>
        <div className="mcq-lesson-take-card">
          <div className="mcq-take-left">
            <span className="badge bg-primary mb-1">Chapter Examination</span>
            <h3 className="mcq-take-title">{block.data.title || 'Chapter Practice Test'}</h3>
            <p className="mcq-take-desc mb-0">
              {qCount} Questions
              {block.data.settings?.timeLimitOn ? ` · ${block.data.settings.timeLimit} Min` : ''}
              {block.data.settings?.negativeMarking ? ` · Negative Marking (-${block.data.settings.negativeValue || 0.25})` : ''}
            </p>
            {lastScore && (
              <div className="mcq-take-last-score mt-1">
                Last attempt score: <b>{lastScore.score}/{lastScore.total}</b> ({lastScore.percent}%)
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn ui-btn ui-btn-primary mcq-take-btn"
            onClick={() => onOpenExam(block)}
          >
            <LuFlag /> Take Exam
          </button>
        </div>
        <SeenSentinel onSeen={seen} />
      </section>
    )
  }

  if (['heading-paragraph', 'heading-image', 'heading-list', 'heading-example', 'multi-heading', 'image-to-text'].includes(block.type)) {
    return (
      <section className={`lesson-block ${block.type}`} id={`b-${block.id}`}>
        <ReadyBlockView block={block} />
        {blockBtn}
        <SeenSentinel onSeen={seen} />
      </section>
    )
  }

  if (block.type === 'youtube' || block.type === 'slider') {
    return (
      <section className={`lesson-block ${block.type}`} id={`b-${block.id}`}>
        {block.type === 'youtube' ? <YoutubeView block={block} /> : <SliderView block={block} />}
        {blockBtn}
        <SeenSentinel onSeen={seen} />
      </section>
    )
  }

  const fp = frameProps(block)
  return (
    <section
      className={`lesson-block ${block.type} ${block.data.fullWidth ? 'full' : ''}`}
      id={`b-${block.id}`}
      style={{ marginTop: block.data.margin || undefined }}
    >
      <SandboxFrame
        {...fp}
        title={block.title}
        notes={!!onNote}
        noteKeys={sectionKeys}
        onSections={setSecs}
        onNote={(n) => onNote?.({ blockId: block.id, key: noteKeyOf(block.id, n.key), title: n.title || blockLabelText(block) })}
      />
      {secs !== null && secs < 2 && blockBtn}
      <SeenSentinel onSeen={seen} />
    </section>
  )
}

export default function LessonPage() {
  const { portalId, chapterId } = useParams()
  const [params] = useSearchParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { prefs } = usePrefs()
  const wantDraft = params.get('draft') === '1'
  const requestedUnitId = params.get('unit')
  const [state, setState] = useState('loading')
  const [portal, setPortal] = useState(null)
  const [raw, setRaw] = useState(null)
  const [sd, setSd] = useState(null)
  const [search, setSearch] = useState('')
  const [treeOpen, setTreeOpen] = useState(false)
  const [leftSidebarHidden, setLeftSidebarHidden] = useState(() => !!prefs.focusMode)
  const [rightSidebarHidden, setRightSidebarHidden] = useState(() => !!prefs.focusMode)
  const [noteEdit, setNoteEdit] = useState(null) // { key, blockId, title, text }
  const [noteSearch, setNoteSearch] = useState('')
  const [panel, setPanel] = useState(null) // notes | bookmarks | syllabus
  const [noteText, setNoteText] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  // MCQ Exam Popup State (Changes 4 & 5)
  const [examBlock, setExamBlock] = useState(null)
  const [examModalOpen, setExamModalOpen] = useState(false)

  const isDraft = wantDraft && isStaffRole(user?.role)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setState('login')
      return
    }
    let alive = true
    ;(async () => {
      try {
        const p = await getPortal(portalId)
        if (!alive) return
        if (!p) return setState('missing')
        const draftOk = wantDraft && isStaffRole(user.role) && (isAdminRole(user.role) || p.ownerId === user.uid)
        const c = draftOk ? await loadDraft(portalId) : await loadPublished(portalId)
        if (!alive) return
        if (!c || !c.units?.length) {
          setPortal(p)
          return setState('empty')
        }
        if (!draftOk && p.status !== 'active' && !isStaffRole(user.role)) return setState('missing')
        const data = await loadStudentData(user.uid, portalId)
        if (!draftOk) enroll(user, p)
        if (!alive) return
        setPortal(p)
        setRaw(c)
        setSd(data)
        setState('ready')
      } catch (e) {
        console.error(e)
        if (alive) setState('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [portalId, user, loading, wantDraft])

  const content = useMemo(() => (raw ? visibleContent(raw) : null), [raw])
  const flat = useMemo(() => (content ? flatChapters(content) : []), [content])
  const unitFirstChapterId = requestedUnitId
    ? flat.find((x) => x.unit.id === requestedUnitId || x.unit.slug === requestedUnitId)?.chapter.id
    : null
  const requestedChapter = chapterId
    ? flat.find((x) => x.chapter.id === chapterId || x.chapter.slug === chapterId)?.chapter.id
    : null
  const curIndex = Math.max(
    0,
    flat.findIndex((x) => x.chapter.id === (requestedChapter || unitFirstChapterId || sd?.lastChapterId))
  )
  const cur = flat[curIndex]
  const q = isDraft ? '?draft=1' : ''
  const go = (id) => {
    navigate(`/learn/${portalId}/${id}${q}`)
    setTreeOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // persist student data (debounced)
  const saveTimer = useRef(null)
  const update = useCallback(
    (fn) => {
      setSd((prev) => {
        const next = fn(prev)
        clearTimeout(saveTimer.current)
        if (!isDraft)
          saveTimer.current = setTimeout(() => saveStudentData(next).catch((e) => console.warn(e)), 700)
        return next
      })
    },
    [isDraft]
  )

  useEffect(() => {
    if (cur && sd && sd.lastChapterId !== cur.chapter.id)
      update((p) => ({ ...p, lastChapterId: cur.chapter.id }))
  }, [cur, sd, update])

  useEffect(() => {
    if (cur) setNoteText(sd?.notes?.[cur.chapter.id] || '')
  }, [cur?.chapter.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const markDone = useCallback(
    (blockId) =>
      update((p) =>
        p.completed[blockId] ? p : { ...p, completed: { ...p.completed, [blockId]: true } }
      ),
    [update]
  )

  const toggleBlock = (chId, b) => {
    if (b.type === 'mcq') {
      go(chId)
      setTimeout(() => {
        setExamBlock(b)
        setExamModalOpen(true)
      }, 350)
      return
    }
    update((p) => {
      const c = { ...p.completed }
      if (c[b.id]) delete c[b.id]
      else c[b.id] = true
      return { ...p, completed: c }
    })
  }

  const onMcqSubmit = (block, r) => {
    update((p) => ({
      ...p,
      completed: { ...p.completed, [block.id]: true },
      attempts: { ...p.attempts, [block.id]: (p.attempts[block.id] || 0) + 1 },
      scores: {
        ...p.scores,
        [block.id]: {
          score: r.score,
          total: r.total,
          percent: r.percent,
          at: r.at,
          correct: r.correct,
          wrong: r.wrong,
          skipped: r.skipped,
          passed: !!r.passed,
          timeTaken: r.timeTaken || 0,
        },
      },
    }))
    toast(`Exam submitted — ${r.score}/${r.total} (${r.percent}%)`)
  }

  // Change 3: Save PDF of current chapter
  const handleSavePdf = async () => {
    if (!cur) return
    setPdfBusy(true)
    try {
      // copy what each custom lesson block currently shows (scripts included), then open the print dialog
      const snaps = await requestFrameSnapshots(document)
      await downloadChapterPdf({
        chapter: cur.chapter,
        unit: cur.unit,
        portal,
        snaps,
      })
      toast('Print dialog opened — choose “Save as PDF”. Tip: untick “Headers and footers”.')
    } catch (err) {
      toast('Could not generate PDF: ' + (err.message || 'Error'), 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  const openNote = ({ blockId, key, title }) => {
    const ex = sd?.blockNotes?.[key]
    setNoteEdit({ key, blockId, title, text: ex?.text || '' })
  }
  const saveBlockNote = () => {
    if (!noteEdit || !cur) return
    const text = noteEdit.text.trim()
    update((p) => {
      const bn = { ...(p.blockNotes || {}) }
      if (!text) delete bn[noteEdit.key]
      else bn[noteEdit.key] = { chapterId: noteEdit.chapterId || cur.chapter.id, blockId: noteEdit.blockId, label: noteEdit.title, text, updatedAt: Date.now() }
      return { ...p, blockNotes: bn }
    })
    toast(text ? 'Note saved' : 'Note removed')
    setNoteEdit(null)
  }
  const deleteBlockNote = (key) => update((p) => { const bn = { ...(p.blockNotes || {}) }; delete bn[key]; return { ...p, blockNotes: bn } })
  const jumpToNote = (n) => {
    setPanel(null)
    const run = () => {
      const el = document.getElementById(`b-${n.blockId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (n.chapterId !== cur?.chapter.id) { go(n.chapterId); setTimeout(run, 600) } else run()
  }

  const openExam = (block) => {
    setExamBlock(block)
    setExamModalOpen(true)
  }

  if (state === 'login') {
    return (
      <div className="st-shell">
        <div className="st-center-msg">
          <img src="./logo.png" alt="" width="64" />
          <h2>Sign in to start learning</h2>
          <p>Your progress, notes and test scores are saved to your account.</p>
          <button className="btn ui-btn ui-btn-primary" onClick={() => setLoginOpen(true)}>
            Sign In / Create Account
          </button>
        </div>
        <LoginModal
          show={loginOpen}
          onClose={() => setLoginOpen(false)}
          redirectTo={`/learn/${portalId}${chapterId ? `/${chapterId}` : ''}`}
        />
      </div>
    )
  }

  if (state !== 'ready') {
    const msg = {
      loading: null,
      missing: 'This course is not available.',
      empty: isStaffRole(user?.role)
        ? 'Nothing published yet. Open the builder and press Publish (or use Preview to see the draft).'
        : 'This course has no published lessons yet. Please check back soon.',
      error: 'Could not load the course. Please check your connection.',
    }[state]
    return (
      <div className="st-shell">
        <div className="st-center-msg">
          {state === 'loading' ? (
            <span className="spinner-border text-info" />
          ) : (
            <>
              <LuCircleAlert className="fs-1 text-warning" />
              <h2 className="h5">{portal?.name || 'Course'}</h2>
              <p>{msg}</p>
              <Link
                className="btn ui-btn ui-btn-primary"
                to={isStaffRole(user?.role) && portal ? `/admin/builder/${portal.id}` : '/learn'}
              >
                {isStaffRole(user?.role) && portal ? 'Open Builder' : 'My Courses'}
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!cur)
    return (
      <div className="st-shell">
        <div className="st-center-msg">
          <LuCircleAlert className="fs-1 text-warning" />
          <p>This course has no chapters yet.</p>
          <Link className="btn ui-btn ui-btn-primary" to="/learn">
            My Courses
          </Link>
        </div>
      </div>
    )

  const { unit, chapter, unitIndex, chapterIndex } = cur
  const cp = chapterProgress(chapter, sd.completed)
  const chapterMcqs = chapter.blocks.filter((b) => b.type === 'mcq')
  const bookmarked = sd.bookmarks.includes(chapter.id)

  const toggleBookmark = () => {
    update((p) => ({
      ...p,
      bookmarks: bookmarked ? p.bookmarks.filter((x) => x !== chapter.id) : [...p.bookmarks, chapter.id],
    }))
    toast(bookmarked ? 'Bookmark removed' : 'Chapter bookmarked')
  }

  const practice = () => {
    if (chapterMcqs.length > 0) {
      openExam(chapterMcqs[0])
    } else {
      toast('No MCQ exams available for this chapter', 'error')
    }
  }

  const onNav = (k) => {
    if (k === 'home' || k === 'courses') return navigate('/learn')
    if (k === 'practice') return practice()
    if (k === 'mock') return chapterMcqs[0] ? openExam(chapterMcqs[0]) : toast('No mock test available yet', 'error')
    if (k === 'progress') return setTreeOpen(true)
    if (k === 'bookmarks') return setPanel('bookmarks')
  }

  const prev = flat[curIndex - 1]
  const next = flat[curIndex + 1]

  const bannerBg =
    chapter.headingBackgroundMode === 'image'
      ? { background: '#0b1f44' }
      : chapter.headingBackgroundMode === 'solid'
      ? { background: chapter.headingSolidColor || chapter.color }
      : {
          background: `linear-gradient(110deg, ${
            chapter.headingStartColor || chapter.color || '#087f5b'
          }, ${chapter.headingEndColor || '#0d6efd'})`,
        }

  return (
    <div className="st-shell">
      <StudentHeader
        title={portal.name}
        subtitle="Learn · Practice · Achieve"
        logo={portal.coverUrl}
        active="courses"
        onNav={onNav}
        search={search}
        onSearch={(v) => {
          setSearch(v)
          if (v && window.innerWidth < 1200) setTreeOpen(true)
        }}
        user={user}
      />

      {isDraft && (
        <div className="draft-banner">
          <LuSquarePen /> Draft preview — students can't see unpublished changes.{' '}
          <Link to={`/admin/builder/${portalId}`}>Back to builder</Link>
        </div>
      )}

      {/* Change 2: Floating Teaching & Annotation Toolbar */}
      {prefs.teachingToolbar && <TeachingToolbar />}

      <div
        className={`st-grid ${leftSidebarHidden ? 'left-hidden' : ''} ${
          rightSidebarHidden ? 'right-hidden' : ''
        }`}
      >
        {leftSidebarHidden && (
          <button
            type="button"
            className="st-drawer-toggle st-left-toggle"
            onClick={() => setLeftSidebarHidden(false)}
            aria-label="Show course navigation"
            title="Show course navigation"
          >
            <LuPanelLeft />
          </button>
        )}
        {rightSidebarHidden && (
          <button
            type="button"
            className="st-drawer-toggle st-right-toggle"
            onClick={() => setRightSidebarHidden(false)}
            aria-label="Show study tools"
            title="Show study tools"
          >
            <LuPanelRight />
          </button>
        )}

        <CourseTree
          portal={portal}
          content={content}
          done={sd.completed}
          currentId={chapter.id}
          onOpen={go}
          onToggleBlock={toggleBlock}
          search={search}
          open={treeOpen}
          onClose={() => setTreeOpen(false)}
          headRight={
            <button
              type="button"
              className="pane-collapse d-none d-xl-inline-flex"
              onClick={() => setLeftSidebarHidden(true)}
              aria-label="Hide course navigation"
              title="Hide course navigation"
            >
              <LuPanelLeft />
            </button>
          }
        />

        <main
          className="st-main"
          style={{
            background:
              unit.fullBackgroundMode === 'image' && unit.fullBackgroundImage
                ? `linear-gradient(180deg,rgba(3,10,28,.45),rgba(3,10,28,.75)),url(${unit.fullBackgroundImage})`
                : unit.fullBackgroundMode === 'gradient'
                ? `linear-gradient(135deg,${unit.fullStartColor || '#0d47a1'},${
                    unit.fullEndColor || '#1976d2'
                  })`
                : unit.fullBackgroundMode === 'color'
                ? unit.fullBackgroundColor || undefined
                : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: unit.fullBackgroundMode ? '16px' : undefined,
            padding: unit.fullBackgroundMode ? '12px' : undefined,
          }}
        >
          <div className="st-topline">
            <button
              className="btn ui-btn ui-btn-secondary btn-sm d-xl-none"
              onClick={() => setTreeOpen(true)}
            >
              <LuListTree /> Course content
            </button>
            <nav className="st-crumbs" aria-label="Breadcrumb">
              <Link to="/learn">My Courses</Link>
              <LuChevronRight />
              <span className="d-none d-md-inline">{portal.name}</span>
              <LuChevronRight className="d-none d-md-inline" />
              <span>Unit {unitIndex + 1}</span>
              <LuChevronRight />
              <span className="cur">Chapter {chapterIndex + 1}</span>
            </nav>

            <div className="d-flex gap-2 ms-auto align-items-center">
              {/* Change 3: Save PDF Button beside Previous and Next */}
              <button
                type="button"
                className="btn ui-btn ui-btn-secondary btn-sm"
                onClick={handleSavePdf}
                disabled={pdfBusy}
                title="Download this chapter as an A4 formatted PDF"
              >
                {pdfBusy ? (
                  <span className="spinner-border spinner-border-sm me-1" />
                ) : (
                  <LuDownload className="me-1" />
                )}
                <span className="d-none d-sm-inline">Save PDF</span>
              </button>

              <button
                className="btn ui-btn ui-btn-secondary btn-sm"
                disabled={!prev}
                onClick={() => go(prev.chapter.id)}
              >
                <LuArrowLeft /> <span className="d-none d-sm-inline">Previous</span>
              </button>
              <button
                className="btn ui-btn ui-btn-primary btn-sm"
                disabled={!next}
                onClick={() => go(next.chapter.id)}
              >
                <span className="d-none d-sm-inline">Next</span> <LuArrowRight />
              </button>
            </div>
          </div>

          <div
            className={`st-banner ${chapter.headingBackgroundMode === 'image' ? 'has-hb' : ''}`}
            style={{
              ...bannerBg,
              color: chapter.headingTextColor || '#fff',
              borderColor: chapter.headingAccentColor || undefined,
            }}
          >
            <HeadingBgLayers chapter={chapter} />
            <div className="min-w-0">
              <small>
                {/^unit\b/i.test(unit.title) ? unit.title : `Unit ${unitIndex + 1} · ${unit.title}`}
              </small>
              <h1
                style={{
                  fontSize: `clamp(20px, 3vw, ${Math.max(
                    24,
                    chapter.headingSize || (chapter.titleSize || 18) + 10
                  )}px)`,
                  color: chapter.headingTextColor || '#fff',
                }}
              >
                {chapter.title}
              </h1>
              {chapter.description && <p className="st-banner-description">{chapter.description}</p>}
              <span className="st-banner-meta">
                <LuCircleCheck /> {cp.done} of {cp.total} blocks completed
              </span>
            </div>
            <button
              className={`icon-btn bm ${bookmarked ? 'on' : ''}`}
              onClick={toggleBookmark}
              aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark chapter'}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark chapter'}
              aria-pressed={bookmarked}
            >
              {bookmarked ? <LuBookmarkCheck /> : <LuBookmark />}
            </button>
          </div>

          <div
            className="lesson-canvas position-relative"
            style={{
              background:
                chapter.fullBackgroundMode === 'solid'
                  ? chapter.fullSolidColor || '#f8fafc'
                  : chapter.fullBackgroundMode === 'gradient'
                  ? `linear-gradient(120deg,${chapter.fullStartColor || '#0d47a1'},${
                      chapter.fullEndColor || '#1976d2'
                    })`
                  : '#f8fafc',
            }}
          >
            {chapter.blocks.length === 0 ? (
              <p className="text-center text-muted py-5 mb-0">This chapter has no content yet.</p>
            ) : (
              chapter.blocks.map((b) => (
                <BlockView
                  key={b.id}
                  block={b}
                  sd={sd}
                  onDone={prefs.autoComplete ? markDone : noop}
                  onOpenExam={openExam}
                  onNote={isDraft ? undefined : openNote}
                />
              ))
            )}
          </div>

          <div className="st-pager">
            {prev ? (
              <button className="pager-btn" onClick={() => go(prev.chapter.id)}>
                <LuArrowLeft />
                <span>
                  <small>Previous</small>
                  <b>{prev.chapter.title}</b>
                </span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button className="pager-btn next" onClick={() => go(next.chapter.id)}>
                <span>
                  <small>Next</small>
                  <b>{next.chapter.title}</b>
                </span>
                <LuArrowRight />
              </button>
            ) : (
              <span className="pager-end">
                <LuCircleCheck /> You reached the end of this course
              </span>
            )}
          </div>
        </main>

        <aside className="st-side" aria-label="Study tools">
          {/* Study Tools Card */}
          <div className="st-card">
            <div className="st-card-title">
              <span>Study Tools</span>
              <button
                type="button"
                className="pane-collapse d-none d-xl-inline-flex"
                onClick={() => setRightSidebarHidden(true)}
                aria-label="Hide study tools"
                title="Hide study tools"
              >
                <LuPanelRight />
              </button>
            </div>
            <div className="tools">
              <button onClick={practice}>
                <span className="ti blue">
                  <LuTarget />
                </span>
                <b>Practice MCQ</b>
              </button>
              <button onClick={practice}>
                <span className="ti purple">
                  <LuClipboardList />
                </span>
                <b>Take Test</b>
              </button>
              <button onClick={() => setPanel('notes')}>
                <span className="ti amber">
                  <LuNotebookPen />
                </span>
                <b>My Notes</b>
              </button>
              <button onClick={() => setPanel('bookmarks')}>
                <span className="ti pink">
                  <LuBookmark />
                </span>
                <b>Bookmarks</b>
              </button>
            </div>
            {portal.hasSyllabus && (
              <button
                type="button"
                className="tools-syllabus"
                onClick={() => setPanel('syllabus')}
              >
                <span className="ti blue">
                  <LuBookOpenText />
                </span>
                <span className="min-w-0">
                  <b>Syllabus</b>
                  <small>View / Download Syllabus</small>
                </span>
              </button>
            )}
          </div>

          {/* Change 5: Chapter Practice MCQs Panel in Right Sidebar */}
          {chapterMcqs.length > 0 && (
            <div className="st-card st-mcq-list-card">
              <div className="st-card-title">
                <span>Chapter Practice MCQs</span>
                <span className="pill pill-info">{chapterMcqs.length}</span>
              </div>
              <div className="st-mcq-exam-list">
                {chapterMcqs.map((b, i) => (
                  <div key={b.id} className="st-mcq-exam-item">
                    <div className="mcq-item-info">
                      <b>MCQ {i + 1}: {b.data.title || 'Practice Test'}</b>
                      <small>{chapter.title} {b.data.subject ? `· ${b.data.subject}` : ''}</small>
                    </div>
                    <button
                      type="button"
                      className="btn ui-btn ui-btn-primary btn-sm"
                      onClick={() => openExam(b)}
                    >
                      Take Exam
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chapter Progress below MCQ panel */}
          <div className="st-card">
            <div className="st-card-title">Chapter Progress</div>
            <div className="cp">
              <div className="cp-ring" style={{ '--p': cp.pct }}>
                <span>{cp.pct}%</span>
              </div>
              <div>
                <b>{cp.done} of {cp.total} Blocks</b>
                <small>{cp.pct === 100 ? 'Completed — great work' : 'Keep going'}</small>
              </div>
            </div>
            <div className="bar mt-3">
              <span style={{ width: `${cp.pct}%` }} />
            </div>
          </div>
        </aside>
      </div>

      {portal.hasSyllabus && (
        <SyllabusModal
          show={panel === 'syllabus'}
          onClose={() => setPanel(null)}
          portal={portal}
        />
      )}

      {/* My Notes — chapter-wise list of every note (chapter note + block / section notes) */}
      <Modal
        show={panel === 'notes'}
        onClose={() => setPanel(null)}
        className="ui-modal ui-modal-lg notes-modal"
        labelledBy="notes-t"
      >
        <div className="ui-modal-head">
          <span className="ui-modal-icon"><LuNotebookPen /></span>
          <div className="flex-grow-1">
            <h2 id="notes-t">My Notes</h2>
            <p>All your notes, chapter by chapter.</p>
          </div>
          <button className="ui-x" onClick={() => setPanel(null)} aria-label="Close"><LuX /></button>
        </div>
        <div className="ui-modal-body">
          <div className="notes-current">
            <label className="ui-label" htmlFor="chapter-note">Note for this chapter — {chapter.title}</label>
            <textarea
              id="chapter-note"
              className="ui-input ui-textarea"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note for this whole chapter…"
              maxLength={5000}
            />
            <div className="d-flex justify-content-between align-items-center mt-1">
              <span className="ui-hint">{noteText.length} / 5000</span>
              <button
                type="button"
                className="btn ui-btn ui-btn-primary btn-sm"
                onClick={() => {
                  update((p) => ({ ...p, notes: { ...p.notes, [chapter.id]: noteText } }))
                  toast('Chapter note saved')
                }}
              >
                Save chapter note
              </button>
            </div>
          </div>

          {(() => {
            const q = noteSearch.trim().toLowerCase()
            const blockNotes = Object.entries(sd.blockNotes || {}).map(([key, n]) => ({ key, ...n }))
            const groups = flat
              .map((x) => {
                const chapterNote = sd.notes?.[x.chapter.id]
                const items = blockNotes.filter((n) => n.chapterId === x.chapter.id)
                  .filter((n) => !q || `${n.label} ${n.text}`.toLowerCase().includes(q))
                const showChapterNote = !!chapterNote && (!q || chapterNote.toLowerCase().includes(q))
                return { x, chapterNote: showChapterNote ? chapterNote : '', items }
              })
              .filter((g) => g.chapterNote || g.items.length)
            const total = blockNotes.length + Object.values(sd.notes || {}).filter(Boolean).length
            return (
              <>
                <div className="notes-list-head">
                  <b>Saved notes <span className="pill pill-info">{total}</span></b>
                  <input className="ui-input" style={{ maxWidth: 220 }} placeholder="Search notes…" value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} aria-label="Search notes" />
                </div>
                {groups.length === 0 ? (
                  <p className="text-soft mb-0">{total ? 'No notes match your search.' : 'No notes yet. Use the “Add note” button on any block or section while you read.'}</p>
                ) : (
                  <div className="notes-groups">
                    {groups.map(({ x, chapterNote, items }) => (
                      <section key={x.chapter.id} className="notes-group">
                        <h3><small>Unit {x.unitIndex + 1}</small> {x.chapter.title}</h3>
                        {chapterNote && (
                          <div className="note-item chapter">
                            <div className="note-body"><b>Chapter note</b><p>{chapterNote}</p></div>
                            <div className="note-actions">
                              <button type="button" className="icon-mini" title="Open chapter" onClick={() => { setPanel(null); go(x.chapter.id) }}><LuArrowRight /></button>
                              <button type="button" className="icon-mini danger" title="Delete note" onClick={() => { update((p) => ({ ...p, notes: { ...p.notes, [x.chapter.id]: '' } })); if (x.chapter.id === chapter.id) setNoteText('') }}><LuTrash2 /></button>
                            </div>
                          </div>
                        )}
                        {items.map((n) => (
                          <div key={n.key} className="note-item">
                            <div className="note-body"><b>{n.label || 'Lesson block'}</b><p>{n.text}</p></div>
                            <div className="note-actions">
                              <button type="button" className="icon-mini" title="Go to this part" onClick={() => jumpToNote(n)}><LuArrowRight /></button>
                              <button type="button" className="icon-mini" title="Edit note" onClick={() => { setPanel(null); if (n.chapterId !== chapter.id) go(n.chapterId); setNoteEdit({ key: n.key, blockId: n.blockId, title: n.label, text: n.text, chapterId: n.chapterId }) }}><LuPencil /></button>
                              <button type="button" className="icon-mini danger" title="Delete note" onClick={() => deleteBlockNote(n.key)}><LuTrash2 /></button>
                            </div>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </div>
        <div className="ui-modal-foot">
          <button className="btn ui-btn ui-btn-secondary" onClick={() => setPanel(null)}>Close</button>
        </div>
      </Modal>

      {/* Add / edit a note on one block or section */}
      <Modal show={!!noteEdit} onClose={() => setNoteEdit(null)} className="ui-modal ui-modal-md" labelledBy="bnote-t">
        {noteEdit && (
          <>
            <div className="ui-modal-head">
              <span className="ui-modal-icon"><LuPencil /></span>
              <div className="flex-grow-1 min-w-0">
                <h2 id="bnote-t">{sd.blockNotes?.[noteEdit.key] ? 'Edit note' : 'Add note'}</h2>
                <p className="text-truncate">{chapter.title}{noteEdit.title ? ` › ${noteEdit.title}` : ''}</p>
              </div>
              <button className="ui-x" onClick={() => setNoteEdit(null)} aria-label="Close"><LuX /></button>
            </div>
            <div className="ui-modal-body">
              <textarea
                className="ui-input ui-textarea"
                rows={6}
                autoFocus
                value={noteEdit.text}
                onChange={(e) => setNoteEdit((n) => ({ ...n, text: e.target.value }))}
                placeholder="Write your note for this part of the lesson…"
                maxLength={3000}
              />
              <div className="ui-hint text-end">{noteEdit.text.length} / 3000</div>
            </div>
            <div className="ui-modal-foot">
              {sd.blockNotes?.[noteEdit.key] && (
                <button className="btn ui-btn ui-btn-danger me-auto" onClick={() => { deleteBlockNote(noteEdit.key); setNoteEdit(null); toast('Note removed') }}><LuTrash2 /> Delete</button>
              )}
              <button className="btn ui-btn ui-btn-secondary" onClick={() => setNoteEdit(null)}>Cancel</button>
              <button className="btn ui-btn ui-btn-primary" onClick={saveBlockNote}>Save Note</button>
            </div>
          </>
        )}
      </Modal>

      {/* Bookmarks Modal */}
      <Modal
        show={panel === 'bookmarks'}
        onClose={() => setPanel(null)}
        className="ui-modal ui-modal-md"
        labelledBy="bm-t"
      >
        <div className="ui-modal-head">
          <span className="ui-modal-icon">
            <LuBookmark />
          </span>
          <div className="flex-grow-1">
            <h2 id="bm-t">Bookmarks</h2>
            <p>Chapters you saved for revision.</p>
          </div>
          <button className="ui-x" onClick={() => setPanel(null)} aria-label="Close">
            <LuX />
          </button>
        </div>
        <div className="ui-modal-body">
          {sd.bookmarks.length === 0 ? (
            <p className="text-soft mb-0">No bookmarks yet. Tap the bookmark icon on a chapter banner.</p>
          ) : (
            <ul className="bm-list">
              {flat
                .filter((x) => sd.bookmarks.includes(x.chapter.id))
                .map((x) => (
                  <li key={x.chapter.id}>
                    <button
                      onClick={() => {
                        setPanel(null)
                        go(x.chapter.id)
                      }}
                    >
                      <small>Unit {x.unitIndex + 1}</small>
                      <b>{x.chapter.title}</b>
                    </button>
                    <button
                      className="icon-mini danger"
                      onClick={() =>
                        update((p) => ({
                          ...p,
                          bookmarks: p.bookmarks.filter((y) => y !== x.chapter.id),
                        }))
                      }
                      aria-label="Remove bookmark"
                    >
                      <LuX />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="ui-modal-foot">
          <button className="btn ui-btn ui-btn-primary" onClick={toggleBookmark}>
            {bookmarked ? (
              <>
                <LuBookmarkCheck /> Remove this chapter
              </>
            ) : (
              <>
                <LuBookmark /> Bookmark this chapter
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* Changes 4 & 5: 90% MCQ Examination Popup Modal */}
      {examBlock && (
        <McqExamModal
          show={examModalOpen}
          onClose={() => {
            setExamModalOpen(false)
            setExamBlock(null)
          }}
          block={examBlock}
          chapter={chapter}
          portal={portal}
          attemptsUsed={sd.attempts?.[examBlock.id] || 0}
          onSubmit={(r) => onMcqSubmit(examBlock, r)}
        />
      )}
    </div>
  )
}
