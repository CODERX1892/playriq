import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES } from '../lib/utils'

const BODEN = 'Ballyboden St Endas'
const SCORE_OUTCOMES = new Set(['Point', 'Two Points', 'Goal'])
const KO_LEN_MAP = { 'Short': 'short', 'Mid-Range': 'mid', 'Long': 'long' }

function parseXML(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const instances = doc.querySelectorAll('instance')

  // Group by ID
  const events = {}
  instances.forEach(inst => {
    const id = inst.querySelector('ID')?.textContent
    const code = inst.querySelector('code')?.textContent || ''
    const start = inst.querySelector('start')?.textContent
    if (!id) return
    if (!events[id]) events[id] = { code, start }
    inst.querySelectorAll('label').forEach(label => {
      const group = label.querySelector('group')?.textContent
      const text = label.querySelector('text')?.textContent || ''
      if (group) events[id][group] = text
    })
  })

  const evList = Object.values(events)

  // Detect team names from codes
  const teamNames = [...new Set(evList.map(e => {
    const m = e.code?.match(/^(.+?)\s+(Shot|Kickout|Turnover)/)
    return m ? m[1] : null
  }).filter(Boolean))]

  const oppTeam = teamNames.find(t => !t.includes('Ballyboden')) || ''

  // Source of shots & scores
  const bodenShotsBy = { 'Own KO': 0, 'Opp KO': 0, 'Turnover': 0 }
  const bodenScoresBy = { 'Own KO': 0, 'Opp KO': 0, 'Turnover': 0 }
  const oppShotsBy = { 'Own KO': 0, 'Opp KO': 0, 'Turnover': 0 }
  const oppScoresBy = { 'Own KO': 0, 'Opp KO': 0, 'Turnover': 0 }

  const srcMap = { 'Own Kickout': 'Own KO', 'Opp Kickout': 'Opp KO', 'Turnover': 'Turnover' }

  evList.forEach(e => {
    if (!e.code?.includes('Shot')) return
    const src = srcMap[e.Source] || e.Source
    if (!(src in bodenShotsBy)) return
    const isScore = SCORE_OUTCOMES.has(e.Outcome)
    if (e.code.includes(BODEN)) {
      bodenShotsBy[src]++
      if (isScore) bodenScoresBy[src]++
    } else {
      oppShotsBy[src]++
      if (isScore) oppScoresBy[src]++
    }
  })

  // KO breakdown
  const ourKOs = { short: { taken:0, wonClean:0, wonBreak:0 }, mid: { taken:0, wonClean:0, wonBreak:0 }, long: { taken:0, wonClean:0, wonBreak:0 } }
  const oppKOs = { short: { taken:0, weWonClean:0, weWonBreak:0 }, mid: { taken:0, weWonClean:0, weWonBreak:0 }, long: { taken:0, weWonClean:0, weWonBreak:0 } }

  let ourKOTotal = 0, ourKTWonClean = 0, ourKTWonBreak = 0, ourRTWonBreak = 0, ourRTWonClean = 0
  let oppKOTotal = 0, oppKTWonClean = 0, oppKTWonBreak = 0, oppRTWonBreak = 0, oppRTWonClean = 0

  evList.forEach(e => {
    if (!e.code?.includes('Kickout')) return
    const len = KO_LEN_MAP[e.Kickout_Length] || 'long'
    const po = e.PO_Result || ''
    if (e.code.includes(BODEN)) {
      ourKOTotal++
      ourKOs[len].taken++
      if (po === 'KT Won Clean') { ourKTWonClean++; ourKOs[len].wonClean++ }
      else if (po === 'KT Won Break') { ourKTWonBreak++; ourKOs[len].wonBreak++ }
      else if (po === 'RT Won Break') ourRTWonBreak++
      else if (po === 'RT Won Clean') ourRTWonClean++
    } else {
      oppKOTotal++
      oppKOs[len].taken++
      // For opp KOs: KT = them, RT = us
      if (po === 'RT Won Clean') { oppKTWonClean++ /* they won clean */; }
      else if (po === 'RT Won Break') { oppKTWonBreak++ }
      else if (po === 'KT Won Break') { oppRTWonBreak++; oppKOs[len].weWonBreak++ }
      else if (po === 'KT Won Clean') { oppRTWonClean++; oppKOs[len].weWonClean++ }
    }
  })

  // Score totals
  const bodenShots = evList.filter(e => e.code?.includes(BODEN) && e.code?.includes('Shot'))
  const oppShots = evList.filter(e => !e.code?.includes(BODEN) && e.code?.includes('Shot'))

  const goals = (shots, player) => shots.filter(s => s.Outcome === 'Goal').length
  const twopts = (shots) => shots.filter(s => s.Outcome === 'Two Points').length
  const pts = (shots) => shots.filter(s => s.Outcome === 'Point').length
  const scored = (shots) => shots.filter(s => SCORE_OUTCOMES.has(s.Outcome)).length

  const ourG = goals(bodenShots)
  const our2 = twopts(bodenShots)
  const our1 = pts(bodenShots)
  const ourActualPts = ourG * 3 + our2 * 2 + our1

  const pct = (n, d) => d > 0 ? Math.round(n / d * 100) : 0

  return {
    opposition: oppTeam,
    our_shots: bodenShots.length,
    our_scores: scored(bodenShots),
    our_goals: ourG,
    our_2pt: our2,
    our_1pt: our1,
    our_score_pts: ourActualPts,

    opp_shots: oppShots.length,
    opp_scores: scored(oppShots),
    opp_goals: goals(oppShots),
    opp_2pt: twopts(oppShots),
    opp_1pt: pts(oppShots),

    boden_from_own_ko: bodenShotsBy['Own KO'],
    boden_from_opp_ko: bodenShotsBy['Opp KO'],
    boden_from_turnover: bodenShotsBy['Turnover'],
    opp_from_boden_ko: oppShotsBy['Opp KO'],   // their own KO = our KO
    opp_from_opp_ko: oppShotsBy['Own KO'],
    opp_from_turnover: oppShotsBy['Turnover'],

    boden_scores_own_ko: bodenScoresBy['Own KO'],
    boden_scores_opp_ko: bodenScoresBy['Opp KO'],
    boden_scores_turnover: bodenScoresBy['Turnover'],
    opp_scores_own_ko: oppScoresBy['Own KO'],
    opp_scores_opp_ko: oppScoresBy['Opp KO'],
    opp_scores_turnover: oppScoresBy['Turnover'],

    our_ko_taken: ourKOTotal,
    our_ko_won_clean_pct: pct(ourKTWonClean, ourKOTotal),
    our_ko_won_break_pct: pct(ourKTWonBreak, ourKOTotal),
    our_ko_lost_break_pct: pct(ourRTWonBreak, ourKOTotal),
    our_ko_lost_clean_pct: pct(ourRTWonClean, ourKOTotal),
    our_ko_short_taken: ourKOs.short.taken,
    our_ko_short_won_clean: ourKOs.short.wonClean,
    our_ko_mid_taken: ourKOs.mid.taken,
    our_ko_mid_won_clean: ourKOs.mid.wonClean,
    our_ko_mid_won_break: ourKOs.mid.wonBreak,
    our_ko_long_taken: ourKOs.long.taken,
    our_ko_long_won_clean: ourKOs.long.wonClean,

    opp_ko_taken: oppKOTotal,
    opp_ko_won_clean_pct: pct(oppKTWonClean, oppKOTotal),
    opp_ko_won_break_pct: pct(oppKTWonBreak, oppKOTotal),
    opp_ko_lost_clean_pct: pct(oppRTWonClean, oppKOTotal),
    opp_ko_lost_break_pct: pct(oppRTWonBreak, oppKOTotal),
    opp_ko_short_taken: oppKOs.short.taken,
    opp_ko_short_we_won_clean: oppKOs.short.weWonClean,
    opp_ko_mid_taken: oppKOs.mid.taken,
    opp_ko_mid_we_won_clean: oppKOs.mid.weWonClean,
  }
}

export default function XMLUpload() {
  const [matchId, setMatchId] = useState('')
  const [possessions, setPossessions] = useState('')
  const [attacks, setAttacks] = useState('')
  const [parsed, setParsed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const result = parseXML(ev.target.result)
        setParsed(result)
        setError(null)
        setStatus(null)
      } catch (err) {
        setError('Failed to parse XML: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handleSave = async () => {
    if (!matchId || !parsed) return
    setSaving(true)
    setStatus(null)
    const { error: err } = await supabase.from('team_analytics').upsert({
      match_id: matchId,
      our_possessions: parseFloat(possessions) || null,
      our_attacks: parseFloat(attacks) || null,
      ...parsed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'match_id' })
    setSaving(false)
    if (err) { setError(err.message) }
    else { setStatus('✓ Saved to Analytics tab') }
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span style={{ color: 'var(--blue)' }}>Upload Match XML</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>GAA Insights / Hudl XML</span>
      </div>

      {/* Match selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Match</div>
        <select value={matchId} onChange={e => setMatchId(e.target.value)}
          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: matchId ? 'var(--text)' : 'var(--text3)', fontSize: 12, fontFamily: 'Barlow, sans-serif' }}>
          <option value="">Select match…</option>
          {MATCHES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Possessions + Attacks (from PASS sheet, not in XML) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Possessions</div>
          <input type="number" value={possessions} onChange={e => setPossessions(e.target.value)} placeholder="e.g. 32"
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Attacks</div>
          <input type="number" value={attacks} onChange={e => setAttacks(e.target.value)} placeholder="e.g. 30"
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* File input */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>XML File</div>
        <input type="file" accept=".xml" onChange={handleFile}
          style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif' }} />
      </div>

      {/* Preview */}
      {parsed && (
        <div style={{ background: 'rgba(62,207,142,0.08)', border: '1px solid rgba(62,207,142,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: 'var(--teal)', marginBottom: 6 }}>✓ Parsed — {parsed.opposition}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, color: 'var(--text3)' }}>
            <span>Our shots: <b style={{ color: 'var(--text)' }}>{parsed.our_shots}</b></span>
            <span>Opp shots: <b style={{ color: 'var(--text)' }}>{parsed.opp_shots}</b></span>
            <span>Our score: <b style={{ color: 'var(--gold)' }}>{parsed.our_goals > 0 ? `${parsed.our_goals}g ` : ''}{parsed.our_2pt > 0 ? `${parsed.our_2pt}×2 ` : ''}{parsed.our_1pt}pt ({parsed.our_score_pts})</b></span>
            <span>Our KOs: <b style={{ color: 'var(--text)' }}>{parsed.our_ko_taken}</b></span>
            <span>Opp KOs: <b style={{ color: 'var(--text)' }}>{parsed.opp_ko_taken}</b></span>
            <span>Our KO clean: <b style={{ color: 'var(--teal)' }}>{parsed.our_ko_won_clean_pct}%</b></span>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {status && <div style={{ color: 'var(--teal)', fontSize: 12, marginBottom: 10 }}>{status}</div>}

      <button onClick={handleSave} disabled={!parsed || !matchId || saving}
        style={{ width: '100%', padding: 12, borderRadius: 8, background: parsed && matchId ? 'var(--blue)' : 'var(--bg3)', border: 'none', color: parsed && matchId ? 'white' : 'var(--text3)', fontSize: 13, fontWeight: 700, cursor: parsed && matchId ? 'pointer' : 'not-allowed', fontFamily: 'Barlow, sans-serif' }}>
        {saving ? 'Saving…' : 'Save to Analytics'}
      </button>
    </div>
  )
}
