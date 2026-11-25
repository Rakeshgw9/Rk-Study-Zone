import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LuArrowRight, LuBookOpen, LuChartColumn, LuChevronLeft, LuChevronRight, LuClipboardList, LuLogOut,
  LuMessageCircle, LuMoon, LuSun, LuTarget, LuX,
} from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import LoginModal from '../components/LoginModal'
import Modal from '../components/Modal'
import { portalVisual } from '../components/portalIcon'
import TeacherBadge from '../components/student/TeacherBadge'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { createdAtOf, updatedAtOf } from '../lib/portalDiscovery'
import { CATEGORIES, listActivePortals } from '../services/portalService'
import { isStaffRole, logout } from '../services/authService'
import { loadStudentData } from '../services/studentService'
import { toMillis } from '../lib/id'
import heroBg from '../assets/hero-bg.jpg'

const FEATURES = [
  { icon: LuBookOpen, title: 'Structured study material', text: 'Units, chapters and bilingual notes written by subject teachers.' },
  { icon: LuClipboardList, title: 'Practice & mock tests', text: 'Chapter-wise MCQs with explanations and instant scoring.' },
  { icon: LuChartColumn, title: 'Progress tracking', text: 'See completion, scores and bookmarks across every course.' },
  { icon: LuMessageCircle, title: 'Ask your teacher', text: 'Live chat while you read, with notifications for replies.' },
]
const STEPS = [
  ['1', 'Pick a course', 'Browse the published courses above — no account needed to look around.'],
  ['2', 'Sign in to learn', 'Create a free account to open lessons, take tests and save progress.'],
  ['3', 'Practice & succeed', 'Resume where you left off and track your growth over time.'],
]
const dateFmt = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

function PortalSlider({ portals, onOpen }) {
  const track = useRef(null)
  const paused = useRef(false)
  const step = useCallback((dir) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector('.lp-card')
    const w = (card?.getBoundingClientRect().width || 300) + 18
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8
    if (dir > 0 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' })
    else el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }, [])
  useEffect(() => {
    if (portals.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => { if (!paused.current && !document.hidden) step(1) }, 4500)
    return () => clearInterval(id)
  }, [portals.length, step])
  return (
    <div className="lp-slider" onMouseEnter={() => { paused.current = true }} onMouseLeave={() => { paused.current = false }} onFocus={() => { paused.current = true }} onBlur={() => { paused.current = false }}>
      <button type="button" className="lp-arrow lp-prev" onClick={() => step(-1)} aria-label="Previous courses"><LuChevronLeft /></button>
      <div className="lp-track" ref={track} role="list">
        {portals.map((p) => {
          const { Icon, tone } = portalVisual(p)
          const cat = CATEGORIES.find((c) => c.value === p.category)?.label
          return (
            <article className="lp-card" role="listitem" key={p.id}>
              <button type="button" className="lp-card-main" onClick={() => onOpen(p)} aria-label={`Open ${p.name}`}>
                <div className={`lp-cover tone-${tone}`}>
                  {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" decoding="async" /> : <Icon />}
                  {cat && <span className="lp-chip">{cat.split(' (')[0]}</span>}
                </div>
                <div className="lp-card-body">
                  <h3>{p.name}</h3>
                  {p.description && <p>{p.description}</p>}
                  <TeacherBadge portal={p} size={26} />
                  <div className="lp-card-foot">
                    <small>Updated {dateFmt(updatedAtOf(p) || createdAtOf(p)) || '—'}</small>
                    <span className="lp-go">View course <LuArrowRight /></span>
                  </div>
                </div>
              </button>
            </article>
          )
        })}
      </div>
      <button type="button" className="lp-arrow lp-next" onClick={() => step(1)} aria-label="Next courses"><LuChevronRight /></button>
    </div>
  )
}

export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [redirectTo, setRedirectTo] = useState(undefined)
  const [portals, setPortals] = useState(null)
  const [resume, setResume] = useState(null)
  const { user } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const staff = isStaffRole(user?.role)

  // Public course list. If the rules do not allow anonymous reads yet, fail quietly and hide the section.
  useEffect(() => {
    let alive = true
    listActivePortals().then((l) => { if (alive) setPortals(l) }).catch(() => { if (alive) setPortals([]) })
    return () => { alive = false }
  }, [])

  // "Continue learning" for a signed-in student: the most recently read course.
  useEffect(() => {
    if (!user || staff || !portals?.length) { setResume(null); return undefined }
    let alive = true
    Promise.all(portals.map(async (p) => ({ p, sd: await loadStudentData(user.uid, p.id) })))
      .then((rows) => {
        if (!alive) return
        let best = null
        rows.forEach(({ p, sd }) => {
          const at = toMillis(sd?.lastReading?.at) || 0
          if (sd?.lastChapterId && (!best || at > best.at)) best = { p, chapterId: sd.lastChapterId, at }
        })
        setResume(best)
      })
      .catch(() => alive && setResume(null))
    return () => { alive = false }
  }, [user, staff, portals])

  const home = () => navigate('/home')
  const start = () => (user ? home() : (setRedirectTo(undefined), setLoginOpen(true)))
  const openPortal = (p) => {
    if (user) return navigate(`/learn/${p.id}`)
    setRedirectTo(`/learn/${p.id}`); setLoginOpen(true)
  }
  const signOut = async () => { try { await logout() } finally { navigate('/', { replace: true }) } }
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="lp" style={{ '--hero-bg': `url(${heroBg})` }}>
      <header className="lp-nav">
        <div className="lp-nav-in">
          <Logo />
          <nav className="lp-nav-links d-none d-md-flex" aria-label="Sections">
            <button type="button" onClick={() => scrollTo('lp-courses')}>Courses</button>
            <button type="button" onClick={() => scrollTo('lp-features')}>Features</button>
            <button type="button" onClick={() => setAboutOpen(true)}>About</button>
          </nav>
          <div className="lp-nav-actions">
            <button type="button" className="lp-icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">{theme === 'dark' ? <LuSun /> : <LuMoon />}</button>
            {user ? (
              <>
                <button type="button" className="lp-btn lp-btn-primary" onClick={home}>{staff ? 'Dashboard' : 'My Courses'}</button>
                <button type="button" className="lp-btn lp-btn-ghost" onClick={signOut}><LuLogOut aria-hidden="true" /> <span className="d-none d-sm-inline">Sign out</span></button>
              </>
            ) : (
              <button type="button" className="lp-btn lp-btn-primary" onClick={() => { setRedirectTo(undefined); setLoginOpen(true) }}>Sign In</button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-in">
            <span className="lp-eyebrow"><LuTarget aria-hidden="true" /> OSSTET · OAVS · Physical Education · Pedagogy · Odia</span>
            <h1 className="lp-title"><span className="t1">LEARN</span> <span className="dot">•</span> <span className="t2">PRACTICE</span> <span className="dot">•</span> <span className="t3">SUCCEED</span></h1>
            <p className="lp-sub">A simple study platform for exam preparation, practice tests and progress tracking.</p>
            <div className="lp-cta">
              <button type="button" className="lp-btn lp-btn-light lp-btn-lg" onClick={start}>{user ? (staff ? 'Open dashboard' : 'Go to My Courses') : 'Get started'} <LuArrowRight aria-hidden="true" /></button>
              <button type="button" className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => scrollTo('lp-courses')}>Browse courses</button>
            </div>
            {portals?.length > 0 && <p className="lp-meta"><b>{portals.length}</b> {portals.length === 1 ? 'course' : 'courses'} available · free to explore</p>}
          </div>
        </section>

        {resume && (
          <section className="lp-section lp-resume-wrap" aria-label="Continue learning">
            <div className="lp-resume">
              <div><small>Continue learning</small><b>{resume.p.name}</b><span>Pick up exactly where you stopped.</span></div>
              <button type="button" className="lp-btn lp-btn-primary" onClick={() => navigate(`/learn/${resume.p.id}/${resume.chapterId}`)}>Resume <LuArrowRight aria-hidden="true" /></button>
            </div>
          </section>
        )}

        <section className="lp-section" id="lp-courses" aria-labelledby="lp-courses-h">
          <div className="lp-head"><h2 id="lp-courses-h">Explore courses</h2><p>Browse every published portal. Sign in to open lessons and track your progress.</p></div>
          {portals === null ? (
            <div className="lp-skel-row" role="status" aria-label="Loading courses">{[0, 1, 2].map((i) => <div className="sk-card" key={i}><span className="sk" style={{ height: 150 }} /><div className="sk-card-body"><span className="sk" style={{ height: 16, width: '70%' }} /><span className="sk" style={{ height: 12, width: '90%' }} /><span className="sk" style={{ height: 12, width: '50%' }} /></div></div>)}</div>
          ) : portals.length > 0 ? (
            <PortalSlider portals={portals} onOpen={openPortal} />
          ) : (
            <div className="lp-empty"><LuBookOpen aria-hidden="true" /><b>Courses will appear here</b><span>Sign in to see the portals available to you.</span></div>
          )}
        </section>

        <section className="lp-section" id="lp-features" aria-labelledby="lp-features-h">
          <div className="lp-head"><h2 id="lp-features-h">Everything you need to prepare</h2><p>Built for focused, exam-oriented study.</p></div>
          <div className="lp-features">
            {FEATURES.map(({ icon: I, title, text }) => <div className="lp-feature" key={title}><span className="lp-feature-ico"><I aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></div>)}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-steps-h">
          <div className="lp-head"><h2 id="lp-steps-h">How it works</h2></div>
          <ol className="lp-steps">
            {STEPS.map(([n, t, d]) => <li key={n}><span className="lp-step-n">{n}</span><b>{t}</b><span>{d}</span></li>)}
          </ol>
        </section>

        {!user && (
          <section className="lp-section">
            <div className="lp-final"><h2>Ready to start your preparation?</h2><p>Create a free account and continue learning from any device.</p><button type="button" className="lp-btn lp-btn-light lp-btn-lg" onClick={start}>Get started <LuArrowRight aria-hidden="true" /></button></div>
          </section>
        )}
      </main>

      <footer className="lp-foot"><span>© {new Date().getFullYear()} RK Study Zone · Learn · Practice · Achieve</span></footer>

      <LoginModal show={loginOpen} onClose={() => setLoginOpen(false)} redirectTo={redirectTo} />

      <Modal show={aboutOpen} onClose={() => setAboutOpen(false)} className="rk-about-modal" labelledBy="about-title">
        <button type="button" className="rk-modal-x" onClick={() => setAboutOpen(false)} aria-label="Close"><LuX /></button>
        <h2 id="about-title" className="rk-login-title mb-2">About <span className="text-accent">RK Study Zone</span></h2>
        <p className="rk-login-sub text-start mb-4">A study platform where teachers create exam portals and students learn, practise and track progress — built for OSSTET, OAVS, Physical Education, Pedagogy, Odia and more.</p>
        <div className="about-grid">
          <div><LuBookOpen /><strong>Study Materials</strong><span>Notes and resources by subject</span></div>
          <div><LuClipboardList /><strong>Practice Tests</strong><span>MCQs and test series</span></div>
          <div><LuChartColumn /><strong>Progress Tracking</strong><span>See growth over time</span></div>
        </div>
      </Modal>
    </div>
  )
}
