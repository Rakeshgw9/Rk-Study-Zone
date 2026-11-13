import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LuCircleAlert,
  LuCirclePlay,
  LuCode,
  LuCopy,
  LuDownload,
  LuEye,
  LuFileText,
  LuGlobe,
  LuImage,
  LuLayers,
  LuLink,
  LuListTree,
  LuMaximize2,
  LuMinimize2,
  LuMoon,
  LuPackage,
  LuPencil,
  LuPlus,
  LuRotateCcw,
  LuSave,
  LuSearch,
  LuSquarePen,
  LuSun,
  LuTrash2,
  LuType,
  LuUpload,
  LuWandSparkles,
  LuX,
} from 'react-icons/lu'
import { frameProps } from '../../lib/blockRender'
import { cmAction, downloadText, insertAtCursor, readFileText, splitHtmlDocument } from '../../lib/cmActions'
import { applyHtmlEdit, listImages, removeImage, updateImage } from '../../lib/editBridge'
import { formatCode } from '../../lib/formatCode'
import { timeAgo, uid } from '../../lib/id'
import { uploadImage } from '../../services/storageService'
import Modal from '../Modal'
import { useToast } from '../Toast'
import { useConfirm } from '../ui/Confirm'
import { DeviceToggle, Field, NumberField, Section, Tabs, Toggle, deviceWidth } from '../ui/Controls'
import PackageManager from '../ui/PackageManager'
import { useRichText } from '../ui/RichText'
import SandboxFrame from '../ui/SandboxFrame'

const CodeEditor = lazy(() => import('../ui/CodeEditor'))
const LANGS = [
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'js', label: 'JS' },
]
const FILES = { html: 'index.html', css: 'style.css', js: 'script.js' }
export const EditorFallback = () => (
  <div className="code-loading">
    <span className="spinner-border spinner-border-sm" /> Loading editor…
  </div>
)

const parseStyle = (s = '') =>
  Object.fromEntries(
    String(s)
      .split(';')
      .map((p) => {
        const i = p.indexOf(':')
        return i > 0 ? [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()] : null
      })
      .filter(Boolean)
  )

const styleString = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')

/* Reusable Snippets Library (Change 9: Requirement 4) */
const SNIPPETS = [
  {
    id: 'img',
    label: 'Image',
    icon: LuImage,
    code: `<img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800" alt="Lesson Illustration" class="img-fluid rounded my-2" />`,
  },
  {
    id: 'figure',
    label: 'Figure + Caption',
    icon: LuLayers,
    code: `<figure class="text-center my-3">\n  <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800" alt="Concept diagram" class="img-fluid rounded" />\n  <figcaption class="figure-caption mt-2">Figure 1: Core conceptual overview.</figcaption>\n</figure>`,
  },
  {
    id: 'two-cols',
    label: 'Two Columns',
    icon: LuLayers,
    code: `<div class="row g-3 my-3">\n  <div class="col-md-6">\n    <h4>Section A</h4>\n    <p>Detailed explanation for the first topic.</p>\n  </div>\n  <div class="col-md-6">\n    <h4>Section B</h4>\n    <p>Detailed explanation for the second topic.</p>\n  </div>\n</div>`,
  },
  {
    id: 'card',
    label: 'Card',
    icon: LuLayers,
    code: `<div class="card bg-dark text-white border-primary my-3">\n  <div class="card-body">\n    <h5 class="card-title">Concept Highlight</h5>\n    <p class="card-text">Essential learning summary and key notes.</p>\n  </div>\n</div>`,
  },
  {
    id: 'alert',
    label: 'Alert / Note',
    icon: LuCircleAlert,
    code: `<div class="alert alert-info my-3 d-flex align-items-center gap-2" role="alert">\n  <div><strong>Note:</strong> Pay special attention to this concept during exam preparation.</div>\n</div>`,
  },
  {
    id: 'table',
    label: 'Table',
    icon: LuLayers,
    code: `<div class="table-responsive my-3">\n  <table class="table table-bordered table-striped">\n    <thead>\n      <tr><th>#</th><th>Parameter</th><th>Description</th></tr>\n    </thead>\n    <tbody>\n      <tr><td>1</td><td>Point A</td><td>Primary characteristic</td></tr>\n      <tr><td>2</td><td>Point B</td><td>Secondary characteristic</td></tr>\n    </tbody>\n  </table>\n</div>`,
  },
  {
    id: 'list',
    label: 'List',
    icon: LuListTree,
    code: `<ul class="list-group my-3">\n  <li class="list-group-item bg-dark text-white">First key point or takeaway</li>\n  <li class="list-group-item bg-dark text-white">Second key point or takeaway</li>\n  <li class="list-group-item bg-dark text-white">Third key point or takeaway</li>\n</ul>`,
  },
  {
    id: 'button',
    label: 'Button',
    icon: LuSquarePen,
    code: `<a href="#" class="btn btn-primary my-2">Explore Resource →</a>`,
  },
  {
    id: 'quote',
    label: 'Quote',
    icon: LuFileText,
    code: `<blockquote class="blockquote border-start border-primary ps-3 my-3">\n  <p>“Education is the most powerful weapon which you can use to change the world.”</p>\n  <footer class="blockquote-footer text-muted">Nelson Mandela</footer>\n</blockquote>`,
  },
  {
    id: 'iframe',
    label: 'Iframe',
    icon: LuGlobe,
    code: `<div class="ratio ratio-16x9 my-3">\n  <iframe src="https://example.com" title="Interactive Simulation" allowfullscreen></iframe>\n</div>`,
  },
  {
    id: 'video',
    label: 'Video',
    icon: LuCirclePlay,
    code: `<div class="ratio ratio-16x9 my-3">\n  <video controls class="rounded">\n    <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">\n    Your browser does not support HTML5 video.\n  </video>\n</div>`,
  },
  {
    id: 'custom-html',
    label: 'Custom HTML',
    icon: LuCode,
    code: `<div class="custom-block p-3 border rounded my-3">\n  <h3>Custom Title</h3>\n  <p>Place custom interactive or structured HTML here.</p>\n</div>`,
  },
]

function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

/**
 * Image Manager Modal with 4 Insertion Methods:
 * 1. Upload from Computer
 * 2. Insert Using an Image URL
 * 3. Import from GitHub Repository
 * 4. Select from Existing Assets Library
 * Also configures Alt text, width, height, alignment and responsive behaviour.
 * NEVER stores Base64 inside code!
 */
function ImageManagerModal({ show, onClose, onInsert, assets, usedIn }) {
  const [tab, setTab] = useState('upload') // upload | url | github | library
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [searchAsset, setSearchAsset] = useState('')

  // Image Settings
  const [altText, setAltText] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [alignment, setAlignment] = useState('center') // left | center | right
  const [responsive, setResponsive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fileRef = useRef(null)

  useEffect(() => {
    if (!show) {
      setFile(null)
      setPreviewUrl('')
      setUrlInput('')
      setGithubUrl('')
      setSelectedAsset(null)
      setError('')
      setBusy(false)
    }
  }, [show])

  const handleFile = (f) => {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      return setError('Only JPG, PNG or WEBP images are allowed.')
    }
    if (f.size > 5 * 1024 * 1024) {
      return setError('Image must be 5 MB or smaller.')
    }
    setFile(f)
    setError('')
    const r = new FileReader()
    r.onload = (e) => setPreviewUrl(e.target.result)
    r.readAsDataURL(f)
  }

  const handleInsert = async () => {
    setError('')
    let finalSrc = ''

    if (tab === 'upload') {
      if (!file) return setError('Please choose an image file to upload.')
      setBusy(true)
      try {
        finalSrc = await uploadImage(file, 'html-block', { max: 1400 })
      } catch (err) {
        setError(err.message || 'Upload failed')
        setBusy(false)
        return
      }
      setBusy(false)
    } else if (tab === 'url') {
      if (!urlInput.trim() || !/^https?:\/\//i.test(urlInput.trim())) {
        return setError('Please enter a valid https:// image URL.')
      }
      finalSrc = urlInput.trim()
    } else if (tab === 'github') {
      let gUrl = githubUrl.trim()
      if (!gUrl) return setError('Please enter a GitHub repository image URL.')
      if (gUrl.includes('github.com') && gUrl.includes('/blob/')) {
        gUrl = gUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
      }
      finalSrc = gUrl
    } else if (tab === 'library') {
      if (!selectedAsset) return setError('Please select an asset from the library.')
      finalSrc = selectedAsset.src || `asset:${selectedAsset.id}`
    }

    const styleParts = []
    if (alignment === 'center') styleParts.push('display:block;margin-left:auto;margin-right:auto')
    else if (alignment === 'left') styleParts.push('float:left;margin-right:16px;margin-bottom:12px')
    else if (alignment === 'right') styleParts.push('float:right;margin-left:16px;margin-bottom:12px')

    const classNames = ['img-custom']
    if (responsive) classNames.push('img-fluid')

    const widthAttr = width ? ` width="${width}"` : ''
    const heightAttr = height ? ` height="${height}"` : ''
    const styleAttr = styleParts.length ? ` style="${styleParts.join(';')}"` : ''
    const altAttr = ` alt="${(altText || 'Lesson image').replace(/"/g, '&quot;')}"`

    const tag = `<img src="${finalSrc}"${altAttr} class="${classNames.join(' ')}"${widthAttr}${heightAttr}${styleAttr} />`

    onInsert(tag)
    onClose()
  }

  const filteredAssets = (assets || []).filter((a) =>
    (a.name || '').toLowerCase().includes(searchAsset.toLowerCase())
  )

  return (
    <Modal show={show} onClose={onClose} className="ui-modal ui-modal-lg" labelledBy="img-mgr-title">
      <div className="ui-modal-head">
        <span className="ui-modal-icon">
          <LuImage />
        </span>
        <div className="flex-grow-1">
          <h2 id="img-mgr-title">Image Manager</h2>
          <p>Insert externally hosted or cloud-stored images anywhere in your HTML code.</p>
        </div>
        <button className="ui-x" onClick={onClose} aria-label="Close">
          <LuX />
        </button>
      </div>

      <div className="ui-modal-body">
        {/* Method Selection Tabs */}
        <div className="ui-tabs mb-3">
          <button
            type="button"
            className={`ui-tab ${tab === 'upload' ? 'on' : ''}`}
            onClick={() => setTab('upload')}
          >
            <LuUpload className="me-1" /> Upload from Computer
          </button>
          <button
            type="button"
            className={`ui-tab ${tab === 'url' ? 'on' : ''}`}
            onClick={() => setTab('url')}
          >
            <LuLink className="me-1" /> Image URL
          </button>
          <button
            type="button"
            className={`ui-tab ${tab === 'github' ? 'on' : ''}`}
            onClick={() => setTab('github')}
          >
            <GitHubIcon /> <span className="ms-1">GitHub Repository</span>
          </button>
          <button
            type="button"
            className={`ui-tab ${tab === 'library' ? 'on' : ''}`}
            onClick={() => setTab('library')}
          >
            <LuPackage className="me-1" /> Assets Library ({assets?.length || 0})
          </button>
        </div>

        {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

        {/* Tab 1: Upload from Computer */}
        {tab === 'upload' && (
          <div>
            <div
              className="drop-zone mb-3"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFile(e.dataTransfer.files[0])
              }}
            >
              <LuUpload className="fs-2 mb-2" />
              <strong>{file ? file.name : 'Drag & drop image here or click to browse'}</strong>
              <span className="small text-soft">PNG, JPG or WEBP up to 5 MB.</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                handleFile(e.target.files[0])
                e.target.value = ''
              }}
            />
          </div>
        )}

        {/* Tab 2: Insert using an Image URL */}
        {tab === 'url' && (
          <div className="mb-3">
            <label className="ui-label">Image Address (URL)</label>
            <input
              className="ui-input"
              placeholder="https://images.unsplash.com/photo-..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value)
                setPreviewUrl(e.target.value)
              }}
            />
            <small className="text-soft">Direct image link (PNG, JPG, SVG, WebP).</small>
          </div>
        )}

        {/* Tab 3: Import from GitHub Repository */}
        {tab === 'github' && (
          <div className="mb-3">
            <label className="ui-label">GitHub Hosted Image URL</label>
            <input
              className="ui-input"
              placeholder="https://github.com/username/repo/blob/main/images/diagram.png"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value)
                let u = e.target.value
                if (u.includes('github.com') && u.includes('/blob/')) {
                  u = u.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
                }
                setPreviewUrl(u)
              }}
            />
            <small className="text-soft">
              Both standard GitHub and raw.githubusercontent.com URLs are automatically converted.
            </small>
          </div>
        )}

        {/* Tab 4: Select from Existing Assets Library */}
        {tab === 'library' && (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <input
                className="ui-input ui-input-sm"
                placeholder="Search assets by name…"
                style={{ maxWidth: 240 }}
                value={searchAsset}
                onChange={(e) => setSearchAsset(e.target.value)}
              />
              <span className="small text-soft">{filteredAssets.length} image(s)</span>
            </div>

            {filteredAssets.length === 0 ? (
              <p className="text-soft text-center py-4">No matching assets found.</p>
            ) : (
              <div className="asset-grid" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {filteredAssets.map((a) => {
                  const active = selectedAsset?.id === a.id
                  return (
                    <div
                      key={a.id}
                      className={`asset-card ${active ? 'border-primary' : ''}`}
                      onClick={() => {
                        setSelectedAsset(a)
                        setPreviewUrl(a.src)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="asset-thumb">
                        <img src={a.src} alt={a.name} />
                      </div>
                      <b title={a.name}>{a.name}</b>
                      <small>{usedIn ? usedIn(a.id) : 0} uses</small>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Live Preview of Selected Image */}
        {previewUrl && (
          <div className="text-center p-2 mb-3 bg-darker rounded border border-secondary">
            <div className="small text-soft mb-1">Image Preview:</div>
            <img
              src={previewUrl}
              alt="Preview"
              style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'contain' }}
              onError={() => setError('Could not load image from this URL.')}
            />
          </div>
        )}

        {/* Image Configuration Attributes */}
        <div className="row g-2 border-top pt-3">
          <div className="col-12">
            <Field label="Alt Text (accessibility & SEO)">
              <input
                className="ui-input"
                placeholder="Describe this image"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
              />
            </Field>
          </div>
          <div className="col-6 col-sm-3">
            <Field label="Width">
              <input
                className="ui-input"
                placeholder="e.g. 400 or 100%"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </Field>
          </div>
          <div className="col-6 col-sm-3">
            <Field label="Height">
              <input
                className="ui-input"
                placeholder="auto"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </Field>
          </div>
          <div className="col-6 col-sm-3">
            <Field label="Alignment">
              <select
                className="ui-input ui-select"
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
              >
                <option value="center">Center</option>
                <option value="left">Left (Float)</option>
                <option value="right">Right (Float)</option>
              </select>
            </Field>
          </div>
          <div className="col-6 col-sm-3 d-flex align-items-center mt-3">
            <label className="form-check mb-0">
              <input
                type="checkbox"
                className="form-check-input me-1"
                checked={responsive}
                onChange={(e) => setResponsive(e.target.checked)}
              />
              <span className="small text-soft">Responsive</span>
            </label>
          </div>
        </div>
      </div>

      <div className="ui-modal-foot">
        <button type="button" className="btn ui-btn ui-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn ui-btn ui-btn-primary"
          onClick={handleInsert}
          disabled={busy}
        >
          {busy ? <span className="spinner-border spinner-border-sm me-2" /> : <LuPlus />} Insert Image
        </button>
      </div>
    </Modal>
  )
}

/** Grid of uploaded images: pick, insert, replace everywhere, delete */
function AssetPanel({
  assets,
  usedIn,
  onPick,
  pickLabel,
  onUpload,
  onReplace,
  onDelete,
  onCopy,
  busy,
}) {
  const upRef = useRef(null)
  const repRef = useRef(null)
  const [repId, setRepId] = useState(null)
  const [q, setQ] = useState('')

  const list = (assets || []).filter((a) => (a.name || '').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="asset-panel">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex gap-2 align-items-center">
          <button
            type="button"
            className="btn ui-btn ui-btn-primary btn-sm"
            disabled={busy}
            onClick={() => upRef.current?.click()}
          >
            <LuUpload /> {busy ? 'Uploading…' : 'Upload Image'}
          </button>
          <input
            className="ui-input ui-input-sm"
            placeholder="Search assets…"
            style={{ width: 180 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <span className="small text-soft">PNG, JPG or WEBP up to 5 MB.</span>
      </div>

      <input
        ref={upRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(e) => {
          onUpload([...e.target.files])
          e.target.value = ''
        }}
      />
      <input
        ref={repRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          if (e.target.files[0] && repId) onReplace(repId, e.target.files[0])
          e.target.value = ''
          setRepId(null)
        }}
      />

      {list.length === 0 ? (
        <p className="text-soft text-center my-4">No matching images found.</p>
      ) : (
        <div className="asset-grid">
          {list.map((a) => (
            <div className="asset-card" key={a.id}>
              <div className="asset-thumb">
                <img src={a.src} alt={a.name} />
              </div>
              <b title={a.name}>{a.name}</b>
              <small>
                {usedIn(a.id)} use{usedIn(a.id) === 1 ? '' : 's'} · <code>asset:{a.id}</code>
              </small>
              <div className="asset-acts">
                {onPick && (
                  <button
                    type="button"
                    className="btn ui-btn ui-btn-primary btn-sm"
                    onClick={() => onPick(a)}
                  >
                    {pickLabel || 'Use'}
                  </button>
                )}
                <button
                  type="button"
                  className="icon-mini"
                  title="Copy token"
                  onClick={() => onCopy(a)}
                >
                  <LuCopy />
                </button>
                <button
                  type="button"
                  className="icon-mini"
                  title="Replace everywhere"
                  onClick={() => {
                    setRepId(a.id)
                    repRef.current?.click()
                  }}
                >
                  <LuUpload />
                </button>
                <button
                  type="button"
                  className="icon-mini danger"
                  title="Delete image"
                  onClick={() => onDelete(a)}
                >
                  <LuTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Main Central HTML/CSS/JS Editor Workspace (Change 9)
 * - Synchronized Live Preview with image replacement directly from preview.
 * - Code Editor with HTML, CSS, JS tabs.
 * - Reusable Quick Snippets Library below Code Editor.
 * - Multi-method Image Manager without Base64 storage.
 */
export function HtmlCenter({ block, setData, ui, setUi, dirty }) {
  const d = block.data
  const toast = useToast()
  const confirm = useConfirm()
  const rich = useRichText()
  const [big, setBig] = useState(false)
  const [snap, setSnap] = useState(null)
  const [logs, setLogs] = useState([])
  const [jsErr, setJsErr] = useState('')
  const [consoleOpen, setConsoleOpen] = useState(true)
  const [imgModal, setImgModal] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [imageManagerOpen, setImageManagerOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const viewRef = useRef(null)
  const importRef = useRef(null)
  const imgFileRef = useRef(null)
  const logId = useRef(0)
  const dRef = useRef(d)
  dRef.current = d
  const act = useRef({})
  act.current = { setData, toast, setUi }

  const tab = ui.htmlTab || 'html'
  const dark = ui.codeDark !== false
  const textEdit = !!ui.canvasEdit
  const bigPrev = !!ui.previewFull
  const assets = d.assets || []

  useEffect(() => {
    setSnap(textEdit ? { html: dRef.current.html, css: dRef.current.css } : null)
  }, [textEdit])

  useEffect(() => {
    setJsErr('')
  }, [d.html, d.css, d.js])

  const src = textEdit && snap ? snap : d
  const previewProps = useMemo(
    () =>
      frameProps(
        { type: 'html', data: { ...d, html: src.html, css: src.css } },
        { editImages: !textEdit, textEdit }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src.html, src.css, d.js, d.packages, d.style, d.padding, d.assets, d.copyButton, textEdit]
  )

  const usedIn = useCallback(
    (id) =>
      [d.html, d.css, d.js].reduce((n, t) => n + ((t || '').split(`asset:${id}`).length - 1), 0),
    [d.html, d.css, d.js]
  )

  const addAssets = async (files) => {
    const list = files.filter(Boolean)
    if (!list.length) return []
    setBusy(true)
    const made = []
    try {
      for (const f of list) {
        made.push({
          id: uid('ast'),
          name: f.name,
          src: await uploadImage(f, 'html-block', { max: 1400 }),
        })
      }
    } catch (e) {
      toast(e.message || 'Image upload failed.', 'error')
    }
    setBusy(false)
    return made
  }

  const onAssetsUpload = async (files) => {
    const made = await addAssets(files)
    if (made.length) {
      setData({ assets: [...(dRef.current.assets || []), ...made] })
      toast(`${made.length} image${made.length > 1 ? 's' : ''} added`)
    }
  }

  const onAssetReplace = async (id, file) => {
    const [m] = await addAssets([file])
    if (m) {
      setData({
        assets: (dRef.current.assets || []).map((a) =>
          a.id === id ? { ...a, src: m.src, name: file.name } : a
        ),
      })
      toast('Image replaced everywhere it is used')
    }
  }

  const onAssetDelete = async (a) => {
    const n = usedIn(a.id)
    if (
      !(await confirm({
        title: 'Delete image?',
        message: n
          ? `“${a.name}” is used ${n} time${n > 1 ? 's' : ''}. Those places will show a broken image.`
          : `“${a.name}” will be removed from this block.`,
        danger: true,
        confirmText: 'Delete image',
      }))
    )
      return
    setData({ assets: (dRef.current.assets || []).filter((x) => x.id !== a.id) })
  }

  const onAssetCopy = (a) => {
    navigator.clipboard?.writeText(`asset:${a.id}`)
    toast('Image token copied')
  }

  const insertSnippet = (snippet) => {
    if (tab !== 'html') {
      setUi({ htmlTab: 'html' })
    }
    if (viewRef.current) {
      insertAtCursor(viewRef.current, snippet.code)
    } else {
      setData({ html: `${dRef.current.html || ''}\n${snippet.code}` })
    }
    toast(`Snippet inserted: ${snippet.label}`)
  }

  const insertCustomImage = (tag) => {
    if (tab !== 'html') {
      setUi({ htmlTab: 'html' })
    }
    if (viewRef.current) {
      insertAtCursor(viewRef.current, tag)
    } else {
      setData({ html: `${dRef.current.html || ''}\n${tag}` })
    }
    toast('Image inserted into HTML')
  }

  /* ---- Hover actions coming from preview frame ---- */
  const bridge = useMemo(
    () => ({
      onEdit: (e) => {
        if (e.index !== undefined)
          act.current.setData({ html: applyHtmlEdit(dRef.current.html || '', e.index, e.html) })
      },
      onFocus: rich.setTarget,
      onState: rich.setState,
      onImage: ({ i, action }) => {
        if (action === 'remove')
          act.current.setData({ html: removeImage(dRef.current.html || '', i) })
        else if (action === 'upload') {
          setImgModal({ i, mode: 'upload' })
          imgFileRef.current?.click()
        } else if (action === 'change') setImgModal({ i, mode: 'change' })
        else if (action === 'edit') {
          const img = listImages(dRef.current.html || '')[i]
          setImgModal({ i, mode: 'edit', attrs: img?.attrs || {} })
        }
      },
    }),
    [rich.setTarget, rich.setState]
  )

  const setImageSrc = (i, asset) =>
    setData({ html: updateImage(dRef.current.html || '', i, { src: `asset:${asset.id}` }) })

  const onImgFile = async (file) => {
    const i = imgModal?.i
    setImgModal(null)
    if (!file || i === undefined) return
    const [m] = await addAssets([file])
    if (!m) return
    setData({
      assets: [...(dRef.current.assets || []), m],
      html: updateImage(dRef.current.html || '', i, { src: `asset:${m.id}` }),
    })
    toast('Image uploaded')
  }

  const applyImgEdit = (form) => {
    const st = parseStyle(form.style)
    st['border-radius'] = form.radius ? `${form.radius}px` : ''
    st.border = form.borderW ? `${form.borderW}px solid ${form.borderC}` : ''
    setData({
      html: updateImage(dRef.current.html || '', imgModal.i, {
        alt: form.alt,
        width: form.width,
        height: form.height,
        style: styleString(st),
      }),
    })
    setImgModal(null)
    toast('Image updated')
  }

  const format = async () => {
    try {
      const out = await formatCode(d[tab] || '', tab)
      setData({ [tab]: out })
      toast(`${tab.toUpperCase()} formatted`)
    } catch (e) {
      toast(`Cannot format — ${String(e.message || 'syntax error').split('\n')[0]}`, 'error')
    }
  }

  const onImport = async (files) => {
    const patch = {}
    let last = tab
    for (const f of files) {
      const ext = f.name.split('.').pop().toLowerCase()
      try {
        const text = await readFileText(f)
        if (ext === 'css') {
          patch.css = text
          last = 'css'
        } else if (ext === 'js') {
          patch.js = text
          last = 'js'
        } else if (ext === 'html' || ext === 'htm') {
          const p = splitHtmlDocument(text)
          patch.html = p.html
          if (p.css) patch.css = `${patch.css ?? ''}${patch.css ? '\n\n' : ''}${p.css}`
          if (p.js) patch.js = `${patch.js ?? ''}${patch.js ? '\n\n' : ''}${p.js}`
          last = 'html'
        } else {
          patch[tab] = text
        }
      } catch (e) {
        toast(e.message, 'error')
      }
    }
    if (Object.keys(patch).length) {
      setData(patch)
      setUi({ htmlTab: last, canvasEdit: false })
      toast(`Imported ${files.length} file(s)`)
    }
  }

  const exportFiles = (what) => {
    setExportOpen(false)
    if (what === 'tab')
      downloadText(
        FILES[tab],
        d[tab] || '',
        tab === 'html' ? 'text/html' : tab === 'css' ? 'text/css' : 'text/javascript'
      )
    else if (what === 'all') {
      downloadText('index.html', d.html || '', 'text/html')
      setTimeout(() => downloadText('style.css', d.css || '', 'text/css'), 150)
      setTimeout(() => downloadText('script.js', d.js || '', 'text/javascript'), 300)
    } else {
      downloadText(
        'page.html',
        `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${
          block.title || 'Page'
        }</title>\n<style>\n${d.css || ''}\n</style>\n</head>\n<body>\n${d.html || ''}\n<script>\n${
          d.js || ''
        }\n<\/script>\n</body>\n</html>`,
        'text/html'
      )
    }
    toast('Download started')
  }

  const onConsole = useCallback(
    (e) => setLogs((l) => [...l.slice(-99), { ...e, id: ++logId.current }]),
    []
  )
  const onError = useCallback((m) => {
    setJsErr(m)
    setLogs((l) => [...l.slice(-99), { level: 'error', text: m, id: ++logId.current }])
  }, [])

  return (
    <div className="editor-stack">
      {/* 1. Synchronized Live Preview */}
      {ui.preview !== false && (
        <div className={`ed-card ${bigPrev ? 'ed-fullscreen' : ''}`}>
          <div className="ed-card-head">
            <span className="ttl">
              <LuEye /> Live Preview <span className="pill pill-info ms-1">Full width</span>
            </span>
            <span className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className={`btn ui-btn btn-sm ${textEdit ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
                onClick={() => setUi({ canvasEdit: !textEdit })}
                title="Click and edit text directly in the preview"
              >
                <LuPencil /> {textEdit ? 'Done editing text' : 'Edit text on canvas'}
              </button>
              <DeviceToggle
                value={ui.device || 'desktop'}
                onChange={(v) => setUi({ device: v })}
              />
              <button
                className="icon-mini"
                onClick={() => setUi({ previewFull: !bigPrev })}
                aria-label={bigPrev ? 'Exit full screen' : 'Full screen preview'}
              >
                {bigPrev ? <LuMinimize2 /> : <LuMaximize2 />}
              </button>
            </span>
          </div>
          <div className="ed-preview light-canvas">
            <SandboxFrame
              {...previewProps}
              width={deviceWidth(ui.device)}
              minHeight={120}
              onError={onError}
              onConsole={onConsole}
              bridge={bridge}
            />
          </div>
          <p className="ed-hint">
            Hover over any image in the preview to replace, edit attributes or remove it directly.
          </p>
        </div>
      )}

      {/* 2. Code Editor Card */}
      <div className={`ed-card ${big ? 'ed-fullscreen' : ''}`}>
        <div className="ed-card-head">
          <span className="ttl">
            <LuCode /> Code Editor
          </span>
          <span className="d-flex align-items-center gap-2 flex-wrap">
            <span className={`pill ${dirty ? 'pill-warn' : 'pill-ok'}`}>
              {dirty ? 'Unsaved' : 'Draft saved'}
            </span>
            <button
              className="icon-mini"
              onClick={() => setBig((b) => !b)}
              aria-label={big ? 'Exit full screen' : 'Full screen'}
            >
              {big ? <LuMinimize2 /> : <LuMaximize2 />}
            </button>
          </span>
        </div>

        {/* Toolbar */}
        <div className="code-toolbar" role="toolbar" aria-label="Code editor tools">
          <button type="button" onClick={format} title="Format code (Ctrl+Shift+F)">
            <LuWandSparkles /> Format
          </button>
          <button
            type="button"
            onClick={() => cmAction(viewRef.current, 'find')}
            title="Find & replace (Ctrl+F)"
          >
            <LuSearch /> Find
          </button>
          <button
            type="button"
            onClick={() => cmAction(viewRef.current, 'undo')}
            title="Undo (Ctrl+Z)"
          >
            <LuRotateCcw /> Undo
          </button>
          <button
            type="button"
            onClick={() => cmAction(viewRef.current, 'redo')}
            title="Redo (Ctrl+Y)"
          >
            <LuRotateCcw style={{ transform: 'scaleX(-1)' }} /> Redo
          </button>
          <i className="rt-sep" />
          <button
            type="button"
            onClick={() => setImageManagerOpen(true)}
            className="fw-semibold text-primary-2"
            title="Insert Image using 4 Methods"
          >
            <LuImage /> Image Manager
          </button>
          <button type="button" onClick={() => setUi({ assetsOpen: true })}>
            <LuPackage /> Assets ({assets.length})
          </button>
          <i className="rt-sep" />
          <button type="button" onClick={() => importRef.current?.click()} title="Import files">
            <LuUpload /> Import
          </button>
          <span className="code-menu">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={exportOpen}
            >
              <LuDownload /> Export ▾
            </button>
            {exportOpen && (
              <div className="rt-menu" role="menu">
                <button type="button" onClick={() => exportFiles('tab')}>
                  Current tab ({FILES[tab]})
                </button>
                <button type="button" onClick={() => exportFiles('all')}>
                  All files (html, css, js)
                </button>
                <button type="button" onClick={() => exportFiles('page')}>
                  One combined page
                </button>
              </div>
            )}
          </span>
          <button
            type="button"
            onClick={() => setUi({ codeDark: !dark })}
            title="Switch editor theme"
          >
            {dark ? <LuSun /> : <LuMoon />} {dark ? 'Light' : 'Dark'}
          </button>
          <input
            ref={importRef}
            hidden
            type="file"
            multiple
            accept=".html,.htm,.css,.js,.txt,text/html,text/css,text/javascript"
            onChange={(e) => {
              onImport([...e.target.files])
              e.target.value = ''
            }}
          />
        </div>

        {/* Tabs: HTML, CSS, JS */}
        <Tabs value={tab} onChange={(v) => setUi({ htmlTab: v })} items={LANGS} className="code-tabs" />

        {/* Code Editor */}
        <Suspense fallback={<EditorFallback />}>
          <CodeEditor
            key={`${tab}-${dark}`}
            lang={tab}
            dark={dark}
            value={d[tab] || ''}
            onChange={(v) => {
              setData({ [tab]: v })
              if (textEdit) setUi({ canvasEdit: false })
            }}
            height={big ? 'calc(100vh - 340px)' : '300px'}
            ariaLabel={`${tab} code`}
            onReady={(v) => {
              viewRef.current = v
            }}
            onFormat={format}
            getHtml={() => dRef.current.html}
            getCss={() => dRef.current.css}
          />
        </Suspense>

        {jsErr && (
          <div className="code-error" role="alert">
            <b>JavaScript error:</b> {jsErr}
          </div>
        )}

        {/* 3. Quick Snippets Library (Change 9: Requirement 4) */}
        <div className="quick-snippets-bar border-top p-2 bg-darker">
          <div className="d-flex align-items-center gap-1 flex-wrap">
            <span className="small text-soft fw-semibold me-2 d-none d-sm-inline">
              Insert Snippet:
            </span>
            {SNIPPETS.map((sn) => {
              const Icon = sn.icon
              return (
                <button
                  key={sn.id}
                  type="button"
                  className="snippet-pill-btn"
                  onClick={() => insertSnippet(sn)}
                  title={`Insert editable ${sn.label} at cursor`}
                >
                  <Icon /> {sn.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Console */}
        <div className="code-console">
          <button
            type="button"
            className="code-console-head"
            onClick={() => setConsoleOpen((o) => !o)}
            aria-expanded={consoleOpen}
          >
            Console ({logs.length}) <span>{consoleOpen ? '▾' : '▸'}</span>
            <span
              className="ms-auto"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                setLogs([])
                setJsErr('')
              }}
            >
              Clear
            </span>
          </button>
          {consoleOpen && (
            <div className="code-console-body">
              {logs.length === 0 ? (
                <small className="text-soft">Console logs and errors appear here.</small>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className={`cl cl-${l.level}`}>
                    {l.level === 'error' ? '✖' : l.level === 'warn' ? '⚠' : '›'} {l.text}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Manager Modal (Change 9: 4 Insertion Methods) */}
      <ImageManagerModal
        show={imageManagerOpen}
        onClose={() => setImageManagerOpen(false)}
        onInsert={insertCustomImage}
        assets={assets}
        usedIn={usedIn}
      />

      {/* Assets Drawer/Modal */}
      <input
        ref={imgFileRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          onImgFile(e.target.files[0])
          e.target.value = ''
        }}
      />

      <Modal
        show={!!ui.assetsOpen}
        onClose={() => setUi({ assetsOpen: false })}
        className="ui-modal ui-modal-lg"
        labelledBy="assets-title"
      >
        <div className="ui-modal-head">
          <span className="ui-modal-icon">
            <LuImage />
          </span>
          <div className="flex-grow-1">
            <h2 id="assets-title">Assets & Files</h2>
            <p>
              Uploaded assets for this block. Use them as <code>asset:ID</code>.
            </p>
          </div>
          <button className="ui-x" onClick={() => setUi({ assetsOpen: false })} aria-label="Close">
            <LuX />
          </button>
        </div>
        <div className="ui-modal-body">
          <AssetPanel
            assets={assets}
            usedIn={usedIn}
            busy={busy}
            pickLabel="Insert"
            onPick={(a) => {
              const tag = `<img src="asset:${a.id}" alt="${(a.name || '').replace(/\.[^.]+$/, '')}">`
              insertCustomImage(tag)
              setUi({ assetsOpen: false })
            }}
            onUpload={onAssetsUpload}
            onReplace={onAssetReplace}
            onDelete={onAssetDelete}
            onCopy={onAssetCopy}
          />
        </div>
      </Modal>

      {/* Change Image from preview hover */}
      <Modal
        show={imgModal?.mode === 'change'}
        onClose={() => setImgModal(null)}
        className="ui-modal ui-modal-lg"
        labelledBy="chg-title"
      >
        <div className="ui-modal-head">
          <span className="ui-modal-icon">
            <LuImage />
          </span>
          <div className="flex-grow-1">
            <h2 id="chg-title">Change Image</h2>
            <p>Pick an uploaded asset or upload a new one.</p>
          </div>
          <button className="ui-x" onClick={() => setImgModal(null)} aria-label="Close">
            <LuX />
          </button>
        </div>
        <div className="ui-modal-body">
          <AssetPanel
            assets={assets}
            usedIn={usedIn}
            busy={busy}
            pickLabel="Use this image"
            onPick={(a) => {
              setImageSrc(imgModal.i, a)
              setImgModal(null)
              toast('Image changed')
            }}
            onUpload={async (files) => {
              const made = await addAssets(files)
              if (made.length) {
                setData({
                  assets: [...(dRef.current.assets || []), ...made],
                  html: updateImage(dRef.current.html || '', imgModal.i, {
                    src: `asset:${made[0].id}`,
                  }),
                })
                setImgModal(null)
                toast('Image changed')
              }
            }}
            onReplace={onAssetReplace}
            onDelete={onAssetDelete}
            onCopy={onAssetCopy}
          />
        </div>
      </Modal>

      <ImageEditModal
        show={imgModal?.mode === 'edit'}
        attrs={imgModal?.attrs}
        onClose={() => setImgModal(null)}
        onApply={applyImgEdit}
      />
    </div>
  )
}

function ImageEditModal({ show, attrs = {}, onClose, onApply }) {
  const st = parseStyle(attrs.style)
  const [form, setForm] = useState(null)
  const cur = form || {
    alt: attrs.alt || '',
    width: attrs.width || '',
    height: attrs.height || '',
    radius: parseInt(st['border-radius'], 10) || 0,
    borderW: parseInt(st.border, 10) || 0,
    borderC: (/#[0-9a-f]{6}/i.exec(st.border || '') || ['#cbd5e1'])[0],
    style: attrs.style || '',
  }
  const set = (p) => setForm({ ...cur, ...p })
  const close = () => {
    setForm(null)
    onClose()
  }
  return (
    <Modal show={show} onClose={close} className="ui-modal ui-modal-md" labelledBy="img-edit-title">
      <div className="ui-modal-head">
        <span className="ui-modal-icon">
          <LuPencil />
        </span>
        <div className="flex-grow-1">
          <h2 id="img-edit-title">Edit Image Attributes</h2>
          <p>Size, rounded corners, border, and alt text.</p>
        </div>
        <button className="ui-x" onClick={close} aria-label="Close">
          <LuX />
        </button>
      </div>
      <div className="ui-modal-body">
        <Field label="Alt text (for accessibility)">
          <input
            className="ui-input"
            value={cur.alt}
            onChange={(e) => set({ alt: e.target.value })}
          />
        </Field>
        <div className="row g-2">
          <div className="col-6">
            <Field label="Width" hint="e.g. 300 or 100%">
              <input
                className="ui-input"
                value={cur.width}
                onChange={(e) => set({ width: e.target.value.replace(/[^\d%]/g, '') })}
              />
            </Field>
          </div>
          <div className="col-6">
            <Field label="Height" hint="blank = auto">
              <input
                className="ui-input"
                value={cur.height}
                onChange={(e) => set({ height: e.target.value.replace(/[^\d%]/g, '') })}
              />
            </Field>
          </div>
          <div className="col-4">
            <NumberField
              label="Corner radius"
              value={cur.radius}
              min={0}
              max={200}
              onChange={(v) => set({ radius: v })}
              suffix="px"
            />
          </div>
          <div className="col-4">
            <NumberField
              label="Border"
              value={cur.borderW}
              min={0}
              max={20}
              onChange={(v) => set({ borderW: v })}
              suffix="px"
            />
          </div>
          <div className="col-4">
            <Field label="Border colour">
              <input
                className="form-control form-control-color"
                type="color"
                value={cur.borderC}
                onChange={(e) => set({ borderC: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>
      <div className="ui-modal-foot">
        <button type="button" className="btn ui-btn ui-btn-secondary" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          className="btn ui-btn ui-btn-primary"
          onClick={() => {
            onApply(cur)
            setForm(null)
          }}
        >
          Apply
        </button>
      </div>
    </Modal>
  )
}

export function HtmlProps({ block, setBlock, setData, ui, setUi, onSave, dirty }) {
  const d = block.data
  const st = {
    textColor: '#0f172a',
    fontFamily: 'Inter',
    fontSize: 16,
    textAlign: 'left',
    borderColor: '#dbe4f3',
    borderWidth: 0,
    borderRadius: 12,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...(d.style || {})
  }
  const tab = ui.htmlPropsTab || 'content'
  const setStyle = (patch) => setData({ style: { ...st, ...patch } })
  return (
    <div className="props">
      <Tabs
        value={tab}
        onChange={(v) => setUi({ htmlPropsTab: v })}
        items={[
          { value: 'content', label: 'Content' },
          { value: 'style', label: 'Style' },
          { value: 'spacing', label: 'Spacing' },
          { value: 'advanced', label: 'Advanced' },
        ]}
        className="props-tabs"
      />
      {tab === 'content' && (
        <>
          <Field label="Block Title">
            <input
              className="ui-input"
              value={block.title}
              onChange={(e) => setBlock({ title: e.target.value })}
              maxLength={120}
            />
          </Field>
          <p className="small text-soft">
            Use the HTML, CSS and JS editor in the workspace to edit code and snippets.
          </p>
          <div className="prop-row">
            <span>Show in Chapter</span>
            <Toggle checked={block.visible} onChange={(v) => setBlock({ visible: v })} small />
          </div>
          <div className="prop-row">
            <span>Live Preview</span>
            <Toggle checked={ui.preview !== false} onChange={(v) => setUi({ preview: v })} small />
          </div>
          <div className="prop-row">
            <span>Edit text on canvas</span>
            <Toggle checked={!!ui.canvasEdit} onChange={(v) => setUi({ canvasEdit: v })} small />
          </div>
        </>
      )}
      {tab === 'style' && (
        <>
          <Section title="Block Background & Frame">
            <div className="row g-2">
              <div className="col-6">
                <Field label="Background">
                  <input
                    className="form-control form-control-color"
                    type="color"
                    value={st.background || '#ffffff'}
                    onChange={(e) => setStyle({ background: e.target.value })}
                  />
                </Field>
              </div>
              <div className="col-6">
                <NumberField
                  label="Corner radius"
                  value={st.borderRadius}
                  min={0}
                  max={40}
                  onChange={(v) => setStyle({ borderRadius: v })}
                  suffix="px"
                />
              </div>
            </div>
          </Section>
        </>
      )}
      {tab === 'spacing' && (
        <Section title="Block Spacing">
          <div className="row g-2">
            <div className="col-6">
              <NumberField
                label="Padding"
                value={d.padding ?? 16}
                min={0}
                max={60}
                onChange={(v) => setData({ padding: v })}
                suffix="px"
              />
            </div>
            <div className="col-6">
              <NumberField
                label="Margin"
                value={d.margin ?? 16}
                min={0}
                max={60}
                onChange={(v) => setData({ margin: v })}
                suffix="px"
              />
            </div>
          </div>
        </Section>
      )}
      {tab === 'advanced' && (
        <>
          <Section title="External Packages & Libraries">
            <PackageManager
              packages={d.packages || []}
              onChange={(packages) => setData({ packages })}
            />
          </Section>
        </>
      )}
      <button className="btn ui-btn ui-btn-primary w-100 mt-3" onClick={onSave}>
        <LuSave /> {dirty ? 'Save Block' : 'Saved'}
      </button>
    </div>
  )
}
