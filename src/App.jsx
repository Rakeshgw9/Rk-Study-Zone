import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ui/Confirm'
import { AuthProvider } from './context/AuthContext'
import { PrefsProvider } from './context/PrefsContext'
import { ThemeProvider } from './context/ThemeContext'
import AdminLayout from './pages/AdminLayout'
import DashboardPage from './pages/DashboardPage'
import HomeRedirect from './pages/HomeRedirect'
import Landing from './pages/Landing'
import PortalsPage from './pages/PortalsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

const BuilderPage = lazy(() => import('./pages/BuilderPage'))
const LessonPage = lazy(() => import('./pages/LessonPage'))
const StudentHome = lazy(() => import('./pages/StudentHome'))
const Loader = () => <div className="page-loader"><span className="spinner-border text-info" /></div>

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <HashRouter>
              <Suspense fallback={<Loader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/home" element={<HomeRedirect />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="portals" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="portals" element={<PortalsPage />} />
                  <Route path="portals/:portalId" element={<LegacyRedirect />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
                <Route path="/admin/builder/:portalId" element={<BuilderPage />} />
                <Route path="/learn" element={<StudentHome />} />
                <Route path="/learn/:portalId" element={<LessonPage />} />
                <Route path="/learn/:portalId/:chapterId" element={<LessonPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </HashRouter>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
      </PrefsProvider>
    </ThemeProvider>
  )
}

function LegacyRedirect() {
  const id = window.location.hash.split('/').pop()
  return <Navigate to={`/admin/builder/${id}`} replace />
}
