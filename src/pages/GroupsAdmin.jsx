// Admin-only accountability-group manager. Create groups, assign a coach, and
// add/remove players. Players' per-game goals (player_targets) and results are
// surfaced to the group in the shared GroupGoals view.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function GroupsAdmin({ players, appUsers }) {
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState({}) // groupId -> [player_name]
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const coaches = (appUsers || []).filter(u => u.role === 'coach' || u.role === 'admin')

  const load = async () => {
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from('groups').select('*').order('created_at'),
      supabase.from('group_members').select('*'),
    ])
    setGroups(g || [])
    const map = {}
    ;(m || []).forEach(row => { (map[row.group_id] = map[row.group_id] || []).push(row.player_name) })
    setMembers(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const createGroup = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    await supabase.from('groups').insert({ name })
    setNewName('')
    await load()
    setBusy(false)
  }
  const setCoach = async (groupId, coachId) => {
    await supabase.from('groups').update({ coach_id: coachId || null }).eq('id', groupId)
    setGroups(gs => gs.map(g => g.id === groupId ? { ...g, coach_id: coachId || null } : g))
  }
  const addPlayer = async (groupId, name) => {
    if (!name) return
    await supabase.from('group_members').insert({ group_id: groupId, player_name: name })
    setMembers(mm => ({ ...mm, [groupId]: [...(mm[groupId] || []), name] }))
  }
  const removePlayer = async (groupId, name) => {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('player_name', name)
    setMembers(mm => ({ ...mm, [groupId]: (mm[groupId] || []).filter(n => n !== name) }))
  }
  const deleteGroup = async (groupId) => {
    await supabase.from('group_members').delete().eq('group_id', groupId)
    await supabase.from('groups').delete().eq('id', groupId)
    setGroups(gs => gs.filter(g => g.id !== groupId))
  }

  const sel = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'Barlow, sans-serif' }

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>

  return (
    <div>
      {/* Create */}
      <div className="card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>New Accountability Group</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Backs Unit"
            style={{ ...sel, flex: 1 }} onKeyDown={e => e.key === 'Enter' && createGroup()} />
          <button onClick={createGroup} disabled={busy || !newName.trim()}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--gold-dim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
            + Create
          </button>
        </div>
      </div>

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '20px 0' }}>No groups yet. Create one above.</div>
      )}

      {groups.map(g => {
        const mem = members[g.id] || []
        const available = (players || []).filter(p => !mem.includes(p.name)).sort((a, b) => a.name.localeCompare(b.name))
        return (
          <div key={g.id} className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</div>
              <button onClick={() => deleteGroup(g.id)}
                style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>Delete</button>
            </div>

            {/* Coach */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Assigned Coach</div>
              <select value={g.coach_id || ''} onChange={e => setCoach(g.id, e.target.value)} style={{ ...sel, width: '100%' }}>
                <option value="">— none —</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
              </select>
            </div>

            {/* Members */}
            <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Members ({mem.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {mem.length === 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>No players yet</span>}
              {mem.map(name => (
                <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 6px 4px 11px', fontSize: 12 }}>
                  {name}
                  <button onClick={() => removePlayer(g.id, name)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                </span>
              ))}
            </div>
            <select value="" onChange={e => { addPlayer(g.id, e.target.value); e.target.value = '' }} style={{ ...sel, width: '100%' }}>
              <option value="">+ Add player…</option>
              {available.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        )
      })}
    </div>
  )
}
