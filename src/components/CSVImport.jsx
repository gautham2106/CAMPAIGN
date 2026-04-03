import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'

// Column aliases from the Google Form export
const COL_MAP = {
  name: ['name', 'name/பெயர்', 'பெயர்', 'agent name'],
  gender: ['gender', 'gender/பாலினம்', 'பாலினம்'],
  booth_number: ['booth number', 'booth number/பூத் எண்', 'பூத் எண்', 'booth no', 'booth'],
  phone: ['whatsapp number', 'whatsapp', 'phone', 'mobile', 'contact'],
  fb_url: ['facebook link', 'facebook link/ முகநூல் லிங்க்', 'முகநூல் லிங்க்', 'facebook', 'fb link', 'fb url'],
  ig_url: ['instagram link', 'instagram link/இண்ஸ்டாகிராம் லிங்க்', 'இண்ஸ்டாகிராம் லிங்க்', 'instagram', 'ig link'],
  twitter_url: ['twitter', 'twitter/x', 'twitter/x (if available only)', 'x (twitter)'],
  submitted_at: ['timestamp', 'submitted at', 'date'],
}

function normalizeKey(key) {
  return key.toLowerCase().trim()
}

function mapRow(row, headers) {
  const result = {}
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    for (const header of headers) {
      if (aliases.includes(normalizeKey(header))) {
        result[field] = row[header]?.trim() || null
        break
      }
    }
  }
  return result
}

export default function CSVImport({ constituencyId, onImported }) {
  const [preview, setPreview] = useState(null) // { headers, rows }
  const [mapped, setMapped] = useState([]) // normalized rows
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null) // { inserted, skipped }
  const [error, setError] = useState('')

  const onDrop = useCallback((acceptedFiles) => {
    setResult(null)
    setError('')
    const file = acceptedFiles[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const rows = results.data
        const normalizedRows = rows.map(row => mapRow(row, headers))
        setPreview({ headers, rows: rows.slice(0, 5) })
        setMapped(normalizedRows)
      },
      error: (err) => setError(err.message),
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] },
    multiple: false,
  })

  async function handleImport() {
    if (!mapped.length || !constituencyId) return
    setImporting(true)
    setError('')
    try {
      const toInsert = mapped
        .filter(r => r.name)
        .map(r => ({
          name: r.name,
          gender: r.gender,
          booth_number: r.booth_number ? parseInt(r.booth_number, 10) : null,
          phone: r.phone,
          fb_url: r.fb_url,
          ig_url: r.ig_url,
          twitter_url: r.twitter_url,
          submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
          constituency_id: constituencyId,
        }))

      const { data, error: insertErr } = await supabase
        .from('digital_agents')
        .upsert(toInsert, { onConflict: 'name,constituency_id', ignoreDuplicates: false })
        .select()

      if (insertErr) throw insertErr
      setResult({ inserted: data?.length ?? toInsert.length, skipped: mapped.length - toInsert.length })
      setPreview(null)
      setMapped([])
      onImported?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">📂</div>
        {isDragActive ? (
          <p className="text-indigo-600 font-medium">Drop the CSV here…</p>
        ) : (
          <>
            <p className="text-gray-700 font-medium">Drag & drop Google Form CSV here</p>
            <p className="text-gray-400 text-sm mt-1">or click to browse</p>
            <p className="text-gray-400 text-xs mt-3">Columns auto-detected: Name, Gender, Booth Number, WhatsApp, Facebook, Instagram</p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          Successfully imported {result.inserted} agents.
          {result.skipped > 0 && ` (${result.skipped} rows skipped — missing name)`}
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Preview — {mapped.length} rows detected
            </p>
            <button
              onClick={() => { setPreview(null); setMapped([]) }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="text-xs w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Gender', 'Booth #', 'Phone', 'Facebook', 'Instagram'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapped.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-800">{r.name || <span className="text-red-400">—</span>}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.gender || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.booth_number || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.phone || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600 truncate max-w-[120px]">{r.fb_url ? '✓' : '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.ig_url ? '✓' : '—'}</td>
                  </tr>
                ))}
                {mapped.length > 5 && (
                  <tr className="border-t border-gray-100">
                    <td colSpan={6} className="px-3 py-1.5 text-gray-400 text-center">
                      …and {mapped.length - 5} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {importing ? 'Importing…' : `Import ${mapped.filter(r => r.name).length} Agents`}
          </button>
        </div>
      )}
    </div>
  )
}
