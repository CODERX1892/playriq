import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseScoutXML, scoutHeadline } from '../lib/scoutParse'
import { parseScoutPDF } from '../lib/scoutPdf'

const COMPETITIONS = ['Championship', 'League', 'Challenge']
const fieldBox = {
  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 12,
  fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
}
const lbl = { fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }

// Loads one opposition game from a GAA Insights / Hudl XML into scout_matches.
// Each save is one game-row; the Scout view aggregates them per opponent.
export default function ScoutUpload({ onSaved }) {
  const [parsed, setParsed] = useState(null)
  const [opponent, setOpponent] = useState('')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [competition, setCompetition] = useState('Championship')
  const [season, setSeason] = useState('')
  const [soAtt, setSoAtt] = useState('')
  const [soMid, setSoMid] = useState('')
  const [soDef, setSoDef] = useState('')
  const [pdfStatus, setPdfStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const p = parseScoutXML(ev.target.result)
        setParsed(p)
        setOpponent(p.opponent)
        setError(null); setStatus(null)
        // best-effort date from filename match_tags_YYYY-MM-DD
        const m = file.name.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (m) {
          if (!date) setDate(m[0])
          if (!season) setSeason(m[1])
          if (!label) setLabel(`${p.opponent} ${m[0]}`)
        } else if (!label) {
          setLabel(p.opponent)
        }
      } catch (err) {
        setParsed(null)
        setError('Failed to parse XML: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handlePDF = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfStatus('Reading PDF…')
    try {
      const buf = await file.arrayBuffer()
      const { shot_origins } = await parseScoutPDF(buf)
      if (shot_origins) {
        setSoAtt(String(shot_origins.att))
        setSoMid(String(shot_origins.mid))
        setSoDef(String(shot_origins.def))
        setPdfStatus(`✓ Ball won by third: ${shot_origins.att} att · ${shot_origins.mid} mid · ${shot_origins.def} def`)
      } else {
        setPdfStatus("Couldn't find the shot-origin table — enter the three numbers below from PDF p22.")
      }
    } catch (err) {
      setPdfStatus("Couldn't read that PDF — enter the three numbers below manually.")
    }
  }

  const handleSave = async () => {
    if (!parsed || !opponent) return
    const matchLabel = (label || '').trim() || date || 'Game'
    setSaving(true); setStatus(null); setError(null)
    const h = scoutHeadline(parsed)
    const att = parseInt(soAtt, 10), mid = parseInt(soMid, 10), def = parseInt(soDef, 10)
    const hasOrigins = [att, mid, def].some(v => Number.isFinite(v))
    const shot_origins = hasOrigins
      ? { att: att || 0, mid: mid || 0, def: def || 0 }
      : null
    const { error: err } = await supabase.from('scout_matches').upsert({
      opponent,
      match_label: matchLabel,
      match_date: date || null,
      competition,
      season: season || null,
      source: hasOrigins ? 'xml+pdf' : 'xml',
      ...h,
      profile: { ...parsed, opponent, shot_origins },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'opponent,match_label' })
    setSaving(false)
    if (err) setError(err.message)
    else {
      setStatus(`✓ Saved ${opponent} — ${matchLabel}`)
      setParsed(null); setLabel(''); setDate('')
      setSoAtt(''); setSoMid(''); setSoDef('')
      setPdfStatus(null)
      onSaved?.()
    }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span style={{ color: 'var(--blue)' }}>Load Opponent Game</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>GAA Insights / Hudl XML</span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={lbl}>XML File</div>
        <input type="file" accept=".xml" onChange={handleFile} style={fieldBox} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={lbl}>PDF File — optional (auto-fills where they win the ball)</div>
        <input type="file" accept=".pdf" onChange={handlePDF} style={fieldBox} />
        {pdfStatus && <div style={{ fontSize: 11, color: pdfStatus.startsWith('✓') ? 'var(--teal)' : 'var(--text3)', marginTop: 5 }}>{pdfStatus}</div>}
      </div>

      {parsed && (
        <>
          <div style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: 'var(--teal)', marginBottom: 6 }}>✓ Parsed — {parsed.opponent}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, color: 'var(--text3)' }}>
              <span>Shots: <b style={{ color: 'var(--text)' }}>{parsed.totals.shots}</b></span>
              <span>Score: <b style={{ color: 'var(--gold)' }}>{parsed.totals.goals}-{parsed.totals.pts} ({parsed.totals.score_pts})</b></span>
              <span>Their KO kept: <b style={{ color: 'var(--teal)' }}>{parsed.their_kickouts.retained_pct}%</b></span>
              <span>Top shooter: <b style={{ color: 'var(--text)' }}>{parsed.shooters[0]?.player || '—'}</b></span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={lbl}>Opponent</div>
              <input value={opponent} onChange={e => setOpponent(e.target.value)} style={fieldBox} />
            </div>
            <div>
              <div style={lbl}>Match label</div>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="2025 DSFC Final" style={fieldBox} />
            </div>
            <div>
              <div style={lbl}>Date</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldBox} />
            </div>
            <div>
              <div style={lbl}>Competition</div>
              <select value={competition} onChange={e => setCompetition(e.target.value)} style={fieldBox}>
                {COMPETITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ ...lbl, marginBottom: 5 }}>Where they win the ball — by third, from PDF (editable)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <input type="number" min="0" value={soAtt} onChange={e => setSoAtt(e.target.value)} placeholder="Attacking" style={fieldBox} />
            <input type="number" min="0" value={soMid} onChange={e => setSoMid(e.target.value)} placeholder="Middle" style={fieldBox} />
            <input type="number" min="0" value={soDef} onChange={e => setSoDef(e.target.value)} placeholder="Defensive" style={fieldBox} />
          </div>
        </>
      )}

      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {status && <div style={{ color: 'var(--teal)', fontSize: 12, marginBottom: 10 }}>{status}</div>}

      <button onClick={handleSave} disabled={!parsed || !opponent || saving}
        style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none',
          background: parsed && opponent ? 'var(--blue)' : 'var(--bg3)',
          color: parsed && opponent ? 'white' : 'var(--text3)',
          fontSize: 13, fontWeight: 700, fontFamily: 'Barlow, sans-serif',
          cursor: parsed && opponent ? 'pointer' : 'not-allowed' }}>
        {saving ? 'Saving…' : 'Save Game to Scout'}
      </button>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
        Each game you load adds to that opponent's profile. Load every game you have for a team — the Scout view averages them per game.
      </div>
    </div>
  )
}
