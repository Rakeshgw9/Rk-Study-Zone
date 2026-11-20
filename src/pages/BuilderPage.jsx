import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  LuChevronDown,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuCloudUpload,
  LuEllipsisVertical,
  LuEye,
  LuLayers,
  LuListTree,
  LuLoaderCircle,
  LuLogOut,
  LuMoon,
  LuPanelLeft,
  LuPanelRight,
  LuRotateCcw,
  LuSave,
  LuSettings,
  LuSquarePen,
  LuSun,
  LuUser,
} from 'react-icons/lu'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { useToast } from '../components/Toast'
import AddBlockModal from '../components/builder/AddBlockModal'
import ChapterModal from '../components/builder/ChapterModal'
import { HtmlCenter, HtmlProps } from '../components/builder/HtmlBlockEditor'
import { JsonCenter, JsonProps } from '../components/builder/JsonBlockEditor'
import { McqCenter, McqProps } from '../components/builder/McqBlockEditor'
import { SliderCenter, SliderProps, YoutubeCenter, YoutubeProps } from '../components/builder/MediaBlocks'
import { ReadyBlockCenter, ReadyBlockProps } from '../components/builder/ReadyBlockEditor'
import { OcrProps } from '../components/builder/ImageToTextBlock'
import { TableCenter, TableProps } from '../components/builder/TableBlockEditor'
import { RichTextProvider } from '../components/ui/RichText'
import { validateTable } from '../lib/table'
import { ChapterActions, SetupGuide, UnitActions } from '../components/builder/SidePanels'
import StructureTree from '../components/builder/StructureTree'
import UnitModal from '../components/builder/UnitModal'
import { ChapterBar, ChapterView, Crumbs, UnitView, Welcome } from '../components/builder/Workspace'
import { useConfirm } from '../components/ui/Confirm'
import GoToTop from '../components/ui/GoToTop'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import { useTheme } from '../context/ThemeContext'
import { BLOCK_TYPES, contentReducer, findBlock, findChapter, newBlock, validateContent } from '../lib/content'
import { builderNavReducer, INITIAL_NAV_STATE, isSameTarget, normalizeTarget } from '../lib/builderNav'
import { clone, timeAgo, uid } from '../lib/id'
import { validateLessonJson } from '../lib/jsonLesson'
import { duplicateSectionById, editStudioJson, moveSectionIndex, removeSectionById, studioFromJson, studioSectionList, sectionTitle } from '../lib/jsonStudio'
import { scrollToStudioSection } from '../lib/jsonStudioDom'
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
  'image-to-text': [ReadyBlockCenter, OcrProps],
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
    'image-to-text',
    'table',
  ]
  if (block.type === 'json') return !!studioFromJson(block.data?.json) // JSON Studio text is formatted with the same toolbar
  return supported.includes(block.type)
}

export default function BuilderPage() {
  const { portalId } = useParams()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { prefs } = usePrefs()
  const confirm = useConfirm()
  const { theme, toggle } = useTheme()

  const [portal, setPortal] = useState(null)
  const [state, setState] = useState('loading') // loading | ready | missing | denied | error
  const [content, setContent] = useState({ units: [] })
  const contentRef = useRef(content)

  // Unified selection, scroll, and tree-open reducer
  const [nav, dispatchNav] = useReducer(builderNavReducer, INITIAL_NAV_STATE)
  const navRef = useRef(nav)
  navRef.current = nav
  const sel = nav.target

  const [working, setWorking] = useState(null) // { block, dirty }
  const workingRef = useRef(working)
  workingRef.current = working

  const [ui, setUiState] = useState({})
  const [save, setSave] = useState({ status: 'saved', at: null })
  const [version, setVersion] = useState(0)
  const [modal, setModal] = useState({})
  const [pane, setPane] = useState('workspace')
  const [, setPublishErrors] = useState(null)
  const [, setPublishLinks] = useState(false)
  const [insertAt, setInsertAt] = useState(null)
  const [leftHidden, setLeftHidden] = useState(false)
  const [rightHidden, setRightHidden] = useState(false)
  const [busy, setBusy] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  const centerRef = useRef(null)
  const spyPausedUntilRef = useRef(0)

  // Change 11: Functional Undo & Redo History
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])

  useEffect(() => {
    const close = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
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
        if (c.units[0]) {
          dispatchNav({ type: 'SELECT', target: { unitId: c.units[0].id }, source: 'init' })
        }
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
  const apply = useCallback((action, record = true) => {
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
  }, [])

  // commit working block edits into content
  const commitWorking = useCallback(() => {
    const cur = workingRef.current
    if (cur?.dirty) {
      const exists = findBlock(contentRef.current, cur.block.id).block
      if (exists) apply({ type: 'updateBlock', blockId: cur.block.id, block: cur.block })
      setWorking((w) => (w ? { ...w, dirty: false } : w))
    }
    return contentRef.current
  }, [apply])

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
    const t = setTimeout(() => doSave(), prefs.autosaveMs || 1200)
    return () => clearTimeout(t)
  }, [version, doSave, prefs.autosaveMs])

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
    const activeBlkId = workingRef.current?.block?.id || navRef.current.target.blockId
    if (activeBlkId) {
      const b = findBlock(last, activeBlkId).block
      setWorking(b ? { block: clone(b), dirty: false } : null)
    }
    toast('Undo: Reverted last action')
  }, [undoStack, commitWorking, toast])

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
    const activeBlkId = workingRef.current?.block?.id || navRef.current.target.blockId
    if (activeBlkId) {
      const b = findBlock(next, activeBlkId).block
      setWorking(b ? { block: clone(b), dirty: false } : null)
    }
    toast('Redo: Restored undone action')
  }, [redoStack, commitWorking, toast])

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

  /* ---------- unified selection (with Unsaved Guard when switching chapters/units) ---------- */
  const handleSelect = useCallback(
    async (rawTarget, source = 'action', opts = {}) => {
      const next = normalizeTarget(rawTarget)

      // Scroll-spy updates tree highlight only; never switches editors, prompts, or scrolls
      if (source === 'spy') {
        if (!isSameTarget(navRef.current.target, next)) {
          dispatchNav({ type: 'SPY', target: next })
        }
        return true
      }

      const cur = navRef.current.target
      const curWorking = workingRef.current
      const switchingChapter =
        curWorking?.dirty &&
        ((next.chapterId && next.chapterId !== cur.chapterId) ||
          (!next.chapterId && cur.chapterId))

      if (switchingChapter) {
        const ok = await confirm({
          title: 'Unsaved changes in current chapter',
          message:
            'You have unsaved edits in the current block. Save changes and switch to the new chapter?',
          confirmText: 'Save & Switch',
        })
        if (!ok) return false
        const updated = commitWorking()
        await doSave(updated)
      } else if (curWorking?.dirty && curWorking.block.id !== next.blockId) {
        commitWorking()
      }

      if (source === 'tree') {
        dispatchNav({ type: 'TREE_CLICK', target: next })
      } else if (source === 'page') {
        dispatchNav({ type: 'PAGE_CLICK', target: next })
      } else {
        dispatchNav({ type: 'SELECT', target: next, source, scroll: !!opts.scroll })
      }

      if (next.blockId) {
        if (curWorking?.block?.id !== next.blockId) {
          const b = findBlock(contentRef.current, next.blockId).block
          setWorking(b ? { block: clone(b), dirty: false } : null)
          setUiState({})
        }
      } else {
        setWorking(null)
      }

      if (source === 'tree' || source === 'action') {
        setPane('workspace')
      }
      return true
    },
    [confirm, commitWorking, doSave]
  )

  const handleToggleOpen = useCallback((kind, id) => {
    dispatchNav({ type: 'TOGGLE_OPEN', kind, id })
  }, [])

  // Bridge editor UI state so JsonBlockEditor / JsonStudioCanvas jsonSec routes through handleSelect
  const setUi = useCallback(
    (patch) => {
      if (!patch || typeof patch !== 'object') return
      if (Object.prototype.hasOwnProperty.call(patch, 'jsonSec')) {
        const { jsonSec, ...rest } = patch
        if (Object.keys(rest).length > 0) setUiState((u) => ({ ...u, ...rest }))
        const cur = navRef.current.target
        const blkId = workingRef.current?.block?.id || cur.blockId
        if (cur.unitId && cur.chapterId && blkId) {
          handleSelect(
            { unitId: cur.unitId, chapterId: cur.chapterId, blockId: blkId, sectionId: jsonSec || null },
            'page'
          )
        }
        return
      }
      setUiState((u) => ({ ...u, ...patch }))
    },
    [handleSelect]
  )

  /* ---------- single-shot smooth scroll after layout settles (TREE_CLICK / explicit scroll only) ---------- */
  useEffect(() => {
    const { to, n } = nav.scroll
    if (!n || !to) return undefined

    // Pause scroll-spy while smooth scrolling so spy does not fight tree selection
    spyPausedUntilRef.current = Date.now() + 900
    let cancelSec = null
    let raf1 = 0
    let raf2 = 0

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (to.sectionId) {
          cancelSec = scrollToStudioSection(to.sectionId, { blockId: to.blockId, tries: 12, delay: 60 })
          return
        }
        const el = to.blockId
          ? document.getElementById(`blk-${to.blockId}`)
          : to.chapterId
            ? document.querySelector('.ws-chbar')
            : null
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      cancelSec?.()
    }
  }, [nav.scroll])

  /* ---------- derived ---------- */
  const unit = useMemo(() => content.units.find((u) => u.id === sel.unitId), [content, sel.unitId])
  const chapter = useMemo(
    () => unit?.chapters.find((c) => c.id === sel.chapterId),
    [unit, sel.chapterId]
  )
  const block = working?.block && chapter?.blocks.some((b) => b.id === working.block.id) ? working.block : null

  /* ---------- scroll-spy with IntersectionObserver (updates tree only) ---------- */
  const chapterId = chapter?.id || null
  const chapterBlockCount = chapter?.blocks?.length || 0
  const workingBlockId = block?.id || null

  useEffect(() => {
    if (!unit?.id || !chapterId || typeof IntersectionObserver === 'undefined') return undefined
    const container = centerRef.current
    if (!container) return undefined

    const nodes = Array.from(container.querySelectorAll('[id^="blk-"], [id^="sec-"], [id^="js-sec-"]'))
    if (nodes.length === 0) return undefined

    const visibleMap = new Map()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleMap.set(entry.target, entry)
          else visibleMap.delete(entry.target)
        })
        if (Date.now() < spyPausedUntilRef.current) return
        if (visibleMap.size === 0) return

        // Prefer section elements over block wrappers when both are in the active band
        const candidates = Array.from(visibleMap.keys())
        const secCandidates = candidates.filter((el) => el.id.startsWith('sec-') || el.id.startsWith('js-sec-'))
        const pool = secCandidates.length > 0 ? secCandidates : candidates
        pool.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        const topEl = pool[0]
        if (!topEl) return

        let nextBlockId = null
        let nextSectionId = null
        if (topEl.id.startsWith('js-sec-')) {
          nextSectionId = topEl.id.slice(7) || null
          nextBlockId = topEl.closest('[data-block-id]')?.dataset.blockId || workingBlockId
        } else if (topEl.id.startsWith('sec-')) {
          const blkEl = topEl.closest('[data-block-id]')
          nextBlockId = blkEl?.dataset.blockId || null
          if (nextBlockId) {
            const prefix = `sec-${nextBlockId}-`
            nextSectionId = topEl.id.startsWith(prefix) ? topEl.id.slice(prefix.length) : null
          }
        } else if (topEl.id.startsWith('blk-')) {
          nextBlockId = topEl.id.slice(4) || null
          nextSectionId = null
        }

        if (nextBlockId) {
          handleSelect(
            { unitId: unit.id, chapterId, blockId: nextBlockId, sectionId: nextSectionId },
            'spy'
          )
        }
      },
      { root: null, rootMargin: '-18% 0px -65% 0px', threshold: [0, 0.1, 0.25] }
    )

    nodes.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [unit?.id, chapterId, chapterBlockCount, workingBlockId, handleSelect])

  /* ---------- actions ---------- */
  const act = {
    createUnit: () => setModal({ unit: true }),
    editUnit: (u) => setModal({ unit: true, editUnit: u }),
    addChapter: (unitId) => setModal({ chapter: true, unitId }),
    editChapter: (ch, u) => setModal({ chapter: true, unitId: u.id, editChapter: ch }),
    addBlock: (unitId, chapterId) => {
      handleSelect({ unitId, chapterId }, 'action')
      setModal({ addBlock: true, unitId, chapterId })
    },
    designUnit: (u) =>
      u.chapters[0]
        ? handleSelect({ unitId: u.id, chapterId: u.chapters[0].id }, 'action')
        : setModal({ chapter: true, unitId: u.id }),
    designChapter: (u, ch) => handleSelect({ unitId: u.id, chapterId: ch.id }, 'action'),
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
        handleSelect({ unitId: newId }, 'action')
      }
      if (kind === 'chapter') {
        const { unit: u } = findChapter(contentRef.current, id)
        apply({ type: 'duplicateChapter', chapterId: id, newId })
        handleSelect({ unitId: u.id, chapterId: newId }, 'action')
      }
      if (kind === 'block') {
        const { unit: u, chapter: ch } = findBlock(contentRef.current, id)
        apply({ type: 'duplicateBlock', blockId: id, newId })
        handleSelect({ unitId: u.id, chapterId: ch.id, blockId: newId }, 'action', { scroll: true })
      }
      toast(`${kind[0].toUpperCase() + kind.slice(1)} duplicated`)
    },
    /** Duplicate / delete / reorder one section of a JSON Studio block (left-sidebar layer tree). Goes through the normal undo history. */
    editSections: (blockId, fn) => {
      commitWorking()
      const { block: found } = findBlock(contentRef.current, blockId)
      if (!found) return false
      const json = editStudioJson(found.data?.json, fn)
      if (json === null) {
        toast('Fix the JSON errors first.', 'error')
        return false
      }
      apply({ type: 'updateBlock', blockId, block: { ...found, data: { ...found.data, json } } })
      if (workingRef.current?.block.id === blockId) {
        const fresh = findBlock(contentRef.current, blockId).block
        if (fresh) setWorking({ block: clone(fresh), dirty: false })
      }
      return true
    },
    duplicateSection: (blockId, secId) => {
      if (act.editSections(blockId, (l) => duplicateSectionById(l, secId))) toast('Section duplicated')
    },
    removeSection: async (blockId, secId) => {
      const list = studioSectionList(findBlock(contentRef.current, blockId).block?.data?.json) || []
      const name = sectionTitle(list.find((x) => x.id === secId)) || 'This section'
      const ok = await confirm({
        title: 'Delete section?',
        message: `“${name}” will be permanently deleted.`,
        danger: true,
        confirmText: 'Delete section',
      })
      if (!ok) return
      if (act.editSections(blockId, (l) => removeSectionById(l, secId))) {
        if (navRef.current.target.sectionId === secId) {
          const cur = navRef.current.target
          handleSelect({ unitId: cur.unitId, chapterId: cur.chapterId, blockId: cur.blockId, sectionId: null }, 'page')
        }
        toast('Section deleted')
      }
    },
    move: (kind, parent, from, to) => {
      if (kind === 'section') {
        act.editSections(parent, (l) => moveSectionIndex(l, from, to))
        return
      }
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
        dispatchNav({ type: 'SELECT', target: {}, source: 'action' })
      }
      if (kind === 'chapter') {
        const { unit: u } = findChapter(c, id)
        apply({ type: 'deleteChapter', chapterId: id })
        setWorking(null)
        dispatchNav({ type: 'SELECT', target: { unitId: u.id }, source: 'action' })
      }
      if (kind === 'block') {
        const { unit: u, chapter: ch } = findBlock(c, id)
        apply({ type: 'deleteBlock', blockId: id })
        setWorking(null)
        dispatchNav({ type: 'SELECT', target: { unitId: u.id, chapterId: ch.id }, source: 'action' })
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
      handleSelect({ unitId: id }, 'action')
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
      handleSelect({ unitId: modal.unitId, chapterId: id }, 'action')
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
    setWorking({ block: clone(b), dirty: false })
    setUiState({})
    dispatchNav({ type: 'SELECT', target: { unitId, chapterId, blockId: b.id }, source: 'action', scroll: true })
    setPane('workspace')
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

  const edUi = useMemo(
    () => ({ ...ui, jsonSec: block && sel.blockId === block.id ? sel.sectionId : null }),
    [ui, block, sel.blockId, sel.sectionId]
  )

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
    ui: edUi,
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
  const saveKey = working?.dirty ? 'unsaved' : save.status
  const saveLabel = {
    saved: save.at ? `Saved ${timeAgo(save.at)}` : 'All changes saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  }[saveKey]
  const saveShort = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved',
    error: 'Error',
  }[saveKey]

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
              className="icon-btn bld-icon-btn d-none d-md-inline-flex"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              title={undoStack.length > 0 ? 'Undo last edit (Ctrl+Z)' : 'Nothing to undo'}
              aria-label="Undo"
            >
              <LuRotateCcw />
            </button>
            <button
              type="button"
              className="icon-btn bld-icon-btn d-none d-md-inline-flex"
              disabled={redoStack.length === 0}
              onClick={handleRedo}
              title={redoStack.length > 0 ? 'Redo last edit (Ctrl+Y)' : 'Nothing to redo'}
              aria-label="Redo"
            >
              <LuRotateCcw style={{ transform: 'scaleX(-1)' }} />
            </button>
            <span className="bld-vsep mx-1 d-none d-sm-block" style={{ height: 22 }} />

            <span
              className={`save-pill s-${saveKey}`}
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
              <span className="save-chip-short d-xl-none">{saveShort}</span>
              <span className="save-text d-none d-xl-inline">{saveLabel}</span>
            </span>

            <button
              type="button"
              className="btn ui-btn ui-btn-secondary bld-btn d-none d-md-inline-flex"
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

            {/* Small screens: secondary actions live in one tidy "More" menu so the header never wraps */}
            <div className="bld-more d-md-none" ref={moreRef}>
              <button
                type="button"
                className="icon-btn bld-icon-btn"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="More actions"
                aria-haspopup="true"
                aria-expanded={moreOpen}
                title="More"
              >
                <LuEllipsisVertical />
              </button>
              {moreOpen && (
                <div className="user-menu bld-more-menu" role="menu">
                  <button type="button" role="menuitem" disabled={undoStack.length === 0} onClick={() => { setMoreOpen(false); handleUndo() }}>
                    <LuRotateCcw /> Undo
                  </button>
                  <button type="button" role="menuitem" disabled={redoStack.length === 0} onClick={() => { setMoreOpen(false); handleRedo() }}>
                    <LuRotateCcw style={{ transform: 'scaleX(-1)' }} /> Redo
                  </button>
                  <button type="button" role="menuitem" disabled={!!busy} onClick={() => { setMoreOpen(false); onPreview() }}>
                    <LuEye /> Preview
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); toggle() }}>
                    {theme === 'dark' ? <LuSun /> : <LuMoon />} {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="icon-btn bld-icon-btn d-none d-md-inline-flex"
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

          <div
            className={`bld-scrim ${pane !== 'workspace' ? 'show' : ''}`}
            onClick={() => setPane('workspace')}
            aria-hidden="true"
          />

          <aside
            className={`bld-left ${pane === 'structure' ? 'show' : ''}`}
            aria-label="Portal structure"
          >
            <button
              type="button"
              className="bld-drawer-close d-lg-none"
              onClick={() => setPane('workspace')}
              aria-label="Close structure"
            >
              ×
            </button>
            <StructureTree
              content={content}
              target={sel}
              treeOpen={nav.treeOpen}
              onSelect={handleSelect}
              onToggleOpen={handleToggleOpen}
              isDrawerOpen={pane === 'structure'}
              act={act}
              workingBlock={block}
              headRight={collapseLeft}
            />
          </aside>

          <main ref={centerRef} className={`bld-center ${pane === 'workspace' ? 'show' : ''}`}>
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
                onSelect={handleSelect}
                onEdit={() => act.editUnit(unit)}
                onAddChapter={() => act.addChapter(unit.id)}
              />
            ) : (
              <>
                <Crumbs
                  unit={unit}
                  chapter={chapter}
                  block={block}
                  badge={
                    <span className="ws-editing-badge" title="Currently active chapter being edited">
                      Editing: <strong>Unit {unitIndex + 1} · Ch {chIndex + 1}</strong> ({chapter.title})
                    </span>
                  }
                  onSelect={handleSelect}
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
                  selectedBlockId={block?.id || null}
                  workingBlock={block}
                  onSelect={handleSelect}
                  onEditData={setData}
                  onUploadImage={async (f) => {
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
            <button
              type="button"
              className="bld-drawer-close d-lg-none"
              onClick={() => setPane('workspace')}
              aria-label="Close properties"
            >
              ×
            </button>
            {block && Props ? (
              <Props {...edProps} headRight={collapseRight} />
            ) : chapter ? (
              <ChapterActions
                chapter={chapter}
                unit={unit}
                index={chIndex}
                act={act}
                onCloseDrawer={() => setPane('workspace')}
                headRight={collapseRight}
              />
            ) : unit ? (
              <UnitActions
                unit={unit}
                index={unitIndex}
                count={content.units.length}
                act={act}
                onCloseDrawer={() => setPane('workspace')}
                headRight={collapseRight}
              />
            ) : (
              <SetupGuide
                content={content}
                published={!!portal.publishedAt}
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
            unit={modal.editUnit}
            portalId={portalId}
            onSubmit={submitUnit}
          />
        )}
        {modal.chapter && (
          <ChapterModal
            show={true}
            onClose={() => setModal({})}
            chapter={modal.editChapter}
            unitTitle={content.units.find((u) => u.id === modal.unitId)?.title}
            portalId={portalId}
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
        <GoToTop containerSelector=".bld-center" />
      </div>
    </RichTextProvider>
  )
}
