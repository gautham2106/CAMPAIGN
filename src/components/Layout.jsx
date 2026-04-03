import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_META = {
  super_admin:        { label: 'Super Admin',        color: 'bg-violet-100 text-violet-700 border-violet-200' },
  constituency_admin: { label: 'Const. Admin',       color: 'bg-sky-100 text-sky-700 border-sky-200'         },
  monitor:            { label: 'Monitor',             color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

const NAV_LINKS = {
  super_admin:        [{ path: '/', label: 'Dashboard' }, { path: '/reports', label: 'Reports' }],
  constituency_admin: [{ path: '/', label: 'Dashboard' }, { path: '/reports', label: 'Reports' }],
  monitor:            [{ path: '/', label: 'My Agents' }],
}

function Initials({ name }) {
  if (!name) return <span className="text-xs font-bold">?</span>
  const parts = name.trim().split(' ')
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2)
  return <span className="text-xs font-bold">{initials.toUpperCase()}</span>
}

export default function Layout({ children, title }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const role = profile?.role
  const roleMeta = ROLE_META[role] ?? {}
  const navLinks = NAV_LINKS[role] ?? []

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Top navigation bar ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-14 flex items-center gap-4">
            {/* Brand */}
            <button onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm">
                C
              </div>
              <span className="font-bold text-slate-900 text-sm hidden sm:inline tracking-tight">Campaign Monitor</span>
            </button>

            {/* Nav links — desktop */}
            {navLinks.length > 1 && (
              <nav className="hidden sm:flex items-center gap-0.5 ml-2">
                {navLinks.map(link => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      pathname === link.path
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
            )}

            {/* Page title — mobile only */}
            {title && (
              <span className="sm:hidden text-sm font-semibold text-slate-700 truncate flex-1">{title}</span>
            )}

            {/* Spacer */}
            <div className="flex-1 hidden sm:block" />

            {/* Constituency label */}
            {profile?.constituencies?.name && (
              <span className="hidden md:inline text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {profile.constituencies.name}
              </span>
            )}

            {/* Role badge */}
            {role && (
              <span className={`hidden sm:inline text-xs font-semibold px-2.5 py-1 rounded-full border ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            )}

            {/* Avatar + sign out */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Initials name={profile?.full_name} />
                </div>
                <span className="text-sm font-medium text-slate-700 hidden sm:inline max-w-[120px] truncate">
                  {profile?.full_name}
                </span>
                <svg className="w-3.5 h-3.5 text-slate-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-10 z-20 bg-white rounded-xl border border-slate-200 shadow-lg w-52 py-1 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 truncate">{profile?.full_name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{profile?.email}</p>
                    </div>
                    {/* Mobile nav links */}
                    {navLinks.length > 1 && (
                      <div className="sm:hidden py-1 border-b border-slate-100">
                        {navLinks.map(link => (
                          <button key={link.path} onClick={() => { navigate(link.path); setMenuOpen(false) }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                              pathname === link.path ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {link.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { setMenuOpen(false); signOut() }}
                      className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 font-medium transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page header ── */}
      {title && (
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
