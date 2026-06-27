import { useMemo, useState } from 'react'
import GeoMap from './GeoMap.jsx'
import { nearest, countWithin } from '../lib/geo.js'

export default function Hotspot({ data }) {
  const [showCCTV, setShowCCTV] = useState(true)
  const [pointId, setPointId] = useState('')

  const categoryCounts = useMemo(() => {
    const c = {}
    for (const p of data.choke) c[p.category] = (c[p.category] || 0) + 1
    return c
  }, [data])

  const point = data.choke.find((p) => p.location_name === pointId)
  const highlight = point ? { lat: +point.latitude, lng: +point.longitude } : null
  const nearestStation = highlight ? nearest(highlight.lat, highlight.lng, data.police) : null
  const cctvNear = highlight ? countWithin(highlight.lat, highlight.lng, data.cctv, 0.4) : null

  return (
    <div>
      <div className="page-head">
        <h2>Separation Hotspots &amp; Help Coverage</h2>
        <p>Crowd chokepoints predict where separations cluster. CCTV and police tell you where coverage already exists.</p>
      </div>

      <div className="grid cols-2">
        <div className="panel panel-pad">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <p className="panel-title" style={{ margin: 0 }}>Live geography</p>
            <label className="net-toggle" style={{ width: 'auto', cursor: 'pointer' }} onClick={() => setShowCCTV((v) => !v)}>
              <span className={`sw2 ${showCCTV ? '' : ''}`} style={{ background: showCCTV ? 'var(--low)' : 'var(--border-2)' }} />
              CCTV layer
            </label>
          </div>
          <GeoMap data={data} highlight={highlight} nearestStation={nearestStation} showCCTV={showCCTV} height={420} />
        </div>

        <div>
          <div className="panel panel-pad">
            <p className="panel-title">Route a found person to help</p>
            <label className="field">
              <span>Incident / separation point</span>
              <select value={pointId} onChange={(e) => setPointId(e.target.value)}>
                <option value="">Select a chokepoint…</option>
                {data.choke.map((p) => <option key={p.location_name} value={p.location_name}>{p.location_name} ({p.category})</option>)}
              </select>
            </label>
            {point ? (
              <>
                <div className="callout ai" style={{ marginBottom: 12 }}>
                  <div className="ct">✦ Nearest help point</div>
                  <strong>{nearestStation.item.station_name}</strong> — {nearestStation.km.toFixed(2)} km away.
                  Escort or radio the found person here.
                </div>
                <div className="coverage-grid">
                  <div className="cov"><div className="v">{cctvNear}</div><div className="l">CCTV cameras within 400m</div></div>
                  <div className="cov"><div className="v">{point.category.split(' ')[0]}</div><div className="l">{point.category}</div></div>
                </div>
              </>
            ) : (
              <p className="hint">Pick a chokepoint to find the nearest police help point and local CCTV coverage.</p>
            )}
          </div>

          <div className="panel panel-pad section-gap">
            <p className="panel-title">Chokepoint mix · where crowds peak</p>
            {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
              <div className="bar-row" key={cat}>
                <span className="muted" style={{ fontSize: 11 }}>{cat.split(' ')[0]}</span>
                <div className="track"><div className="fill" style={{ width: `${n / data.choke.length * 100}%` }} /></div>
                <span style={{ textAlign: 'right' }}>{n}</span>
              </div>
            ))}
            <p className="hint" style={{ marginTop: 8 }}>Traffic chokepoints and transfer nodes are the highest-separation zones — stage help desks there.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
