/**
 * Generates schema-matching synthetic data for the Claude Impact Lab
 * "Missing Persons at Kumbh Mela 2027" package. Deterministic (seeded) so it
 * is reproducible. Writes 5 CSVs into ../public/data so Vite serves them.
 *
 * Drop the REAL provided CSVs into public/data/ with the same filenames and the
 * app uses them instead — every column name here matches the spec.
 *
 *   node data/generate.js
 */
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'data')
mkdirSync(OUT, { recursive: true })

// ---- seeded RNG (mulberry32) -------------------------------------------------
let seed = 0x9e3779b9
function rng() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (a) => a[Math.floor(rng() * a.length)]
const chance = (p) => rng() < p
const int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1))
function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v
  }
  return pairs[0][0]
}

// ---- CSV writer --------------------------------------------------------------
function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function writeCsv(name, cols, rows) {
  const lines = [cols.join(',')]
  for (const row of rows) lines.push(cols.map((c) => csvCell(row[c])).join(','))
  writeFileSync(join(OUT, name), lines.join('\n') + '\n')
  console.log(`  ${name.padEnd(34)} ${rows.length} rows`)
}

// ---- reference vocab ---------------------------------------------------------
const FIRST_M = ['Ramesh', 'Suresh', 'Mahesh', 'Ganpat', 'Vitthal', 'Sopan', 'Dattatray', 'Namdev', 'Kishan', 'Mohan', 'Arun', 'Bhaskar', 'Anil', 'Sunil', 'Prakash', 'Rohan', 'Aarav', 'Sai', 'Tukaram', 'Eknath']
const FIRST_F = ['Sarla', 'Lakshmi', 'Sunita', 'Asha', 'Mangala', 'Kamla', 'Shanta', 'Indira', 'Radha', 'Savita', 'Meena', 'Vimal', 'Parvati', 'Sushila', 'Anjali', 'Sneha', 'Kavita', 'Rukmini', 'Janabai', 'Gita']
const LAST = ['Patil', 'Jadhav', 'More', 'Pawar', 'Shinde', 'Kulkarni', 'Deshmukh', 'Sawant', 'Gaikwad', 'Bhosale', 'Kale', 'Chavan', 'Yadav', 'Sharma', 'Verma', 'Kumar', 'Joshi', 'Iyer', 'Reddy', 'Das']

const AGE_BANDS = [
  ['0-12', 6], ['13-17', 4], ['18-40', 14], ['41-60', 18],
  ['61-70', 30], ['71-80', 18], ['80+', 10], // 61-70 largest, as specified
]
const GENDER = [['Female', 52], ['Male', 45], ['Unknown', 3]]

const STATES = [
  ['Maharashtra', 55, ['Nashik', 'Pune', 'Ahmednagar', 'Aurangabad', 'Thane', 'Nagpur', 'Solapur', 'Jalgaon']],
  ['Madhya Pradesh', 11, ['Indore', 'Ujjain', 'Bhopal', 'Gwalior']],
  ['Uttar Pradesh', 10, ['Prayagraj', 'Varanasi', 'Lucknow', 'Kanpur']],
  ['Gujarat', 8, ['Ahmedabad', 'Surat', 'Rajkot']],
  ['Rajasthan', 5, ['Jaipur', 'Jodhpur', 'Udaipur']],
  ['Karnataka', 5, ['Bengaluru', 'Belagavi', 'Hubballi']],
  ['Telangana', 3, ['Hyderabad', 'Warangal']],
  ['Tamil Nadu', 3, ['Chennai', 'Madurai']],
]
const LANG_BY_STATE = {
  Maharashtra: 'Marathi', 'Madhya Pradesh': 'Hindi', 'Uttar Pradesh': 'Hindi',
  Gujarat: 'Gujarati', Rajasthan: 'Hindi', Karnataka: 'Kannada',
  Telangana: 'Telugu', 'Tamil Nadu': 'Tamil',
}

// Real Nashik–Trimbakeshwar Simhastha landmarks.
const LOCATIONS = [
  'Ramkund', 'Kushavarta Kund', 'Trimbakeshwar Temple', 'Kalaram Temple',
  'Panchavati', 'Tapovan', 'Sadhugram', 'Sita Gufa', 'Gangapur Road Ghat',
  'CBS Bus Stand', 'Nashik Road Railway Station', 'Mukti Dham', 'Dudhsagar Falls Road',
  'Saptashrungi Base', 'Ahilyadevi Holkar Bridge', 'Goda Ghat',
]
const CENTERS = [
  'Ramkund LF Center', 'Trimbak Gate Center', 'Tapovan Center', 'Sadhugram Center',
  'Panchavati Center', 'CBS Help Center', 'Kushavarta Center', 'Nashik Road Center',
]
const STATUS = [['Reunited', 82], ['Pending', 12], ['Transferred to hospital', 3], ['Unresolved', 3]]

const CLOTHES = ['orange saree', 'white dhoti and kurta', 'green saree', 'blue checked shirt', 'cream kurta', 'maroon saree', 'yellow blouse', 'grey sweater', 'red sari with gold border', 'black shawl']
const FEATURES = ['walks with a cane', 'hard of hearing', 'wears thick glasses', 'has a tilak on forehead', 'silver anklets', 'short grey hair', 'limps on right leg', 'carries a cloth bag', 'tulsi mala around neck', 'speaks little Hindi']
const REMARKS = ['Family frantic, last dip together.', 'Got separated in snan crowd.', 'Phone switched off.', 'Came by group bus, lost the group.', 'Volunteer escorting to help desk.', 'Cross-checked at adjacent center.', 'Announced on PA system.', 'Possible match flagged for review.', '']

// snan-day spike dates (fictional 2027 Simhastha), with normal window around them
const WINDOW_START = Date.parse('2027-07-15T05:00:00')
const WINDOW_END = Date.parse('2027-09-15T22:00:00')
const SNAN_DAYS = ['2027-08-04', '2027-08-19', '2027-09-02', '2027-09-11'].map((d) => Date.parse(d + 'T03:30:00'))

function reportedAt() {
  let base
  if (chance(0.55)) {
    // cluster on a snan day (4-5x density) within a ~14h bathing window
    base = pick(SNAN_DAYS) + int(0, 14 * 60) * 60000
  } else {
    base = WINDOW_START + Math.floor(rng() * (WINDOW_END - WINDOW_START))
  }
  const d = new Date(base)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function makePerson() {
  const [state] = [weighted(STATES.map((s) => [s, s[1]]))]
  const stateName = state[0]
  const district = pick(state[2])
  const gender = weighted(GENDER)
  const ageBand = weighted(AGE_BANDS)
  const name =
    gender === 'Female' ? `${pick(FIRST_F)} ${pick(LAST)}` :
    gender === 'Male' ? `${pick(FIRST_M)} ${pick(LAST)}` :
    `${pick([...FIRST_F, ...FIRST_M])} ${pick(LAST)}`
  const desc = chance(0.18) ? '' : `${pick(CLOTHES)}, ${pick(FEATURES)}`
  return {
    name,
    gender,
    age_band: ageBand,
    state: stateName,
    district,
    language: LANG_BY_STATE[stateName] || 'Hindi',
    last_seen_location: pick(LOCATIONS),
    physical_description: desc,
  }
}

function statusBlock() {
  const status = weighted(STATUS)
  let resolution_hours = ''
  if (status === 'Reunited') resolution_hours = (Math.round((0.4 + rng() * 9) * 10) / 10).toString()
  else if (status === 'Transferred to hospital') resolution_hours = (Math.round((1 + rng() * 6) * 10) / 10).toString()
  return { status, resolution_hours }
}

function maybeBlank(v, p) {
  return chance(p) ? '' : v
}
function mobile() {
  return '+91 ' + pick(['98', '99', '70', '73', '88', '90', '94']) + String(int(10000000, 99999999))
}

// ---- build missing-persons with deliberate cross-center duplicate clusters ----
const TARGET = 2500
const rows = []
let n = 0
const id = () => `KMP-2027-${String(++n).padStart(5, '0')}`

// ~8% duplicates => ~100 two-record clusters (same person, different centers)
const DUP_CLUSTERS = 100
for (let i = 0; i < DUP_CLUSTERS; i++) {
  const base = makePerson()
  const centerA = pick(CENTERS)
  let centerB = pick(CENTERS)
  while (centerB === centerA) centerB = pick(CENTERS)
  const loc = base.last_seen_location
  const t = reportedAt()

  // Record 1: the family's report (often Pending) at center A
  rows.push({
    case_id: id(),
    reported_at: t,
    missing_person_name: maybeBlank(base.name, 0.12),
    gender: base.gender,
    age_band: base.age_band,
    state: base.state,
    district: base.district,
    language: base.language,
    last_seen_location: loc,
    reporting_center: centerA,
    reporter_mobile: maybeBlank(mobile(), 0.2),
    physical_description: base.physical_description,
    status: weighted([['Pending', 60], ['Reunited', 30], ['Unresolved', 10]]),
    resolution_hours: '',
    is_duplicate_report: 'True',
    remarks: 'Possible match flagged for review.',
  })
  // Record 2: the SAME person logged at center B — varied spelling / blanks /
  // a "found" outcome the searching family would never see.
  const variedName = chance(0.4)
    ? '' // blank at the other center
    : base.name.replace(/a$/, chance(0.5) ? 'aa' : 'a').replace('Lakshmi', 'Laxmi').replace('Sarla', 'Sarala')
  const sb2 = weighted([['Transferred to hospital', 35], ['Reunited', 40], ['Pending', 25]])
  rows.push({
    case_id: id(),
    reported_at: t,
    missing_person_name: variedName,
    gender: base.gender,
    age_band: base.age_band,
    state: base.state,
    district: base.district,
    language: base.language,
    last_seen_location: chance(0.5) ? loc : pick(LOCATIONS),
    reporting_center: centerB,
    reporter_mobile: maybeBlank(mobile(), 0.5),
    physical_description: chance(0.4) ? '' : base.physical_description,
    status: sb2,
    resolution_hours: sb2 === 'Transferred to hospital' || sb2 === 'Reunited'
      ? (Math.round((1 + rng() * 7) * 10) / 10).toString() : '',
    is_duplicate_report: 'True',
    remarks: 'Logged at second center; same person suspected.',
  })
}

// remaining unique reports
while (rows.length < TARGET) {
  const p = makePerson()
  const sb = statusBlock()
  rows.push({
    case_id: id(),
    reported_at: reportedAt(),
    missing_person_name: maybeBlank(p.name, 0.15),
    gender: p.gender,
    age_band: p.age_band,
    state: p.state,
    district: p.district,
    language: p.language,
    last_seen_location: p.last_seen_location,
    reporting_center: pick(CENTERS),
    reporter_mobile: maybeBlank(mobile(), 0.2),
    physical_description: p.physical_description,
    status: sb.status,
    resolution_hours: sb.resolution_hours,
    is_duplicate_report: 'False',
    remarks: pick(REMARKS),
  })
}
// shuffle so duplicate clusters aren't adjacent
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1))
  ;[rows[i], rows[j]] = [rows[j], rows[i]]
}

writeCsv(
  'Synthetic_Missing_Persons_2500.csv',
  ['case_id', 'reported_at', 'missing_person_name', 'gender', 'age_band', 'state', 'district', 'language', 'last_seen_location', 'reporting_center', 'reporter_mobile', 'physical_description', 'status', 'resolution_hours', 'is_duplicate_report', 'remarks'],
  rows,
)

// ---- geography: bounded to the Nashik–Trimbakeshwar corridor ------------------
// Trimbakeshwar ~ (19.932, 73.530); Nashik Panchavati/Ramkund ~ (19.998, 73.789)
const LAT0 = 19.90, LAT1 = 20.02, LNG0 = 73.51, LNG1 = 73.81
const randLat = () => +(LAT0 + rng() * (LAT1 - LAT0)).toFixed(6)
const randLng = () => +(LNG0 + rng() * (LNG1 - LNG0)).toFixed(6)
// two crowd clusters: Ramkund/Panchavati and Trimbakeshwar
function clusteredPoint() {
  const c = chance(0.6) ? [19.998, 73.789] : [19.932, 73.530]
  return [
    +(c[0] + (rng() - 0.5) * 0.04).toFixed(6),
    +(c[1] + (rng() - 0.5) * 0.05).toFixed(6),
  ]
}

// Zones (32)
const zones = []
for (let z = 1; z <= 32; z++) {
  const [lat, lng] = clusteredPoint()
  zones.push({
    zone_name: `Zone-${String(z).padStart(2, '0')}`,
    centroid_lat: lat,
    centroid_lng: lng,
    approx_boundary_points: int(6, 16),
  })
}
writeCsv('Zone_Boundaries.csv', ['zone_name', 'centroid_lat', 'centroid_lng', 'approx_boundary_points'], zones)

// CCTV (1280) spread across zones
const cams = []
for (let z = 1; z <= 32; z++) {
  const base = zones[z - 1]
  const count = int(30, 50)
  for (let c = 1; c <= count && cams.length < 1280; c++) {
    cams.push({
      camera_id: `Z${z}-C${c}`,
      longitude: +(base.centroid_lng + (rng() - 0.5) * 0.02).toFixed(6),
      latitude: +(base.centroid_lat + (rng() - 0.5) * 0.02).toFixed(6),
    })
  }
}
while (cams.length < 1280) {
  cams.push({ camera_id: `Z32-C${cams.length}`, longitude: randLng(), latitude: randLat() })
}
writeCsv('CCTV_Locations.csv', ['camera_id', 'longitude', 'latitude'], cams.slice(0, 1280))

// Police stations (14) — Nashik-area names
const POLICE = ['Bhadrakali PS', 'Sarkarwada PS', 'Panchavati PS', 'Mhasrul PS', 'Adgaon PS', 'Nashik Road PS', 'Deolali Camp PS', 'Upnagar PS', 'Gangapur PS', 'Trimbakeshwar PS', 'Indira Nagar PS', 'Ambad PS', 'Satpur PS', 'Bharatnagar PS']
writeCsv(
  'Police_Stations.csv',
  ['station_name', 'longitude', 'latitude'],
  POLICE.map((s) => { const [lat, lng] = clusteredPoint(); return { station_name: s, longitude: lng, latitude: lat } }),
)

// Chokepoints / parking (85) with the specified category breakdown
const CHOKE_SPEC = [
  ['Traffic choke point', 26], ['No-vehicle pressure zone', 3], ['Transfer node', 11],
  ['Parking', 30], ['Outer parking', 10], ['Parking belt', 5],
]
const choke = []
let cn = 0
for (const [category, count] of CHOKE_SPEC) {
  for (let i = 0; i < count; i++) {
    const [lat, lng] = clusteredPoint()
    choke.push({
      location_name: `${category.split(' ')[0]} Point ${++cn}`,
      category,
      longitude: lng,
      latitude: lat,
    })
  }
}
writeCsv('Chokepoints_Parking.csv', ['location_name', 'category', 'longitude', 'latitude'], choke)

console.log('\n  ✓ dataset written to public/data/  (drop in the real CSVs to override)\n')
