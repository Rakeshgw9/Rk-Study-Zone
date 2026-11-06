import { useEffect, useState } from 'react'
import { LuDatabase, LuMoon, LuSettings, LuShieldCheck, LuSun, LuUser, LuUsers } from 'react-icons/lu'
import { useOutletContext } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useTheme } from '../context/ThemeContext'
import { firebaseProjectId, isFirebaseConfigured, storage } from '../firebase/config'
import { isAdminRole, roleLabel } from '../services/authService'
import { listUsers, setUserRole } from '../services/userService'

const ROLES = [{ v: 'student', l: 'Student' }, { v: 'teacher', l: 'Teacher' }, { v: 'admin', l: 'Admin' }, { v: 'superAdmin', l: 'Super Admin' }]

export default function SettingsPage() {
  const { user } = useOutletContext()
  const { theme, toggle } = useTheme()
  const toast = useToast()
  const confirm = useConfirm()
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const admin = isAdminRole(user.role)

  useEffect(() => { if (admin) listUsers().then(setUsers).catch((e) => { console.warn(e); setUsers([]); toast('Could not load users (check Firestore rules).', 'error') }) }, [admin, toast])

  const change = async (u, role) => {
    if (u.uid === user.uid && !isAdminRole(role) && !(await confirm({ title: 'Remove your own admin access?', message: 'You will lose access to user management.', danger: true, confirmText: 'Change role' }))) return
    try { await setUserRole(u.uid, role); setUsers((l) => l.map((x) => (x.uid === u.uid ? { ...x, role } : x))); toast(`${u.name || u.email} is now ${roleLabel(role)}`) } catch (e) { toast(e.message || 'Could not change role', 'error') }
  }
  const list = (users || []).filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="page-head"><div><h1 className="page-title"><LuSettings /> Settings</h1><p className="page-sub">Your account, appearance and platform setup.</p></div></div>
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="glass-panel p-4 h-100">
            <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuUser /> Profile</h2>
            <dl className="kv"><dt>Name</dt><dd>{user.name || '—'}</dd><dt>Email</dt><dd>{user.email}</dd><dt>Role</dt><dd><span className="role-pill">{roleLabel(user.role)}</span></dd></dl>
            <hr className="side-sep" />
            <div className="d-flex justify-content-between align-items-center"><span>Theme</span><button className="btn ui-btn ui-btn-secondary btn-sm" onClick={toggle}>{theme === 'dark' ? <><LuMoon /> Dark</> : <><LuSun /> Light</>}</button></div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="glass-panel p-4 h-100">
            <h2 className="h6 fw-semibold mb-3 d-flex align-items-center gap-2"><LuDatabase /> Data & Firebase</h2>
            <dl className="kv">
              <dt>Mode</dt><dd>{isFirebaseConfigured ? <span className="pill pill-ok">Firebase (live)</span> : <span className="pill pill-warn">Local demo (this browser)</span>}</dd>
              <dt>Project</dt><dd>{firebaseProjectId || '—'}</dd>
              <dt>Images</dt><dd>{isFirebaseConfigured && storage ? 'Firebase Storage (falls back to inline images if Storage is not enabled)' : 'Inline compressed images'}</dd>
            </dl>
            <p className="small text-muted-soft mb-0">Draft content is saved in <code>portalContent</code>; students read <code>portalPublished</code> after you press Publish.</p>
          </div>
        </div>
        {admin && (
          <div className="col-12">
            <div className="glass-panel p-4">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h2 className="h6 fw-semibold mb-0 d-flex align-items-center gap-2"><LuUsers /> Users & Roles</h2>
                <input className="ui-input" style={{ maxWidth: 260 }} placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
              </div>
              {users === null ? <div className="skeleton-row" /> : list.length === 0 ? <p className="text-muted-soft mb-0">No users found.</p> : (
                <ul className="user-rows">
                  {list.map((u) => (
                    <li key={u.uid}>
                      <span className="avatar"><LuUser /></span>
                      <span className="min-w-0 flex-grow-1"><b>{u.name || '—'}</b><small>{u.email}</small></span>
                      <select className="ui-input ui-select" style={{ width: 150 }} value={u.role || 'student'} onChange={(e) => change(u, e.target.value)} aria-label={`Role for ${u.email}`}>
                        {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
              <p className="small text-muted-soft mt-3 mb-0 d-flex gap-2"><LuShieldCheck className="flex-shrink-0 mt-1" /> Teachers can create and edit their own portals. Admins can manage every portal and user. Students can only learn.</p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
