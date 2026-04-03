import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import CSVImport from '../components/CSVImport'
import BulkAssign from '../components/BulkAssign'
import CreateMonitorModal from '../components/CreateMonitorModal'
import MiniCalendar from '../components/MiniCalendar'

function AddAgentModal({ constituencyId, onAdded, onClose }) {
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [booth, setBooth] = useState('')
  const [phone, setPhone] = useState('')
  const [fbUrl, setFbUrl] = useState('')
  const [igUrl, setIgUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('digital_agents').insert({
      name: name.trim(),
      gender: gender || null,
      booth_number: booth ? parseInt(booth) : null,
      phone: phone.trim() || null,
      fb_url: fbUrl.trim() || null,
      ig_url: igUrl.trim() || null,
      constituency_id: constituencyId,
    })
    if (error) { setError(error.message); setSaving(false) }
    else { onAdded?.(); onClose?.() }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-950">
          <h2 className="text-base font-bold text-white">Add Agent</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Full Name *</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Agent's full name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Booth #</label>
              <input type="number" value={booth} onChange={e => setBooth(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. 42" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Facebook URL</label>
              <input type="url" value={fbUrl} onChange={e => setFbUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="https://fb.com/…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Instagram URL</label>
              <input type="url" value={igUrl} onChange={e => setIgUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="https://instagram.com/…" />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2 rounded-lg text-sm">
              {saving ? 'Adding…' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const TODAY = new Date().toISOString().split('T')[0]
const TABS = ['Overview', 'Agents', 'Monitors', 'Import']
const PLATFORMS = ['whatsapp', 'facebook', 'instagram']
const P_LABEL = { whatsapp: 'WA', facebook: 'FB', instagram: 'IG' }

// Returns true if agent has all 3 platforms checked for ALL content on a date
function isAgentFullyDone(agentId, contentIds, logMap) {
  return contentIds.every(cid =>
    PLATFORMS.every(p => logMap[agentId]?.[cid]?.[p]?.is_checked === true)
  )
}

function pct(num, den) {
  if (!den) return 0
  return Math.round(num / den * 100)
}

function PlatformBar({ value }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-400' : 'bg-red-400'
  const text = value >= 80 ? 'text-green-700' : value >= 50 ? 'text-yellow-700' : 'text-red-600'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${text}`}>{value}%</span>
    </div>
  )
}

export default function ConstituencyAdminPage() {
  const { profile } = useAuth()
  const constituencyId = profile?.constituency_id

  const [activeTab, setActiveTab] = useState('Overview')
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [showCalendar, setShowCalendar] = useState(false)
  const [allContentDates, setAllContentDates] = useState([])

  const [monitors, setMonitors] = useState([])
  const [agents, setAgents] = useState([])

  // Reassignment state
  const [reassignFrom, setReassignFrom] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [reassignResult, setReassignResult] = useState(null)
  const [contents, setContents] = useState([])
  // logMap: { [agent_id]: { [content_id]: { [platform]: log } } }
  const [logMap, setLogMap] = useState({})

  const [loading, setLoading] = useState(true)
  const [showCreateMonitor, setShowCreateMonitor] = useState(false)
  const [drillMonitor, setDrillMonitor] = useState(null) // { monitor, agents, contentIds }
  const [error, setError] = useState('')

  // Performance data: last 30 days per monitor and per agent
  const [perfData, setPerfData] = useState(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [showPerf, setShowPerf] = useState(false)

  // CRUD state
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [deletingAgentId, setDeletingAgentId] = useState(null)
  const [deletingMonitorId, setDeletingMonitorId] = useState(null)

  // Agents tab: search + filter + range select + bulk + inline edit
  const [agentSearch, setAgentSearch] = useState('')
  const [filterMonitorId, setFilterMonitorId] = useState('') // '' = all, 'unassigned' = no monitor
  const [selectedAgentIds, setSelectedAgentIds] = useState(new Set())
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [reassignTargetId, setReassignTargetId] = useState('')
  const [bulkReassigning, setBulkReassigning] = useState(false)
  // confirmAction: null | { type: 'assign'|'delete', monitorId?, monitorName?, count }
  const [confirmAction, setConfirmAction] = useState(null)
  const [editingAgentId, setEditingAgentId] = useState(null)
  const [editAgentValues, setEditAgentValues] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (constituencyId) {
      loadBase()
      loadAllContentDates()
    }
  }, [constituencyId])

  useEffect(() => {
    if (constituencyId && agents.length > 0) loadDateData()
  }, [selectedDate, agents])

  async function loadAllContentDates() {
    const { data } = await supabase.from('daily_content').select('content_date')
    if (data) setAllContentDates([...new Set(data.map(r => r.content_date))])
  }

  async function loadBase() {
    setLoading(true)
    setError('')
    try {
      const [monitorsRes, agentsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'monitor').eq('constituency_id', constituencyId).order('full_name'),
        supabase.from('digital_agents').select('*').eq('constituency_id', constituencyId).order('booth_number'),
      ])
      if (monitorsRes.error) throw monitorsRes.error
      if (agentsRes.error) throw agentsRes.error
      setMonitors(monitorsRes.data ?? [])
      setAgents(agentsRes.data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDateData() {
    setError('')
    try {
      let contentQuery = supabase
        .from('daily_content')
        .select('*')
        .eq('content_date', selectedDate)
        .order('created_at')
      if (constituencyId) {
        contentQuery = contentQuery.or(`target_constituencies.is.null,target_constituencies.cs.{"${constituencyId}"}`)
      }
      const { data: dateContents, error: ce } = await contentQuery
      if (ce) throw ce
      setContents(dateContents ?? [])

      if (dateContents?.length && agents.length) {
        const { data: logs, error: le } = await supabase
          .from('compliance_logs')
          .select('*')
          .in('content_id', dateContents.map(c => c.id))
          .in('agent_id', agents.map(a => a.id))
        if (le) throw le
        const map = {}
        for (const log of logs ?? []) {
          if (!map[log.agent_id]) map[log.agent_id] = {}
          if (!map[log.agent_id][log.content_id]) map[log.agent_id][log.content_id] = {}
          map[log.agent_id][log.content_id][log.platform] = log
        }
        setLogMap(map)
      } else {
        setLogMap({})
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function loadPerformance() {
    if (perfData || agents.length === 0) return
    setPerfLoading(true)
    try {
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const fromDate = from.toISOString().split('T')[0]

      const { data: recentContent } = await supabase
        .from('daily_content')
        .select('id')
        .gte('content_date', fromDate)

      const contentIds = recentContent?.map(c => c.id) ?? []
      if (!contentIds.length) { setPerfData({ monitors: {}, agents: {} }); return }

      const { data: logs } = await supabase
        .from('compliance_logs')
        .select('agent_id, content_id, platform, is_checked')
        .in('content_id', contentIds)
        .in('agent_id', agents.map(a => a.id))
        .eq('is_checked', true)

      // Per agent: count fully posted content (all 3 checked)
      const agentMap = {} // { [agent_id]: { [content_id]: platform_count } }
      for (const log of logs ?? []) {
        if (!agentMap[log.agent_id]) agentMap[log.agent_id] = {}
        agentMap[log.agent_id][log.content_id] = (agentMap[log.agent_id][log.content_id] ?? 0) + 1
      }

      const agentPerf = {}
      for (const a of agents) {
        const map = agentMap[a.id] ?? {}
        const fullyPosted = Object.values(map).filter(c => c === 3).length
        agentPerf[a.id] = { fullyPosted, total: contentIds.length, rate: pct(fullyPosted, contentIds.length) }
      }

      // Per monitor: aggregate their agents' performance
      const monitorPerf = {}
      for (const m of monitors) {
        const mAgents = agents.filter(a => a.assigned_monitor_id === m.id)
        if (!mAgents.length) { monitorPerf[m.id] = { avg: 0, top: 0, low: 0 }; continue }
        const rates = mAgents.map(a => agentPerf[a.id]?.rate ?? 0)
        monitorPerf[m.id] = {
          avg: Math.round(rates.reduce((s, r) => s + r, 0) / rates.length),
          top: Math.max(...rates),
          low: Math.min(...rates),
          agentCount: mAgents.length,
        }
      }

      setPerfData({ agents: agentPerf, monitors: monitorPerf })
    } catch (e) {
      setError(e.message)
    } finally {
      setPerfLoading(false)
    }
  }

  // Per-monitor stats for selected date
  function getMonitorStats(monitorId) {
    const mAgents = agents.filter(a => a.assigned_monitor_id === monitorId)
    const contentIds = contents.map(c => c.id)
    const total = mAgents.length

    if (!total || !contentIds.length) return { total, done: 0, platformPct: {} }

    let done = 0
    const platformChecked = { whatsapp: 0, facebook: 0, instagram: 0 }
    const opportunities = total * contentIds.length

    for (const a of mAgents) {
      if (isAgentFullyDone(a.id, contentIds, logMap)) done++
      for (const cid of contentIds) {
        for (const p of PLATFORMS) {
          if (logMap[a.id]?.[cid]?.[p]?.is_checked) platformChecked[p]++
        }
      }
    }

    return {
      total,
      done,
      donePct: pct(done, total),
      platformPct: {
        whatsapp: pct(platformChecked.whatsapp, opportunities),
        facebook: pct(platformChecked.facebook, opportunities),
        instagram: pct(platformChecked.instagram, opportunities),
      },
    }
  }

  async function handleReassign() {
    if (!reassignFrom || !reassignTo || reassignFrom === reassignTo) return
    const agentsToMove = agents.filter(a => a.assigned_monitor_id === reassignFrom)
    if (!agentsToMove.length) return
    setReassigning(true)
    setReassignResult(null)
    const { error } = await supabase
      .from('digital_agents')
      .update({ assigned_monitor_id: reassignTo })
      .in('id', agentsToMove.map(a => a.id))
    if (error) { setError(error.message); setReassigning(false); return }
    setReassignResult({ count: agentsToMove.length, from: monitors.find(m => m.id === reassignFrom)?.full_name, to: monitors.find(m => m.id === reassignTo)?.full_name })
    setReassignFrom('')
    setReassignTo('')
    setReassigning(false)
    loadBase()
  }

  // Range select — adds all agents with booth in [from,to] to selection
  function handleRangeSelect() {
    const from = parseInt(rangeFrom)
    const to = parseInt(rangeTo)
    if (isNaN(from) || isNaN(to) || from > to) return
    const inRange = filteredAgents.filter(a => {
      const b = parseInt(a.booth_number)
      return !isNaN(b) && b >= from && b <= to
    })
    if (!inRange.length) return
    setSelectedAgentIds(prev => {
      const next = new Set(prev)
      inRange.forEach(a => next.add(a.id))
      return next
    })
  }

  function handleRangeDeselect() {
    const from = parseInt(rangeFrom)
    const to = parseInt(rangeTo)
    if (isNaN(from) || isNaN(to) || from > to) return
    const inRange = new Set(
      filteredAgents.filter(a => {
        const b = parseInt(a.booth_number)
        return !isNaN(b) && b >= from && b <= to
      }).map(a => a.id)
    )
    setSelectedAgentIds(prev => {
      const next = new Set(prev)
      inRange.forEach(id => next.delete(id))
      return next
    })
  }

  // Show inline confirmation before executing
  function requestBulkReassign() {
    if (selectedAgentIds.size === 0 || !reassignTargetId) return
    const mon = reassignTargetId === 'unassigned'
      ? { full_name: 'No Monitor (Unassign)' }
      : monitors.find(m => m.id === reassignTargetId)
    setConfirmAction({ type: 'assign', monitorId: reassignTargetId, monitorName: mon?.full_name, count: selectedAgentIds.size })
  }

  function requestBulkDelete() {
    if (selectedAgentIds.size === 0) return
    setConfirmAction({ type: 'delete', count: selectedAgentIds.size })
  }

  async function executeBulkReassign() {
    setConfirmAction(null)
    setBulkReassigning(true)
    const newMonitorId = reassignTargetId === 'unassigned' ? null : reassignTargetId
    const { error } = await supabase.from('digital_agents')
      .update({ assigned_monitor_id: newMonitorId })
      .in('id', [...selectedAgentIds])
    if (error) setError(error.message)
    else { setSelectedAgentIds(new Set()); setReassignTargetId(''); loadBase() }
    setBulkReassigning(false)
  }

  async function executeBulkDelete() {
    setConfirmAction(null)
    setBulkDeleting(true)
    const { error } = await supabase.from('digital_agents').delete().in('id', [...selectedAgentIds])
    if (error) setError(error.message)
    else { setSelectedAgentIds(new Set()); loadBase() }
    setBulkDeleting(false)
  }

  function toggleSelectAgent(id) {
    setSelectedAgentIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll(visible) {
    if (selectedAgentIds.size === visible.length && visible.length > 0) {
      setSelectedAgentIds(new Set())
    } else {
      setSelectedAgentIds(new Set(visible.map(a => a.id)))
    }
  }

  function startEditAgent(agent) {
    setEditingAgentId(agent.id)
    setEditAgentValues({
      name: agent.name ?? '',
      phone: agent.phone ?? '',
      booth_number: agent.booth_number ?? '',
      fb_url: agent.fb_url ?? '',
      ig_url: agent.ig_url ?? '',
    })
  }

  async function saveEditAgent(agentId) {
    setSavingEdit(true)
    const { error } = await supabase.from('digital_agents').update({
      name: editAgentValues.name.trim(),
      phone: editAgentValues.phone.trim() || null,
      booth_number: editAgentValues.booth_number !== '' ? parseInt(editAgentValues.booth_number) : null,
      fb_url: editAgentValues.fb_url.trim() || null,
      ig_url: editAgentValues.ig_url.trim() || null,
    }).eq('id', agentId)
    if (error) setError(error.message)
    else { setEditingAgentId(null); loadBase() }
    setSavingEdit(false)
  }

  async function handleDeleteAgent(agentId, agentName) {
    if (!window.confirm(`Delete agent "${agentName}"?\nThis also removes all their compliance logs.`)) return
    setDeletingAgentId(agentId)
    const { error } = await supabase.from('digital_agents').delete().eq('id', agentId)
    if (error) setError(error.message)
    else loadBase()
    setDeletingAgentId(null)
  }

  async function handleDeleteMonitor(monitor) {
    if (!confirm(`Delete monitor "${monitor.full_name}"? Their agents will be unassigned.`)) return
    setDeletingMonitorId(monitor.id)
    // Unassign their agents first
    await supabase.from('digital_agents').update({ assigned_monitor_id: null }).eq('assigned_monitor_id', monitor.id)
    // Delete auth user (requires service role)
    if (supabaseAdmin) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(monitor.id)
      if (delErr) { setError(delErr.message); setDeletingMonitorId(null); return }
    } else {
      // Fall back: just delete profile row (auth user stays but login will fail)
      const { error: pErr } = await supabase.from('profiles').delete().eq('id', monitor.id)
      if (pErr) { setError(pErr.message); setDeletingMonitorId(null); return }
    }
    loadBase()
    setDeletingMonitorId(null)
  }

  const unassigned = agents.filter(a => !a.assigned_monitor_id)
  const isToday = selectedDate === TODAY

  const filteredAgents = agents.filter(a => {
    // Monitor filter
    if (filterMonitorId === 'unassigned' && a.assigned_monitor_id) return false
    if (filterMonitorId && filterMonitorId !== 'unassigned' && a.assigned_monitor_id !== filterMonitorId) return false
    // Search filter
    if (!agentSearch.trim()) return true
    const q = agentSearch.toLowerCase()
    return (
      a.name?.toLowerCase().includes(q) ||
      String(a.booth_number ?? '').includes(q) ||
      a.phone?.includes(q) ||
      a.area?.toLowerCase().includes(q)
    )
  })
  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short'
  })

  if (loading) {
    return (
      <Layout title={profile?.constituencies?.name}>
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
      </Layout>
    )
  }

  return (
    <Layout title={profile?.constituencies?.name}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {showCreateMonitor && (
        <CreateMonitorModal
          constituencyId={constituencyId}
          onCreated={loadBase}
          onClose={() => setShowCreateMonitor(false)}
        />
      )}

      {showAddAgent && (
        <AddAgentModal
          constituencyId={constituencyId}
          onAdded={loadBase}
          onClose={() => setShowAddAgent(false)}
        />
      )}

      {/* Agent detail drawer */}
      {drillMonitor && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">{drillMonitor.monitor.full_name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{drillMonitor.agents.length} agents</p>
              </div>
              <button onClick={() => setDrillMonitor(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl rounded-lg hover:bg-gray-100">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {drillMonitor.agents.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No agents assigned.</p>
              ) : (
                drillMonitor.agents.map(a => {
                  const done = isAgentFullyDone(a.id, drillMonitor.contentIds, logMap)
                  return (
                    <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl border ${done ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600">#{a.booth_number}</span>
                        <span className="text-sm font-medium text-gray-800">{a.name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {PLATFORMS.map(p => (
                          <span key={p} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            logMap[a.id]?.[drillMonitor.contentIds[0]]?.[p]?.is_checked
                              ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {P_LABEL[p]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'Overview' && (
        <div className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Monitors', value: monitors.length, icon: '👤' },
              { label: 'Agents', value: agents.length, icon: '🗳️' },
              { label: 'Unassigned', value: unassigned.length, icon: '⚠️', warn: unassigned.length > 0 },
              { label: "Today's Content", value: (() => {
                // Count today's content (separate from selectedDate)
                return null
              })(), hide: true },
            ].filter(s => !s.hide).map(s => (
              <div key={s.label} className={`bg-white rounded-xl border p-4 ${s.warn ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                <div className="text-xl mb-1">{s.icon}</div>
                <div className={`text-2xl font-bold ${s.warn ? 'text-orange-600' : 'text-gray-900'}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Date picker */}
          <div>
            <button
              onClick={() => setShowCalendar(v => !v)}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-300 transition-colors w-full sm:w-auto"
            >
              <span>📅</span>
              <span>{isToday ? `Today — ${displayDate}` : displayDate}</span>
              <span className="ml-auto text-gray-400 sm:ml-2">{showCalendar ? '▲' : '▼'}</span>
            </button>
            {showCalendar && (
              <div className="mt-2 max-w-sm">
                <MiniCalendar
                  value={selectedDate}
                  onChange={d => { setSelectedDate(d); setShowCalendar(false) }}
                  markedDates={allContentDates}
                />
              </div>
            )}
          </div>

          {contents.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
              No content published on {isToday ? 'today' : displayDate}.
            </div>
          ) : (
            <>
              {/* Monitor performance cards */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Monitor Performance</h3>
                <div className="space-y-3">
                  {monitors.map(m => {
                    const stats = getMonitorStats(m.id)
                    const statusColor = stats.donePct === 100 ? 'border-green-200 bg-green-50' : stats.donePct > 50 ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200'

                    return (
                      <div key={m.id} className={`bg-white rounded-xl border p-4 ${statusColor}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900">{m.full_name}</p>
                            <p className="text-xs text-gray-500">{stats.total} agents</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xl font-bold ${
                              stats.donePct === 100 ? 'text-green-600' : stats.donePct > 50 ? 'text-yellow-600' : 'text-red-500'
                            }`}>
                              {stats.done}/{stats.total}
                            </span>
                            <p className="text-xs text-gray-400">fully done</p>
                          </div>
                        </div>

                        {/* Platform breakdown */}
                        {stats.total > 0 && (
                          <div className="space-y-1.5 border-t border-gray-100/80 pt-3">
                            {PLATFORMS.map(p => (
                              <div key={p} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 w-6">{P_LABEL[p]}</span>
                                <div className="flex-1">
                                  <PlatformBar value={stats.platformPct[p] ?? 0} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Content breakdown */}
                        {contents.length > 1 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {contents.map(c => {
                              const mAgents = agents.filter(a => a.assigned_monitor_id === m.id)
                              const doneCnt = mAgents.filter(a =>
                                PLATFORMS.every(p => logMap[a.id]?.[c.id]?.[p]?.is_checked)
                              ).length
                              return (
                                <span key={c.id} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">
                                  <span className="text-gray-500">{c.title.slice(0, 12)}{c.title.length > 12 ? '…' : ''}: </span>
                                  <span className={`font-bold ${doneCnt === mAgents.length ? 'text-green-600' : 'text-gray-700'}`}>
                                    {doneCnt}/{mAgents.length}
                                  </span>
                                </span>
                              )
                            })}
                          </div>
                        )}

                        <button
                          onClick={() => setDrillMonitor({
                            monitor: m,
                            agents: agents.filter(a => a.assigned_monitor_id === m.id),
                            contentIds: contents.map(c => c.id),
                          })}
                          className="mt-3 text-xs text-indigo-600 font-medium hover:underline"
                        >
                          View agents →
                        </button>
                      </div>
                    )
                  })}
                  {monitors.length === 0 && (
                    <p className="text-gray-400 text-sm text-center py-8">No monitors yet.</p>
                  )}
                </div>
              </div>

              {/* Performance history toggle */}
              <div className="border-t pt-4">
                <button
                  onClick={() => { setShowPerf(v => !v); if (!showPerf) loadPerformance() }}
                  className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  📊 {showPerf ? 'Hide' : 'Show'} 30-day Team Performance
                </button>

                {showPerf && (
                  <div className="mt-4">
                    {perfLoading ? (
                      <p className="text-gray-400 text-sm">Loading…</p>
                    ) : !perfData ? null : (
                      <div className="space-y-3">
                        {monitors.map(m => {
                          const mp = perfData.monitors?.[m.id]
                          if (!mp) return null
                          const mAgents = agents.filter(a => a.assigned_monitor_id === m.id)
                          return (
                            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="font-semibold text-gray-900">{m.full_name}</p>
                                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                                  mp.avg >= 80 ? 'bg-green-100 text-green-700' : mp.avg >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
                                }`}>
                                  {mp.avg}% avg
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mb-3">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${mp.avg >= 80 ? 'bg-green-500' : mp.avg >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${mp.avg}%` }} />
                                </div>
                              </div>
                              {/* Top agents */}
                              <div className="space-y-1.5">
                                {[...mAgents]
                                  .sort((a, b) => (perfData.agents?.[b.id]?.rate ?? 0) - (perfData.agents?.[a.id]?.rate ?? 0))
                                  .slice(0, 5)
                                  .map(a => {
                                    const ap = perfData.agents?.[a.id]
                                    return (
                                      <div key={a.id} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-5">#{a.booth_number}</span>
                                        <span className="text-xs text-gray-700 flex-1 truncate">{a.name}</span>
                                        <span className={`text-xs font-bold w-8 text-right ${
                                          (ap?.rate ?? 0) >= 80 ? 'text-green-600' : (ap?.rate ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-500'
                                        }`}>{ap?.rate ?? 0}%</span>
                                      </div>
                                    )
                                  })}
                                {mAgents.length > 5 && (
                                  <p className="text-xs text-gray-400">+{mAgents.length - 5} more agents</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── AGENTS TAB ── */}
      {activeTab === 'Agents' && (
        <div className="space-y-3">
          {/* Top action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowAddAgent(true)}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shrink-0">
              + Add Agent
            </button>
            <button onClick={() => setActiveTab('Import')}
              className="text-sm text-slate-600 font-medium border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 shrink-0">
              Import CSV
            </button>
            <div className="flex-1 min-w-[180px]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input
                  type="search" value={agentSearch}
                  onChange={e => setAgentSearch(e.target.value)}
                  placeholder="Search name, booth, phone…"
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* ── Monitor filter chips ── */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
            {/* All */}
            <button
              onClick={() => { setFilterMonitorId(''); setSelectedAgentIds(new Set()) }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterMonitorId === ''
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              All · {agents.length}
            </button>
            {/* Unassigned */}
            {unassigned.length > 0 && (
              <button
                onClick={() => { setFilterMonitorId('unassigned'); setSelectedAgentIds(new Set()) }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filterMonitorId === 'unassigned'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400'
                }`}
              >
                ⚠ Unassigned · {unassigned.length}
              </button>
            )}
            {/* Per monitor */}
            {monitors.map(m => {
              const count = agents.filter(a => a.assigned_monitor_id === m.id).length
              return (
                <button key={m.id}
                  onClick={() => { setFilterMonitorId(m.id); setSelectedAgentIds(new Set()) }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    filterMonitorId === m.id
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'
                  }`}
                >
                  {m.full_name.split(' ')[0]} · {count}
                </button>
              )
            })}
          </div>

          {/* Monitor info header when filtered */}
          {filterMonitorId && filterMonitorId !== 'unassigned' && (() => {
            const mon = monitors.find(m => m.id === filterMonitorId)
            const monAgents = agents.filter(a => a.assigned_monitor_id === filterMonitorId)
            const stats = getMonitorStats(filterMonitorId)
            return mon ? (
              <div className="bg-zinc-950 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{mon.full_name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{mon.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{monAgents.length}</p>
                    <p className="text-xs text-zinc-400">agents</p>
                  </div>
                </div>
                {contents.length > 0 && monAgents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-3 gap-2">
                    {PLATFORMS.map(p => (
                      <div key={p} className="text-center">
                        <p className={`text-sm font-bold ${
                          (stats.platformPct[p] ?? 0) >= 80 ? 'text-green-400' :
                          (stats.platformPct[p] ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{stats.platformPct[p] ?? 0}%</p>
                        <p className="text-xs text-zinc-500">{P_LABEL[p]}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null
          })()}

          {/* Unassigned header */}
          {filterMonitorId === 'unassigned' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-orange-800">{unassigned.length} agents not assigned to any monitor</p>
                <p className="text-xs text-orange-600 mt-0.5">Select agents below and use Reassign to assign them</p>
              </div>
            </div>
          )}

          {/* ── Range selector ── */}
          {filteredAgents.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Select by Booth Range</p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" placeholder="From" value={rangeFrom}
                    onChange={e => setRangeFrom(e.target.value)}
                    className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="text-slate-400 text-sm font-bold">—</span>
                  <input
                    type="number" placeholder="To" value={rangeTo}
                    onChange={e => setRangeTo(e.target.value)}
                    className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <button
                  onClick={handleRangeSelect}
                  disabled={!rangeFrom || !rangeTo}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  + Add to Selection
                </button>
                <button
                  onClick={handleRangeDeselect}
                  disabled={!rangeFrom || !rangeTo}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
                >
                  − Remove from Selection
                </button>
                {(rangeFrom || rangeTo) && (
                  <button onClick={() => { setRangeFrom(''); setRangeTo('') }}
                    className="text-slate-400 hover:text-slate-600 text-xs px-1">
                    ✕ Clear
                  </button>
                )}
              </div>
              {rangeFrom && rangeTo && parseInt(rangeFrom) <= parseInt(rangeTo) && (() => {
                const from = parseInt(rangeFrom), to = parseInt(rangeTo)
                const count = filteredAgents.filter(a => {
                  const b = parseInt(a.booth_number)
                  return !isNaN(b) && b >= from && b <= to
                }).length
                return count > 0
                  ? <p className="text-xs text-slate-500 mt-1.5">{count} agent{count !== 1 ? 's' : ''} in booth range {rangeFrom}–{rangeTo}</p>
                  : <p className="text-xs text-orange-500 mt-1.5">No agents found in booth {rangeFrom}–{rangeTo}</p>
              })()}
            </div>
          )}

          {/* ── Bulk action bar ── */}
          {filteredAgents.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Select all row */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedAgentIds.size === filteredAgents.length && filteredAgents.length > 0}
                    onChange={() => toggleSelectAll(filteredAgents)}
                    className="w-4 h-4 rounded accent-red-600"
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {selectedAgentIds.size > 0 ? `${selectedAgentIds.size} selected` : 'Select all visible'}
                  </span>
                </label>
                <span className="text-xs text-slate-400 ml-auto">
                  {filteredAgents.length} of {agents.length}
                </span>
              </div>

              {/* Actions — shown when agents selected */}
              {selectedAgentIds.size > 0 && !confirmAction && (
                <div className="px-3 py-3 bg-slate-50 space-y-2.5">
                  {/* Reassign */}
                  {monitors.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-600 shrink-0">Reassign to:</span>
                      <select value={reassignTargetId} onChange={e => setReassignTargetId(e.target.value)}
                        className="flex-1 min-w-[140px] px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">Choose monitor…</option>
                        {monitors.filter(m => m.id !== filterMonitorId).map(m => {
                          const n = agents.filter(a => a.assigned_monitor_id === m.id).length
                          return <option key={m.id} value={m.id}>{m.full_name} ({n} agents)</option>
                        })}
                        <option value="unassigned">— Remove assignment</option>
                      </select>
                      <button
                        onClick={requestBulkReassign}
                        disabled={bulkReassigning || !reassignTargetId}
                        className="shrink-0 bg-zinc-900 hover:bg-zinc-700 disabled:bg-slate-300 disabled:text-slate-400 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {bulkReassigning
                          ? <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Moving…</span>
                          : `↪ Reassign ${selectedAgentIds.size}`}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400">or</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <button onClick={requestBulkDelete} disabled={bulkDeleting}
                    className="w-full flex items-center justify-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                    🗑 Delete {selectedAgentIds.size} selected agent{selectedAgentIds.size !== 1 ? 's' : ''}
                  </button>
                </div>
              )}

              {/* ── Inline confirmation panel ── */}
              {confirmAction && (
                <div className={`px-4 py-4 ${confirmAction.type === 'delete' ? 'bg-red-50 border-t border-red-200' : 'bg-zinc-950'}`}>
                  <p className={`text-sm font-bold mb-1 ${confirmAction.type === 'delete' ? 'text-red-800' : 'text-white'}`}>
                    {confirmAction.type === 'delete'
                      ? `⚠ Delete ${confirmAction.count} agent${confirmAction.count !== 1 ? 's' : ''}?`
                      : `↪ Reassign ${confirmAction.count} agent${confirmAction.count !== 1 ? 's' : ''}?`}
                  </p>
                  <p className={`text-xs mb-3 ${confirmAction.type === 'delete' ? 'text-red-600' : 'text-zinc-300'}`}>
                    {confirmAction.type === 'delete'
                      ? 'This permanently removes the agents and all their compliance logs. Cannot be undone.'
                      : `Moving to: ${confirmAction.monitorName}`}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmAction(null)}
                      className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors ${
                        confirmAction.type === 'delete'
                          ? 'border-red-300 text-red-700 hover:bg-red-100'
                          : 'border-zinc-600 text-zinc-300 hover:bg-zinc-800'
                      }`}>
                      Cancel
                    </button>
                    <button
                      onClick={confirmAction.type === 'delete' ? executeBulkDelete : executeBulkReassign}
                      className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors text-white ${
                        confirmAction.type === 'delete'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}>
                      {confirmAction.type === 'delete'
                        ? `Yes, Delete ${confirmAction.count}`
                        : `Yes, Reassign ${confirmAction.count}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bulk assign by booth range */}
          {agents.length > 0 && monitors.length > 0 && !filterMonitorId && (
            <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <summary className="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-50 list-none flex items-center justify-between">
                <span>📍 Bulk Assign by Booth Range</span>
                <span className="text-gray-400 text-xs">tap to expand</span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                <BulkAssign agents={agents} monitors={monitors} constituencyId={constituencyId} onAssigned={loadBase} />
              </div>
            </details>
          )}

          {/* Agent list */}
          <div className="space-y-1.5">
            {filteredAgents.map(a => {
              const mon = monitors.find(m => m.id === a.assigned_monitor_id)
              const isEditing = editingAgentId === a.id
              const isSelected = selectedAgentIds.has(a.id)

              if (isEditing) {
                return (
                  <div key={a.id} className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                        <input type="text" value={editAgentValues.name}
                          onChange={e => setEditAgentValues(v => ({ ...v, name: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Booth #</label>
                        <input type="number" value={editAgentValues.booth_number}
                          onChange={e => setEditAgentValues(v => ({ ...v, booth_number: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                        <input type="tel" value={editAgentValues.phone}
                          onChange={e => setEditAgentValues(v => ({ ...v, phone: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Facebook URL</label>
                        <input type="url" value={editAgentValues.fb_url}
                          onChange={e => setEditAgentValues(v => ({ ...v, fb_url: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="https://fb.com/…"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Instagram URL</label>
                        <input type="url" value={editAgentValues.ig_url}
                          onChange={e => setEditAgentValues(v => ({ ...v, ig_url: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="https://instagram.com/…"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditingAgentId(null)}
                        className="flex-1 border border-slate-300 text-slate-600 text-xs font-medium py-1.5 rounded-lg hover:bg-slate-50">
                        Cancel
                      </button>
                      <button onClick={() => saveEditAgent(a.id)} disabled={savingEdit || !editAgentValues.name.trim()}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-semibold py-1.5 rounded-lg">
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={a.id} className={`bg-white rounded-xl border p-3 flex items-center gap-2.5 transition-colors ${
                  isSelected ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectAgent(a.id)}
                    className="w-4 h-4 rounded accent-red-600 shrink-0"
                  />
                  <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg shrink-0 min-w-[2.5rem] text-center">
                    #{a.booth_number ?? '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      {a.phone || ''}
                      {a.phone && !filterMonitorId ? ' · ' : ''}
                      {!filterMonitorId && (mon
                        ? <span className="text-slate-500">{mon.full_name}</span>
                        : <span className="text-orange-500">Unassigned</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.fb_url && <a href={a.fb_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600 text-xs px-1">FB</a>}
                    {a.ig_url && <a href={a.ig_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-600 text-xs px-1">IG</a>}
                    <button onClick={() => startEditAgent(a)}
                      className="text-slate-400 hover:text-slate-700 text-xs px-1.5 py-1 rounded hover:bg-slate-100 transition-colors"
                      title="Edit">✏️</button>
                    <button
                      onClick={() => handleDeleteAgent(a.id, a.name)}
                      disabled={deletingAgentId === a.id}
                      className="text-red-400 hover:text-red-600 text-xs px-1.5 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Delete">
                      {deletingAgentId === a.id ? '…' : '✕'}
                    </button>
                  </div>
                </div>
              )
            })}

            {agents.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
                No agents yet. Click "Add Agent" or import from CSV.
              </div>
            )}
            {agents.length > 0 && filteredAgents.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                No agents match "{agentSearch}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MONITORS TAB ── */}
      {activeTab === 'Monitors' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{monitors.length} monitors in this constituency</p>
            <button onClick={() => setShowCreateMonitor(true)} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
              + Add Monitor
            </button>
          </div>

          {/* Monitor cards */}
          <div className="space-y-3">
            {monitors.map(m => {
              const assignedCount = agents.filter(a => a.assigned_monitor_id === m.id).length
              return (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{m.full_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        assignedCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {assignedCount} agent{assignedCount !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => handleDeleteMonitor(m)}
                        disabled={deletingMonitorId === m.id}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-40 border border-red-200"
                        title="Delete monitor"
                      >
                        {deletingMonitorId === m.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {monitors.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-300">
                No monitors yet. Click "Add Monitor" to create one.
              </div>
            )}
          </div>

          {/* ── Quick Reassign ── */}
          {monitors.length >= 2 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg shrink-0">🔄</div>
                <div>
                  <h3 className="font-bold text-slate-900">Quick Reassign</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Move all agents from one monitor to another — use when a monitor is absent or unavailable.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">From (absent monitor)</label>
                  <select
                    value={reassignFrom}
                    onChange={e => { setReassignFrom(e.target.value); setReassignResult(null) }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select monitor…</option>
                    {monitors.map(m => {
                      const n = agents.filter(a => a.assigned_monitor_id === m.id).length
                      return <option key={m.id} value={m.id}>{m.full_name} ({n} agents)</option>
                    })}
                  </select>
                </div>

                <div className="flex items-end justify-center pb-1 text-slate-400 font-bold text-lg">→</div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">To (replacement monitor)</label>
                  <select
                    value={reassignTo}
                    onChange={e => { setReassignTo(e.target.value); setReassignResult(null) }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">Select monitor…</option>
                    {monitors.filter(m => m.id !== reassignFrom).map(m => {
                      const n = agents.filter(a => a.assigned_monitor_id === m.id).length
                      return <option key={m.id} value={m.id}>{m.full_name} (currently {n} agents)</option>
                    })}
                  </select>
                </div>
              </div>

              {/* Preview count */}
              {reassignFrom && reassignTo && reassignFrom !== reassignTo && (() => {
                const count = agents.filter(a => a.assigned_monitor_id === reassignFrom).length
                const fromName = monitors.find(m => m.id === reassignFrom)?.full_name
                const toName = monitors.find(m => m.id === reassignTo)?.full_name
                return (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
                    <span className="font-semibold">{count} agent{count !== 1 ? 's' : ''}</span> will move from{' '}
                    <span className="font-semibold">{fromName}</span> to{' '}
                    <span className="font-semibold">{toName}</span>.
                  </div>
                )
              })()}

              {reassignResult && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700">
                  ✓ {reassignResult.count} agent{reassignResult.count !== 1 ? 's' : ''} moved from{' '}
                  <span className="font-semibold">{reassignResult.from}</span> to{' '}
                  <span className="font-semibold">{reassignResult.to}</span>.
                </div>
              )}

              <button
                onClick={handleReassign}
                disabled={reassigning || !reassignFrom || !reassignTo || reassignFrom === reassignTo ||
                  agents.filter(a => a.assigned_monitor_id === reassignFrom).length === 0}
                className="mt-4 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {reassigning ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Reassigning…</>
                ) : (
                  <>🔄 Reassign All Agents</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── IMPORT TAB ── */}
      {activeTab === 'Import' && (
        <div className="max-w-2xl">
          <div className="mb-5">
            <h3 className="font-semibold text-gray-900 mb-1">Import Agents from Google Form CSV</h3>
            <p className="text-sm text-gray-500">
              Export your Google Form responses as CSV and drag it here. Tamil and English column headers are auto-detected.
            </p>
          </div>
          <CSVImport constituencyId={constituencyId} onImported={loadBase} />
        </div>
      )}
    </Layout>
  )
}
