import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuChartColumn,
  LuChevronDown,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuCloudUpload,
  LuCopy,
  LuEye,
  LuHouse,
  LuLayers,
  LuListTree,
  LuLoaderCircle,
  LuLogOut,
  LuMoon,
  LuPanelLeft,
  LuPanelRight,
  LuRocket,
  LuRotateCcw,
  LuSave,
  LuSettings,
  LuSquarePen,
  LuSun,
  LuUser,
  LuX,
} from 'react-icons/lu'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import AddBlockModal from '../components/builder/AddBlockModal'
import ChapterModal from '../components/builder/ChapterModal'
import { HtmlCenter, HtmlProps } from '../components/builder/HtmlBlockEditor'
import { JsonCenter, JsonProps } from '../components/builder/JsonBlockEditor'
import { McqCenter, McqProps } from '../components/builder/McqBlockEditor'
import { SliderCenter, SliderProps, YoutubeCenter, YoutubeProps } from '../components/builder/MediaBlocks'
import { ReadyBlockCenter, ReadyBlockProps } from '../components/builder/ReadyBlockEditor'
import { TableCenter, TableProps } from '../components/builder/TableBlockEditor'
import { RichTextProvider } from '../components/ui/RichText'
import { validateTable } from '../lib/table'
import { ChapterActions, SetupGuide, UnitActions } from '../components/builder/SidePanels'
import StructureTree from '../components/builder/StructureTree'
import UnitModal from '../components/builder/UnitModal'
import { ChapterBar, ChapterView, Crumbs, UnitView, Welcome } from '../components/builder/Workspace'
import { useConfirm } from '../components/ui/Confirm'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { BLOCK_TYPES, contentReducer, findBlock, findChapter, newBlock, validateContent } from '../lib/content'
import { clone, timeAgo, uid } from '../lib/id'
import { plural } from '../lib/blockLabel'
import { validateLessonJson } from '../lib/jsonLesson'
import { validateQuestions } from '../lib/mcq'
import { isAdminRole, isStaffRole, logout, roleLabel } from '../services/authService'
import { loadDraft, publish, saveDraft } from '../services/contentService'
import { getPortal, patchPortal } from '../services/portalService'
import { uploadImage } from '../services/storageService'

const EDITORS = {
  table: [TableCenter, TableProps],
  html: [HtmlCenter, HtmlProps],
  json: [JsonCenter, JsonProps],
  mcq: [McqCenter, McqProps],
  youtube: [YoutubeCenter, YoutubeProps],
  slider: [SliderCenter, SliderProps],
  'heading-paragraph': [ReadyBlockCenter, ReadyBlockProps],
  'heading-image': [ReadyBlockCenter, ReadyBlockProps],
  'heading-list': [ReadyBlockCenter, ReadyBlockProps],
  'heading-example': [ReadyBlockCenter, ReadyBlockProps],
  'multi-heading': [ReadyBlockCenter, ReadyBlockProps],
}

/**
 * Change 10: Supported Rich-Text Block Types.
 * Display formatting toolbar only when these blocks are selected.
 * Strictly do NOT show for html, css, js, json, code editors, youtube, slider.
 */
export function isRichTextBlock(block) {
  if (!block) return false
  const supported = [
    'heading-paragraph',
    'heading-image',
    'heading-list',
    'heading-example',
    'multi-heading',
    'table',
  ]
  return supported.includes(block.type)
}

export default function BuilderPage() {
  const { portalId } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { theme, toggle } = useTheme()

  const [portal, setPortal] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | missing | denied | error
  const [content, setContent] = useState({ units: [] })
  const contentRef = useRef(content)
  const [sel, setSel] = useState({})
  const [working, setWorking] = useState(null) // { block, dirty }
  const [ui, setUiState] = useState({})
  const [save, setSave] = useState({ status: 'saved', at: null })
  const [version, setVersion] = useState(0)
  const [modal, setModal] = useState({})
  const [pane, setPane] = useState('workspace')
  const [publishErrors, setPublishErrors] = useState(null)
  const [publishLinks, setPublishLinks] = useState(false)
  const [insertAt, setInsertAt] = useState(null)
  const [leftHidden, setLeftHidden] = useState(false)
  const [rightHidden, setRightHidden] = useState(false)
  const [busy, setBusy] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [scrollReq, setScrollReq] = useState(null)
  const profileRef = useRef(null)

  // Change 11: Functional Undo & Redo History
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  const setUi = useCallback((p) => setUiState((u) => ({ ...u, ...p })), [])

  useEffect(() => {
    const close = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  /* ---------- load ---------- */
  useEffect(() => {
    if (loading || !user) return
    let alive = true
    ;(async () => {
      try {
        const p = await getPortal(portalId)
        if (!alive) return
        if (!p) return setState('missing')
        if (!isStaffRole(user.role) || (!isAdminRole(user.role) && p.ownerId !== user.uid))
          return setState('denied')
        const c = await loadDraft(portalId)
        if (!alive) return
        setPortal(p)
        setContent(c)
        contentRef.current = c
        setSave({ status: 'saved', at: p.draftUpdatedAt || null })
        if (c.units[0]) setSel({ unitId: c.units[0].id })
        setState('ready')
      } catch (e) {
        console.error(e)
        if (alive) setState('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [portalId, user, loading])

  /* ---------- content mutations & history (Change 11) ---------- */
  const apply = useCallback(
    (action, record = true) => {
      if (record) {
        const snap = JSON.parse(JSON.stringify(contentRef.current))
        setUndoStack((prev) => [...prev.slice(-40), snap])
        setRedoStack([])
      }
      const next = contentReducer(contentRef.current, action)
      contentRef.current = next
      setContent(next)
      setVersion((v) => v + 1)
      return next
    },
    []
  )

  // commit working block edits into content
  const commitWorking = useCallback(() => {
    if (working?.dirty) {
      const exists = findBlock(contentRef.current, working.block.id).block
      if (exists) apply({ type: 'updateBlock', blockId: working.block.id, block: working.block })
      setWorking((w) => (w ? { ...w, dirty: false } : w))
    }
    return contentRef.current
  }, [working, apply])

  const doSave = useCallback(
    async (c = contentRef.current) => {
      setSave((s) => ({ ...s, status: 'saving' }))
      try {
        const at = await saveDraft(portalId, c, user)
        setSave({ status: 'saved', at })
        return true
      } catch (e) {
        console.error(e)
        setSave((s) => ({ ...s, status: 'error', error: e.message }))
        toast(e.message || 'Could not save draft', 'error')
        return false
      }
    },
    [portalId, user, toast]
  )

  // autosave (debounced)
  useEffect(() => {
    if (!version) return
    setSave((s) => ({ ...s, status: 'unsaved' }))
    const t = setTimeout(() => doSave(), 1200)
    return () => clearTimeout(t)
  }, [version, doSave])

  // warn before leaving with unsaved edits
  const hasUnsaved = working?.dirty || save.status === 'unsaved' || save.status === 'saving'
  useEffect(() => {
    if (!hasUnsaved) return
    const h = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [hasUnsaved])

  const flush = async () => {
    const c = commitWorking()
    return doSave(c)
  }

  /* ---------- Change 11: Undo & Redo Handlers ---------- */
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    commitWorking()
    const last = undoStack[undoStack.length - 1]
    const curSnap = JSON.parse(JSON.stringify(contentRef.current))
    setRedoStack((r) => [...r, curSnap])
    setUndoStack((u) => u.slice(0, -1))
    contentRef.current = last
    setContent(last)
    setVersion((v) => v + 1)
    if (sel.blockId) {
      const b = findBlock(last, sel.blockId).block
      setWorking(b ? { block: clone(b), dirty: false } : null)
    }
    toast('Undo: Reverted last action')
  }, [undoStack, commitWorking, sel.blockId, toast])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    commitWorking()
    const next = redoStack[redoStack.length - 1]
    const curSnap = JSON.parse(JSON.stringify(contentRef.current))
    setUndoStack((u) => [...u, curSnap])
    setRedoStack((r) => r.slice(0, -1))
    contentRef.current = next
    setContent(next)
    setVersion((v) => v + 1)
    if (sel.blockId) {
      const b = findBlock(next, sel.blockId).block
      setWorking(b ? { block: clone(b), dirty: false } : null)
    }
    toast('Redo: Restored undone action')
  }, [redoStack, commitWorking, sel.blockId, toast])

  // Global Keyboard Shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable
      const isCodeMirror = !!e.target.closest('.cm-editor')
      if (isCodeMirror) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          handleRedo()
        } else if (!isInput) {
          e.preventDefault()
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !isInput) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, handleRedo])

  /* ---------- selection ---------- */
  const select = useCallback(
    (next) => {
      commitWorking()
      setSel(next)
      if (next.blockId) {
        const b = findBlock(contentRef.current, next.blockId).block
        setWorking(b ? { block: clone(b), dirty: false } : null)
        setUiState({})
      } else {
        setWorking(null)
      }
      setPane('workspace')
    },
    [commitWorking]
  )

  /* ---------- auto scroll to target ---------- */
  const requestScroll = useCallback(
    (target) =>
      setScrollReq({
        unitId: target.unitId,
        chapterId: target.chapterId,
        blockId: target.blockId,
        n: Date.now(),
      }),
    []
  )

  useEffect(() => {
    if (!scrollReq) return undefined
    const visible = (el) => !!el && el.getClientRects().length > 0
    const stickyOffset = () =>
      ['.bld-header', '.bld-panes-tabs', '.ws-crumbs'].reduce((sum, q) => {
        const el = document.querySelector(q)
        return sum + (visible(el) ? el.getBoundingClientRect().height : 0)
      }, 0) + 12
    const target = () =>
      scrollReq.blockId
        ? document.getElementById(`blk-${scrollReq.blockId}`)
        : scrollReq.chapterId
        ? document.querySelector('.ws-chbar')
        : null

    const run = () => {
      const el = target()
      const top = el ? el.getBoundingClientRect().top + window.scrollY - stickyOffset() : 0
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
    const raf = requestAnimationFrame(run)
    const fix = setTimeout(() => {
      const el = target()
      if (el && Math.abs(el.getBoundingClientRect().top - stickyOffset()) > 10) run()
    }, 500)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(fix)
    }
  }, [scrollReq])

  /* ---------- actions ---------- */
  const act = {
    createUnit: () => setModal({ unit: true }),
    editUnit: (u) => setModal({ unit: true, editUnit: u }),
    addChapter: (unitId) => setModal({ chapter: true, unitId }),
    editChapter: (ch, u) => setModal({ chapter: true, unitId: u.id, editChapter: ch }),
    addBlock: (unitId, chapterId) => {
      select({ unitId, chapterId })
      setModal({ addBlock: true, unitId, chapterId })
    },
    designUnit: (u) =>
      u.chapters[0]
        ? select({ unitId: u.id, chapterId: u.chapters[0].id })
        : setModal({ chapter: true, unitId: u.id }),
    designChapter: (u, ch) => select({ unitId: u.id, chapterId: ch.id }),
    toggleVisible: (b) => {
      const visible = b.visible === false
      apply({ type: 'updateBlock', blockId: b.id, block: { ...b, visible } })
      if (working?.block.id === b.id) setWorking((w) => ({ ...w, block: { ...w.block, visible } }))
    },
    duplicate: (kind, id) => {
      commitWorking()
      const newId = uid(kind === 'unit' ? 'unit' : kind === 'chapter' ? 'ch' : 'blk')
      if (kind === 'unit') {
        apply({ type: 'duplicateUnit', unitId: id, newId })
        select({ unitId: newId })
      }
      if (kind === 'chapter') {
        const { unit } = findChapter(contentRef.current, id)
        apply({ type: 'duplicateChapter', chapterId: id, newId })
        select({ unitId: unit.id, chapterId: newId })
      }
      if (kind === 'block') {
        const { unit, chapter } = findBlock(contentRef.current, id)
        apply({ type: 'duplicateBlock', blockId: id, newId })
        select({ unitId: unit.id, chapterId: chapter.id, blockId: newId })
      }
      toast(`${kind[0].toUpperCase() + kind.slice(1)} duplicated`)
    },
    move: (kind, parent, from, to) => {
      commitWorking()
      if (kind === 'unit') apply({ type: 'moveUnit', from, to })
      if (kind === 'chapter') apply({ type: 'moveChapter', unitId: parent, from, to })
      if (kind === 'block') apply({ type: 'moveBlock', chapterId: parent, from, to })
    },
    remove: async (kind, id) => {
      const c = contentRef.current
      const name =
        kind === 'unit'
          ? c.units.find((u) => u.id === id)?.title
          : kind === 'chapter'
          ? findChapter(c, id).chapter?.title
          : findBlock(c, id).block?.title
      const extra =
        kind === 'unit'
          ? ' All chapters and blocks inside it will also be deleted.'
          : kind === 'chapter'
          ? ' All blocks inside it will also be deleted.'
          : ''
      const ok = await confirm({
        title: `Delete ${kind}?`,
        message: `“${name}” will be permanently deleted.${extra}`,
        danger: true,
        confirmText: `Delete ${kind}`,
      })
      if (!ok) return
      if (kind === 'unit') {
        apply({ type: 'deleteUnit', unitId: id })
        setWorking(null)
        setSel({})
      }
      if (kind === 'chapter') {
        const { unit } = findChapter(c, id)
        apply({ type: 'deleteChapter', chapterId: id })
        setWorking(null)
        setSel({ unitId: unit.id })
      }
      if (kind === 'block') {
        const { unit, chapter } = findBlock(c, id)
        apply({ type: 'deleteBlock', blockId: id })
        setWorking(null)
        setSel({ unitId: unit.id, chapterId: chapter.id })
      }
      toast(`${kind[0].toUpperCase() + kind.slice(1)} deleted`)
    },
  }

  /* ---------- modals submit ---------- */
  const submitUnit = (data) => {
    if (modal.editUnit) {
      apply({
        type: 'updateUnit',
        unitId: modal.editUnit.id,
        patch: { ...data, updatedAt: Date.now() },
      })
      toast('Unit updated')
    } else {
      const id = uid('unit')
      apply({ type: 'addUnit', id, unit: data })
      select({ unitId: id })
      toast('Unit created')
    }
    setModal({})
  }

  const submitChapter = (data) => {
    if (modal.editChapter) {
      apply({ type: 'updateChapter', chapterId: modal.editChapter.id, patch: data })
      toast('Chapter updated')
    } else {
      const id = uid('ch')
      apply({ type: 'addChapter', unitId: modal.unitId, id, chapter: data })
      select({ unitId: modal.unitId, chapterId: id })
      toast('Chapter created')
    }
    setModal({})
  }

  const addBlock = (type) => {
    const b = newBlock(type)
    apply({ type: 'addBlock', chapterId: modal.chapterId, block: b, index: insertAt })
    setInsertAt(null)
    const { unitId, chapterId } = modal
    setModal({})
    setSel({ unitId, chapterId, blockId: b.id })
    setWorking({ block: clone(b), dirty: false })
    setUiState({})
    requestScroll({ unitId, chapterId, blockId: b.id })
    toast(`${BLOCK_TYPES[type].label} block added`)
  }

  /* ---------- block editing ---------- */
  const setBlock = (patch) => setWorking((w) => ({ block: { ...w.block, ...patch }, dirty: true }))
  const setData = (patch) =>
    setWorking((w) => ({ block: { ...w.block, data: { ...w.block.data, ...patch } }, dirty: true }))

  const saveBlock = async () => {
    if (!working) return
    if (working.block.type === 'mcq') {
      const errs = validateQuestions(working.block.data.questions)
      if (errs.length) return toast(`Fix before saving: ${errs[0]}`, 'error')
    }
    if (working.block.type === 'table') {
      const errs = validateTable(working.block.data)
      if (errs.length) toast(`Heads up: ${errs[0]}`, 'error')
    }
    if (working.block.type === 'json') {
      const v = validateLessonJson(working.block.data.json)
      if (!v.ok)
        return toast(
          `JSON error: ${v.errors[0].message}${v.errors[0].line ? ` (line ${v.errors[0].line})` : ''}`,
          'error'
        )
    }
    const next = apply({ type: 'updateBlock', blockId: working.block.id, block: working.block })
    setWorking((w) => ({ block: { ...w.block, updatedAt: Date.now() }, dirty: false }))
    if (await doSave(next)) toast('Block saved')
  }

  /* ---------- header actions ---------- */
  const onSaveDraft = async () => {
    setBusy('save')
    if (await flush()) toast('Draft saved')
    setBusy('')
  }

  const onPreview = async () => {
    setBusy('preview')
    await flush()
    setBusy('')
    const ch = sel.chapterId ? `/${sel.chapterId}` : ''
    window.open(`${window.location.pathname}#/learn/${portalId}${ch}?draft=1`, '_blank', 'noopener')
  }

  const onPublish = async () => {
    const c = commitWorking()
    const errs = validateContent(c)
    if (errs.length) return setPublishErrors(errs)
    const ok = await confirm({
      title: 'Publish portal?',
      message: 'Students will see the current version of all units, chapters and visible blocks.',
      confirmText: 'Publish now',
    })
    if (!ok) return
    setBusy('publish')
    try {
      const at = await publish(portalId, c, user)
      if (portal.status !== 'active') await patchPortal(portalId, { status: 'active' })
      setPortal((p) => ({ ...p, publishedAt: at, status: 'active' }))
      setSave({ status: 'saved', at })
      toast('Portal published — students can see it now')
      setPublishLinks(true)
    } catch (e) {
      toast(e.message || 'Publish failed', 'error')
    }
    setBusy('')
  }

  const leave = async (to) => {
    if (hasUnsaved) await flush()
    navigate(to)
  }

  /* ---------- derived ---------- */
  const unit = useMemo(() => content.units.find((u) => u.id === sel.unitId), [content, sel.unitId])
  const chapter = useMemo(
    () => unit?.chapters.find((c) => c.id === sel.chapterId),
    [unit, sel.chapterId]
  )
  const block = working?.block && sel.blockId === working.block.id ? working.block : null

  if (loading)
    return (
      <div className="page-loader">
        <span className="spinner-border text-info" />
      </div>
    )
  if (!user) return <Navigate to="/" replace />
  if (state !== 'ready') {
    const msg = {
      loading: null,
      missing: 'This portal was not found or was deleted.',
      denied: 'You do not have permission to edit this portal.',
      error: 'Could not load portal. Check your connection.',
    }[state]
    return (
      <div className="page-loader flex-column gap-3 text-center p-4">
        {state === 'loading' ? (
          <span className="spinner-border text-info" />
        ) : (
          <>
            <LuCircleAlert className="fs-1 text-warning" />
            <p className="mb-0">{msg}</p>
            <Link className="btn ui-btn ui-btn-primary" to="/admin/portals">
              Back to Portals
            </Link>
          </>
        )}
      </div>
    )
  }

  const [, Props] = block ? EDITORS[block.type] : []
  const EDITOR_TYPES = ['html', 'json', 'mcq', 'table']
  const collapseLeft = (
    <button
      type="button"
      className="pane-collapse d-none d-lg-inline-flex"
      onClick={() => setLeftHidden(true)}
      title="Hide portal structure"
      aria-label="Hide portal structure"
    >
      <LuPanelLeft />
    </button>
  )
  const collapseRight = (
    <button
      type="button"
      className="pane-collapse d-none d-lg-inline-flex"
      onClick={() => setRightHidden(true)}
      title="Hide properties panel"
      aria-label="Hide properties panel"
    >
      <LuPanelRight />
    </button>
  )

  const edProps = {
    block,
    setBlock,
    setData,
    ui,
    setUi,
    onSave: saveBlock,
    dirty: working?.dirty,
    portalId,
  }

  const renderEditor = (b) => {
    if (!block || b.id !== block.id || !EDITOR_TYPES.includes(b.type)) return null
    const [Center] = EDITORS[b.type]
    return <Center {...edProps} />
  }

  const unitIndex = unit ? content.units.indexOf(unit) : -1
  const chIndex = chapter ? unit.chapters.indexOf(chapter) : -1
  const saveLabel = {
    saved: save.at ? `Saved ${timeAgo(save.at)}` : 'All changes saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  }[working?.dirty ? 'unsaved' : save.status]

  return (
    <RichTextProvider>
      <div className="bld-shell">
        <header className="bld-header">
          <div className="bld-head-left">
            <button
              type="button"
              className="bld-logo"
              onClick={() => leave('/admin/portals')}
              aria-label="Back to portals"
              title="Back to portals"
            >
              <Logo size="sm" />
            </button>
            <span className="bld-vsep d-none d-md-block" aria-hidden="true" />
            <div className="bld-title-row">
              <nav className="bld-crumbs d-none d-xl-flex" aria-label="Breadcrumb">
                <button type="button" onClick={() => leave('/admin/dashboard')}>
                  Dashboard
                </button>
                <LuChevronRight aria-hidden="true" />
                <button type="button" onClick={() => leave('/admin/portals')}>
                  Portals
                </button>
                <LuChevronRight aria-hidden="true" />
                <span>Edit Portal</span>
                <LuChevronRight aria-hidden="true" />
              </nav>
              <h1 className="bld-portal-name" title={portal.name}>
                {portal.name}
              </h1>
              {portal.publishedAt ? (
                <span className="pill pill-ok bld-status">Published</span>
              ) : (
                <span className="pill pill-warn bld-status">Draft</span>
              )}
            </div>
          </div>

          <div className="bld-head-actions">
            {/* Change 11: Functional Undo & Redo in Editor Header */}
            <button
              type="button"
              className="icon-btn bld-icon-btn"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title={undoStack.length > 0 ? 'Undo last edit (Ctrl+Z)' : 'Nothing to undo'}
              aria-label="Undo"
            >
              <LuRotateCcw />
            </button>
            <button
              type="button"
              className="icon-btn bld-icon-btn"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title={redoStack.length > 0 ? 'Redo last edit (Ctrl+Y)' : 'Nothing to redo'}
              aria-label="Redo"
            >
              <LuRotateCcw style={{ transform: 'scaleX(-1)' }} />
            </button>
            <span className="bld-vsep mx-1 d-none d-sm-block" style={{ height: 22 }} />

            <span
              className={`save-pill s-${working?.dirty ? 'unsaved' : save.status}`}
              title={save.error || saveLabel}
              role="status"
              aria-live="polite"
            >
              <span className="save-ico">
                {save.status === 'saving' ? (
                  <LuLoaderCircle className="spin" />
                ) : save.status === 'error' ? (
                  <LuCircleAlert />
                ) : working?.dirty || save.status === 'unsaved' ? (
                  <LuSquarePen />
                ) : (
                  <LuCircleCheck />
                )}
              </span>
              <span className="save-text d-none d-xl-inline">{saveLabel}</span>
            </span>

            <button
              type="button"
              className="btn ui-btn ui-btn-secondary bld-btn"
              onClick={onPreview}
              disabled={!!busy}
              title="Open draft preview"
              aria-label="Preview"
            >
              {busy === 'preview' ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <LuEye />
              )}
              <span className="d-none d-lg-inline">Preview</span>
            </button>

            <button
              type="button"
              className="btn ui-btn ui-btn-secondary bld-btn"
              onClick={onSaveDraft}
              disabled={!!busy}
              title="Save current draft"
              aria-label="Save Draft"
            >
              {busy === 'save' ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <LuSave />
              )}
              <span className="d-none d-lg-inline">Save Draft</span>
            </button>

            <button
              type="button"
              className="btn ui-btn ui-btn-primary bld-btn"
              onClick={onPublish}
              disabled={!!busy}
              title="Publish portal to students"
              aria-label="Publish"
            >
              {busy === 'publish' ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <LuCloudUpload />
              )}
              <span className="d-none d-sm-inline">Publish</span>
            </button>

            <button
              type="button"
              className="icon-btn bld-icon-btn"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <LuMoon /> : <LuSun />}
            </button>

            <div className="bld-profile-wrap" ref={profileRef}>
              <button
                type="button"
                className="bld-profile-trigger"
                onClick={() => setProfileOpen((v) => !v)}
                aria-label="Open account menu"
                title="Account"
                aria-expanded={profileOpen}
              >
                <span className="avatar">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="avatar-img" />
                  ) : (
                    <LuUser />
                  )}
                </span>
                <LuChevronDown aria-hidden="true" />
              </button>
              {profileOpen && (
                <div className="user-menu bld-profile-menu">
                  <div className="user-menu-head">
                    <strong>{user.name || user.email}</strong>
                    <small>{user.email}</small>
                    <span className="role-pill">{roleLabel(user.role)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      navigate('/admin/settings')
                    }}
                  >
                    <LuSettings /> Settings
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileOpen(false)
                      await logout()
                      navigate('/')
                    }}
                    className="text-danger-soft"
                  >
                    <LuLogOut /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="bld-panes-tabs d-lg-none" role="tablist">
          <button
            className={pane === 'structure' ? 'on' : ''}
            onClick={() => setPane('structure')}
          >
            <LuListTree /> Structure
          </button>
          <button className={pane === 'workspace' ? 'on' : ''} onClick={() => setPane('workspace')}>
            <LuLayers /> Workspace
          </button>
          <button className={pane === 'props' ? 'on' : ''} onClick={() => setPane('props')}>
            <LuPanelRight /> {block ? 'Properties' : 'Actions'}
          </button>
        </div>

        <div
          className={`bld-grid ${leftHidden ? 'left-hidden' : ''} ${
            rightHidden ? 'right-hidden' : ''
          }`}
        >
          {leftHidden && (
            <button
              type="button"
              className="bld-pane-toggle left-toggle"
              onClick={() => setLeftHidden(false)}
              title="Show portal structure"
              aria-label="Show portal structure"
            >
              <LuPanelLeft />
            </button>
          )}
          {rightHidden && (
            <button
              type="button"
              className="bld-pane-toggle right-toggle"
              onClick={() => setRightHidden(false)}
              title="Show properties and actions"
              aria-label="Show properties and actions"
            >
              <LuPanelRight />
            </button>
          )}

          <aside
            className={`bld-left ${pane === 'structure' ? 'show' : ''}`}
            aria-label="Portal structure"
          >
            <StructureTree
              content={content}
              sel={sel}
              onSelect={(s) => {
                select(s)
                setPane('workspace')
                requestScroll(s)
              }}
              act={act}
              workingBlock={block}
              headRight={collapseLeft}
            />
          </aside>

          <main className={`bld-center ${pane === 'workspace' ? 'show' : ''}`}>
            {!unit ? (
              content.units.length === 0 ? (
                <Welcome onCreate={act.createUnit} />
              ) : (
                <div className="ws-empty text-center p-5">
                  <p className="text-soft">Select a unit or chapter from the structure tree.</p>
                </div>
              )
            ) : !chapter ? (
              <UnitView
                unit={unit}
                onSelect={(s) => {
                  select(s)
                  requestScroll(s)
                }}
                onEdit={() => act.editUnit(unit)}
                onAddChapter={() => act.addChapter(unit.id)}
              />
            ) : (
              <>
                <Crumbs
                  unit={unit}
                  chapter={chapter}
                  block={block}
                  onSelect={(s) => {
                    select(s)
                    requestScroll(s)
                  }}
                />
                <ChapterBar
                  chapter={chapter}
                  onEdit={() => act.editChapter(chapter, unit)}
                  onDuplicate={() => act.duplicate('chapter', chapter.id)}
                  onDelete={() => act.remove('chapter', chapter.id)}
                />
                <ChapterView
                  unit={unit}
                  chapter={chapter}
                  selectedBlockId={sel.blockId}
                  workingBlock={block}
                  onSelect={(s) => {
                    select(s)
                    requestScroll(s)
                  }}
                  onEditData={setData}
                  onUploadImage={async (f, blockId) => {
                    if (!f) return
                    try {
                      const u = await uploadImage(f, `portals/${portalId}`, { max: 1400 })
                      setData({ image: u })
                      toast('Image uploaded')
                    } catch (e) {
                      toast(e.message || 'Image upload failed', 'error')
                    }
                  }}
                  onAddBlock={(index) => {
                    setInsertAt(index ?? null)
                    act.addBlock(unit.id, chapter.id)
                  }}
                  act={act}
                  renderEditor={renderEditor}
                  showFormattingToolbar={isRichTextBlock(block)}
                />
              </>
            )}
          </main>

          <aside
            className={`bld-right ${pane === 'props' ? 'show' : ''}`}
            aria-label="Properties and actions"
          >
            {block && Props ? (
              <Props {...edProps} headRight={collapseRight} />
            ) : chapter ? (
              <ChapterActions
                chapter={chapter}
                unit={unit}
                act={act}
                onAddBlock={() => act.addBlock(unit.id, chapter.id)}
                headRight={collapseRight}
              />
            ) : unit ? (
              <UnitActions
                unit={unit}
                act={act}
                onAddChapter={() => act.addChapter(unit.id)}
                headRight={collapseRight}
              />
            ) : (
              <SetupGuide
                portal={portal}
                content={content}
                act={act}
                onPublish={onPublish}
                headRight={collapseRight}
              />
            )}
          </aside>
        </div>

        {/* Modals */}
        {modal.unit && (
          <UnitModal
            show={true}
            onClose={() => setModal({})}
            initial={modal.editUnit}
            onSubmit={submitUnit}
          />
        )}
        {modal.chapter && (
          <ChapterModal
            show={true}
            onClose={() => setModal({})}
            initial={modal.editChapter}
            onSubmit={submitChapter}
          />
        )}
        {modal.addBlock && (
          <AddBlockModal
            show={true}
            onClose={() => setModal({})}
            onAdd={addBlock}
          />
        )}
      </div>
    </RichTextProvider>
  )
}
