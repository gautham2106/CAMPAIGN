import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import MonitorPage from './pages/MonitorPage'
import ConstituencyAdminPage from './pages/ConstituencyAdminPage'
import SuperAdminPage from './pages/SuperAdminPage'

function RoleRouter() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-sm text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-semibold text-gray-900">No profile found</p>
          <p className="text-sm text-gray-500 mt-2">
            Your account exists but no profile is set up. Contact your admin.
          </p>
        </div>
      </div>
    )
  }

  switch (profile.role) {
    case 'super_admin': return <SuperAdminPage />
    case 'constituency_admin': return <ConstituencyAdminPage />
    case 'monitor': return <MonitorPage />
    default: return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Unknown role: {profile.role}</p>
      </div>
    )
  }
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginLoginGuard />} />
          <Route path="/*" element={<RoleRouter />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

// Redirect logged-in users away from login page
function LoginLoginGuard() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <LoginPage />
}
