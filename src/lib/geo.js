// Geography helpers for the hotspot map and nearest-help-point routing.
// Works on raw lat/lng from the provided CSVs.

export function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Build a projector that maps lat/lng into an SVG box, with a margin.
export function makeProjector(points, width, height, pad = 28) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const p of points) {
    const lat = Number(p.lat ?? p.latitude ?? p.centroid_lat)
    const lng = Number(p.lng ?? p.longitude ?? p.centroid_lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
  }
  const spanLat = maxLat - minLat || 1
  const spanLng = maxLng - minLng || 1
  return (lat, lng) => {
    const x = pad + ((lng - minLng) / spanLng) * (width - pad * 2)
    // invert y: higher latitude = up
    const y = pad + (1 - (lat - minLat) / spanLat) * (height - pad * 2)
    return [x, y]
  }
}

export function nearest(lat, lng, list, latKey = 'latitude', lngKey = 'longitude') {
  let best = null
  let bestD = Infinity
  for (const item of list) {
    const d = haversineKm(lat, lng, Number(item[latKey]), Number(item[lngKey]))
    if (d < bestD) { bestD = d; best = item }
  }
  return best ? { item: best, km: bestD } : null
}

// Count points within radiusKm of (lat,lng) — used for CCTV-coverage scoring.
export function countWithin(lat, lng, list, radiusKm, latKey = 'latitude', lngKey = 'longitude') {
  let c = 0
  for (const item of list) {
    if (haversineKm(lat, lng, Number(item[latKey]), Number(item[lngKey])) <= radiusKm) c++
  }
  return c
}
