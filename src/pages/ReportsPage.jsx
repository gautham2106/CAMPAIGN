import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { getTodayIST, daysAgoIST } from '../lib/dateUtils'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'

const PLATFORMS = ['whatsapp', 'facebook', 'instagram']
const P_META = {
  whatsapp:  { label: 'WhatsApp',  short: 'WA', icon: '💬', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  facebook:  { label: 'Facebook',  short: 'FB', icon: '📘', bar: 'bg-blue-500',    text: 'text-blue-600'   },
  instagram: { label: 'Instagram', short: 'IG', icon: '📸', bar: 'bg-pink-500',    text: 'text-pink-600'   },
}

function pct(n, d) { return d ? Math.round(n / d * 100) : 0 }

function todayMinus(days) { return daysAgoIST(days) }

// ── Reusable stat card ────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-lg mb-3 ${colors[accent]}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Platform progress bar ─────────────────────────────────────────────────────
function PlatformRow({ platform, checked, opportunities }) {
  const m = P_META[platform]
  const val = pct(checked, opportunities)
  const textColor = val >= 80 ? 'text-emerald-600' : val >= 50 ? 'text-amber-600' : val > 0 ? 'text-rose-500' : 'text-slate-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-24 shrink-0">
        <span className="text-sm">{m.icon}</span>
        <span className="text-xs font-medium text-slate-600">{m.label}</span>
      </div>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${m.bar}`} style={{ width: `${val}%` }} />
      </div>
      <span className={`text-sm font-bold w-10 text-right shrink-0 ${textColor}`}>{val}%</span>
      <span className="text-xs text-slate-400 w-16 text-right shrink-0 hidden sm:block">{checked}/{opportunities}</span>
    </div>
  )
}

// ── Day/Content/Constituency tables ──────────────────────────────────────────
function DataTable({ rows, groupLabel }) {
  if (!rows.length) return <p className="text-sm text-slate-400 py-4 text-center">No data</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{groupLabel}</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Agents</th>
            {PLATFORMS.map(p => (
              <th key={p} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {P_META[p].icon} {P_META[p].short}
              </th>
            ))}
            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Overall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => {
            const overall = pct(
              PLATFORMS.reduce((s, p) => s + (row.platforms[p]?.checked ?? 0), 0),
              (row.agents ?? 0) * (row.contentCount ?? 1) * 3
            )
            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <div>{row.label}</div>
                  {row.sub && <div className="text-xs text-slate-400 font-normal mt-0.5">{row.sub}</div>}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{row.agents ?? '—'}</td>
                {PLATFORMS.map(p => {
                  const v = pct(row.platforms[p]?.checked ?? 0, (row.agents ?? 0) * (row.contentCount ?? 1))
                  return (
                    <td key={p} className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${v >= 80 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : v > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {v}%
                      </span>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center text-xs font-bold px-2.5 py-1 rounded-full ${
                    overall >= 80 ? 'bg-emerald-100 text-emerald-700' : overall >= 50 ? 'bg-amber-100 text-amber-700' : overall > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'
                  }`}>{overall}%</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'
  const isConstAdmin = profile?.role === 'constituency_admin'

  const [dateFrom, setDateFrom] = useState(todayMinus(7))
  const [dateTo, setDateTo] = useState(getTodayIST())
  const [selConst, setSelConst] = useState(isConstAdmin ? profile.constituency_id : 'all')
  const [selContent, setSelContent] = useState('all')

  const [constituencies, setConstituencies] = useState([])
  const [contentList, setContentList] = useState([])

  const [report, setReport] = useState(null)
  const [view, setView] = useState('day')   // 'day' | 'content' | 'constituency'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset content selection when date range changes and selected item falls outside
  useEffect(() => {
    if (selContent !== 'all') {
      const still = contentList.find(c => c.id === selContent && c.content_date >= dateFrom && c.content_date <= dateTo)
      if (!still) setSelContent('all')
    }
  }, [dateFrom, dateTo])

  useEffect(() => { loadFilters() }, [])

  async function loadFilters() {
    const client = supabaseAdmin ?? supabase
    const [cRes, contRes] = await Promise.all([
      client.from('constituencies').select('id,name').order('name'),
      // Fetch with target_constituencies so the dropdown can filter by constituency
      client.from('daily_content').select('id,title,content_date,target_constituencies').order('content_date', { ascending: false }).limit(1000),
    ])
    setConstituencies(cRes.data ?? [])
    setContentList(contRes.data ?? [])
  }

  async function runReport() {
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const client = supabaseAdmin ?? supabase

      // 1. Always fetch all content in date range, then filter by constituency in JS.
      //    Doing this in JS avoids Supabase query issues with [] vs null in arrays.
      let cq = client
        .from('daily_content')
        .select('id,title,content_date,target_constituencies')
        .gte('content_date', dateFrom)
        .lte('content_date', dateTo)
        .order('content_date')
      if (selContent !== 'all') cq = cq.eq('id', selContent)
      const { data: rawContent, error: ce } = await cq
      if (ce) throw ce

      // Normalise target_constituencies: treat [] same as null (means "all constituencies").
      // Then filter to only content relevant for the selected constituency.
      const rangeContent = (rawContent ?? []).map(c => ({
        ...c,
        target_constituencies: c.target_constituencies?.length > 0 ? c.target_constituencies : null,
      })).filter(c => {
        if (selConst === 'all') return true
        // null = targets all constituencies; otherwise must include selConst
        return c.target_constituencies === null || c.target_constituencies.includes(selConst)
      })

      // 2. Agents — paginate in 1000-row batches to bypass PostgREST max-rows default
      const allAgents = []
      const PAGE = 1000
      for (let offset = 0; ; offset += PAGE) {
        let aq = client
          .from('digital_agents')
          .select('id,constituency_id,assigned_monitor_id')
          .range(offset, offset + PAGE - 1)
        if (selConst !== 'all') aq = aq.eq('constituency_id', selConst)
        else if (isConstAdmin) aq = aq.eq('constituency_id', profile.constituency_id)
        const { data, error: ae } = await aq
        if (ae) throw ae
        allAgents.push(...(data ?? []))
        if (!data || data.length < PAGE) break
      }

      if (!rangeContent?.length || !allAgents.length) {
        setReport({ empty: true, rangeContent: rangeContent ?? [], agents: allAgents })
        setLoading(false)
        return
      }

      // 3. Compliance logs — filter by content_id ONLY (no agent_id filter) to avoid
      // PostgREST URL length limit with large agent lists. We filter by agent in JS below.
      const { data: logs, error: le } = await client
        .from('compliance_logs')
        .select('agent_id,content_id,platform,is_checked')
        .in('content_id', rangeContent.map(c => c.id))
        .eq('is_checked', true)
        .limit(500000)
      if (le) throw le

      // 4. Build index: { [content_id]: { [agent_id]: { [platform]: true } } }
      const idx = {}
      for (const l of logs ?? []) {
        if (!idx[l.content_id]) idx[l.content_id] = {}
        if (!idx[l.content_id][l.agent_id]) idx[l.content_id][l.agent_id] = {}
        idx[l.content_id][l.agent_id][l.platform] = true
      }

      // Build a map for fast agent lookups: agent_id → constituency_id
      const agentConstMap = {}
      for (const a of allAgents) agentConstMap[a.id] = a.constituency_id

      // Build a fast lookup: content_id → normalised target_constituencies (null = all)
      const contentTargetMap = {}
      for (const c of rangeContent) contentTargetMap[c.id] = c.target_constituencies // already normalised above

      // Helper: compute platform checked counts for given agent IDs × content IDs.
      // target_constituencies is already normalised (null = all, array = specific).
      function computePlatformStats(aIds, cIds) {
        const result = {}
        for (const p of PLATFORMS) {
          let checked = 0
          let opp = 0
          for (const cid of cIds) {
            const targeting = contentTargetMap[cid] // null = all, array = specific
            const eligible = targeting
              ? aIds.filter(aid => targeting.includes(agentConstMap[aid]))
              : aIds
            opp += eligible.length
            const clog = idx[cid]
            if (clog) for (const aid of eligible) if (clog[aid]?.[p]) checked++
          }
          result[p] = { checked, opportunities: opp }
        }
        return result
      }

      const allAgentIds = allAgents.map(a => a.id)

      // Overall
      const overall = computePlatformStats(allAgentIds, rangeContent.map(c => c.id))

      // By Day
      const dayGroups = {}
      for (const c of rangeContent) {
        if (!dayGroups[c.content_date]) dayGroups[c.content_date] = []
        dayGroups[c.content_date].push(c)
      }
      const byDay = Object.entries(dayGroups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayItems]) => {
          const cIds = dayItems.map(c => c.id)
          const platforms = computePlatformStats(allAgentIds, cIds)
          // Agent count = total eligible across all content items on this day (avg)
          const totalOpp = PLATFORMS.reduce((s, p) => s + platforms[p].opportunities, 0)
          const agentCount = cIds.length > 0 ? Math.round(totalOpp / PLATFORMS.length / cIds.length) : allAgents.length
          return {
            label: new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
            sub: `${cIds.length} content item${cIds.length > 1 ? 's' : ''}`,
            agents: agentCount,
            contentCount: cIds.length,
            platforms,
          }
        })

      // By Content — use only agents targeted by each content item
      const byContent = rangeContent.map(c => {
        const targeting = c.target_constituencies
        const targeted = targeting ? allAgents.filter(a => targeting.includes(a.constituency_id)) : allAgents
        return {
          label: c.title,
          sub: new Date(c.content_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          agents: targeted.length,
          contentCount: 1,
          platforms: computePlatformStats(targeted.map(a => a.id), [c.id]),
        }
      })

      // By Constituency — super admin, all-constituencies view only
      const byConst = []
      if (isSuperAdmin && selConst === 'all') {
        const constAgentMap = {}
        for (const a of allAgents) {
          if (!constAgentMap[a.constituency_id]) constAgentMap[a.constituency_id] = []
          constAgentMap[a.constituency_id].push(a.id)
        }
        for (const con of constituencies) {
          const cAgentIds = constAgentMap[con.id] ?? []
          if (!cAgentIds.length) continue
          // Only count content that targets this constituency (or all)
          const cContent = rangeContent.filter(rc =>
            !rc.target_constituencies || rc.target_constituencies.includes(con.id)
          )
          if (!cContent.length) continue
          byConst.push({
            label: con.name,
            sub: `${cAgentIds.length} agents · ${cContent.length} content`,
            agents: cAgentIds.length,
            contentCount: cContent.length,
            platforms: computePlatformStats(cAgentIds, cContent.map(c => c.id)),
          })
        }
      }

      setReport({ overall, byDay, byContent, byConst, totalAgents: allAgents.length, totalContent: rangeContent.length })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Quick overall % helper
  function overallPct(stats) {
    if (!stats) return 0
    const total = PLATFORMS.reduce((s, p) => s + (stats[p]?.opportunities ?? 0), 0)
    const checked = PLATFORMS.reduce((s, p) => s + (stats[p]?.checked ?? 0), 0)
    return pct(checked, total)
  }

  const views = [
    { key: 'day', label: 'By Day' },
    { key: 'content', label: 'By Content' },
    ...(isSuperAdmin || selConst === 'all' ? [{ key: 'constituency', label: 'By Constituency' }] : []),
  ]

  return (
    <Layout title="Reports">
      {/* ── Filter panel ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 print:hidden">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">From Date</label>
            <input type="date" value={dateFrom} max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">To Date</label>
            <input type="date" value={dateTo} min={dateFrom} max={getTodayIST()}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
          {isSuperAdmin && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Constituency</label>
              <select value={selConst} onChange={e => setSelConst(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="all">All Constituencies</option>
                {constituencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Content</label>
            <select value={selContent} onChange={e => setSelContent(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              <option value="all">All Content</option>
              {contentList
                .filter(c => {
                  if (c.content_date < dateFrom || c.content_date > dateTo) return false
                  if (selConst !== 'all' && c.target_constituencies?.length > 0 && !c.target_constituencies.includes(selConst)) return false
                  return true
                })
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({new Date(c.content_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                  </option>
                ))
              }
            </select>
          </div>
        </div>

        {/* Quick range shortcuts */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {[
            { label: 'Today', from: todayMinus(0), to: getTodayIST() },
            { label: 'Last 7 days', from: todayMinus(7), to: getTodayIST() },
            { label: 'Last 30 days', from: todayMinus(30), to: getTodayIST() },
          ].map(r => (
            <button key={r.label} onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                dateFrom === r.from && dateTo === r.to
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
              }`}>
              {r.label}
            </button>
          ))}
          <div className="flex gap-2 ml-auto sm:ml-0">
            <button
              onClick={runReport}
              disabled={loading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {loading ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running…</>
              ) : (
                <><span>📊</span>Run Report</>
              )}
            </button>
            {report && !report.empty && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors print:hidden"
              >
                <span>🖨️</span>Export PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>
      )}

      {/* ── Empty / no-run state ── */}
      {!report && !loading && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-3xl mb-4">📊</div>
          <p className="font-semibold text-slate-700">Set your filters and run the report</p>
          <p className="text-sm text-slate-400 mt-1">Choose a date range, constituency, and content item to analyse.</p>
        </div>
      )}

      {report?.empty && (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 text-3xl mb-4">🔍</div>
          <p className="font-semibold text-slate-700">No data found</p>
          <p className="text-sm text-slate-400 mt-1">
            {report.rangeContent.length === 0 ? 'No content was published in this date range.' : 'No agents match the selected constituency.'}
          </p>
        </div>
      )}

      {/* ── Report results ── */}
      {report && !report.empty && (
        <div className="space-y-6" id="report-output">

          {/* Print-only header */}
          <div className="hidden print:block mb-2 pb-4 border-b border-slate-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-black text-lg text-slate-900">Campaign Monitor</span>
              <span className="text-slate-400">·</span>
              <span className="font-semibold text-slate-600">Compliance Report</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
              <span>Period: <strong className="text-slate-700">{dateFrom}</strong> → <strong className="text-slate-700">{dateTo}</strong></span>
              {selConst !== 'all' && <span>Constituency: <strong className="text-slate-700">{constituencies.find(c => c.id === selConst)?.name ?? '—'}</strong></span>}
              {selContent !== 'all' && <span>Content: <strong className="text-slate-700">{contentList.find(c => c.id === selContent)?.title ?? '—'}</strong></span>}
              <span>Generated: <strong className="text-slate-700">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
            </div>
          </div>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="🗳️" label="Agents" value={report.totalAgents} accent="indigo" />
            <StatCard icon="📋" label="Content Items" value={report.totalContent} accent="indigo" />
            <StatCard icon="✅" label="Overall Compliance"
              value={`${overallPct(report.overall)}%`}
              sub={`${dateFrom} → ${dateTo}`}
              accent={overallPct(report.overall) >= 80 ? 'emerald' : overallPct(report.overall) >= 50 ? 'amber' : 'rose'}
            />
            <StatCard icon="📅" label="Days in Range"
              value={Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1}
              accent="indigo"
            />
          </div>

          {/* Overall platform breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 mb-4">Platform Breakdown — Overall</h3>
            <div className="space-y-3">
              {PLATFORMS.map(p => (
                <PlatformRow key={p} platform={p}
                  checked={report.overall[p]?.checked ?? 0}
                  opportunities={report.overall[p]?.opportunities ?? 0}
                />
              ))}
            </div>
          </div>

          {/* View selector */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit print:hidden">
            {views.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  view === v.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Interactive tables — screen only */}
          <div className="print:hidden">
            {view === 'day'          && <DataTable rows={report.byDay}     groupLabel="Date"           />}
            {view === 'content'      && <DataTable rows={report.byContent}  groupLabel="Content"        />}
            {view === 'constituency' && <DataTable rows={report.byConst}    groupLabel="Constituency"   />}
          </div>

          {/* Print — all tables always rendered */}
          <div className="hidden print:block space-y-8">
            {report.byDay.length > 0 && (
              <div>
                <h2 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide">By Day</h2>
                <DataTable rows={report.byDay} groupLabel="Date" />
              </div>
            )}
            {report.byContent.length > 0 && (
              <div>
                <h2 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide">By Content</h2>
                <DataTable rows={report.byContent} groupLabel="Content" />
              </div>
            )}
            {report.byConst?.length > 0 && (
              <div>
                <h2 className="font-bold text-slate-800 mb-2 text-sm uppercase tracking-wide">By Constituency</h2>
                <DataTable rows={report.byConst} groupLabel="Constituency" />
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
