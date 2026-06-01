import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { n, r1, sf } from '../lib/utils'

// ─── PERFORMANCE REVIEW (player self-review, 2–3 windows per season) ───────────
// Mirrors PlayerReflection: players submit once per open review window, can edit
// until the coach closes it. Five areas, each a 1–5 rating + a "why", with a
// helper that shows the player's OWN season numbers behind each area so the
// rating is grounded in metrics rather than a gut feel.

const TOPICS = [
  { key: 'def',      title: 'Defence',     color: '#4a9eff', category: 'defence' },
  { key: 'att',      title: 'Attack',      color: '#f0b429', category: 'attack' },
  { key: 'trans',    title: 'Transition',  color: '#3ecf8e', category: 'transition' },
  { key: 'overall',  title: 'Overall',     color: '#a78bfa', category: 'overall' },
  { key: 'offfield', title: 'Off-Field Prep & Leadership', color: '#f0b429', category: null },
]

// Human labels for every metric in impact_weights
const METRIC_LABELS = {
  assists_2pt: '2pt Assists', assists_goals: 'Goal Assists', assists_shots: 'Shot Assists',
  goals_scored: 'Goals', goals_scored_f: 'Goals (free)', goals_wide: 'Goals Wide',
  one_pointer_scored: '1pt Scored', one_pointer_scored_f: '1pt Scored (free)', one_pointer_wide: '1pt Wide',
  two_pointer_scored: '2pt Scored', two_pointer_scored_f: '2pt Scored (free)', two_pointer_wide: '2pt Wide',
  black: 'Black Card', breach_1v1: 'Breach 1v1', defensive_duels_won: 'Duels Won', dne: 'DNE',
  duels_contested: 'Duels Contested', duels_lost: 'Duels Lost', forced_to_win: 'Forced TO Won',
  free_conceded: 'Frees Conceded', kickaway_to_received: 'Kickaway TO Won', red: 'Red Card',
  shot_free_conceded: 'Scoreable Free Conceded', shots_conceded: 'Goals Conceded', shots_saved: 'Saves',
  tackles: 'Tackles', their_ko_contest_opp: 'Opp-KO Contest Lost', their_ko_contest_us: 'Opp-KO Contest Won',
  two_pt_free_conceded: '2pt Free Conceded', won_clean_p1_opp: 'Opp-KO Clean', won_clean_p2_opp: 'Opp-KO Clean (P2)',
  won_clean_p3_opp: 'Opp-KO Clean (P3)', yellow: 'Yellow Card',
  acceptable_turnovers: 'Acceptable TOs', advance_pass: 'Advance Pass', advance_receive: 'Advance Receive',
  carries: 'Carries', drop_shorts: 'Drop Shorts', goalie_ko_clean_wins: 'GK KO Clean Wins',
  ko_target_lost_clean: 'KO Target Lost Clean', ko_target_lost_contest: 'KO Target Lost Contest',
  ko_target_won_break: 'KO Target Won Break', ko_target_won_clean: 'KO Target Won Clean',
  our_ko_contest_opp: 'Our-KO Contest Lost', our_ko_contest_us: 'Our-KO Contest Won',
  simple_pass: 'Simple Pass', simple_receive: 'Simple Receive', turnover_skill_error: 'Skill-Error TO',
  turnovers_in_contact: 'Contact TO', turnovers_kicked_away: 'Kickaway TO Lost',
  won_break_opp: 'Opp-KO Break Won', won_break_our: 'Our-KO Break Won',
  won_clean_p1_our: 'Our-KO Clean', won_clean_p2_our: 'Our-KO Clean (P2)', won_clean_p3_our: 'Our-KO Clean (P3)',
}

const labelFor = m => METRIC_LABELS[m] || m.replace(/_/g, ' ')

const OFFFIELD_PROMPTS = [
  'Training attendance & punctuality',
  'Gym / S&C and recovery work',
  'Nutrition, hydration & sleep',
  'Communication and standards in the group',
  'Supporting teammates & leadership on and off the pitch',
  'Attitude and response to setbacks',
]

export default function PerformanceReview({ player, stats = [] }) {
  const [windows, setWindows] = useState([])
  const [reviews, setReviews] = useState([])
  const [weights, setWeights] = useState([])
  const [ratings, setRatings] = useState({})   // { def: 4, att: 3, ... }
  const [whys, setWhys] = useState({})          // { def: '…', ... }
  const [expanded, setExpanded] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('review_windows').select('*').order('id', { ascending: false }),
      supabase.from('performance_reviews').select('*').eq('player_name', player.name),
      supabase.from('impact_weights').select('metric_name, weight, category'),
    ]).then(([{ data: w }, { data: r }, { data: iw }]) => {
      setWindows(w || [])
      setReviews(r || [])
      setWeights(iw || [])
      setLoading(false)
    })
  }, [player.name])

  const activeWindow = windows.find(w => w.is_open) || null
  const existing = activeWindow ? reviews.find(r => r.window_id === activeWindow.id) : null

  // Prefill from existing submission whenever the active window / data loads
  useEffect(() => {
    if (!existing) { setRatings({}); setWhys({}); return }
    const rt = {}, wh = {}
    TOPICS.forEach(t => { rt[t.key] = existing[`${t.key}_rating`] || 0; wh[t.key] = existing[`${t.key}_why`] || '' })
    setRatings(rt); setWhys(wh)
  }, [existing])

  // Season total for a single metric across this player's published matches
  const seasonTotal = metric => sf(stats, metric)

  // Build the "what feeds this" helper for an area
  const contributorsFor = category => {
    const rows = weights
      .filter(w => w.category === category)
      .map(w => ({ metric: w.metric_name, weight: n(w.weight), total: seasonTotal(w.metric_name) }))
    const lifts = rows.filter(r => r.weight > 0 && r.total !== 0).sort((a, b) => b.weight * b.total - a.weight * a.total).slice(0, 6)
    const costs = rows.filter(r => r.weight < 0 && r.total !== 0).sort((a, b) => a.weight * a.total - b.weight * b.total).slice(0, 4)
    return { lifts, costs, any: rows.some(r => r.total !== 0) }
  }

  // Overall = combined area scores (Σ weight × season total per category)
  const categoryScore = category =>
    r1(weights.filter(w => w.category === category).reduce((s, w) => s + n(w.weight) * seasonTotal(w.metric_name), 0))

  const setRating = (k, v) => { setRatings(r => ({ ...r, [k]: v })); setSavedMsg('') }
  const setWhy = (k, v) => { setWhys(w => ({ ...w, [k]: v })); setSavedMsg('') }

  const handleSave = async () => {
    if (!activeWindow) return
    setSaving(true)
    const row = { player_name: player.name, window_id: activeWindow.id, window_label: activeWindow.label, seen_by_coach: false, updated_at: new Date().toISOString() }
    TOPICS.forEach(t => { row[`${t.key}_rating`] = ratings[t.key] || null; row[`${t.key}_why`] = (whys[t.key] || '').trim() || null })
    const { data, error } = await supabase.from('performance_reviews')
      .upsert(row, { onConflict: 'player_name,window_id' }).select().single()
    setSaving(false)
    if (!error && data) {
      setReviews(prev => [...prev.filter(r => r.window_id !== activeWindow.id), data])
      setSavedMsg('Saved ✓ Your coach has been notified.')
    }
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>

  const pastReviews = reviews
    .filter(r => !activeWindow || r.window_id !== activeWindow.id)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 4 }}>
          Performance Review
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Rate yourself 1–5 in each area and explain why, using your numbers as evidence.</div>
      </div>

      {!activeWindow && (
        <div className="card" style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
          There's no review window open right now. Your coach will open the next one when it's time.
        </div>
      )}

      {activeWindow && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 14, border: '1px solid var(--purple)' }}>
            <div style={{ fontSize: 10, color: 'var(--purple)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Open Now</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{activeWindow.label}</div>
            {existing && <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 4 }}>✓ Submitted — you can still update it until the window closes</div>}
          </div>

          {TOPICS.map(topic => {
            const isOpen = expanded === topic.key
            const helper = topic.category && topic.category !== 'overall' ? contributorsFor(topic.category) : null
            return (
              <div key={topic.key} className="card" style={{ padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800, color: topic.color }}>{topic.title}</div>
                  {topic.category && (
                    <button onClick={() => setExpanded(isOpen ? null : topic.key)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0 }}>
                      {isOpen ? '▲ Hide my numbers' : '▾ What feeds this'}
                    </button>
                  )}
                </div>

                {/* 1–5 rating */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map(v => {
                    const on = (ratings[topic.key] || 0) === v
                    return (
                      <button key={v} onClick={() => setRating(topic.key, v)}
                        style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif', border: `1px solid ${on ? topic.color : 'var(--border)'}`, background: on ? topic.color : 'var(--bg3)', color: on ? '#0a1628' : 'var(--text3)' }}>
                        {v}
                      </button>
                    )
                  })}
                </div>

                {/* Helper: this player's own numbers */}
                {isOpen && topic.category === 'overall' && (
                  <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Your season impact by area</div>
                    {[['attack', 'Attack', '#f0b429'], ['transition', 'Transition', '#3ecf8e'], ['defence', 'Defence', '#4a9eff']].map(([cat, lab, col]) => (
                      <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                        <span style={{ color: 'var(--text2)' }}>{lab}</span>
                        <span style={{ color: col, fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif', fontSize: 15 }}>{categoryScore(cat)}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>Your overall game is the balance across all three.</div>
                  </div>
                )}
                {isOpen && helper && (
                  <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                    {!helper.any && (
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Your numbers here will appear once your match stats are published.</div>
                    )}
                    {helper.lifts.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Lifts your score</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: helper.costs.length ? 10 : 0 }}>
                          {helper.lifts.map(l => (
                            <span key={l.metric} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 7, background: 'rgba(62,207,142,0.12)', color: 'var(--teal)' }}>
                              {labelFor(l.metric)} · <b>{l.total}</b>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                    {helper.costs.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Costs your score</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {helper.costs.map(c => (
                            <span key={c.metric} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 7, background: 'rgba(240,96,96,0.12)', color: 'var(--red)' }}>
                              {labelFor(c.metric)} · <b>{c.total}</b>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {isOpen && topic.category === null && (
                  <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Think about</div>
                    {OFFFIELD_PROMPTS.map((p, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '2px 0' }}>· {p}</div>
                    ))}
                  </div>
                )}

                {/* Why */}
                <textarea
                  value={whys[topic.key] || ''}
                  onChange={e => setWhy(topic.key, e.target.value)}
                  placeholder={topic.category === null
                    ? 'Why this rating? What are you doing well off the pitch, and what will you improve?'
                    : 'Why this rating? Back it up with your numbers above…'}
                  rows={3}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                />
              </div>
            )
          })}

          {savedMsg && <div style={{ fontSize: 12, color: 'var(--teal)', textAlign: 'center', marginBottom: 10 }}>{savedMsg}</div>}

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', padding: 13, borderRadius: 8, background: 'var(--purple)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', marginBottom: 18 }}>
            {saving ? 'Saving…' : existing ? 'Update Review' : 'Submit Review'}
          </button>
        </>
      )}

      {/* Past reviews (read-only) */}
      {pastReviews.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Previous Reviews</div>
          {pastReviews.map(r => (
            <div key={r.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{r.window_label || `Window ${r.window_id}`}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TOPICS.map(t => r[`${t.key}_rating`] ? (
                  <span key={t.key} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 7, background: 'var(--bg3)', color: t.color }}>
                    {t.title.split(' ')[0]} · <b>{r[`${t.key}_rating`]}/5</b>
                  </span>
                ) : null)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
