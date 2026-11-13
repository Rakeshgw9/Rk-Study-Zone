import { useEffect, useRef, useState } from 'react'
import { LuBookOpen, LuCloudUpload, LuDatabase, LuLayers, LuLock, LuMoon, LuRotateCcw, LuSave, LuSettings, LuSettings2, LuShieldCheck, LuSun, LuTrash2, LuUpload, LuUser, LuUsers } from 'react-icons/lu'
import { useOutletContext } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { usePrefs } from '../context/PrefsContext'
import { useTheme } from '../context/ThemeContext'
import { firebaseProjectId, isFirebaseConfigured } from '../firebase/config'
import { isAdminRole, isStaffRole, resetPassword, roleLabel, updateUserProfile } from '../services/authService'
import { checkMediaStorage } from '../services/mediaService'
import { listUsers, setUserRole } from '../services/userService'

const DETAIL_KEYS = ['phone', 'altEmail', 'institution', 'address', 'city', 'state', 'pincode', 'bio']
const pickDetails = (u) => Object.fromEntries(DETAIL_KEYS.map((k) => [k, u?.[k] || '']))

const ROLES = [
  { v: 'student', l: 'Student' },
  { v: 'teacher', l: 'Teacher' },
  { v: 'admin', l: 'Admin' },
  { v: 'superAdmin', l: 'Super Admin' },
]

export default function SettingsPage() {
  const { user } = useOutletContext()
  const { theme, toggle } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const [name, setName] = useState(user?.name || '')
  const [savingProf, setSavingProf] = useState(false)
  const photoInputRef = useRef(null)
  const admin = isAdminRole(user.role)
  const staff = isStaffRole(user.role)
  const { prefs, setPref, resetPrefs } = usePrefs()
  const [details, setDetails] = useState(() => pickDetails(user))
  const [media, setMedia] = useState(null) // null | 'checking' | result

  useEffect(() => {
    setName(user?.name || '')
  }, [user?.name])

  useEffect(() => {
    setDetails(pickDetails(user))
  }, [user?.phone, user?.altEmail, user?.institution, user?.address, user?.city, user?.state, user?.pincode, user?.bio]) // eslint-disable-line react-hooks/exhaustive-deps

  const runMediaCheck = async () => {
    setMedia('checking')
    setMedia(await checkMediaStorage())
  }
  useEffect(() => { if (isFirebaseConfigured) runMediaCheck() }, [])

  useEffect(() => {
    if (admin)
      listUsers()
        .then(setUsers)
        .catch((e) => {
          console.warn(e)
          setUsers([])
          toast('Could not load users (check Firestore rules).', 'error')
        })
  }, [admin, toast])

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return toast('Only JPG, PNG or WEBP images are allowed.', 'error')
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast('Profile photo must be 5 MB or smaller.', 'error')
    }
    setSavingProf(true)
    try {
      await updateUserProfile({ photoFile: file })
      toast('Profile photo updated!')
    } catch (err) {
      toast(err.message || 'Photo upload failed', 'error')
    } finally {
      setSavingProf(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    if (!user?.photoURL) return
    setSavingProf(true)
    try {
      await updateUserProfile({ photoURL: '' })
      toast('Profile photo removed')
    } catch (err) {
      toast(err.message || 'Could not remove photo', 'error')
    } finally {
      setSavingProf(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast('Please enter your name', 'error')
    if (details.altEmail && !/^\S+@\S+\.\S+$/.test(details.altEmail)) return toast('Please enter a valid alternative email.', 'error')
    if (details.phone && !/^[+\d][\d\s-]{6,18}$/.test(details.phone)) return toast('Please enter a valid phone number.', 'error')
    setSavingProf(true)
    try {
      await updateUserProfile({ name: name.trim(), details })
      toast('Profile updated successfully!')
    } catch (err) {
      toast(err.message || 'Could not update profile', 'error')
    } finally {
      setSavingProf(false)
    }
  }

  const sendReset = async () => {
    try {
      await resetPassword(user.email)
      toast(isFirebaseConfigured ? `Password reset link sent to ${user.email}` : 'Password reset is not available in demo mode.', isFirebaseConfigured ? undefined : 'error')
    } catch (err) {
      toast(err.message || 'Could not send the reset email', 'error')
    }
  }

  const setD = (k) => (e) => setDetails((d) => ({ ...d, [k]: e.target.value }))
  const dirty = name.trim() !== (user.name || '') || DETAIL_KEYS.some((k) => (details[k] || '') !== (user[k] || ''))

  const change = async (u, role) => {
    if (
      u.uid === user.uid &&
      !isAdminRole(role) &&
      !(await confirm({
        title: 'Remove your own admin access?',
        message: 'You will lose access to user management.',
        danger: true,
        confirmText: 'Change role',
      }))
    )
      return
    try {
      await setUserRole(u.uid, role)
      setUsers((l) => l.map((x) => (x.uid === u.uid ? { ...x, role } : x)))
      toast(`${u.name || u.email} is now ${roleLabel(role)}`)
    } catch (e) {
      toast(e.message || 'Could not change role', 'error')
    }
  }

  const list = (users || []).filter(
    (u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><LuSettings /> Settings</h1>
          <p className="page-sub">Your account, profile photo, appearance and platform setup.</p>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="glass-panel p-4 h-100">
            <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuUser /> Profile Details</h2>
            
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="rk-circular-avatar position-relative flex-shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name || ''} className="rk-avatar-img" />
                ) : (
                  <div className="rk-avatar-placeholder"><LuUser className="fs-2" /></div>
                )}
              </div>
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={handlePhotoUpload}
                />
                <div className="d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn ui-btn ui-btn-secondary btn-sm"
                    disabled={savingProf}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <LuUpload /> Change Photo
                  </button>
                  {user.photoURL && (
                    <button
                      type="button"
                      className="btn ui-btn ui-btn-ghost btn-sm text-danger-soft"
                      disabled={savingProf}
                      onClick={handleRemovePhoto}
                    >
                      <LuTrash2 /> Remove
                    </button>
                  )}
                </div>
                <small className="text-muted-soft d-block mt-1">JPG, PNG or WEBP under 5 MB</small>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="mb-3 st-form">
              <div className="row g-2">
                <div className="col-12">
                  <label className="ui-label" htmlFor="st-name">Full Name</label>
                  <input id="st-name" className="ui-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" maxLength={80} />
                </div>
                <div className="col-md-6">
                  <label className="ui-label" htmlFor="st-phone">Phone</label>
                  <input id="st-phone" className="ui-input" type="tel" inputMode="tel" value={details.phone} onChange={setD('phone')} placeholder="+91 98765 43210" maxLength={20} />
                </div>
                <div className="col-md-6">
                  <label className="ui-label" htmlFor="st-alt">Alternative Email</label>
                  <input id="st-alt" className="ui-input" type="email" value={details.altEmail} onChange={setD('altEmail')} placeholder="other@example.com" maxLength={120} />
                </div>
                <div className="col-12">
                  <label className="ui-label" htmlFor="st-inst">School / Institution</label>
                  <input id="st-inst" className="ui-input" value={details.institution} onChange={setD('institution')} placeholder="Where do you teach / study?" maxLength={120} />
                </div>
                <div className="col-12">
                  <label className="ui-label" htmlFor="st-addr">Address</label>
                  <textarea id="st-addr" className="ui-input ui-textarea" rows={2} value={details.address} onChange={setD('address')} placeholder="House / street / village" maxLength={240} />
                </div>
                <div className="col-md-5">
                  <label className="ui-label" htmlFor="st-city">City / District</label>
                  <input id="st-city" className="ui-input" value={details.city} onChange={setD('city')} maxLength={60} />
                </div>
                <div className="col-md-4">
                  <label className="ui-label" htmlFor="st-state">State</label>
                  <input id="st-state" className="ui-input" value={details.state} onChange={setD('state')} maxLength={60} />
                </div>
                <div className="col-md-3">
                  <label className="ui-label" htmlFor="st-pin">PIN Code</label>
                  <input id="st-pin" className="ui-input" inputMode="numeric" value={details.pincode} onChange={setD('pincode')} maxLength={12} />
                </div>
                <div className="col-12">
                  <label className="ui-label" htmlFor="st-bio">About me</label>
                  <textarea id="st-bio" className="ui-input ui-textarea" rows={2} value={details.bio} onChange={setD('bio')} placeholder="A short introduction (optional)" maxLength={400} />
                </div>
              </div>
              <div className="d-flex justify-content-end mt-3">
                <button type="submit" className="btn ui-btn ui-btn-primary btn-sm px-3" disabled={savingProf || !dirty}>
                  <LuSave /> Save Profile
                </button>
              </div>
            </form>

            <dl className="kv">
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Role</dt><dd><span className="role-pill">{roleLabel(user.role)}</span></dd>
            </dl>
            <hr className="side-sep" />
            <div className="d-flex justify-content-between align-items-center">
              <span>Appearance Theme</span>
              <button className="btn ui-btn ui-btn-secondary btn-sm" onClick={toggle}>
                {theme === 'dark' ? <><LuMoon /> Dark</> : <><LuSun /> Light</>}
              </button>
            </div>
          </div>

          <div className="glass-panel p-4 mt-3">
            <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuLock /> Security</h2>
            <p className="small text-muted-soft">Forgot or want to change your password? We will email a secure reset link to <b>{user.email}</b>.</p>
            <button type="button" className="btn ui-btn ui-btn-secondary btn-sm" onClick={sendReset}>Send password reset email</button>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="glass-panel p-4">
            <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuSettings2 /> Appearance &amp; Accessibility</h2>
            <div className="st-row">
              <div><b>Text size</b><small>Makes every page easier to read.</small></div>
              <div className="st-seg" role="group" aria-label="Text size">
                {[['normal', 'A'], ['large', 'A+'], ['xlarge', 'A++']].map(([v, l]) => (
                  <button key={v} type="button" className={prefs.fontScale === v ? 'on' : ''} onClick={() => setPref('fontScale', v)} aria-pressed={prefs.fontScale === v}>{l}</button>
                ))}
              </div>
            </div>
            <Switch label="Reduce animations" hint="Turns off popups / hover motion. Helps older devices run smoothly." checked={prefs.reduceMotion} onChange={(v) => setPref('reduceMotion', v)} />
          </div>

          <div className="glass-panel p-4 mt-3">
            <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuBookOpen /> Learning</h2>
            <Switch label="Auto-complete blocks while reading" hint="A lesson block is marked done after you scroll to its end." checked={prefs.autoComplete} onChange={(v) => setPref('autoComplete', v)} />
            <Switch label="Highlight & pen toolbar" hint="Show the floating teaching toolbar on lesson pages." checked={prefs.teachingToolbar} onChange={(v) => setPref('teachingToolbar', v)} />
            <Switch label="Focus mode" hint="Open lessons with both side panels hidden for more reading space." checked={prefs.focusMode} onChange={(v) => setPref('focusMode', v)} />
          </div>

          {staff && (
            <div className="glass-panel p-4 mt-3">
              <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuLayers /> Builder</h2>
              <div className="st-row">
                <div><b>Autosave delay</b><small>Longer delays save fewer times (faster on slow internet).</small></div>
                <select className="ui-input ui-select" style={{ width: 130 }} value={prefs.autosaveMs} onChange={(e) => setPref('autosaveMs', Number(e.target.value))} aria-label="Autosave delay">
                  <option value={1200}>1.2 seconds</option>
                  <option value={3000}>3 seconds</option>
                  <option value={6000}>6 seconds</option>
                  <option value={12000}>12 seconds</option>
                </select>
              </div>
            </div>
          )}

          <div className="glass-panel p-4 mt-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h6 fw-semibold mb-0 d-flex align-items-center gap-2"><LuCloudUpload /> Media Storage</h2>
              <button type="button" className="btn ui-btn ui-btn-ghost btn-sm" onClick={runMediaCheck} disabled={media === 'checking'}><LuRotateCcw /> Check</button>
            </div>
            <dl className="kv">
              <dt>Images &amp; files</dt>
              <dd>
                {!isFirebaseConfigured ? <span className="pill pill-warn">Local demo (kept in this browser)</span>
                  : media === 'checking' || media === null ? <span className="pill">Checking…</span>
                  : media.configured ? <span className="pill pill-ok">GitHub (live)</span>
                  : <span className="pill pill-warn">Not set up — images are saved inline</span>}
              </dd>
              {media && media !== 'checking' && media.configured && (<><dt>Repository</dt><dd>{media.repo} · {media.branch}</dd></>)}
            </dl>
            <p className="small text-muted-soft mb-0">
              Uploaded photos, lesson images and syllabus files are committed to a GitHub repository (no Firebase Storage needed).
              {isFirebaseConfigured && media && media !== 'checking' && !media.configured && ' To enable it add GITHUB_TOKEN and GITHUB_REPO in Netlify → Environment variables (see MEDIA_SETUP.md).'}
            </p>
          </div>

          <div className="glass-panel p-4 mt-3">
            <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuDatabase /> Data &amp; Firebase</h2>
            <dl className="kv">
              <dt>Mode</dt>
              <dd>
                {isFirebaseConfigured ? (
                  <span className="pill pill-ok">Firebase (live)</span>
                ) : (
                  <span className="pill pill-warn">Local demo (this browser)</span>
                )}
              </dd>
              <dt>Project</dt><dd>{firebaseProjectId || '—'}</dd>
              <dt>Authentication</dt><dd>Email/Password + Google Sign-In</dd>
              <dt>Database</dt><dd>Cloud Firestore (lessons, notes, progress)</dd>
              <dt>Media</dt><dd>GitHub repository (via Netlify function)</dd>
            </dl>
            <p className="small text-muted-soft">
              Draft content is saved in <code>portalContent</code>; students read <code>portalPublished</code> after you press Publish.
            </p>
            <button type="button" className="btn ui-btn ui-btn-ghost btn-sm" onClick={() => { resetPrefs(); toast('Preferences reset to defaults') }}>Reset my preferences</button>
          </div>
        </div>

        {admin && (
          <div className="col-12">
            <div className="glass-panel p-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h2 className="h6 fw-semibold mb-0 d-flex align-items-center gap-2"><LuUsers /> Users & Roles</h2>
                <input
                  className="ui-input"
                  style={{ maxWidth: 260 }}
                  placeholder="Search users…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search users"
                />
              </div>
              {users === null ? (
                <div className="skeleton-row" />
              ) : list.length === 0 ? (
                <p className="text-muted-soft mb-0">No users found.</p>
              ) : (
                <ul className="user-rows">
                  {list.map((u) => (
                    <li key={u.uid}>
                      <span className="avatar">
                        {u.photoURL ? <img src={u.photoURL} alt="" className="avatar-img" /> : <LuUser />}
                      </span>
                      <span className="min-w-0 flex-grow-1">
                        <b>{u.name || '—'}</b>
                        <small>{u.email}</small>
                      </span>
                      <select
                        className="ui-input ui-select"
                        style={{ width: 150 }}
                        value={u.role || 'student'}
                        onChange={(e) => change(u, e.target.value)}
                        aria-label={`Role for ${u.email}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.v} value={r.v}>{r.l}</option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
              <p className="small text-muted-soft mt-3 mb-0 d-flex gap-2">
                <LuShieldCheck className="flex-shrink-0 mt-1" /> Teachers can create and edit their own portals. Admins can manage every portal and user. Students can only learn.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Switch({ label, hint, checked, onChange }) {
  return (
    <label className="st-row st-switch">
      <div><b>{label}</b><small>{hint}</small></div>
      <input type="checkbox" className="rk-toggle" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
