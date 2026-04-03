import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Subtle red radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/40 via-transparent to-transparent pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header strip — DMK black/red split */}
          <div className="relative px-8 py-7 overflow-hidden" style={{ background: 'linear-gradient(135deg, #18181b 0%, #18181b 50%, #dc2626 50%, #b91c1c 100%)' }}>
            {/* Subtle shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-lg border border-white/20 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #27272a 50%, #ef4444 50%)' }}
              >
                <span className="text-white font-black text-base drop-shadow">D</span>
              </div>
              <div>
                <h1 className="text-white font-bold text-base leading-tight">DMK Namakkal East</h1>
                <p className="text-red-300 text-xs mt-0.5 font-semibold">IT Wing — Campaign Monitor</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <p className="text-sm font-semibold text-slate-800 mb-5">Sign in to your account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Email address
                </label>
                <input
                  type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-slate-50 transition-colors placeholder:text-slate-400"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-slate-50 transition-colors placeholder:text-slate-400 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3.5 py-3">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-red-400 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 mt-1"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
                ) : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500 mt-5">
          DMK Namakkal East IT Wing · Campaign Monitor v2
        </p>
      </div>
    </div>
  )
}
