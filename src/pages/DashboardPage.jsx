import { useMemo, useRef, useState } from 'react'
import { LuArrowRight,  LuCheck, LuHouse, LuPencil, LuTrash2, LuUpload, LuUser } from 'react-icons/lu'
import { Link, useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import StatCards from '../components/StatCards'
import { useToast } from '../components/Toast'
import { roleLabel, updateUserProfile } from '../services/authService'
import { computeStats } from '../services/portalService'

function CameraIcon() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>); }

export default function DashboardPage() {
  const { user, portals, enrollStats } = useOutletContext()
  const toast = useToast()
  const stats = useMemo(
    () =>
      enrollStats
        ? {
            ...computeStats(portals),
            totalStudents: enrollStats.totalStudents,
            newEnrollments: enrollStats.newEnrollments,
            studentLogins: enrollStats.studentLogins,
          }
        : computeStats(portals),
    [portals, enrollStats]
  )

  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL || '')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const first = (user?.name || 'Teacher').split(' ')[0]

  const openEdit = () => {
    setName(user?.name || '')
    setPhotoPreview(user?.photoURL || '')
    setPhotoFile(null)
    setEditOpen(true)
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return toast('Only JPG, PNG or WEBP images are allowed.', 'error')
    }
    if (file.size > 2 * 1024 * 1024) {
      return toast('Photo must be 2 MB or smaller.', 'error')
    }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast('Please enter your name', 'error')
    setBusy(true)
    try {
      await updateUserProfile({
        name: name.trim(),
        photoURL: photoFile ? undefined : photoPreview ? photoPreview : '',
        photoFile,
      })
      toast('Profile updated successfully!')
      setEditOpen(false)
    } catch (err) {
      toast(err.message || 'Could not update profile', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><LuHouse /> Dashboard</h1>
          <p className="page-sub">Welcome back, {first}. Here is your learning and portal overview.</p>
        </div>
      </div>

      {/* Dashboard Profile Card */}
      <div className="glass-panel p-4 mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="rk-circular-avatar-lg">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.name || 'User'} className="rk-avatar-img" />
              ) : (
                <div className="rk-avatar-placeholder-lg"><LuUser /></div>
              )}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="h4 mb-0 fw-bold">{user?.name || 'Administrator'}</h2>
                <span className="role-pill">{roleLabel(user?.role)}</span>
              </div>
              <p className="text-muted-soft mb-0 small mt-1">{user?.email}</p>
            </div>
          </div>
          <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={openEdit}>
            <LuPencil /> Edit Profile
          </button>
        </div>
      </div>

      <StatCards stats={stats} />

      <div className="glass-panel p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h5 mb-0 fw-semibold">Recent Portals</h2>
          <Link to="/admin/portals" className="rk-link">View all <LuArrowRight /></Link>
        </div>
        {portals.length === 0 ? (
          <p className="text-muted-soft mb-0">No portals yet. <Link to="/admin/portals" className="rk-link">Create your first portal</Link>.</p>
        ) : (
          <ul className="list-unstyled mb-0 recent-list">
            {portals.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link to={`/admin/builder/${p.id}`}>{p.name}</Link>
                <span className={`status-badge ${p.status === 'active' ? 'is-active' : 'is-draft'}`}>
                  {p.status === 'active' ? 'Active' : 'Draft'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal show={editOpen} onClose={() => setEditOpen(false)} className="ui-modal ui-modal-md" labelledBy="edit-prof-title">
        <div className="ui-modal-head">
          <span className="ui-modal-icon"><LuUser /></span>
          <div className="flex-grow-1">
            <h2 id="edit-prof-title">Edit Profile</h2>
            <p>Update your personal information and profile picture.</p>
          </div>
          <button className="ui-x" onClick={() => setEditOpen(false)} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSaveProfile}>
          <div className="ui-modal-body">
            <div className="text-center mb-4">
              <div className="rk-avatar-preview-wrap position-relative mx-auto mb-2">
                <div className="rk-circular-avatar">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="rk-avatar-img" />
                  ) : (
                    <div className="rk-avatar-placeholder"><LuUser className="fs-2" /></div>
                  )}
                </div>
                <button
                  type="button"
                  className="rk-avatar-upload-btn"
                  onClick={() => fileRef.current?.click()}
                  title="Upload new photo"
                  aria-label="Upload photo"
                >
                  <CameraIcon />
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={handlePhotoSelect}
              />
              <div className="d-flex gap-2 justify-content-center">
                <button
                  type="button"
                  className="btn ui-btn ui-btn-ghost btn-sm py-0 px-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <LuUpload /> Change Photo
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    className="btn ui-btn ui-btn-ghost btn-sm text-danger-soft py-0 px-2"
                    onClick={removePhoto}
                  >
                    <LuTrash2 /> Remove Photo
                  </button>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="ui-label" htmlFor="edit-name">Full Name</label>
              <input
                id="edit-name"
                className="ui-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            <div className="mb-2">
              <label className="ui-label">Email Address</label>
              <input className="ui-input" value={user?.email || ''} disabled readOnly style={{ opacity: 0.7 }} />
              <small className="text-muted-soft">Email address is managed through your authentication provider.</small>
            </div>
          </div>
          <div className="ui-modal-foot">
            <button type="button" className="btn ui-btn ui-btn-secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn ui-btn ui-btn-primary" disabled={busy}>
              {busy ? <span className="spinner-border spinner-border-sm me-2" /> : <LuCheck className="me-1" />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
