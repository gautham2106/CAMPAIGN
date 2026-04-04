import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'

const COL_MAP = {
  name:         ['name', 'name/பெயர்', 'பெயர்', 'agent name'],
  gender:       ['gender', 'gender/பாலினம்', 'பாலினம்'],
  booth_number: ['booth number', 'booth number/பூத் எண்', 'பூத் எண்', 'booth no', 'booth'],
  phone:        ['whatsapp number', 'whatsapp', 'phone', 'mobile', 'contact'],
  fb_url:       ['facebook link', 'facebook link/ முகநூல் லிங்க்', 'முகநூல் லிங்க்', 'facebook', 'fb link', 'fb url'],
  ig_url:       ['instagram link', 'instagram link/இண்ஸ்டாகிராம் லிங்க்', 'இண்ஸ்டாகிராம் லிங்க்', 'instagram', 'ig link'],
  twitter_url:  ['twitter', 'twitter/x', 'twitter/x (if available only)', 'x (twitter)'],
  submitted_at: ['timestamp', 'submitted at', 'date'],
}

function normalizePhone(phone) {
  return phone ? phone.replace(/\D/g, '') : ''
}

function mapRow(row, headers) {
  const result = {}
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    for (const header of headers) {
      if (aliases.includes(header.toLowerCase().trim())) {
        result[field] = row[header]?.trim() || null
        break
      }
    }
  }
  return result
}

function parseTimestamp(raw) {
  if (!raw) return null
  try {
    // Google Forms exports like "10/15/2024 14:30:00" or "15/10/2024 2:30:00 PM"
    // Try native parse first
    let d = new Date(raw)
    if (!isNaN(d.getTime())) return d.toISOString()

    // Try DD/MM/YYYY HH:MM:SS (Indian format from Google Forms)
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?/i)
    if (match) {
      const [, dd, mm, yyyy, hh, min, ss = '0', ampm] = match
      let hours = parseInt(hh)
      if (ampm?.toUpperCase() === 'PM' && hours < 12) hours += 12
      if (ampm?.toUpperCase() === 'AM' && hours === 12) hours = 0
      d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), hours, parseInt(min), parseInt(ss))
      if (!isNaN(d.getTime())) return d.toISOString()
    }

    return null // unparseable — skip gracefully
  } catch {
    return null
  }
}

function toDbRow(r, constituencyId) {
  return {
    name: r.name,
    gender: r.gender,
    booth_number: r.booth_number ? parseInt(r.booth_number, 10) : null,
    phone: r.phone,
    fb_url: r.fb_url,
    ig_url: r.ig_url,
    twitter_url: r.twitter_url,
    submitted_at: parseTimestamp(r.submitted_at),
    constituency_id: constituencyId,
  }
}

export default function CSVImport({ constituencyId, onImported }) {
  const [classified, setClassified] = useState([])   // rows with _status: 'new'|'update'|'skip'
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const onDrop = useCallback(async (acceptedFiles) => {
    setResult(null)
    setError('')
    setClassified([])
    const file = acceptedFiles[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const headers = results.meta.fields ?? []
        const normalizedRows = results.data.map(row => mapRow(row, headers))

        setChecking(true)
        try {
          // Fetch existing agents in this constituency
          const { data: existing, error: fe } = await supabase
            .from('digital_agents')
            .select('id, name, phone')
            .eq('constituency_id', constituencyId)
          if (fe) throw fe

          // Build phone → existing agent map
          const phoneMap = {}
          for (const a of existing ?? []) {
            const p = normalizePhone(a.phone)
            if (p) phoneMap[p] = a
          }

          // Classify each row
          const rows = normalizedRows.map(r => {
            if (!r.name) return { ...r, _status: 'skip', _reason: 'No name' }
            const phone = normalizePhone(r.phone)
            const dup = phone ? phoneMap[phone] : null
            if (dup) return { ...r, _status: 'update', _existing: dup }
            return { ...r, _status: 'new' }
          })

          setClassified(rows)
        } catch (e) {
          setError(e.message)
        } finally {
          setChecking(false)
        }
      },
      error: (err) => setError(err.message),
    })
  }, [constituencyId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] },
    multiple: false,
  })

  const newRows    = classified.filter(r => r._status === 'new')
  const updateRows = classified.filter(r => r._status === 'update')
  const skipRows   = classified.filter(r => r._status === 'skip')

  async function handleImport() {
    if (!classified.length || !constituencyId) return
    setImporting(true)
    setError('')
    try {
      // INSERT new agents
      if (newRows.length) {
        const { error: ie } = await supabase
          .from('digital_agents')
          .insert(newRows.map(r => toDbRow(r, constituencyId)))
        if (ie) throw ie
      }

      // UPDATE existing agents (matched by phone)
      for (const r of updateRows) {
        const { error: ue } = await supabase
          .from('digital_agents')
          .update(toDbRow(r, constituencyId))
          .eq('id', r._existing.id)
        if (ue) throw ue
      }

      setResult({ inserted: newRows.length, updated: updateRows.length, skipped: skipRows.length })
      setClassified([])
      onImported?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">📂</div>
        {isDragActive ? (
          <p className="text-indigo-600 font-semibold">Drop the CSV here…</p>
        ) : (
          <>
            <p className="text-slate-700 font-semibold">Drag & drop Google Form CSV export</p>
            <p className="text-slate-400 text-sm mt-1">or click to browse</p>
            <p className="text-slate-400 text-xs mt-3">
              Auto-detects: Name · Gender · Booth # · WhatsApp · Facebook · Instagram
            </p>
          </>
        )}
      </div>

      {checking && (
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
          <span className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin shrink-0" />
          Checking for duplicates…
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-0.5">
          <p className="text-sm font-semibold text-emerald-800">Import complete</p>
          <div className="flex gap-4 text-xs text-emerald-700">
            {result.inserted > 0 && <span>🟢 {result.inserted} new agents added</span>}
            {result.updated  > 0 && <span>🔄 {result.updated} existing agents updated</span>}
            {result.skipped  > 0 && <span>⚪ {result.skipped} rows skipped (no name)</span>}
          </div>
        </div>
      )}

      {classified.length > 0 && (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {newRows.length > 0 && (
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                  🟢 {newRows.length} new
                </span>
              )}
              {updateRows.length > 0 && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
                  🔄 {updateRows.length} will update (same phone)
                </span>
              )}
              {skipRows.length > 0 && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                  ⚪ {skipRows.length} skipped (no name)
                </span>
              )}
            </div>
            <button onClick={() => setClassified([])} className="text-xs text-slate-400 hover:text-slate-600">
              Clear
            </button>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="text-xs w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Status</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Name</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Phone</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Booth #</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500">FB</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-slate-500">IG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classified.slice(0, 8).map((r, i) => (
                  <tr key={i} className={r._status === 'skip' ? 'opacity-40' : ''}>
                    <td className="px-3 py-2">
                      {r._status === 'new'    && <span className="text-emerald-600 font-semibold">New</span>}
                      {r._status === 'update' && (
                        <span className="text-amber-600 font-semibold" title={`Replaces: ${r._existing.name}`}>
                          Update ↻
                        </span>
                      )}
                      {r._status === 'skip' && <span className="text-slate-400">Skip</span>}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {r.name || <span className="text-rose-400 italic">missing</span>}
                      {r._status === 'update' && r._existing.name !== r.name && (
                        <span className="block text-slate-400 font-normal">was: {r._existing.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 font-mono">{r.phone || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.booth_number || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{r.fb_url ? '✓' : '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{r.ig_url ? '✓' : '—'}</td>
                  </tr>
                ))}
                {classified.length > 8 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-slate-400 text-center">
                      …and {classified.length - 8} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Import button */}
          {(newRows.length + updateRows.length) > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {importing ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing…</>
              ) : (
                <>
                  Import
                  {newRows.length > 0    && ` ${newRows.length} new`}
                  {updateRows.length > 0 && ` · update ${updateRows.length} existing`}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
