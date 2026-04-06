import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getTodayIST } from '../lib/dateUtils'
import { useAuth } from '../context/AuthContext'

export default function AddContentModal({ constituencies = [], onAdded, onClose }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mediaLink, setMediaLink] = useState('')
  const [allConst, setAllConst] = useState(true)
  const [selectedConsts, setSelectedConsts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleConst(id) {
    setSelectedConsts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allConst && selectedConsts.length === 0) {
      setError('Please select at least one constituency or choose "All Constituencies".')
      return
    }
    setSaving(true)
    setError('')
    const { error } = await supabase.from('daily_content').insert({
      title,
      description: description || null,
      media_link: mediaLink || null,
      content_date: getTodayIST(),
      created_by: user.id,
      target_constituencies: allConst ? null : selectedConsts,
    })
    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      onAdded?.()
      onClose?.()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-950 sticky top-0">
          <h2 className="text-base font-bold text-white">Add Today's Content</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50"
              placeholder="e.g. Morning post — rally announcement"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none bg-slate-50"
              placeholder="What monitors should tell agents about this content…"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Media Link</label>
            <input
              type="url"
              value={mediaLink}
              onChange={e => setMediaLink(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50"
              placeholder="https://drive.google.com/..."
            />
          </div>

          {/* ── Constituency targeting ── */}
          {constituencies.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Send To</p>
                <p className="text-xs text-slate-500 mt-0.5">Choose which constituencies see this content</p>
              </div>

              <div className="p-4 space-y-2">
                {/* All constituencies toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none p-2 rounded-lg hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={allConst}
                    onChange={e => {
                      setAllConst(e.target.checked)
                      if (e.target.checked) setSelectedConsts([])
                    }}
                    className="w-4 h-4 rounded accent-red-600"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">All Constituencies</span>
                    <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Broadcast</span>
                  </div>
                </label>

                {/* Divider */}
                {!allConst && (
                  <>
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400">or select specific</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    <div className="space-y-1">
                      {constituencies.map(c => (
                        <label key={c.id} className={`flex items-center gap-3 cursor-pointer select-none p-2 rounded-lg transition-colors ${
                          selectedConsts.includes(c.id) ? 'bg-red-50 border border-red-200' : 'hover:bg-slate-50 border border-transparent'
                        }`}>
                          <input
                            type="checkbox"
                            checked={selectedConsts.includes(c.id)}
                            onChange={() => toggleConst(c.id)}
                            className="w-4 h-4 rounded accent-red-600"
                          />
                          <span className="text-sm text-slate-800 font-medium">{c.name}</span>
                        </label>
                      ))}
                    </div>

                    {selectedConsts.length > 0 && (
                      <p className="text-xs text-red-600 font-medium pt-1">
                        {selectedConsts.length} constituency{selectedConsts.length !== 1 ? 'ies' : ''} selected
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3.5 py-3">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2.5 rounded-xl text-sm">
              {saving ? 'Adding…' : 'Add Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
