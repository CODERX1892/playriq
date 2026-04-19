import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES, OPP } from '../lib/utils'

const POS_COLORS = { Forward: '#f0b429', Defender: '#4a9eff', Midfield: '#3ecf8e', Goalkeeper: '#a78bfa' }

// Grouped columns matching the input sheet order exactly
const COL_GROUPS = [
  {
    label: 'Game', color: '#8ba8c8',
    cols: [{ key: 'total_minutes', label: 'Mins' }]
  },
  {
    label: 'Duels', color: '#4a9eff',
    cols: [
      { key: 'duels_contested', label: 'Cont' },
      { key: 'defensive_duels_won', label: 'Won' },
      { key: 'duels_neutral', label: 'Neut' },
      { key: 'duels_lost', label: 'Lost' },
      { key: 'dne', label: 'DNE' },
      { key: 'forced_to_win', label: 'F.TO' },
      { key: 'kickaway_to_received', label: 'K.TO' },
      { key: 'tackles', label: 'Tckl' },
      { key: 'breach_1v1', label: 'Brch' },
    ]
  },
  {
    label: 'Fouls', color: '#f06060',
    cols: [
      { key: 'free_conceded', label: 'Free' },
      { key: 'shot_free_conceded', label: 'ShtF' },
      { key: 'two_pt_free_conceded', label: '2ptF' },
      { key: 'yellow', label: 'Yell' },
      { key: 'black', label: 'Blck' },
      { key: 'red', label: 'Red' },
    ]
  },
  {
    label: 'Play', color: '#f0b429',
    cols: [
      { key: 'one_pointer_attempts', label: '1Att' },
      { key: 'one_pointer_scored', label: '1Scr' },
      { key: 'one_pointer_wide', label: '1Wde' },
      { key: 'two_pointer_attempts', label: '2Att' },
      { key: 'two_pointer_scored', label: '2Scr' },
      { key: 'two_pointer_wide', label: '2Wde' },
      { key: 'goal_attempts', label: 'GAtt' },
      { key: 'goals_scored', label: 'GScr' },
      { key: 'goals_wide', label: 'GWde' },
    ]
  },
  {
    label: 'Frees', color: '#a78bfa',
    cols: [
      { key: 'one_pointer_attempts_f', label: '1Att' },
      { key: 'one_pointer_scored_f', label: '1Scr' },
      { key: 'two_pointer_attempts_f', label: '2Att' },
      { key: 'two_pointer_scored_f', label: '2Scr' },
      { key: 'goal_attempts_f', label: 'GAtt' },
      { key: 'goals_scored_f', label: 'GScr' },
    ]
  },
  {
    label: 'Turnovers', color: '#f06060',
    cols: [
      { key: 'turnovers_in_contact', label: 'Cont' },
      { key: 'turnover_skill_error', label: 'Skll' },
      { key: 'turnovers_kicked_away', label: 'Kckd' },
      { key: 'drop_shorts', label: 'DS' },
      { key: 'one_pointer_drop_short_block', label: '1DS' },
      { key: 'two_pointer_drop_short_block', label: '2DS' },
      { key: 'goal_drop_short_block', label: 'GDS' },
      { key: 'acceptable_turnovers', label: 'Acc' },
    ]
  },
  {
    label: 'Assists', color: '#3ecf8e',
    cols: [
      { key: 'assists_shots', label: 'Sht' },
      { key: 'assists_goals', label: 'Goal' },
      { key: 'assists_2pt', label: '2pt' },
      { key: 'pts', label: 'Pts' },
    ]
  },
  {
    label: 'KO Ours', color: '#3ecf8e',
    cols: [
      { key: 'won_clean_p1_our', label: 'P1' },
      { key: 'won_clean_p2_our', label: 'P2' },
      { key: 'won_clean_p3_our', label: 'P3' },
      { key: 'won_break_our', label: 'Brk' },
      { key: 'our_ko_contest_opp', label: 'COp' },
      { key: 'our_ko_contest_us', label: 'CUs' },
      { key: 'ko_target_won_clean', label: 'TWC' },
      { key: 'ko_target_won_break', label: 'TWB' },
      { key: 'ko_target_lost_clean', label: 'TLC' },
      { key: 'ko_target_lost_contest', label: 'TLCo' },
    ]
  },
  {
    label: 'KO Opp', color: '#a78bfa',
    cols: [
      { key: 'won_clean_p1_opp', label: 'P1' },
      { key: 'won_clean_p2_opp', label: 'P2' },
      { key: 'won_clean_p3_opp', label: 'P3' },
      { key: 'won_break_opp', label: 'Brk' },
      { key: 'their_ko_contest_opp', label: 'COp' },
      { key: 'their_ko_contest_us', label: 'CUs' },
    ]
  },
  {
    label: 'Possession', color: '#4a9eff',
    cols: [
      { key: 'simple_pass', label: 'SimP' },
      { key: 'simple_receive', label: 'SimR' },
      { key: 'advance_pass', label: 'AdvP' },
      { key: 'advance_receive', label: 'AdvR' },
      { key: 'carries', label: 'Carr' },
    ]
  },
  {
    label: 'GK', color: '#a78bfa',
    cols: [
      { key: 'shots_saved', label: 'Svd' },
      { key: 'shots_conceded', label: 'Con' },
    ]
  },
  {
    label: 'Impact', color: '#f0b429', decimal: true,
    cols: [
      { key: 'attack_impact', label: 'Atk' },
      { key: 'transition_impact', label: 'Tran' },
      { key: 'defensive_impact', label: 'Def' },
      { key: 'total_impact', label: 'Tot' },
    ]
  },
]

const ALL_COLS = COL_GROUPS.flatMap(g => g.cols.map(c => ({ ...c, groupColor: g.color, decimal: g.decimal })))

import XMLUpload from './XMLUpload'

export default function DataEntry() {
  const [players, setPlayers] = useState([])
  const [match, setMatch] = useState('')
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
        if (rows) rows.forEach(r => { mapped[r.player_name] = { ...r } })
        setData(mapped)
        setLoading(false)
      })
  }, [match])

  const get = (name, field) => {
    const v = data[name]?.[field]
    return (v === null || v === undefined) ? '' : String(v)
  }

  const set = (name, field, val) => {
    setData(prev => ({ ...prev, [name]: { ...(prev[name] || {}), [field]: val } }))
  }

  const save = async () => {
    if (!match) { setStatus({ type: 'error', message: 'Select a match first' }); return }
    setSaving(true); setStatus(null)

    const upserts = players
      .filter(p => get(p.name, 'total_minutes') !== '' || ALL_COLS.some(c => get(p.name, c.key) !== ''))
      .map(p => {
        const row = { match_id: match, player_name: p.name }
        ALL_COLS.forEach(c => {
          const v = get(p.name, c.key)
          row[c.key] = v === '' ? null : parseFloat(v)
        })
        return row
      })

    if (!upserts.length) {
      setSaving(false)
      setStatus({ type: 'error', message: 'No data to save' })
      return
    }

    const { error } = await supabase.from('player_stats').upsert(upserts, { onConflict: 'match_id,player_name' })
    setSaving(false)
    if (error) setStatus({ type: 'error', message: 'Error: ' + error.message })
    else setStatus({ type: 'success', message: `✓ Saved ${upserts.length} players for ${match}` })
  }

  const sorted = [...players].sort((a, b) => {
    const o = { Goalkeeper: 0, Defender: 1, Midfield: 2, Forward: 3 }
    return (o[a.position] || 0) - (o[b.position] || 0)
  })

  return (
    <div>
      {/* Match selector */}
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

      {status && (
        <div style={{
          padding: '9px 13px', borderRadius: 8, marginBottom: 11,
          background: status.type === 'success' ? 'rgba(62,207,142,0.1)' : 'rgba(240,96,96,0.1)',
          border: `1px solid ${status.type === 'success' ? 'var(--teal)' : 'var(--red)'}`,
          color: status.type === 'success' ? 'var(--teal)' : 'var(--red)', fontSize: 13,
        }}>{status.message}</div>
      )}

      {!match ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Select a match to begin</div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 80 }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', width: '100%' }}>
            <thead>
              {/* Group header row */}
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ ...thStyle, minWidth: 130, position: 'sticky', left: 0, background: 'var(--bg3)', zIndex: 2 }}>Player</th>
                {COL_GROUPS.map(g => (
                  <th key={g.label} colSpan={g.cols.length}
                    style={{ ...thStyle, color: g.color, borderLeft: '2px solid var(--border)', textAlign: 'center', letterSpacing: 1 }}>
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* Column header row */}
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ ...thStyle, position: 'sticky', left: 0, background: 'var(--bg3)', zIndex: 2 }} />
                {COL_GROUPS.map(g => g.cols.map((c, ci) => (
                  <th key={c.key} style={{
                    ...thStyle, color: 'var(--text2)', fontWeight: 400,
                    borderLeft: ci === 0 ? '2px solid var(--border)' : '1px solid rgba(26,51,86,0.3)',
                    minWidth: 44,
                  }}>{c.label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const pc = POS_COLORS[p.position] || 'var(--text2)'
                return (
                  <tr key={p.name} style={{ background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)' }}>
                    <td style={{ ...tdStyle, position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', zIndex: 1, minWidth: 130 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 9, color: pc }}>{p.position}</div>
                    </td>
                    {COL_GROUPS.map(g => g.cols.map((c, ci) => {
                      const val = get(p.name, c.key)
                      const hasVal = val !== '' && val !== '0'
                      return (
                        <td key={c.key} style={{
                          ...tdStyle,
                          borderLeft: ci === 0 ? '2px solid var(--border)' : '1px solid rgba(26,51,86,0.2)',
                          padding: '3px 2px',
                        }}>
                          <input
                            type="number"
                            value={val}
                            onChange={e => set(p.name, c.key, e.target.value)}
                            step={g.decimal ? '0.01' : '1'}
                            min="0"
                            style={{
                              width: 42, padding: '4px 2px', textAlign: 'center',
                              background: hasVal ? 'rgba(255,255,255,0.05)' : 'transparent',
                              border: `1px solid ${hasVal ? g.color : 'rgba(26,51,86,0.3)'}`,
                              borderRadius: 4,
                              color: hasVal ? g.color : 'var(--text3)',
                              fontSize: 12, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
                              outline: 'none',
                            }}
                          />
                        </td>
                      )
                    }))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky save */}
      {match && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '10px 14px', zIndex: 50 }}>
          <button onClick={save} disabled={saving} style={{
            width: '100%', maxWidth: 480, display: 'block', margin: '0 auto',
            padding: '13px', borderRadius: 10,
            background: saving ? 'var(--bg3)' : 'rgba(62,207,142,0.12)',
            border: `1px solid ${saving ? 'var(--border)' : 'var(--teal)'}`,
            color: saving ? 'var(--text3)' : 'var(--teal)',
            fontSize: 14, fontWeight: 700, fontFamily: 'Barlow, sans-serif',
            cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: 1,
          }}>{saving ? 'Saving...' : `Save All — ${match}`}</button>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  padding: '6px 8px', fontSize: 10, fontWeight: 700,
  letterSpacing: 0.5, textTransform: 'uppercase',
  color: 'var(--text3)', textAlign: 'center',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}
const tdStyle = {
  padding: '4px 4px', verticalAlign: 'middle',
  borderBottom: '1px solid rgba(26,51,86,0.2)',
}
