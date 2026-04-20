// Player-facing Challenges tab.
// Submit up to 2 per match. View history with status + admin notes.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES } from '../lib/utils'

// ── Stat catalogue ───────────────────────────────────────────────────────
// Grouped for the submit dropdown. Label shown to player, column written to DB.
const STAT_GROUPS = [
  {
    label: 'Attack', color: 'var(--gold)', items: [
      ['one_pointer_scored',   '1-Pointer Scored'],
      ['two_pointer_scored',   '2-Pointer Scored'],
      ['goals_scored',         'Goal Scored'],
      ['one_pointer_scored_f', '1-Pointer Scored (Free)'],
      ['two_pointer_scored_f', '2-Pointer Scored (Free)'],
      ['goals_scored_f',       'Goal Scored (Free)'],
      ['one_pointer_wide',     '1-Pointer Wide'],
      ['two_pointer_wide',     '2-Pointer Wide'],
      ['goals_wide',           'Goal Wide'],
    ]
  },
  {
    label: 'Transition', color: 'var(--blue)', items: [
      ['simple_pass',           'Simple Pass'],
      ['advance_pass',          'Advance Pass'],
      ['simple_receive',        'Simple Receive'],
      ['advance_receive',       'Advance Receive'],
      ['carries',               'Carry'],
      ['kickaway_to_received',  'Kickaway Received'],
      ['turnovers_kicked_away', 'Turnover (Kicked Away)'],
      ['turnovers_in_contact',  'Turnover In Contact'],
      ['turnover_skill_error',  'Turnover (Skill Error)'],
      ['drop_shorts',           'Drop Short'],
    ]
  },
  {
    label: 'Defence', color: 'var(--red)', items: [
      ['tackles',             'Tackle'],
      ['duels_contested',     'Duel Contested'],
      ['defensive_duels_won', 'Duel Won'],
      ['duels_lost',          'Duel Lost'],
      ['breach_1v1',          '1v1 Breach'],
      ['dne',                 'DNE'],
      ['forced_to_win',       'Forced Turnover Won'],
      ['free_conceded',       'Free Conceded'],
      ['shot_free_conceded',  'Shot Free Conceded'],
    ]
  },
  {
    label: 'Kickouts', color: 'var(--teal)', items: [
      ['won_clean_p1_our',       'Our KO Won Clean (P1)'],
      ['won_clean_p2_our',       'Our KO Won Clean (P2)'],
      ['won_clean_p3_our',       'Our KO Won Clean (P3)'],
      ['won_break_our',          'Our KO Won Break'],
      ['our_ko_contest_opp',     'Our KO Contested (Opp Won)'],
      ['our_ko_contest_us',      'Our KO Contested (We Won)'],
      ['ko_target_won_clean',    'KO Target Won Clean'],
      ['ko_target_won_break',    'KO Target Won Break'],
      ['ko_target_lost_clean',   'KO Target Lost Clean'],
      ['ko_target_lost_contest', 'KO Target Lost Contest'],
    ]
  },
]

// Flat lookup: column -> display label
const COLUMN_LABELS = Object.fromEntries(
  STAT_GROUPS.flatMap(g => g.items)
)

const MAX_PER_MATCH = 2

// ── Submit form ──────────────────────────────────────────────────────────
function SubmitForm({ playerName, onSubmitted, existingByMatch }) {
  const [matchId, setMatchId]       = useState(MATCHES[0])
  const [statKey, setStatKey]       = useState('')    // 'col:two_pointer_scored' | 'other'
  const [otherLabel, setOtherLabel] = useState('')
  const [delta, setDelta]           = useState('')
  const [hudlUrl, setHudlUrl]       = useState('')
  const [playerNote, setPlayerNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  const usedForMatch = existingByMatch[matchId] || 0
  const atLimit = usedForMatch >= MAX_PER_MATCH

  const reset = () => {
    setStatKey(''); setOtherLabel(''); setDelta(''); setHudlUrl(''); setPlayerNote('')
  }

  const submit = async () => {
    setError(null)

    const d = parseInt(delta, 10)
    if (!statKey) return setError('Pick a stat')
    if (statKey === 'other' && !otherLabel.trim()) return setError('Describe the stat')
    if (isNaN(d) || d === 0) return setError('Delta must be a non-zero number')

    const row = {
      player_name: playerName,
      match_id: matchId,
      stat_column: statKey === 'other' ? null : statKey.replace('col:', ''),
      stat_label:  statKey === 'other' ? otherLabel.trim() : null,
      delta: d,
      hudl_url: hudlUrl.trim() || null,
      player_note: playerNote.trim() || null,
      status: 'pending',
    }

    setSubmitting(true)
    const { error: err } = await supabase.from('challenges').insert(row)
    setSubmitting(false)

    if (err) { setError(err.message); return }
    reset()
    onSubmitted()
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', background: 'var(--bg3)',
    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
    fontSize: 13, fontFamily: 'Barlow, sans-serif', outline: 'none'
  }
  const labelStyle = {
    fontSize: 10, color: 'var(--text3)', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 1
  }

  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div className="card-header" style={{ marginBottom: 12 }}>
        <span style={{ color: 'var(--gold)' }}>Submit a Challenge</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
          {usedForMatch}/{MAX_PER_MATCH} used for {matchId}
        </span>
      </div>

      {atLimit && (
        <div style={{ padding: '8px 11px', marginBottom: 10, borderRadius: 6,
          background: 'rgba(240,180,41,0.08)', border: '1px solid var(--gold-dim)',
          color: 'var(--gold)', fontSize: 11 }}>
          You've used both challenges for {matchId}. Pick a different match to submit another.
        </div>
      )}

      {/* Match */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Match</div>
        <select value={matchId} onChange={e => setMatchId(e.target.value)} style={inputStyle}>
          {MATCHES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Stat picker */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Stat</div>
        <select value={statKey} onChange={e => setStatKey(e.target.value)} style={inputStyle}
          disabled={atLimit}>
          <option value="">— pick a stat —</option>
          {STAT_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map(([col, label]) => (
                <option key={col} value={`col:${col}`}>{label}</option>
              ))}
            </optgroup>
          ))}
          <option value="other">Other…</option>
        </select>
      </div>

      {/* Other — free text label */}
      {statKey === 'other' && (
        <div style={{ marginBottom: 10 }}>
          <div style={labelStyle}>Describe the stat</div>
          <input value={otherLabel} onChange={e => setOtherLabel(e.target.value)}
            placeholder="e.g. interception" disabled={atLimit} style={inputStyle} />
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            Note: &quot;Other&quot; submissions are reviewed but won't auto-update your stats.
          </div>
        </div>
      )}

      {/* Delta */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Change (+ to add, − to remove)</div>
        <input value={delta} onChange={e => setDelta(e.target.value.replace(/[^0-9-]/g, ''))}
          placeholder="+2 or -1" disabled={atLimit} style={inputStyle} />
      </div>

      {/* Video timestamp */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Video Timestamp (optional)</div>
        <input value={hudlUrl} onChange={e => setHudlUrl(e.target.value)}
          placeholder="e.g. 12:34 or 1:02:15" disabled={atLimit} style={inputStyle} />
      </div>

      {/* Note */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>Note (optional)</div>
        <textarea value={playerNote} onChange={e => setPlayerNote(e.target.value)}
          rows={2} disabled={atLimit}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      {error && (
        <div style={{ padding: '7px 10px', marginBottom: 10, borderRadius: 6,
          background: 'rgba(240,96,96,0.1)', border: '1px solid var(--red)',
          color: 'var(--red)', fontSize: 12 }}>
          {error}
        </div>
      )}

      <button onClick={submit} disabled={submitting || atLimit}
        style={{ width: '100%', padding: '10px',
          background: atLimit ? 'var(--bg3)' : 'var(--gold-dim)',
          border: `1px solid ${atLimit ? 'var(--border)' : 'var(--gold)'}`,
          borderRadius: 8, color: atLimit ? 'var(--text3)' : 'var(--gold)',
          fontSize: 13, fontWeight: 600,
          cursor: submitting || atLimit ? 'not-allowed' : 'pointer',
          fontFamily: 'Barlow, sans-serif', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Submitting…' : '+ Submit Challenge'}
      </button>
    </div>
  )
}

// ── History row ──────────────────────────────────────────────────────────
function HistoryRow({ c }) {
  const statDisplay = c.stat_column ? COLUMN_LABELS[c.stat_column] || c.stat_column : c.stat_label
  const sign = c.delta > 0 ? '+' : ''
  const statusConfig = {
    pending:  { label: 'Pending',  color: 'var(--gold)' },
    approved: { label: 'Approved', color: 'var(--teal)' },
    rejected: { label: 'Rejected', color: 'var(--red)' },
  }[c.status]

  return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(26,51,86,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{c.match_id}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{statDisplay}</span>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 800,
              color: c.delta > 0 ? 'var(--teal)' : 'var(--red)' }}>
              {sign}{c.delta}
            </span>
          </div>
          {c.player_note && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
              &ldquo;{c.player_note}&rdquo;
            </div>
          )}
          {c.hudl_url && (
            <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 3 }}>
              @ {c.hudl_url}
            </div>
          )}
          {c.admin_note && c.status === 'rejected' && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, fontStyle: 'italic' }}>
              Reviewer: {c.admin_note}
            </div>
          )}
        </div>
        <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
          background: `${statusConfig.color}1a`, color: statusConfig.color,
          border: `1px solid ${statusConfig.color}`, whiteSpace: 'nowrap' }}>
          {statusConfig.label}
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────
export default function ChallengeTab({ player }) {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading]       = useState(true)

  const load = async () => {
    const { data } = await supabase.from('challenges')
      .select('*')
      .eq('player_name', player.name)
      .order('created_at', { ascending: false })
    setChallenges(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [player.name])

  // Mark reviewed decisions as viewed once this tab is open
  useEffect(() => {
    const unviewed = challenges.filter(c => c.status !== 'pending' && !c.viewed_at)
    if (unviewed.length === 0) return
    const ids = unviewed.map(c => c.id)
    supabase.from('challenges')
      .update({ viewed_at: new Date().toISOString() })
      .in('id', ids)
      .then(() => {
        setChallenges(prev => prev.map(c =>
          ids.includes(c.id) ? { ...c, viewed_at: new Date().toISOString() } : c
        ))
      })
  }, [challenges])

  // Count pending+approved per match for the submit-limit check
  const existingByMatch = {}
  challenges.forEach(c => {
    if (c.status === 'pending' || c.status === 'approved') {
      existingByMatch[c.match_id] = (existingByMatch[c.match_id] || 0) + 1
    }
  })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="fade-in">
      <SubmitForm playerName={player.name} existingByMatch={existingByMatch} onSubmitted={load} />

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <span style={{ color: 'var(--blue)' }}>Your Challenges ({challenges.length})</span>
        </div>
        {challenges.length === 0 ? (
          <div style={{ padding: '30px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            No challenges yet. Spot something in the data that doesn't match what you remember? Submit it above.
          </div>
        ) : (
          challenges.map(c => <HistoryRow key={c.id} c={c} />)
        )}
      </div>
    </div>
  )
}

// Exported for badge-count use in PlayerPortal.jsx if ever needed.
export { MAX_PER_MATCH }
