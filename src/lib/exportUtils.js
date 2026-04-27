import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function isValidLink(url) {
  if (!url || !url.trim()) return false
  return /^(https?:\/\/|www\.).+\..+/.test(url.trim())
}

function getPlace(boothNum, places) {
  if (boothNum == null) return null
  return places.find(p => boothNum >= p.booth_from && boothNum <= p.booth_to) ?? null
}

function linkStatus(a) {
  const fb = isValidLink(a.fb_url)
  const ig = isValidLink(a.ig_url)
  if (fb && ig) return 'OK'
  if (!fb && !ig) return 'FB + IG Missing'
  if (!fb) return 'FB Missing'
  return 'IG Missing'
}

/**
 * Build a worksheet's worth of data for one constituency.
 * Returns an array-of-arrays suitable for XLSX.utils.aoa_to_sheet.
 */
function buildConstSheetData(agents, monitors, boothAssignments, places, sortBy) {
  const monitorMap = Object.fromEntries(monitors.map(m => [m.id, m.full_name]))

  // ── Agent rows ────────────────────────────────────────────────────────────
  let sorted = [...agents]
  if (sortBy === 'place') {
    sorted.sort((a, b) => {
      const pa = getPlace(a.booth_number, places)?.name ?? 'zzz'
      const pb = getPlace(b.booth_number, places)?.name ?? 'zzz'
      if (pa !== pb) return pa.localeCompare(pb)
      return (a.booth_number ?? 99999) - (b.booth_number ?? 99999)
    })
  } else {
    // booth-wise (default)
    sorted.sort((a, b) => (a.booth_number ?? 99999) - (b.booth_number ?? 99999))
  }

  const AGENT_HEADERS = [
    'Place', 'Monitor', 'Booth #', 'Agent Name',
    'Gender', 'Phone', 'FB URL', 'FB Valid',
    'IG URL', 'IG Valid', 'Twitter URL', 'Link Status',
  ]

  const agentRows = sorted.map(a => [
    getPlace(a.booth_number, places)?.name ?? '—',
    monitorMap[a.assigned_monitor_id] ?? '(Unassigned)',
    a.booth_number ?? '',
    a.name ?? '',
    a.gender ?? '',
    a.phone ?? '',
    a.fb_url ?? '',
    isValidLink(a.fb_url) ? 'YES' : 'NO',
    a.ig_url ?? '',
    isValidLink(a.ig_url) ? 'YES' : 'NO',
    a.twitter_url ?? '',
    linkStatus(a),
  ])

  // ── Vacant booth rows ─────────────────────────────────────────────────────
  const assigned = new Set(agents.map(a => a.booth_number).filter(n => n != null))
  const vacantRows = []
  for (const m of monitors) {
    const mRanges = boothAssignments.filter(b => b.monitor_id === m.id)
    for (const r of mRanges) {
      for (let n = r.booth_from; n <= r.booth_to; n++) {
        if (!assigned.has(n)) {
          vacantRows.push({
            place:   getPlace(n, places)?.name ?? '—',
            monitor: m.full_name,
            booth:   n,
          })
        }
      }
    }
  }

  if (sortBy === 'place') {
    vacantRows.sort((a, b) => {
      if (a.place !== b.place) return a.place.localeCompare(b.place)
      return a.booth - b.booth
    })
  } else {
    vacantRows.sort((a, b) => a.booth - b.booth)
  }

  // ── Assemble the full sheet as array-of-arrays ────────────────────────────
  const data = [AGENT_HEADERS, ...agentRows]

  if (vacantRows.length) {
    data.push([])  // blank separator
    data.push(['── VACANT BOOTHS ──', '', '', '', '', '', '', '', '', '', '', ''])
    data.push(['Place', 'Monitor', 'Booth #'])
    for (const v of vacantRows) data.push([v.place, v.monitor, v.booth])
  }

  return data
}

/**
 * Build a place-wise sheet for one constituency.
 * Top section: summary table (one row per place with counts + %).
 * Bottom section: detailed agent list grouped by place with sub-totals.
 */
function buildPlaceWiseSheetData(constName, agents, monitors, boothAssignments, places) {
  const monitorMap = Object.fromEntries(monitors.map(m => [m.id, m.full_name]))
  const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name))
  const assignedBooths = new Set(agents.map(a => a.booth_number).filter(n => n != null))

  // Group agents and vacant booths by place
  const placeAgents  = {}  // { placeName: agent[] }
  const placeVacant  = {}  // { placeName: boothNum[] }

  for (const p of sortedPlaces) {
    placeAgents[p.name] = []
    placeVacant[p.name] = []
  }

  const noPlaceAgents = []
  for (const a of agents) {
    const p = getPlace(a.booth_number, places)
    if (p) placeAgents[p.name].push(a)
    else   noPlaceAgents.push(a)
  }

  for (const m of monitors) {
    for (const r of boothAssignments.filter(b => b.monitor_id === m.id)) {
      for (let n = r.booth_from; n <= r.booth_to; n++) {
        if (!assignedBooths.has(n)) {
          const p = getPlace(n, places)
          if (p && placeVacant[p.name] !== undefined) placeVacant[p.name].push(n)
        }
      }
    }
  }

  // Sort agents within each place by booth
  for (const name of Object.keys(placeAgents)) {
    placeAgents[name].sort((a, b) => (a.booth_number ?? 99999) - (b.booth_number ?? 99999))
  }
  noPlaceAgents.sort((a, b) => (a.booth_number ?? 99999) - (b.booth_number ?? 99999))

  function pctStr(num, den) {
    return den ? Math.round(num / den * 100) + '%' : '—'
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  const SUMMARY_HEADERS = [
    'Place', 'Total Agents', 'FB Valid', 'FB%',
    'IG Valid', 'IG%', 'Both Valid', 'Both%', 'Vacant Booths',
  ]

  const summaryRows = sortedPlaces.map(p => {
    const pa     = placeAgents[p.name] ?? []
    const total  = pa.length
    const fbOK   = pa.filter(a => isValidLink(a.fb_url)).length
    const igOK   = pa.filter(a => isValidLink(a.ig_url)).length
    const bothOK = pa.filter(a => isValidLink(a.fb_url) && isValidLink(a.ig_url)).length
    const vacant = (placeVacant[p.name] ?? []).length
    return [p.name, total, fbOK, pctStr(fbOK, total), igOK, pctStr(igOK, total), bothOK, pctStr(bothOK, total), vacant]
  })

  const allTotal  = agents.length
  const allFB     = agents.filter(a => isValidLink(a.fb_url)).length
  const allIG     = agents.filter(a => isValidLink(a.ig_url)).length
  const allBoth   = agents.filter(a => isValidLink(a.fb_url) && isValidLink(a.ig_url)).length
  const allVacant = Object.values(placeVacant).reduce((s, arr) => s + arr.length, 0)
  const totalRow  = ['TOTAL', allTotal, allFB, pctStr(allFB, allTotal), allIG, pctStr(allIG, allTotal), allBoth, pctStr(allBoth, allTotal), allVacant]

  // ── Detailed section ───────────────────────────────────────────────────────
  const AGENT_HEADERS = [
    'Monitor', 'Booth #', 'Agent Name', 'Gender', 'Phone',
    'FB URL', 'FB Valid', 'IG URL', 'IG Valid', 'Twitter URL', 'Link Status',
  ]

  function agentRow(a) {
    return [
      monitorMap[a.assigned_monitor_id] ?? '(Unassigned)',
      a.booth_number ?? '',
      a.name ?? '',
      a.gender ?? '',
      a.phone ?? '',
      a.fb_url ?? '',
      isValidLink(a.fb_url) ? 'YES' : 'NO',
      a.ig_url ?? '',
      isValidLink(a.ig_url) ? 'YES' : 'NO',
      a.twitter_url ?? '',
      linkStatus(a),
    ]
  }

  const data = [
    [`Place-wise Report — ${constName}`],
    [],
    SUMMARY_HEADERS,
    ...summaryRows,
    totalRow,
    [],
    [],
    ['── DETAILED AGENT LIST BY PLACE ──'],
  ]

  for (const p of sortedPlaces) {
    const pa      = placeAgents[p.name] ?? []
    const vacant  = placeVacant[p.name] ?? []
    const fbOK    = pa.filter(a => isValidLink(a.fb_url)).length
    const igOK    = pa.filter(a => isValidLink(a.ig_url)).length

    data.push([])
    data.push([`PLACE: ${p.name}`, `${pa.length} agents`, `${vacant.length} vacant booths`])

    if (pa.length === 0) {
      data.push(['(No agents assigned)'])
    } else {
      data.push(AGENT_HEADERS)
      for (const a of pa) data.push(agentRow(a))
      data.push([`Subtotal: ${pa.length} agents`, '', '', '', '', `FB: ${fbOK}/${pa.length}`, '', `IG: ${igOK}/${pa.length}`])
    }

    if (vacant.length > 0) {
      data.push([`Vacant booths (${vacant.length}): ${vacant.join(', ')}`])
    }
  }

  if (noPlaceAgents.length > 0) {
    data.push([])
    data.push([`PLACE: (No Place Assigned)`, `${noPlaceAgents.length} agents`])
    data.push(AGENT_HEADERS)
    for (const a of noPlaceAgents) data.push(agentRow(a))
  }

  return data
}

/**
 * Download master Excel report for one or all constituencies.
 */
export function exportMasterReport({ constituencies, agentsMap, monitorsMap, boothMap, placesMap, sortBy, singleConstId }) {
  const wb = XLSX.utils.book_new()

  const list = singleConstId
    ? constituencies.filter(c => c.id === singleConstId)
    : constituencies

  for (const c of list) {
    const sheetData = buildConstSheetData(
      agentsMap[c.id]   ?? [],
      monitorsMap[c.id] ?? [],
      boothMap[c.id]    ?? [],
      placesMap[c.id]   ?? [],
      sortBy,
    )
    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    ws['!cols'] = [20, 22, 8, 24, 8, 14, 40, 8, 40, 8, 30, 16].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, c.name.slice(0, 31))
  }

  const today = new Date().toISOString().slice(0, 10)
  const fname = singleConstId
    ? `${list[0]?.name ?? 'constituency'}_master_${today}.xlsx`
    : `all_constituencies_master_${today}.xlsx`

  XLSX.writeFile(wb, fname)
}

/**
 * Build the place-wise performance (compliance) sheet for one constituency.
 *
 * Layout:
 *  1. Overall summary table — one row per place, WA/FB/IG checked counts + %
 *     across ALL content items for the date.
 *  2. Per-content sections — same place breakdown repeated for each content item.
 */
function buildPlacePerformanceSheetData(constName, agents, monitors, boothAssignments, places, contents, logs, date) {
  const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name))

  // Agent id → place name
  const agentPlaceMap = {}
  for (const a of agents) {
    const p = getPlace(a.booth_number, places)
    agentPlaceMap[a.id] = p?.name ?? null
  }

  // Monitors covering each place (booth range overlap)
  const placeMonitorNames = {}
  for (const p of sortedPlaces) {
    placeMonitorNames[p.name] = monitors
      .filter(m => boothAssignments.some(b =>
        b.monitor_id === m.id &&
        b.booth_from <= p.booth_to &&
        b.booth_to   >= p.booth_from
      ))
      .map(m => m.full_name)
  }

  // Agent count per place
  const placeAgentIds = {}
  for (const p of sortedPlaces) placeAgentIds[p.name] = []
  for (const a of agents) {
    const pname = agentPlaceMap[a.id]
    if (pname && placeAgentIds[pname]) placeAgentIds[pname].push(a.id)
  }

  // Compliance lookup: { agentId: { contentId: { whatsapp, facebook, instagram } } }
  const compMap = {}
  for (const log of logs) {
    if (!log.is_checked) continue
    if (!compMap[log.agent_id]) compMap[log.agent_id] = {}
    if (!compMap[log.agent_id][log.content_id]) compMap[log.agent_id][log.content_id] = {}
    compMap[log.agent_id][log.content_id][log.platform] = true
  }

  function pctStr(num, den) {
    return den ? Math.round(num / den * 100) + '%' : '—'
  }

  // Stats for a set of agent IDs against a specific content item
  function contentStats(agentIds, contentId) {
    let wa = 0, fb = 0, ig = 0
    for (const id of agentIds) {
      const c = compMap[id]?.[contentId] ?? {}
      if (c.whatsapp)  wa++
      if (c.facebook)  fb++
      if (c.instagram) ig++
    }
    return { n: agentIds.length, wa, fb, ig }
  }

  // Stats for a set of agent IDs aggregated across all content items
  function allContentStats(agentIds) {
    const nc = contents.length
    let wa = 0, fb = 0, ig = 0
    for (const id of agentIds) {
      for (const ct of contents) {
        const c = compMap[id]?.[ct.id] ?? {}
        if (c.whatsapp)  wa++
        if (c.facebook)  fb++
        if (c.instagram) ig++
      }
    }
    return { n: agentIds.length, nc, wa, fb, ig }
  }

  const PERF_HEADERS = [
    'Place', 'Monitors', 'Total Agents',
    'WA Checked', 'WA%', 'FB Checked', 'FB%', 'IG Checked', 'IG%',
  ]

  function summarySection(label, statsFn) {
    const rows = []
    let tN = 0, tWA = 0, tFB = 0, tIG = 0, tOpp = 0
    for (const p of sortedPlaces) {
      const ids = placeAgentIds[p.name] ?? []
      const { n, nc, wa, fb, ig } = statsFn(ids)
      const opp = nc !== undefined ? n * nc : n  // nc = content count for overall, else 1 per content row
      tN += n; tWA += wa; tFB += fb; tIG += ig; tOpp += opp
      rows.push([
        p.name,
        (placeMonitorNames[p.name] ?? []).join(', ') || '—',
        n,
        wa, pctStr(wa, opp),
        fb, pctStr(fb, opp),
        ig, pctStr(ig, opp),
      ])
    }
    rows.push(['TOTAL', '', tN, tWA, pctStr(tWA, tOpp), tFB, pctStr(tFB, tOpp), tIG, pctStr(tIG, tOpp)])
    return [
      [label],
      PERF_HEADERS,
      ...rows,
    ]
  }

  const data = [
    [`Place Performance Report — ${constName} — ${date}`],
    [`Content items on this date: ${contents.length}`],
    [],
  ]

  if (contents.length === 0) {
    data.push(['No content found for this date.'])
    return data
  }

  // 1. Overall summary (all content combined)
  data.push(...summarySection('── OVERALL (all content combined) ──', allContentStats))

  // 2. Per-content breakdowns
  for (const ct of contents) {
    data.push([])
    data.push(...summarySection(
      `── CONTENT: ${ct.title} ──`,
      ids => { const s = contentStats(ids, ct.id); return { ...s, nc: 1 } }
    ))
  }

  return data
}

/**
 * Download place-wise Excel report for one or all constituencies.
 * Each constituency gets one sheet with a summary table + detailed grouped agent list.
 */
export function exportPlaceWiseReport({ constituencies, agentsMap, monitorsMap, boothMap, placesMap, singleConstId }) {
  const wb = XLSX.utils.book_new()

  const list = singleConstId
    ? constituencies.filter(c => c.id === singleConstId)
    : constituencies

  for (const c of list) {
    const sheetData = buildPlaceWiseSheetData(
      c.name,
      agentsMap[c.id]   ?? [],
      monitorsMap[c.id] ?? [],
      boothMap[c.id]    ?? [],
      placesMap[c.id]   ?? [],
    )
    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    ws['!cols'] = [26, 10, 24, 8, 14, 40, 8, 40, 8, 30, 16].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, c.name.slice(0, 31))
  }

  const today = new Date().toISOString().slice(0, 10)
  const fname = singleConstId
    ? `${list[0]?.name ?? 'constituency'}_place_report_${today}.xlsx`
    : `all_constituencies_place_report_${today}.xlsx`

  XLSX.writeFile(wb, fname)
}

/**
 * Download place performance (compliance) Excel report for one or all constituencies.
 * Shows WA/FB/IG check counts and % per place, overall and per content item.
 *
 * @param {Object} opts.contentsMap  { [constId]: dailyContent[] }  — already filtered to constituency
 * @param {Object} opts.logsMap      { [constId]: complianceLog[] }
 * @param {string} opts.date         YYYY-MM-DD label used in filename and header
 */
export function exportPlacePerformanceReport({ constituencies, agentsMap, monitorsMap, boothMap, placesMap, contentsMap, logsMap, singleConstId, date }) {
  const wb = XLSX.utils.book_new()

  const list = singleConstId
    ? constituencies.filter(c => c.id === singleConstId)
    : constituencies

  for (const c of list) {
    const sheetData = buildPlacePerformanceSheetData(
      c.name,
      agentsMap[c.id]   ?? [],
      monitorsMap[c.id] ?? [],
      boothMap[c.id]    ?? [],
      placesMap[c.id]   ?? [],
      contentsMap[c.id] ?? [],
      logsMap[c.id]     ?? [],
      date,
    )
    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    ws['!cols'] = [26, 38, 13, 13, 8, 13, 8, 13, 8].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, c.name.slice(0, 31))
  }

  const fname = singleConstId
    ? `${list[0]?.name ?? 'constituency'}_place_performance_${date}.xlsx`
    : `all_constituencies_place_performance_${date}.xlsx`

  XLSX.writeFile(wb, fname)
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF font helpers — Noto Sans Tamil supports Tamil Unicode + Latin
// ─────────────────────────────────────────────────────────────────────────────

let _fontCache = null

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function loadPDFFonts() {
  if (_fontCache) return _fontCache
  try {
    const [regRes, boldRes] = await Promise.all([
      fetch('/fonts/NotoSansTamil-Regular.ttf'),
      fetch('/fonts/NotoSansTamil-Bold.ttf'),
    ])
    if (!regRes.ok || !boldRes.ok) return null
    const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()])
    _fontCache = { regular: arrayBufferToBase64(regBuf), bold: arrayBufferToBase64(boldBuf) }
    return _fontCache
  } catch (e) {
    console.warn('PDF font load failed, using built-in font:', e)
    return null
  }
}

function setupFont(doc, fonts) {
  if (!fonts) return false
  try {
    doc.addFileToVFS('NotoSansTamil-Regular.ttf', fonts.regular)
    doc.addFileToVFS('NotoSansTamil-Bold.ttf', fonts.bold)
    doc.addFont('NotoSansTamil-Regular.ttf', 'Tamil', 'normal')
    doc.addFont('NotoSansTamil-Bold.ttf', 'Tamil', 'bold')
    doc.setFont('Tamil', 'normal')
    return true
  } catch (e) {
    console.warn('Tamil font registration failed, using helvetica:', e)
    return false
  }
}

/**
 * Export a place-wise performance PDF.
 */
export function exportPlacePerformancePDF({ constituencyName, date, postTitle, rows, fonts }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const F = setupFont(doc, fonts) ? 'Tamil' : 'helvetica'

  const pageW = doc.internal.pageSize.getWidth()

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(24, 24, 27)           // zinc-950
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont(F, 'bold')
  doc.text('Place Performance Report', 14, 10)
  doc.setFontSize(9)
  doc.setFont(F, 'normal')
  doc.text(`${constituencyName}  ·  ${date}${postTitle ? `  ·  Post: ${postTitle}` : '  ·  All Posts'}`, 14, 17)

  // ── Summary stats ────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(8.5)
  doc.setFont(F, 'normal')

  const totalPlaces = rows.length
  const avgOf = rows.map(r => {
    const opp = r.total * r.contentCount || 1
    const pct = n => Math.round(n / opp * 100)
    return Math.round((pct(r.wa) + pct(r.fb) + pct(r.ig)) / 3)
  })
  const overallAvg = avgOf.length ? Math.round(avgOf.reduce((s, v) => s + v, 0) / avgOf.length) : 0
  const goodPlaces = avgOf.filter(v => v >= 80).length

  doc.text(`Total places: ${totalPlaces}    Overall avg: ${overallAvg}%    Places ≥80%: ${goodPlaces}`, 14, 29)

  // ── Table ───────────────────────────────────────────────────────────────
  const tableRows = rows.map(r => {
    const opp = r.total * r.contentCount || 1
    const pct = n => `${Math.round(n / opp * 100)}%`
    const avg = Math.round(
      (Math.round(r.wa / opp * 100) + Math.round(r.fb / opp * 100) + Math.round(r.ig / opp * 100)) / 3
    )
    return [
      r.place_name,
      r.monitor_names || '—',
      String(r.total),
      pct(r.wa),
      pct(r.fb),
      pct(r.ig),
      `${avg}%`,
    ]
  })

  autoTable(doc, {
    startY: 33,
    head: [['Place', 'Monitor(s)', 'Agents', 'WA %', 'FB %', 'IG %', 'Avg %']],
    body: tableRows,
    styles: { font: F, fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { font: F, fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 52 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 6) {
        const val = parseInt(data.cell.raw)
        if (val >= 80)      { data.cell.styles.textColor = [22, 163, 74];  data.cell.styles.fontStyle = 'bold' }
        else if (val >= 50) { data.cell.styles.textColor = [161, 98, 7];   data.cell.styles.fontStyle = 'bold' }
        else if (val > 0)   { data.cell.styles.textColor = [220, 38, 38];  data.cell.styles.fontStyle = 'bold' }
        else                { data.cell.styles.textColor = [156, 163, 175] }
      }
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: 14, right: 14 },
  })

  // ── Footer ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      `Page ${i} of ${pageCount}  ·  Generated ${new Date().toLocaleString('en-IN')}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }

  const safeName = constituencyName.replace(/[^a-z0-9]/gi, '_')
  doc.save(`${safeName}_place_performance_${date}.pdf`)
}

/**
 * Generate and save one PDF for a single constituency.
 * Called in a loop to produce separate per-constituency files.
 *
 * @param {object} opts.constRow      one row from constituency_season_stats
 * @param {Array}  opts.monitorStats  rows from monitor_season_stats (this constituency only)
 * @param {Array}  opts.agentStats    rows from agent_season_stats   (this constituency only)
 * @param {object|null} opts.admin    matching admin profile, or null
 */
export function exportConstituencyPDF({ constRow, monitorStats, agentStats, admin, fonts }) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const F = setupFont(doc, fonts) ? 'Tamil' : 'helvetica'
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const pct = constRow.overall_pct ?? 0

  const monNameMap = {}
  for (const m of monitorStats) monNameMap[m.monitor_id] = m.monitor_name

  function pctColor(val) {
    if (val >= 80) return [22, 163, 74]
    if (val >= 50) return [161, 98, 7]
    if (val > 0)   return [220, 38, 38]
    return [156, 163, 175]
  }

  // ── Constituency header bar ──────────────────────────────────────────
  const hFill = pct >= 80 ? [22, 163, 74] : pct >= 50 ? [161, 98, 7] : pct > 0 ? [220, 38, 38] : [71, 85, 105]
  doc.setFillColor(...hFill)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(F, 'bold')
  doc.setFontSize(16)
  doc.text(constRow.constituency_name.toUpperCase(), 14, 11)
  doc.setFont(F, 'normal')
  doc.setFontSize(8.5)
  const adminLine = admin
    ? `Admin: ${admin.full_name}${admin.phone ? '   ·   ' + admin.phone : ''}`
    : 'No admin assigned'
  doc.text(adminLine, 14, 19)
  doc.setFontSize(7.5)
  doc.setTextColor(220, 255, 220)
  doc.text(
    `Agents: ${constRow.agent_count ?? 0}   Monitors: ${constRow.monitor_count ?? 0}   Posts: ${constRow.total_posts ?? 0}`,
    14, 25.5
  )

  // Overall % badge
  doc.setFillColor(0, 0, 0)
  doc.roundedRect(pageW - 46, 5, 32, 18, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(F, 'bold')
  doc.setFontSize(16)
  doc.text(`${pct}%`, pageW - 30, 16.5, { align: 'center' })
  doc.setFont(F, 'normal')
  doc.setFontSize(6)
  doc.text('OVERALL', pageW - 30, 21.5, { align: 'center' })

  let currentY = 32

  // ── Monitors ────────────────────────────────────────────────────────
  const sortedMons = [...monitorStats].sort((a, b) => (b.overall_pct ?? 0) - (a.overall_pct ?? 0))
  if (sortedMons.length > 0) {
    doc.setFontSize(8.5)
    doc.setFont(F, 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('MONITORS', 14, currentY + 5)
    currentY += 8

    const monRows = sortedMons.map(m => {
      const slots = m.total_slots || 1
      return [
        m.monitor_name,
        m.phone ?? '—',
        String(m.agent_count ?? 0),
        `${Math.round((m.wa_done ?? 0) / slots * 100)}%`,
        `${Math.round((m.fb_done ?? 0) / slots * 100)}%`,
        `${Math.round((m.ig_done ?? 0) / slots * 100)}%`,
        `${m.overall_pct ?? 0}%`,
      ]
    })

    autoTable(doc, {
      startY: currentY,
      head: [['Monitor Name', 'Phone', 'Agents', 'WA %', 'FB %', 'IG %', 'Overall %']],
      body: monRows,
      styles: { font: F, fontSize: 8, cellPadding: 2.2 },
      headStyles: { font: F, fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 30 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 22, halign: 'center' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 6) {
          const val = parseInt(data.cell.raw)
          data.cell.styles.textColor = pctColor(val)
          data.cell.styles.fontStyle = 'bold'
        }
      },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      margin: { left: 14, right: 14 },
    })
    currentY = doc.lastAutoTable.finalY + 8
  }

  // ── Digital Agents ──────────────────────────────────────────────────
  if (agentStats.length > 0) {
    if (currentY > 230) { doc.addPage(); currentY = 15 }
    doc.setFontSize(8.5)
    doc.setFont(F, 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('DIGITAL AGENTS', 14, currentY + 5)
    currentY += 8

    const constApplicable = []
    const agentRows = [...agentStats]
      .sort((a, b) => {
        const ta = (a.wa_done ?? 0) + (a.fb_done ?? 0) + (a.ig_done ?? 0)
        const tb = (b.wa_done ?? 0) + (b.fb_done ?? 0) + (b.ig_done ?? 0)
        return tb - ta
      })
      .map(a => {
        constApplicable.push(a.total_applicable_posts ?? 0)
        return [
          String(a.booth_number ?? '—'),
          a.agent_name,
          a.phone ?? '—',
          monNameMap[a.assigned_monitor_id] ?? '—',
          String(a.wa_done ?? 0),
          String(a.fb_done ?? 0),
          String(a.ig_done ?? 0),
          String((a.wa_done ?? 0) + (a.fb_done ?? 0) + (a.ig_done ?? 0)),
        ]
      })

    autoTable(doc, {
      startY: currentY,
      head: [['Booth', 'Agent Name', 'Phone', 'Monitor', 'WA Posts', 'FB Posts', 'IG Posts', 'Total']],
      body: agentRows,
      styles: { font: F, fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
      headStyles: { font: F, fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 44 },
        2: { cellWidth: 28 },
        3: { cellWidth: 34 },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 16, halign: 'center' },
        7: { cellWidth: 16, halign: 'center' },
      },
      didParseCell(data) {
        if (data.section === 'body' && [4, 5, 6].includes(data.column.index)) {
          const val   = parseInt(data.cell.raw) || 0
          const total = constApplicable[data.row.index] || 0
          if (total === 0) { data.cell.styles.textColor = [156, 163, 175]; return }
          if (val === total)        { data.cell.styles.textColor = [22, 163, 74];  data.cell.styles.fontStyle = 'bold' }
          else if (val > total / 2) { data.cell.styles.textColor = [161, 98, 7];  data.cell.styles.fontStyle = 'bold' }
          else if (val > 0)         { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold' }
          else                      { data.cell.styles.textColor = [156, 163, 175] }
        }
      },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      margin: { left: 14, right: 14 },
    })
  }

  // ── Page footers ─────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      `Page ${i} of ${pageCount}  ·  ${constRow.constituency_name}  ·  ${new Date().toLocaleString('en-IN')}`,
      pageW / 2, pageH - 5, { align: 'center' }
    )
  }

  const safeName = constRow.constituency_name.replace(/[^a-z0-9]/gi, '_')
  doc.save(`${safeName}_performance_${new Date().toISOString().slice(0, 10)}.pdf`)
}

/**
 * Full management report PDF — cover, executive summary, per-constituency detail.
 * Uses pre-aggregated season stats views for correct counts across all agents.
 *
 * @param {object} opts
 * @param {Array} opts.constStats    rows from constituency_season_stats
 * @param {Array} opts.monitorStats  rows from monitor_season_stats
 * @param {Array} opts.agentStats    rows from agent_season_stats (paginated, all rows)
 * @param {Array} opts.admins        [{ id, full_name, phone, constituency_id }]
 */
export function exportManagementReportPDF({ constStats, monitorStats, agentStats, admins, fonts }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const F = setupFont(doc, fonts) ? 'Tamil' : 'helvetica'
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Quick lookups
  const adminMap = {}
  for (const a of admins) adminMap[a.constituency_id] = a

  const monNameMap = {}
  for (const m of monitorStats) monNameMap[m.monitor_id] = m.monitor_name

  function pctColor(val) {
    if (val >= 80) return [22, 163, 74]
    if (val >= 50) return [161, 98, 7]
    if (val > 0)   return [220, 38, 38]
    return [156, 163, 175]
  }

  const rankedConsts = [...constStats].sort((a, b) => (b.overall_pct ?? 0) - (a.overall_pct ?? 0))
  const maxPosts = Math.max(0, ...constStats.map(c => c.total_posts ?? 0))

  // ══════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════════
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageW, pageH, 'F')
  doc.setFillColor(220, 38, 38)
  doc.rect(0, 0, pageW, 4, 'F')
  doc.rect(0, pageH - 4, pageW, 4, 'F')

  // Title block
  doc.setFillColor(30, 41, 59)
  doc.roundedRect(14, 18, pageW - 28, 58, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(F, 'bold')
  doc.setFontSize(26)
  doc.text('CAMPAIGN', pageW / 2, 38, { align: 'center' })
  doc.setFontSize(13)
  doc.setTextColor(148, 163, 184)
  doc.setFont(F, 'normal')
  doc.text('DIGITAL TEAM PERFORMANCE REPORT', pageW / 2, 50, { align: 'center' })
  doc.setFontSize(9)
  doc.text('Management Summary  ·  Recruitment Season Review', pageW / 2, 60, { align: 'center' })
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageW / 2, 70, { align: 'center' })

  // Stats cards
  const statItems = [
    { label: 'Constituencies', value: constStats.length,    fill: [99, 102, 241] },
    { label: 'Monitors',       value: monitorStats.length,  fill: [59, 130, 246] },
    { label: 'Digital Agents', value: agentStats.length,    fill: [16, 185, 129] },
    { label: 'Content Posts',  value: maxPosts,             fill: [245, 158, 11] },
  ]
  const cardW = (pageW - 28 - 9) / 4
  statItems.forEach(({ label, value, fill }, i) => {
    const x = 14 + (cardW + 3) * i
    doc.setFillColor(...fill)
    doc.roundedRect(x, 90, cardW, 30, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(F, 'bold')
    doc.setFontSize(20)
    doc.text(String(value), x + cardW / 2, 106, { align: 'center' })
    doc.setFont(F, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(220, 220, 220)
    doc.text(label, x + cardW / 2, 115, { align: 'center' })
  })

  // Description
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  const descLines = [
    'This report provides a comprehensive analysis of digital team performance',
    'across all constituencies for the recruitment season.',
    '',
    'Sections: Executive Summary · Constituency Detail · Monitor Performance · Agent Rankings',
  ]
  descLines.forEach((line, i) => doc.text(line, pageW / 2, 142 + i * 7, { align: 'center' }))

  // Top 5 constituencies mini-ranking
  doc.setFillColor(30, 41, 59)
  doc.roundedRect(14, 175, pageW - 28, 8, 1, 1, 'F')
  doc.setTextColor(148, 163, 184)
  doc.setFont(F, 'bold')
  doc.setFontSize(7)
  doc.text('TOP PERFORMING CONSTITUENCIES', pageW / 2, 180.5, { align: 'center' })
  const top5 = rankedConsts.slice(0, 5)
  top5.forEach((c, i) => {
    const pct = c.overall_pct ?? 0
    const x   = 14 + (pageW - 28) / 5 * i
    const bw  = (pageW - 28) / 5
    doc.setFillColor(pct >= 80 ? 22 : pct >= 50 ? 161 : 100, pct >= 80 ? 163 : pct >= 50 ? 98 : 100, pct >= 80 ? 74 : pct >= 50 ? 7 : 100)
    doc.roundedRect(x, 185, bw - 2, 20, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(F, 'bold')
    doc.setFontSize(11)
    doc.text(`${pct}%`, x + (bw - 2) / 2, 195, { align: 'center' })
    doc.setFont(F, 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(220, 220, 220)
    const name = c.constituency_name.length > 14 ? c.constituency_name.slice(0, 13) + '…' : c.constituency_name
    doc.text(name, x + (bw - 2) / 2, 202, { align: 'center' })
  })

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 2: EXECUTIVE SUMMARY — constituency ranking
  // ══════════════════════════════════════════════════════════════════════
  doc.addPage()
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageW, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(F, 'bold')
  doc.setFontSize(11)
  doc.text('EXECUTIVE SUMMARY', 14, 8)
  doc.setFont(F, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Constituency Performance Ranking — Full Season', 14, 15)

  const summaryRows = rankedConsts.map((c, idx) => {
    const admin = adminMap[c.constituency_id]
    return [
      String(idx + 1),
      c.constituency_name,
      admin?.full_name ?? '—',
      admin?.phone     ?? '—',
      String(c.agent_count   ?? 0),
      String(c.monitor_count ?? 0),
      String(c.total_posts   ?? 0),
      `${c.overall_pct ?? 0}%`,
    ]
  })

  autoTable(doc, {
    startY: 22,
    head: [['#', 'Constituency', 'Admin Name', 'Admin Phone', 'Agents', 'Monitors', 'Posts', 'Overall %']],
    body: summaryRows,
    styles: { font: F, fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { font: F, fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 9,  halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 38 },
      3: { cellWidth: 27 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 20, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 7) {
        const val = parseInt(data.cell.raw)
        data.cell.styles.textColor = pctColor(val)
        data.cell.styles.fontStyle = 'bold'
      }
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: 14, right: 14 },
  })

  // ══════════════════════════════════════════════════════════════════════
  // PER-CONSTITUENCY PAGES
  // ══════════════════════════════════════════════════════════════════════
  for (const c of rankedConsts) {
    const pct         = c.overall_pct ?? 0
    const admin       = adminMap[c.constituency_id]
    const constMons   = monitorStats
      .filter(m => m.constituency_id === c.constituency_id)
      .sort((a, b) => (b.overall_pct ?? 0) - (a.overall_pct ?? 0))
    const constAgents = agentStats
      .filter(a => a.constituency_id === c.constituency_id)

    doc.addPage()

    // Constituency header bar (colour-coded by performance)
    const hFill = pct >= 80 ? [22, 163, 74] : pct >= 50 ? [161, 98, 7] : pct > 0 ? [220, 38, 38] : [71, 85, 105]
    doc.setFillColor(...hFill)
    doc.rect(0, 0, pageW, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(F, 'bold')
    doc.setFontSize(14)
    doc.text(c.constituency_name.toUpperCase(), 14, 10)
    doc.setFont(F, 'normal')
    doc.setFontSize(8)
    const adminLine = admin
      ? `Admin: ${admin.full_name}${admin.phone ? '   ·   ' + admin.phone : ''}`
      : 'No admin assigned'
    doc.text(adminLine, 14, 17)

    // Overall % badge (top-right)
    doc.setFillColor(0, 0, 0)
    doc.roundedRect(pageW - 46, 4, 32, 16, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(F, 'bold')
    doc.setFontSize(14)
    doc.text(`${pct}%`, pageW - 30, 14.5, { align: 'center' })
    doc.setFont(F, 'normal')
    doc.setFontSize(6)
    doc.text('OVERALL', pageW - 30, 19.5, { align: 'center' })

    let currentY = 28

    // ── Monitors ──────────────────────────────────────────────────────
    if (constMons.length > 0) {
      doc.setFontSize(8.5)
      doc.setFont(F, 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text('MONITORS', 14, currentY + 5)
      currentY += 8

      const monRows = constMons.map(m => {
        const slots = m.total_slots || 1
        return [
          m.monitor_name,
          m.phone ?? '—',
          String(m.agent_count ?? 0),
          `${Math.round((m.wa_done ?? 0) / slots * 100)}%`,
          `${Math.round((m.fb_done ?? 0) / slots * 100)}%`,
          `${Math.round((m.ig_done ?? 0) / slots * 100)}%`,
          `${m.overall_pct ?? 0}%`,
        ]
      })

      autoTable(doc, {
        startY: currentY,
        head: [['Monitor Name', 'Phone', 'Agents', 'WA %', 'FB %', 'IG %', 'Overall %']],
        body: monRows,
        styles: { font: F, fontSize: 8, cellPadding: 2.2 },
        headStyles: { font: F, fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 30 },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 22, halign: 'center' },
        },
        didParseCell(data) {
          if (data.section === 'body' && data.column.index === 6) {
            const val = parseInt(data.cell.raw)
            data.cell.styles.textColor = pctColor(val)
            data.cell.styles.fontStyle = 'bold'
          }
        },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        margin: { left: 14, right: 14 },
      })
      currentY = doc.lastAutoTable.finalY + 8
    }

    // ── Digital Agents ────────────────────────────────────────────────
    if (constAgents.length > 0) {
      if (currentY > 220) { doc.addPage(); currentY = 15 }
      doc.setFontSize(8.5)
      doc.setFont(F, 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text('DIGITAL AGENTS', 14, currentY + 5)
      currentY += 8

      const mgmtApplicable = []
      const agentRows = [...constAgents]
        .sort((a, b) => {
          const ta = (a.wa_done ?? 0) + (a.fb_done ?? 0) + (a.ig_done ?? 0)
          const tb = (b.wa_done ?? 0) + (b.fb_done ?? 0) + (b.ig_done ?? 0)
          return tb - ta
        })
        .map(a => {
          mgmtApplicable.push(a.total_applicable_posts ?? 0)
          return [
            String(a.booth_number ?? '—'),
            a.agent_name,
            a.phone ?? '—',
            monNameMap[a.assigned_monitor_id] ?? '—',
            String(a.wa_done ?? 0),
            String(a.fb_done ?? 0),
            String(a.ig_done ?? 0),
            String((a.wa_done ?? 0) + (a.fb_done ?? 0) + (a.ig_done ?? 0)),
          ]
        })

      autoTable(doc, {
        startY: currentY,
        head: [['Booth', 'Agent Name', 'Phone', 'Monitor', 'WA Posts', 'FB Posts', 'IG Posts', 'Total']],
        body: agentRows,
        styles: { font: F, fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak' },
        headStyles: { font: F, fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 44 },
          2: { cellWidth: 28 },
          3: { cellWidth: 34 },
          4: { cellWidth: 16, halign: 'center' },
          5: { cellWidth: 16, halign: 'center' },
          6: { cellWidth: 16, halign: 'center' },
          7: { cellWidth: 16, halign: 'center' },
        },
        didParseCell(data) {
          if (data.section === 'body' && [4, 5, 6].includes(data.column.index)) {
            const val   = parseInt(data.cell.raw) || 0
            const total = mgmtApplicable[data.row.index] || 0
            if (total === 0) { data.cell.styles.textColor = [156, 163, 175]; return }
            if (val === total)        { data.cell.styles.textColor = [22, 163, 74];  data.cell.styles.fontStyle = 'bold' }
            else if (val > total / 2) { data.cell.styles.textColor = [161, 98, 7];  data.cell.styles.fontStyle = 'bold' }
            else if (val > 0)         { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold' }
            else                      { data.cell.styles.textColor = [156, 163, 175] }
          }
        },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        margin: { left: 14, right: 14 },
      })
    }
  }

  // ── Page footers (skip cover) ──────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      `Page ${i} of ${pageCount}  ·  Campaign Management Report  ·  ${new Date().toLocaleString('en-IN')}`,
      pageW / 2, pageH - 5, { align: 'center' }
    )
  }

  doc.save(`campaign_management_report_${new Date().toISOString().slice(0, 10)}.pdf`)
}
