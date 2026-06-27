import 'dotenv/config'
import express from 'express'
import { runStructured, hasApiKey, MODEL } from './claude.js'
import { heuristicMatch, heuristicDedupe, heuristicParse } from './fallback.js'

const app = express()
app.use(express.json({ limit: '2mb' }))
const PORT = process.env.PORT || 8787

const AGE_BANDS = ['0-12', '13-17', '18-40', '41-60', '61-70', '71-80', '80+', 'Unknown']

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          case_id: { type: 'string' },
          confidence: { type: 'integer' },
          verdict: { type: 'string', enum: ['SAME_PERSON', 'POSSIBLE', 'DIFFERENT'] },
          reasoning: { type: 'string' },
        },
        required: ['case_id', 'confidence', 'verdict', 'reasoning'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string' },
  },
  required: ['matches', 'summary'],
  additionalProperties: false,
}

const DEDUPE_SCHEMA = {
  type: 'object',
  properties: {
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          case_id: { type: 'string' },
          confidence: { type: 'integer' },
          verdict: { type: 'string', enum: ['DUPLICATE', 'POSSIBLE', 'DISTINCT'] },
          reasoning: { type: 'string' },
        },
        required: ['case_id', 'confidence', 'verdict', 'reasoning'],
        additionalProperties: false,
      },
    },
    summary: { type: 'string' },
  },
  required: ['duplicates', 'summary'],
  additionalProperties: false,
}

const PARSE_SCHEMA = {
  type: 'object',
  properties: {
    missing_person_name: { type: 'string' },
    gender: { type: 'string', enum: ['Male', 'Female', 'Unknown'] },
    age_band: { type: 'string', enum: AGE_BANDS },
    language: { type: 'string' },
    state: { type: 'string' },
    last_seen_location: { type: 'string' },
    physical_description: { type: 'string' },
    detectedLanguage: { type: 'string' },
    urgencyHint: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
  },
  required: [
    'missing_person_name', 'gender', 'age_band', 'language', 'state',
    'last_seen_location', 'physical_description', 'detectedLanguage', 'urgencyHint',
  ],
  additionalProperties: false,
}

// Trim candidate payloads to the identity-relevant fields (privacy + tokens).
function slimRecord(r) {
  return {
    case_id: r.case_id,
    missing_person_name: r.missing_person_name || '(blank)',
    gender: r.gender,
    age_band: r.age_band,
    state: r.state,
    language: r.language,
    last_seen_location: r.last_seen_location,
    reporting_center: r.reporting_center,
    physical_description: r.physical_description || '(blank)',
    status: r.status,
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claude: hasApiKey, model: hasApiKey ? MODEL : 'heuristic' })
})

// Identity resolution: is each candidate the SAME person as the search query?
app.post('/api/match', async (req, res) => {
  const { query, candidates } = req.body || {}
  if (!query || !candidates) return res.status(400).json({ error: 'Missing query or candidates' })

  const system =
    'You are the identity-resolution engine for a unified cross-center missing-person registry at the ' +
    'Kumbh Mela. A family is searching at one center; the candidates were filed at OTHER centers and the ' +
    'family cannot see them. For each candidate decide whether it is the SAME person as the search query. ' +
    'Reason carefully about messy field-ops data: names are often blank or transliterated differently ' +
    '(Laxmi/Lakshmi, Sarla/Sarala) — a blank or differently-spelled name is NOT evidence they are different. ' +
    'Weigh age band (adjacent bands can still match an elderly person mis-estimated), gender, language, ' +
    'home state, last-seen location proximity, and physical description. Be well-calibrated: reserve high ' +
    'confidence for genuine corroboration across several fields. Use the EXACT case_id strings provided. ' +
    'summary: one or two sentences telling the operator what to do next.'

  const user =
    `SEARCH QUERY (family is looking for):\n${JSON.stringify(query, null, 2)}\n\n` +
    `CANDIDATE RECORDS FROM OTHER CENTERS:\n${JSON.stringify((candidates || []).map((c) => slimRecord(c.record)), null, 2)}\n\n` +
    'Return a verdict, confidence (0-100), and one-sentence reasoning for each candidate.'

  try {
    const { data, usage, model } = await runStructured({
      system, user, schema: MATCH_SCHEMA, adaptive: true, effort: 'medium', maxTokens: 3500,
    })
    res.json({ ...data, _meta: { source: 'claude', model, usage } })
  } catch (err) {
    res.json({ ...heuristicMatch(query, candidates), _meta: { source: 'heuristic', reason: err.message } })
  }
})

// Duplicate detection: which candidates are the same report re-filed at another center?
app.post('/api/dedupe', async (req, res) => {
  const { record, candidates } = req.body || {}
  if (!record || !candidates) return res.status(400).json({ error: 'Missing record or candidates' })

  const system =
    'You are the duplicate-detection engine for a cross-center missing-person registry at the Kumbh Mela. ' +
    'The same missing person is frequently reported at multiple lost-and-found centers, creating duplicate ' +
    'records that fragment the search. Given a reference record and candidate records from other centers, ' +
    'decide which candidates are DUPLICATE reports of the SAME person (so the centers can be merged). ' +
    'Treat blank/transliterated names as expected noise, not as distinguishing evidence. Corroborate across ' +
    'age band, gender, language, home state, last-seen location and description. Use the EXACT case_id values. ' +
    'summary: a one-line recommendation for the operator (merge / review / keep separate).'

  const user =
    `REFERENCE RECORD:\n${JSON.stringify(slimRecord(record), null, 2)}\n\n` +
    `CANDIDATE RECORDS:\n${JSON.stringify((candidates || []).map((c) => slimRecord(c.record)), null, 2)}\n\n` +
    'Return a verdict, confidence (0-100), and one-sentence reasoning for each candidate.'

  try {
    const { data, usage, model } = await runStructured({
      system, user, schema: DEDUPE_SCHEMA, adaptive: true, effort: 'medium', maxTokens: 3000,
    })
    res.json({ ...data, _meta: { source: 'claude', model, usage } })
  } catch (err) {
    res.json({ ...heuristicDedupe(record, candidates), _meta: { source: 'heuristic', reason: err.message } })
  }
})

// Multilingual intake: free-text/voice report → structured registry record.
app.post('/api/parse-intake', async (req, res) => {
  const { text } = req.body || {}
  if (!text || !text.trim()) return res.status(400).json({ error: 'Missing text' })

  const system =
    'You are the multilingual intake assistant for a Kumbh Mela lost-and-found center. A volunteer is ' +
    'helping a walk-up family who usually has NO smartphone and may not read or write. The family speaks ' +
    'in their own language (Marathi, Hindi, Gujarati, Tamil, Kannada, Telugu, English, …), often emotional ' +
    'and incomplete. Extract a structured registry record, translating everything into English for the ' +
    'operator. Detect the original language. age_band must be one of: 0-12, 13-17, 18-40, 41-60, 61-70, ' +
    '71-80, 80+, or Unknown. If a field is unknown, use "Unknown" (or "" for the name) — never invent ' +
    'specifics. last_seen_location: the place in English. urgencyHint: your first-glance priority ' +
    '(elderly and young children are higher).'

  const user = `Family report (verbatim):\n"""${text}"""\n\nReturn the structured intake record.`

  try {
    const { data, usage, model } = await runStructured({
      system, user, schema: PARSE_SCHEMA, maxTokens: 1200,
    })
    res.json({ ...data, _meta: { source: 'claude', model, usage } })
  } catch (err) {
    res.json({ ...heuristicParse(text), _meta: { source: 'heuristic', reason: err.message } })
  }
})

app.listen(PORT, () => {
  console.log(`\n  KumbhAI Registry server → http://localhost:${PORT}`)
  console.log(
    hasApiKey
      ? `  Claude: ENABLED (${MODEL})\n`
      : '  Claude: DISABLED — running on local heuristics. Set ANTHROPIC_API_KEY in .env for real AI matching.\n',
  )
})
