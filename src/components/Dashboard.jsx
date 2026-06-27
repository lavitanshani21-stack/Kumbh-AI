import { useMemo } from 'react'
import { statusColor } from '../lib/format.js'

const AGE_BANDS = ['0-12', '13-17', '18-40', '41-60', '61-70', '71-80', '80+']

export default function Dashboard({ registry, data }) {
  const m = useMemo(() => computeMetrics(registry), [registry])

  return (
    <div>
      <div className="page-head">
        <h2>Registry Overview</h2>
        <p>{registry.length.toLocaleString()} reports across {m.centers} lost-and-found centers — one searchable picture.</p>
      </div>

      <div className="grid stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Reunited" value={`${m.reunitedPct}%`} sub={`${m.byStatus.Reunited || 0} people`} cls="" color="var(--low)" />
        <Stat label="Still pending" value={m.byStatus.Pending || 0} sub="open searches" color="var(--high)" />
        <Stat label="Unresolved" value={m.byStatus.Unresolved || 0} sub="need escalation" color="var(--crit)" />
        <Stat label="Cross-center duplicates" value={m.duplicates} sub="the core problem" cls="accent" />
      </div>

      <div className="grid cols-2">
        <div>
          <div className="panel panel-pad">
            <p className="panel-title">Reports per day · spikes on Amrit Snan</p>
            <div className="spark">
              {m.timeline.map((d) => (
                <div
                  key={d.date}
                  className={`b ${d.spike ? 'snan' : ''}`}
                  style={{ height: `${Math.max(3, (d.count / m.timelineMax) * 100)}%` }}
                  title={`${d.date}: ${d.count} reports${d.spike ? ' (Amrit Snan spike)' : ''}`}
                />
              ))}
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              <span style={{ color: '#fb923c' }}>■</span> Amrit Snan days carry a 4–5× surge — exactly when
              networks fail and separations peak, so the registry must work offline.
            </p>
          </div>

          <div className="panel panel-pad section-gap">
            <p className="panel-title">Who goes missing · by age band</p>
            {AGE_BANDS.map((b) => (
              <div className="bar-row" key={b}>
                <span className="muted">{b}</span>
                <div className="track"><div className="fill" style={{ width: `${(m.ages[b] || 0) / m.ageMax * 100}%` }} /></div>
                <span style={{ textAlign: 'right' }}>{m.ages[b] || 0}</span>
              </div>
            ))}
            <p className="hint" style={{ marginTop: 6 }}>The 61–70 band is the largest — elderly pilgrims separated from family.</p>
          </div>
        </div>

        <div>
          <div className="panel panel-pad">
            <p className="panel-title">Status breakdown</p>
            {Object.entries(m.byStatus).map(([s, c]) => (
              <div className="bar-row" key={s}>
                <span style={{ color: statusColor(s), fontSize: 11 }}>{s.split(' ')[0]}</span>
                <div className="track"><div className="fill" style={{ width: `${c / registry.length * 100}%`, background: statusColor(s) }} /></div>
                <span style={{ textAlign: 'right' }}>{c}</span>
              </div>
            ))}
            <div className="divider" />
            <div className="row-between"><span className="muted" style={{ fontSize: 13 }}>Median time to reunite</span><strong>{m.medianHours}h</strong></div>
            <div className="row-between" style={{ marginTop: 6 }}><span className="muted" style={{ fontSize: 13 }}>No name on file</span><strong>{m.noNamePct}%</strong></div>
            <div className="row-between" style={{ marginTop: 6 }}><span className="muted" style={{ fontSize: 13 }}>No contact number</span><strong>{m.noMobilePct}%</strong></div>
          </div>

          <div className="panel panel-pad section-gap">
            <p className="panel-title">Infrastructure coverage</p>
            <div className="coverage-grid">
              <Cov v={data.cctv.length.toLocaleString()} l="CCTV cameras" />
              <Cov v={data.zones.length} l="zones mapped" />
              <Cov v={data.police.length} l="police help points" />
              <Cov v={data.choke.length} l="crowd chokepoints" />
            </div>
          </div>

          <div className="panel panel-pad section-gap">
            <p className="panel-title">Privacy by design</p>
            <div className="privacy-line"><span className="ok">✓</span> Contact numbers masked in every view</div>
            <div className="privacy-line"><span className="ok">✓</span> Only identity-relevant fields sent to AI</div>
            <div className="privacy-line"><span className="ok">✓</span> Synthetic data — no real personal records</div>
            <div className="privacy-line"><span className="ok">✓</span> Resolved cases minimized after reunion</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, cls, color }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${cls || ''}`} style={color ? { color } : undefined}>{value}</div>
      <div className="sub">{sub}</div>
    </div>
  )
}
function Cov({ v, l }) {
  return <div className="cov"><div className="v">{v}</div><div className="l">{l}</div></div>
}

function computeMetrics(registry) {
  const byStatus = {}
  const ages = {}
  const byDate = {}
  let noName = 0, noMobile = 0, duplicates = 0
  const centers = new Set()
  const resolveHours = []

  for (const r of registry) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
    ages[r.age_band] = (ages[r.age_band] || 0) + 1
    centers.add(r.reporting_center)
    if (!r.missing_person_name) noName++
    if (!r.reporter_mobile) noMobile++
    if (r.is_duplicate_report === 'True') duplicates++
    if (r.resolution_hours) resolveHours.push(parseFloat(r.resolution_hours))
    const date = (r.reported_at || '').slice(0, 10)
    if (date) byDate[date] = (byDate[date] || 0) + 1
  }

  const timelineArr = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
  const counts = timelineArr.map(([, c]) => c).sort((a, b) => a - b)
  const spikeThreshold = counts[Math.floor(counts.length * 0.9)] || Infinity
  const timeline = timelineArr.map(([date, count]) => ({ date, count, spike: count >= spikeThreshold }))

  resolveHours.sort((a, b) => a - b)
  const medianHours = resolveHours.length
    ? Math.round(resolveHours[Math.floor(resolveHours.length / 2)] * 10) / 10
    : 0

  return {
    byStatus,
    ages,
    ageMax: Math.max(1, ...Object.values(ages)),
    timeline,
    timelineMax: Math.max(1, ...timeline.map((t) => t.count)),
    duplicates,
    centers: centers.size,
    reunitedPct: Math.round(((byStatus.Reunited || 0) / registry.length) * 100),
    noNamePct: Math.round((noName / registry.length) * 100),
    noMobilePct: Math.round((noMobile / registry.length) * 100),
    medianHours,
  }
}
