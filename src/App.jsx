import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ui/Confirm'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { PrefsProvider } from './context/PrefsContext'
import { ThemeProvider } from './context/ThemeContext'
import { PageLoader } from './components/ui/Loaders'
import UploadActivityBar from './components/ui/UploadActivityBar'
import HomeRedirect from './pages/HomeRedirect'
import Landing from './pages/Landing'

// Route-level code splitting: the landing page and /learn no longer download the admin screens.
const AdminLayout = lazy(() => import('./pages/AdminLayout'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PortalsPage = lazy(() => import('./pages/PortalsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const BuilderPage = lazy(() => import('./pages/BuilderPage'))
const LessonPage = lazy(() => import('./pages/LessonPage'))
const StudentHome = lazy(() => import('./pages/StudentHome'))
const StudentNotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const AdminNotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.AdminNotificationsPage })))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const Loader = () => <PageLoader />

export default function App() {
  return (
    <ThemeProvider>
      <PrefsProvider>
      <AuthProvider>
        <ToastProvider>
          <NotificationsProvider>
          <ConfirmProvider>
            <HashRouter>
              <UploadActivityBar />
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
                  <Route path="notifications" element={<AdminNotificationsPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="messages/:threadId" element={<MessagesPage />} />
                </Route>
                <Route path="/admin/builder/:portalId" element={<BuilderPage />} />
                <Route path="/notifications" element={<StudentNotificationsPage />} />
                <Route path="/learn" element={<StudentHome />} />
                <Route path="/learn/:portalId" element={<LessonPage />} />
                <Route path="/learn/:portalId/:chapterId" element={<LessonPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </HashRouter>
          </ConfirmProvider>
          </NotificationsProvider>
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
