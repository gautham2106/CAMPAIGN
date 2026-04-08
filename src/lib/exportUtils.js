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
 * Download master Excel report for one or all constituencies.
 *
 * @param {Object} opts
 * @param {Array}  opts.constituencies   - full list [{id, name}]
 * @param {Object} opts.agentsMap        - { [constId]: agent[] }
 * @param {Object} opts.monitorsMap      - { [constId]: monitor[] }
 * @param {Object} opts.boothMap         - { [constId]: boothAssignment[] }
 * @param {Object} opts.placesMap        - { [constId]: place[] }
 * @param {'booth'|'place'} opts.sortBy  - sort order
 * @param {string|null} opts.singleConstId - if set, export only that constituency
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

    // Widen columns automatically (rough heuristic)
    ws['!cols'] = [20, 22, 8, 24, 8, 14, 40, 8, 40, 8, 30, 16].map(w => ({ wch: w }))

    XLSX.utils.book_append_sheet(wb, ws, c.name.slice(0, 31))
  }

  const today = new Date().toISOString().slice(0, 10)
  const fname = singleConstId
    ? `${list[0]?.name ?? 'constituency'}_master_${today}.xlsx`
    : `all_constituencies_master_${today}.xlsx`

  XLSX.writeFile(wb, fname)
}
