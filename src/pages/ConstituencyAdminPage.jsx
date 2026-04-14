import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { getTodayIST, daysAgoIST, isValidPhone } from '../lib/dateUtils'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import CSVImport from '../components/CSVImport'
import BulkAssign from '../components/BulkAssign'
import CreateMonitorModal from '../components/CreateMonitorModal'
import BulkMonitorImport from '../components/BulkMonitorImport'
import MiniCalendar from '../components/MiniCalendar'
import { exportMasterReport, exportPlaceWiseReport, exportPlacePerformanceReport } from '../lib/exportUtils'
import AddContentModal from '../components/AddContentModal'

function isValidLink(url) {
  if (!url || !url.trim()) return null
  return /^(https?:\/\/|www\.).+\..+/.test(url.trim())
}

function AddAgentModal({ constituencyId, userId, boothAssignments = [], onAdded, onClose }) {
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
    const boothNum = booth ? parseInt(booth) : null
    let autoMonitorId = null
    if (boothNum !== null && !isNaN(boothNum)) {
      const match = boothAssignments.find(a => boothNum >= a.booth_from && boothNum <= a.booth_to)
      if (match) autoMonitorId = match.monitor_id
    }
    const { error } = await supabase.from('digital_agents').insert({
      name: name.trim(),
      gender: gender || null,
      booth_number: boothNum,
      phone: phone.trim() || null,
      fb_url: fbUrl.trim() || null,
      ig_url: igUrl.trim() || null,
      constituency_id: constituencyId,
      created_by: userId ?? null,
      assigned_monitor_id: autoMonitorId,
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
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                Phone
                {phone && isValidPhone(phone) === false && (
                  <span className="ml-2 text-orange-500 normal-case font-normal">⚠ must be 10 digits</span>
                )}
              </label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  phone && isValidPhone(phone) === false ? 'border-orange-400 bg-orange-50' : 'border-slate-300'
                }`}
                placeholder="10-digit number" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Facebook URL</label>
              <input type="text" value={fbUrl} onChange={e => setFbUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="https://fb.com/… or www.fb.com/…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Instagram URL</label>
              <input type="text" value={igUrl} onChange={e => setIgUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="https://instagram.com/… or www.instagram.com/…" />
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

const TODAY = getTodayIST()
const TABS = ['Overview', 'Agents', 'Monitors', 'Booths', 'Import']
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
  const [boothAssignments, setBoothAssignments] = useState([])
  const [places, setPlaces] = useState([])

  // Booths tab — spreadsheet table rows
  const [tableRows, setTableRows] = useState([])   // { _key, id, monitor_id, booth_from, booth_to, _dirty, _saving }
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [autoAssignResult, setAutoAssignResult] = useState(null)

  // Reassignment state
  const [reassignFrom, setReassignFrom] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [reassignResult, setReassignResult] = useState(null)
  const [contents, setContents] = useState([])
  // logMap: { [agent_id]: { [content_id]: { [platform]: log } } }
  const [logMap, setLogMap] = useState({})

  // Export
  const [exportSortBy, setExportSortBy] = useState('booth')
  const [exporting, setExporting] = useState(false)
  const [exportingPlace, setExportingPlace]         = useState(false)
  const [exportingPlacePerf, setExportingPlacePerf] = useState(false)

  // Content creation
  const [showAddContent, setShowAddContent] = useState(false)

  const [loading, setLoading] = useState(true)
  const [showCreateMonitor, setShowCreateMonitor] = useState(false)
  const [showBulkMonitor, setShowBulkMonitor] = useState(false)
  const [drillMonitor, setDrillMonitor] = useState(null) // { monitor, agents, contentIds }
  const [error, setError] = useState('')

  // Performance data: last 30 days per monitor and per agent
  const [perfData, setPerfData] = useState(null)
  const [perfLoading, setPerfLoading] = useState(false)
  const [showPerf, setShowPerf] = useState(false)
  const [overviewContentId, setOverviewContentId] = useState(null) // null = All contents

  // CRUD state
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [deletingAgentId, setDeletingAgentId] = useState(null)
  const [deletingMonitorId, setDeletingMonitorId] = useState(null)
  const [editingMonitorId, setEditingMonitorId] = useState(null)
  const [editMonitorValues, setEditMonitorValues] = useState({ full_name: '', phone: '' })
  const [savingMonitorEdit, setSavingMonitorEdit] = useState(false)

  // Agents tab: search + filter + bulk + inline edit
  const [agentSearch, setAgentSearch] = useState('')
  const [filterInvalidLinks, setFilterInvalidLinks] = useState(false)
  const [filterMonitorId, setFilterMonitorId] = useState('')
  const [filterPlaceName, setFilterPlaceName] = useState('')   // '' = all places, or a place name string
  // Compliance check mode
  const [checkMode, setCheckMode] = useState(false)
  const [checkContentId, setCheckContentId] = useState('') // '' = all content for date
  const [boothFrom, setBoothFrom] = useState('')
  const [boothTo, setBoothTo] = useState('')
  const [showBoothFilter, setShowBoothFilter] = useState(false)
  const [selectedAgentIds, setSelectedAgentIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [reassignTargetId, setReassignTargetId] = useState('')
  const [bulkReassigning, setBulkReassigning] = useState(false)
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

  // Sync table rows whenever booth assignments reload
  useEffect(() => {
    setTableRows(boothAssignments.map(a => ({
      _key: a.id,
      id: a.id,
      monitor_id: a.monitor_id,
      booth_from: String(a.booth_from),
      booth_to: String(a.booth_to),
      _dirty: false,
      _saving: false,
    })))
  }, [boothAssignments])

  // Returns place names for a monitor based on their booth assignment ranges
  function getMonitorPlaces(monitorId) {
    const ranges = boothAssignments.filter(b => b.monitor_id === monitorId)
    const matched = new Set()
    for (const r of ranges) {
      for (const p of places) {
        if (r.booth_from <= p.booth_to && r.booth_to >= p.booth_from) matched.add(p.name)
      }
    }
    return [...matched]
  }

  async function loadAllContentDates() {
    const client = supabaseAdmin ?? supabase
    const { data } = await client.from('daily_content').select('content_date').limit(10000)
    if (data) setAllContentDates([...new Set(data.map(r => r.content_date))])
  }

  async function loadBase() {
    setLoading(true)
    setError('')
    try {
      // Use supabaseAdmin (service role) when available so RLS never silently
      // filters out agents — the explicit .eq() filters still scope to this
      // constituency, so security is maintained by the query itself.
      const client = supabaseAdmin ?? supabase
      const [monitorsRes, agentsRes, boothRes, placesRes] = await Promise.all([
        client.from('profiles').select('*').eq('role', 'monitor').eq('constituency_id', constituencyId).order('full_name').limit(5000),
        client.from('digital_agents').select('*').eq('constituency_id', constituencyId).order('booth_number').limit(50000),
        client.from('monitor_booth_assignments').select('*').eq('constituency_id', constituencyId).order('booth_from'),
        client.from('places').select('*').eq('constituency_id', constituencyId).order('booth_from'),
      ])
      if (monitorsRes.error) throw monitorsRes.error
      if (agentsRes.error) throw agentsRes.error
      setMonitors(monitorsRes.data ?? [])
      setAgents(agentsRes.data ?? [])
      setBoothAssignments(boothRes.data ?? [])
      setPlaces(placesRes.data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDateData() {
    setError('')
    try {
      const client = supabaseAdmin ?? supabase
      // Fetch all content for the date, then client-side filter by constituency.
      // The PostgREST JSONB-contains syntax is fragile with array types, so we
      // filter in JS: keep rows where target_constituencies is null (broadcast)
      // or where the array contains this constituency's ID.
      const { data: allContents, error: ce } = await client
        .from('daily_content')
        .select('*')
        .eq('content_date', selectedDate)
        .order('created_at')
      if (ce) throw ce
      const dateContents = (allContents ?? []).filter(c =>
        c.target_constituencies == null ||
        (Array.isArray(c.target_constituencies) && c.target_constituencies.includes(constituencyId))
      )
      setContents(dateContents)

      if (dateContents.length && agents.length) {
        const { data: logs, error: le } = await client
          .from('compliance_logs')
          .select('agent_id, content_id, platform, is_checked')
          .in('content_id', dateContents.map(c => c.id))
          .in('agent_id', agents.map(a => a.id))
          .limit(100000)
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
      const client = supabaseAdmin ?? supabase
      const fromDate = daysAgoIST(30)

      // Fetch content with target_constituencies so we can filter to this constituency only
      const { data: allRecentContent } = await client
        .from('daily_content')
        .select('id, target_constituencies')
        .gte('content_date', fromDate)

      // Only count content that was actually sent to this constituency
      const relevantContent = (allRecentContent ?? []).filter(c =>
        c.target_constituencies == null ||
        (Array.isArray(c.target_constituencies) && c.target_constituencies.includes(constituencyId))
      )
      const contentIds = relevantContent.map(c => c.id)
      if (!contentIds.length) { setPerfData({ monitors: {}, agents: {} }); return }

      const { data: logs } = await client
        .from('compliance_logs')
        .select('agent_id, content_id, platform, is_checked')
        .in('content_id', contentIds)
        .in('agent_id', agents.map(a => a.id))
        .eq('is_checked', true)
        .limit(200000)

      // Per agent: track total checks and fully-done content items
      const agentMap = {} // { [agent_id]: { [content_id]: platform_count } }
      for (const log of logs ?? []) {
        if (!agentMap[log.agent_id]) agentMap[log.agent_id] = {}
        agentMap[log.agent_id][log.content_id] = (agentMap[log.agent_id][log.content_id] ?? 0) + 1
      }

      const agentPerf = {}
      for (const a of agents) {
        const map = agentMap[a.id] ?? {}
        const totalChecks = Object.values(map).reduce((s, c) => s + c, 0)
        const fullyPosted = Object.values(map).filter(c => c === 3).length
        // rate = overall compliance (total checks / total opportunities across all 3 platforms)
        agentPerf[a.id] = {
          fullyPosted,
          total: contentIds.length,
          rate: pct(totalChecks, contentIds.length * PLATFORMS.length),
        }
      }

      // Per monitor: aggregate their agents' compliance rates
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

  // Per-monitor stats for selected date + optional content filter
  function getMonitorStats(monitorId, filterContentId = null) {
    const mAgents = agents.filter(a => a.assigned_monitor_id === monitorId)
    const contentIds = filterContentId
      ? [filterContentId]
      : contents.map(c => c.id)
    const total = mAgents.length

    if (!total || !contentIds.length) return { total, done: 0, donePct: 0, platformPct: {} }

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

    // donePct = overall compliance rate across all platforms (non-zero even when partial checks exist)
    const totalChecks = platformChecked.whatsapp + platformChecked.facebook + platformChecked.instagram
    return {
      total,
      done,
      donePct: pct(totalChecks, opportunities * PLATFORMS.length),
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
    const now = new Date().toISOString()
    let hasError = false
    for (const agentId of [...selectedAgentIds]) {
      const agent = agents.find(a => a.id === agentId)
      const { error } = await supabase.from('digital_agents').update({
        assigned_monitor_id: newMonitorId,
        reassigned_from: agent?.assigned_monitor_id ?? null,
        reassigned_at: now,
      }).eq('id', agentId)
      if (error) { setError(error.message); hasError = true; break }
    }
    if (!hasError) { setSelectedAgentIds(new Set()); setReassignTargetId(''); loadBase() }
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

  // Find which monitor owns a given booth number based on assignments
  function findMonitorForBooth(boothNum) {
    if (!boothNum && boothNum !== 0) return null
    const n = parseInt(boothNum)
    if (isNaN(n)) return null
    return boothAssignments.find(a => n >= a.booth_from && n <= a.booth_to)?.monitor_id ?? null
  }

  async function saveEditAgent(agentId) {
    setSavingEdit(true)
    const newBooth = editAgentValues.booth_number !== '' ? parseInt(editAgentValues.booth_number) : null
    const updateData = {
      name: editAgentValues.name.trim(),
      phone: editAgentValues.phone.trim() || null,
      booth_number: newBooth,
      fb_url: editAgentValues.fb_url.trim() || null,
      ig_url: editAgentValues.ig_url.trim() || null,
    }
    // Auto-reassign to correct monitor based on booth range
    if (newBooth != null) {
      const assignedMonitor = findMonitorForBooth(newBooth)
      if (assignedMonitor !== null) {
        const agent = agents.find(a => a.id === agentId)
        updateData.assigned_monitor_id = assignedMonitor
        updateData.reassigned_from = agent?.assigned_monitor_id ?? null
        updateData.reassigned_at = new Date().toISOString()
      }
    }
    const { error } = await supabase.from('digital_agents').update(updateData).eq('id', agentId)
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

  async function saveEditMonitor(monitorId) {
    if (!editMonitorValues.full_name.trim()) return
    setSavingMonitorEdit(true)
    const client = supabaseAdmin ?? supabase
    const { error } = await client.from('profiles').update({
      full_name: editMonitorValues.full_name.trim(),
      phone: editMonitorValues.phone.trim() || null,
    }).eq('id', monitorId)
    if (error) setError(error.message)
    else { setEditingMonitorId(null); loadBase() }
    setSavingMonitorEdit(false)
  }

  // ── BOOTH TABLE ROW OPERATIONS ──────────────────────────
  function addTableRow() {
    const key = '_new_' + Date.now()
    setTableRows(prev => [...prev, { _key: key, id: null, monitor_id: '', booth_from: '', booth_to: '', _dirty: true, _saving: false }])
  }

  function updateTableRow(key, field, value) {
    setTableRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value, _dirty: true } : r))
  }

  async function saveTableRow(key) {
    const row = tableRows.find(r => r._key === key)
    if (!row) return
    const from = parseInt(row.booth_from)
    const to = parseInt(row.booth_to)
    if (!row.monitor_id) { setError('Select a monitor for this row'); return }
    if (isNaN(from) || isNaN(to) || from > to) { setError(`Invalid range: From (${row.booth_from}) must be ≤ To (${row.booth_to})`); return }
    setTableRows(prev => prev.map(r => r._key === key ? { ...r, _saving: true } : r))
    if (row.id) {
      const { error } = await supabase.from('monitor_booth_assignments')
        .update({ monitor_id: row.monitor_id, booth_from: from, booth_to: to })
        .eq('id', row.id)
      if (error) { setError(error.message); setTableRows(prev => prev.map(r => r._key === key ? { ...r, _saving: false } : r)); return }
      setTableRows(prev => prev.map(r => r._key === key ? { ...r, _dirty: false, _saving: false } : r))
    } else {
      const { data, error } = await supabase.from('monitor_booth_assignments')
        .insert({ monitor_id: row.monitor_id, constituency_id: constituencyId, booth_from: from, booth_to: to })
        .select().single()
      if (error) { setError(error.message); setTableRows(prev => prev.map(r => r._key === key ? { ...r, _saving: false } : r)); return }
      setTableRows(prev => prev.map(r => r._key === key ? { ...r, id: data.id, _key: data.id, _dirty: false, _saving: false } : r))
    }
    // Refresh assignments for auto-assign
    const { data: fresh } = await supabase.from('monitor_booth_assignments').select('*').eq('constituency_id', constituencyId).order('booth_from')
    setBoothAssignments(fresh ?? [])
  }

  async function deleteTableRow(key) {
    const row = tableRows.find(r => r._key === key)
    if (!row) return
    if (row.id) {
      if (!window.confirm('Delete this booth range?')) return
      const { error } = await supabase.from('monitor_booth_assignments').delete().eq('id', row.id)
      if (error) { setError(error.message); return }
      const { data: fresh } = await supabase.from('monitor_booth_assignments').select('*').eq('constituency_id', constituencyId).order('booth_from')
      setBoothAssignments(fresh ?? [])
    }
    setTableRows(prev => prev.filter(r => r._key !== key))
  }

  // Auto-assign all agents to monitors based on booth ranges
  async function handleAutoAssign() {
    if (!window.confirm(`Auto-assign all ${agents.length} agents to monitors based on booth ranges?\nAgents outside any range stay unchanged.`)) return
    setAutoAssigning(true)
    setAutoAssignResult(null)
    let assigned = 0, skipped = 0
    for (const agent of agents) {
      if (!agent.booth_number) { skipped++; continue }
      const monitorId = findMonitorForBooth(agent.booth_number)
      if (monitorId === null) { skipped++; continue }
      if (agent.assigned_monitor_id === monitorId) { skipped++; continue }
      const { error } = await supabase.from('digital_agents')
        .update({ assigned_monitor_id: monitorId })
        .eq('id', agent.id)
      if (error) { setError(error.message); break }
      assigned++
    }
    setAutoAssigning(false)
    setAutoAssignResult({ assigned, skipped })
    loadBase()
  }

  const unassigned = agents.filter(a => !a.assigned_monitor_id)
  const isToday = selectedDate === TODAY

  const boothFilterActive = boothFrom !== '' || boothTo !== ''
  const filteredAgents = agents.filter(a => {
    if (filterMonitorId === 'unassigned' && a.assigned_monitor_id) return false
    if (filterMonitorId && filterMonitorId !== 'unassigned' && a.assigned_monitor_id !== filterMonitorId) return false
    if (filterPlaceName) {
      const plRows = places.filter(p => p.name === filterPlaceName)
      if (!plRows.some(p => a.booth_number != null && a.booth_number >= p.booth_from && a.booth_number <= p.booth_to)) return false
    }
    if (boothFilterActive) {
      const b = parseInt(a.booth_number)
      const from = boothFrom !== '' ? parseInt(boothFrom) : -Infinity
      const to   = boothTo   !== '' ? parseInt(boothTo)   : Infinity
      if (isNaN(b) || b < from || b > to) return false
    }
    if (filterInvalidLinks) {
      const fbBad = !a.fb_url || isValidLink(a.fb_url) === false
      const igBad = !a.ig_url || isValidLink(a.ig_url) === false
      if (!fbBad && !igBad) return false
    }
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

  // Build platform URL for compliance badge links
  function platformHref(platform, a) {
    if (platform === 'whatsapp') {
      const digits = a.phone?.replace(/\D/g, '')
      if (!digits) return null
      return `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`
    }
    if (platform === 'facebook')  return isValidLink(a.fb_url) ? a.fb_url : null
    if (platform === 'instagram') return isValidLink(a.ig_url) ? a.ig_url : null
    return null
  }

  // Read-only compliance badges: green + link if monitor marked done, gray if not
  function ComplianceBadges({ a }) {
    if (!checkContentId) return null
    return (
      <div className="flex gap-1 shrink-0">
        {[
          { p: 'whatsapp', l: 'WA' },
          { p: 'facebook',  l: 'FB' },
          { p: 'instagram', l: 'IG' },
        ].map(({ p, l }) => {
          const checked = logMap[a.id]?.[checkContentId]?.[p]?.is_checked ?? false
          const href    = checked ? platformHref(p, a) : null
          const cls     = checked
            ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
            : 'bg-gray-100 text-gray-300 border-gray-200 cursor-default'
          const shared  = `text-xs font-bold px-2 py-0.5 rounded-lg border transition-colors ${cls}`
          return href
            ? <a key={p} href={href} target="_blank" rel="noopener noreferrer" className={shared} title={`Open ${p} profile`}>{l} ✓</a>
            : <span key={p} className={shared}>{l}</span>
        })}
      </div>
    )
  }

  async function handleExport() {
    setExporting(true)
    try {
      const client = supabaseAdmin ?? supabase
      const [freshAgents, freshMonitors, freshBooths, freshPlaces] = await Promise.all([
        client.from('digital_agents').select('*').eq('constituency_id', constituencyId).limit(50000).then(r => r.data ?? []),
        client.from('profiles').select('*').eq('role', 'monitor').eq('constituency_id', constituencyId).limit(5000).then(r => r.data ?? []),
        client.from('monitor_booth_assignments').select('*').eq('constituency_id', constituencyId).then(r => r.data ?? []),
        client.from('places').select('*').eq('constituency_id', constituencyId).then(r => r.data ?? []),
      ])
      exportMasterReport({
        constituencies: [{ id: constituencyId, name: profile?.constituencies?.name ?? 'Constituency' }],
        agentsMap:   { [constituencyId]: freshAgents },
        monitorsMap: { [constituencyId]: freshMonitors },
        boothMap:    { [constituencyId]: freshBooths },
        placesMap:   { [constituencyId]: freshPlaces },
        sortBy: exportSortBy,
        singleConstId: constituencyId,
      })
    } finally {
      setExporting(false)
    }
  }

  async function handlePlaceExport() {
    setExportingPlace(true)
    try {
      const client = supabaseAdmin ?? supabase
      const [freshAgents, freshMonitors, freshBooths, freshPlaces] = await Promise.all([
        client.from('digital_agents').select('*').eq('constituency_id', constituencyId).limit(50000).then(r => r.data ?? []),
        client.from('profiles').select('*').eq('role', 'monitor').eq('constituency_id', constituencyId).limit(5000).then(r => r.data ?? []),
        client.from('monitor_booth_assignments').select('*').eq('constituency_id', constituencyId).then(r => r.data ?? []),
        client.from('places').select('*').eq('constituency_id', constituencyId).then(r => r.data ?? []),
      ])
      exportPlaceWiseReport({
        constituencies: [{ id: constituencyId, name: profile?.constituencies?.name ?? 'Constituency' }],
        agentsMap:   { [constituencyId]: freshAgents },
        monitorsMap: { [constituencyId]: freshMonitors },
        boothMap:    { [constituencyId]: freshBooths },
        placesMap:   { [constituencyId]: freshPlaces },
        singleConstId: constituencyId,
      })
    } finally {
      setExportingPlace(false)
    }
  }

  async function handlePlacePerformanceExport() {
    setExportingPlacePerf(true)
    try {
      const client = supabaseAdmin ?? supabase
      const [freshAgents, freshMonitors, freshBooths, freshPlaces] = await Promise.all([
        client.from('digital_agents').select('*').eq('constituency_id', constituencyId).limit(50000).then(r => r.data ?? []),
        client.from('profiles').select('*').eq('role', 'monitor').eq('constituency_id', constituencyId).limit(5000).then(r => r.data ?? []),
        client.from('monitor_booth_assignments').select('*').eq('constituency_id', constituencyId).then(r => r.data ?? []),
        client.from('places').select('*').eq('constituency_id', constituencyId).then(r => r.data ?? []),
      ])

      const { data: allContent } = await client
        .from('daily_content')
        .select('id, title, content_date, target_constituencies')
        .eq('content_date', selectedDate)
      const dateContents = (allContent ?? []).filter(c =>
        c.target_constituencies == null ||
        (Array.isArray(c.target_constituencies) && c.target_constituencies.includes(constituencyId))
      )

      let freshLogs = []
      if (dateContents.length && freshAgents.length) {
        const { data: logs } = await client
          .from('compliance_logs')
          .select('agent_id, content_id, platform, is_checked')
          .in('content_id', dateContents.map(c => c.id))
          .in('agent_id', freshAgents.map(a => a.id))
          .eq('is_checked', true)
          .limit(100000)
        freshLogs = logs ?? []
      }

      exportPlacePerformanceReport({
        constituencies: [{ id: constituencyId, name: profile?.constituencies?.name ?? 'Constituency' }],
        agentsMap:   { [constituencyId]: freshAgents },
        monitorsMap: { [constituencyId]: freshMonitors },
        boothMap:    { [constituencyId]: freshBooths },
        placesMap:   { [constituencyId]: freshPlaces },
        contentsMap: { [constituencyId]: dateContents },
        logsMap:     { [constituencyId]: freshLogs },
        singleConstId: constituencyId,
        date: selectedDate,
      })
    } finally {
      setExportingPlacePerf(false)
    }
  }

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

      {showBulkMonitor && (
        <BulkMonitorImport
          constituencyId={constituencyId}
          onImported={loadBase}
          onClose={() => setShowBulkMonitor(false)}
        />
      )}

      {showAddContent && (
        <AddContentModal
          lockedConstituencyId={constituencyId}
          onAdded={() => { loadDateData(); setShowAddContent(false) }}
          onClose={() => setShowAddContent(false)}
        />
      )}

      {showAddAgent && (
        <AddAgentModal
          constituencyId={constituencyId}
          userId={profile?.id}
          boothAssignments={boothAssignments}
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
              { label: "Content Today", value: contents.length, icon: '📋', warn: contents.length === 0 },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-xl border p-4 ${s.warn ? 'border-orange-200 bg-orange-50' : 'border-gray-200'}`}>
                <div className="text-xl mb-1">{s.icon}</div>
                <div className={`text-2xl font-bold ${s.warn ? 'text-orange-600' : 'text-gray-900'}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Date picker + Add Content */}
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCalendar(v => !v)}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-300 transition-colors"
              >
                <span>📅</span>
                <span>{isToday ? `Today — ${displayDate}` : displayDate}</span>
                <span className="ml-1 text-gray-400">{showCalendar ? '▲' : '▼'}</span>
              </button>
              <button
                onClick={() => setShowAddContent(true)}
                className="ml-auto bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shrink-0"
              >
                + Add Content
              </button>
            </div>
            {showCalendar && (
              <div className="mt-2 max-w-sm">
                <MiniCalendar
                  value={selectedDate}
                  onChange={d => { setSelectedDate(d); setShowCalendar(false); setOverviewContentId(null) }}
                  markedDates={allContentDates}
                />
              </div>
            )}
          </div>

          {contents.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center space-y-3">
              <p className="text-gray-400 text-sm">No content published on {isToday ? 'today' : displayDate}.</p>
              <button
                onClick={() => setShowAddContent(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-xl"
              >
                + Add Content for {isToday ? 'Today' : displayDate}
              </button>
            </div>
          ) : (
            <>
              {/* Content selector — "All" + one chip per content */}
              {contents.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                  <button
                    onClick={() => setOverviewContentId(null)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      overviewContentId === null
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    All ({contents.length})
                  </button>
                  {contents.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => setOverviewContentId(c.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors max-w-[160px] truncate ${
                        overviewContentId === c.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                      title={c.title}
                    >
                      {i + 1}. {c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Alert banner for lagging monitors */}
              {(() => {
                const lagging = monitors.filter(m => {
                  const s = getMonitorStats(m.id, overviewContentId)
                  return s.total > 0 && s.donePct === 0
                })
                const behind = monitors.filter(m => {
                  const s = getMonitorStats(m.id, overviewContentId)
                  return s.total > 0 && s.donePct > 0 && s.donePct < 50
                })
                if (!lagging.length && !behind.length) return null
                return (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
                    {lagging.length > 0 && (
                      <p className="text-sm font-semibold text-red-700">
                        🚨 {lagging.length} monitor{lagging.length > 1 ? 's' : ''} at 0% — no agents verified yet: {lagging.map(m => m.full_name).join(', ')}
                      </p>
                    )}
                    {behind.length > 0 && (
                      <p className="text-sm text-red-600">
                        ⚠ {behind.length} monitor{behind.length > 1 ? 's' : ''} below 50%: {behind.map(m => m.full_name).join(', ')}
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* Monitor performance cards — sorted worst first */}
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Monitor Performance</h3>
                {overviewContentId && (
                  <p className="text-xs text-indigo-600 font-medium mb-3">
                    Filtered: {contents.find(c => c.id === overviewContentId)?.title}
                  </p>
                )}
                <div className="space-y-3">
                  {[...monitors]
                    .map(m => ({ m, stats: getMonitorStats(m.id, overviewContentId) }))
                    .sort((a, b) => a.stats.donePct - b.stats.donePct)
                    .map(({ m, stats }) => {
                    const statusColor = stats.donePct === 100 ? 'border-green-200 bg-green-50' : stats.donePct > 50 ? 'border-yellow-200 bg-yellow-50' : stats.total > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'
                    const phone = m.phone?.replace(/\D/g, '') || ''
                    const mAgents = agents.filter(a => a.assigned_monitor_id === m.id)

                    return (
                      <div key={m.id} className={`bg-white rounded-xl border p-4 ${statusColor}`}>
                        <div className="flex items-start justify-between mb-3 gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900">{m.full_name}</p>
                            {(() => { const ps = getMonitorPlaces(m.id); return ps.length > 0 && <p className="text-xs text-indigo-500 mt-0.5">{ps.join(' · ')}</p> })()}
                            <p className="text-xs text-gray-500">{stats.total} agents</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {phone && stats.total > 0 && stats.donePct < 80 && (
                              <a href={`https://wa.me/${phone.length === 10 ? '91' + phone : phone}`}
                                target="_blank" rel="noopener noreferrer"
                                title="WhatsApp monitor to follow up"
                                className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg">
                                💬 Remind
                              </a>
                            )}
                            {/* Platform % chips — WA / FB / IG */}
                            {stats.total > 0 ? (
                              <div className="flex gap-2">
                                {[
                                  { label: 'WA', pct: stats.platformPct?.whatsapp ?? 0, color: 'text-emerald-600' },
                                  { label: 'FB', pct: stats.platformPct?.facebook  ?? 0, color: 'text-blue-600' },
                                  { label: 'IG', pct: stats.platformPct?.instagram  ?? 0, color: 'text-pink-600' },
                                ].map(({ label, pct, color }) => (
                                  <div key={label} className="text-center min-w-[34px]">
                                    <div className={`text-sm font-bold ${color}`}>{pct}%</div>
                                    <div className="text-xs text-gray-400">{label}</div>
                                  </div>
                                ))}
                              </div>
                            ) : <span className="text-gray-400 text-sm">—</span>}
                          </div>
                        </div>

                        {/* Platform progress bars */}
                        {stats.total > 0 && (
                          <div className="space-y-1.5 border-t border-gray-100/80 pt-3">
                            {[
                              { p: 'whatsapp', label: 'WA', barColor: 'bg-emerald-400' },
                              { p: 'facebook',  label: 'FB', barColor: 'bg-blue-400' },
                              { p: 'instagram', label: 'IG', barColor: 'bg-pink-400' },
                            ].map(({ p, label, barColor }) => (
                              <div key={p} className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500 w-6">{label}</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${stats.platformPct[p] ?? 0}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Per-content breakdown — all contents shown, selected one highlighted */}
                        {contents.length > 0 && stats.total > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {contents.map(c => {
                              const doneCnt = mAgents.filter(a =>
                                PLATFORMS.every(p => logMap[a.id]?.[c.id]?.[p]?.is_checked)
                              ).length
                              const isSelected = overviewContentId === c.id
                              const allDone = doneCnt === mAgents.length
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => setOverviewContentId(overviewContentId === c.id ? null : c.id)}
                                  title={c.title}
                                  className={`text-xs rounded-lg px-2 py-1 border transition-colors ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : allDone
                                      ? 'bg-green-50 border-green-200 text-green-700'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                                  }`}
                                >
                                  <span className="opacity-70">{c.title.slice(0, 10)}{c.title.length > 10 ? '…' : ''} </span>
                                  <span className="font-bold">{doneCnt}/{mAgents.length}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        <button
                          onClick={() => setDrillMonitor({
                            monitor: m,
                            agents: mAgents,
                            contentIds: overviewContentId ? [overviewContentId] : contents.map(c => c.id),
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
                                <div>
                                  <p className="font-semibold text-gray-900">{m.full_name}</p>
                                  {(() => { const ps = getMonitorPlaces(m.id); return ps.length > 0 && <p className="text-xs text-indigo-500">{ps.join(' · ')}</p> })()}
                                </div>
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
            {/* Export master report */}
            <div className="flex items-center gap-1 shrink-0 border border-emerald-300 rounded-xl overflow-hidden bg-white">
              <select
                value={exportSortBy}
                onChange={e => setExportSortBy(e.target.value)}
                className="text-xs text-emerald-700 font-medium px-2 py-2 bg-transparent focus:outline-none"
              >
                <option value="booth">Booth order</option>
                <option value="place">Place order</option>
              </select>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold px-3 py-2"
                title="Download master Excel report"
              >
                {exporting ? 'Fetching…' : '⬇ Master'}
              </button>
              <button
                onClick={handlePlaceExport}
                disabled={exportingPlace}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-3 py-2"
                title="Download place-wise Excel report"
              >
                {exportingPlace ? 'Fetching…' : '⬇ Place-wise'}
              </button>
              <button
                onClick={handlePlacePerformanceExport}
                disabled={exportingPlacePerf}
                className="text-xs bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold px-3 py-2 rounded-r-lg"
                title={`WA/FB/IG compliance by place for ${selectedDate}`}
              >
                {exportingPlacePerf ? 'Fetching…' : '⬇ Place Perf'}
              </button>
            </div>
            <div className="flex-1 min-w-[160px]">
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
            {/* Check Compliance toggle */}
            <button
              onClick={() => { setCheckMode(v => !v); if (!checkMode) loadDateData() }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                checkMode ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-400'
              }`}
            >
              ✅ {checkMode ? 'Exit Check' : 'Check Compliance'}
            </button>
            {/* Booth filter toggle */}
            <button
              onClick={() => { setShowBoothFilter(v => !v); if (showBoothFilter) { setBoothFrom(''); setBoothTo('') } }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                boothFilterActive
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              📍 Booth {boothFilterActive ? `${boothFrom || '?'}–${boothTo || '?'}` : 'Filter'}
              {boothFilterActive && (
                <span onClick={e => { e.stopPropagation(); setBoothFrom(''); setBoothTo(''); setShowBoothFilter(false) }}
                  className="ml-1 text-zinc-300 hover:text-white text-xs">✕</span>
              )}
            </button>
          </div>

          {/* ── Compliance check panel ── */}
          {checkMode && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-violet-800 shrink-0">Check Date:</span>
              <input
                type="date" value={selectedDate} max={TODAY}
                onChange={e => { setSelectedDate(e.target.value); setCheckContentId('') }}
                className="px-2.5 py-1.5 border border-violet-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {contents.length > 0 ? (
                <>
                  <span className="text-xs font-bold text-violet-800 shrink-0">Content:</span>
                  <select value={checkContentId} onChange={e => setCheckContentId(e.target.value)}
                    className="flex-1 min-w-[180px] px-2.5 py-1.5 border border-violet-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">— select content —</option>
                    {contents.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  {checkContentId
                    ? <span className="text-xs text-violet-600">Green ✓ = monitor marked done — click to open their actual profile and verify</span>
                    : <span className="text-xs text-violet-400">Select a content item above</span>
                  }
                </>
              ) : (
                <span className="text-xs text-violet-500">No content for {displayDate} — change date</span>
              )}
            </div>
          )}

          {/* Booth range filter panel */}
          {showBoothFilter && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Booth range:</span>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="From" value={boothFrom}
                  onChange={e => setBoothFrom(e.target.value)}
                  className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="text-slate-400 font-bold">—</span>
                <input type="number" placeholder="To" value={boothTo}
                  onChange={e => setBoothTo(e.target.value)}
                  className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              {boothFilterActive && (
                <span className="text-xs text-slate-500">
                  {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} shown
                </span>
              )}
            </div>
          )}

          {/* ── Place filter chips — deduplicated by name ── */}
          {places.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              <span className="shrink-0 text-xs font-semibold text-indigo-500 self-center pr-1">📍 Place:</span>
              <button
                onClick={() => { setFilterPlaceName(''); setSelectedAgentIds(new Set()) }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  !filterPlaceName ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-400'
                }`}
              >
                All places
              </button>
              {/* Unique names sorted by the lowest booth_from across their rows */}
              {[...new Map(
                [...places].sort((a, b) => a.booth_from - b.booth_from).map(p => [p.name, p])
              ).values()].map(pl => {
                const plRows = places.filter(p => p.name === pl.name)
                const count  = agents.filter(a =>
                  a.booth_number != null &&
                  plRows.some(p => a.booth_number >= p.booth_from && a.booth_number <= p.booth_to)
                ).length
                return (
                  <button key={pl.name}
                    onClick={() => { setFilterPlaceName(filterPlaceName === pl.name ? '' : pl.name); setSelectedAgentIds(new Set()) }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      filterPlaceName === pl.name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-400'
                    }`}
                  >
                    {pl.name} · {count}
                  </button>
                )
              })}
            </div>
          )}


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
            {/* Invalid links chip */}
            {(() => {
              const invalidCount = agents.filter(a =>
                !a.fb_url || !a.ig_url || isValidLink(a.fb_url) === false || isValidLink(a.ig_url) === false
              ).length
              return invalidCount > 0 ? (
                <button
                  onClick={() => { setFilterInvalidLinks(v => !v); setSelectedAgentIds(new Set()) }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    filterInvalidLinks
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400'
                  }`}
                >
                  ⚠ Link Issues · {invalidCount}
                </button>
              ) : null
            })()}
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

          {/* ── Agent list — place-grouped OR flat ── */}
          {filterPlaceName ? (
            /* ── Place view: monitor sections with agent rows ── */
            <div className="space-y-3">
              {(() => {
                const plRows = places.filter(p => p.name === filterPlaceName)
                const pl = plRows[0] // for display purposes
                const groups = []
                for (const m of monitors) {
                  const mAgents = filteredAgents.filter(a => a.assigned_monitor_id === m.id)
                    .sort((a, b) => (a.booth_number ?? 9999) - (b.booth_number ?? 9999))
                  if (mAgents.length) groups.push({ m, mAgents })
                }
                const unassignedInPlace = filteredAgents.filter(a => !a.assigned_monitor_id)
                  .sort((a, b) => (a.booth_number ?? 9999) - (b.booth_number ?? 9999))
                if (unassignedInPlace.length) groups.push({ m: null, mAgents: unassignedInPlace })

                return (
                  <>
                    {pl && (
                      <div className="flex items-center justify-between px-1">
                        <p className="text-sm font-bold text-indigo-700">{filterPlaceName} <span className="font-normal text-indigo-400">· {plRows.sort((a,b)=>a.booth_from-b.booth_from).map(r=>`${r.booth_from}–${r.booth_to}`).join(', ')}</span></p>
                        <span className="text-xs text-indigo-500">{filteredAgents.length} agents</span>
                      </div>
                    )}
                    {groups.map(({ m, mAgents }) => (
                      <div key={m?.id ?? '__unassigned'} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Monitor header */}
                        <div className="px-4 py-2.5 bg-zinc-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{m?.full_name ?? '(Unassigned)'}</span>
                            {m?.phone && <span className="text-xs text-zinc-400">{m.phone}</span>}
                          </div>
                          <span className="text-xs text-zinc-400">{mAgents.length} agents</span>
                        </div>
                        {/* Agent rows */}
                        <div className="divide-y divide-gray-100">
                          {mAgents.map(a => {
                            if (editingAgentId === a.id) {
                              return (
                                <div key={a.id} className="bg-amber-50 border-amber-200 p-3 space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-2">
                                      <input type="text" value={editAgentValues.name}
                                        onChange={e => setEditAgentValues(v => ({ ...v, name: e.target.value }))}
                                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Name" />
                                    </div>
                                    <input type="number" value={editAgentValues.booth_number}
                                      onChange={e => setEditAgentValues(v => ({ ...v, booth_number: e.target.value }))}
                                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none" placeholder="Booth #" />
                                    <input type="tel" value={editAgentValues.phone}
                                      onChange={e => setEditAgentValues(v => ({ ...v, phone: e.target.value }))}
                                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none" placeholder="Phone" />
                                    <input type="text" value={editAgentValues.fb_url}
                                      onChange={e => setEditAgentValues(v => ({ ...v, fb_url: e.target.value }))}
                                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none col-span-2" placeholder="FB URL" />
                                    <input type="text" value={editAgentValues.ig_url}
                                      onChange={e => setEditAgentValues(v => ({ ...v, ig_url: e.target.value }))}
                                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none col-span-2" placeholder="IG URL" />
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditingAgentId(null)} className="flex-1 border border-slate-300 text-slate-600 text-xs py-1.5 rounded-lg">Cancel</button>
                                    <button onClick={() => saveEditAgent(a.id)} disabled={savingEdit} className="flex-1 bg-red-600 text-white text-xs font-semibold py-1.5 rounded-lg">{savingEdit ? '…' : 'Save'}</button>
                                  </div>
                                </div>
                              )
                            }
                            const fbOk = isValidLink(a.fb_url)
                            const igOk = isValidLink(a.ig_url)
                            return (
                              <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
                                <span className="text-xs font-bold text-indigo-600 w-10 shrink-0 text-right">#{a.booth_number ?? '—'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                                  {a.phone && <p className="text-xs text-gray-400">{a.phone}</p>}
                                </div>
                                {/* Link status */}
                                <div className="flex items-center gap-1.5 shrink-0 text-xs">
                                  {a.fb_url
                                    ? <a href={fbOk ? a.fb_url : undefined} target="_blank" rel="noopener noreferrer"
                                        className={fbOk ? 'text-blue-400' : 'text-orange-400'}>
                                        {fbOk ? 'FB✓' : '⚠FB'}
                                      </a>
                                    : <span className="text-gray-200">FB–</span>
                                  }
                                  {a.ig_url
                                    ? <a href={igOk ? a.ig_url : undefined} target="_blank" rel="noopener noreferrer"
                                        className={igOk ? 'text-pink-400' : 'text-orange-400'}>
                                        {igOk ? 'IG✓' : '⚠IG'}
                                      </a>
                                    : <span className="text-gray-200">IG–</span>
                                  }
                                </div>
                                {/* Compliance badges (read-only, green links to platform) */}
                                {checkMode && <ComplianceBadges a={a} />}
                                <button onClick={() => startEditAgent(a)} className="text-slate-400 hover:text-slate-700 text-xs px-1.5 py-1 rounded hover:bg-slate-100">✏️</button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {groups.length === 0 && (
                      <p className="text-center py-8 text-gray-400 text-sm">No agents in this place.</p>
                    )}
                  </>
                )
              })()}
            </div>
          ) : (
            /* ── Normal flat list ── */
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
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Booth #</label>
                          <input type="number" value={editAgentValues.booth_number}
                            onChange={e => setEditAgentValues(v => ({ ...v, booth_number: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Phone
                            {editAgentValues.phone && isValidPhone(editAgentValues.phone) === false && (
                              <span className="ml-2 text-orange-500 normal-case font-normal">⚠ must be 10 digits</span>
                            )}
                          </label>
                          <input type="tel" value={editAgentValues.phone}
                            onChange={e => setEditAgentValues(v => ({ ...v, phone: e.target.value }))}
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                              editAgentValues.phone && isValidPhone(editAgentValues.phone) === false ? 'border-orange-400 bg-orange-50' : 'border-slate-300'
                            }`} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Facebook URL</label>
                          <input type="text" value={editAgentValues.fb_url}
                            onChange={e => setEditAgentValues(v => ({ ...v, fb_url: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="https://fb.com/…" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Instagram URL</label>
                          <input type="text" value={editAgentValues.ig_url}
                            onChange={e => setEditAgentValues(v => ({ ...v, ig_url: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="https://instagram.com/…" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditingAgentId(null)}
                          className="flex-1 border border-slate-300 text-slate-600 text-xs font-medium py-1.5 rounded-lg hover:bg-slate-50">Cancel</button>
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
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelectAgent(a.id)}
                      className="w-4 h-4 rounded accent-red-600 shrink-0" />
                    <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded-lg shrink-0 min-w-[2.5rem] text-center">
                      #{a.booth_number ?? '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {a.phone && (
                          <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                            {a.phone}
                            {isValidPhone(a.phone) === false && <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />}
                          </span>
                        )}
                        {!filterMonitorId && (mon
                          ? <span className="text-xs text-slate-500">{mon.full_name}</span>
                          : <span className="text-xs text-orange-500">Unassigned</span>
                        )}
                        {a.reassigned_from && (
                          <span className="text-xs text-amber-600 font-medium">
                            ↩ {monitors.find(m => m.id === a.reassigned_from)?.full_name ?? 'prev.'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Compliance badges (read-only, green = monitor marked; click to verify) */}
                      {checkMode && <><ComplianceBadges a={a} /><span className="w-px h-4 bg-gray-200 mx-0.5" /></>}
                      {/* Link URLs */}
                      {!checkMode && (
                        <>
                          {a.fb_url
                            ? <a href={isValidLink(a.fb_url) ? a.fb_url : undefined} target="_blank" rel="noopener noreferrer"
                                className={`text-xs px-1 ${isValidLink(a.fb_url) ? 'text-blue-400 hover:text-blue-600' : 'text-orange-400'}`}>
                                {isValidLink(a.fb_url) ? 'FB' : '⚠FB'}
                              </a>
                            : <span className="text-xs text-gray-200">FB–</span>
                          }
                          {a.ig_url
                            ? <a href={isValidLink(a.ig_url) ? a.ig_url : undefined} target="_blank" rel="noopener noreferrer"
                                className={`text-xs px-1 ${isValidLink(a.ig_url) ? 'text-pink-400 hover:text-pink-600' : 'text-orange-400'}`}>
                                {isValidLink(a.ig_url) ? 'IG' : '⚠IG'}
                              </a>
                            : <span className="text-xs text-gray-200">IG–</span>
                          }
                        </>
                      )}
                      <button onClick={() => startEditAgent(a)}
                        className="text-slate-400 hover:text-slate-700 text-xs px-1.5 py-1 rounded hover:bg-slate-100 transition-colors">✏️</button>
                      <button onClick={() => handleDeleteAgent(a.id, a.name)} disabled={deletingAgentId === a.id}
                        className="text-red-400 hover:text-red-600 text-xs px-1.5 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40">
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
                <div className="text-center py-8 text-gray-400 text-sm">No agents match the current filters.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MONITORS TAB ── */}
      {activeTab === 'Monitors' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-500">{monitors.length} monitors in this constituency</p>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkMonitor(true)}
                className="text-sm text-slate-600 font-medium border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50">
                Import CSV
              </button>
              <button onClick={() => setShowCreateMonitor(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                + Add Monitor
              </button>
            </div>
          </div>

          {/* Monitor cards */}
          <div className="space-y-3">
            {monitors.map(m => {
              const assignedCount = agents.filter(a => a.assigned_monitor_id === m.id).length
              const digits = m.phone?.replace(/\D/g, '') || ''
              const isEditingThis = editingMonitorId === m.id
              return (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  {isEditingThis ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name *</label>
                          <input type="text" value={editMonitorValues.full_name}
                            onChange={e => setEditMonitorValues(p => ({ ...p, full_name: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                          <input type="tel" value={editMonitorValues.phone}
                            onChange={e => setEditMonitorValues(p => ({ ...p, phone: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder="10-digit number" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">Email cannot be changed here (managed via authentication).</p>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingMonitorId(null)}
                          className="flex-1 border border-slate-300 text-slate-600 text-sm py-2 rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={() => saveEditMonitor(m.id)} disabled={savingMonitorEdit || !editMonitorValues.full_name.trim()}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold text-sm py-2 rounded-lg">
                          {savingMonitorEdit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{m.full_name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                          {m.phone
                            ? <p className="text-xs text-slate-600 font-medium mt-0.5">{m.phone}</p>
                            : <p className="text-xs text-orange-500 mt-0.5">No phone — click Edit to add</p>
                          }
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            assignedCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {assignedCount} agent{assignedCount !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => { setEditingMonitorId(m.id); setEditMonitorValues({ full_name: m.full_name, phone: m.phone ?? '' }) }}
                            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs px-2 py-1 rounded-lg transition-colors border border-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMonitor(m)}
                            disabled={deletingMonitorId === m.id}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-40 border border-red-200"
                          >
                            {deletingMonitorId === m.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      {digits && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                          <a href={`tel:+${digits}`}
                            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            📞 Call
                          </a>
                          <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            💬 WhatsApp
                          </a>
                        </div>
                      )}
                    </>
                  )}
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

      {/* ── BOOTHS TAB ── */}
      {activeTab === 'Booths' && (
        <div className="max-w-2xl space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-gray-900">Booth Assignments</h3>
              <p className="text-xs text-gray-500 mt-0.5">Edit directly in the table. Same monitor can have multiple ranges.</p>
            </div>
            <button
              onClick={handleAutoAssign}
              disabled={autoAssigning || boothAssignments.length === 0}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              {autoAssigning ? 'Assigning…' : '⚡ Auto-assign Agents'}
            </button>
          </div>

          {/* Auto-assign result */}
          {autoAssignResult && (
            <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 flex items-center justify-between">
              <span>✓ {autoAssignResult.assigned} agents reassigned · {autoAssignResult.skipped} skipped</span>
              <button onClick={() => setAutoAssignResult(null)} className="text-green-600 hover:text-green-800 ml-3 text-lg leading-none">&times;</button>
            </div>
          )}

          {/* Spreadsheet table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_80px_80px_72px] gap-0 bg-gray-50 border-b border-gray-200 px-3 py-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Monitor</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">From</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">To</span>
              <span />
            </div>

            {/* Data rows */}
            {tableRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                No rows yet — click "+ Add Row" below to start.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {tableRows.map(row => {
                  const rangeOk = row.booth_from !== '' && row.booth_to !== '' && parseInt(row.booth_from) <= parseInt(row.booth_to)
                  const canSave = row._dirty && row.monitor_id && rangeOk
                  return (
                    <div key={row._key} className={`grid grid-cols-[1fr_80px_80px_72px] gap-0 items-center px-2 py-1.5 ${row._dirty ? 'bg-amber-50' : ''}`}>
                      {/* Monitor dropdown */}
                      <select
                        value={row.monitor_id}
                        onChange={e => updateTableRow(row._key, 'monitor_id', e.target.value)}
                        className="w-full border-0 bg-transparent text-sm text-gray-800 py-1 px-1 focus:outline-none focus:ring-1 focus:ring-red-400 rounded"
                      >
                        <option value="">— select —</option>
                        {monitors.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>

                      {/* From */}
                      <input
                        type="number" min={1}
                        value={row.booth_from}
                        onChange={e => updateTableRow(row._key, 'booth_from', e.target.value)}
                        placeholder="From"
                        className="w-full border-0 bg-transparent text-sm text-gray-800 text-center py-1 px-1 focus:outline-none focus:ring-1 focus:ring-red-400 rounded tabular-nums"
                      />

                      {/* To */}
                      <input
                        type="number" min={1}
                        value={row.booth_to}
                        onChange={e => updateTableRow(row._key, 'booth_to', e.target.value)}
                        placeholder="To"
                        className="w-full border-0 bg-transparent text-sm text-gray-800 text-center py-1 px-1 focus:outline-none focus:ring-1 focus:ring-red-400 rounded tabular-nums"
                      />

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 pr-1">
                        <button
                          onClick={() => saveTableRow(row._key)}
                          disabled={!canSave || row._saving}
                          title="Save row"
                          className={`text-xs px-2 py-1 rounded font-semibold transition-colors ${
                            canSave && !row._saving
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {row._saving ? '…' : '✓'}
                        </button>
                        <button
                          onClick={() => deleteTableRow(row._key)}
                          title="Delete row"
                          className="text-xs px-2 py-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add row button */}
            <div className="border-t border-gray-100 px-3 py-2">
              <button
                onClick={addTableRow}
                className="text-sm text-red-600 hover:text-red-700 font-semibold flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span> Add Row
              </button>
            </div>
          </div>

          {/* Summary chips */}
          {monitors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {monitors.map(m => {
                const ranges = boothAssignments.filter(a => a.monitor_id === m.id)
                const count = agents.filter(a => a.assigned_monitor_id === m.id).length
                return (
                  <div key={m.id} className={`text-xs rounded-lg px-3 py-1.5 border ${
                    ranges.length > 0 ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-gray-50 border-dashed border-gray-200 text-gray-400'
                  }`}>
                    <span className="font-semibold">{m.full_name}</span>
                    {ranges.length > 0
                      ? <span className="ml-1 text-gray-400">· {ranges.map(r => `${r.booth_from}–${r.booth_to}`).join(', ')} · {count} agents</span>
                      : <span className="ml-1">· no range</span>
                    }
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Amber rows have unsaved changes. Click ✓ to save each row. ⚡ Auto-assign moves agents to matching monitors.
          </p>

          {/* ── Vacant Booths summary ── */}
          {(() => {
            const assigned = new Set(agents.map(a => a.booth_number).filter(n => n != null))

            // Build per-monitor vacant lists
            const monitorVacant = {}
            for (const m of monitors) {
              const mRanges = boothAssignments.filter(b => b.monitor_id === m.id)
              const mVacant = []
              for (const r of mRanges)
                for (let n = r.booth_from; n <= r.booth_to; n++)
                  if (!assigned.has(n)) mVacant.push(n)
              if (mVacant.length) monitorVacant[m.id] = { name: m.full_name, booths: mVacant }
            }

            const totalVacant = Object.values(monitorVacant).reduce((s, v) => s + v.booths.length, 0)
            if (!totalVacant) {
              return (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-green-600 text-lg">✅</span>
                  <span className="text-sm font-semibold text-green-700">All booths are assigned — no vacancies!</span>
                </div>
              )
            }

            // Group by place if places are set up
            const hasPlaces = places.length > 0
            let placeRows = null
            if (hasPlaces) {
              const placeMap = {}
              for (const [mId, { name: mName, booths }] of Object.entries(monitorVacant)) {
                for (const booth of booths) {
                  const place = places.find(p => booth >= p.booth_from && booth <= p.booth_to)
                  const key  = place?.name ?? '— No Place —'
                  const sort = place?.booth_from ?? 999999
                  if (!placeMap[key]) placeMap[key] = { sort, monitors: {} }
                  if (!placeMap[key].monitors[mId]) placeMap[key].monitors[mId] = { name: mName, booths: [] }
                  placeMap[key].monitors[mId].booths.push(booth)
                }
              }
              placeRows = Object.entries(placeMap).sort((a, b) => a[1].sort - b[1].sort)
            }

            return (
              <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                  <span className="font-semibold text-red-900 text-sm">Vacant Booths</span>
                  <span className="text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-full">{totalVacant} vacant</span>
                </div>

                {hasPlaces ? (
                  <div className="divide-y divide-gray-100">
                    {placeRows.map(([placeName, { monitors: placeMonitors }]) => {
                      const placeTotal = Object.values(placeMonitors).reduce((s, v) => s + v.booths.length, 0)
                      return (
                        <div key={placeName} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{placeName}</span>
                            <span className="text-xs text-gray-400">{placeTotal} vacant</span>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(placeMonitors).map(([mId, { name, booths }]) => (
                              <div key={mId} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                                <span className="text-xs font-semibold text-gray-700 w-36 shrink-0 pt-0.5 truncate" title={name}>{name}</span>
                                <div className="flex flex-wrap gap-1">
                                  {booths.sort((a, b) => a - b).map(n => (
                                    <span key={n} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5 font-medium">#{n}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {Object.entries(monitorVacant).map(([mId, { name, booths }]) => (
                      <div key={mId} className="px-4 py-3 flex flex-wrap items-start gap-x-3 gap-y-1">
                        <span className="text-xs font-semibold text-gray-700 w-36 shrink-0 pt-0.5 truncate" title={name}>{name}</span>
                        <div className="flex flex-wrap gap-1">
                          {booths.sort((a, b) => a - b).map(n => (
                            <span key={n} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5 font-medium">#{n}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
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
