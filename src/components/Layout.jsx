import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_META = {
  super_admin:        { label: 'Super Admin',  color: 'bg-red-900/40 text-red-400 border-red-800' },
  constituency_admin: { label: 'Const. Admin', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  monitor:            { label: 'Monitor',      color: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
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
      <header className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-20 shadow-md print:hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-14 flex items-center gap-4">
            {/* Brand */}
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 shrink-0">
              {/* DMK flag-style logo: left black, right red */}
              <div
                className="w-7 h-7 rounded-lg overflow-hidden shrink-0 shadow-sm flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #18181b 50%, #dc2626 50%)' }}
              >
                <span className="text-white text-xs font-black drop-shadow">D</span>
              </div>
              <span className="font-bold text-white text-sm hidden sm:inline tracking-tight leading-tight">
                DMK Namakkal East<br />
                <span className="text-red-400 text-xs font-semibold">IT Wing</span>
              </span>
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
                        ? 'bg-red-600/20 text-red-400'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
            )}

            {/* Page title — mobile only */}
            {title && (
              <span className="sm:hidden text-sm font-semibold text-white/80 truncate flex-1">{title}</span>
            )}

            {/* Spacer */}
            <div className="flex-1 hidden sm:block" />

            {/* Constituency label */}
            {profile?.constituencies?.name && (
              <span className="hidden md:inline text-xs font-medium text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700">
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
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-red-600 border border-red-500 flex items-center justify-center text-white">
                  <Initials name={profile?.full_name} />
                </div>
                <span className="text-sm font-medium text-white/80 hidden sm:inline max-w-[120px] truncate">
                  {profile?.full_name}
                </span>
                <svg className="w-3.5 h-3.5 text-zinc-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                              pathname === link.path ? 'text-red-600 font-medium bg-red-50' : 'text-slate-600 hover:bg-slate-50'
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
        <div className="bg-white border-b border-slate-100 print:hidden">
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
