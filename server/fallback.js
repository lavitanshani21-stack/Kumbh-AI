// Offline heuristic engines. The client already runs the deterministic matcher
// (src/lib/match.js) and sends candidates with a precomputed `score` + `reasons`,
// so these fallbacks reshape that into the API response — keeping search and
// dedupe fully functional with no network (networks collapse at peak density).

function verdictFromScore(score, [hi, mid], labels) {
  if (score >= hi) return labels[0]
  if (score >= mid) return labels[1]
  return labels[2]
}

export function heuristicMatch(query, candidates) {
  const matches = (candidates || []).map((c) => ({
    case_id: c.record.case_id,
    confidence: Math.round((c.score || 0) * 100),
    verdict: verdictFromScore(c.score || 0, [0.82, 0.55], ['SAME_PERSON', 'POSSIBLE', 'DIFFERENT']),
    reasoning: (c.reasons && c.reasons.length ? c.reasons.join('; ') : 'Partial signal overlap on shared fields.'),
  }))
  const strong = matches.filter((m) => m.verdict === 'SAME_PERSON').length
  return {
    matches,
    summary: strong
      ? `${strong} strong cross-center match${strong > 1 ? 'es' : ''} found on shared attributes.`
      : 'No strong match yet — widen the search or check adjacent centers.',
  }
}

export function heuristicDedupe(record, candidates) {
  const duplicates = (candidates || []).map((c) => ({
    case_id: c.record.case_id,
    confidence: Math.round((c.score || 0) * 100),
    verdict: verdictFromScore(c.score || 0, [0.82, 0.6], ['DUPLICATE', 'POSSIBLE', 'DISTINCT']),
    reasoning: (c.reasons && c.reasons.length ? c.reasons.join('; ') : 'Overlapping attributes across centers.'),
  }))
  const dups = duplicates.filter((d) => d.verdict === 'DUPLICATE').length
  return {
    duplicates,
    summary: dups
      ? `${dups} likely duplicate report${dups > 1 ? 's' : ''} of this person at other centers.`
      : 'No clear duplicate detected for this record.',
  }
}

export function heuristicParse(text) {
  let detectedLanguage = 'Unknown'
  if (/[ऀ-ॿ]/.test(text)) detectedLanguage = 'Hindi/Marathi (Devanagari)'
  else if (/[஀-௿]/.test(text)) detectedLanguage = 'Tamil'
  else if (/[઀-૿]/.test(text)) detectedLanguage = 'Gujarati'
  else if (/[ಀ-೿]/.test(text)) detectedLanguage = 'Kannada'
  else if (/[a-z]/i.test(text)) detectedLanguage = 'English'

  const ageMatch = text.match(/\b(\d{1,3})\b/)
  const age = ageMatch ? parseInt(ageMatch[1], 10) : null
  let age_band = 'Unknown'
  if (age != null) {
    age_band =
      age <= 12 ? '0-12' : age <= 17 ? '13-17' : age <= 40 ? '18-40' :
      age <= 60 ? '41-60' : age <= 70 ? '61-70' : age <= 80 ? '71-80' : '80+'
  } else if (/old|elder|grand|बुज़ुर्ग|बूढ़|वृद्ध|aged|senior/i.test(text)) age_band = '61-70'
  else if (/child|kid|son|daughter|बच्च|boy|girl|मुलगा|मुलगी/i.test(text)) age_band = '0-12'

  const gender = /\b(she|her|daughter|wife|mother|girl|woman|aunt|आई|बहीण)\b/i.test(text)
    ? 'Female'
    : /\b(he|him|son|husband|father|boy|man|uncle|वडील|भाऊ)\b/i.test(text)
      ? 'Male'
      : 'Unknown'

  return {
    missing_person_name: '',
    gender,
    age_band,
    language: detectedLanguage.split(/[ /]/)[0],
    state: 'Unknown',
    last_seen_location: 'Unknown',
    physical_description: text.trim().slice(0, 200),
    detectedLanguage,
    urgencyHint: age_band === '61-70' || age_band === '71-80' || age_band === '80+' || age_band === '0-12' ? 'HIGH' : 'MEDIUM',
  }
}
