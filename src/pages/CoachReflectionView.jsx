import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES, OPP, MATCH_DATA } from '../lib/utils'

const METRIC_LABELS = {
  tackles: 'Tackles', forced_to_win: 'Forced TO', advance_pass: 'Adv Passes',
  simple_pass: 'Simple Passes', carries: 'Carries', dne: 'DNE',
  breach_1v1: 'Breach 1v1', defensive_duels_won: 'Duels Won',
  one_pointer_scored: '1pt Scored', two_pointer_scored: '2pt Scored',
  goals_scored: 'Goals', drop_shorts: 'Drop Shorts',
  turnovers_in_contact: 'Contact TOs', turnovers_kicked_away: 'Kickaway TOs',
  ko_target_won_clean: 'KO Target Clean', won_break_our: 'Our KO Break',
  won_break_opp: 'Opp KO Break', assists_shots: 'Shot Assists',
}

export default function CoachReflectionView({ appUser, isAdmin }) {
  const [players, setPlayers] = useState([])
  const [reflections, setReflections] = useState([])
  const [targets, setTargets] = useState([])
  const [comments, setComments] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [commentType, setCommentType] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [matchFilter, setMatchFilter] = useState('all')

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('name, position'),
      supabase.from('player_reflections').select('*').order('submitted_at', { ascending: false }),
      supabase.from('player_targets').select('*').order('submitted_at', { ascending: false }),
      supabase.from('coach_comments').select('*').order('created_at', { ascending: false }),
      supabase.from('player_coach_assignments').select('player_name, coach_id, app_users(name)'),
    ]).then(([{ data: pls }, { data: refs }, { data: tgts }, { data: cmts }, { data: asgn }]) => {
      setPlayers(pls || [])
      setReflections(refs || [])
      setTargets(tgts || [])
      setComments(cmts || [])
      setAssignments(asgn || [])
      setLoading(false)
    })
  }, [])

  // Filter: admin sees all, coaches only see assigned players
  const visiblePlayers = isAdmin
    ? players.filter(p => reflections.some(r => r.player_name === p.name) || targets.some(t => t.player_name === p.name))
    : players.filter(p => assignments.some(a => a.player_name === p.name && a.coach_id === appUser.id))

  const filteredByMatch = matchFilter === 'all'
    ? visiblePlayers
    : visiblePlayers.filter(p =>
        reflections.some(r => r.player_name === p.name && r.match_id === matchFilter) ||
        targets.some(t => t.player_name === p.name && t.match_id === matchFilter)
      )

  const submitComment = async () => {
    if (!commentText.trim()) return
    setSaving(true)
    const { data } = await supabase.from('coach_comments').insert({
      coach_name: appUser.name,
      player_name: selectedPlayer,
      match_id: selectedMatch,
      comment_type: commentType,
      comment: commentText.trim(),
    }).select().single()
    if (data) setComments(prev => [data, ...prev])
    setCommentText('')
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>

  const unreadTotal = comments.filter(c => !c.read_by_player).length

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 4 }}>
          Player Reflections & Targets
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {isAdmin ? `All players · ` : `Assigned players · `}
          {filteredByMatch.length} with submissions
          {unreadTotal > 0 && <span style={{ marginLeft: 8, color: 'var(--red)' }}>{unreadTotal} new comments</span>}
        </div>
      </div>

      {/* Match filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 14, scrollbarWidth: 'none' }}>
        {['all', ...MATCHES].map(m => (
          <button key={m} onClick={() => setMatchFilter(m)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${m === matchFilter ? 'var(--purple)' : 'var(--border)'}`, background: m === matchFilter ? 'rgba(167,139,250,0.12)' : 'var(--bg2)', color: m === matchFilter ? 'var(--purple)' : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}>
            {m === 'all' ? 'All Matches' : m}
          </button>
        ))}
      </div>

      {filteredByMatch.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 12, color: 'var(--text3)' }}>
          {isAdmin ? 'No reflections or targets submitted yet' : 'No assigned players have submitted reflections yet'}
        </div>
      )}

      {filteredByMatch.map(p => {
        const playerRefs = reflections.filter(r => r.player_name === p.name && (matchFilter === 'all' || r.match_id === matchFilter))
        const playerTgts = targets.filter(t => t.player_name === p.name && (matchFilter === 'all' || t.match_id === matchFilter))
        const playerComments = comments.filter(c => c.player_name === p.name)
        const unread = playerComments.filter(c => !c.read_by_player).length
        const assignedTo = assignments.find(a => a.player_name === p.name)

        return (
          <div key={p.name} className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
            {/* Player header */}
            <div style={{ padding: '11px 14px', background: 'var(--bg3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>{p.position}</span>
                {assignedTo && isAdmin && (
                  <span style={{ fontSize: 10, color: 'var(--blue)', marginLeft: 8 }}>→ {assignedTo.app_users?.name}</span>
                )}
              </div>
              {unread > 0 && (
                <span style={{ background: 'var(--red)', color: 'white', borderRadius: 10, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{unread} new</span>
              )}
            </div>

            {/* Reflections */}
            {playerRefs.map(ref => {
              const refComments = playerComments.filter(c => c.match_id === ref.match_id && c.comment_type === 'reflection')
              const isExpanded = selectedPlayer === p.name && selectedMatch === ref.match_id && commentType === 'reflection'
              return (
                <div key={ref.id} style={{ borderTop: '1px solid rgba(26,51,86,0.2)' }}>
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>
                        {ref.match_id} Reflection
                        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>vs {OPP[ref.match_id]}</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {new Date(ref.submitted_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {[ref.work_on_1, ref.work_on_2, ref.work_on_3].filter(Boolean).map((w, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', minWidth: 16 }}>{i + 1}.</div>
                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{w}</div>
                      </div>
                    ))}
                    {/* Comments */}
                    {refComments.map(c => (
                      <div key={c.id} style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(167,139,250,0.08)', borderRadius: 7, borderLeft: '3px solid var(--purple)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{c.coach_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{c.comment}</div>
                      </div>
                    ))}
                    <button onClick={() => { setSelectedPlayer(p.name); setSelectedMatch(ref.match_id); setCommentType(isExpanded ? null : 'reflection') }}
                      style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--purple)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0 }}>
                      {isExpanded ? '▲ Cancel' : '+ Add Comment'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 14px 12px' }}>
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Add coaching feedback…"
                        rows={3}
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif', resize: 'none', boxSizing: 'border-box' }}
                      />
                      <button onClick={submitComment} disabled={saving}
                        style={{ marginTop: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--purple)', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                        {saving ? 'Sending…' : 'Send Comment'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Targets */}
            {playerTgts.map(tgt => {
              const tgtComments = playerComments.filter(c => c.match_id === tgt.match_id && c.comment_type === 'target')
              const isExpanded = selectedPlayer === p.name && selectedMatch === tgt.match_id && commentType === 'target'
              const slots = [[tgt.metric_1, tgt.target_1], [tgt.metric_2, tgt.target_2], [tgt.metric_3, tgt.target_3]].filter(([m]) => m)
              return (
                <div key={tgt.id} style={{ borderTop: '1px solid rgba(26,51,86,0.2)' }}>
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>
                        {tgt.match_id} Targets
                        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>vs {OPP[tgt.match_id]}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {slots.map(([metric, target], i) => (
                        <div key={i} style={{ background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>{target}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{METRIC_LABELS[metric] || metric}</div>
                        </div>
                      ))}
                    </div>
                    {tgtComments.map(c => (
                      <div key={c.id} style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(167,139,250,0.08)', borderRadius: 7, borderLeft: '3px solid var(--purple)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{c.coach_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{c.comment}</div>
                      </div>
                    ))}
                    <button onClick={() => { setSelectedPlayer(p.name); setSelectedMatch(tgt.match_id); setCommentType(isExpanded ? null : 'target') }}
                      style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--purple)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0 }}>
                      {isExpanded ? '▲ Cancel' : '+ Add Comment'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 14px 12px' }}>
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Add coaching feedback on targets…"
                        rows={3}
                        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif', resize: 'none', boxSizing: 'border-box' }}
                      />
                      <button onClick={submitComment} disabled={saving}
                        style={{ marginTop: 6, padding: '8px 16px', borderRadius: 7, background: 'var(--purple)', border: 'none', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                        {saving ? 'Sending…' : 'Send Comment'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {playerRefs.length === 0 && playerTgts.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No submissions yet</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
