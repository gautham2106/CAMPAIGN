import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ENV_MISSING } from './lib/supabase.js'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow p-8 max-w-lg w-full">
            <div className="text-4xl mb-3">💥</div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h1>
            <pre className="text-xs text-red-600 bg-red-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm text-indigo-600 underline"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function EnvSetupScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
        <div className="text-5xl mb-4">⚙️</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Supabase not configured</h1>
        <p className="text-gray-600 text-sm mb-5">
          Create a <code className="bg-gray-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">.env</code> file
          in the project root with your Supabase credentials:
        </p>
        <pre className="bg-gray-900 text-green-400 text-xs rounded-xl p-4 overflow-auto mb-5 font-mono leading-relaxed">{`VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1Ni...`}</pre>
        <p className="text-gray-500 text-xs">
          Get these from: <strong>Supabase Dashboard → Project Settings → API</strong>.
          After saving the file, restart the dev server (<code className="bg-gray-100 px-1 rounded font-mono">npm run dev</code>).
        </p>
        <div className="mt-5 border-t pt-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Also run in Supabase SQL Editor:</p>
          <code className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded">supabase-setup-v2.sql</code>
          <span className="text-xs text-gray-400 ml-2">(included in this repo)</span>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {ENV_MISSING ? <EnvSetupScreen /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
