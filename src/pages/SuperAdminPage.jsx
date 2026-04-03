import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import AddContentModal from '../components/AddContentModal'
import MiniCalendar from '../components/MiniCalendar'

const TODAY = new Date().toISOString().split('T')[0]
const PLATFORMS = ['whatsapp', 'facebook', 'instagram']
const P_LABEL = { whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram' }
const P_SHORT = { whatsapp: 'WA', facebook: 'FB', instagram: 'IG' }
const TABS = ['Dashboard', 'Admins', 'Content', 'Constituencies']

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

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [selectedDate, setSelectedDate] = useState(TODAY)
  const [showCalendar, setShowCalendar] = useState(false)
  const [allContentDates, setAllContentDates] = useState([])

  const [constituencies, setConstituencies] = useState([])
  const [constAdmins, setConstAdmins] = useState([]) // profiles with role=constituency_admin
  const [allAgents, setAllAgents] = useState([])
  const [allMonitors, setAllMonitors] = useState([])
  const [contents, setContents] = useState([]) // all content (for content tab)
  const [dateContents, setDateContents] = useState([]) // content for selectedDate
  const [allContent, setAllContent] = useState([]) // recent content for calendar

  // Compliance stats indexed: { [agent_id]: { [content_id]: { [platform]: is_checked } } }
  const [complianceStats, setComplianceStats] = useState({})

  const [loading, setLoading] = useState(true)
  const [showAddContent, setShowAddContent] = useState(false)
  const [newConstName, setNewConstName] = useState('')
  const [addingConst, setAddingConst] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadBase() }, [])
  useEffect(() => { if (allAgents.length) loadDateCompliance() }, [selectedDate, allAgents])

  async function loadBase() {
    setLoading(true)
    setError('')
    try {
      const [constRes, agentsRes, monitorsRes, adminsRes, contentRes, allDatesRes] = await Promise.all([
        supabase.from('constituencies').select('*').order('name'),
        supabase.from('digital_agents').select('id, constituency_id, assigned_monitor_id'),
        supabase.from('profiles').select('id, full_name, email, constituency_id').eq('role', 'monitor'),
        supabase.from('profiles').select('id, full_name, email, constituency_id, constituencies(name)').eq('role', 'constituency_admin'),
        supabase.from('daily_content').select('*').order('content_date', { ascending: false }).limit(50),
        supabase.from('daily_content').select('content_date'),
      ])
      if (constRes.error) throw constRes.error

      setConstituencies(constRes.data ?? [])
      setAllAgents(agentsRes.data ?? [])
      setAllMonitors(monitorsRes.data ?? [])
      setConstAdmins(adminsRes.data ?? [])
      setContents(contentRes.data ?? [])
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
      const { data: dc } = await supabase
        .from('daily_content')
        .select('*')
        .eq('content_date', selectedDate)
        .order('created_at')
      setDateContents(dc ?? [])

      if (!dc?.length || !allAgents.length) { setComplianceStats({}); return }

      const { data: logs } = await supabase
        .from('compliance_logs')
        .select('agent_id, content_id, platform, is_checked')
        .in('content_id', dc.map(c => c.id))
        .in('agent_id', allAgents.map(a => a.id))

      const stats = {}
      for (const log of logs ?? []) {
        if (!stats[log.agent_id]) stats[log.agent_id] = {}
        if (!stats[log.agent_id][log.content_id]) stats[log.agent_id][log.content_id] = {}
        stats[log.agent_id][log.content_id][log.platform] = log.is_checked
      }
      setComplianceStats(stats)
    } catch (e) {
      setError(e.message)
    }
  }

  // Compute stats for a set of agent IDs on selectedDate
  function computeStats(agentIds) {
    const contentIds = dateContents.map(c => c.id)
    const total = agentIds.length
    const contentCount = contentIds.length

    if (!total || !contentCount) return { total, done: 0, donePct: 0, platform: { whatsapp: 0, facebook: 0, instagram: 0 }, overall: 0 }

    const opportunities = total * contentCount // per platform
    const platformChecked = { whatsapp: 0, facebook: 0, instagram: 0 }
    let done = 0

    for (const aid of agentIds) {
      let agentFullyDone = true
      for (const cid of contentIds) {
        for (const p of PLATFORMS) {
          if (complianceStats[aid]?.[cid]?.[p]) platformChecked[p]++
          else agentFullyDone = false
        }
      }
      if (agentFullyDone && contentCount > 0) done++
    }

    const overall = pct(Object.values(platformChecked).reduce((s, v) => s + v, 0), opportunities * 3)
    return {
      total, done,
      donePct: pct(done, total),
      platform: {
        whatsapp: pct(platformChecked.whatsapp, opportunities),
        facebook: pct(platformChecked.facebook, opportunities),
        instagram: pct(platformChecked.instagram, opportunities),
      },
      overall,
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
  const totalConstAgentStats = computeStats(allAgents.map(a => a.id))
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
        <AddContentModal onAdded={loadBase} onClose={() => setShowAddContent(false)} />
      )}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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

          {/* Date picker */}
          <div>
            <button onClick={() => setShowCalendar(v => !v)}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-300 transition-colors w-full sm:w-auto">
              <span>📅</span>
              <span>{isToday ? `Today — ${displayDate}` : displayDate}</span>
              <span className="ml-auto text-gray-400 sm:ml-2">{showCalendar ? '▲' : '▼'}</span>
            </button>
            {showCalendar && (
              <div className="mt-2 max-w-sm">
                <MiniCalendar value={selectedDate} onChange={d => { setSelectedDate(d); setShowCalendar(false) }} markedDates={allContentDates} />
              </div>
            )}
          </div>

          {/* Overall platform summary */}
          {dateContents.length > 0 && allAgents.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Platform Summary</h3>
                <PctBadge value={totalConstAgentStats.overall} size="lg" />
              </div>
              <div className="space-y-2">
                {PLATFORMS.map(p => (
                  <PlatformBar key={p} label={P_SHORT[p]} value={totalConstAgentStats.platform[p]} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                {totalConstAgentStats.done}/{totalConstAgentStats.total} agents fully verified · {dateContents.length} content item(s)
              </p>
            </div>
          )}

          {/* Constituency breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Constituency Overview — {isToday ? 'Today' : displayDate}</h3>
            </div>
            {constituencies.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No constituencies yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {constituencies.map(c => {
                  const cAgentIds = allAgents.filter(a => a.constituency_id === c.id).map(a => a.id)
                  const monCount = allMonitors.filter(m => m.constituency_id === c.id).length
                  const s = computeStats(cAgentIds)
                  return (
                    <div key={c.id} className="px-5 py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500">{monCount} monitors · {cAgentIds.length} agents</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${s.donePct === 100 ? 'text-green-600' : s.donePct > 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {s.done}/{s.total}
                          </p>
                          <p className="text-xs text-gray-400">verified</p>
                        </div>
                      </div>
                      {dateContents.length > 0 && cAgentIds.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {PLATFORMS.map(p => (
                            <PlatformBar key={p} label={P_SHORT[p]} value={s.platform[p]} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADMINS TAB ── */}
      {activeTab === 'Admins' && (
        <div className="space-y-5">
          {/* Date picker */}
          <div>
            <button onClick={() => setShowCalendar(v => !v)}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-800 hover:border-indigo-300 transition-colors w-full sm:w-auto">
              <span>📅</span>
              <span>{isToday ? `Today — ${displayDate}` : displayDate}</span>
              <span className="ml-auto text-gray-400 sm:ml-2">{showCalendar ? '▲' : '▼'}</span>
            </button>
            {showCalendar && (
              <div className="mt-2 max-w-sm">
                <MiniCalendar value={selectedDate} onChange={d => { setSelectedDate(d); setShowCalendar(false) }} markedDates={allContentDates} />
              </div>
            )}
          </div>

          {constAdmins.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400 text-sm">
              No constituency admins found. Create profiles with role=constituency_admin in Supabase.
            </div>
          ) : (
            <div className="space-y-4">
              {constAdmins.map(admin => {
                const constId = admin.constituency_id
                const constName = admin.constituencies?.name ?? '—'
                const adminAgentIds = allAgents.filter(a => a.constituency_id === constId).map(a => a.id)
                const monitorCount = allMonitors.filter(m => m.constituency_id === constId).length
                const s = computeStats(adminAgentIds)

                // Per-monitor stats for this admin's constituency
                const adminsMonitors = allMonitors.filter(m => m.constituency_id === constId)

                return (
                  <div key={admin.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    {/* Admin header */}
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{admin.full_name}</p>
                        <p className="text-xs text-gray-500">{admin.email}</p>
                        <p className="text-xs text-indigo-600 font-medium mt-0.5">{constName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <PctBadge value={s.overall} size="lg" />
                        <p className="text-xs text-gray-400 mt-1">{monitorCount} monitors · {adminAgentIds.length} agents</p>
                      </div>
                    </div>

                    {/* Platform breakdown */}
                    {dateContents.length > 0 && adminAgentIds.length > 0 ? (
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
                          {s.done}/{s.total} agents fully verified · {dateContents.length} content item(s)
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mb-4 pb-4 border-b border-gray-100">
                        {dateContents.length === 0 ? 'No content on this date.' : 'No agents in this constituency.'}
                      </p>
                    )}

                    {/* Per-monitor breakdown */}
                    {adminsMonitors.length > 0 && dateContents.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Monitors</p>
                        <div className="space-y-2">
                          {adminsMonitors.map(mon => {
                            const monAgentIds = allAgents.filter(a => a.assigned_monitor_id === mon.id).map(a => a.id)
                            const ms = computeStats(monAgentIds)
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
            <button onClick={() => setShowAddContent(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
              + Add Content
            </button>
          </div>

          {todayContents.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Today</p>
              <div className="space-y-2">
                {todayContents.map(c => (
                  <div key={c.id} className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-indigo-900 text-sm">{c.title}</p>
                      {c.description && <p className="text-xs text-indigo-700 mt-0.5 line-clamp-2">{c.description}</p>}
                      {c.media_link && (
                        <a href={c.media_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 underline mt-1 inline-block">
                          View media →
                        </a>
                      )}
                    </div>
                    <button onClick={() => deleteContent(c.id)} className="text-red-400 hover:text-red-600 text-sm shrink-0">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contents.filter(c => c.content_date !== TODAY).length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 mt-4">Past Content</p>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Title</th>
                        <th className="px-4 py-3 text-xs"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contents.filter(c => c.content_date !== TODAY).map(c => (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{c.content_date}</td>
                          <td className="px-4 py-2.5 text-gray-800 text-sm">{c.title}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => deleteContent(c.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {contents.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No content yet. Click "Add Content".</div>
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={addConstituency} disabled={addingConst || !newConstName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-xl text-sm font-medium">
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
                const adminName = constAdmins.find(a => a.constituency_id === c.id)?.full_name
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-800 text-sm">{c.name}</span>
                      {adminName && <p className="text-xs text-gray-400">Admin: {adminName}</p>}
                    </div>
                    <p className="text-xs text-gray-400">{cAgentIds.length} agents · {monCount} monitors</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
