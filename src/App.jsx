import { useEffect, useState } from 'react'
import { loadDataset } from './data/load.js'
import { getHealth } from './api.js'
import Dashboard from './components/Dashboard.jsx'
import SearchMatch from './components/SearchMatch.jsx'
import Intake from './components/Intake.jsx'
import Duplicates from './components/Duplicates.jsx'
import Hotspot from './components/Hotspot.jsx'

const NAV = [
  { id: 'dashboard', label: 'Registry Overview', icon: '📊' },
  { id: 'search', label: 'Search & Match', icon: '🔎' },
  { id: 'intake', label: 'Operator Intake', icon: '🎤' },
  { id: 'duplicates', label: 'Duplicates', icon: '⇉' },
  { id: 'hotspot', label: 'Hotspot Map', icon: '🗺' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [data, setData] = useState(null)
  const [registry, setRegistry] = useState([])
  const [health, setHealth] = useState(null)
  const [online, setOnline] = useState(true) // offline-first toggle
  const [flashMsg, setFlashMsg] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    loadDataset()
      .then((d) => { setData(d); setRegistry(d.missing) })
      .catch((e) => setErr(e.message))
    getHealth().then(setHealth)
  }, [])

  function flash(msg) {
    setFlashMsg(msg)
    clearTimeout(flash._t)
    flash._t = setTimeout(() => setFlashMsg(null), 2800)
  }
  function updateRecord(caseId, patch) {
    setRegistry((prev) => prev.map((r) => (r.case_id === caseId ? { ...r, ...patch } : r)))
  }
  function resolveRecord(caseId) {
    updateRecord(caseId, { status: 'Reunited' })
  }
  function addRecord(rec) {
    setRegistry((prev) => [rec, ...prev])
  }

  // network state drives whether components call Claude. When "offline", the
  // health pill also reflects degraded mode.
  const claudeUp = online && health?.claude

  if (err) {
    return (
      <div className="app">
        <main className="main">
          <div className="panel panel-pad" style={{ maxWidth: 540, margin: '80px auto' }}>
            <h2>Couldn't load the dataset</h2>
            <p className="muted">{err}</p>
            <p className="hint">Run <span className="mono">node data/generate.js</span> (or drop the provided CSVs into <span className="mono">public/data/</span>), then reload.</p>
          </div>
        </main>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app">
        <main className="main" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ width: 26, height: 26, borderColor: 'rgba(34,211,238,0.3)', borderTopColor: 'var(--accent)' }} />
            <p className="muted" style={{ marginTop: 14 }}>Loading the unified registry…</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🪔</div>
          <div>
            <h1>Kumbh<span>Setu</span></h1>
            <p>UNIFIED RESCUE REGISTRY</p>
          </div>
        </div>

        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
            <span className="ico">{n.icon}</span>
            {n.label}
          </button>
        ))}

        <div className="sidebar-foot">
          <button
            className={`net-toggle ${online ? 'online' : ''}`}
            onClick={() => { setOnline((v) => !v); flash(online ? 'Switched to OFFLINE mode' : 'Back ONLINE') }}
            title="Simulate network loss at peak crowd density"
          >
            <span className="sw2" />
            {online ? 'Network: online' : 'Network: offline'}
          </button>
          <div className="status-pill" style={{ marginTop: 8 }}>
            <span className={`dot ${claudeUp ? '' : 'amber'}`} />
            {claudeUp ? `Claude matching · ${shortModel(health.model)}` : online ? 'Heuristic matching' : 'Offline — local match'}
          </div>
          One registry. Every center. No one lost in the gap.
        </div>
      </aside>

      <main className="main">
        {tab === 'dashboard' && <Dashboard registry={registry} data={data} />}

        {tab === 'search' && (
          <div>
            <div className="page-head">
              <h2>Cross-Center Search &amp; Match</h2>
              <p>A found person at one center is invisible to a family at another. This closes that gap — searching every center at once, with AI identity matching across messy, incomplete records.</p>
            </div>
            <SearchMatch registry={registry} online={online} flash={flash} onResolve={resolveRecord} />
          </div>
        )}

        {tab === 'intake' && (
          <div>
            <div className="page-head">
              <h2>Operator Intake</h2>
              <p>Designed for phoneless, non-literate, multilingual families — the volunteer captures the report, AI structures it, and it becomes instantly searchable everywhere.</p>
            </div>
            <Intake registry={registry} onCreate={addRecord} goToSearch={() => setTab('search')} flash={flash} />
          </div>
        )}

        {tab === 'duplicates' && (
          <Duplicates registry={registry} online={online} flash={flash} onMerge={resolveRecord} />
        )}

        {tab === 'hotspot' && <Hotspot data={data} />}
      </main>

      {flashMsg && <div className="flash">{flashMsg}</div>}
    </div>
  )
}

function shortModel(m) {
  return m ? m.replace('claude-', '').replace(/-\d{8}$/, '') : ''
}
