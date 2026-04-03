import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import AgentCard from '../components/AgentCard'
import MiniCalendar from '../components/MiniCalendar'

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

  // Load agents once on mount
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

  return (
    <Layout title="My Agents">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
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

          {/* Stats bar */}
          <div className="flex items-center gap-3 mb-3 text-xs">
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
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    logsByPlatform={getAgentLogs(agent.id)}
                    onToggle={(agentId, platform, checked) => handleToggle(agentId, platform, checked)}
                    saving={saving}
                    content={selectedContent}
                  />
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
