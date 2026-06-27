import { useEffect, useMemo, useState } from 'react'
import { findCandidates, confidenceLabel } from '../lib/match.js'
import { dedupeRecord } from '../api.js'
import { PersonCard, VerdictBadge, ConfidenceBar, SourceTag } from './ui.jsx'

export default function Duplicates({ registry, online, flash, onMerge }) {
  const flagged = useMemo(
    () => registry.filter((r) => r.is_duplicate_report === 'True' && r.status !== 'Reunited').slice(0, 20),
    [registry],
  )
  const [selId, setSelId] = useState(flagged[0]?.case_id || null)
  const [cands, setCands] = useState([])
  const [ai, setAi] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(false)

  const selected = registry.find((r) => r.case_id === selId)

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    async function run() {
      setLoading(true); setAi(null); setMeta(null)
      const c = findCandidates(selected, registry, { limit: 6, minScore: 0.4 })
      if (cancelled) return
      setCands(c)
      if (online && c.length) {
        try {
          const res = await dedupeRecord(selected, c)
          if (cancelled) return
          const byId = Object.fromEntries(res.duplicates.map((d) => [d.case_id, d]))
          setAi({ byId, summary: res.summary }); setMeta(res._meta)
        } catch (e) {
          flash('Dedupe failed: ' + e.message)
        }
      }
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, online])

  const display = cands.map((c) => {
    const a = ai?.byId?.[c.record.case_id]
    const confidence = a ? a.confidence : Math.round(c.score * 100)
    const verdict = a ? a.verdict : confidenceLabel(c.score) === 'STRONG' ? 'DUPLICATE' : confidenceLabel(c.score) === 'LIKELY' ? 'POSSIBLE' : 'DISTINCT'
    const reasoning = a ? a.reasoning : (c.reasons.join(' · ') || 'Overlapping attributes.')
    return { ...c, confidence, verdict, reasoning }
  }).sort((a, b) => b.confidence - a.confidence)

  return (
    <div>
      <div className="page-head">
        <h2>Duplicate Detection</h2>
        <p>The same person is often reported at several centers. Merge duplicates so families stop searching in parallel.</p>
      </div>

      <div className="grid cols-2">
        <div className="panel panel-pad" style={{ alignSelf: 'start' }}>
          <p className="panel-title">Flagged for review · {flagged.length}</p>
          {flagged.map((r) => (
            <button
              key={r.case_id}
              className={`case-row ${r.case_id === selId ? 'selected' : ''}`}
              style={{ gridTemplateColumns: '1fr auto' }}
              onClick={() => setSelId(r.case_id)}
            >
              <div>
                <div className="nm">{r.missing_person_name || 'Name not given'}</div>
                <div className="meta">{r.age_band} · {r.gender} · {r.reporting_center}</div>
              </div>
              <div className="right">
                <span className="mono muted">{r.case_id}</span>
                <span className="center-chip">{r.last_seen_location}</span>
              </div>
            </button>
          ))}
          {flagged.length === 0 && <div className="empty">No open duplicate-flagged records.</div>}
        </div>

        <div>
          {selected && (
            <div className="panel panel-pad" style={{ marginBottom: 16 }}>
              <p className="panel-title">Reference record</p>
              <PersonCard r={selected} />
            </div>
          )}
          <div className="panel panel-pad">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <p className="panel-title" style={{ margin: 0 }}>Likely duplicates at other centers</p>
              {loading ? <span className="spinner" /> : <SourceTag meta={meta} />}
            </div>
            {ai?.summary && <div className="callout ai" style={{ marginBottom: 14 }}><div className="ct">✦ Recommendation</div>{ai.summary}</div>}
            {display.length === 0 && !loading && <div className="empty">No likely duplicates found for this record.</div>}
            {display.map((d) => (
              <PersonCard key={d.record.case_id} r={d.record} match={d.confidence >= 60} right={<VerdictBadge verdict={d.verdict} />}>
                <div style={{ marginTop: 10 }}><ConfidenceBar value={d.confidence} /></div>
                <div className="why">{d.reasoning}</div>
                {(d.verdict === 'DUPLICATE' || d.confidence >= 70) && (
                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <button className="btn primary sm" onClick={() => { onMerge(d.record.case_id); flash(`Merged ${d.record.case_id} into ${selected.case_id}`) }}>
                      ⇉ Merge records
                    </button>
                  </div>
                )}
              </PersonCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
