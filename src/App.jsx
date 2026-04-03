import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import MonitorPage from './pages/MonitorPage'
import ConstituencyAdminPage from './pages/ConstituencyAdminPage'
import SuperAdminPage from './pages/SuperAdminPage'
import ReportsPage from './pages/ReportsPage'

// Loading screen
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white text-xl font-bold mb-4 shadow-lg">C</div>
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    </div>
  )
}

// Guard: only super_admin and constituency_admin can access reports
function ReportsGuard() {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/" replace />
  if (profile.role === 'monitor') return <Navigate to="/" replace />
  return <ReportsPage />
}

function RoleRouter() {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 text-2xl mb-4">⚠️</div>
          <p className="font-bold text-slate-900">No profile found</p>
          <p className="text-sm text-slate-500 mt-2">
            Your account exists but has no profile. Contact your admin to set it up.
          </p>
        </div>
      </div>
    )
  }

  switch (profile.role) {
    case 'super_admin':        return <SuperAdminPage />
    case 'constituency_admin': return <ConstituencyAdminPage />
    case 'monitor':            return <MonitorPage />
    default: return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Unknown role: {profile.role}</p>
      </div>
    )
  }
}

function LoginGuard() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"   element={<LoginGuard />} />
          <Route path="/reports" element={<ReportsGuard />} />
          <Route path="/*"       element={<RoleRouter />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
