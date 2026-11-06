import { useEffect, useState } from 'react'
import { LuEye, LuEyeOff, LuLock, LuMail, LuUser, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { authErrorMessage, login, register, resetPassword } from '../services/authService'
import { isFirebaseConfigured } from '../firebase/config'
import Modal from './Modal'

const empty = { name: '', email: '', password: '', confirm: '', accountType: 'student' }

export default function LoginModal({ show, onClose, initialMode = 'login', redirectTo }) {
  const [mode, setMode] = useState(initialMode) // login | register | forgot
  const [form, setForm] = useState(empty)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const navigate = useNavigate()

  useEffect(() => { if (show) { setMode(initialMode); setForm(empty); setError(''); setInfo('') } }, [show, initialMode])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const switchMode = (m) => { setMode(m); setError(''); setInfo('') }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Please enter a valid email address.')
    if (mode === 'forgot') {
      setBusy(true)
      try { await resetPassword(form.email); setInfo('Password reset link sent. Please check your email.') }
      catch (err) { setError(authErrorMessage(err)) }
      finally { setBusy(false) }
      return
    }
    if (form.password.length < 6) return setError('Password should be at least 6 characters.')
    if (mode === 'register') {
      if (!form.name.trim()) return setError('Please enter your full name.')
      if (form.password !== form.confirm) return setError('Passwords do not match.')
    }
    setBusy(true)
    try {
      if (mode === 'register') await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, accountType: form.accountType })
      else await login(form.email.trim(), form.password)
      onClose()
      navigate(redirectTo || '/home')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally { setBusy(false) }
  }

  const title = mode === 'register' ? <>Create <span className="text-accent">Account</span></>
    : mode === 'forgot' ? <>Reset <span className="text-accent">Password</span></>
    : <>Welcome <span className="text-accent">Back</span></>
  const subtitle = mode === 'register' ? 'Join RK Study Zone as a student or teacher'
    : mode === 'forgot' ? 'We will email you a reset link' : 'Sign in to continue'

  return (
    <Modal show={show} onClose={onClose} className="rk-login-modal" labelledBy="login-title">
      <button type="button" className="rk-modal-x" onClick={onClose} aria-label="Close"><LuX /></button>
      <div className="text-center mb-3">
        <img src="./logo.png" alt="RK" className="rk-login-logo" />
        <h2 id="login-title" className="rk-login-title">{title}</h2>
        <p className="rk-login-sub">{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {mode === 'register' && (
          <div className="mb-3">
            <label className="rk-label" htmlFor="lg-name">Full Name</label>
            <div className="rk-input-group">
              <LuUser className="rk-input-icon" />
              <input id="lg-name" className="rk-input" placeholder="Enter your full name" value={form.name} onChange={set('name')} autoComplete="name" />
            </div>
          </div>
        )}

        {mode === 'register' && (
          <div className="mb-3">
            <span className="rk-label d-block">I am a</span>
            <div className="acct-type" role="radiogroup" aria-label="Account type">
              {[['student', 'Student', 'Learn & practice'], ['teacher', 'Teacher', 'Create portals']].map(([v, l, d]) => (
                <button key={v} type="button" role="radio" aria-checked={form.accountType === v} className={form.accountType === v ? 'on' : ''} onClick={() => setForm({ ...form, accountType: v })}>
                  <b>{l}</b><small>{d}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="rk-label" htmlFor="lg-email">Email Address</label>
          <div className="rk-input-group">
            <LuMail className="rk-input-icon" />
            <input id="lg-email" type="email" className="rk-input" placeholder="Enter your email" value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="mb-2">
            <label className="rk-label" htmlFor="lg-pass">Password</label>
            <div className="rk-input-group">
              <LuLock className="rk-input-icon" />
              <input id="lg-pass" type={showPw ? 'text' : 'password'} className="rk-input" placeholder="Enter your password" value={form.password} onChange={set('password')} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
              <button type="button" className="rk-input-action" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <LuEyeOff /> : <LuEye />}
              </button>
            </div>
          </div>
        )}

        {mode === 'register' && (
          <div className="mb-2 mt-3">
            <label className="rk-label" htmlFor="lg-confirm">Confirm Password</label>
            <div className="rk-input-group">
              <LuLock className="rk-input-icon" />
              <input id="lg-confirm" type={showPw ? 'text' : 'password'} className="rk-input" placeholder="Re-enter your password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div className="text-end mb-3">
            <button type="button" className="rk-link" onClick={() => switchMode('forgot')}>Forgot password?</button>
          </div>
        )}

        {error && <div className="rk-alert rk-alert-error mt-2">{error}</div>}
        {info && <div className="rk-alert rk-alert-info mt-2">{info}</div>}

        <button type="submit" className="btn rk-btn-primary w-100 mt-3" disabled={busy}>
          {busy && <span className="spinner-border spinner-border-sm me-2" />}
          {mode === 'register' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
        </button>

        <div className="rk-or"><span>or</span></div>

        <p className="text-center mb-0 rk-switch">
          {mode === 'login' ? <>New here? <button type="button" className="rk-link" onClick={() => switchMode('register')}>Create an account</button></>
            : <>Already have an account? <button type="button" className="rk-link" onClick={() => switchMode('login')}>Sign in</button></>}
        </p>
        {!isFirebaseConfigured && (
          <p className="rk-demo-note">Demo mode: add Firebase keys in <code>.env</code> to use real accounts.</p>
        )}
      </form>
    </Modal>
  )
}
