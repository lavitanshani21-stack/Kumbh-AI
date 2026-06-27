// Deterministic fuzzy matcher for cross-center missing-person records.
// Runs entirely client-side so search + duplicate detection work OFFLINE
// (networks collapse at peak density). When online, Claude re-ranks and explains
// the top candidates this produces.

export function normName(s) {
  if (!s) return ''
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-zऀ-ॿঀ-৿஀-௿ ]/g, '')
    // common transliteration collapses so "Laxmi"/"Lakshmi", "Sarla"/"Sarala" align
    .replace(/ksh/g, 'x')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/v/g, 'w')
    .replace(/\s+/g, ' ')
    .trim()
}

// Jaro-Winkler similarity (good for short names with typos/transliteration).
export function jaroWinkler(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const mDist = Math.floor(Math.max(a.length, b.length) / 2) - 1
  const aM = new Array(a.length).fill(false)
  const bM = new Array(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - mDist)
    const hi = Math.min(i + mDist + 1, b.length)
    for (let j = lo; j < hi; j++) {
      if (bM[j] || a[i] !== b[j]) continue
      aM[i] = bM[j] = true; matches++; break
    }
  }
  if (matches === 0) return 0
  let t = 0, k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue
    while (!bM[k]) k++
    if (a[i] !== b[k]) t++
    k++
  }
  t /= 2
  const jaro = (matches / a.length + matches / b.length + (matches - t) / matches) / 3
  let prefix = 0
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++; else break
  }
  return jaro + prefix * 0.1 * (1 - jaro)
}

const AGE_ORDER = ['0-12', '13-17', '18-40', '41-60', '61-70', '71-80', '80+']
function ageBandDistance(a, b) {
  const i = AGE_ORDER.indexOf(a), j = AGE_ORDER.indexOf(b)
  if (i < 0 || j < 0) return 2
  return Math.abs(i - j)
}

function tokenOverlap(a, b) {
  if (!a || !b) return 0
  const sa = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 2))
  const sb = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 2))
  if (sa.size === 0 || sb.size === 0) return 0
  let inter = 0
  for (const w of sa) if (sb.has(w)) inter++
  return inter / Math.min(sa.size, sb.size)
}

/**
 * Score how likely `cand` is the same person as `query`.
 * Both are missing-person records (or a search query shaped like one).
 * Returns { score 0-1, reasons[] } and gracefully ignores blank fields —
 * weights are redistributed across the signals that are actually present.
 */
export function matchScore(query, cand) {
  const signals = []

  // Name (heavy when both present)
  const qn = normName(query.missing_person_name)
  const cn = normName(cand.missing_person_name)
  if (qn && cn) {
    const s = jaroWinkler(qn, cn)
    signals.push({ w: 3.0, s, label: s > 0.85 ? 'name very similar' : s > 0.7 ? 'name similar' : 'name differs' })
  }

  // Gender
  if (query.gender && cand.gender && query.gender !== 'Unknown' && cand.gender !== 'Unknown') {
    signals.push({ w: 1.0, s: query.gender === cand.gender ? 1 : 0, label: query.gender === cand.gender ? 'gender matches' : 'gender differs' })
  }

  // Age band (adjacent bands count as near-match)
  if (query.age_band && cand.age_band) {
    const d = ageBandDistance(query.age_band, cand.age_band)
    const s = d === 0 ? 1 : d === 1 ? 0.6 : 0
    signals.push({ w: 1.8, s, label: d === 0 ? 'same age band' : d === 1 ? 'adjacent age band' : 'age band differs' })
  }

  // Language
  if (query.language && cand.language) {
    signals.push({ w: 1.2, s: query.language === cand.language ? 1 : 0, label: query.language === cand.language ? `same language (${cand.language})` : 'language differs' })
  }

  // Last-seen location
  if (query.last_seen_location && cand.last_seen_location) {
    const same = query.last_seen_location === cand.last_seen_location
    const s = same ? 1 : tokenOverlap(query.last_seen_location, cand.last_seen_location)
    signals.push({ w: 1.6, s, label: same ? 'same last-seen location' : s > 0 ? 'nearby location' : 'different location' })
  }

  // State / district origin
  if (query.state && cand.state) {
    signals.push({ w: 0.8, s: query.state === cand.state ? 1 : 0, label: query.state === cand.state ? 'same home state' : 'different state' })
  }

  // Physical description (semantic-ish token overlap)
  const dq = query.physical_description, dc = cand.physical_description
  if (dq && dc) {
    const s = tokenOverlap(dq, dc)
    if (s > 0) signals.push({ w: 1.4, s, label: 'description overlaps' })
  }

  if (signals.length === 0) return { score: 0, reasons: [] }
  const wsum = signals.reduce((a, b) => a + b.w, 0)
  let score = signals.reduce((a, b) => a + b.w * b.s, 0) / wsum
  // Calibration: the name is the only strongly-distinguishing field. With no
  // name on either record, identical demographics are not proof of identity —
  // cap below STRONG so a human or the AI layer confirms before "same person".
  if (!(qn && cn)) score = Math.min(score, 0.78)
  score = Math.round(score * 100) / 100
  const reasons = signals
    .filter((x) => x.s >= 0.6)
    .sort((a, b) => b.w * b.s - a.w * a.s)
    .map((x) => x.label)
  return { score, reasons }
}

/**
 * Blocking + scoring: cheaply narrow the full registry to plausible candidates,
 * then score. Excludes the query's own record. Returns sorted candidates.
 */
export function findCandidates(query, registry, { limit = 10, minScore = 0.3 } = {}) {
  const out = []
  for (const r of registry) {
    if (query.case_id && r.case_id === query.case_id) continue
    // light blocking: must share gender (if known) OR be within 1 age band,
    // to avoid scoring all 2500 every keystroke.
    const genderOk = !query.gender || !r.gender || query.gender === 'Unknown' || r.gender === 'Unknown' || query.gender === r.gender
    if (!genderOk) continue
    const { score, reasons } = matchScore(query, r)
    if (score >= minScore) out.push({ record: r, score, reasons })
  }
  out.sort((a, b) => b.score - a.score)
  return out.slice(0, limit)
}

export function confidenceLabel(score) {
  if (score >= 0.82) return 'STRONG'
  if (score >= 0.62) return 'LIKELY'
  if (score >= 0.4) return 'POSSIBLE'
  return 'WEAK'
}
