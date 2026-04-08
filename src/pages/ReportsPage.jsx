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
            // Use pre-computed opportunities directly (sum of total_agents from view)
            const totalChecked = PLATFORMS.reduce((s, p) => s + (row.platforms[p]?.checked ?? 0), 0)
            const totalOpp = PLATFORMS.reduce((s, p) => s + (row.platforms[p]?.opportunities ?? 0), 0)
            const overall = pct(totalChecked, totalOpp)
            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">
                  <div>{row.label}</div>
                  {row.sub && <div className="text-xs text-slate-400 font-normal mt-0.5">{row.sub}</div>}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{row.agents ?? '—'}</td>
                {PLATFORMS.map(p => {
                  const v = pct(row.platforms[p]?.checked ?? 0, row.platforms[p]?.opportunities ?? 0)
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

      // Single query to the pre-aggregated view — no raw compliance_logs or digital_agents fetch.
      // The view already computes total_agents, wa_done, fb_done, ig_done per (content × constituency).
      let q = client
        .from('constituency_content_stats')
        .select('content_id,content_date,title,target_constituencies,constituency_id,total_agents,wa_done,fb_done,ig_done,all_done')
        .gte('content_date', dateFrom)
        .lte('content_date', dateTo)
        .order('content_date')

      if (selContent !== 'all') q = q.eq('content_id', selContent)
      if (selConst !== 'all') q = q.eq('constituency_id', selConst)
      else if (isConstAdmin) q = q.eq('constituency_id', profile.constituency_id)

      const { data: rows, error: re } = await q
      if (re) throw re

      if (!rows?.length) {
        setReport({ empty: true })
        setLoading(false)
        return
      }

      // Helper: sum wa_done/fb_done/ig_done and total_agents across a set of view rows.
      // Each view row already has the correct denominator (total_agents) and numerators.
      function sumStats(rowSet) {
        const result = {}
        for (const p of PLATFORMS) {
          const key = p === 'whatsapp' ? 'wa_done' : p === 'facebook' ? 'fb_done' : 'ig_done'
          result[p] = {
            checked:       rowSet.reduce((s, r) => s + (r[key]        ?? 0), 0),
            opportunities: rowSet.reduce((s, r) => s + (r.total_agents ?? 0), 0),
          }
        }
        return result
      }

      // Overall
      const overall = sumStats(rows)

      // Unique content IDs for summary card
      const uniqueContentIds = [...new Set(rows.map(r => r.content_id))]

      // Total unique agents: sum total_agents once per constituency (first occurrence).
      // This gives total distinct agents across all targeted constituencies.
      const seenConst = new Set()
      let totalAgents = 0
      for (const r of rows) {
        if (!seenConst.has(r.constituency_id)) {
          seenConst.add(r.constituency_id)
          totalAgents += r.total_agents ?? 0
        }
      }

      // By Day — group rows by content_date
      const dayMap = {}
      for (const r of rows) {
        if (!dayMap[r.content_date]) dayMap[r.content_date] = []
        dayMap[r.content_date].push(r)
      }
      const byDay = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayRows]) => {
          const platforms = sumStats(dayRows)
          const contentCount = new Set(dayRows.map(r => r.content_id)).size
          // Average agents per content item on this day
          const avgAgents = contentCount > 0
            ? Math.round(platforms.whatsapp.opportunities / contentCount)
            : 0
          return {
            label: new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
            sub: `${contentCount} content item${contentCount > 1 ? 's' : ''}`,
            agents: avgAgents,
            platforms,
          }
        })

      // By Content — group rows by content_id, sum across constituencies
      const contentMap = {}
      for (const r of rows) {
        if (!contentMap[r.content_id]) contentMap[r.content_id] = { title: r.title, date: r.content_date, rows: [] }
        contentMap[r.content_id].rows.push(r)
      }
      const byContent = Object.entries(contentMap).map(([, { title, date, rows: cRows }]) => {
        const platforms = sumStats(cRows)
        return {
          label: title,
          sub: new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          // opportunities = total agents targeted by this content (summed across constituencies)
          agents: platforms.whatsapp.opportunities,
          platforms,
        }
      })

      // By Constituency — super admin, all-const view only
      const byConst = []
      if (isSuperAdmin && selConst === 'all') {
        const constMap = {}
        for (const r of rows) {
          if (!constMap[r.constituency_id]) constMap[r.constituency_id] = []
          constMap[r.constituency_id].push(r)
        }
        for (const con of constituencies) {
          const cRows = constMap[con.id]
          if (!cRows?.length) continue
          const platforms = sumStats(cRows)
          const contentCount = new Set(cRows.map(r => r.content_id)).size
          const agentCount = cRows[0]?.total_agents ?? 0
          byConst.push({
            label: con.name,
            sub: `${agentCount} agents · ${contentCount} content`,
            agents: agentCount,
            platforms,
          })
        }
      }

      setReport({ overall, byDay, byContent, byConst, totalAgents, totalContent: uniqueContentIds.length })
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
