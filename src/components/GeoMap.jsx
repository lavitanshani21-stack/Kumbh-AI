import { useMemo } from 'react'
import { makeProjector } from '../lib/geo.js'

const CHOKE_COLOR = {
  'Traffic choke point': '#f43f5e',
  'No-vehicle pressure zone': '#fb7185',
  'Transfer node': '#fb923c',
  Parking: '#60a5fa',
  'Outer parking': '#3b82f6',
  'Parking belt': '#818cf8',
}

// Self-contained SVG map (no tile server → works offline) plotting the real
// lat/lng geography: CCTV coverage, crowd chokepoints (separation hotspots),
// police help points, and an optional highlighted last-seen location.
export default function GeoMap({
  data,
  highlight = null, // { lat, lng }
  nearestStation = null,
  height = 440,
  showCCTV = true,
}) {
  const W = 1000
  const H = 640

  const project = useMemo(() => {
    const all = [
      ...data.cctv.map((c) => ({ lat: +c.latitude, lng: +c.longitude })),
      ...data.choke.map((c) => ({ lat: +c.latitude, lng: +c.longitude })),
      ...data.police.map((c) => ({ lat: +c.latitude, lng: +c.longitude })),
    ]
    return makeProjector(all, W, H, 36)
  }, [data])

  return (
    <div>
      <div className="map-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height }}>
          <rect x="0" y="0" width={W} height={H} fill="#070b16" />

          {/* CCTV coverage haze */}
          {showCCTV && data.cctv.map((c, i) => {
            const [x, y] = project(+c.latitude, +c.longitude)
            return <circle key={i} cx={x} cy={y} r="5" fill="#1f9d8f" opacity="0.16" />
          })}

          {/* Chokepoints = where crowds peak and separations cluster */}
          {data.choke.map((c, i) => {
            const [x, y] = project(+c.latitude, +c.longitude)
            return (
              <circle key={`ch-${i}`} cx={x} cy={y} r="5.5"
                fill={CHOKE_COLOR[c.category] || '#94a3b8'} opacity="0.9">
                <title>{c.location_name} ({c.category})</title>
              </circle>
            )
          })}

          {/* Police help points */}
          {data.police.map((p, i) => {
            const [x, y] = project(+p.latitude, +p.longitude)
            return (
              <g key={`po-${i}`}>
                <rect x={x - 6} y={y - 6} width="12" height="12" rx="3" fill="#0a0e1a" stroke="#60a5fa" strokeWidth="2" />
                <text x={x} y={y + 3.5} fontSize="9" textAnchor="middle">👮</text>
                <title>{p.station_name}</title>
              </g>
            )
          })}

          {/* Highlighted last-seen + nearest help routing */}
          {highlight && (() => {
            const [x, y] = project(highlight.lat, highlight.lng)
            const np = nearestStation ? project(+nearestStation.item.latitude, +nearestStation.item.longitude) : null
            return (
              <g>
                {np && <line x1={x} y1={y} x2={np[0]} y2={np[1]} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 4" />}
                <circle cx={x} cy={y} r="20" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                  <animate attributeName="r" values="14;24;14" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx={x} cy={y} r="7" fill="#f43f5e" stroke="#fff" strokeWidth="2" />
              </g>
            )
          })()}
        </svg>
      </div>

      <div className="map-legend">
        <span className="li"><span className="sw" style={{ background: '#1f9d8f' }} /> CCTV coverage</span>
        <span className="li"><span className="sw" style={{ background: '#f43f5e' }} /> Traffic chokepoint</span>
        <span className="li"><span className="sw" style={{ background: '#fb923c' }} /> Transfer node</span>
        <span className="li"><span className="sw" style={{ background: '#60a5fa' }} /> Parking</span>
        <span className="li"><span className="sw" style={{ background: 'transparent', border: '2px solid #60a5fa', borderRadius: 3 }} /> Police help point</span>
        {highlight && <span className="li"><span className="sw" style={{ background: '#f43f5e', borderRadius: '50%' }} /> Last seen</span>}
      </div>
    </div>
  )
}
