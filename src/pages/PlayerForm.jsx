import { useState, useMemo } from 'react'
import Avatar from '../components/Avatar'
import { MATCHES, OPP, POS_COLORS, n, r1, pct, sf, impactColor } from '../lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// ─── PLAYER FORM TAB ──────────────────────────────────────────────────────────
// Coach-facing version of the player's "Impact Trend" chart: pick any player,
// toggle any metric, and see it tracked match-by-match. Data comes straight from
// the `allStats` / `players` already loaded by CoachDashboard — no extra queries.

// kind:
//  'impact'  → numeric impact column, supports /60
//  'count'   → raw counting column, supports /60
//  'derived' → computed per-match value (points / KO wins), supports /60
//  'ratio'   → already a percentage (shooting %), plotted on its own right axis, no /60
const FORM_METRICS = {
  total_impact:        { label: 'Total Impact', color: '#a78bfa', kind: 'impact' },
  attack_impact:       { label: 'Attack',       color: '#f0b429', kind: 'impact' },
  transition_impact:   { label: 'Transition',   color: '#4a9eff', kind: 'impact' },
  defensive_impact:    { label: 'Defence',      color: '#3ecf8e', kind: 'impact' },
  points:              { label: 'Points',       color: '#f0b429', kind: 'derived' },
  shoot_pct:           { label: 'Shooting %',   color: '#3ecf8e', kind: 'ratio'  },
  tackles:             { label: 'Tackles',      color: '#4a9eff', kind: 'count'  },
  forced_to_win:       { label: 'Forced TO',    color: '#3ecf8e', kind: 'count'  },
  defensive_duels_won: { label: 'Duels Won',    color: '#a78bfa', kind: 'count'  },
  breach_1v1:          { label: 'Breach 1v1',   color: '#f06060', kind: 'count'  },
  dne:                 { label: 'DNE',          color: '#f06060', kind: 'count'  },
  simple_pass:         { label: 'Simple Pass',  color: '#4a9eff', kind: 'count'  },
  advance_pass:        { label: 'Adv Pass',     color: '#a78bfa', kind: 'count'  },
  carries:             { label: 'Carries',      color: '#3ecf8e', kind: 'count'  },
  our_ko_wins:         { label: 'Our KO Wins',  color: '#3ecf8e', kind: 'derived' },
  opp_ko_wins:         { label: 'Opp KO Wins',  color: '#4a9eff', kind: 'derived' },
}

const DEFAULT_ACTIVE = ['total_impact', 'attack_impact', 'transition_impact', 'defensive_impact']

// Per-match shooting (from-play attempt = scored + wide + drop-short; frees use stored _attempts_f)
const matchAtt = r =>
  n(r.one_pointer_scored) + n(r.one_pointer_wide) + n(r.one_pointer_drop_short_block) +
  n(r.two_pointer_scored) + n(r.two_pointer_wide) + n(r.two_pointer_drop_short_block) +
  n(r.goals_scored)       + n(r.goals_wide)       + n(r.goal_drop_short_block) +
  n(r.one_pointer_attempts_f) + n(r.two_pointer_attempts_f) + n(r.goal_attempts_f)
const matchScr = r =>
  n(r.one_pointer_scored) + n(r.one_pointer_scored_f) +
  n(r.two_pointer_scored) + n(r.two_pointer_scored_f) +
  n(r.goals_scored)       + n(r.goals_scored_f)
const matchPts = r =>
  n(r.one_pointer_scored) + n(r.one_pointer_scored_f) +
  (n(r.two_pointer_scored) + n(r.two_pointer_scored_f)) * 2 +
  (n(r.goals_scored)       + n(r.goals_scored_f)) * 3
const matchOurKO = r => n(r.won_clean_p1_our) + n(r.won_clean_p2_our) + n(r.won_clean_p3_our) + n(r.won_break_our)
const matchOppKO = r => n(r.won_clean_p1_opp) + n(r.won_clean_p2_opp) + n(r.won_clean_p3_opp) + n(r.won_break_opp)

// Raw per-match base value for a metric (before /60 normalisation)
function baseValue(r, key) {
  switch (key) {
    case 'points':       return matchPts(r)
    case 'our_ko_wins':  return matchOurKO(r)
    case 'opp_ko_wins':  return matchOppKO(r)
    case 'shoot_pct': {
      const att = matchAtt(r)
      return att > 0 ? pct(matchScr(r), att) : null   // null → line breaks on no-shot games
    }
    default:             return n(r[key])
  }
}

// Final plotted value, honouring the raw vs /60 mode. Returns null where it can't be shown.
function metricValue(r, key, mode) {
  if (!r) return null
  const m = FORM_METRICS[key]
  const base = baseValue(r, key)
  if (base === null) return null
  if (m.kind === 'ratio') return base               // % is already a rate — mode doesn't apply
  if (mode === 'p60') {
    const mins = n(r.total_minutes)
    return mins > 0 ? r1(base / mins * 60) : null
  }
  return r1(base)
}

export default function PlayerForm({ allStats = [], players = [] }) {
  const [selectedName, setSelectedName] = useState('')
  const [posFilter, setPosFilter] = useState('All')
  const [active, setActive] = useState(DEFAULT_ACTIVE)
  const [mode, setMode] = useState('raw')   // 'raw' = per-match value · 'p60' = per-60-min rate

  // Position filter options, in the order positions first appear
  const positions = useMemo(() => {
    const seen = []
    players.forEach(p => { if (p.position && !seen.includes(p.position)) seen.push(p.position) })
    return ['All', ...seen]
  }, [players])

  const filteredPlayers = useMemo(() => {
    return players
      .filter(p => posFilter === 'All' || p.position === posFilter)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [players, posFilter])

  const player = players.find(p => p.name === selectedName) || null
  const posColor = player ? (POS_COLORS[player.position] || 'var(--text2)') : 'var(--text2)'

  // Every match row for this player (one row per match they were in the squad for)
  const playerRows = useMemo(
    () => (selectedName ? allStats.filter(r => r.player_name === selectedName) : []),
    [allStats, selectedName]
  )
  const playedMc = [...new Set(playerRows.filter(r => n(r.total_minutes) > 0).map(r => r.match_id))].length
  const totalMins = playerRows.reduce((s, r) => s + n(r.total_minutes), 0)

  // Chart data: one point per match in season order, every metric pre-computed so
  // toggling lines on/off is instant. Missing match → null (line breaks, no DNP dip).
  const data = useMemo(() => MATCHES.map(m => {
    const r = playerRows.find(row => row.match_id === m)
    const point = { match: m.replace('AFL ', 'G'), _full: m, _opp: OPP[m] }
    Object.keys(FORM_METRICS).forEach(key => { point[key] = metricValue(r, key, mode) })
    return point
  }), [playerRows, mode])

  const toggle = key => setActive(a => a.includes(key) ? a.filter(k => k !== key) : [...a, key])
  const showPct = active.includes('shoot_pct')
  const activeOrdered = Object.keys(FORM_METRICS).filter(k => active.includes(k))

  return (
    <div className="fade-in">
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
        Player Form — Match-by-Match Tracker
      </div>

      {/* Position filter + player picker */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 10, scrollbarWidth: 'none' }}>
        {positions.map(p => (
          <button key={p} className={`pill${posFilter === p ? ' active' : ''}`}
            onClick={() => { setPosFilter(p); if (player && p !== 'All' && player.position !== p) setSelectedName('') }}>
            {p}
          </button>
        ))}
      </div>

      <select value={selectedName} onChange={e => setSelectedName(e.target.value)}
        style={{ width: '100%', padding: '11px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 15, fontFamily: 'Barlow, sans-serif', outline: 'none', marginBottom: 14 }}>
        <option value="">Select a player…</option>
        {filteredPlayers.map(p => (
          <option key={p.name} value={p.name}>{p.name}{p.position ? ` · ${p.position}` : ''}</option>
        ))}
      </select>

      {!selectedName && (
        <div className="card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Pick a player above to see their form across the season.
        </div>
      )}

      {selectedName && playerRows.length === 0 && (
        <div className="card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No match data recorded for {selectedName} yet.
        </div>
      )}

      {selectedName && playerRows.length > 0 && (
        <>
          {/* Player header */}
          <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={selectedName} size={48} photoUrl={player?.photo_url} />
              <div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{selectedName}</div>
                <div style={{ fontSize: 10, color: posColor, marginTop: 4 }}>
                  {player?.position || '—'} · {playedMc} games · {totalMins} mins
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['raw', 'Per game'], ['p60', '/60']].map(([mKey, mLabel]) => (
                <button key={mKey} onClick={() => setMode(mKey)}
                  style={{ padding: '4px 9px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', border: `1px solid ${mode === mKey ? 'var(--blue)' : 'var(--border)'}`, background: mode === mKey ? 'rgba(74,158,255,0.12)' : 'transparent', color: mode === mKey ? 'var(--blue)' : 'var(--text3)' }}>
                  {mLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Metric toggles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {Object.entries(FORM_METRICS).map(([key, m]) => {
              const on = active.includes(key)
              return (
                <button key={key} onClick={() => toggle(key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', letterSpacing: 0.3, border: `1px solid ${on ? m.color : 'var(--border)'}`, background: on ? `${m.color}1a` : 'var(--bg3)', color: on ? m.color : 'var(--text3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: on ? m.color : 'var(--border2)' }} />
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Trend chart */}
          <div className="card" style={{ padding: 13, marginBottom: 13 }}>
            {activeOrdered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '40px 0' }}>
                Select at least one metric to plot.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data} margin={{ top: 8, right: showPct ? 4 : 6, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,51,86,0.5)" />
                  <XAxis dataKey="match" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
                  <YAxis yAxisId="main" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
                  {showPct && (
                    <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fill: 'var(--text3)', fontSize: 10 }} width={30} />
                  )}
                  <Tooltip
                    contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                    labelFormatter={(lbl, payload) => {
                      const opp = payload && payload[0] && payload[0].payload._opp
                      return opp ? `${lbl} · ${opp}` : lbl
                    }}
                    formatter={(val, name, item) => [item.dataKey === 'shoot_pct' ? `${val}%` : val, name]}
                  />
                  {activeOrdered.map(key => {
                    const m = FORM_METRICS[key]
                    return (
                      <Line key={key}
                        yAxisId={m.kind === 'ratio' ? 'pct' : 'main'}
                        type="monotone" dataKey={key} name={m.label}
                        stroke={m.color}
                        strokeWidth={key === 'total_impact' ? 2.5 : 1.5}
                        strokeDasharray={m.kind === 'ratio' ? '4 3' : undefined}
                        dot={{ r: key === 'total_impact' ? 4 : 3 }}
                        connectNulls={false} />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
            {showPct && (
              <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>
                Shooting % uses the right-hand axis (0–100). Other metrics use the left axis.
              </div>
            )}
          </div>

          {/* Per-match table for the active metrics */}
          {activeOrdered.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header">Match Detail · {mode === 'p60' ? 'per 60 min' : 'per game'}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
                  <thead>
                    <tr>
                      <th style={{ ...fth, textAlign: 'left' }}>Match</th>
                      {activeOrdered.map(key => (
                        <th key={key} style={{ ...fth, color: FORM_METRICS[key].color }}>{FORM_METRICS[key].label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MATCHES.map((m, i) => {
                      const r = playerRows.find(row => row.match_id === m)
                      return (
                        <tr key={m} style={{ background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderTop: '1px solid rgba(26,51,86,0.2)' }}>
                          <td style={{ ...ftd, textAlign: 'left' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{m}</div>
                            <div style={{ fontSize: 9, color: 'var(--text3)' }}>{OPP[m]}</div>
                          </td>
                          {activeOrdered.map(key => {
                            const v = metricValue(r, key, mode)
                            const isRatio = FORM_METRICS[key].kind === 'ratio'
                            const display = v === null
                              ? (r ? '—' : 'DNP')
                              : isRatio ? `${v}%` : (v > 0 ? v : '—')
                            const col = v && v > 0 ? FORM_METRICS[key].color : 'var(--text3)'
                            return (
                              <td key={key} style={{ ...ftd, color: col, fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700 }}>
                                {display}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const fth = { padding: '7px 8px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const ftd = { padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle' }
