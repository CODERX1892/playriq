import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SquadPicker({ appUser }) {
  const isAdmin = appUser?.role === 'admin'
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [squadSet, setSquadSet] = useState(new Set())   // player names selected for this match
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [defaultedFromLast, setDefaultedFromLast] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: true }),
      supabase.from('players').select('name, position').order('name'),
    ]).then(([{ data: m }, { data: p }]) => {
      setMatches(m || [])
      setPlayers(p || [])
      // Default-pick: the next upcoming match (earliest match_date >= today)
      const today = new Date().toISOString().slice(0, 10)
      const upcoming = (m || []).find(x => x.match_date >= today)
      if (upcoming) setSelectedMatch(upcoming.match_id)
      setLoading(false)
    })
  }, [])

  // Load squad whenever match changes
  useEffect(() => {
    if (!selectedMatch) return
    setDefaultedFromLast(false)
    supabase.from('matchday_squad').select('player_name').eq('match_id', selectedMatch)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSquadSet(new Set(data.map(r => r.player_name)))
        } else {
          // No saved squad yet -> default to most recent past match's player_stats
          loadDefaultFromLastMatch()
        }
      })
  }, [selectedMatch])

  const loadDefaultFromLastMatch = async () => {
    const today = new Date().toISOString().slice(0, 10)
    const { data: pastMatches } = await supabase
      .from('matches').select('match_id, match_date')
      .lt('match_date', today)
      .order('match_date', { ascending: false })
      .limit(1)
    if (!pastMatches?.length) {
      setSquadSet(new Set())
      return
    }
    const lastMatchId = pastMatches[0].match_id
    const { data: stats } = await supabase
      .from('player_stats').select('player_name')
      .eq('match_id', lastMatchId)
    setSquadSet(new Set((stats || []).map(s => s.player_name)))
    setDefaultedFromLast(true)
  }

  const togglePlayer = (name) => {
    if (!isAdmin) return
    setSquadSet(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const showStatus = (type, message) => {
    setStatus({ type, message })
    setTimeout(() => setStatus(null), 4000)
  }

  const saveSquad = async () => {
    if (!isAdmin) { showStatus('error', 'Admin only'); return }
    if (!selectedMatch) return
    setSaving(true)
    // Replace strategy: delete all rows for this match, then insert current set
    const { error: delErr } = await supabase.from('matchday_squad')
      .delete().eq('match_id', selectedMatch)
    if (delErr) { showStatus('error', delErr.message); setSaving(false); return }
    if (squadSet.size > 0) {
      const rows = Array.from(squadSet).map(name => ({
        match_id: selectedMatch,
        player_name: name,
        selected_by: appUser?.name || 'admin',
      }))
      const { error: insErr } = await supabase.from('matchday_squad').insert(rows)
      if (insErr) { showStatus('error', insErr.message); setSaving(false); return }
    }
    showStatus('success', `\u2713 Squad saved (${squadSet.size} players)`)
    setDefaultedFromLast(false)
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text3)' }}>Loading...</div>

  if (!isAdmin) {
    return <div style={{ padding: 20, color: 'var(--text3)', fontStyle: 'italic' }}>Only admin can pick the matchday squad.</div>
  }

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>MATCHDAY SQUAD</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
        Pick who's in the squad for this match. The pre-match goal-setting email goes to these players only.
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <select value={selectedMatch || ''} onChange={e => setSelectedMatch(e.target.value)}
          style={{ background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', flex: 1 }}>
          {matches.map(m => (
            <option key={m.match_id} value={m.match_id}>
              {m.match_id} v {m.opposition} — {m.match_date}
            </option>
          ))}
        </select>
      </div>

      {defaultedFromLast && (
        <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 12, fontStyle: 'italic' }}>
          Pre-filled from last match's squad — review and adjust below
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, marginBottom: 16 }}>
        {players.map(p => {
          const selected = squadSet.has(p.name)
          return (
            <button key={p.name} onClick={() => togglePlayer(p.name)}
              style={{
                background: selected ? 'var(--teal-dark, #0a4d5c)' : 'var(--bg2)',
                border: `1px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
                color: selected ? 'var(--teal)' : 'var(--text2)',
                borderRadius: 6, padding: '8px 10px',
                fontSize: 12, textAlign: 'left',
                cursor: 'pointer',
              }}>
              <div style={{ fontWeight: selected ? 600 : 400 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.position}</div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={saveSquad} disabled={saving || !selectedMatch}
          style={{
            background: 'var(--gold)', color: '#07111f', border: 'none', borderRadius: 8,
            padding: '10px 20px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
          }}>
          {saving ? 'Saving...' : `Save Squad (${squadSet.size} selected)`}
        </button>
        {status && (
          <span style={{ fontSize: 12, color: status.type === 'error' ? 'var(--red)' : 'var(--teal)' }}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  )
}
