import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES, OPP } from '../lib/utils'

const POSITIONS = ['Forward', 'Defender', 'Midfield', 'Goalkeeper']
const POS_COLORS = { Forward: '#f0b429', Defender: '#4a9eff', Midfield: '#3ecf8e', Goalkeeper: '#a78bfa' }

const CATEGORIES = [
  { key: 'minutes', label: 'Minutes Played', color: '#8ba8c8', fields: [{ key: 'total_minutes', label: 'Minutes' }] },
  { key: 'shooting_play', label: 'Shooting — Play', color: '#f0b429', fields: [
    { key: 'one_pointer_attempts', label: '1pt Att' }, { key: 'one_pointer_scored', label: '1pt Scr' },
    { key: 'one_pointer_wide', label: '1pt Wide' }, { key: 'one_pointer_drop_short_block', label: '1pt DS' },
    { key: 'two_pointer_attempts', label: '2pt Att' }, { key: 'two_pointer_scored', label: '2pt Scr' },
    { key: 'two_pointer_wide', label: '2pt Wide' }, { key: 'two_pointer_drop_short_block', label: '2pt DS' },
    { key: 'goal_attempts', label: 'G Att' }, { key: 'goals_scored', label: 'Goals' },
    { key: 'goals_wide', label: 'G Wide' }, { key: 'goal_drop_short_block', label: 'G DS' },
  ]},
  { key: 'shooting_frees', label: 'Shooting — Frees', color: '#a78bfa', fields: [
    { key: 'one_pointer_attempts_f', label: '1pt Att' }, { key: 'one_pointer_scored_f', label: '1pt Scr' },
    { key: 'two_pointer_attempts_f', label: '2pt Att' }, { key: 'two_pointer_scored_f', label: '2pt Scr' },
    { key: 'goal_attempts_f', label: 'G Att' }, { key: 'goals_scored_f', label: 'Goals' },
  ]},
  { key: 'playmaking', label: 'Playmaking', color: '#3ecf8e', fields: [
    { key: 'assists_shots', label: 'Shot Ast' }, { key: 'assists_goals', label: 'Goal Ast' },
    { key: 'assists_2pt', label: '2pt Ast' }, { key: 'pts', label: 'Pts' },
  ]},
  { key: 'duels', label: 'Duels', color: '#4a9eff', fields: [
    { key: 'duels_contested', label: 'Contested' }, { key: 'defensive_duels_won', label: 'Won' },
    { key: 'duels_neutral', label: 'Neutral' }, { key: 'duels_lost', label: 'Lost' },
    { key: 'breach_1v1', label: 'Breach' },
  ]},
  { key: 'def_actions', label: 'Def Actions', color: '#3ecf8e', fields: [
    { key: 'tackles', label: 'Tackles' }, { key: 'forced_to_win', label: 'Forced TO' },
    { key: 'kickaway_to_received', label: 'Kickaway TO' }, { key: 'dne', label: 'DNE' },
  ]},
  { key: 'fouls', label: 'Fouls', color: '#f06060', fields: [
    { key: 'free_conceded', label: 'Free' }, { key: 'shot_free_conceded', label: 'Shot Free' },
    { key: 'two_pt_free_conceded', label: '2pt Free' },
    { key: 'yellow', label: 'Yellow' }, { key: 'black', label: 'Black' }, { key: 'red', label: 'Red' },
  ]},
  { key: 'turnovers', label: 'Turnovers', color: '#f06060', fields: [
    { key: 'turnovers_in_contact', label: 'Contact' }, { key: 'turnover_skill_error', label: 'Skill Err' },
    { key: 'turnovers_kicked_away', label: 'Kicked Away' }, { key: 'drop_shorts', label: 'Drop Shorts' },
    { key: 'acceptable_turnovers', label: 'Acceptable' },
  ]},
  { key: 'possession', label: 'Possession', color: '#4a9eff', fields: [
    { key: 'simple_pass', label: 'Sim Pass' }, { key: 'simple_receive', label: 'Sim Rec' },
    { key: 'advance_pass', label: 'Adv Pass' }, { key: 'advance_receive', label: 'Adv Rec' },
    { key: 'carries', label: 'Carries' },
  ]},
  { key: 'ko_ours', label: 'KO — Ours', color: '#3ecf8e', fields: [
    { key: 'won_clean_p1_our', label: 'Clean P1' }, { key: 'won_clean_p2_our', label: 'Clean P2' },
    { key: 'won_clean_p3_our', label: 'Clean P3' }, { key: 'won_break_our', label: 'Break' },
    { key: 'our_ko_contest_opp', label: 'Cont Opp' }, { key: 'our_ko_contest_us', label: 'Cont Us' },
    { key: 'ko_target_won_clean', label: 'Tgt Won Cl' }, { key: 'ko_target_won_break', label: 'Tgt Won Br' },
    { key: 'ko_target_lost_clean', label: 'Tgt Lost Cl' }, { key: 'ko_target_lost_contest', label: 'Tgt Lost Co' },
  ]},
  { key: 'ko_opp', label: 'KO — Opp', color: '#a78bfa', fields: [
    { key: 'won_clean_p1_opp', label: 'Clean P1' }, { key: 'won_clean_p2_opp', label: 'Clean P2' },
    { key: 'won_clean_p3_opp', label: 'Clean P3' }, { key: 'won_break_opp', label: 'Break' },
    { key: 'their_ko_contest_opp', label: 'Cont Opp' }, { key: 'their_ko_contest_us', label: 'Cont Us' },
  ]},
  { key: 'goalkeeping', label: 'Goalkeeping', color: '#a78bfa', fields: [
    { key: 'shots_saved', label: 'Saved' }, { key: 'shots_conceded', label: 'Conceded' },
  ]},
  { key: 'impact', label: 'Impact', color: '#f0b429', decimal: true, fields: [
    { key: 'attack_impact', label: 'Attack' }, { key: 'transition_impact', label: 'Trans' },
    { key: 'defensive_impact', label: 'Defence' }, { key: 'total_impact', label: 'Total' },
  ]},
]

export default function DataEntry() {
  const [players, setPlayers] = useState([])
  const [match, setMatch] = useState('')
  const [catKey, setCatKey] = useState('minutes')
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('players').select('name,position').order('name')
      .then(({ data: d }) => setPlayers(d || []))
  }, [])

  useEffect(() => {
    if (!match) return
    setLoading(true)
    supabase.from('player_stats').select('*').eq('match_id', match)
      .then(({ data: rows }) => {
        const mapped = {}
        if (rows) rows.forEach(r => { mapped[r.player_name] = r })
        setData(mapped)
        setLoading(false)
      })
  }, [match])

  const get = (name, field) => {
    const v = data[name]?.[field]
    return (v === null || v === undefined) ? '' : String(v)
  }

  const set = (name, field, val) => {
    setData(prev => ({ ...prev, [name]: { ...prev[name], [field]: val } }))
  }

  const save = async () => {
    if (!match) { setStatus({ type: 'error', message: 'Select a match first' }); return }
    setSaving(true); setStatus(null)
    const cat = CATEGORIES.find(c => c.key === catKey)
    const upserts = []
    for (const p of players) {
      const hasData = cat.fields.some(f => get(p.name, f.key) !== '') || get(p.name, 'total_minutes') !== ''
      if (!hasData) continue
      const row = { match_id: match, player_name: p.name }
      cat.fields.forEach(f => {
        const v = get(p.name, f.key)
        row[f.key] = v === '' ? null : parseFloat(v)
      })
      const mins = get(p.name, 'total_minutes')
      if (mins !== '') row.total_minutes = parseInt(mins)
      upserts.push(row)
    }
    if (!upserts.length) { setSaving(false); setStatus({ type: 'error', message: 'No data to save' }); return }
    const { error } = await supabase.from('player_stats').upsert(upserts, { onConflict: 'match_id,player_name' })
    setSaving(false)
    if (error) setStatus({ type: 'error', message: 'Error: ' + error.message })
    else setStatus({ type: 'success', message: `✓ Saved ${cat.label} for ${upserts.length} players` })
  }

  const cat = CATEGORIES.find(c => c.key === catKey)
  const sorted = [...players].sort((a, b) => {
    const o = { Goalkeeper: 0, Defender: 1, Midfield: 2, Forward: 3 }
    return (o[a.position] || 0) - (o[b.position] || 0)
  })

  const colW = `140px 52px ${cat.fields.map(() => '62px').join(' ')}`

  return (
    <div>
      {/* Match */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7 }}>Match</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MATCHES.map(m => (
            <button key={m} onClick={() => setMatch(m)} style={{
              padding: '7px 13px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${m === match ? 'var(--blue)' : 'var(--border)'}`,
              background: m === match ? 'rgba(74,158,255,0.12)' : 'var(--bg2)',
              color: m === match ? 'var(--blue)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif',
            }}>
              <div>{m}</div><div style={{ fontSize: 9, opacity: 0.7 }}>{OPP[m]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7 }}>Category</div>
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 5, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCatKey(c.key)} style={{
              padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${c.key === catKey ? c.color : 'var(--border)'}`,
              background: c.key === catKey ? 'rgba(255,255,255,0.05)' : 'var(--bg2)',
              color: c.key === catKey ? c.color : 'var(--text3)',
              whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif',
            }}>{c.label}</button>
          ))}
        </div>
      </div>

      {status && (
        <div style={{
          padding: '9px 13px', borderRadius: 8, marginBottom: 11,
          background: status.type === 'success' ? 'rgba(62,207,142,0.1)' : 'rgba(240,96,96,0.1)',
          border: `1px solid ${status.type === 'success' ? 'var(--teal)' : 'var(--red)'}`,
          color: status.type === 'success' ? 'var(--teal)' : 'var(--red)', fontSize: 13,
        }}>{status.message}</div>
      )}

      {!match ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)', fontSize: 13 }}>
          Select a match to begin
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 80 }}>
          <div style={{ minWidth: 'max-content' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: colW, gap: 4, padding: '8px 12px', background: 'var(--bg3)', borderRadius: '10px 10px 0 0', border: '1px solid var(--border)', borderBottom: 'none' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>Player</div>
              <div style={{ fontSize: 10, color: '#8ba8c8', textAlign: 'center' }}>Mins</div>
              {cat.fields.map(f => (
                <div key={f.key} style={{ fontSize: 9, color: cat.color, textAlign: 'center', letterSpacing: 0.5 }}>{f.label}</div>
              ))}
            </div>

            {/* Rows */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {sorted.map((p, i) => {
                const pc = POS_COLORS[p.position] || 'var(--text2)'
                return (
                  <div key={p.name} style={{
                    display: 'grid', gridTemplateColumns: colW, gap: 4,
                    padding: '7px 12px', alignItems: 'center',
                    background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)',
                    borderTop: i === 0 ? 'none' : '1px solid rgba(26,51,86,0.25)',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 9, color: pc }}>{p.position}</div>
                    </div>
                    <SI value={get(p.name, 'total_minutes')} onChange={v => set(p.name, 'total_minutes', v)} color="#8ba8c8" />
                    {cat.fields.map(f => (
                      <SI key={f.key} value={get(p.name, f.key)} onChange={v => set(p.name, f.key, v)} color={cat.color} decimal={cat.decimal} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Save bar */}
      {match && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '10px 14px', zIndex: 50 }}>
          <button onClick={save} disabled={saving} style={{
            width: '100%', maxWidth: 480, display: 'block', margin: '0 auto',
            padding: '13px', borderRadius: 10,
            background: saving ? 'var(--bg3)' : 'rgba(62,207,142,0.12)',
            border: `1px solid ${saving ? 'var(--border)' : 'var(--teal)'}`,
            color: saving ? 'var(--text3)' : 'var(--teal)',
            fontSize: 14, fontWeight: 700, fontFamily: 'Barlow, sans-serif', cursor: 'pointer', letterSpacing: 1,
          }}>{saving ? 'Saving...' : `Save ${cat.label}`}</button>
        </div>
      )}
    </div>
  )
}

function SI({ value, onChange, color, decimal }) {
  return (
    <input type="number" value={value} onChange={e => onChange(e.target.value)}
      placeholder="" step={decimal ? '0.01' : '1'} min="0"
      style={{
        width: '100%', padding: '5px 3px', textAlign: 'center',
        background: value && value !== '0' ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: `1px solid ${value && value !== '0' ? color : 'rgba(26,51,86,0.4)'}`,
        borderRadius: 5, color: value && value !== '0' ? color : 'var(--text3)',
        fontSize: 13, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, outline: 'none',
      }} />
  )
}
