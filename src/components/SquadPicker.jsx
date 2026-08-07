import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const POSITIONS = ['Goalkeeper', 'Defender', 'Midfield', 'Forward']
const POS_SHORT = { Goalkeeper: 'GK', Defender: 'Def', Midfield: 'Mid', Forward: 'Fwd' }

export default function SquadPicker({ appUser }) {
  const isAdmin = appUser?.role === 'admin'
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  // squad: { [name]: { is_starter: bool, position: string } }. Presence = selected.
  const [squad, setSquad] = useState({})
  const [goalsSet, setGoalsSet] = useState(new Set()) // names who've set targets for this match
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(null) // 'squad' | 'reminder' | null
  const [status, setStatus] = useState(null)
  const [defaultedFromLast, setDefaultedFromLast] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: true }),
      supabase.from('players').select('name, position').order('name'),
    ]).then(([{ data: m }, { data: p }]) => {
      setMatches(m || [])
      setPlayers(p || [])
      const today = new Date().toISOString().slice(0, 10)
      const upcoming = (m || []).find(x => x.match_date >= today)
      if (upcoming) setSelectedMatch(upcoming.match_id)
      setLoading(false)
    })
  }, [])

  const posFor = (name) => players.find(p => p.name === name)?.position || 'Forward'

  // Load squad + who's already set goals whenever match changes
  useEffect(() => {
    if (!selectedMatch) return
    setDefaultedFromLast(false)
    setDirty(false)
    Promise.all([
      supabase.from('matchday_squad').select('player_name, is_starter, position').eq('match_id', selectedMatch),
      supabase.from('player_targets').select('player_name').eq('match_id', selectedMatch),
    ]).then(([{ data: sq }, { data: tg }]) => {
      setGoalsSet(new Set((tg || []).map(t => t.player_name)))
      if (sq && sq.length > 0) {
        const next = {}
        sq.forEach(r => {
          next[r.player_name] = {
            is_starter: r.is_starter !== false,
            position: r.position || posFor(r.player_name),
          }
        })
        setSquad(next)
      } else {
        loadDefaultFromLastMatch()
      }
    })
  }, [selectedMatch, players])

  const loadDefaultFromLastMatch = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data: pastMatches } = await supabase
      .from('matches').select('match_id, match_date')
      .lt('match_date', today)
      .order('match_date', { ascending: false })
      .limit(1)
    if (!pastMatches?.length) { setSquad({}); return }
    const { data: stats } = await supabase
      .from('player_stats').select('player_name, total_minutes')
      .eq('match_id', pastMatches[0].match_id)
    const next = {}
    ;(stats || []).forEach(s => {
      next[s.player_name] = { is_starter: (s.total_minutes || 0) >= 40, position: posFor(s.player_name) }
    })
    setSquad(next)
    setDefaultedFromLast(true)
  }

  const togglePlayer = (name) => {
    if (!isAdmin) return
    setDirty(true)
    setSquad(prev => {
      const next = { ...prev }
      if (next[name]) delete next[name]
      else next[name] = { is_starter: true, position: posFor(name) }
      return next
    })
  }
  const setRole = (name, is_starter) => {
    setDirty(true)
    setSquad(prev => ({ ...prev, [name]: { ...prev[name], is_starter } }))
  }
  const setPos = (name, position) => {
    setDirty(true)
    setSquad(prev => ({ ...prev, [name]: { ...prev[name], position } }))
  }

  const showStatus = (type, message) => {
    setStatus({ type, message })
    setTimeout(() => setStatus(null), 6000)
  }

  const saveSquad = async () => {
    if (!isAdmin) { showStatus('error', 'Admin only'); return }
    if (!selectedMatch) return
    setSaving(true)
    const { error: delErr } = await supabase.from('matchday_squad').delete().eq('match_id', selectedMatch)
    if (delErr) { showStatus('error', delErr.message); setSaving(false); return }
    const names = Object.keys(squad)
    if (names.length > 0) {
      const rows = names.map(name => ({
        match_id: selectedMatch,
        player_name: name,
        selected_by: appUser?.name || 'admin',
        is_starter: squad[name].is_starter !== false,
        position: squad[name].position || posFor(name),
      }))
      const { error: insErr } = await supabase.from('matchday_squad').insert(rows)
      if (insErr) { showStatus('error', insErr.message); setSaving(false); return }
    }
    showStatus('success', `✓ Squad saved (${names.length} players)`)
    setDefaultedFromLast(false)
    setDirty(false)
    setSaving(false)
  }

  const sendEmails = async (mode) => {
    if (!isAdmin || !selectedMatch) return
    if (dirty) { showStatus('error', 'Save the squad before sending'); return }
    const squadNames = Object.keys(squad)
    if (squadNames.length === 0) { showStatus('error', 'No squad selected'); return }
    if (mode === 'squad') {
      if (!window.confirm(`Send the goal-setting email to all ${squadNames.length} squad players (and a heads-up to the coaches)?`)) return
    } else {
      const outstanding = squadNames.filter(n => !goalsSet.has(n)).length
      if (outstanding === 0) { showStatus('success', 'Everyone in the squad has already set their goals ✓'); return }
      if (!window.confirm(`Remind the ${outstanding} squad player${outstanding === 1 ? '' : 's'} who haven't set goals yet?`)) return
    }
    setSending(mode === 'squad' ? 'squad' : 'reminder')
    try {
      const endpoint = mode === 'squad' ? '/api/notify-prematch' : '/api/notify-goals-reminder'
      const body = mode === 'squad' ? { matchId: selectedMatch, notifyCoaches: true } : { matchId: selectedMatch }
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) { showStatus('error', j.error || 'Send failed'); setSending(null); return }
      if (mode === 'squad') {
        showStatus('success', `✓ Goal-setting email sent to ${j.sent ?? 0} player${j.sent === 1 ? '' : 's'}${j.coaches ? ` · ${j.coaches} coach heads-up${j.coaches === 1 ? '' : 's'}` : ''}`)
      } else {
        showStatus('success', j.sent > 0 ? `✓ Reminder sent to ${j.sent} player${j.sent === 1 ? '' : 's'}` : 'No one left to remind — all goals are set ✓')
      }
    } catch (e) {
      showStatus('error', 'Send failed: ' + e.message)
    }
    setSending(null)
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text3)' }}>Loading...</div>
  if (!isAdmin) return <div style={{ padding: 20, color: 'var(--text3)', fontStyle: 'italic' }}>Only admin can pick the matchday squad.</div>

  const names = Object.keys(squad)
  const starterCount = names.filter(n => squad[n].is_starter !== false).length
  const benchCount = names.length - starterCount
  const outstanding = names.filter(n => !goalsSet.has(n)).length

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, letterSpacing: 1 }}>MATCHDAY SQUAD</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Pick who's in the squad, mark starters vs subs and their position. The pre-match goal-setting email goes to these players only.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={selectedMatch || ''} onChange={e => setSelectedMatch(e.target.value)}
          style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
          {matches.map(m => (
            <option key={m.match_id} value={m.match_id}>{m.match_id} v {m.opposition} — {m.match_date}</option>
          ))}
        </select>
      </div>

      {/* Counts */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{ color: starterCount === 15 ? 'var(--teal)' : 'var(--gold)' }}>Starting XV: {starterCount}/15</span>
        <span style={{ color: 'var(--text3)' }}>Bench: {benchCount}</span>
        <span style={{ color: 'var(--text3)' }}>Squad: {names.length}</span>
        <span style={{ color: outstanding === 0 && names.length > 0 ? 'var(--teal)' : 'var(--text3)' }}>
          Goals set: {names.length - outstanding}/{names.length}
        </span>
      </div>

      {defaultedFromLast && (
        <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 12, fontStyle: 'italic' }}>
          Pre-filled from last match (40+ mins = starter) — review, then Save Squad
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6, marginBottom: 16 }}>
        {players.map(p => {
          const sel = squad[p.name]
          const hasGoals = goalsSet.has(p.name)
          return (
            <div key={p.name}
              style={{
                background: sel ? 'rgba(62,207,142,0.08)' : 'var(--bg2)',
                border: `1px solid ${sel ? 'var(--teal)' : 'var(--border)'}`,
                borderRadius: 8, overflow: 'hidden',
              }}>
              <button onClick={() => togglePlayer(p.name)}
                style={{ width: '100%', background: 'none', border: 'none', color: sel ? 'var(--teal)' : 'var(--text2)', padding: '8px 10px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Barlow, sans-serif' }}>
                <span>
                  <span style={{ fontWeight: sel ? 600 : 400, fontSize: 12 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)', display: 'block' }}>{p.position}</span>
                </span>
                {sel && hasGoals && <span title="Goals set" style={{ fontSize: 10, color: 'var(--teal)', whiteSpace: 'nowrap' }}>goals ✓</span>}
                {sel && !hasGoals && <span title="No goals yet" style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>no goals</span>}
              </button>
              {sel && (
                <div style={{ display: 'flex', gap: 6, padding: '0 10px 8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {[['Start', true], ['Bench', false]].map(([lbl, val]) => (
                      <button key={lbl} onClick={() => setRole(p.name, val)}
                        style={{ padding: '3px 8px', fontSize: 10, cursor: 'pointer', border: 'none', fontFamily: 'Barlow, sans-serif',
                          background: (sel.is_starter !== false) === val ? (val ? 'var(--teal)' : 'var(--gold)') : 'var(--bg3)',
                          color: (sel.is_starter !== false) === val ? '#07111f' : 'var(--text3)', fontWeight: 700 }}>{lbl}</button>
                    ))}
                  </div>
                  <select value={sel.position} onChange={e => setPos(p.name, e.target.value)}
                    style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: 11 }}>
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{POS_SHORT[pos]}</option>)}
                  </select>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={saveSquad} disabled={saving || !selectedMatch}
          style={{ background: dirty ? 'var(--gold)' : 'var(--bg3)', color: dirty ? '#07111f' : 'var(--text3)', border: `1px solid ${dirty ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Barlow, sans-serif' }}>
          {saving ? 'Saving...' : `Save Squad (${names.length})`}
        </button>
        <button onClick={() => sendEmails('squad')} disabled={!!sending || dirty || names.length === 0}
          title={dirty ? 'Save the squad first' : 'Email every squad player to set their goals'}
          style={{ background: 'rgba(74,158,255,0.14)', color: 'var(--blue)', border: '1px solid var(--blue)', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: sending || dirty ? 'not-allowed' : 'pointer', opacity: dirty ? 0.5 : 1, fontFamily: 'Barlow, sans-serif' }}>
          {sending === 'squad' ? 'Sending…' : 'Send goal-setting emails'}
        </button>
        <button onClick={() => sendEmails('reminder')} disabled={!!sending || dirty || outstanding === 0}
          title={outstanding === 0 ? 'Everyone has set goals' : `Nudge the ${outstanding} who haven't set goals`}
          style={{ background: 'var(--bg3)', color: outstanding === 0 ? 'var(--text3)' : 'var(--gold)', border: `1px solid ${outstanding === 0 ? 'var(--border)' : 'var(--gold)'}`, borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: sending || dirty || outstanding === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Barlow, sans-serif' }}>
          {sending === 'reminder' ? 'Sending…' : `Remind non-responders (${outstanding})`}
        </button>
      </div>
      {status && (
        <div style={{ marginTop: 12, fontSize: 12, color: status.type === 'error' ? 'var(--red)' : 'var(--teal)' }}>{status.message}</div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
        Starters get the standard goal-setting email; subs are told to set goals on a 60-minute basis, which is pro-rated to the minutes they actually play when their post-game report is scored.
      </div>
    </div>
  )
}
