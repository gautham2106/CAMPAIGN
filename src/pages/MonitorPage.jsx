import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import AgentCard from '../components/AgentCard'

const TODAY = new Date().toISOString().split('T')[0]

export default function MonitorPage() {
  const { user } = useAuth()
  const [contents, setContents] = useState([])
  const [agents, setAgents] = useState([])
  // logMap: { [agent_id]: { [content_id]: { [platform]: log_row } } }
  const [logMap, setLogMap] = useState({})
  const [selectedContentId, setSelectedContentId] = useState(null)
  const [activeTab, setActiveTab] = useState('unchecked') // 'unchecked' | 'checked'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load all data on mount
  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      // Parallel: load today's content + monitor's agents
      const [contentsRes, agentsRes] = await Promise.all([
        supabase.from('daily_content').select('*').eq('content_date', TODAY).order('created_at'),
        supabase.from('digital_agents').select('*').eq('assigned_monitor_id', user.id).order('booth_number'),
      ])

      if (contentsRes.error) throw contentsRes.error
      if (agentsRes.error) throw agentsRes.error

      const todayContents = contentsRes.data ?? []
      const myAgents = agentsRes.data ?? []

      setContents(todayContents)
      setAgents(myAgents)
      if (todayContents.length > 0) setSelectedContentId(todayContents[0].id)

      // Load compliance logs
      if (todayContents.length > 0 && myAgents.length > 0) {
        const { data: logs, error: logsErr } = await supabase
          .from('compliance_logs')
          .select('*')
          .in('content_id', todayContents.map(c => c.id))
          .in('agent_id', myAgents.map(a => a.id))

        if (logsErr) throw logsErr
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

  async function handleToggle(agentId, platform, currentChecked) {
    if (!selectedContentId) return
    setSaving(true)
    try {
      const existing = logMap[agentId]?.[selectedContentId]?.[platform]
      let updated

      if (existing) {
        const { data, error } = await supabase
          .from('compliance_logs')
          .update({
            is_checked: !currentChecked,
            checked_by: user.id,
            checked_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        updated = data
      } else {
        const { data, error } = await supabase
          .from('compliance_logs')
          .insert({
            agent_id: agentId,
            content_id: selectedContentId,
            platform,
            is_checked: true,
            checked_by: user.id,
            checked_at: new Date().toISOString(),
          })
          .select()
          .single()
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

  function isAgentChecked(agentId) {
    if (!selectedContentId) return false
    const platforms = logMap[agentId]?.[selectedContentId] ?? {}
    return Object.values(platforms).some(log => log.is_checked)
  }

  const checkedAgents = agents.filter(a => isAgentChecked(a.id))
  const uncheckedAgents = agents.filter(a => !isAgentChecked(a.id))
  const displayedAgents = activeTab === 'checked' ? checkedAgents : uncheckedAgents

  const selectedContent = contents.find(c => c.id === selectedContentId)

  if (loading) {
    return (
      <Layout title="My Agents">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading your assignments…</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="My Agents">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Date bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p className="text-sm text-gray-500">{agents.length} agents assigned</p>
      </div>

      {contents.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-600 font-medium">No content for today</p>
          <p className="text-gray-400 text-sm mt-1">Check back after the admin publishes today's content.</p>
        </div>
      ) : (
        <>
          {/* Content selector */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Today's Content</p>
            <div className="flex gap-2 flex-wrap">
              {contents.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedContentId(c.id); setActiveTab('unchecked') }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    selectedContentId === c.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>

          {/* Selected content details */}
          {selectedContent && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5">
              <h2 className="font-semibold text-indigo-900">{selectedContent.title}</h2>
              {selectedContent.description && (
                <p className="text-sm text-indigo-700 mt-1">{selectedContent.description}</p>
              )}
              {selectedContent.media_link && (
                <a
                  href={selectedContent.media_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-indigo-600 underline"
                >
                  View media →
                </a>
              )}
            </div>
          )}

          {/* Unchecked / Checked tabs */}
          <div className="flex border-b border-gray-200 mb-5">
            {[
              { key: 'unchecked', label: 'To Do', count: uncheckedAgents.length, color: 'text-orange-600' },
              { key: 'checked', label: 'Done', count: checkedAgents.length, color: 'text-green-600' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Agent grid */}
          {agents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No agents assigned to you yet.
            </div>
          ) : displayedAgents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">{activeTab === 'checked' ? '📭' : '🎉'}</div>
              <p className="text-gray-600 font-medium">
                {activeTab === 'checked' ? 'No agents marked done yet.' : 'All agents done for this content!'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  logsByPlatform={logMap[agent.id]?.[selectedContentId] ?? {}}
                  onToggle={(agentId, platform, currentChecked) =>
                    handleToggle(agentId, platform, currentChecked)
                  }
                  saving={saving}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
