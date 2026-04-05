import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import AgentCard from '../components/AgentCard'
import MiniCalendar from '../components/MiniCalendar'

// Validate that a URL starts with http(s)://
function isValidLink(url) {
  if (!url || !url.trim()) return null
  return /^https?:\/\/.+\..+/.test(url.trim())
}

const TODAY = new Date().toISOString().split('T')[0]
const PLATFORMS = ['whatsapp', 'facebook', 'instagram']

// Determine "done" = ALL 3 platforms checked for a specific content
function isAgentDoneForContent(logsByPlatform) {
  return PLATFORMS.every(p => logsByPlatform?.[p]?.is_checked === true)
}

export default function MonitorPage() {
  const { user, profile } = useAuth()

  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [showCalendar, setShowCalendar] = useState(false)
  const [allContentDates, setAllContentDates] = useState([]) // for calendar dots

  const [contents, setContents] = useState([])
  const [agents, setAgents] = useState([])
  // logMap: { [agent_id]: { [content_id]: { [platform]: log_row } } }
  const [logMap, setLogMap] = useState({})
  const [selectedContentId, setSelectedContentId] = useState(null)

  // 'todo' | 'done' | 'performance'
  const [activeTab, setActiveTab] = useState('todo')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Performance data (loaded lazily)
  const [perfLoading, setPerfLoading] = useState(false)
  const [perfData, setPerfData] = useState(null) // { [agent_id]: { fullyPosted, total, rate } }

  // Booth assignments for this monitor
  const [boothAssignments, setBoothAssignments] = useState([])

  // Add agent
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', booth_number: '', phone: '', fb_url: '', ig_url: '', gender: '' })
  const [addingSave, setAddingSave] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit agent
  const [editingAgentId, setEditingAgentId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  // Reassignment confirmation: { agentId, newBooth, newMonitorId, newMonitorName }
  const [boothConfirm, setBoothConfirm] = useState(null)

  // Load calendar dot dates once on mount
  useEffect(() => {
    if (!user) return
    supabase
      .from('daily_content')
      .select('content_date')
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(r => r.content_date))]
          setAllContentDates(unique)
        }
      })
  }, [user])

  // Load agents + booth assignments once on mount
  useEffect(() => {
    if (!user) return
    supabase
      .from('digital_agents')
      .select('*')
      .eq('assigned_monitor_id', user.id)
      .order('booth_number')
      .then(({ data, error }) => {
        if (!error) setAgents(data ?? [])
      })
    supabase
      .from('monitor_booth_assignments')
      .select('*')
      .eq('monitor_id', user.id)
      .order('booth_from')
      .then(({ data }) => setBoothAssignments(data ?? []))
  }, [user])

  // Load content + compliance whenever date changes
  useEffect(() => {
    if (!user) return
    loadDateData()
  }, [selectedDate, user])

  async function loadDateData() {
    setLoading(true)
    setError('')
    setSelectedContentId(null)
    setContents([])
    setLogMap({})

    try {
      const constId = profile?.constituency_id
      let contentQuery = supabase
        .from('daily_content')
        .select('*')
        .eq('content_date', selectedDate)
        .order('created_at')
      if (constId) {
        contentQuery = contentQuery.or(`target_constituencies.is.null,target_constituencies.cs.{"${constId}"}`)
      }
      const { data: dateContents, error: ce } = await contentQuery
      if (ce) throw ce

      setContents(dateContents ?? [])
      if (dateContents?.length) setSelectedContentId(dateContents[0].id)

      // Load agents (may not be set yet on first run — use state or re-fetch)
      const { data: myAgents } = await supabase
        .from('digital_agents')
        .select('*')
        .eq('assigned_monitor_id', user.id)
        .order('booth_number')

      setAgents(myAgents ?? [])

      if (dateContents?.length && myAgents?.length) {
        const { data: logs, error: le } = await supabase
          .from('compliance_logs')
          .select('*')
          .in('content_id', dateContents.map(c => c.id))
          .in('agent_id', myAgents.map(a => a.id))
        if (le) throw le
        buildLogMap(logs ?? [])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function buildLogMap(logs) {
    const map = {}
    for (const log of logs) {
      if (!map[log.agent_id]) map[log.agent_id] = {}
      if (!map[log.agent_id][log.content_id]) map[log.agent_id][log.content_id] = {}
      map[log.agent_id][log.content_id][log.platform] = log
    }
    setLogMap(map)
  }

  async function loadPerformanceData() {
    if (perfData || agents.length === 0) return
    setPerfLoading(true)
    try {
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const fromDate = from.toISOString().split('T')[0]

      const { data: recentContent } = await supabase
        .from('daily_content')
        .select('id, content_date')
        .gte('content_date', fromDate)

      if (!recentContent?.length) { setPerfData({}); return }

      const { data: logs } = await supabase
        .from('compliance_logs')
        .select('agent_id, content_id, platform, is_checked')
        .in('content_id', recentContent.map(c => c.id))
        .in('agent_id', agents.map(a => a.id))
        .eq('is_checked', true)

      // Per agent: track per-platform counts AND fully-posted counts
      const agentContentChecks = {} // { [agent_id]: { [content_id]: platform_count } }
      const agentPlatformCounts = {} // { [agent_id]: { whatsapp: N, facebook: N, instagram: N } }
      for (const log of logs ?? []) {
        // content-level tracking
        if (!agentContentChecks[log.agent_id]) agentContentChecks[log.agent_id] = {}
        agentContentChecks[log.agent_id][log.content_id] =
          (agentContentChecks[log.agent_id][log.content_id] ?? 0) + 1
        // platform-level tracking
        if (!agentPlatformCounts[log.agent_id]) agentPlatformCounts[log.agent_id] = { whatsapp: 0, facebook: 0, instagram: 0 }
        agentPlatformCounts[log.agent_id][log.platform]++
      }

      const total = recentContent.length
      const perf = {}
      for (const agent of agents) {
        const map = agentContentChecks[agent.id] ?? {}
        const pc = agentPlatformCounts[agent.id] ?? { whatsapp: 0, facebook: 0, instagram: 0 }
        const fullyPosted = Object.values(map).filter(c => c === 3).length
        const p = (n) => total ? Math.round(n / total * 100) : 0
        perf[agent.id] = {
          fullyPosted,
          total,
          rate: p(fullyPosted),
          platforms: {
            whatsapp: p(pc.whatsapp),
            facebook: p(pc.facebook),
            instagram: p(pc.instagram),
          },
        }
      }
      setPerfData(perf)
    } catch (e) {
      setError(e.message)
    } finally {
      setPerfLoading(false)
    }
  }

  // Build list of valid booth numbers from this monitor's assigned ranges
  function getAssignedBooths() {
    const booths = []
    for (const a of boothAssignments) {
      for (let b = a.booth_from; b <= a.booth_to; b++) booths.push(b)
    }
    return booths
  }

  async function handleAddAgent(e) {
    e.preventDefault()
    if (!addForm.name.trim()) return
    const boothNum = addForm.booth_number !== '' ? parseInt(addForm.booth_number) : null
    setAddingSave(true)
    setAddError('')
    const { error } = await supabase.from('digital_agents').insert({
      name: addForm.name.trim(),
      gender: addForm.gender || null,
      booth_number: boothNum,
      phone: addForm.phone.trim() || null,
      fb_url: addForm.fb_url.trim() || null,
      ig_url: addForm.ig_url.trim() || null,
      assigned_monitor_id: user.id,
      constituency_id: profile?.constituency_id ?? null,
    })
    if (error) { setAddError(error.message); setAddingSave(false); return }
    setAddForm({ name: '', booth_number: '', phone: '', fb_url: '', ig_url: '', gender: '' })
    setShowAddAgent(false)
    setAddingSave(false)
    loadDateData()
  }

  function startEditAgent(agent) {
    setEditingAgentId(agent.id)
    setEditValues({
      name: agent.name ?? '',
      booth_number: agent.booth_number != null ? String(agent.booth_number) : '',
      phone: agent.phone ?? '',
      fb_url: agent.fb_url ?? '',
      ig_url: agent.ig_url ?? '',
    })
  }

  // Find which monitor owns a booth number based on loaded assignments
  function findMonitorForBooth(boothNum) {
    const n = parseInt(boothNum)
    if (isNaN(n)) return null
    const match = boothAssignments.find(a => n >= a.booth_from && n <= a.booth_to)
    return match ? { monitor_id: match.monitor_id } : null
  }

  async function handleSaveEdit(agentId) {
    const newBooth = editValues.booth_number !== '' ? parseInt(editValues.booth_number) : null
    const agent = agents.find(a => a.id === agentId)
    const boothChanged = newBooth !== null && newBooth !== agent?.booth_number

    // If booth changed, check if it belongs to a different monitor
    if (boothChanged) {
      const match = findMonitorForBooth(newBooth)
      if (match && match.monitor_id !== user.id) {
        // Need to fetch monitor name for the confirmation message
        const { data: mon } = await supabase
          .from('profiles').select('full_name').eq('id', match.monitor_id).single()
        setBoothConfirm({
          agentId,
          newBooth,
          newMonitorId: match.monitor_id,
          newMonitorName: mon?.full_name ?? 'another monitor',
        })
        return
      }
    }
    await doSaveEdit(agentId, newBooth, null)
  }

  async function doSaveEdit(agentId, newBooth, newMonitorId) {
    setSavingEdit(true)
    setBoothConfirm(null)
    const updateData = {
      name: editValues.name.trim(),
      booth_number: newBooth,
      phone: editValues.phone.trim() || null,
      fb_url: editValues.fb_url.trim() || null,
      ig_url: editValues.ig_url.trim() || null,
    }
    if (newMonitorId) updateData.assigned_monitor_id = newMonitorId
    const { error } = await supabase.from('digital_agents').update(updateData).eq('id', agentId)
    if (error) setError(error.message)
    else { setEditingAgentId(null); loadDateData() }
    setSavingEdit(false)
  }

  async function handleToggle(agentId, platform, currentChecked) {
    if (!selectedContentId) return
    setSaving(true)
    try {
      const existing = logMap[agentId]?.[selectedContentId]?.[platform]
      let updated

      if (existing) {
        const { data, error } = await supabase
          .from('compliance_logs')
          .update({ is_checked: !currentChecked, checked_by: user.id, checked_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select().single()
        if (error) throw error
        updated = data
      } else {
        const { data, error } = await supabase
          .from('compliance_logs')
          .insert({ agent_id: agentId, content_id: selectedContentId, platform, is_checked: true, checked_by: user.id, checked_at: new Date().toISOString() })
          .select().single()
        if (error) throw error
        updated = data
      }

      setLogMap(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          [selectedContentId]: {
            ...prev[agentId]?.[selectedContentId],
            [platform]: updated,
          },
        },
      }))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  function getAgentLogs(agentId) {
    return logMap[agentId]?.[selectedContentId] ?? {}
  }

  // Done = ALL 3 platforms checked
  const doneAgents = agents.filter(a => isAgentDoneForContent(getAgentLogs(a.id)))
  const todoAgents = agents.filter(a => !isAgentDoneForContent(getAgentLogs(a.id)))

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (tab === 'performance') loadPerformanceData()
  }

  function handleDateChange(date) {
    setSelectedDate(date)
    setShowCalendar(false)
    setActiveTab('todo')
    setPerfData(null) // reset performance cache when date changes
  }

  const selectedContent = contents.find(c => c.id === selectedContentId)
  const isToday = selectedDate === TODAY
  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })

  const assignedBooths = getAssignedBooths()

  return (
    <Layout title="My Agents">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* ── ADD AGENT MODAL ── */}
      {showAddAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-950">
              <h2 className="text-base font-bold text-white">Add Agent</h2>
              <button onClick={() => setShowAddAgent(false)} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleAddAgent} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Full Name *</label>
                <input type="text" required value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Agent's full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Gender</label>
                  <select value={addForm.gender} onChange={e => setAddForm(p => ({ ...p, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Booth #{assignedBooths.length > 0 ? `(your range${boothAssignments.length > 1 ? 's' : ''}: ${boothAssignments.map(a => `${a.booth_from}–${a.booth_to}`).join(', ')})` : ''}
                  </label>
                  {assignedBooths.length > 0 && assignedBooths.length <= 100 ? (
                    <select value={addForm.booth_number} onChange={e => setAddForm(p => ({ ...p, booth_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                      <option value="">Select booth…</option>
                      {assignedBooths.map(b => <option key={b} value={b}>Booth {b}</option>)}
                    </select>
                  ) : (
                    <input type="number" value={addForm.booth_number} onChange={e => setAddForm(p => ({ ...p, booth_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="e.g. 42"
                      min={boothAssignments[0]?.booth_from}
                      max={boothAssignments[boothAssignments.length - 1]?.booth_to} />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">WhatsApp / Phone</label>
                <input type="tel" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="10-digit number (country code auto-added)" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Facebook URL
                  {addForm.fb_url && isValidLink(addForm.fb_url) === false && (
                    <span className="ml-2 text-orange-500 normal-case font-normal">⚠ must start with https://</span>
                  )}
                </label>
                <input type="text" value={addForm.fb_url} onChange={e => setAddForm(p => ({ ...p, fb_url: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    addForm.fb_url && isValidLink(addForm.fb_url) === false ? 'border-orange-400 bg-orange-50' : 'border-slate-300'
                  }`}
                  placeholder="https://facebook.com/profilename" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Instagram URL
                  {addForm.ig_url && isValidLink(addForm.ig_url) === false && (
                    <span className="ml-2 text-orange-500 normal-case font-normal">⚠ must start with https://</span>
                  )}
                </label>
                <input type="text" value={addForm.ig_url} onChange={e => setAddForm(p => ({ ...p, ig_url: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    addForm.ig_url && isValidLink(addForm.ig_url) === false ? 'border-orange-400 bg-orange-50' : 'border-slate-300'
                  }`}
                  placeholder="https://instagram.com/username" />
              </div>
              {addError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{addError}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddAgent(false)} className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={addingSave} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2 rounded-lg text-sm">
                  {addingSave ? 'Adding…' : 'Add Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── BOOTH REASSIGN CONFIRMATION ── */}
      {boothConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center">
              <div className="text-3xl mb-2">🔄</div>
              <p className="font-bold text-gray-900">Reassign Agent?</p>
              <p className="text-sm text-gray-600 mt-2">
                Booth <span className="font-bold text-gray-900">#{boothConfirm.newBooth}</span> belongs to{' '}
                <span className="font-bold text-gray-900">{boothConfirm.newMonitorName}</span>.
              </p>
              <p className="text-sm text-gray-500 mt-1">
                This agent will be moved to their monitor after saving.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBoothConfirm(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => doSaveEdit(boothConfirm.agentId, boothConfirm.newBooth, boothConfirm.newMonitorId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-sm font-semibold"
              >
                OK, Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DATE SELECTOR ── */}
      <div className="mb-4">
        <button
          onClick={() => setShowCalendar(v => !v)}
          className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100 transition-colors w-full sm:w-auto"
        >
          <span>📅</span>
          <span>{isToday ? `Today — ${displayDate}` : displayDate}</span>
          <span className="ml-auto text-gray-400 sm:ml-2">{showCalendar ? '▲' : '▼'}</span>
        </button>

        {showCalendar && (
          <div className="mt-2 max-w-sm">
            <MiniCalendar
              value={selectedDate}
              onChange={handleDateChange}
              markedDates={allContentDates}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
      ) : contents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-600 font-medium">No content for {isToday ? 'today' : displayDate}</p>
          <p className="text-gray-400 text-sm mt-1">Try another date or check back later.</p>
        </div>
      ) : (
        <>
          {/* Content selector */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            {contents.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedContentId(c.id); setActiveTab('todo') }}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors border whitespace-nowrap ${
                  selectedContentId === c.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>

          {/* Selected content detail */}
          {selectedContent && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
              <p className="font-semibold text-indigo-900 text-sm">{selectedContent.title}</p>
              {selectedContent.description && (
                <p className="text-xs text-indigo-700 mt-1">{selectedContent.description}</p>
              )}
              {selectedContent.media_link && (
                <a href={selectedContent.media_link} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-1.5 text-xs text-indigo-600 underline">
                  View media →
                </a>
              )}
            </div>
          )}

          {/* Stats bar + Add Agent */}
          <div className="flex items-center gap-3 mb-3 text-xs flex-wrap">
            <span className="text-gray-500">{agents.length} agents total</span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="text-orange-600 font-medium">{todoAgents.length} to do</span>
            <span className="w-px h-3 bg-gray-200" />
            <span className="text-green-600 font-medium">{doneAgents.length} done</span>
            {agents.length > 0 && (
              <>
                <span className="w-px h-3 bg-gray-200" />
                <span className="text-gray-500">{Math.round(doneAgents.length / agents.length * 100)}%</span>
              </>
            )}
            <button
              onClick={() => setShowAddAgent(true)}
              className="ml-auto bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              + Add Agent
            </button>
          </div>

          {/* Tabs: To Do | Done | Performance */}
          <div className="flex border-b border-gray-200 mb-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { key: 'todo', label: 'To Do', count: todoAgents.length, color: 'text-orange-500' },
              { key: 'done', label: 'Done ✓', count: doneAgents.length, color: 'text-green-600' },
              { key: 'performance', label: 'Performance', count: null, color: 'text-purple-600' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── TO DO / DONE AGENT CARDS ── */}
          {(activeTab === 'todo' || activeTab === 'done') && (() => {
            const list = activeTab === 'todo' ? todoAgents : doneAgents
            if (agents.length === 0) return (
              <p className="text-center text-gray-400 py-12 text-sm">No agents assigned to you yet.</p>
            )
            if (list.length === 0) return (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">{activeTab === 'done' ? '📭' : '🎉'}</div>
                <p className="text-gray-600 font-medium text-sm">
                  {activeTab === 'done' ? 'No agents fully verified yet.' : 'All agents done for this content!'}
                </p>
                {activeTab === 'todo' && doneAgents.length > 0 && (
                  <p className="text-gray-400 text-xs mt-1">Check the "Done" tab.</p>
                )}
              </div>
            )
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map(agent => (
                  <div key={agent.id}>
                    {editingAgentId === agent.id ? (
                      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-800">Edit Agent</p>
                          <button onClick={() => setEditingAgentId(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                            <input type="text" value={editValues.name} onChange={e => setEditValues(p => ({ ...p, name: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">
                              Booth #
                              {(() => {
                                const n = parseInt(editValues.booth_number)
                                if (!editValues.booth_number || isNaN(n)) return null
                                const match = findMonitorForBooth(n)
                                if (match && match.monitor_id !== user.id) return <span className="ml-1 text-orange-500 font-normal normal-case">→ reassign</span>
                                return null
                              })()}
                            </label>
                            <input type="number" min={1} value={editValues.booth_number}
                              onChange={e => setEditValues(p => ({ ...p, booth_number: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                              placeholder="e.g. 42" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                            <input type="tel" value={editValues.phone} onChange={e => setEditValues(p => ({ ...p, phone: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                              placeholder="10-digit number" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">
                            Facebook URL
                            {editValues.fb_url && isValidLink(editValues.fb_url) === false && (
                              <span className="ml-2 text-orange-500 normal-case font-normal">⚠ must start with https://</span>
                            )}
                          </label>
                          <input type="text" value={editValues.fb_url} onChange={e => setEditValues(p => ({ ...p, fb_url: e.target.value }))}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                              editValues.fb_url && isValidLink(editValues.fb_url) === false ? 'border-orange-400 bg-orange-50' : 'border-slate-300'
                            }`}
                            placeholder="https://facebook.com/…" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">
                            Instagram URL
                            {editValues.ig_url && isValidLink(editValues.ig_url) === false && (
                              <span className="ml-2 text-orange-500 normal-case font-normal">⚠ must start with https://</span>
                            )}
                          </label>
                          <input type="text" value={editValues.ig_url} onChange={e => setEditValues(p => ({ ...p, ig_url: e.target.value }))}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                              editValues.ig_url && isValidLink(editValues.ig_url) === false ? 'border-orange-400 bg-orange-50' : 'border-slate-300'
                            }`}
                            placeholder="https://instagram.com/…" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingAgentId(null)} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2 rounded-lg hover:bg-slate-50">Cancel</button>
                          <button onClick={() => handleSaveEdit(agent.id)} disabled={savingEdit}
                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold text-sm py-2 rounded-lg">
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group">
                        <AgentCard
                          agent={agent}
                          logsByPlatform={getAgentLogs(agent.id)}
                          onToggle={(agentId, platform, checked) => handleToggle(agentId, platform, checked)}
                          saving={saving}
                          content={selectedContent}
                        />
                        <button
                          onClick={() => startEditAgent(agent)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 px-2 py-0.5 rounded-lg shadow-sm"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── PERFORMANCE TAB ── */}
          {activeTab === 'performance' && (
            <div>
              <p className="text-xs text-slate-500 mb-4">
                Last 30 days · "All done" = all 3 platforms checked for that content
              </p>
              {perfLoading ? (
                <div className="text-center py-12 text-slate-400 text-sm">Loading performance data…</div>
              ) : !perfData ? (
                <div className="text-center py-12 text-slate-400 text-sm">No data yet.</div>
              ) : agents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No agents assigned.</div>
              ) : (
                <div className="space-y-3">
                  {[...agents]
                    .sort((a, b) => (perfData[a.id]?.rate ?? 0) - (perfData[b.id]?.rate ?? 0))
                    .map(agent => {
                      const p = perfData[agent.id] ?? { fullyPosted: 0, total: 0, rate: 0, platforms: { whatsapp: 0, facebook: 0, instagram: 0 } }
                      const statusColor = p.rate >= 80 ? 'border-l-emerald-500' : p.rate >= 50 ? 'border-l-amber-400' : 'border-l-rose-400'
                      const rateColor = p.rate >= 80 ? 'text-emerald-600' : p.rate >= 50 ? 'text-amber-600' : 'text-rose-500'
                      const statusLabel = p.rate >= 80 ? 'Consistent' : p.rate >= 50 ? 'Average' : 'Needs follow-up'
                      const statusBadge = p.rate >= 80 ? 'bg-emerald-50 text-emerald-700' : p.rate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'

                      const platformMeta = [
                        { key: 'whatsapp', label: 'WA', icon: '💬', color: 'bg-emerald-500' },
                        { key: 'facebook', label: 'FB', icon: '📘', color: 'bg-blue-500' },
                        { key: 'instagram', label: 'IG', icon: '📸', color: 'bg-pink-500' },
                      ]

                      return (
                        <div key={agent.id} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${statusColor} p-4 shadow-sm`}>
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {agent.booth_number != null && (
                                <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100">
                                  Booth #{agent.booth_number}
                                </span>
                              )}
                              <span className="font-semibold text-slate-800">{agent.name}</span>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <div className={`text-xl font-bold ${rateColor}`}>{p.rate}%</div>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge}`}>{statusLabel}</span>
                            </div>
                          </div>

                          {/* All-done bar */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-slate-400 w-16 shrink-0">All done</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${p.rate >= 80 ? 'bg-emerald-500' : p.rate >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                style={{ width: `${p.rate}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 w-14 text-right shrink-0">{p.fullyPosted}/{p.total}</span>
                          </div>

                          {/* Platform bars */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            {platformMeta.map(({ key, label, icon, color }) => {
                              const val = p.platforms?.[key] ?? 0
                              return (
                                <div key={key} className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 w-16 shrink-0">{icon} {label}</span>
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
                                  </div>
                                  <span className={`text-xs font-semibold w-8 text-right shrink-0 ${val >= 80 ? 'text-emerald-600' : val >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>
                                    {val}%
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
