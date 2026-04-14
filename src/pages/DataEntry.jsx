import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES, OPP } from '../lib/utils'

const POSITIONS = ['Forward', 'Defender', 'Midfield', 'Goalkeeper']
const POS_COLORS = { Forward: '#f0b429', Defender: '#4a9eff', Midfield: '#3ecf8e', Goalkeeper: '#a78bfa' }

const EMPTY_STATS = {
  total_minutes: '',
  // Defence
  duels_contested: '', defensive_duels_won: '', duels_neutral: '', duels_lost: '', breach_1v1: '',
  dne: '', forced_to_win: '', kickaway_to_received: '', tackles: '',
  free_conceded: '', shot_free_conceded: '', two_pt_free_conceded: '',
  yellow: '', black: '', red: '',
  // Shooting from play
  one_pointer_attempts: '', one_pointer_scored: '', one_pointer_wide: '', one_pointer_drop_short_block: '',
  two_pointer_attempts: '', two_pointer_scored: '', two_pointer_wide: '', two_pointer_drop_short_block: '',
  goal_attempts: '', goals_scored: '', goals_wide: '', goal_drop_short_block: '',
  // Shooting from frees
  one_pointer_attempts_f: '', one_pointer_scored_f: '',
  two_pointer_attempts_f: '', two_pointer_scored_f: '',
  goal_attempts_f: '', goals_scored_f: '',
  // Turnovers
  turnovers_in_contact: '', turnover_skill_error: '', turnovers_kicked_away: '',
  drop_shorts: '', acceptable_turnovers: '',
  // Assists
  assists_shots: '', assists_goals: '', assists_2pt: '', pts: '',
  // Kickouts ours
  won_clean_p1_our: '', won_clean_p2_our: '', won_clean_p3_our: '', won_break_our: '',
  our_ko_contest_opp: '', our_ko_contest_us: '',
  ko_target_won_clean: '', ko_target_won_break: '', ko_target_lost_clean: '', ko_target_lost_contest: '',
  // Kickouts opp
  won_clean_p1_opp: '', won_clean_p2_opp: '', won_clean_p3_opp: '', won_break_opp: '',
  their_ko_contest_opp: '', their_ko_contest_us: '',
  // Possession
  simple_pass: '', simple_receive: '', advance_pass: '', advance_receive: '', carries: '',
  // GK
  shots_saved: '', shots_conceded: '',
  // Impact
  attack_impact: '', transition_impact: '', defensive_impact: '', total_impact: '',
}

const SECTIONS = [
  {
    title: 'Gametime', color: '#8ba8c8',
    fields: [['total_minutes', 'Minutes Played']],
  },
  {
    title: 'Shooting — From Play', color: '#f0b429',
    fields: [
      ['one_pointer_attempts', '1pt Attempts'], ['one_pointer_scored', '1pt Scored'],
      ['one_pointer_wide', '1pt Wide'], ['one_pointer_drop_short_block', '1pt Drop Short/Block'],
      ['two_pointer_attempts', '2pt Attempts'], ['two_pointer_scored', '2pt Scored'],
      ['two_pointer_wide', '2pt Wide'], ['two_pointer_drop_short_block', '2pt Drop Short/Block'],
      ['goal_attempts', 'Goal Attempts'], ['goals_scored', 'Goals Scored'],
      ['goals_wide', 'Goals Wide'], ['goal_drop_short_block', 'Goal Drop Short/Block'],
    ],
  },
  {
    title: 'Shooting — From Frees', color: '#a78bfa',
    fields: [
      ['one_pointer_attempts_f', '1pt Free Attempts'], ['one_pointer_scored_f', '1pt Frees Scored'],
      ['two_pointer_attempts_f', '2pt Free Attempts'], ['two_pointer_scored_f', '2pt Frees Scored'],
      ['goal_attempts_f', 'Goal Free Attempts'], ['goals_scored_f', 'Goals from Frees'],
    ],
  },
  {
    title: 'Playmaking', color: '#3ecf8e',
    fields: [
      ['assists_shots', 'Shot Assists'], ['assists_goals', 'Goal Assists'],
      ['assists_2pt', '2pt Assists'], ['pts', 'Total Points'],
    ],
  },
  {
    title: 'Turnovers', color: '#f06060',
    fields: [
      ['turnovers_in_contact', 'TOs in Contact'], ['turnover_skill_error', 'TO Skill Error'],
      ['turnovers_kicked_away', 'TOs Kicked/HP Away'], ['drop_shorts', 'Drop Shorts (Total)'],
      ['acceptable_turnovers', 'Acceptable TOs'],
    ],
  },
  {
    title: 'Defence — Duels', color: '#4a9eff',
    fields: [
      ['duels_contested', 'Duels Contested'], ['defensive_duels_won', 'Duels Won'],
      ['duels_neutral', 'Duels Neutral'], ['duels_lost', 'Duels Lost'], ['breach_1v1', 'Breach 1v1'],
    ],
  },
  {
    title: 'Defence — Actions', color: '#3ecf8e',
    fields: [
      ['tackles', 'Tackles (no TO)'], ['forced_to_win', 'Forced TO Won'],
      ['kickaway_to_received', 'Kickaway TO Won'], ['dne', 'DNE'],
    ],
  },
  {
    title: 'Fouls & Discipline', color: '#f06060',
    fields: [
      ['free_conceded', 'Free Conceded'], ['shot_free_conceded', 'Shot Free Conceded'],
      ['two_pt_free_conceded', '2pt Free Conceded'],
      ['yellow', 'Yellow Card'], ['black', 'Black Card'], ['red', 'Red Card'],
    ],
  },
  {
    title: 'Kickouts — Ours', color: '#3ecf8e',
    fields: [
      ['won_clean_p1_our', 'Won Clean P1'], ['won_clean_p2_our', 'Won Clean P2'],
      ['won_clean_p3_our', 'Won Clean P3'], ['won_break_our', 'Won Break'],
      ['our_ko_contest_opp', 'KO Contest (Opp)'], ['our_ko_contest_us', 'KO Contest (Us)'],
      ['ko_target_won_clean', 'KO Target Won Clean'], ['ko_target_won_break', 'KO Target Won Break'],
      ['ko_target_lost_clean', 'KO Target Lost Clean'], ['ko_target_lost_contest', 'KO Target Lost Contest'],
    ],
  },
  {
    title: 'Kickouts — Opposition', color: '#a78bfa',
    fields: [
      ['won_clean_p1_opp', 'Won Clean P1 (Opp)'], ['won_clean_p2_opp', 'Won Clean P2 (Opp)'],
      ['won_clean_p3_opp', 'Won Clean P3 (Opp)'], ['won_break_opp', 'Won Break (Opp)'],
      ['their_ko_contest_opp', 'Their KO Contest (Opp)'], ['their_ko_contest_us', 'Their KO Contest (Us)'],
    ],
  },
  {
    title: 'Possession', color: '#4a9eff',
    fields: [
      ['simple_pass', 'Simple Passes'], ['simple_receive', 'Simple Receives'],
      ['advance_pass', 'Advance Passes'], ['advance_receive', 'Advance Receives'],
      ['carries', 'Carries'],
    ],
  },
  {
    title: 'Goalkeeping', color: '#a78bfa',
    fields: [['shots_saved', 'Shots Saved'], ['shots_conceded', 'Shots Conceded']],
  },
  {
    title: 'Impact Scores', color: '#f0b429',
    fields: [
      ['attack_impact', 'Attack Impact'], ['transition_impact', 'Transition Impact'],
      ['defensive_impact', 'Defensive Impact'], ['total_impact', 'Total Impact'],
    ],
  },
]

export default function DataEntry() {
  const [players, setPlayers] = useState([])
  const [selectedMatch, setSelectedMatch] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [stats, setStats] = useState({ ...EMPTY_STATS })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null) // {type: 'success'|'error', message}
  const [existingData, setExistingData] = useState(null)

  useEffect(() => {
    supabase.from('players').select('name,position').order('name')
      .then(({ data }) => setPlayers(data || []))
  }, [])

  // Load existing data when player+match selected
  useEffect(() => {
    if (!selectedMatch || !selectedPlayer) return
    setLoading(true)
    supabase.from('player_stats')
      .select('*')
      .eq('match_id', selectedMatch)
      .eq('player_name', selectedPlayer)
      .single()
      .then(({ data }) => {
        if (data) {
          const mapped = {}
          Object.keys(EMPTY_STATS).forEach(k => {
            mapped[k] = data[k] !== null && data[k] !== undefined ? String(data[k]) : ''
          })
          setStats(mapped)
          setExistingData(data)
        } else {
          setStats({ ...EMPTY_STATS })
          setExistingData(null)
        }
        setLoading(false)
      })
  }, [selectedMatch, selectedPlayer])

  const handleChange = (field, value) => {
    setStats(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!selectedMatch || !selectedPlayer) {
      setStatus({ type: 'error', message: 'Please select a match and player first' })
      return
    }
    setSaving(true)
    setStatus(null)

    // Convert to numbers
    const payload = { match_id: selectedMatch, player_name: selectedPlayer }
    Object.keys(EMPTY_STATS).forEach(k => {
      const v = stats[k]
      payload[k] = v === '' || v === null ? null : parseFloat(v)
    })

    const { error } = await supabase
      .from('player_stats')
      .upsert(payload, { onConflict: 'match_id,player_name' })

    setSaving(false)
    if (error) {
      setStatus({ type: 'error', message: 'Error saving: ' + error.message })
    } else {
      setStatus({ type: 'success', message: `✓ Saved ${selectedPlayer} — ${selectedMatch}` })
      setExistingData(payload)
    }
  }

  const posColor = players.find(p => p.name === selectedPlayer)?.position
    ? POS_COLORS[players.find(p => p.name === selectedPlayer).position]
    : 'var(--text2)'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Match + Player selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Match selector */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Match</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MATCHES.map(m => (
              <button key={m} onClick={() => setSelectedMatch(m)}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${m === selectedMatch ? 'var(--blue)' : 'var(--border)'}`,
                  background: m === selectedMatch ? 'rgba(74,158,255,0.12)' : 'var(--bg2)',
                  color: m === selectedMatch ? 'var(--blue)' : 'var(--text3)',
                  fontFamily: 'Barlow, sans-serif',
                }}>
                <div>{m}</div>
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{OPP[m]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Player selector */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Player</div>
          <select
            value={selectedPlayer}
            onChange={e => setSelectedPlayer(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, color: selectedPlayer ? posColor : 'var(--text3)',
              fontSize: 14, fontFamily: 'Barlow, sans-serif', outline: 'none', cursor: 'pointer',
            }}>
            <option value="">Select player...</option>
            {POSITIONS.map(pos => (
              <optgroup key={pos} label={pos}>
                {players.filter(p => p.position === pos).map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: status.type === 'success' ? 'rgba(62,207,142,0.1)' : 'rgba(240,96,96,0.1)',
          border: `1px solid ${status.type === 'success' ? 'var(--teal)' : 'var(--red)'}`,
          color: status.type === 'success' ? 'var(--teal)' : 'var(--red)',
          fontSize: 13,
        }}>
          {status.message}
        </div>
      )}

      {/* Existing data badge */}
      {existingData && selectedMatch && selectedPlayer && (
        <div style={{ padding: '8px 12px', background: 'rgba(74,158,255,0.08)', border: '1px solid var(--blue)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: 'var(--blue)' }}>
          ℹ️ Editing existing record for {selectedPlayer} — {selectedMatch}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Stat sections */}
          {SECTIONS.map(section => (
            <div key={section.title} className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
              <div className="card-header">
                <span style={{ color: section.color }}>{section.title}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, background: 'var(--border)' }}>
                {section.fields.map(([field, label]) => (
                  <div key={field} style={{ background: 'var(--bg2)', padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
                    <input
                      type="number"
                      value={stats[field]}
                      onChange={e => handleChange(field, e.target.value)}
                      placeholder="0"
                      step={field.includes('impact') ? '0.01' : '1'}
                      style={{
                        width: '100%', padding: '7px 10px',
                        background: 'var(--bg3)', border: `1px solid ${stats[field] !== '' && stats[field] !== '0' ? section.color : 'var(--border)'}`,
                        borderRadius: 6, color: stats[field] !== '' && stats[field] !== '0' ? section.color : 'var(--text3)',
                        fontSize: 16, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save button */}
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleSave}
              disabled={saving || !selectedMatch || !selectedPlayer}
              style={{
                width: '100%', padding: '14px',
                background: saving ? 'var(--bg3)' : 'rgba(62,207,142,0.12)',
                border: `1px solid ${saving ? 'var(--border)' : 'var(--teal)'}`,
                borderRadius: 10, color: saving ? 'var(--text3)' : 'var(--teal)',
                fontSize: 15, fontWeight: 700, fontFamily: 'Barlow, sans-serif',
                cursor: saving || !selectedMatch || !selectedPlayer ? 'not-allowed' : 'pointer',
                letterSpacing: 1,
              }}>
              {saving ? 'Saving...' : existingData ? '↑ Update Record' : '+ Save New Record'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
