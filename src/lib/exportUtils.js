import * as XLSX from 'xlsx'

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
