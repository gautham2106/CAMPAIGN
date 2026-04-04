import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { supabaseAdmin } from '../lib/supabase'

const COL_MAP = {
  full_name: ['full name', 'name', 'பெயர்', 'monitor name'],
  phone:     ['mobile number', 'mobile', 'phone', 'whatsapp', 'contact', 'mobile no'],
  email:     ['email', 'email address', 'mail'],
  password:  ['password', 'temp password', 'temporary password', 'pass'],
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

function validateRow(r) {
  if (!r.full_name) return 'Missing name'
  if (!r.email || !r.email.includes('@')) return 'Invalid email'
  if (!r.password || r.password.length < 8) return 'Password must be 8+ characters'
  return null
}

export default function BulkMonitorImport({ constituencyId, onImported, onClose }) {
  const [rows, setRows]           = useState([])   // parsed + validated rows
  const [importing, setImporting] = useState(false)
  const [progress, setProgress]   = useState(null) // { done, total, results[] }
  const [error, setError]         = useState('')

  const onDrop = useCallback((acceptedFiles) => {
    setError('')
    setRows([])
    setProgress(null)
    const file = acceptedFiles[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const parsed = results.data.map(row => {
          const r = mapRow(row, headers)
          return { ...r, _error: validateRow(r) }
        })
        setRows(parsed)
      },
      error: (err) => setError(err.message),
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] },
    multiple: false,
  })

  const validRows   = rows.filter(r => !r._error)
  const invalidRows = rows.filter(r => r._error)

  async function handleImport() {
    if (!validRows.length) return
    if (!supabaseAdmin) {
      setError('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env')
      return
    }
    setImporting(true)
    setProgress({ done: 0, total: validRows.length, results: [] })

    const results = []
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]
      try {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: r.email,
          password: r.password,
          email_confirm: true,
        })
        if (authErr) throw authErr

        const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
          id: authData.user.id,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone || null,
          role: 'monitor',
          constituency_id: constituencyId,
        })
        if (profileErr) throw profileErr

        results.push({ name: r.full_name, email: r.email, status: 'ok' })
      } catch (e) {
        results.push({ name: r.full_name, email: r.email, status: 'error', message: e.message })
      }
      setProgress({ done: i + 1, total: validRows.length, results: [...results] })
    }

    setImporting(false)
    onImported?.()
  }

  const isDone = progress && progress.done === progress.total

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-950 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Import Monitors via CSV</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Columns: Full Name · Mobile Number · Email · Password</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* CSV template hint */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-zinc-600 mb-1">CSV format (first row = headers):</p>
            <code className="text-xs text-zinc-500 font-mono">
              Full Name, Mobile Number, Email, Password
            </code>
          </div>

          {/* Drop zone */}
          {!rows.length && !progress && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-slate-50 hover:border-red-300'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-3xl mb-2">📋</div>
              {isDragActive ? (
                <p className="text-red-600 font-semibold text-sm">Drop CSV here…</p>
              ) : (
                <>
                  <p className="text-slate-700 font-semibold text-sm">Drag & drop CSV or click to browse</p>
                  <p className="text-slate-400 text-xs mt-1">One monitor per row</p>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {/* Preview — before import */}
          {rows.length > 0 && !progress && (
            <>
              {/* Summary */}
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">
                  ✓ {validRows.length} ready to import
                </span>
                {invalidRows.length > 0 && (
                  <span className="text-xs font-semibold bg-red-100 text-red-600 px-3 py-1 rounded-full">
                    ✕ {invalidRows.length} invalid (will skip)
                  </span>
                )}
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="text-xs w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Name</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Mobile</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Email</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 font-medium text-slate-800">{r.full_name || <span className="text-red-400 italic">—</span>}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono">{r.phone || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{r.email || <span className="text-red-400 italic">—</span>}</td>
                        <td className="px-3 py-2">
                          {r._error
                            ? <span className="text-red-500 font-semibold">{r._error}</span>
                            : <span className="text-emerald-600 font-semibold">Ready</span>}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 10 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-slate-400 text-center">
                          …and {rows.length - 10} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setRows([])}
                  className="flex-1 border border-slate-300 text-slate-600 text-sm font-medium py-2.5 rounded-xl hover:bg-slate-50">
                  ← Re-upload
                </button>
                {validRows.length > 0 && (
                  <button onClick={handleImport}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl">
                    Import {validRows.length} Monitor{validRows.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </>
          )}

          {/* Progress — during / after import */}
          {progress && (
            <div className="space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-700">
                    {importing ? `Creating monitors… ${progress.done}/${progress.total}` : 'Import complete'}
                  </span>
                  <span className="text-xs text-slate-500">{Math.round(progress.done / progress.total * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${progress.done / progress.total * 100}%` }}
                  />
                </div>
              </div>

              {/* Per-row results */}
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {progress.results.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                    r.status === 'ok' ? 'bg-emerald-50' : 'bg-red-50'
                  }`}>
                    <span className="text-base shrink-0">{r.status === 'ok' ? '✅' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.name}</p>
                      <p className={`truncate ${r.status === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {r.status === 'ok' ? r.email : r.message}
                      </p>
                    </div>
                  </div>
                ))}
                {importing && progress.done < progress.total && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 text-xs">
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin shrink-0" />
                    <span className="text-slate-500">Creating {validRows[progress.done]?.full_name}…</span>
                  </div>
                )}
              </div>

              {/* Done summary */}
              {isDone && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex gap-3 mb-3">
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1 rounded-full">
                      ✅ {progress.results.filter(r => r.status === 'ok').length} created
                    </span>
                    {progress.results.filter(r => r.status === 'error').length > 0 && (
                      <span className="text-xs bg-red-100 text-red-600 font-semibold px-3 py-1 rounded-full">
                        ❌ {progress.results.filter(r => r.status === 'error').length} failed
                      </span>
                    )}
                  </div>
                  <button onClick={onClose}
                    className="w-full bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-semibold py-2.5 rounded-xl">
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
