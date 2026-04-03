import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import CSVImport from '../components/CSVImport'
import BulkAssign from '../components/BulkAssign'
import CreateMonitorModal from '../components/CreateMonitorModal'

const TODAY = new Date().toISOString().split('T')[0]
const TABS = ['Overview', 'Agents', 'Monitors', 'Import']

export default function ConstituencyAdminPage() {
  const { profile } = useAuth()
  const constituencyId = profile?.constituency_id

  const [activeTab, setActiveTab] = useState('Overview')
  const [monitors, setMonitors] = useState([])
  const [agents, setAgents] = useState([])
  const [contents, setContents] = useState([])
  // compliance: { [monitor_id]: { [content_id]: { total, checked } } }
  const [compliance, setCompliance] = useState({})
  const [loading, setLoading] = useState(true)
  const [showCreateMonitor, setShowCreateMonitor] = useState(false)
  const [selectedMonitor, setSelectedMonitor] = useState(null)
  const [monitorAgentDetail, setMonitorAgentDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (constituencyId) loadAll()
  }, [constituencyId])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [monitorsRes, agentsRes, contentsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'monitor').eq('constituency_id', constituencyId).order('full_name'),
        supabase.from('digital_agents').select('*').eq('constituency_id', constituencyId).order('booth_number'),
        supabase.from('daily_content').select('*').eq('content_date', TODAY).order('created_at'),
      ])
      if (monitorsRes.error) throw monitorsRes.error
      if (agentsRes.error) throw agentsRes.error
      if (contentsRes.error) throw contentsRes.error

      const myMonitors = monitorsRes.data ?? []
      const myAgents = agentsRes.data ?? []
      const todayContents = contentsRes.data ?? []

      setMonitors(myMonitors)
      setAgents(myAgents)
      setContents(todayContents)

      // Load compliance logs for today
      if (todayContents.length > 0 && myAgents.length > 0) {
        const { data: logs, error: logsErr } = await supabase
          .from('compliance_logs')
          .select('*, digital_agents(assigned_monitor_id)')
          .in('content_id', todayContents.map(c => c.id))
          .in('agent_id', myAgents.map(a => a.id))

        if (logsErr) throw logsErr
        buildCompliance(logs ?? [], myMonitors, myAgents, todayContents)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function buildCompliance(logs, myMonitors, myAgents, todayContents) {
    // Group agents by monitor
    const agentsByMonitor = {}
    for (const a of myAgents) {
      const mid = a.assigned_monitor_id
      if (!mid) continue
      if (!agentsByMonitor[mid]) agentsByMonitor[mid] = []
      agentsByMonitor[mid].push(a.id)
    }

    // Count checked platforms per agent per content per monitor
    // "checked" = agent has at least 1 platform is_checked=true for this content
    const checkedSet = {} // { [monitor_id]: { [content_id]: Set<agent_id> } }
    for (const log of logs) {
      if (!log.is_checked) continue
      const monitorId = log.digital_agents?.assigned_monitor_id
      if (!monitorId) continue
      if (!checkedSet[monitorId]) checkedSet[monitorId] = {}
      if (!checkedSet[monitorId][log.content_id]) checkedSet[monitorId][log.content_id] = new Set()
      checkedSet[monitorId][log.content_id].add(log.agent_id)
    }

    const comp = {}
    for (const m of myMonitors) {
      comp[m.id] = {}
      const totalAgents = agentsByMonitor[m.id]?.length ?? 0
      for (const c of todayContents) {
        comp[m.id][c.id] = {
          total: totalAgents,
          checked: checkedSet[m.id]?.[c.id]?.size ?? 0,
        }
      }
    }
    setCompliance(comp)
  }

  async function loadMonitorAgentDetail(monitorId, contentId) {
    const monitorAgents = agents.filter(a => a.assigned_monitor_id === monitorId)
    if (!monitorAgents.length) {
      setMonitorAgentDetail({ monitorId, contentId, agents: [] })
      return
    }

    const { data: logs } = await supabase
      .from('compliance_logs')
      .select('*')
      .eq('content_id', contentId)
      .in('agent_id', monitorAgents.map(a => a.id))

    // Index logs by agent
    const logByAgent = {}
    for (const log of logs ?? []) {
      if (!logByAgent[log.agent_id]) logByAgent[log.agent_id] = {}
      logByAgent[log.agent_id][log.platform] = log
    }

    const agentStatuses = monitorAgents.map(a => ({
      ...a,
      logs: logByAgent[a.id] ?? {},
      isChecked: Object.values(logByAgent[a.id] ?? {}).some(l => l.is_checked),
    }))

    setMonitorAgentDetail({ monitorId, contentId, agents: agentStatuses })
  }

  const unassignedAgents = agents.filter(a => !a.assigned_monitor_id)

  if (loading) {
    return (
      <Layout title={profile?.constituencies?.name}>
        <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>
      </Layout>
    )
  }

  return (
    <Layout title={profile?.constituencies?.name}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {showCreateMonitor && (
        <CreateMonitorModal
          constituencyId={constituencyId}
          onCreated={loadAll}
          onClose={() => setShowCreateMonitor(false)}
        />
      )}

      {/* Monitor agent detail drawer */}
      {monitorAgentDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-end z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg h-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-gray-900">Agent Detail</h2>
              <button onClick={() => setMonitorAgentDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-2">
              {monitorAgentDetail.agents.length === 0 ? (
                <p className="text-gray-400 text-sm">No agents assigned.</p>
              ) : (
                monitorAgentDetail.agents.map(a => (
                  <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border ${a.isChecked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div>
                      <span className="text-xs font-bold text-indigo-600 mr-2">#{a.booth_number}</span>
                      <span className="text-sm font-medium text-gray-800">{a.name}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {['whatsapp', 'facebook', 'instagram'].map(p => (
                        <span
                          key={p}
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            a.logs[p]?.is_checked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {p === 'whatsapp' ? 'WA' : p === 'facebook' ? 'FB' : 'IG'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Monitors', value: monitors.length, icon: '👤' },
              { label: 'Agents', value: agents.length, icon: '🗳️' },
              { label: 'Unassigned', value: unassignedAgents.length, icon: '⚠️', warn: unassignedAgents.length > 0 },
              { label: "Today's Content", value: contents.length, icon: '📋' },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-xl border p-4 ${s.warn ? 'border-orange-200' : 'border-gray-200'}`}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className={`text-2xl font-bold ${s.warn ? 'text-orange-600' : 'text-gray-900'}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Monitor compliance matrix */}
          {contents.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
              No content published today.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Monitor Progress — {new Date().toLocaleDateString('en-IN')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium text-gray-600">Monitor</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600">Agents</th>
                      {contents.map(c => (
                        <th key={c.id} className="px-4 py-3 text-center font-medium text-gray-600 max-w-[120px]">
                          <div className="truncate" title={c.title}>{c.title}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monitors.map(m => {
                      const assignedCount = agents.filter(a => a.assigned_monitor_id === m.id).length
                      return (
                        <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-800">{m.full_name}</td>
                          <td className="px-4 py-3 text-center text-gray-500">{assignedCount}</td>
                          {contents.map(c => {
                            const stat = compliance[m.id]?.[c.id]
                            const pct = stat?.total ? Math.round((stat.checked / stat.total) * 100) : 0
                            return (
                              <td key={c.id} className="px-4 py-3 text-center">
                                <button
                                  onClick={() => loadMonitorAgentDetail(m.id, c.id)}
                                  className="group flex flex-col items-center gap-1"
                                >
                                  <span className={`text-sm font-bold ${
                                    pct === 100 ? 'text-green-600' : pct > 0 ? 'text-yellow-600' : 'text-red-500'
                                  }`}>
                                    {stat?.checked ?? 0}/{stat?.total ?? 0}
                                  </span>
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AGENTS TAB */}
      {activeTab === 'Agents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{agents.length} agents total · {unassignedAgents.length} unassigned</p>
            <button
              onClick={() => setActiveTab('Import')}
              className="text-sm text-indigo-600 font-medium border border-indigo-200 px-4 py-1.5 rounded-lg hover:bg-indigo-50"
            >
              + Import from CSV
            </button>
          </div>

          {/* Bulk assign */}
          {agents.length > 0 && monitors.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Bulk Assign by Booth Range</h3>
              <BulkAssign
                agents={agents}
                monitors={monitors}
                constituencyId={constituencyId}
                onAssigned={loadAll}
              />
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Booth</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Gender</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Assigned To</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(a => {
                    const mon = monitors.find(m => m.id === a.assigned_monitor_id)
                    return (
                      <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-semibold text-indigo-600">#{a.booth_number}</td>
                        <td className="px-4 py-2.5 text-gray-800">{a.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 capitalize">{a.gender || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500">{a.phone || '—'}</td>
                        <td className="px-4 py-2.5">
                          {mon ? (
                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{mon.full_name}</span>
                          ) : (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-2">
                            {a.fb_url && <a href={a.fb_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs underline">FB</a>}
                            {a.ig_url && <a href={a.ig_url} target="_blank" rel="noopener noreferrer" className="text-pink-500 text-xs underline">IG</a>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MONITORS TAB */}
      {activeTab === 'Monitors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{monitors.length} monitors in this constituency</p>
            <button
              onClick={() => setShowCreateMonitor(true)}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-1.5 rounded-lg"
            >
              + Add Monitor
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monitors.map(m => {
              const assignedCount = agents.filter(a => a.assigned_monitor_id === m.id).length
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{m.full_name}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Monitor</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{assignedCount} agents assigned</span>
                  </div>

                  {contents.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {contents.map(c => {
                        const stat = compliance[m.id]?.[c.id]
                        const pct = stat?.total ? Math.round((stat.checked / stat.total) * 100) : 0
                        return (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 truncate flex-1">{c.title}</span>
                            <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : pct > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                              {stat?.checked ?? 0}/{stat?.total ?? 0}
                            </span>
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-yellow-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {monitors.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">
                No monitors yet. Click "Add Monitor" to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMPORT TAB */}
      {activeTab === 'Import' && (
        <div className="max-w-2xl">
          <div className="mb-5">
            <h3 className="font-semibold text-gray-900 mb-1">Import Agents from Google Form CSV</h3>
            <p className="text-sm text-gray-500">
              Export your Google Form responses as CSV and drag it here. Column headers are auto-detected (Tamil and English).
            </p>
          </div>
          <CSVImport constituencyId={constituencyId} onImported={loadAll} />
        </div>
      )}
    </Layout>
  )
}
