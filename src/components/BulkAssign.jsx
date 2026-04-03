import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function BulkAssign({ agents, monitors, constituencyId, onAssigned }) {
  const [fromBooth, setFromBooth] = useState('')
  const [toBooth, setToBooth] = useState('')
  const [monitorId, setMonitorId] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const preview = agents.filter(a => {
    const b = a.booth_number
    if (b == null) return false
    const from = fromBooth !== '' ? parseInt(fromBooth) : null
    const to = toBooth !== '' ? parseInt(toBooth) : null
    if (from !== null && b < from) return false
    if (to !== null && b > to) return false
    return true
  })

  async function handleAssign() {
    if (!monitorId || preview.length === 0) return
    setSaving(true)
    setError('')
    setResult(null)
    try {
      const { error: updateErr, count } = await supabase
        .from('digital_agents')
        .update({ assigned_monitor_id: monitorId })
        .in('id', preview.map(a => a.id))

      if (updateErr) throw updateErr
      setResult(preview.length)
      onAssigned?.()
      setFromBooth('')
      setToBooth('')
      setMonitorId('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select a booth range and assign all agents in that range to a monitor.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From Booth #</label>
          <input
            type="number"
            value={fromBooth}
            onChange={e => setFromBooth(e.target.value)}
            placeholder="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To Booth #</label>
          <input
            type="number"
            value={toBooth}
            onChange={e => setToBooth(e.target.value)}
            placeholder="10"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Assign to Monitor</label>
          <select
            value={monitorId}
            onChange={e => setMonitorId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select monitor…</option>
            {monitors.map(m => (
              <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600">
        {fromBooth === '' && toBooth === ''
          ? `${preview.length} total agents (no booth filter — all will be assigned)`
          : `${preview.length} agents in booth range ${fromBooth || '?'} – ${toBooth || '?'}`}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {result !== null && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {result} agents assigned successfully.
        </div>
      )}

      <button
        onClick={handleAssign}
        disabled={saving || !monitorId || preview.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
      >
        {saving ? 'Assigning…' : `Assign ${preview.length} Agents to Selected Monitor`}
      </button>
    </div>
  )
}
