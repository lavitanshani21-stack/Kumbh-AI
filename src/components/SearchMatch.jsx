import { useMemo, useState } from 'react'
import { findCandidates, confidenceLabel } from '../lib/match.js'
import { matchPersons } from '../api.js'
import { PersonCard, VerdictBadge, ConfidenceBar, SourceTag } from './ui.jsx'

const AGE_BANDS = ['0-12', '13-17', '18-40', '41-60', '61-70', '71-80', '80+']
const GENDERS = ['Female', 'Male', 'Unknown']

const EMPTY = {
  missing_person_name: '', gender: '', age_band: '', language: '',
  state: '', last_seen_location: '', physical_description: '',
}

export default function SearchMatch({ registry, online, flash, onResolve }) {
  const [q, setQ] = useState(EMPTY)
  const [candidates, setCandidates] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const locations = useMemo(
    () => [...new Set(registry.map((r) => r.last_seen_location).filter(Boolean))].sort(),
    [registry],
  )
  const languages = useMemo(
    () => [...new Set(registry.map((r) => r.language).filter(Boolean))].sort(),
    [registry],
  )
  const states = useMemo(
    () => [...new Set(registry.map((r) => r.state).filter(Boolean))].sort(),
    [registry],
  )

  function set(k, v) { setQ((p) => ({ ...p, [k]: v })) }

  // Load a realistic family search drawn from a duplicate cluster so the
  // cross-center match is demonstrable (the sibling record sits at another center).
  function loadExample() {
    const pool = registry.filter((r) => r.is_duplicate_report === 'True')
    const seed = pool[Math.floor(Math.random() * pool.length)] || registry[0]
    setQ({
      missing_person_name: '', // families often arrive without the spelling we filed
      gender: seed.gender,
      age_band: seed.age_band,
      language: seed.language,
      state: seed.state,
      last_seen_location: seed.last_seen_location,
      physical_description: seed.physical_description,
    })
    setCandidates(null); setAiResult(null); setSearched(false)
  }

  async function search() {
    setLoading(true)
    setSearched(true)
    setAiResult(null)
    setMeta(null)
    // 1) Deterministic blocking + scoring — runs offline, instant.
    const cands = findCandidates(q, registry, { limit: 8, minScore: 0.35 })
    setCandidates(cands)

    // 2) If online, have Claude verify identity & explain the top candidates.
    if (online && cands.length) {
      try {
        const res = await matchPersons(q, cands)
        const byId = Object.fromEntries(res.matches.map((m) => [m.case_id, m]))
        setAiResult({ byId, summary: res.summary })
        setMeta(res._meta)
        flash(res._meta?.source === 'claude' ? 'Verified across centers by Claude ✦' : 'Matched (offline mode)')
      } catch (e) {
        flash('AI verify failed: ' + e.message)
      }
    } else if (!online) {
      flash(`Searched ${registry.length} records offline · ${cands.length} candidates`)
    }
    setLoading(false)
  }

  // Merge deterministic + AI verdicts; sort by best available confidence.
  const display = useMemo(() => {
    if (!candidates) return []
    return candidates
      .map((c) => {
        const ai = aiResult?.byId?.[c.record.case_id]
        const confidence = ai ? ai.confidence : Math.round(c.score * 100)
        const verdict = ai ? ai.verdict : confidenceLabel(c.score) === 'STRONG' ? 'SAME_PERSON' : confidenceLabel(c.score) === 'LIKELY' ? 'POSSIBLE' : 'DIFFERENT'
        const reasoning = ai ? ai.reasoning : (c.reasons.length ? c.reasons.join(' · ') : 'Partial overlap on shared fields.')
        return { ...c, confidence, verdict, reasoning }
      })
      .sort((a, b) => b.confidence - a.confidence)
  }, [candidates, aiResult])

  return (
    <div className="grid cols-2">
      {/* Search form */}
      <div className="panel panel-pad" style={{ alignSelf: 'start' }}>
        <div className="row-between" style={{ marginBottom: 6 }}>
          <p className="panel-title" style={{ margin: 0 }}>Operator Search · on behalf of family</p>
          <button className="btn ghost sm" onClick={loadExample}>⚡ Demo case</button>
        </div>
        <p className="hint" style={{ marginBottom: 14 }}>
          Searches <strong>every center at once</strong>. The family usually has no phone and may not know
          the exact spelling — fill what you can. Blank fields are ignored, not penalized.
        </p>

        <label className="field">
          <span>Name (if known — often blank)</span>
          <input value={q.missing_person_name} onChange={(e) => set('missing_person_name', e.target.value)} placeholder="e.g. Laxmi / लक्ष्मी — or leave blank" />
        </label>

        <label className="field">
          <span>Age band</span>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {AGE_BANDS.map((b) => (
              <button key={b} className={q.age_band === b ? 'on' : ''} onClick={() => set('age_band', q.age_band === b ? '' : b)}>{b}</button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>Gender</span>
          <div className="seg">
            {GENDERS.map((g) => (
              <button key={g} className={q.gender === g ? 'on' : ''} onClick={() => set('gender', q.gender === g ? '' : g)}>{g}</button>
            ))}
          </div>
        </label>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="field">
            <span>Language</span>
            <select value={q.language} onChange={(e) => set('language', e.target.value)}>
              <option value="">Any</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Home state</span>
            <select value={q.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">Any</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Last seen</span>
          <select value={q.last_seen_location} onChange={(e) => set('last_seen_location', e.target.value)}>
            <option value="">Anywhere</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Physical description</span>
          <textarea rows={2} value={q.physical_description} onChange={(e) => set('physical_description', e.target.value)} placeholder="clothing, distinguishing features…" />
        </label>

        <div className="btn-row">
          <button className="btn primary" onClick={search} disabled={loading}>
            {loading ? <><span className="spinner" /> Searching…</> : `🔎 Search all centers`}
          </button>
          <button className="btn ghost" onClick={() => { setQ(EMPTY); setCandidates(null); setAiResult(null); setSearched(false) }}>Clear</button>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className="panel panel-pad">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <p className="panel-title" style={{ margin: 0 }}>Cross-Center Matches</p>
            <SourceTag meta={meta} />
          </div>

          {!searched && (
            <div className="empty">
              Run a search to surface records filed at <em>other</em> centers — the ones a family
              standing at this desk could never see today.
            </div>
          )}

          {searched && display.length === 0 && !loading && (
            <div className="empty">No candidate matches above threshold. Try widening fields or removing the location filter.</div>
          )}

          {aiResult?.summary && (
            <div className="callout ai" style={{ marginBottom: 14 }}>
              <div className="ct">✦ Operator guidance</div>
              {aiResult.summary}
            </div>
          )}

          {display.map((d) => (
            <PersonCard
              key={d.record.case_id}
              r={d.record}
              match={d.confidence >= 60}
              right={<VerdictBadge verdict={d.verdict} />}
            >
              <div style={{ marginTop: 10 }}>
                <ConfidenceBar value={d.confidence} />
              </div>
              <div className="why">{d.reasoning}</div>
              {(d.verdict === 'SAME_PERSON' || d.confidence >= 70) && d.record.status !== 'Reunited' && (
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn primary sm" onClick={() => { onResolve(d.record.case_id); flash(`Linked & marked reunited · ${d.record.case_id}`) }}>
                    ✓ Confirm match & reunite
                  </button>
                </div>
              )}
            </PersonCard>
          ))}
        </div>
      </div>
    </div>
  )
}
