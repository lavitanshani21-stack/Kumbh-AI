import { maskMobile, displayName, ageEmoji, statusColor } from '../lib/format.js'

export function SourceTag({ meta }) {
  if (!meta) return null
  if (meta.source === 'claude') return <span className="tag ai">✦ Claude {shortModel(meta.model)}</span>
  if (meta.source === 'heuristic') return <span className="tag heur">⚙ Offline match</span>
  return null
}
function shortModel(m) {
  return m ? m.replace('claude-', '').replace(/-\d{8}$/, '') : ''
}

export function VerdictBadge({ verdict }) {
  const label = { SAME_PERSON: 'Same person', DUPLICATE: 'Duplicate', POSSIBLE: 'Possible', DIFFERENT: 'Different', DISTINCT: 'Distinct' }[verdict] || verdict
  return <span className={`verdict ${verdict}`}>{label}</span>
}

export function ConfidenceBar({ value }) {
  const color = value >= 80 ? 'var(--low)' : value >= 55 ? 'var(--med)' : 'var(--muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="conf-bar"><span style={{ width: `${value}%`, background: color }} /></div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{value}%</span>
    </div>
  )
}

export function StatusChip({ status }) {
  return (
    <span className="status-chip" style={{ color: statusColor(status) }}>
      ● {status}
    </span>
  )
}

// A compact registry record card. `match` highlights it as a cross-center hit.
export function PersonCard({ r, match = false, children, right }) {
  return (
    <div className={`person-card ${match ? 'match' : ''}`}>
      <div className="pc-head">
        <div className="avatar" style={{ width: 40, height: 40, fontSize: 20 }}>{ageEmoji(r.age_band)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-between">
            <span className="nm">{displayName(r.missing_person_name)}</span>
            {right}
          </div>
          <div className="sub">
            {r.gender} · {r.age_band} · {r.language} · {r.state}
          </div>
          <div className="sub" style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="mono">{r.case_id}</span>
            <span className="center-chip">{r.reporting_center}</span>
            <StatusChip status={r.status} />
          </div>
          <div className="sub" style={{ marginTop: 4 }}>
            📍 {r.last_seen_location} · ☎ {maskMobile(r.reporter_mobile)}
          </div>
          {r.physical_description && (
            <div className="sub" style={{ marginTop: 4, fontStyle: 'italic' }}>"{r.physical_description}"</div>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

export { maskMobile, displayName }
