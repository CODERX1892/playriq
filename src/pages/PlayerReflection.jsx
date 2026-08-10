import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES, OPP, MATCH_DATA, matchRound } from '../lib/utils'
import GroupGoals from './GroupGoals'

// Counting targets — a number to hit.
const COUNT_OPTIONS = [
  { key: 'tackles', label: 'Tackles' },
  { key: 'forced_to_win', label: 'Forced TO Won' },
  { key: 'advance_pass', label: 'Advance Passes' },
  { key: 'simple_pass', label: 'Simple Passes' },
  { key: 'carries', label: 'Carries' },
  { key: 'dne', label: 'DNE (target: 0)' },
  { key: 'breach_1v1', label: 'Breach 1v1 (target: 0)' },
  { key: 'defensive_duels_won', label: 'Duels Won' },
  { key: 'one_pointer_scored', label: '1-Point Scores' },
  { key: 'two_pointer_scored', label: '2-Point Scores' },
  { key: 'goals_scored', label: 'Goals' },
  { key: 'drop_shorts', label: 'Drop Shorts (target: 0)' },
  { key: 'turnovers_in_contact', label: 'Contact TOs (target: 0)' },
  { key: 'turnovers_kicked_away', label: 'Kickaway TOs (target: 0)' },
  { key: 'ko_target_won_clean', label: 'Kickouts Won Clean (for + against)' },
  { key: 'won_break_our', label: 'Our KO Break Ball' },
  { key: 'won_break_opp', label: 'Opp KO Break Ball' },
  { key: 'assists_shots', label: 'Shot Assists' },
]
// Percentage targets — a % to hit, scored from the game's shots/kickouts.
// Formulas mirror src/lib/playerMetrics.js so a goal % matches the leaderboards.
const PCT_OPTIONS = [
  { key: 'pct_1', label: '1-Pointer Shot %' },
  { key: 'pct_2', label: '2-Pointer Shot %' },
  { key: 'pct_goal', label: 'Goal Shot %' },
  { key: 'pct_ko_target', label: 'Kickout Win % (when targeted)' },
  { key: 'pct_gk_ko_clean', label: 'GK Kickout Won Clean %' },
  { key: 'pct_gk_ko_break', label: 'GK Kickout Break Won %' },
  { key: 'pct_1f', label: '1-Pt Free % (incl 45s)' },
  { key: 'pct_2f', label: '2-Pt Free %' },
  { key: 'pct_goalf', label: 'Goal Free %' },
]
const ALL_OPTIONS = [...COUNT_OPTIONS, ...PCT_OPTIONS]
const PCT_KEYS = new Set(PCT_OPTIONS.map(o => o.key))

export default function PlayerReflection({ player, stats }) {
  const [view, setView] = useState('list') // 'list' | 'reflection' | 'targets'
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [reflections, setReflections] = useState({})
  const [targets, setTargets] = useState({})
  const [comments, setComments] = useState([])
  const [assignedCoach, setAssignedCoach] = useState(null)
  const [coaches, setCoaches] = useState([])
  const [reports, setReports] = useState([])
  const [section, setSection] = useState('goals') // 'goals' | 'group' | 'reports'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('player_reflections').select('*').eq('player_name', player.name),
      supabase.from('player_targets').select('*').eq('player_name', player.name),
      supabase.from('coach_comments').select('*').eq('player_name', player.name),
      supabase.from('player_coach_assignments').select('*, app_users(name, role)').eq('player_name', player.name).maybeSingle(),
      supabase.from('app_users').select('id, name, role').in('role', ['coach', 'admin']),
      supabase.from('game_reports').select('*').eq('player_name', player.name),
    ]).then(([{ data: refs }, { data: tgts }, { data: cmts }, { data: asgn }, { data: chs }, { data: reps }]) => {
      const refMap = {}
      refs?.forEach(r => { refMap[r.match_id] = r })
      setReflections(refMap)
      const tgtMap = {}
      tgts?.forEach(t => { tgtMap[t.match_id] = t })
      setTargets(tgtMap)
      setComments(cmts || [])
      setAssignedCoach(asgn?.app_users || null)
      setCoaches(chs || [])
      setReports(reps || [])
      setLoading(false)
    })
  }, [player.name])

  const assignCoach = async (coachId) => {
    await supabase.from('player_coach_assignments').upsert({
      player_name: player.name,
      coach_id: coachId,
    }, { onConflict: 'player_name' })
    const coach = coaches.find(c => c.id === coachId)
    setAssignedCoach(coach)
  }

  // Get published matches that player has stats for
  const publishedMatches = MATCHES.filter(m => stats.some(s => s.match_id === m))

  // Next match today or later — compare by calendar day (slice to YYYY-MM-DD) so
  // the Set Targets card still shows ON match day, not only the day before.
  const todayStr = new Date().toISOString().slice(0, 10)
  const upcomingMatch = MATCH_DATA.find(m => m.match_date && String(m.match_date).slice(0, 10) >= todayStr)

  const unreadCount = comments.filter(c => !c.read_by_player).length

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>

  if (view === 'reflection' && selectedMatch) {
    return <ReflectionForm player={player} match={selectedMatch}
      existing={reflections[selectedMatch]}
      comments={comments.filter(c => c.match_id === selectedMatch && c.comment_type === 'reflection')}
      onSave={(r) => { setReflections(prev => ({ ...prev, [selectedMatch]: r })); setView('list') }}
      onBack={() => setView('list')} />
  }

  if (view === 'targets' && selectedMatch) {
    return <TargetsForm player={player} match={selectedMatch}
      existing={targets[selectedMatch]}
      comments={comments.filter(c => c.match_id === selectedMatch && c.comment_type === 'target')}
      onSave={(t) => { setTargets(prev => ({ ...prev, [selectedMatch]: t })); setView('list') }}
      onBack={() => setView('list')} />
  }

  const sectionTabs = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {[['goals', 'My Goals'], ['group', 'My Group'], ['reports', 'My Reports']].map(([k, l]) => (
        <button key={k} onClick={() => setSection(k)}
          style={{ flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif',
            border: `1px solid ${section === k ? 'var(--blue)' : 'var(--border)'}`,
            background: section === k ? 'rgba(74,158,255,0.14)' : 'var(--bg3)',
            color: section === k ? 'var(--blue)' : 'var(--text3)' }}>{l}</button>
      ))}
    </div>
  )

  if (section === 'group') return <div className="fade-in">{sectionTabs}<GroupGoals playerName={player.name} highlightName={player.name} /></div>
  if (section === 'reports') return <div className="fade-in">{sectionTabs}<ReportsList reports={reports} /></div>

  return (
    <div className="fade-in">
      {sectionTabs}
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--blue)', marginBottom: 4 }}>
          My Goals & Reflections
          {unreadCount > 0 && (
            <span style={{ marginLeft: 8, background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{unreadCount}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Track your work-ons and set targets for upcoming games</div>
      </div>

      {/* Coach assignment */}
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>My Coach</div>
        {assignedCoach ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{assignedCoach.name}</div>
              <div style={{ fontSize: 10, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 1 }}>{assignedCoach.role}</div>
            </div>
            <button onClick={() => setAssignedCoach(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
              Change
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Assign a coach to share your reflections and targets with</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {coaches.map(c => (
                <button key={c.id} onClick={() => assignCoach(c.id)}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.name}</span>
                  <span style={{ color: 'var(--blue)', fontSize: 10, textTransform: 'uppercase' }}>{c.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming match targets */}
      {upcomingMatch && (
        <div className="card" style={{ padding: 14, marginBottom: 14, border: '1px solid var(--blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--blue)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Next Match</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{upcomingMatch.opposition}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {new Date(upcomingMatch.match_date).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}{upcomingMatch.home_away} · {upcomingMatch.competition}
              </div>
            </div>
            {targets[upcomingMatch.match_id] && (
              <span style={{ fontSize: 10, color: 'var(--teal)', background: 'rgba(62,207,142,0.1)', borderRadius: 6, padding: '3px 8px' }}>Targets set ✓</span>
            )}
          </div>
          <button onClick={() => { setSelectedMatch(upcomingMatch.match_id); setView('targets') }}
            style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'rgba(74,158,255,0.12)', border: '1px solid var(--blue)', color: 'var(--blue)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
            {targets[upcomingMatch.match_id] ? 'Edit My Targets →' : 'Set My Targets →'}
          </button>
        </div>
      )}

      {/* Past match reflections */}
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Post-Match Reflections</div>
      {publishedMatches.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>No published matches yet</div>
      )}
      {[...publishedMatches].reverse().map(m => {
        const ref = reflections[m]
        const matchComments = comments.filter(c => c.match_id === m && c.comment_type === 'reflection')
        const unread = matchComments.filter(c => !c.read_by_player).length
        const matchInfo = MATCH_DATA.find(md => md.match_id === m)
        return (
          <div key={m} className="card" style={{ overflow: 'hidden', marginBottom: 10 }}
            onClick={() => { setSelectedMatch(m); setView('reflection') }}>
            <div style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.parentElement.style.borderColor = 'var(--blue)'}
              onMouseLeave={e => e.currentTarget.parentElement.style.borderColor = 'var(--border)'}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m} <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>vs {OPP[m]}</span></div>
                {matchInfo?.match_date && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                    {new Date(matchInfo.match_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
                {ref ? (
                  <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 4 }}>✓ Reflection submitted</div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>Tap to add reflection</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {unread > 0 && (
                  <span style={{ background: 'var(--red)', color: 'white', borderRadius: 10, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{unread}</span>
                )}
                {matchComments.length > 0 && unread === 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>💬 {matchComments.length}</span>
                )}
                <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── REFLECTION FORM ──────────────────────────────────────────────────────────
function ReflectionForm({ player, match, existing, comments, onSave, onBack }) {
  const [fields, setFields] = useState({
    work_on_1: existing?.work_on_1 || '',
    work_on_2: existing?.work_on_2 || '',
    work_on_3: existing?.work_on_3 || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { data, error } = await supabase.from('player_reflections').upsert({
      player_name: player.name,
      match_id: match,
      ...fields,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_name,match_id' }).select().single()
    setSaving(false)
    if (!error) onSave(data)
  }

  // Mark comments as read
  useEffect(() => {
    const unread = comments.filter(c => !c.read_by_player).map(c => c.id)
    if (unread.length) {
      supabase.from('coach_comments').update({ read_by_player: true }).in('id', unread)
    }
  }, [])

  return (
    <div className="fade-in">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0, marginBottom: 14 }}>
        ← Back
      </button>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Post-Match Reflection</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{match} vs {OPP[match]}</div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
        Looking at your numbers, what are you working on in training and how are you going about it?
      </div>

      {[1, 2, 3].map(i => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Work-on {i}</div>
          <textarea
            value={fields[`work_on_${i}`]}
            onChange={e => setFields(f => ({ ...f, [`work_on_${i}`]: e.target.value }))}
            placeholder={i === 1 ? 'e.g. Reducing drop shorts by working on shot selection in training...' : ''}
            rows={3}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
          />
        </div>
      ))}

      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--blue)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', marginBottom: 16 }}>
        {saving ? 'Saving…' : existing ? 'Update Reflection' : 'Submit Reflection'}
      </button>

      {/* Coach comments */}
      {comments.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header"><span style={{ color: 'var(--purple)' }}>Coach Feedback</span></div>
          {comments.map(c => (
            <div key={c.id} style={{ padding: '10px 14px', borderTop: '1px solid rgba(26,51,86,0.2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{c.coach_name} · {new Date(c.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{c.comment}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AI GAME REPORTS ──────────────────────────────────────────────────────────
function ReportsList({ reports }) {
  const sorted = [...(reports || [])].sort((a, b) => matchRound(b.match_id) - matchRound(a.match_id))
  if (!sorted.length) return (
    <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '24px 0', lineHeight: 1.5 }}>
      No game reports yet.<br />You'll get a PlayrIQ report by email after each game you set goals for.
    </div>
  )
  return (
    <div>
      {sorted.map(r => (
        <div key={r.id || r.match_id} className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{r.match_id} <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>vs {OPP[r.match_id] || ''}</span></div>
            <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 1, textTransform: 'uppercase' }}>PlayrIQ Report</div>
          </div>
          {Array.isArray(r.targets) && r.targets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {r.targets.map((g, i) => {
                const c = g.met == null ? 'var(--text3)' : g.met ? 'var(--teal)' : 'var(--red)'
                return (
                  <span key={i} style={{ fontSize: 11, background: 'var(--bg3)', border: `1px solid ${c}`, borderRadius: 6, padding: '3px 8px', color: 'var(--text2)' }}>
                    {g.label} {g.lower ? '≤' : '≥'}{g.target} <b style={{ color: c }}>{g.actual} {g.met ? '✓' : '✗'}</b>
                  </span>
                )
              })}
            </div>
          )}
          {String(r.report || '').split(/\n\s*\n/).map((p, i) => (
            <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text2)', margin: '0 0 10px' }}>{p}</p>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── TARGETS FORM ─────────────────────────────────────────────────────────────
function TargetsForm({ player, match, existing, comments, onSave, onBack }) {
  const [slots, setSlots] = useState([
    { metric: existing?.metric_1 || '', target: existing?.target_1 || '' },
    { metric: existing?.metric_2 || '', target: existing?.target_2 || '' },
    { metric: existing?.metric_3 || '', target: existing?.target_3 || '' },
  ])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { data, error } = await supabase.from('player_targets').upsert({
      player_name: player.name,
      match_id: match,
      metric_1: slots[0].metric || null,
      target_1: slots[0].target ? parseFloat(slots[0].target) : null,
      metric_2: slots[1].metric || null,
      target_2: slots[1].target ? parseFloat(slots[1].target) : null,
      metric_3: slots[2].metric || null,
      target_3: slots[2].target ? parseFloat(slots[2].target) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_name,match_id' }).select().single()
    setSaving(false)
    if (!error) onSave(data)
  }

  // Mark comments as read
  useEffect(() => {
    const unread = comments.filter(c => !c.read_by_player).map(c => c.id)
    if (unread.length) supabase.from('coach_comments').update({ read_by_player: true }).in('id', unread)
  }, [])

  const matchInfo = MATCH_DATA.find(m => m.match_id === match)

  return (
    <div className="fade-in">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0, marginBottom: 14 }}>
        ← Back
      </button>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Pre-Match Targets</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {match} vs {OPP[match]}
          {matchInfo?.match_date && ` · ${new Date(matchInfo.match_date).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' })}`}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
        Set 3 specific, measurable targets for this game. Pick a metric and a number you're aiming for.
      </div>

      {slots.map((slot, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Target {i + 1}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
            <select
              value={slot.metric}
              onChange={e => setSlots(s => s.map((sl, j) => j === i ? { ...sl, metric: e.target.value } : sl))}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: slot.metric ? 'var(--text)' : 'var(--text3)', fontSize: 12, fontFamily: 'Barlow, sans-serif' }}>
              <option value="">Select metric…</option>
              <optgroup label="Numbers">
                {COUNT_OPTIONS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </optgroup>
              <optgroup label="Percentages">
                {PCT_OPTIONS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </optgroup>
            </select>
            <input
              type="number"
              value={slot.target}
              onChange={e => setSlots(s => s.map((sl, j) => j === i ? { ...sl, target: e.target.value } : sl))}
              placeholder={PCT_KEYS.has(slot.metric) ? '%' : 'Target'}
              min="0"
              max={PCT_KEYS.has(slot.metric) ? '100' : undefined}
              step="1"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textAlign: 'center' }}
            />
          </div>
          {slot.metric && slot.target && (
            <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 4 }}>
              Target: {ALL_OPTIONS.find(m => m.key === slot.metric)?.label} {PCT_KEYS.has(slot.metric) ? `${slot.target}%` : `≥ ${slot.target}`}
            </div>
          )}
        </div>
      ))}

      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--blue)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', marginBottom: 16 }}>
        {saving ? 'Saving…' : existing ? 'Update Targets' : 'Set Targets'}
      </button>

      {/* Coach comments */}
      {comments.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header"><span style={{ color: 'var(--purple)' }}>Coach Feedback</span></div>
          {comments.map(c => (
            <div key={c.id} style={{ padding: '10px 14px', borderTop: '1px solid rgba(26,51,86,0.2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>{c.coach_name} · {new Date(c.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{c.comment}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
