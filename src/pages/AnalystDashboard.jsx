import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MATCHES, OPP, n, r1, pct, impactColor } from '../lib/utils'
import DataEntry from './DataEntry'

const POS_COLORS = { Forward: '#f0b429', Defender: '#4a9eff', Midfield: '#3ecf8e', Goalkeeper: '#a78bfa' }

const METRICS = {
  total_impact: { label: 'Total Impact', color: '#a78bfa' },
  attack_impact: { label: 'Attack Impact', color: '#f0b429' },
  transition_impact: { label: 'Transition', color: '#4a9eff' },
  defensive_impact: { label: 'Defence', color: '#3ecf8e' },
  pts: { label: 'Points', color: '#f0b429' },
  tackles: { label: 'Tackles', color: '#4a9eff' },
  forced_to: { label: 'Forced TO', color: '#3ecf8e' },
}

export default function AnalystDashboard() {
  const { appUser, logout } = useAuth()
  const [tab, setTab] = useState('squad')
  const [allStats, setAllStats] = useState([])
  const [players, setPlayers] = useState([])
  const [matchStatuses, setMatchStatuses] = useState({})
  const [loading, setLoading] = useState(true)
  const [matchFilter, setMatchFilter] = useState('all')
  const [metric, setMetric] = useState('total_impact')
  const [matchView, setMatchView] = useState('AFL 1')
  const [publishing, setPublishing] = useState(false)
  const [pubStatus, setPubStatus] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('player_stats').select('*'),
      supabase.from('players').select('name,position'),
      supabase.from('match_status').select('*'),
    ]).then(([{ data: stats }, { data: pls }, { data: ms }]) => {
      setAllStats(stats || [])
      setPlayers(pls || [])
      const msMap = {}
      if (ms) ms.forEach(m => { msMap[m.match_id] = m })
      setMatchStatuses(msMap)
      setLoading(false)
    })
  }, [])

  const getSquadStats = () => {
    return players.map(p => {
      const rows = allStats.filter(r => r.player_name === p.name && (matchFilter === 'all' || r.match_id === matchFilter))
      if (!rows.length) return null
      const mc = [...new Set(rows.map(r => r.match_id))].length || 1
      const mins = rows.reduce((s, r) => s + n(r.total_minutes), 0)
      if (!mins) return null
      const ti = r1(rows.reduce((s, r) => s + n(r.total_impact), 0))
      const ai = r1(rows.reduce((s, r) => s + n(r.attack_impact), 0))
      const tri = r1(rows.reduce((s, r) => s + n(r.transition_impact), 0))
      const di = r1(rows.reduce((s, r) => s + n(r.defensive_impact), 0))
      const p1s = rows.reduce((s,r) => s+n(r.one_pointer_scored)+n(r.one_pointer_scored_f),0)
      const p2s = rows.reduce((s,r) => s+n(r.two_pointer_scored)+n(r.two_pointer_scored_f),0)
      const gs = rows.reduce((s,r) => s+n(r.goals_scored)+n(r.goals_scored_f),0)
      return { name: p.name, position: p.position, mc, mins,
        total_impact: ti, attack_impact: ai, transition_impact: tri, defensive_impact: di,
        pts: p1s + p2s*2 + gs*3,
        tackles: rows.reduce((s,r)=>s+n(r.tackles),0),
        forced_to: rows.reduce((s,r)=>s+n(r.forced_to_win),0),
      }
    }).filter(Boolean)
  }

  const handlePublish = async (matchId) => {
    setPublishing(true); setPubStatus(null)
    const { error } = await supabase.from('match_status')
      .upsert({ match_id: matchId, status: 'published', published_at: new Date().toISOString(), published_by: appUser.name }, { onConflict: 'match_id' })
    if (!error) {
      setMatchStatuses(prev => ({ ...prev, [matchId]: { ...prev[matchId], status: 'published' } }))
      setPubStatus({ type: 'success', message: `✓ ${matchId} published — players can now see their stats` })
      // Send notifications
      try { await fetch('/api/notify-publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId }) }) } catch(e) {}
    } else {
      setPubStatus({ type: 'error', message: 'Error publishing: ' + error.message })
    }
    setPublishing(false)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="spinner" /></div>

  const squadStats = getSquadStats()

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg4)', border: '2px solid var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>
          {appUser.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{appUser.name}</div>
          <div style={{ fontSize: 10, color: 'var(--teal)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Analyst · <span style={{ color: 'var(--border2)', textTransform: 'none', letterSpacing: 0 }}>v0.4.0</span></div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>Sign Out</button>
      </div>

      {/* Tabs */}
      <div style={{ position: 'sticky', top: 61, zIndex: 39, background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {['squad', 'match', 'entry'].map(t => (
          <button key={t} className={`tab${tab === t ? ' coach-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'entry' ? 'Enter Data' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: 14 }}>
        {/* Publish status */}
        {pubStatus && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, background: pubStatus.type === 'success' ? 'rgba(62,207,142,0.1)' : 'rgba(240,96,96,0.1)', border: `1px solid ${pubStatus.type === 'success' ? 'var(--teal)' : 'var(--red)'}`, color: pubStatus.type === 'success' ? 'var(--teal)' : 'var(--red)', fontSize: 13 }}>
            {pubStatus.message}
          </div>
        )}

        {/* Match publish status bar */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {MATCHES.map(m => {
            const status = matchStatuses[m]?.status || 'draft'
            return (
              <div key={m} style={{ flex: 1, minWidth: 100, background: 'var(--bg2)', border: `1px solid ${status === 'published' ? 'var(--teal)' : 'var(--border)'}`, borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{m}</div>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 6 }}>{OPP[m]}</div>
                {status === 'published' ? (
                  <div style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 600 }}>✓ Published</div>
                ) : (
                  <button onClick={() => handlePublish(m)} disabled={publishing}
                    style={{ width: '100%', padding: '5px 8px', background: 'rgba(240,180,41,0.12)', border: '1px solid var(--gold)', borderRadius: 6, color: 'var(--gold)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                    Publish
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {tab === 'squad' && <AnalystSquadTab squadStats={squadStats} matchFilter={matchFilter} setMatchFilter={setMatchFilter} metric={metric} setMetric={setMetric} />}
        {tab === 'match' && <AnalystMatchTab allStats={allStats} players={players} matchView={matchView} setMatchView={setMatchView} />}
        {tab === 'entry' && <DataEntry analystName={appUser.name} />}
      </div>
    </div>
  )
}

function AnalystSquadTab({ squadStats, matchFilter, setMatchFilter, metric, setMetric }) {
  let sorted = [...squadStats].sort((a, b) => (b[metric]||0) - (a[metric]||0))
  const maxVal = sorted.length ? Math.max(...sorted.map(p => p[metric]||0), 1) : 1
  const color = METRICS[metric]?.color || 'var(--blue)'
  const label = METRICS[metric]?.label || metric

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 11, scrollbarWidth: 'none' }}>
        {['all', ...MATCHES].map(m => (
          <button key={m} onClick={() => setMatchFilter(m)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${m === matchFilter ? 'var(--blue)' : 'var(--border)'}`, background: m === matchFilter ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: m === matchFilter ? 'var(--blue)' : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}>
            {m === 'all' ? 'All' : m}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 5, marginBottom: 12, scrollbarWidth: 'none' }}>
        {Object.entries(METRICS).map(([k, { label: l, color: c }]) => (
          <button key={k} onClick={() => setMetric(k)}
            style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${k === metric ? c : 'var(--border)'}`, background: k === metric ? 'rgba(255,255,255,0.04)' : 'var(--bg2)', color: k === metric ? c : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}>
            {l}
          </button>
        ))}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header"><span style={{ color }}>{label}</span><span>{sorted.length} players</span></div>
        {sorted.map((p, i) => {
          const val = p[metric] || 0
          const bw = maxVal > 0 ? Math.max(0, Math.min(100, (val/maxVal)*100)) : 0
          const posColor = POS_COLORS[p.position] || 'var(--text2)'
          const rankColor = i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--text3)'
          return (
            <div key={p.name} style={{ padding: '9px 14px', borderTop: '1px solid rgba(26,51,86,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700, color: rankColor, minWidth: 18, textAlign: 'center' }}>{i+1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: posColor }}>{p.position} · {p.mc}gm · {p.mins}min</div>
                </div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, color, minWidth: 44, textAlign: 'right' }}>{val}</div>
              </div>
              <div style={{ marginTop: 5, marginLeft: 28, height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
                <div style={{ width: `${bw}%`, height: '100%', background: color, borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnalystMatchTab({ allStats, players, matchView, setMatchView }) {
  const matchRows = allStats.filter(r => r.match_id === matchView && n(r.total_minutes) > 0)
    .sort((a, b) => n(b.total_impact) - n(a.total_impact))

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {MATCHES.map(m => (
          <button key={m} onClick={() => setMatchView(m)}
            style={{ padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${m === matchView ? 'var(--blue)' : 'var(--border)'}`, background: m === matchView ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: m === matchView ? 'var(--blue)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
            <div>{m}</div><div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{OPP[m]}</div>
          </button>
        ))}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '1fr 36px 36px 36px 36px 36px 40px', gap: 4 }}>
          <div>Player</div>
          <div style={{ textAlign: 'center' }}>Min</div>
          <div style={{ color: '#f0b429', textAlign: 'center' }}>Atk</div>
          <div style={{ color: '#4a9eff', textAlign: 'center' }}>Tran</div>
          <div style={{ color: '#3ecf8e', textAlign: 'center' }}>Def</div>
          <div style={{ color: '#f0b429', textAlign: 'center' }}>Pts</div>
          <div style={{ color: '#a78bfa', textAlign: 'right' }}>Total</div>
        </div>
        {matchRows.map(r => {
          const imp = r1(n(r.total_impact))
          const ai = r1(n(r.attack_impact)), ti = r1(n(r.transition_impact)), di = r1(n(r.defensive_impact))
          const p1 = n(r.one_pointer_scored)+n(r.one_pointer_scored_f)
          const p2 = n(r.two_pointer_scored)+n(r.two_pointer_scored_f)
          const g = n(r.goals_scored)+n(r.goals_scored_f)
          const pts = p1+p2*2+g*3
          const ppos = players.find(p => p.name === r.player_name)?.position || ''
          const isDraft = r.is_draft
          return (
            <div key={r.id} style={{ padding: '8px 12px', borderTop: '1px solid rgba(26,51,86,0.3)', background: isDraft ? 'rgba(240,180,41,0.03)' : '' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 36px 36px 36px 36px 40px', gap: 4, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.player_name}
                    {isDraft && <span style={{ fontSize: 9, background: 'rgba(240,180,41,0.15)', border: '1px solid var(--gold)', color: 'var(--gold)', borderRadius: 3, padding: '1px 4px' }}>DRAFT</span>}
                  </div>
                  <div style={{ fontSize: 9, color: POS_COLORS[ppos] || 'var(--text2)' }}>{ppos}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{n(r.total_minutes)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0b429', textAlign: 'center' }}>{ai}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4a9eff', textAlign: 'center' }}>{ti}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3ecf8e', textAlign: 'center' }}>{di}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0b429', textAlign: 'center' }}>{pts||'—'}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, textAlign: 'right', color: impactColor(imp) }}>{imp}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
