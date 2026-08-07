// Shared accountability-group view: for a chosen game, every group member's
// 3 goals (player_targets) with an auto-scored ✓/✗ from their stats. Used by the
// player (their groups), the coach (assigned groups), and admin (all groups).

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { OPP, matchRound } from '../lib/utils'

const METRIC_LABELS = {
  tackles: 'Tackles', forced_to_win: 'Forced TO Won', advance_pass: 'Advance Passes',
  simple_pass: 'Simple Passes', carries: 'Carries', dne: 'DNE', breach_1v1: '1v1 Breach',
  defensive_duels_won: 'Duels Won', one_pointer_scored: '1-Point Scores', two_pointer_scored: '2-Point Scores',
  goals_scored: 'Goals', drop_shorts: 'Drop Shorts', turnovers_in_contact: 'Contact TOs',
  turnovers_kicked_away: 'Kickaway TOs', ko_target_won_clean: 'KO Won Clean',
  won_break_our: 'Our KO Break', won_break_opp: 'Opp KO Break', assists_shots: 'Shot Assists',
}
const LOWER_IS_BETTER = new Set(['dne', 'breach_1v1', 'drop_shorts', 'turnovers_in_contact', 'turnovers_kicked_away'])
const num = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0)

export default function GroupGoals({ playerName, coachId, all, highlightName }) {
  const [state, setState] = useState(null)
  const [matchId, setMatchId] = useState(null)

  useEffect(() => {
    (async () => {
      const [{ data: gs }, { data: gm }] = await Promise.all([
        supabase.from('groups').select('*').order('created_at'),
        supabase.from('group_members').select('*'),
      ])
      const membersByGroup = {}
      ;(gm || []).forEach(r => { (membersByGroup[r.group_id] = membersByGroup[r.group_id] || []).push(r.player_name) })

      let groups = gs || []
      if (coachId) groups = groups.filter(g => g.coach_id === coachId)
      else if (playerName) groups = groups.filter(g => (membersByGroup[g.id] || []).includes(playerName))

      const memberNames = [...new Set(groups.flatMap(g => membersByGroup[g.id] || []))]
      const namesFilter = memberNames.length ? memberNames : ['__none__']
      const [{ data: tg }, { data: st }, { data: ms }, { data: sq }] = await Promise.all([
        supabase.from('player_targets').select('*').in('player_name', namesFilter),
        supabase.from('player_stats').select('*').in('player_name', namesFilter),
        supabase.from('matches').select('*'),
        supabase.from('matchday_squad').select('match_id, player_name, is_starter'),
      ])
      // Matches that have at least one target set among these members.
      const matchesWithGoals = [...new Set((tg || []).map(t => t.match_id))]
        .map(id => (ms || []).find(m => m.match_id === id) || { match_id: id })
        .sort((a, b) => matchRound(b.match_id) - matchRound(a.match_id))

      setState({ groups, membersByGroup, targets: tg || [], stats: st || [], matches: ms || [], squad: sq || [], matchesWithGoals })
      setMatchId(prev => prev || matchesWithGoals[0]?.match_id || null)
    })()
  }, [playerName, coachId, all])

  if (!state) return <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>
  const { groups, membersByGroup, targets, stats, matchesWithGoals } = state

  if (groups.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '24px 0' }}>
      {playerName ? "You're not in an accountability group yet — ask your coach." : 'No groups assigned.'}
    </div>
  }
  if (matchesWithGoals.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '24px 0' }}>No goals set for any game yet.</div>
  }

  const targetFor = (name) => targets.find(t => t.player_name === name && t.match_id === matchId)
  const statFor = (name) => stats.find(s => s.player_name === name && s.match_id === matchId)
  // Subs (is_starter === false) have their counting targets pro-rated to minutes played.
  const subSet = new Set((state.squad || []).filter(r => r.is_starter === false).map(r => `${r.match_id}|${r.player_name}`))

  const evalGoals = (name) => {
    const t = targetFor(name)
    if (!t) return { set: false, goals: [] }
    const s = statFor(name)
    const played = s && num(s.total_minutes) > 0
    const mins = played ? num(s.total_minutes) : 0
    const isSub = subSet.has(`${matchId}|${name}`)
    const goals = []
    for (let i = 1; i <= 3; i++) {
      const metric = t[`metric_${i}`], target = t[`target_${i}`]
      if (!metric || target == null) continue
      const lower = LOWER_IS_BETTER.has(metric)
      const rawTarget = num(target)
      const scaled = isSub && !lower && mins > 0 && mins < 60
      const effTarget = scaled ? Math.max(1, Math.round(rawTarget * mins / 60)) : rawTarget
      const actual = played ? num(s[metric]) : null
      const met = actual == null ? null : (lower ? actual <= effTarget : actual >= effTarget)
      goals.push({ label: METRIC_LABELS[metric] || metric, target: effTarget, rawTarget, scaled, actual, met, lower })
    }
    return { set: true, played, goals }
  }

  return (
    <div className="fade-in">
      {/* Match picker */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12, scrollbarWidth: 'none' }}>
        {matchesWithGoals.map(m => (
          <button key={m.match_id} onClick={() => setMatchId(m.match_id)} className={`pill${matchId === m.match_id ? ' active' : ''}`}>
            {m.match_id}
          </button>
        ))}
      </div>

      {groups.map(g => {
        const mem = (membersByGroup[g.id] || []).slice().sort((a, b) => a.localeCompare(b))
        return (
          <div key={g.id} className="card" style={{ overflow: 'hidden', marginBottom: 14 }}>
            <div className="card-header">
              <span style={{ color: 'var(--blue)' }}>{g.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{matchId} vs {OPP[matchId] || '—'}</span>
            </div>
            {mem.map(name => {
              const { set, played, goals } = evalGoals(name)
              const hit = goals.filter(x => x.met === true).length
              const me = name === highlightName
              return (
                <div key={name} style={{ padding: '10px 13px', borderTop: '1px solid rgba(26,51,86,0.25)', background: me ? 'rgba(74,158,255,0.08)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: goals.length ? 7 : 0 }}>
                    <div style={{ fontSize: 13, fontWeight: me ? 700 : 600, color: me ? 'var(--text)' : 'var(--text2)' }}>
                      {name}{me && <span style={{ fontSize: 9, color: 'var(--blue)', marginLeft: 6 }}>YOU</span>}
                    </div>
                    {set
                      ? (played
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: hit === goals.length ? 'var(--teal)' : hit > 0 ? 'var(--gold)' : 'var(--red)' }}>{hit}/{goals.length} hit</span>
                          : <span style={{ fontSize: 10, color: 'var(--text3)' }}>awaiting result</span>)
                      : <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>no goals set</span>}
                  </div>
                  {goals.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {goals.map((x, i) => {
                        const color = x.met == null ? 'var(--text3)' : x.met ? 'var(--teal)' : 'var(--red)'
                        return (
                          <span key={i} style={{ fontSize: 11, background: 'var(--bg3)', border: `1px solid ${x.met == null ? 'var(--border)' : color}`, borderRadius: 6, padding: '3px 8px', color: 'var(--text2)' }}>
                            {x.label} {x.lower ? '≤' : '≥'}{x.target}
                            {x.actual != null && <b style={{ color, marginLeft: 5 }}>{x.actual} {x.met ? '✓' : '✗'}</b>}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
