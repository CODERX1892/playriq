import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MATCHES } from '../lib/utils'

const POSITIONS = ['Forward', 'Defender', 'Midfield', 'Goalkeeper']
const ROLES = ['Inside Forward', 'Half Forward', 'Midfielder', 'Half Back', 'Full Back', 'Goalkeeper']
const USER_ROLES = ['analyst', 'coach', 'admin']

// Column -> player-facing label. Keep in sync with STAT_GROUPS in ChallengeTab.jsx.
const COLUMN_LABELS = {
  one_pointer_scored: '1-Pointer Scored', two_pointer_scored: '2-Pointer Scored', goals_scored: 'Goal Scored',
  one_pointer_scored_f: '1-Pointer Scored (Free)', two_pointer_scored_f: '2-Pointer Scored (Free)', goals_scored_f: 'Goal Scored (Free)',
  one_pointer_wide: '1-Pointer Wide', two_pointer_wide: '2-Pointer Wide', goals_wide: 'Goal Wide',
  simple_pass: 'Simple Pass', advance_pass: 'Advance Pass', simple_receive: 'Simple Receive', advance_receive: 'Advance Receive',
  carries: 'Carry', kickaway_to_received: 'Kickaway Received', turnovers_kicked_away: 'Turnover (Kicked Away)',
  turnovers_in_contact: 'Turnover In Contact', turnover_skill_error: 'Turnover (Skill Error)', drop_shorts: 'Drop Short',
  tackles: 'Tackle', duels_contested: 'Duel Contested', defensive_duels_won: 'Duel Won', duels_lost: 'Duel Lost',
  breach_1v1: '1v1 Breach', dne: 'DNE', forced_to_win: 'Forced Turnover Won',
  free_conceded: 'Free Conceded', shot_free_conceded: 'Shot Free Conceded',
  won_clean_p1_our: 'Our KO Won Clean (P1)', won_clean_p2_our: 'Our KO Won Clean (P2)', won_clean_p3_our: 'Our KO Won Clean (P3)',
  won_break_our: 'Our KO Won Break', our_ko_contest_opp: 'Our KO Contested (Opp Won)', our_ko_contest_us: 'Our KO Contested (We Won)',
  ko_target_won_clean: 'KO Target Won Clean', ko_target_won_break: 'KO Target Won Break',
  ko_target_lost_clean: 'KO Target Lost Clean', ko_target_lost_contest: 'KO Target Lost Contest',
}

export default function AdminPanel() {
  const { appUser } = useAuth()
  const [tab, setTab] = useState('players')
  const [players, setPlayers] = useState([])
  const [appUsers, setAppUsers] = useState([])
  const [matches, setMatches] = useState([])
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)

  // New player form
  const [newPlayer, setNewPlayer] = useState({ name: '', irish_name: '', email: '', dob: '', position: 'Forward', role: 'Half Forward', pin: '' })
  // New match form
  const [newMatch, setNewMatch] = useState({ match_id: '', match_type: 'League', date: '', opposition: '' })
  // New user form
  const [newUser, setNewUser] = useState({ name: '', email: '', pin: '', role: 'analyst' })
  // Edit player role
  const [editingRole, setEditingRole] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('name,position,role,email,pin,dob').order('name'),
      supabase.from('app_users').select('*').order('name'),
      supabase.from('matches').select('*').order('match_id'),
      supabase.from('challenges').select('*').order('created_at', { ascending: false }),
    ]).then(([{ data: p }, { data: u }, { data: m }, { data: c }]) => {
      setPlayers(p || []); setAppUsers(u || []); setMatches(m || []); setChallenges(c || [])
      setLoading(false)
    })
  }, [])

  const showStatus = (type, message) => {
    setStatus({ type, message })
    setTimeout(() => setStatus(null), 4000)
  }

  const addPlayer = async () => {
    if (!newPlayer.name || !newPlayer.pin) { showStatus('error', 'Name and PIN required'); return }
    const { error } = await supabase.from('players').insert({ ...newPlayer, irish_name: newPlayer.irish_name || newPlayer.name })
    if (error) showStatus('error', error.message)
    else {
      showStatus('success', `✓ ${newPlayer.name} added`)
      setPlayers(prev => [...prev, newPlayer].sort((a,b) => a.name.localeCompare(b.name)))
      setNewPlayer({ name: '', irish_name: '', email: '', dob: '', position: 'Forward', role: 'Half Forward', pin: '' })
    }
  }

  const addMatch = async () => {
    if (!newMatch.match_id || !newMatch.opposition) { showStatus('error', 'Match ID and opposition required'); return }
    const { error } = await supabase.from('matches').insert(newMatch)
    if (!error) {
      await supabase.from('match_status').insert({ match_id: newMatch.match_id, status: 'draft' })
      showStatus('success', `✓ ${newMatch.match_id} added`)
      setMatches(prev => [...prev, newMatch])
      setNewMatch({ match_id: '', match_type: 'League', date: '', opposition: '' })
    } else showStatus('error', error.message)
  }

  const addUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.pin) { showStatus('error', 'All fields required'); return }
    const { error } = await supabase.from('app_users').insert(newUser)
    if (error) showStatus('error', error.message)
    else {
      showStatus('success', `✓ ${newUser.name} added as ${newUser.role}`)
      setAppUsers(prev => [...prev, newUser])
      setNewUser({ name: '', email: '', pin: '', role: 'analyst' })
    }
  }

  const resetPin = async (playerName, newPin) => {
    const { error } = await supabase.from('players').update({ pin: newPin }).eq('name', playerName)
    if (error) showStatus('error', error.message)
    else showStatus('success', `✓ PIN reset for ${playerName}`)
  }

  const updateRole = async (playerName, role) => {
    const { error } = await supabase.from('players').update({ role }).eq('name', playerName)
    if (!error) {
      setPlayers(prev => prev.map(p => p.name === playerName ? { ...p, role } : p))
      setEditingRole(null)
      showStatus('success', `✓ ${playerName} → ${role}`)
    }
  }

  const toggleUser = async (userId, active) => {
    await supabase.from('app_users').update({ active: !active }).eq('id', userId)
    setAppUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !active } : u))
  }

  const resetUserPin = async (userId, newPin) => {
    const { error } = await supabase.from('app_users').update({ pin: newPin }).eq('id', userId)
    if (error) showStatus('error', error.message)
    else showStatus('success', '✓ Staff PIN updated')
  }

  // ── Challenges: approve / reject ────────────────────────────────────────
  // Approve: if stat_column set, UPDATE player_stats (current + delta, clamped ≥ 0).
  //          Then mark challenge approved. If no player_stats row exists, refuse.
  //          If stat_column is NULL ("Other" path), skip the stat update — admin
  //          approves the clip but stats aren't auto-edited.
  const approveChallenge = async (c, adminName) => {
    if (c.stat_column) {
      const { data: statsRow, error: fetchErr } = await supabase
        .from('player_stats')
        .select(`id, ${c.stat_column}`)
        .eq('player_name', c.player_name)
        .eq('match_id', c.match_id)
        .maybeSingle()

      if (fetchErr) { showStatus('error', fetchErr.message); return }
      if (!statsRow) {
        showStatus('error', `No stats row for ${c.player_name} in ${c.match_id} — can't auto-update.`)
        return
      }

      const current = Number(statsRow[c.stat_column]) || 0
      const next = Math.max(0, current + c.delta)

      const { error: updErr } = await supabase.from('player_stats')
        .update({ [c.stat_column]: next })
        .eq('id', statsRow.id)
      if (updErr) { showStatus('error', updErr.message); return }
    }

    const { error: chErr } = await supabase.from('challenges')
      .update({
        status: 'approved',
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', c.id)

    if (chErr) { showStatus('error', chErr.message); return }

    setChallenges(prev => prev.map(x => x.id === c.id
      ? { ...x, status: 'approved', reviewed_by: adminName, reviewed_at: new Date().toISOString() }
      : x))
    showStatus('success',
      c.stat_column
        ? `✓ Approved — ${c.player_name} stats updated`
        : `✓ Approved (no auto-update — Other stat)`)
  }

  const rejectChallenge = async (c, adminNote, adminName) => {
    const { error } = await supabase.from('challenges')
      .update({
        status: 'rejected',
        admin_note: adminNote || null,
        reviewed_by: adminName,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', c.id)

    if (error) { showStatus('error', error.message); return }

    setChallenges(prev => prev.map(x => x.id === c.id
      ? { ...x, status: 'rejected', admin_note: adminNote || null,
          reviewed_by: adminName, reviewed_at: new Date().toISOString() }
      : x))
    showStatus('success', `✓ Rejected`)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>

  return (
    <div>
      {status && (
        <div style={{ padding: '9px 13px', borderRadius: 8, marginBottom: 12, background: status.type === 'success' ? 'rgba(62,207,142,0.1)' : 'rgba(240,96,96,0.1)', border: `1px solid ${status.type === 'success' ? 'var(--teal)' : 'var(--red)'}`, color: status.type === 'success' ? 'var(--teal)' : 'var(--red)', fontSize: 13 }}>
          {status.message}
        </div>
      )}

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['players', 'matches', 'users', 'challenges'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${t === tab ? 'var(--gold)' : 'var(--border)'}`, background: t === tab ? 'var(--gold-dim)' : 'var(--bg2)', color: t === tab ? 'var(--gold)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* PLAYERS */}
      {tab === 'players' && (
        <div>
          {/* Add player */}
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div className="card-header" style={{ marginBottom: 12 }}><span style={{ color: 'var(--gold)' }}>Add New Player</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[['name','Full Name'],['irish_name','Irish Name'],['email','Email'],['dob','DOB (YYYY-MM-DD)'],['pin','PIN (4 digits)']].map(([k,l]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                  <input value={newPlayer[k]} onChange={e => setNewPlayer(p => ({ ...p, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow, sans-serif', outline: 'none' }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Position</div>
                <select value={newPlayer.position} onChange={e => setNewPlayer(p => ({ ...p, position: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow, sans-serif', outline: 'none' }}>
                  {POSITIONS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Role</div>
                <select value={newPlayer.role} onChange={e => setNewPlayer(p => ({ ...p, role: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow, sans-serif', outline: 'none' }}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addPlayer} style={{ width: '100%', padding: '10px', background: 'var(--gold-dim)', border: '1px solid var(--gold)', borderRadius: 8, color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
              + Add Player
            </button>
          </div>

          {/* Player list with role editor and PIN reset */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header"><span style={{ color: 'var(--blue)' }}>Squad ({players.length})</span></div>
            {players.map((p, i) => (
              <div key={p.name} style={{ padding: '10px 14px', borderTop: '1px solid rgba(26,51,86,0.3)', display: 'flex', alignItems: 'center', gap: 10, background: i % 2 === 0 ? '' : 'rgba(255,255,255,0.01)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{p.position}</div>
                </div>
                {editingRole === p.name ? (
                  <select defaultValue={p.role || ''} onChange={e => updateRole(p.name, e.target.value)}
                    style={{ padding: '4px 6px', background: 'var(--bg3)', border: '1px solid var(--gold)', borderRadius: 5, color: 'var(--gold)', fontSize: 11, fontFamily: 'Barlow, sans-serif', outline: 'none' }}>
                    <option value="">-- role --</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <button onClick={() => setEditingRole(p.name)}
                    style={{ fontSize: 10, padding: '3px 8px', background: p.role ? 'rgba(240,180,41,0.08)' : 'var(--bg3)', border: `1px solid ${p.role ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 5, color: p.role ? 'var(--gold)' : 'var(--text3)', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                    {p.role || 'Set role'}
                  </button>
                )}
                <PinResetButton playerName={p.name} onReset={resetPin} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATCHES */}
      {tab === 'matches' && (
        <div>
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div className="card-header" style={{ marginBottom: 12 }}><span style={{ color: 'var(--gold)' }}>Add New Match</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[['match_id','Match ID (e.g. AFL 5)'],['opposition','Opposition'],['date','Date (YYYY-MM-DD)'],['match_type','Type']].map(([k,l]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                  <input value={newMatch[k]} onChange={e => setNewMatch(m => ({ ...m, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow, sans-serif', outline: 'none' }} />
                </div>
              ))}
            </div>
            <button onClick={addMatch} style={{ width: '100%', padding: '10px', background: 'var(--gold-dim)', border: '1px solid var(--gold)', borderRadius: 8, color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
              + Add Match
            </button>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header"><span style={{ color: 'var(--blue)' }}>Fixtures ({matches.length})</span></div>
            {matches.map((m, i) => (
              <div key={m.match_id} style={{ padding: '10px 14px', borderTop: '1px solid rgba(26,51,86,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.match_id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>vs {m.opposition} · {m.date}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', background: 'var(--bg3)', padding: '2px 7px', borderRadius: 4 }}>{m.match_type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div>
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div className="card-header" style={{ marginBottom: 12 }}><span style={{ color: 'var(--gold)' }}>Add Staff User</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[['name','Full Name'],['email','Email'],['pin','PIN (4 digits)']].map(([k,l]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{l}</div>
                  <input value={newUser[k]} onChange={e => setNewUser(u => ({ ...u, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow, sans-serif', outline: 'none' }} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Role</div>
                <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow, sans-serif', outline: 'none' }}>
                  {USER_ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addUser} style={{ width: '100%', padding: '10px', background: 'var(--gold-dim)', border: '1px solid var(--gold)', borderRadius: 8, color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
              + Add User
            </button>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header"><span style={{ color: 'var(--blue)' }}>Staff ({appUsers.length})</span></div>
            {appUsers.map((u, i) => (
              <div key={u.id} style={{ padding: '10px 14px', borderTop: '1px solid rgba(26,51,86,0.3)', display: 'flex', alignItems: 'center', gap: 10, opacity: u.active ? 1 : 0.5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{u.email}</div>
                </div>
                <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: u.role === 'admin' ? 'rgba(240,180,41,0.12)' : u.role === 'coach' ? 'rgba(74,158,255,0.12)' : 'rgba(62,207,142,0.12)', color: u.role === 'admin' ? 'var(--gold)' : u.role === 'coach' ? 'var(--blue)' : 'var(--teal)', border: `1px solid currentColor` }}>{u.role}</div>
                <StaffPinResetButton userId={u.id} onReset={resetUserPin} />
                <button onClick={() => toggleUser(u.id, u.active)}
                  style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: u.active ? 'var(--red)' : 'var(--teal)', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                  {u.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHALLENGES */}
      {tab === 'challenges' && (
        <ChallengesQueue
          challenges={challenges}
          adminName={appUser?.name || 'admin'}
          onApprove={approveChallenge}
          onReject={rejectChallenge}
        />
      )}
    </div>
  )
}

function StaffPinResetButton({ userId, onReset }) {
  const [editing, setEditing] = useState(false)
  const [newPin, setNewPin] = useState('')
  if (editing) return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/,'').slice(0,4))}
        placeholder="PIN" maxLength={4}
        style={{ width: 52, padding: '4px 6px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textAlign: 'center', outline: 'none' }} />
      <button onClick={() => { if(newPin.length===4){onReset(userId,newPin);setEditing(false);setNewPin('')} }}
        style={{ padding: '4px 8px', background: 'rgba(62,207,142,0.12)', border: '1px solid var(--teal)', borderRadius: 5, color: 'var(--teal)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>✓</button>
      <button onClick={() => {setEditing(false);setNewPin('')}}
        style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>✕</button>
    </div>
  )
  return (
    <button onClick={() => setEditing(true)}
      style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
      Reset PIN
    </button>
  )
}

function PinResetButton({ playerName, onReset }) {
  const [editing, setEditing] = useState(false)
  const [newPin, setNewPin] = useState('')
  if (editing) return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/,'').slice(0,4))}
        placeholder="PIN" maxLength={4}
        style={{ width: 52, padding: '4px 6px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, textAlign: 'center', outline: 'none' }} />
      <button onClick={() => { if(newPin.length===4){onReset(playerName,newPin);setEditing(false);setNewPin('')} }}
        style={{ padding: '4px 8px', background: 'rgba(62,207,142,0.12)', border: '1px solid var(--teal)', borderRadius: 5, color: 'var(--teal)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>✓</button>
      <button onClick={() => {setEditing(false);setNewPin('')}}
        style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>✕</button>
    </div>
  )
  return (
    <button onClick={() => setEditing(true)}
      style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
      Reset PIN
    </button>
  )
}

// ── Challenges review queue ──────────────────────────────────────────────
function ChallengesQueue({ challenges, adminName, onApprove, onReject }) {
  const pending  = challenges.filter(c => c.status === 'pending')
  const reviewed = challenges.filter(c => c.status !== 'pending')

  if (challenges.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📬</div>
        <div style={{ fontSize: 13 }}>No challenges submitted yet.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="card" style={{ overflow: 'hidden', marginBottom: 14 }}>
        <div className="card-header">
          <span style={{ color: 'var(--gold)' }}>Pending ({pending.length})</span>
        </div>
        {pending.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            Nothing waiting for review.
          </div>
        ) : (
          pending.map(c => (
            <PendingRow key={c.id} c={c} adminName={adminName} onApprove={onApprove} onReject={onReject} />
          ))
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <span style={{ color: 'var(--text3)' }}>Reviewed ({reviewed.length})</span>
          </div>
          {reviewed.map(c => <ReviewedRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  )
}

function statDisplay(c) {
  return c.stat_column ? (COLUMN_LABELS[c.stat_column] || c.stat_column) : c.stat_label
}

function PendingRow({ c, adminName, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const sign = c.delta > 0 ? '+' : ''
  const isOther = !c.stat_column

  const doApprove = async () => { setBusy(true); await onApprove(c, adminName); setBusy(false) }
  const doReject  = async () => {
    setBusy(true); await onReject(c, note.trim(), adminName); setBusy(false)
    setRejecting(false); setNote('')
  }

  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(26,51,86,0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.player_name}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{c.match_id}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{statDisplay(c)}</span>
            {isOther && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: 'rgba(240,180,41,0.12)', color: 'var(--gold)',
                border: '1px solid var(--gold)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Other
              </span>
            )}
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800,
              color: c.delta > 0 ? 'var(--teal)' : 'var(--red)' }}>
              {sign}{c.delta}
            </span>
          </div>
          {c.player_note && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, fontStyle: 'italic' }}>
              &ldquo;{c.player_note}&rdquo;
            </div>
          )}
          {c.hudl_url && (
            <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 5 }}>
              @ {c.hudl_url}
            </div>
          )}
          {isOther && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
              Note: approving "Other" challenges does not auto-update player_stats.
            </div>
          )}
        </div>
      </div>

      {!rejecting ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={doApprove} disabled={busy}
            style={{ flex: 1, padding: '7px 10px', background: 'rgba(62,207,142,0.12)',
              border: '1px solid var(--teal)', borderRadius: 6, color: 'var(--teal)',
              fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'Barlow, sans-serif', opacity: busy ? 0.5 : 1 }}>
            ✓ Approve
          </button>
          <button onClick={() => setRejecting(true)} disabled={busy}
            style={{ flex: 1, padding: '7px 10px', background: 'rgba(240,96,96,0.1)',
              border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)',
              fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'Barlow, sans-serif', opacity: busy ? 0.5 : 1 }}>
            ✕ Reject
          </button>
        </div>
      ) : (
        <div>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Reason (optional)" autoFocus
            style={{ width: '100%', padding: '7px 10px', background: 'var(--bg3)',
              border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
              fontSize: 12, fontFamily: 'Barlow, sans-serif', outline: 'none', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={doReject} disabled={busy}
              style={{ flex: 1, padding: '7px 10px', background: 'rgba(240,96,96,0.12)',
                border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)',
                fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
                fontFamily: 'Barlow, sans-serif', opacity: busy ? 0.5 : 1 }}>
              Confirm Reject
            </button>
            <button onClick={() => { setRejecting(false); setNote('') }} disabled={busy}
              style={{ padding: '7px 12px', background: 'none', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text3)', fontSize: 12, cursor: 'pointer',
                fontFamily: 'Barlow, sans-serif' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReviewedRow({ c }) {
  const sign = c.delta > 0 ? '+' : ''
  const statusColor = c.status === 'approved' ? 'var(--teal)' : 'var(--red)'
  const reviewedDate = c.reviewed_at ? new Date(c.reviewed_at).toLocaleDateString() : ''
  return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(26,51,86,0.3)', opacity: 0.75 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{c.player_name}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.match_id}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{statDisplay(c)}</span>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700,
              color: c.delta > 0 ? 'var(--teal)' : 'var(--red)' }}>
              {sign}{c.delta}
            </span>
          </div>
          {c.admin_note && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, fontStyle: 'italic' }}>
              {c.admin_note}
            </div>
          )}
          {c.reviewed_by && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              by {c.reviewed_by} · {reviewedDate}
            </div>
          )}
        </div>
        <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
          background: `${statusColor}1a`, color: statusColor, border: `1px solid ${statusColor}`,
          whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 1 }}>
          {c.status}
        </div>
      </div>
    </div>
  )
}
