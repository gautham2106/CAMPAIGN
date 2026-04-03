import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import AddContentModal from '../components/AddContentModal'

const TODAY = new Date().toISOString().split('T')[0]
const TABS = ['Dashboard', 'Content', 'Constituencies']

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [constituencies, setConstituencies] = useState([])
  const [contents, setContents] = useState([])
  // stats: { [constituency_id]: { agents, monitors, checked, total } }
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAddContent, setShowAddContent] = useState(false)
  const [newConstName, setNewConstName] = useState('')
  const [addingConst, setAddingConst] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [constRes, contentsRes, agentsRes, monitorsRes] = await Promise.all([
        supabase.from('constituencies').select('*').order('name'),
        supabase.from('daily_content').select('*').order('content_date', { ascending: false }).limit(30),
        supabase.from('digital_agents').select('id, constituency_id'),
        supabase.from('profiles').select('id, constituency_id').eq('role', 'monitor'),
      ])
      if (constRes.error) throw constRes.error
      if (contentsRes.error) throw contentsRes.error
      if (agentsRes.error) throw agentsRes.error
      if (monitorsRes.error) throw monitorsRes.error

      const consts = constRes.data ?? []
      setConstituencies(consts)
      setContents(contentsRes.data ?? [])

      const agents = agentsRes.data ?? []
      const monitors = monitorsRes.data ?? []

      // Load compliance logs for today
      const todayContents = (contentsRes.data ?? []).filter(c => c.content_date === TODAY)
      const agentIds = agents.map(a => a.id)

      let logs = []
      if (todayContents.length > 0 && agentIds.length > 0) {
        const { data } = await supabase
          .from('compliance_logs')
          .select('agent_id, is_checked, digital_agents(constituency_id)')
          .in('content_id', todayContents.map(c => c.id))
          .in('agent_id', agentIds)
        logs = data ?? []
      }

      // Build stats per constituency
      const s = {}
      for (const c of consts) {
        const constAgents = agents.filter(a => a.constituency_id === c.id)
        const constMonitors = monitors.filter(m => m.constituency_id === c.id)

        // Unique agents that have at least 1 checked platform today
        const checkedAgentIds = new Set(
          logs
            .filter(l => l.is_checked && l.digital_agents?.constituency_id === c.id)
            .map(l => l.agent_id)
        )

        s[c.id] = {
          agents: constAgents.length,
          monitors: constMonitors.length,
          // "checked" = agent confirmed on at least 1 platform today
          checked: checkedAgentIds.size,
          total: constAgents.length * todayContents.length, // total agent-content pairs
          todayContents: todayContents.length,
        }
      }
      setStats(s)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function addConstituency() {
    if (!newConstName.trim()) return
    setAddingConst(true)
    const { error } = await supabase.from('constituencies').insert({ name: newConstName.trim() })
    if (error) setError(error.message)
    else { setNewConstName(''); loadAll() }
    setAddingConst(false)
  }

  async function deleteContent(id) {
    if (!confirm('Delete this content? This will also delete all compliance logs for it.')) return
    const { error } = await supabase.from('daily_content').delete().eq('id', id)
    if (error) setError(error.message)
    else loadAll()
  }

  const todayContents = contents.filter(c => c.content_date === TODAY)
  const totalAgents = Object.values(stats).reduce((s, v) => s + v.agents, 0)
  const totalChecked = Object.values(stats).reduce((s, v) => s + v.checked, 0)
  const totalMonitors = Object.values(stats).reduce((s, v) => s + v.monitors, 0)

  if (loading) {
    return (
      <Layout title="Super Admin">
        <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>
      </Layout>
    )
  }

  return (
    <Layout title="Super Admin">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}
      {showAddContent && (
        <AddContentModal onAdded={loadAll} onClose={() => setShowAddContent(false)} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'Dashboard' && (
        <div className="space-y-6">
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Constituencies', value: constituencies.length, icon: '🗺️' },
              { label: 'Monitors', value: totalMonitors, icon: '👤' },
              { label: 'Total Agents', value: totalAgents, icon: '🗳️' },
              { label: "Verified Today", value: totalChecked, icon: '✅' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Constituency breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Constituency Stats — {new Date().toLocaleDateString('en-IN')}</h3>
              <span className="text-xs text-gray-400">{todayContents.length} content item(s) today</span>
            </div>
            {constituencies.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No constituencies yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {constituencies.map(c => {
                  const s = stats[c.id] ?? { agents: 0, monitors: 0, checked: 0, todayContents: 0 }
                  const pct = s.agents ? Math.round((s.checked / s.agents) * 100) : 0
                  return (
                    <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{s.monitors} monitors · {s.agents} agents</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${pct === 100 ? 'text-green-600' : pct > 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {s.checked}/{s.agents}
                        </p>
                        <p className="text-xs text-gray-400">agents verified</p>
                      </div>
                      <div className="w-24">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-yellow-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENT TAB */}
      {activeTab === 'Content' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{todayContents.length} content item(s) for today</p>
            </div>
            <button
              onClick={() => setShowAddContent(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              + Add Content
            </button>
          </div>

          {/* Today's content */}
          {todayContents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Today</p>
              <div className="space-y-2">
                {todayContents.map(c => (
                  <div key={c.id} className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-indigo-900">{c.title}</p>
                      {c.description && <p className="text-sm text-indigo-700 mt-0.5">{c.description}</p>}
                      {c.media_link && (
                        <a href={c.media_link} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 underline mt-1 inline-block">
                          View media →
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => deleteContent(c.id)}
                      className="text-red-400 hover:text-red-600 text-sm shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past content */}
          {contents.filter(c => c.content_date !== TODAY).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-6">Past Content</p>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contents
                      .filter(c => c.content_date !== TODAY)
                      .map(c => (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{c.content_date}</td>
                          <td className="px-4 py-2.5 text-gray-800">{c.title}</td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => deleteContent(c.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {contents.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No content added yet. Click "Add Content" to get started.
            </div>
          )}
        </div>
      )}

      {/* CONSTITUENCIES TAB */}
      {activeTab === 'Constituencies' && (
        <div className="space-y-5 max-w-lg">
          <div className="flex gap-3">
            <input
              type="text"
              value={newConstName}
              onChange={e => setNewConstName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addConstituency()}
              placeholder="New constituency name…"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={addConstituency}
              disabled={addingConst || !newConstName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              {addingConst ? '…' : 'Add'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {constituencies.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No constituencies yet.</div>
            ) : (
              constituencies.map(c => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                  <span className="font-medium text-gray-800">{c.name}</span>
                  <div className="text-xs text-gray-400">
                    {stats[c.id]?.agents ?? 0} agents · {stats[c.id]?.monitors ?? 0} monitors
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
