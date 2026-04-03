import { useAuth } from '../context/AuthContext'

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  constituency_admin: 'Constituency Admin',
  monitor: 'Monitor',
}

const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-700',
  constituency_admin: 'bg-blue-100 text-blue-700',
  monitor: 'bg-green-100 text-green-700',
}

export default function Layout({ children, title }) {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <span className="font-bold text-gray-900 hidden sm:inline">Campaign Monitor</span>
            {title && (
              <>
                <span className="text-gray-300 hidden sm:inline">/</span>
                <span className="font-medium text-gray-700 text-sm">{title}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-800">{profile?.full_name}</p>
              <p className="text-xs text-gray-500">{profile?.constituencies?.name}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[profile?.role]}`}>
              {ROLE_LABELS[profile?.role]}
            </span>
            <button
              onClick={signOut}
              className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
