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

  async function handleDeleteAgent(agentId, agentName) {
    if (!confirm(`Delete agent "${agentName}"? This also removes all their compliance logs.`)) return
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
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-500">{agents.length} agents · {unassigned.length} unassigned</p>
            <div className="flex gap-2">
              <button onClick={() => setShowAddAgent(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                + Add Agent
              </button>
              <button onClick={() => setActiveTab('Import')} className="text-sm text-slate-600 font-medium border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50">
                Import CSV
              </button>
            </div>
          </div>

          {agents.length > 0 && monitors.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Bulk Assign by Booth Range</h3>
              <BulkAssign agents={agents} monitors={monitors} constituencyId={constituencyId} onAssigned={loadBase} />
            </div>
          )}

          {/* Mobile-friendly agent list */}
          <div className="space-y-2">
            {agents.map(a => {
              const mon = monitors.find(m => m.id === a.assigned_monitor_id)
              return (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                  <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg shrink-0">#{a.booth_number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{a.gender || ''} {a.phone ? `· ${a.phone}` : ''}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {mon ? (
                      <span className="text-xs bg-slate-50 text-slate-700 px-2 py-0.5 rounded-full font-medium border border-slate-200">{mon.full_name}</span>
                    ) : (
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">Unassigned</span>
                    )}
                    <div className="flex gap-1.5 items-center">
                      {a.fb_url && <a href={a.fb_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs">FB</a>}
                      {a.ig_url && <a href={a.ig_url} target="_blank" rel="noopener noreferrer" className="text-pink-500 text-xs">IG</a>}
                      <button
                        onClick={() => handleDeleteAgent(a.id, a.name)}
                        disabled={deletingAgentId === a.id}
                        className="text-red-400 hover:text-red-600 text-xs ml-1 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Delete agent"
                      >
                        {deletingAgentId === a.id ? '…' : '✕'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {agents.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No agents yet. Click "Add Agent" or import from CSV.
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
