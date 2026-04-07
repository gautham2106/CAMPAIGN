import { useEffect, useRef, useState } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { getTodayIST } from '../lib/dateUtils'
import Layout from '../components/Layout'
import AddContentModal from '../components/AddContentModal'
import MiniCalendar from '../components/MiniCalendar'
import * as XLSX from 'xlsx'

function CreateConstAdminModal({ constituencies, onCreated, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [constId, setConstId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!supabaseAdmin) { setError('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env'); return }
    if (!constId) { setError('Please select a constituency'); return }
    setSaving(true)
    setError('')
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (authErr) throw authErr
      const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
        id: authData.user.id,
        full_name: name.trim(),
        email,
        role: 'constituency_admin',
        constituency_id: constId,
      })
      if (profileErr) throw profileErr
      onCreated?.()
      onClose?.()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-950">
          <h2 className="text-base font-bold text-white">Add Constituency Admin</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Full Name *</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Admin's full name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Constituency *</label>
            <select required value={constId} onChange={e => setConstId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
              <option value="">Select constituency…</option>
              {constituencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Email *</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="admin@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Temporary Password *</label>
            <input type="text" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Min 8 characters" />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2 rounded-lg text-sm">
              {saving ? 'Creating…' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const TODAY = getTodayIST()
const PLATFORMS = ['whatsapp', 'facebook', 'instagram']
const P_LABEL = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram' }
const P_SHORT = { whatsapp: 'WA', facebook: 'FB', instagram: 'IG' }
const TABS = ['Dashboard', 'Admins', 'Content', 'Constituencies', 'Field Ops']

function isValidLink(url) {
  if (!url || !url.trim()) return null
  return /^(https?:\/\/|www\.).+\..+/.test(url.trim())
}

function pct(num, den) {
  if (!den) return 0
  return Math.round(num / den * 100)
}

function PctBadge({ value, size = 'sm' }) {
  const color = value >= 80 ? 'bg-green-100 text-green-700' : value >= 50 ? 'bg-yellow-100 text-yellow-700' : value > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
  return <span className={`${size === 'lg' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5'} font-bold rounded-full ${color}`}>{value}%</span>
}

function PlatformBar({ value, label }) {
  const barColor = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-400' : 'bg-red-400'
  const textColor = value >= 80 ? 'text-green-700' : value >= 50 ? 'text-yellow-700' : 'text-red-600'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-6">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${textColor}`}>{value}%</span>
    </div>
  )
}

function ContentCard({ c, isEditing, editValues, setEditValues, saving, onEdit, onSave, onCancel, onDelete, highlight }) {
  if (isEditing) {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Title *</label>
          <input type="text" value={editValues.title}
            onChange={e => setEditValues(v => ({ ...v, title: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Description</label>
          <textarea value={editValues.description} rows={2}
            onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Media Link</label>
          <input type="url" value={editValues.media_link}
            onChange={e => setEditValues(v => ({ ...v, media_link: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="https://drive.google.com/..."
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 border border-slate-300 text-slate-600 text-sm font-medium py-2 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={onSave} disabled={saving || !editValues.title?.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold py-2 rounded-lg">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl p-4 flex items-start gap-3 border ${
      highlight ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'
    }`}>
      <div className="flex-1 min-w-0">
        {!highlight && <p className="text-xs text-gray-400 mb-0.5">{c.content_date}</p>}
        <p className={`font-semibold text-sm ${highlight ? 'text-red-900' : 'text-gray-800'}`}>{c.title}</p>
        {c.description && <p className={`text-xs mt-0.5 line-clamp-2 ${highlight ? 'text-red-700' : 'text-gray-500'}`}>{c.description}</p>}
        {c.target_constituencies?.length > 0 && (
          <p className="text-xs text-zinc-400 mt-0.5">Targeted: {c.target_constituencies.length} constituency(ies)</p>
        )}
        {c.media_link && (
          <a href={c.media_link} target="_blank" rel="noopener noreferrer" className={`text-xs underline mt-1 inline-block ${highlight ? 'text-red-500' : 'text-blue-500'}`}>
            View media →
          </a>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={onEdit} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">✏️ Edit</button>
        <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">Delete</button>
      </div>
    </div>
  )
}

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [showCalendar, setShowCalendar] = useState(false)
  const [allContentDates, setAllContentDates] = useState([])

  const [constituencies, setConstituencies] = useState([])
  const [constAdmins, setConstAdmins] = useState([])
  const [allAgents, setAllAgents] = useState([])
  const [allMonitors, setAllMonitors] = useState([])
  const [boothAssignments, setBoothAssignments] = useState([])
  const [places, setPlaces] = useState([])
  const [contents, setContents] = useState([])
  const [dateContents, setDateContents] = useState([])

  // Constituency-level stats from view: { [content_id]: { [constituency_id]: { wa, fb, ig, all, total } } }
  const [logMap, setLogMap] = useState({})
  // Monitor-level stats from view: { [content_id]: { [monitor_id]: { wa, fb, ig, all, total } } }
  const [monitorLogMap, setMonitorLogMap] = useState({})

  const [loading, setLoading] = useState(true)
  const [showAddContent, setShowAddContent] = useState(false)
  const [showAddConstAdmin, setShowAddConstAdmin] = useState(false)
  const [deletingAdminId, setDeletingAdminId] = useState(null)
  const [newConstName, setNewConstName] = useState('')
  const [addingConst, setAddingConst] = useState(false)
  const [error, setError] = useState('')

  // Field Ops tab
  const [expandedConstId, setExpandedConstId] = useState(null)
  const [expandedMonitorId, setExpandedMonitorId] = useState(null)

  // Places Excel upload
  const [placesUploadConstId, setPlacesUploadConstId] = useState('')
  const [placesUploadRows, setPlacesUploadRows] = useState([])
  const [placesUploading, setPlacesUploading] = useState(false)
  const [placesUploadError, setPlacesUploadError] = useState('')
  const placesFileRef = useRef(null)

  // Per-constituency selected content filter in dashboard drill-down

  // Constituency rename/delete
  const [editingConstId, setEditingConstId] = useState(null)
  const [editConstName, setEditConstName] = useState('')
  const [deletingConstId, setDeletingConstId] = useState(null)

  // Content inline edit
  const [editingContentId, setEditingContentId] = useState(null)
  const [editContentValues, setEditContentValues] = useState({})
  const [savingContent, setSavingContent] = useState(false)

  useEffect(() => { loadBase().then(() => loadDateCompliance()) }, [])
  useEffect(() => { loadDateCompliance() }, [selectedDate])

  async function loadBase() {
    setLoading(true)
    setError('')
    try {
      const client = supabaseAdmin ?? supabase
      const [constRes, agentsRes, monitorsRes, adminsRes, contentRes, allDatesRes, boothRes, placesRes] = await Promise.all([
        client.from('constituencies').select('*').order('name'),
        client.from('digital_agents').select('*').limit(50000),
        client.from('profiles').select('id, full_name, email, phone, constituency_id').eq('role', 'monitor').limit(5000),
        client.from('profiles').select('id, full_name, email, constituency_id, constituencies(name)').eq('role', 'constituency_admin').limit(5000),
        client.from('daily_content').select('*').order('content_date', { ascending: false }).limit(50),
        client.from('daily_content').select('content_date'),
        client.from('monitor_booth_assignments').select('*'),
        client.from('places').select('*'),
      ])
      if (constRes.error) throw constRes.error
      setConstituencies(constRes.data ?? [])
      setAllAgents(agentsRes.data ?? [])
      setAllMonitors(monitorsRes.data ?? [])
      setConstAdmins(adminsRes.data ?? [])
      setContents(contentRes.data ?? [])
      setBoothAssignments(boothRes.data ?? [])
      setPlaces(placesRes.data ?? [])
      const unique = [...new Set((allDatesRes.data ?? []).map(r => r.content_date))]
      setAllContentDates(unique)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDateCompliance() {
    setError('')
    try {
      const client = supabaseAdmin ?? supabase

      // 1. Fetch constituency-level aggregated stats from view (for Dashboard tab)
      const { data: stats, error: se } = await client
        .from('constituency_content_stats')
        .select('*')
        .eq('content_date', selectedDate)
      if (se) throw se

      // Derive unique content items for the date (preserving order)
      const seen = new Set()
      const dc = []
      for (const row of stats ?? []) {
        if (!seen.has(row.content_id)) {
          seen.add(row.content_id)
          dc.push({ id: row.content_id, title: row.title, content_date: row.content_date, target_constituencies: row.target_constituencies })
        }
      }
      setDateContents(dc)

      // Build constLogMap: { [content_id]: { [constituency_id]: { wa, fb, ig, all, total } } }
      const constMap = {}
      for (const row of stats ?? []) {
        if (!constMap[row.content_id]) constMap[row.content_id] = {}
        constMap[row.content_id][row.constituency_id] = {
          total: row.total_agents,
          wa:    row.wa_done,
          fb:    row.fb_done,
          ig:    row.ig_done,
          all:   row.all_done,
        }
      }
      setLogMap(constMap)

      // 2. Fetch monitor-level stats from monitor_content_stats view (for Admins tab)
      // This is pre-aggregated in DB — no large data transfer, no URL limit issues
      const { data: monStats, error: me } = await client
        .from('monitor_content_stats')
        .select('content_id, monitor_id, total_agents, wa_done, fb_done, ig_done, all_done')
        .eq('content_date', selectedDate)
      if (me) throw me

      // Build monitorLogMap: { [content_id]: { [monitor_id]: { wa, fb, ig, all, total } } }
      const monMap = {}
      for (const row of monStats ?? []) {
        if (!monMap[row.content_id]) monMap[row.content_id] = {}
        monMap[row.content_id][row.monitor_id] = {
          total: row.total_agents,
          wa:    row.wa_done,
          fb:    row.fb_done,
          ig:    row.ig_done,
          all:   row.all_done,
        }
      }
      setMonitorLogMap(monMap)
    } catch (e) {
      setError(e.message)
    }
  }

  // Compute stats for a set of agent IDs on selectedDate
  // constId: filter content to only items targeted at this constituency
  // filterContentId: further narrow to a single content item
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

  function emptyStats(total = 0) {
    return { total, done: 0, donePct: 0, platform: { whatsapp: 0, facebook: 0, instagram: 0 }, overall: 0 }
  }

  // Constituency-level day stats — reads from constituency_content_stats view data
  function getConstDayStats(constId) {
    const constContents = dateContents.filter(c =>
      !c.target_constituencies || c.target_constituencies.includes(constId)
    )
    if (!constContents.length) return emptyStats()
    let totalAgents = 0, waSum = 0, fbSum = 0, igSum = 0, allSum = 0
    for (const content of constContents) {
      const s = logMap[content.id]?.[constId]
      if (s) {
        totalAgents = s.total // same agents count across all content
        waSum += s.wa
        fbSum += s.fb
        igSum += s.ig
        allSum += s.all
      }
    }
    if (!totalAgents) return emptyStats(allAgents.filter(a => a.constituency_id === constId).length)
    const opp = totalAgents * constContents.length
    return {
      total: totalAgents,
      done: allSum,
      donePct: pct(allSum, totalAgents * constContents.length),
      platform: {
        whatsapp: pct(waSum, opp),
        facebook: pct(fbSum, opp),
        instagram: pct(igSum, opp),
      },
      overall: pct(waSum + fbSum + igSum, opp * 3),
    }
  }

  // Monitor-level day stats — reads from monitor_content_stats view data
  function getMonitorDayStats(monitorId, constId) {
    const constContents = dateContents.filter(c =>
      !c.target_constituencies || c.target_constituencies.includes(constId)
    )
    if (!constContents.length) return emptyStats()
    let totalAgents = 0, waSum = 0, fbSum = 0, igSum = 0, allSum = 0
    for (const content of constContents) {
      const s = monitorLogMap[content.id]?.[monitorId]
      if (s) {
        totalAgents = s.total
        waSum += s.wa
        fbSum += s.fb
        igSum += s.ig
        allSum += s.all
      }
    }
    if (!totalAgents) return emptyStats(allAgents.filter(a => a.assigned_monitor_id === monitorId).length)
    const opp = totalAgents * constContents.length
    return {
      total: totalAgents,
      done: allSum,
      donePct: pct(allSum, totalAgents * constContents.length),
      platform: {
        whatsapp: pct(waSum, opp),
        facebook: pct(fbSum, opp),
        instagram: pct(igSum, opp),
      },
      overall: pct(waSum + fbSum + igSum, opp * 3),
    }
  }

  function handlePlacesFile(e) {
    setPlacesUploadError('')
    setPlacesUploadRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        const parsed = []
        for (const r of rows) {
          // Support various column name casings
          const name = String(r['Place Name'] ?? r['place_name'] ?? r['Name'] ?? r['name'] ?? '').trim()
          const from = parseInt(r['Booth From'] ?? r['booth_from'] ?? r['BoothFrom'] ?? r['from'] ?? 0)
          const to = parseInt(r['Booth To'] ?? r['booth_to'] ?? r['BoothTo'] ?? r['to'] ?? 0)
          if (!name || isNaN(from) || isNaN(to) || from < 1 || to < from) continue
          parsed.push({ name, booth_from: from, booth_to: to })
        }
        if (parsed.length === 0) { setPlacesUploadError('No valid rows found. Columns needed: Place Name, Booth From, Booth To'); return }
        setPlacesUploadRows(parsed)
      } catch (err) {
        setPlacesUploadError('Failed to parse file: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  async function savePlaces() {
    if (!placesUploadConstId) { setPlacesUploadError('Please select a constituency first.'); return }
    if (!placesUploadRows.length) return
    const client = supabaseAdmin ?? supabase
    setPlacesUploading(true)
    setPlacesUploadError('')
    try {
      // Delete existing places for this constituency then insert new ones
      const { error: delErr } = await client.from('places').delete().eq('constituency_id', placesUploadConstId)
      if (delErr) throw delErr
      const inserts = placesUploadRows.map(r => ({ ...r, constituency_id: placesUploadConstId }))
      const { error: insErr } = await client.from('places').insert(inserts)
      if (insErr) throw insErr
      // Reload places
      const { data: updatedPlaces } = await client.from('places').select('*')
      setPlaces(updatedPlaces ?? [])
      setPlacesUploadRows([])
      setPlacesUploadConstId('')
      if (placesFileRef.current) placesFileRef.current.value = ''
    } catch (err) {
      setPlacesUploadError(err.message)
    } finally {
      setPlacesUploading(false)
    }
  }

  async function addConstituency() {
    if (!newConstName.trim()) return
    setAddingConst(true)
    const { error } = await supabase.from('constituencies').insert({ name: newConstName.trim() })
    if (error) setError(error.message)
    else { setNewConstName(''); loadBase() }
    setAddingConst(false)
  }

  async function handleRenameConst(id, name) {
    if (!name.trim()) return
    const { error } = await supabase.from('constituencies').update({ name: name.trim() }).eq('id', id)
    if (error) setError(error.message)
    else { setEditingConstId(null); loadBase() }
  }

  async function handleDeleteConst(id) {
    const agentCount = allAgents.filter(a => a.constituency_id === id).length
    const monCount = allMonitors.filter(m => m.constituency_id === id).length
    const msg = agentCount || monCount
      ? `This constituency has ${monCount} monitor(s) and ${agentCount} agent(s). Deleting it will orphan all their data. Are you sure?`
      : 'Delete this constituency?'
    if (!window.confirm(msg)) return
    setDeletingConstId(id)
    const { error } = await supabase.from('constituencies').delete().eq('id', id)
    if (error) setError(error.message)
    else loadBase()
    setDeletingConstId(null)
  }

  function startEditContent(c) {
    setEditingContentId(c.id)
    setEditContentValues({ title: c.title, description: c.description ?? '', media_link: c.media_link ?? '' })
  }

  async function saveEditContent(id) {
    if (!editContentValues.title.trim()) return
    setSavingContent(true)
    const { error } = await supabase.from('daily_content').update({
      title: editContentValues.title.trim(),
      description: editContentValues.description.trim() || null,
      media_link: editContentValues.media_link.trim() || null,
    }).eq('id', id)
    if (error) setError(error.message)
    else { setEditingContentId(null); loadBase() }
    setSavingContent(false)
  }

  async function handleDeleteConstAdmin(admin) {
    if (!confirm(`Delete constituency admin "${admin.full_name}"? This cannot be undone.`)) return
    setDeletingAdminId(admin.id)
    if (supabaseAdmin) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(admin.id)
      if (delErr) { setError(delErr.message); setDeletingAdminId(null); return }
    } else {
      const { error: pErr } = await supabase.from('profiles').delete().eq('id', admin.id)
      if (pErr) { setError(pErr.message); setDeletingAdminId(null); return }
    }
    loadBase()
    setDeletingAdminId(null)
  }

  async function deleteContent(id) {
    if (!confirm('Delete this content? All compliance logs for it will also be deleted.')) return
    const { error } = await supabase.from('daily_content').delete().eq('id', id)
    if (error) setError(error.message)
    else loadBase()
  }

  const isToday = selectedDate === TODAY
  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })

  // Aggregate totals for dashboard summary
  const todayContents = contents.filter(c => c.content_date === TODAY)

  if (loading) {
    return (
      <Layout title="Super Admin">
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
      </Layout>
    )
  }

  return (
    <Layout title="Super Admin">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}
      {showAddContent && (
        <AddContentModal constituencies={constituencies} onAdded={loadBase} onClose={() => setShowAddContent(false)} />
      )}

      {showAddConstAdmin && (
        <CreateConstAdminModal
          constituencies={constituencies}
          onCreated={loadBase}
          onClose={() => setShowAddConstAdmin(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'Dashboard' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Constituencies', value: constituencies.length, icon: '🗺️' },
              { label: 'Const. Admins', value: constAdmins.length, icon: '🧑‍💼' },
              { label: 'Monitors', value: allMonitors.length, icon: '👤' },
              { label: 'Total Agents', value: allAgents.length, icon: '🗳️' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Date picker + Refresh */}
          <div>
            <div className="flex gap-2">
              <button onClick={() => setShowCalendar(v => !v)}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-red-300 transition-colors flex-1 sm:flex-none">
                <span>📅</span>
                <span>{isToday ? `Today — ${displayDate}` : displayDate}</span>
                <span className="ml-auto text-gray-400 sm:ml-2">{showCalendar ? '▲' : '▼'}</span>
              </button>
              <button
                onClick={() => loadBase().then(() => loadDateCompliance())}
                className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-green-400 hover:text-green-700 transition-colors"
                title="Refresh data">
                ↻ Refresh
              </button>
            </div>
            {showCalendar && (
              <div className="mt-2 max-w-sm">
                <MiniCalendar value={selectedDate} onChange={d => { setSelectedDate(d); setShowCalendar(false) }} markedDates={allContentDates} />
              </div>
            )}
          </div>

          {/* Content × Constituency grid */}
          {dateContents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              No content posted for {isToday ? 'today' : displayDate}.
            </div>
          ) : (
            <div className="space-y-4">
              {dateContents.map((content, ci) => {
                // logMap[content_id][constituency_id] = { total, wa, fb, ig, all }
                const constStats = logMap[content.id] ?? {}

                // Only show constituencies that have data for this content
                const targetedIds = content.target_constituencies ?? null
                const relevantConsts = targetedIds
                  ? constituencies.filter(c => targetedIds.includes(c.id))
                  : constituencies.filter(c => constStats[c.id]?.total > 0 || allAgents.some(a => a.constituency_id === c.id))

                const rows = relevantConsts.map(c => {
                  const s = constStats[c.id]
                  const total = s?.total ?? allAgents.filter(a => a.constituency_id === c.id).length
                  if (!total) return null
                  return {
                    c, total,
                    wa: s?.wa ?? 0, fb: s?.fb ?? 0, ig: s?.ig ?? 0, all: s?.all ?? 0,
                  }
                }).filter(Boolean)

                const grandTotal = rows.reduce((s, r) => s + r.total, 0)

                return (
                  <div key={content.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Content header */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                      <span className="shrink-0 bg-indigo-100 text-indigo-700 font-bold text-xs px-2 py-0.5 rounded-full">{ci + 1}</span>
                      <p className="font-semibold text-gray-900 flex-1 truncate">{content.title}</p>
                      <span className="text-xs text-gray-400 shrink-0">{grandTotal} agents</span>
                    </div>

                    {/* Column headers */}
                    {rows.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        <span className="flex-1">Constituency</span>
                        <span className="w-14 text-center text-green-600">WA</span>
                        <span className="w-14 text-center text-blue-600">FB</span>
                        <span className="w-14 text-center text-pink-600">IG</span>
                        <span className="w-14 text-center text-gray-500">All ✓</span>
                      </div>
                    )}

                    {/* Constituency rows */}
                    <div className="divide-y divide-gray-50">
                      {rows.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400">No agents targeted.</p>
                      ) : rows.map(({ c, total, wa, fb, ig, all }) => (
                        <div key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 truncate">{c.name}</p>
                            <p className="text-xs text-gray-400">{total} agents</p>
                          </div>
                          {[wa, fb, ig].map((done, i) => {
                            const pc = pct(done, total)
                            const color = pc === 100 ? 'text-green-700 bg-green-50' : pc >= 50 ? 'text-yellow-700 bg-yellow-50' : pc > 0 ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-50'
                            return (
                              <div key={i} className={`w-14 text-center rounded-lg py-1 ${color}`}>
                                <p className="text-xs font-bold">{pc}%</p>
                                <p className="text-xs">{done}/{total}</p>
                              </div>
                            )
                          })}
                          <div className={`w-14 text-center rounded-lg py-1 ${
                            pct(all, total) === 100 ? 'text-green-700 bg-green-50' :
                            pct(all, total) >= 50  ? 'text-yellow-700 bg-yellow-50' :
                            all > 0 ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-50'
                          }`}>
                            <p className="text-xs font-bold">{pct(all, total)}%</p>
                            <p className="text-xs">{all}/{total}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ADMINS TAB ── */}
      {activeTab === 'Admins' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Date picker */}
            <button onClick={() => setShowCalendar(v => !v)}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-red-300 transition-colors">
              <span>📅</span>
              <span>{isToday ? `Today — ${displayDate}` : displayDate}</span>
              <span className="text-gray-400 ml-1">{showCalendar ? '▲' : '▼'}</span>
            </button>
            <button onClick={() => setShowAddConstAdmin(true)}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
              + Add Const Admin
            </button>
          </div>
          {showCalendar && (
            <div className="max-w-sm">
              <MiniCalendar value={selectedDate} onChange={d => { setSelectedDate(d); setShowCalendar(false) }} markedDates={allContentDates} />
            </div>
          )}

          {constAdmins.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400 text-sm">
              No constituency admins yet. Click "+ Add Const Admin" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {constAdmins.map(admin => {
                const constId = admin.constituency_id
                const constName = admin.constituencies?.name ?? '—'
                const adminAgentIds = allAgents.filter(a => a.constituency_id === constId).map(a => a.id)
                const monitorCount = allMonitors.filter(m => m.constituency_id === constId).length
                const s = getConstDayStats(constId)

                // Per-monitor stats for this admin's constituency
                const adminsMonitors = allMonitors.filter(m => m.constituency_id === constId)

                return (
                  <div key={admin.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    {/* Admin header */}
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{admin.full_name}</p>
                        <p className="text-xs text-gray-500">{admin.email}</p>
                        <p className="text-xs text-red-600 font-medium mt-0.5">{constName}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <PctBadge value={s.overall} size="lg" />
                          <button
                            onClick={() => handleDeleteConstAdmin(admin)}
                            disabled={deletingAdminId === admin.id}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-40 border border-red-200"
                          >
                            {deletingAdminId === admin.id ? '…' : 'Delete'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">{monitorCount} monitors · {adminAgentIds.length} agents</p>
                      </div>
                    </div>

                    {/* Platform breakdown */}
                    {(() => {
                      const constContents = dateContents.filter(c => !c.target_constituencies || c.target_constituencies.includes(constId))
                      return constContents.length > 0 && adminAgentIds.length > 0 ? (
                        <div className="space-y-1.5 mb-4 pb-4 border-b border-gray-100">
                          {PLATFORMS.map(p => (
                            <div key={p} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-8">{P_SHORT[p]}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${s.platform[p] >= 80 ? 'bg-green-500' : s.platform[p] >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                      style={{ width: `${s.platform[p]}%` }} />
                                  </div>
                                  <span className={`text-xs font-bold w-8 text-right ${s.platform[p] >= 80 ? 'text-green-700' : s.platform[p] >= 50 ? 'text-yellow-700' : 'text-red-600'}`}>
                                    {s.platform[p]}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          <p className="text-xs text-gray-400 mt-1">
                            {s.done}/{s.total} agents fully verified · {constContents.length} content item(s)
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mb-4 pb-4 border-b border-gray-100">
                          {constContents.length === 0 ? 'No content for this constituency on this date.' : 'No agents in this constituency.'}
                        </p>
                      )
                    })()}

                    {/* Per-monitor breakdown */}
                    {adminsMonitors.length > 0 && dateContents.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Monitors</p>
                        <div className="space-y-2">
                          {adminsMonitors.map(mon => {
                            const monAgentIds = allAgents.filter(a => a.assigned_monitor_id === mon.id).map(a => a.id)
                            const ms = getMonitorDayStats(mon.id, constId)
                            return (
                              <div key={mon.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{mon.full_name}</p>
                                  <p className="text-xs text-gray-400">{monAgentIds.length} agents</p>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  {PLATFORMS.map(p => (
                                    <div key={p} className="text-center">
                                      <PctBadge value={ms.platform[p]} />
                                      <p className="text-xs text-gray-400 mt-0.5">{P_SHORT[p]}</p>
                                    </div>
                                  ))}
                                  <div className="text-center ml-1 pl-2 border-l border-gray-200">
                                    <PctBadge value={ms.overall} />
                                    <p className="text-xs text-gray-400 mt-0.5">All</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONTENT TAB ── */}
      {activeTab === 'Content' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{todayContents.length} item(s) for today</p>
            <button onClick={() => setShowAddContent(true)} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
              + Add Content
            </button>
          </div>

          {/* Render a content card — shared between today + past */}
          {contents.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No content yet. Click "Add Content".</div>
          )}

          {todayContents.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Today</p>
              <div className="space-y-2">
                {todayContents.map(c => (
                  <ContentCard key={c.id} c={c}
                    isEditing={editingContentId === c.id}
                    editValues={editContentValues}
                    setEditValues={setEditContentValues}
                    saving={savingContent}
                    onEdit={() => startEditContent(c)}
                    onSave={() => saveEditContent(c.id)}
                    onCancel={() => setEditingContentId(null)}
                    onDelete={() => deleteContent(c.id)}
                    highlight
                  />
                ))}
              </div>
            </div>
          )}

          {contents.filter(c => c.content_date !== TODAY).length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 mt-4">Past Content</p>
              <div className="space-y-2">
                {contents.filter(c => c.content_date !== TODAY).map(c => (
                  <ContentCard key={c.id} c={c}
                    isEditing={editingContentId === c.id}
                    editValues={editContentValues}
                    setEditValues={setEditContentValues}
                    saving={savingContent}
                    onEdit={() => startEditContent(c)}
                    onSave={() => saveEditContent(c.id)}
                    onCancel={() => setEditingContentId(null)}
                    onDelete={() => deleteContent(c.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONSTITUENCIES TAB ── */}
      {activeTab === 'Constituencies' && (
        <div className="space-y-4 max-w-lg">
          <div className="flex gap-3">
            <input
              type="text"
              value={newConstName}
              onChange={e => setNewConstName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addConstituency()}
              placeholder="New constituency name…"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button onClick={addConstituency} disabled={addingConst || !newConstName.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-xl text-sm font-medium">
              {addingConst ? '…' : 'Add'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {constituencies.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No constituencies yet.</div>
            ) : (
              constituencies.map(c => {
                const cAgentIds = allAgents.filter(a => a.constituency_id === c.id)
                const monCount = allMonitors.filter(m => m.constituency_id === c.id).length
                const adminNames = constAdmins.filter(a => a.constituency_id === c.id).map(a => a.full_name)
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-2">
                    {editingConstId === c.id ? (
                      <>
                        <input autoFocus value={editConstName}
                          onChange={e => setEditConstName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleRenameConst(c.id, editConstName)}
                          className="flex-1 px-3 py-1.5 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                        <button onClick={() => handleRenameConst(c.id, editConstName)}
                          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-red-700">Save</button>
                        <button onClick={() => setEditingConstId(null)}
                          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-lg">Cancel</button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <span className="font-medium text-gray-800 text-sm">{c.name}</span>
                          {adminNames.length > 0 && <p className="text-xs text-gray-400">Admin{adminNames.length > 1 ? 's' : ''}: {adminNames.join(', ')}</p>}
                        </div>
                        <p className="text-xs text-gray-400 shrink-0">{cAgentIds.length} agents · {monCount} monitors</p>
                        <button onClick={() => { setEditingConstId(c.id); setEditConstName(c.name) }}
                          className="text-gray-400 hover:text-gray-700 text-sm px-1.5 py-1 rounded hover:bg-gray-100" title="Rename">✏️</button>
                        <button onClick={() => handleDeleteConst(c.id)} disabled={deletingConstId === c.id}
                          className="text-red-400 hover:text-red-600 text-sm px-1.5 py-1 rounded hover:bg-red-50 disabled:opacity-40" title="Delete">
                          {deletingConstId === c.id ? '…' : '✕'}
                        </button>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Places Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold text-gray-800">Upload Places (Booth Range → Place Name)</p>
            <p className="text-xs text-gray-500">Excel/CSV with columns: <span className="font-mono bg-gray-100 px-1 rounded">Place Name</span>, <span className="font-mono bg-gray-100 px-1 rounded">Booth From</span>, <span className="font-mono bg-gray-100 px-1 rounded">Booth To</span></p>

            <div className="flex flex-col gap-2">
              <select
                value={placesUploadConstId}
                onChange={e => setPlacesUploadConstId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                <option value="">Select constituency…</option>
                {constituencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                ref={placesFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handlePlacesFile}
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
              />
            </div>

            {placesUploadError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{placesUploadError}</div>
            )}

            {placesUploadRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">{placesUploadRows.length} rows parsed — preview:</p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {placesUploadRows.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <span className="flex-1 text-gray-800 font-medium">{r.name}</span>
                      <span className="text-gray-400">Booths {r.booth_from}–{r.booth_to}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={savePlaces}
                  disabled={placesUploading || !placesUploadConstId}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-semibold py-2 rounded-lg"
                >
                  {placesUploading ? 'Saving…' : `Save ${placesUploadRows.length} places to ${constituencies.find(c => c.id === placesUploadConstId)?.name ?? 'constituency'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FIELD OPS TAB ── */}
      {activeTab === 'Field Ops' && (
        <div className="space-y-3">
          {constituencies.map(c => {
            const cMonitors = allMonitors.filter(m => m.constituency_id === c.id)
            const cAgents = allAgents.filter(a => a.constituency_id === c.id)
            const cLinkIssues = cAgents.filter(a => isValidLink(a.fb_url) === false || isValidLink(a.ig_url) === false || !a.fb_url || !a.ig_url).length

            // Vacant booths in constituency: all booth ranges - agents with booth numbers
            const cBoothRanges = boothAssignments.filter(b => b.constituency_id === c.id)
            const cAssignedBooths = new Set(cAgents.map(a => a.booth_number).filter(n => n != null))
            const cVacantBooths = []
            for (const r of cBoothRanges) {
              for (let n = r.booth_from; n <= r.booth_to; n++) {
                if (!cAssignedBooths.has(n)) cVacantBooths.push(n)
              }
            }

            const isOpen = expandedConstId === c.id
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedConstId(isOpen ? null : c.id)}
                >
                  <span className="font-semibold text-gray-800">{c.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    {cLinkIssues > 0 && <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">⚠ {cLinkIssues} links</span>}
                    {cVacantBooths.length > 0 && <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{cVacantBooths.length} vacant</span>}
                    <span className="text-gray-500">{cMonitors.length} monitors · {cAgents.length} agents</span>
                    <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {cMonitors.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-gray-400">No monitors in this constituency.</p>
                    ) : cMonitors.map(m => {
                      const mAgents = cAgents.filter(a => a.assigned_monitor_id === m.id)
                      const mLinkIssues = mAgents.filter(a => isValidLink(a.fb_url) === false || isValidLink(a.ig_url) === false || !a.fb_url || !a.ig_url)
                      const mRanges = boothAssignments.filter(b => b.monitor_id === m.id)
                      const mAssignedBooths = new Set(mAgents.map(a => a.booth_number).filter(n => n != null))
                      const mVacant = []
                      for (const r of mRanges) {
                        for (let n = r.booth_from; n <= r.booth_to; n++) {
                          if (!mAssignedBooths.has(n)) mVacant.push(n)
                        }
                      }
                      const rangeLabel = mRanges.map(r => `${r.booth_from}–${r.booth_to}`).join(', ')
                      const mIsOpen = expandedMonitorId === m.id
                      const mPlaces = getMonitorPlaces(m.id)

                      return (
                        <div key={m.id} className="border-b border-gray-100 last:border-0">
                          {/* Monitor row — clickable dropdown */}
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedMonitorId(mIsOpen ? null : m.id)}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{m.full_name}</p>
                              {mPlaces.length > 0 && <p className="text-xs text-indigo-500">{mPlaces.join(' · ')}</p>}
                              <p className="text-xs text-indigo-500 mt-0.5">
                                {rangeLabel ? `Booths: ${rangeLabel}` : 'No booth assignment'}
                                <span className="text-gray-400 ml-2">· {mAgents.length} agents</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs shrink-0 ml-2">
                              {mLinkIssues.length > 0 && <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">⚠ {mLinkIssues.length} links</span>}
                              {mVacant.length > 0 && <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{mVacant.length} vacant</span>}
                              <span className="text-gray-400 ml-1">{mIsOpen ? '▲' : '▼'}</span>
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {mIsOpen && (
                            <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-3">

                              {/* Vacant booths */}
                              {mVacant.length > 0 ? (
                                <div>
                                  <p className="text-xs font-bold text-red-600 mb-1.5">Vacant booths ({mVacant.length})</p>
                                  <div className="flex flex-wrap gap-1">
                                    {mVacant.map(n => (
                                      <span key={n} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5 font-medium">#{n}</span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-green-600 font-medium">✓ All booths assigned</p>
                              )}

                              {/* Link issues */}
                              {mLinkIssues.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-orange-600 mb-1.5">Link issues ({mLinkIssues.length})</p>
                                  <div className="space-y-1">
                                    {mLinkIssues.map(a => (
                                      <div key={a.id} className="flex items-center gap-2 text-xs bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1.5">
                                        {a.booth_number != null && <span className="font-bold text-indigo-600 shrink-0">#{a.booth_number}</span>}
                                        <span className="text-gray-800 flex-1 truncate">{a.name}</span>
                                        <div className="flex gap-1 shrink-0">
                                          {(!a.fb_url || isValidLink(a.fb_url) === false) && <span className="bg-blue-100 text-blue-700 px-1 rounded font-semibold">FB</span>}
                                          {(!a.ig_url || isValidLink(a.ig_url) === false) && <span className="bg-pink-100 text-pink-700 px-1 rounded font-semibold">IG</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* All agents compact list */}
                              {mAgents.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-gray-500 mb-1.5">All agents</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                    {mAgents.sort((a, b) => (a.booth_number ?? 0) - (b.booth_number ?? 0)).map(a => {
                                      const fbBad = isValidLink(a.fb_url) === false || !a.fb_url
                                      const igBad = isValidLink(a.ig_url) === false || !a.ig_url
                                      return (
                                        <div key={a.id} className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 ${(fbBad || igBad) ? 'bg-orange-50' : 'bg-white border border-gray-100'}`}>
                                          {a.booth_number != null && <span className="font-bold text-indigo-600 shrink-0">#{a.booth_number}</span>}
                                          <span className="text-gray-700 truncate flex-1">{a.name}</span>
                                          <span className={fbBad ? 'text-orange-500 shrink-0' : 'text-blue-400 shrink-0'}>{fbBad ? '⚠FB' : 'FB✓'}</span>
                                          <span className={igBad ? 'text-orange-500 shrink-0' : 'text-pink-400 shrink-0'}>{igBad ? '⚠IG' : 'IG✓'}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Unassigned agents */}
                    {cAgents.filter(a => !a.assigned_monitor_id).length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500 font-semibold mb-1">Unassigned agents ({cAgents.filter(a => !a.assigned_monitor_id).length})</p>
                        <div className="flex flex-wrap gap-1">
                          {cAgents.filter(a => !a.assigned_monitor_id).map(a => (
                            <span key={a.id} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                              {a.booth_number != null ? `#${a.booth_number} ` : ''}{a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
