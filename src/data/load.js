import { parseCSV } from '../lib/csv.js'

// Loads the dataset package from /public/data. Drop the REAL provided CSVs in
// with these same filenames and this loader picks them up unchanged.
const FILES = {
  missing: 'Synthetic_Missing_Persons_2500.csv',
  cctv: 'CCTV_Locations.csv',
  zones: 'Zone_Boundaries.csv',
  police: 'Police_Stations.csv',
  choke: 'Chokepoints_Parking.csv',
}

let cache = null

async function fetchCsv(name) {
  const res = await fetch(`/data/${name}`)
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`)
  return parseCSV(await res.text())
}

export async function loadDataset() {
  if (cache) return cache
  const [missing, cctv, zones, police, choke] = await Promise.all([
    fetchCsv(FILES.missing),
    fetchCsv(FILES.cctv),
    fetchCsv(FILES.zones),
    fetchCsv(FILES.police),
    fetchCsv(FILES.choke),
  ])
  cache = { missing, cctv, zones, police, choke }
  return cache
}
