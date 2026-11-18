import { useEffect, useRef, useState } from 'react'
import { LuChevronDown, LuFileText, LuGraduationCap, LuImage, LuLayers, LuLock, LuPlus, LuSave, LuTrash2, LuUpload, LuX } from 'react-icons/lu'
import Modal from './Modal'
import { ACCESS_TYPES, CATEGORIES, applySyllabusChanges, createPortal, deletePortal, isSlugTaken, syllabusFilesOf, updatePortal } from '../services/portalService'
import SyllabusManagerModal from './SyllabusManagerModal'
import { useToast } from './Toast'

const MAX_DESC = 200
const MAX_SIZE = 2 * 1024 * 1024
const blank = { name: '', slug: '', description: '', category: '', accessType: '', active: true }
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 40)

export default function PortalFormModal({ show, onClose, user, portal }) {
  const isEdit = Boolean(portal)
  const [form, setForm] = useState(blank)
  const [slugTouched, setSlugTouched] = useState(false)
  const [cover, setCover] = useState(null)
  const [preview, setPreview] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // staged syllabus rows: { key, id? (saved file), file? (new File), name, type, size, status }
  const [sylRows, setSylRows] = useState([])
  const [sylOpen, setSylOpen] = useState(false)
  const [sylError, setSylError] = useState('')
  const fileRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    return () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview) }
  }, [preview])

  useEffect(() => {
    if (!show) return
    setErrors({}); setCover(null); setConfirmDelete(false); setSylOpen(false); setSylError('')
    setSylRows(portal ? syllabusFilesOf(portal).map((f) => ({ key: f.id, id: f.id, name: f.name, type: f.type, size: f.size, status: 'saved' })) : [])
    if (portal) {
      setForm({ name: portal.name, slug: portal.slug, description: portal.description || '', category: portal.category, accessType: portal.accessType, active: portal.status === 'active' })
      setPreview(portal.coverUrl || null); setSlugTouched(true)
    } else { setForm(blank); setPreview(null); setSlugTouched(false) }
  }, [show, portal])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const onName = (v) => setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }))

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) return setErrors((x) => ({ ...x, cover: 'Only JPG or PNG images are allowed.' }))
    if (file.size > MAX_SIZE) return setErrors((x) => ({ ...x, cover: 'Image must be 2 MB or smaller.' }))
    setErrors((x) => ({ ...x, cover: undefined }))
    setCover(file); setPreview(URL.createObjectURL(file))
  }

  const rowKey = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const addSyllabus = (files) => setSylRows((rows) => [...rows, ...files.map((file) => ({ key: rowKey(), file, name: file.name, type: file.type || '', size: file.size, status: 'new' }))])
  const replaceSyllabus = (key, file) => setSylRows((rows) => rows.map((r) => (r.key === key ? { key: rowKey(), file, name: file.name, type: file.type || '', size: file.size, status: 'new', replaces: r.id || r.replaces } : r)))
  const removeSyllabus = (key) => setSylRows((rows) => rows.filter((r) => r.key !== key))
  const savedIds = syllabusFilesOf(portal).map((f) => f.id)

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Portal name is required.'
    if (!form.slug.trim()) e.slug = 'Short code is required.'
    else if (!/^[a-z0-9-]{3,40}$/.test(form.slug)) e.slug = 'Use 3–40 lowercase letters, numbers or “-”.'
    if (!form.category) e.category = 'Please select a category.'
    if (!form.accessType) e.accessType = 'Please select an access type.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setBusy(true)
    try {
      if (await isSlugTaken(form.slug, portal?.id)) { setErrors({ slug: 'This short code is already used. Try another.' }); return }
      let id = portal?.id
      if (isEdit) await updatePortal(portal.id, form, cover, user)
      else id = await createPortal(form, cover, user)
      let syllabusError = ''
      try {
        const keepIds = sylRows.filter((r) => r.id).map((r) => r.id)
        const removeIds = isEdit ? savedIds.filter((x) => !keepIds.includes(x)) : []
        const add = sylRows.filter((r) => r.file).map((r) => r.file)
        if (add.length || removeIds.length) {
          const base = isEdit ? syllabusFilesOf(portal) : []
          const res = await applySyllabusChanges(id, base, { add, removeIds })
          if (res.errors.length) syllabusError = res.errors.join(' ')
        }
      } catch (err) { console.error(err); syllabusError = err.message || 'The syllabus could not be saved.' }
      if (syllabusError) toast(`${isEdit ? 'Portal updated' : 'Portal created'}, but some syllabus files were not saved: ${syllabusError}`, 'error')
      else toast(isEdit ? 'Portal updated successfully.' : 'Portal created successfully.')
      onClose()
    } catch (err) {
      console.error(err); toast(err.message || 'Could not save portal.', 'error')
    } finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    try { await deletePortal(portal.id); toast('Portal deleted.'); onClose() }
    catch (err) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  return (
    <>
    <Modal show={show} onClose={busy || sylOpen ? undefined : onClose} className="rk-form-modal" labelledBy="pf-title">
      <form onSubmit={submit} noValidate className="d-flex flex-column h-100">
        <div className="pf-head">
          <LuLayers className="pf-head-icon" />
          <div className="flex-grow-1">
            <h2 id="pf-title">{isEdit ? 'Edit Portal' : 'Create New Portal'}</h2>
            <p>Set up a new study portal for a subject, exam or course.</p>
          </div>
          <button type="button" className="rk-modal-x static" onClick={onClose} aria-label="Close" disabled={busy}><LuX /></button>
        </div>

        <div className="pf-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="rk-label" htmlFor="pf-name">Portal Name <span className="req">*</span></label>
              <input id="pf-name" className={`rk-field ${errors.name ? 'is-invalid' : ''}`} placeholder="e.g. OSSTET Study Portal" value={form.name} onChange={(e) => onName(e.target.value)} maxLength={80} />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>
            <div className="col-md-6">
              <label className="rk-label" htmlFor="pf-slug">Short Code (URL) <span className="req">*</span></label>
              <div className={`slug-group ${errors.slug ? 'is-invalid' : ''}`}>
                <input id="pf-slug" className="rk-field" placeholder="e.g. osstet" value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} />
                <span className="slug-suffix">.rkstudyzone.com</span>
              </div>
              {errors.slug && <div className="field-error">{errors.slug}</div>}
            </div>

            <div className="col-md-6">
              <label className="rk-label" htmlFor="pf-desc">Description</label>
              <div className="position-relative">
                <textarea id="pf-desc" rows={3} className="rk-field rk-textarea" placeholder="Write a short description about this portal..." value={form.description} maxLength={MAX_DESC} onChange={(e) => set('description', e.target.value)} />
                <span className="char-count">{form.description.length} / {MAX_DESC}</span>
              </div>
            </div>
            <div className="col-md-6">
              <span className="rk-label d-block">Syllabus <span className="opt">(Optional)</span></span>
              <div className={`syllabus-box ${sylRows.length ? 'has-files' : ''}`}>
                <span className="syllabus-ico"><LuFileText /></span>
                <div className="syllabus-info">
                  <b title={sylRows.map((r) => r.name).join(', ') || undefined}>
                    {sylRows.length === 0 ? 'Syllabus (Optional)' : sylRows.length === 1 ? sylRows[0].name : `${sylRows.length} syllabus files`}
                  </b>
                  <small>
                    {sylRows.length === 0
                      ? 'Upload syllabus files (PDF, JPG/PNG or JSON).'
                      : sylRows.some((r) => r.status === 'new') ? 'Changes are saved when you press Save' : 'Saved with this portal'}
                  </small>
                </div>
                <button type="button" className="btn rk-btn-primary btn-sm syllabus-add" onClick={() => { setSylError(''); setSylOpen(true) }} disabled={busy}>
                  {sylRows.length ? <LuUpload className="me-1" /> : <LuPlus className="me-1" />}{sylRows.length ? 'Manage' : 'Add Syllabus'}
                </button>
              </div>
            </div>

            <div className="col-md-6">
              <label className="rk-label" htmlFor="pf-cat">Category <span className="req">*</span></label>
              <div className={`select-wrap ${errors.category ? 'is-invalid' : ''}`}>
                <LuGraduationCap className="select-icon" />
                <select id="pf-cat" className="rk-field rk-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">Select Category</option>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <LuChevronDown className="select-caret" />
              </div>
              {errors.category && <div className="field-error">{errors.category}</div>}
            </div>
            <div className="col-md-6">
              <label className="rk-label" htmlFor="pf-access">Access Type <span className="req">*</span></label>
              <div className={`select-wrap ${errors.accessType ? 'is-invalid' : ''}`}>
                <LuLock className="select-icon" />
                <select id="pf-access" className="rk-field rk-select" value={form.accessType} onChange={(e) => set('accessType', e.target.value)}>
                  <option value="">Select Access Type</option>
                  {ACCESS_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <LuChevronDown className="select-caret" />
              </div>
              {errors.accessType && <div className="field-error">{errors.accessType}</div>}
            </div>

            <div className="col-md-6">
              <span className="rk-label d-block">Status</span>
              <label className="rk-switch-row">
                <input type="checkbox" className="rk-toggle" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
                <span>{form.active ? 'Active (Visible to users)' : 'Draft (Hidden from users)'}</span>
              </label>
            </div>
            <div className="col-md-6">
              <span className="rk-label d-block">Portal Cover <span className="opt">(Optional)</span></span>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <span className="cover-preview">{preview ? <img src={preview} alt="Cover preview" /> : <LuImage />}</span>
                <button type="button" className="btn rk-btn-ghost" onClick={() => fileRef.current?.click()}><LuUpload className="me-1" />Choose Image</button>
                <small className="hint">JPG, PNG (Max 2 MB)</small>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={onFile} />
              </div>
              {errors.cover && <div className="field-error">{errors.cover}</div>}
            </div>
          </div>
        </div>

        <div className="pf-foot">
          {isEdit && (confirmDelete
            ? <div className="me-auto d-flex align-items-center gap-2 flex-wrap"><small className="text-danger-soft">Delete this portal?</small>
                <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>Yes, delete</button>
                <button type="button" className="btn btn-sm rk-btn-ghost" onClick={() => setConfirmDelete(false)}>No</button></div>
            : <button type="button" className="btn rk-btn-ghost text-danger-soft me-auto" onClick={() => setConfirmDelete(true)}><LuTrash2 className="me-1" />Delete</button>)}
          <button type="button" className="btn rk-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn rk-btn-primary" disabled={busy}>
            {busy ? <span className="spinner-border spinner-border-sm me-2" /> : isEdit ? <LuSave className="me-2" /> : <LuPlus className="me-2" />}
            {isEdit ? 'Save Changes' : 'Create Portal'}
          </button>
        </div>
      </form>
    </Modal>
    <SyllabusManagerModal
      show={show && sylOpen}
      onClose={() => setSylOpen(false)}
      rows={sylRows}
      onAdd={addSyllabus}
      onReplace={replaceSyllabus}
      onRemove={removeSyllabus}
      error={sylError}
      setError={setSylError}
    />
    </>
  )
}
