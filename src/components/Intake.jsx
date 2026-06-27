import { useMemo, useRef, useState } from 'react'
import { parseIntake } from '../api.js'
import { SourceTag } from './ui.jsx'

const AGE_BANDS = ['0-12', '13-17', '18-40', '41-60', '61-70', '71-80', '80+', 'Unknown']
const GENDERS = ['Female', 'Male', 'Unknown']

const SAMPLES = [
  { label: '🪔 Marathi', text: 'माझी आई हरवली आहे. तिचे नाव सरला, वय अंदाजे ७० वर्षे. रामकुंडावर स्नानाच्या वेळी ती हरवली. तिने केशरी साडी घातली आहे आणि तिला नीट ऐकू येत नाही.' },
  { label: '🪔 Hindi', text: 'मेरे पिता जी खो गए हैं। उम्र करीब 75 साल। त्र्यंबकेश्वर मंदिर के पास भीड़ में बिछड़ गए। सफेद कुर्ता पहना है, लाठी लेकर चलते हैं।' },
  { label: '🪔 English', text: 'My 6-year-old son went missing near the food stalls at Tapovan about 20 minutes ago. He is wearing a blue shirt and was holding a packet of biscuits.' },
]

export default function Intake({ registry, onCreate, goToSearch, flash }) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [meta, setMeta] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [consent, setConsent] = useState(false)
  const [center, setCenter] = useState('')
  const [mobile, setMobile] = useState('')
  const [listening, setListening] = useState(false)
  const recogRef = useRef(null)

  const centers = useMemo(
    () => [...new Set(registry.map((r) => r.reporting_center).filter(Boolean))].sort(),
    [registry],
  )
  const locations = useMemo(
    () => [...new Set(registry.map((r) => r.last_seen_location).filter(Boolean))].sort(),
    [registry],
  )

  const speechSupported =
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  function toggleVoice() {
    if (!speechSupported) return
    if (listening) { recogRef.current?.stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'mr-IN'; r.interimResults = true; r.continuous = true
    let finalText = text ? text + ' ' : ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += seg + ' '
        else interim += seg
      }
      setText((finalText + interim).trim())
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recogRef.current = r; r.start(); setListening(true)
  }

  async function runParse() {
    if (!text.trim()) return
    setParsing(true)
    try {
      const res = await parseIntake(text)
      setParsed(res); setMeta(res._meta)
      if (!center) setCenter(centers[0] || '')
      flash(res._meta?.source === 'claude' ? 'Report understood by Claude ✦' : 'Parsed (offline mode)')
    } catch (e) {
      flash('Parse failed: ' + e.message)
    } finally {
      setParsing(false)
    }
  }

  function setField(k, v) { setParsed((p) => ({ ...p, [k]: v })) }

  function fileReport() {
    if (!parsed) return
    const idNum = 90000 + Math.floor(Math.random() * 9999)
    const now = new Date()
    const p = (n) => String(n).padStart(2, '0')
    const record = {
      case_id: `KMP-2027-${idNum}`,
      reported_at: `2027-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`,
      missing_person_name: parsed.missing_person_name || '',
      gender: parsed.gender || 'Unknown',
      age_band: parsed.age_band || 'Unknown',
      state: parsed.state && parsed.state !== 'Unknown' ? parsed.state : 'Maharashtra',
      district: '',
      language: parsed.language || parsed.detectedLanguage || 'Unknown',
      last_seen_location: parsed.last_seen_location || 'Unknown',
      reporting_center: center || centers[0] || 'Ramkund LF Center',
      reporter_mobile: consent ? mobile : '',
      physical_description: parsed.physical_description || '',
      status: 'Pending',
      resolution_hours: '',
      is_duplicate_report: 'False',
      remarks: 'Filed via operator intake.',
    }
    onCreate(record)
    flash(`Filed ${record.case_id} — now searchable at every center`)
    setText(''); setParsed(null); setMeta(null); setMobile(''); setConsent(false)
    goToSearch()
  }

  return (
    <div className="grid cols-2">
      <div className="panel panel-pad">
        <p className="panel-title">1 · Listen to the family (any language)</p>
        <p className="hint" style={{ marginBottom: 14 }}>
          The family speaks; you capture. Designed for walk-ups with <strong>no smartphone</strong> who may
          not read or write — the operator is the interface. Claude detects the language and translates.
        </p>
        <div className="btn-row" style={{ marginBottom: 12 }}>
          {SAMPLES.map((s) => (
            <button key={s.label} className="btn ghost sm" onClick={() => { setText(s.text); setParsed(null) }}>{s.label} sample</button>
          ))}
        </div>
        <label className="field">
          <span>Report (verbatim)</span>
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or speak what the family says, in any language…" />
        </label>
        <div className="btn-row">
          <button className="btn primary" onClick={runParse} disabled={parsing || !text.trim()}>
            {parsing ? <><span className="spinner" /> Understanding…</> : '✦ Understand report'}
          </button>
          {speechSupported && (
            <button className={`btn ${listening ? '' : 'ghost'}`} onClick={toggleVoice}>
              {listening ? '⏺ Listening… stop' : '🎤 Voice'}
            </button>
          )}
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <p className="panel-title" style={{ margin: 0 }}>2 · Confirm &amp; file to shared registry</p>
          <SourceTag meta={meta} />
        </div>

        {!parsed ? (
          <div className="empty">Understand a report to build the structured record here.</div>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 12 }}>Detected language: <strong>{parsed.detectedLanguage}</strong> · first-glance urgency: <strong>{parsed.urgencyHint}</strong></p>
            <label className="field">
              <span>Name (English transliteration — may stay blank)</span>
              <input value={parsed.missing_person_name} onChange={(e) => setField('missing_person_name', e.target.value)} placeholder="Name not given" />
            </label>
            <label className="field" style={{ marginBottom: 10 }}>
              <span>Age band</span>
              <div className="seg" style={{ flexWrap: 'wrap' }}>
                {AGE_BANDS.map((b) => <button key={b} className={parsed.age_band === b ? 'on' : ''} onClick={() => setField('age_band', b)}>{b}</button>)}
              </div>
            </label>
            <label className="field" style={{ marginBottom: 10 }}>
              <span>Gender</span>
              <div className="seg">
                {GENDERS.map((g) => <button key={g} className={parsed.gender === g ? 'on' : ''} onClick={() => setField('gender', g)}>{g}</button>)}
              </div>
            </label>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field">
                <span>Last seen</span>
                <select value={parsed.last_seen_location} onChange={(e) => setField('last_seen_location', e.target.value)}>
                  <option value={parsed.last_seen_location}>{parsed.last_seen_location}</option>
                  {locations.filter((l) => l !== parsed.last_seen_location).map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="field">
                <span>This center</span>
                <select value={center} onChange={(e) => setCenter(e.target.value)}>
                  {centers.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Description</span>
              <textarea rows={2} value={parsed.physical_description} onChange={(e) => setField('physical_description', e.target.value)} />
            </label>

            <div className="divider" />
            <label className="field">
              <span>Reporter contact (optional, with consent)</span>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 …" />
            </label>
            <label style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 16, height: 16 }} />
              Family consents to store contact for reunification notice (masked in all views).
            </label>

            <button className="btn primary" style={{ width: '100%' }} onClick={fileReport}>
              ＋ File to shared registry
            </button>
          </>
        )}
      </div>
    </div>
  )
}
