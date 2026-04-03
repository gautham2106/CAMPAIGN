import { useState } from 'react'
import { supabaseAdmin } from '../lib/supabase'

export default function CreateMonitorModal({ constituencyId, onCreated, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!supabaseAdmin) {
      setError('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (authErr) throw authErr

      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name: name,
          email,
          phone: phone.trim() || null,
          role: 'monitor',
          constituency_id: constituencyId,
        })
      if (profileErr) throw profileErr

      onCreated?.()
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-950">
          <h2 className="text-base font-bold text-white">Add Monitor</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Full Name *</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Monitor's full name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Mobile Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="monitor@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Temporary Password *</label>
            <input type="text" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Min 8 characters" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 rounded-xl text-sm">
              {saving ? 'Creating…' : 'Create Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
