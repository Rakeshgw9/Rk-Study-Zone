import { useEffect, useRef, useState } from 'react'
import {  LuCheck, LuEye, LuEyeOff, LuLock, LuMail, LuTrash2, LuUpload, LuUser, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { authErrorMessage, login, loginWithGoogle, register, resetPassword } from '../services/authService'
import { isFirebaseConfigured } from '../firebase/config'
import Modal from './Modal'

function CameraIcon() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline-block", verticalAlign: "middle" }}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>); }

const empty = { name: '', email: '', password: '', confirm: '', accountType: 'student' }

/* Colored Google 'G' Logo SVG */
function GoogleGIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

export default function LoginModal({ show, onClose, initialMode = 'login', redirectTo }) {
  const [mode, setMode] = useState(initialMode) // login | register | forgot
  const [form, setForm] = useState(empty)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (show) {
      setMode(initialMode)
      setForm(empty)
      setPhotoFile(null)
      setPhotoPreview('')
      setError('')
      setInfo('')
    }
  }, [show, initialMode])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const switchMode = (m) => {
    setMode(m)
    setError('')
    setInfo('')
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return setError('Only JPG, PNG or WEBP images are allowed.')
    }
    if (file.size > 2 * 1024 * 1024) {
      return setError('Photo must be 2 MB or smaller.')
    }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
    setError('')
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleGoogleSignIn() {
    setError('')
    setInfo('')
    setGoogleBusy(true)
    try {
      await loginWithGoogle(form.accountType || 'student')
      onClose()
      navigate(redirectTo || '/home')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setGoogleBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      return setError('Please enter a valid email address.')
    }

    if (mode === 'forgot') {
      setBusy(true)
      try {
        await resetPassword(form.email)
        setInfo('Password reset link sent! Please check your email inbox.')
      } catch (err) {
        setError(authErrorMessage(err))
      } finally {
        setBusy(false)
      }
      return
    }

    if (form.password.length < 6) {
      return setError('Password should be at least 6 characters.')
    }

    if (mode === 'register') {
      if (!form.name.trim()) return setError('Please enter your full name.')
      if (form.password !== form.confirm) return setError('Passwords do not match.')
    }

    setBusy(true)
    try {
      if (mode === 'register') {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          accountType: form.accountType,
          photoFile,
        })
      } else {
        await login(form.email.trim(), form.password)
      }
      onClose()
      navigate(redirectTo || '/home')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'register' ? (
      <>Create <span className="text-accent">Account</span></>
    ) : mode === 'forgot' ? (
      <>Reset <span className="text-accent">Password</span></>
    ) : (
      <>Welcome <span className="text-accent">Back</span></>
    )
  const subtitle =
    mode === 'register'
      ? 'Join RK Study Zone as a student or teacher'
      : mode === 'forgot'
      ? 'We will email you a password reset link'
      : 'Sign in to continue'

  return (
    <Modal show={show} onClose={onClose} className="rk-login-modal" labelledBy="login-title">
      <button type="button" className="rk-modal-x" onClick={onClose} aria-label="Close">
        <LuX />
      </button>

      <div className="text-center mb-3">
        <img src="./logo.png" alt="RK" className="rk-login-logo" />
        <h2 id="login-title" className="rk-login-title">{title}</h2>
        <p className="rk-login-sub">{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {mode === 'register' && (
          <div className="rk-profile-photo-picker mb-3 text-center">
            <div className="rk-avatar-preview-wrap position-relative mx-auto mb-2">
              <div className="rk-circular-avatar">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="rk-avatar-img" />
                ) : (
                  <div className="rk-avatar-placeholder">
                    <LuUser className="fs-2" />
                  </div>
                )}
              </div>
              <button
                type="button"
                className="rk-avatar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Choose photo"
                aria-label="Upload photo"
              >
                <CameraIcon />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handlePhotoSelect}
            />
            <div className="small text-soft">
              <b>Profile Photo (Optional)</b>
              <br />
              <span className="text-muted-soft" style={{ fontSize: '0.8rem' }}>Upload a photo (JPG, PNG, max 2MB)</span>
            </div>
            {photoPreview && (
              <div className="d-flex gap-2 justify-content-center mt-2">
                <button
                  type="button"
                  className="btn ui-btn ui-btn-ghost btn-sm py-0 px-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <LuUpload /> Change
                </button>
                <button
                  type="button"
                  className="btn ui-btn ui-btn-ghost btn-sm text-danger-soft py-0 px-2"
                  onClick={removePhoto}
                >
                  <LuTrash2 /> Remove
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'register' && (
          <div className="mb-3">
            <label className="rk-label" htmlFor="lg-name">Full Name</label>
            <div className="rk-input-group">
              <LuUser className="rk-input-icon" />
              <input
                id="lg-name"
                className="rk-input"
                placeholder="Enter your full name"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
              />
            </div>
          </div>
        )}

        {mode === 'register' && (
          <div className="mb-3">
            <span className="rk-label d-block">I am a</span>
            <div className="acct-type" role="radiogroup" aria-label="Account type">
              {[
                ['student', 'Student', 'Learn & practice'],
                ['teacher', 'Teacher', 'Create portals'],
              ].map(([v, l, d]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={form.accountType === v}
                  className={form.accountType === v ? 'on' : ''}
                  onClick={() => setForm({ ...form, accountType: v })}
                >
                  <b>{l}</b>
                  <small>{d}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="rk-label" htmlFor="lg-email">Email Address</label>
          <div className="rk-input-group">
            <LuMail className="rk-input-icon" />
            <input
              id="lg-email"
              type="email"
              className="rk-input"
              placeholder="Enter your email"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="mb-2">
            <label className="rk-label" htmlFor="lg-pass">Password</label>
            <div className="rk-input-group">
              <LuLock className="rk-input-icon" />
              <input
                id="lg-pass"
                type={showPw ? 'text' : 'password'}
                className="rk-input"
                placeholder="Enter your password"
                value={form.password}
                onChange={set('password')}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="rk-input-action"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
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
              <input
                id="lg-confirm"
                type={showConfirmPw ? 'text' : 'password'}
                className="rk-input"
                placeholder="Re-enter your password"
                value={form.confirm}
                onChange={set('confirm')}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="rk-input-action"
                onClick={() => setShowConfirmPw((s) => !s)}
                aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
              >
                {showConfirmPw ? <LuEyeOff /> : <LuEye />}
              </button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          <div className="text-end mb-3">
            <button type="button" className="rk-link" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
          </div>
        )}

        {error && <div className="rk-alert rk-alert-error mt-2">{error}</div>}
        {info && <div className="rk-alert rk-alert-info mt-2">{info}</div>}

        <button type="submit" className="btn rk-btn-primary w-100 mt-3" disabled={busy || googleBusy}>
          {busy && <span className="spinner-border spinner-border-sm me-2" />}
          {mode === 'register' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
        </button>

        {mode !== 'forgot' && (
          <>
            <div className="rk-or">
              <span>or</span>
            </div>

            <button
              type="button"
              className="btn rk-google-btn w-100"
              onClick={handleGoogleSignIn}
              disabled={busy || googleBusy}
            >
              {googleBusy ? (
                <span className="spinner-border spinner-border-sm me-2" />
              ) : (
                <span className="me-2 d-inline-flex align-items-center">
                  <GoogleGIcon size={18} />
                </span>
              )}
              Continue with Google
            </button>
          </>
        )}

        <p className="text-center mb-0 mt-3 rk-switch">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="rk-link" onClick={() => switchMode('register')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="rk-link" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </>
          )}
        </p>

        {!isFirebaseConfigured && (
          <p className="rk-demo-note mt-2">
            Demo mode active: accounts and photos persist in local browser storage. Add Firebase keys to <code>.env</code> for live cloud accounts.
          </p>
        )}
      </form>
    </Modal>
  )
}
