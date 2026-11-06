import { useState } from 'react'
import { LuBookOpen, LuChartColumn, LuClipboardList, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import LoginModal from '../components/LoginModal'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { isStaffRole } from '../services/authService'
import heroBg from '../assets/hero-bg.jpg'

export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const start = () => (user ? navigate('/home') : setLoginOpen(true))

  return (
    <div className="landing" style={{ '--hero-bg': `url(${heroBg})` }}>
      <header className="landing-nav container-xl">
        <Logo />
        <nav className="d-flex align-items-center gap-3 gap-sm-4">
          <button className="landing-link" onClick={() => setAboutOpen(true)}>About</button>
          {user
            ? <button className="btn rk-btn-navy" onClick={() => navigate('/home')}>{isStaffRole(user.role) ? 'Dashboard' : 'My Courses'}</button>
            : <button className="btn rk-btn-navy" onClick={() => setLoginOpen(true)}>Sign In</button>}
        </nav>
      </header>

      <main className="landing-hero">
        <h1 className="hero-title">
          <span className="t1">LEARN</span> <span className="dot">•</span> <span className="t2">PRACTICE</span> <span className="dot">•</span> <span className="t3">SUCCEED</span>
        </h1>
        <p className="hero-sub">A Simple Study Platform For Exam Preparation,<br className="d-none d-sm-inline" /> Practice Tests And Progress Tracking.</p>
        <button className="btn hero-cta" onClick={start}>GET STARTED</button>
      </main>

      <LoginModal show={loginOpen} onClose={() => setLoginOpen(false)} />

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
