import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import { MATCHES, OPP, POS_COLORS, n, r1, pct, sf, impactColor, normalise } from '../lib/utils'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

const METRICS = {
  total_impact: { label: 'Total Impact', color: '#a78bfa' },
  attack_impact: { label: 'Attack Impact', color: '#f0b429' },
  transition_impact: { label: 'Transition', color: '#4a9eff' },
  defensive_impact: { label: 'Defence', color: '#3ecf8e' },
  pts: { label: 'Points', color: '#f0b429' },
  shoot_pct: { label: 'Shooting %', color: '#3ecf8e' },
  tackles: { label: 'Tackles', color: '#4a9eff' },
  forced_to: { label: 'Forced TO', color: '#3ecf8e' },
  ipm: { label: 'Impact/60', color: '#a78bfa' },
  simple_pass: { label: 'Simple Passes', color: '#4a9eff' },
  adv_pass: { label: 'Advance Passes', color: '#4a9eff' },
  dne: { label: 'DNE', color: '#f06060' },
}

export default function CoachDashboard() {
  const { logout } = useAuth()
  const [tab, setTab] = useState('squad')
  const [allStats, setAllStats] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchFilter, setMatchFilter] = useState('all')
  const [posFilter, setPosFilter] = useState('All')
  const [metric, setMetric] = useState('total_impact')
  const [compareP1, setCompareP1] = useState(null)
  const [compareP2, setCompareP2] = useState(null)
  const [matchView, setMatchView] = useState('AFL 1')

  useEffect(() => {
    Promise.all([
      supabase.from('player_stats').select('*'),
      supabase.from('players').select('name,position,irish_name,dob'),
    ]).then(([{ data: stats }, { data: pls }]) => {
      setAllStats(stats || [])
      setPlayers(pls || [])
      setLoading(false)
    })
  }, [])

  const getSquadStats = (mf) => {
    const filter = mf || matchFilter
    return players.map(p => {
      const rows = allStats.filter(r => r.player_name === p.name && (filter === 'all' || r.match_id === filter))
      if (!rows.length) return null
      const mc = [...new Set(rows.map(r => r.match_id))].length || 1
      const mins = rows.reduce((s, r) => s + n(r.total_minutes), 0)
      if (!mins) return null
      const ti = r1(rows.reduce((s, r) => s + n(r.total_impact), 0))
      const ai = r1(rows.reduce((s, r) => s + n(r.attack_impact), 0))
      const tri = r1(rows.reduce((s, r) => s + n(r.transition_impact), 0))
      const di = r1(rows.reduce((s, r) => s + n(r.defensive_impact), 0))
      const p1s = sf(rows, 'one_pointer_scored') + sf(rows, 'one_pointer_scored_f')
      const p2s = sf(rows, 'two_pointer_scored') + sf(rows, 'two_pointer_scored_f')
      const gs2 = sf(rows, 'goals_scored') + sf(rows, 'goals_scored_f')
      const pts = p1s + p2s * 2 + gs2 * 3
      const att = sf(rows, 'one_pointer_attempts') + sf(rows, 'one_pointer_attempts_f') +
        sf(rows, 'two_pointer_attempts') + sf(rows, 'two_pointer_attempts_f') +
        sf(rows, 'goal_attempts') + sf(rows, 'goal_attempts_f')
      return {
        name: p.name, position: p.position, mc, mins,
        total_impact: ti, attack_impact: ai, transition_impact: tri, defensive_impact: di,
        pts, shoot_pct: pct(p1s + p2s + gs2, att),
        tackles: sf(rows, 'tackles'), forced_to: sf(rows, 'forced_to_win'),
        dne: sf(rows, 'dne'), simple_pass: sf(rows, 'simple_pass'),
        adv_pass: sf(rows, 'advance_pass'),
        ipm: mins > 0 ? r1(ti / mins * 60) : 0,
      }
    }).filter(Boolean)
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="spinner" /></div>

  const squadStats = getSquadStats()

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg4)', border: '2px solid var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--blue)', flexShrink: 0 }}>MGR</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>Coach Dashboard</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Ballyboden St Enda's · AFL 2026</div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>Sign Out</button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ top: 61 }}>
        {['squad', 'compare', 'match'].map(t => (
          <button key={t} className={`tab${tab === t ? ' coach-active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: 14 }}>
        {tab === 'squad' && (
          <SquadTab squadStats={squadStats} matchFilter={matchFilter} setMatchFilter={setMatchFilter}
            posFilter={posFilter} setPosFilter={setPosFilter} metric={metric} setMetric={setMetric}
            onPickPlayer={(name) => { setCompareP1(name); setCompareP2(null); setTab('compare') }} />
        )}
        {tab === 'compare' && (
          <CompareTab squadStats={squadStats} compareP1={compareP1} compareP2={compareP2}
            setCompareP1={setCompareP1} setCompareP2={setCompareP2} />
        )}
        {tab === 'match' && (
          <MatchViewTab allStats={allStats} players={players} matchView={matchView} setMatchView={setMatchView} />
        )}
      </div>
    </div>
  )
}

// ─── SQUAD TAB ───────────────────────────────────────────────────────────────
function SquadTab({ squadStats, matchFilter, setMatchFilter, posFilter, setPosFilter, metric, setMetric, onPickPlayer }) {
  let filtered = posFilter === 'All' ? squadStats : squadStats.filter(p => p.position === posFilter)
  filtered = [...filtered].sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
  const maxVal = filtered.length ? Math.max(...filtered.map(p => p[metric] || 0), 1) : 1
  const color = METRICS[metric]?.color || 'var(--blue)'
  const label = METRICS[metric]?.label || metric

  return (
    <div className="fade-in">
      {/* Match filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 11, scrollbarWidth: 'none' }}>
        {['all', ...MATCHES].map(m => (
          <button key={m} className={`pill${matchFilter === m ? '' : ''}`}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${m === matchFilter ? 'var(--blue)' : 'var(--border)'}`, background: m === matchFilter ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: m === matchFilter ? 'var(--blue)' : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}
            onClick={() => setMatchFilter(m)}>{m === 'all' ? 'All' : m}</button>
        ))}
      </div>

      {/* Position filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 11, flexWrap: 'wrap' }}>
        {['All', 'Forward', 'Defender', 'Midfield', 'Goalkeeper'].map(pos => {
          const pc = POS_COLORS[pos] || 'var(--text2)'
          const on = pos === posFilter
          return (
            <button key={pos} onClick={() => setPosFilter(pos)}
              style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? pc : 'var(--border)'}`, background: on ? 'rgba(255,255,255,0.04)' : 'var(--bg2)', color: on ? pc : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
              {pos}
            </button>
          )
        })}
      </div>

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 5, marginBottom: 12, scrollbarWidth: 'none' }}>
        {Object.entries(METRICS).map(([k, { label: l, color: c }]) => (
          <button key={k} onClick={() => setMetric(k)}
            style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${k === metric ? c : 'var(--border)'}`, background: k === metric ? 'rgba(255,255,255,0.04)' : 'var(--bg2)', color: k === metric ? c : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <span style={{ color }}>{label}</span>
          <span>{filtered.length} players{posFilter !== 'All' ? ` · ${posFilter}` : ''}</span>
        </div>
        {filtered.map((p, i) => {
          const val = p[metric] || 0
          const bw = maxVal > 0 ? Math.max(0, Math.min(100, (val / maxVal) * 100)) : 0
          const posColor = POS_COLORS[p.position] || 'var(--text2)'
          const rankColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text3)'
          return (
            <div key={p.name} onClick={() => onPickPlayer(p.name)}
              style={{ padding: '9px 14px', borderTop: '1px solid rgba(26,51,86,0.35)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700, color: rankColor, minWidth: 18, textAlign: 'center' }}>{i + 1}</div>
                <Avatar name={p.name} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: posColor }}>{p.position} · {p.mc}gm · {p.mins}min</div>
                </div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, color, minWidth: 44, textAlign: 'right' }}>{val}</div>
              </div>
              <div style={{ marginTop: 5, marginLeft: 58, height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
                <div style={{ width: `${bw}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── COMPARE TAB ─────────────────────────────────────────────────────────────
function CompareTab({ squadStats, compareP1, compareP2, setCompareP1, setCompareP2 }) {
  const s1 = compareP1 ? squadStats.find(p => p.name === compareP1) : null
  const s2 = compareP2 ? squadStats.find(p => p.name === compareP2) : null

  const pickPlayer = (name) => {
    if (!compareP1) { setCompareP1(name); return }
    if (!compareP2 && name !== compareP1) { setCompareP2(name); return }
    setCompareP1(name); setCompareP2(null)
  }

  const radarData = s1 && s2 ? [
    { subject: 'Attack', p1: normalise(s1.attack_impact, squadStats.map(p => p.attack_impact)), p2: normalise(s2.attack_impact, squadStats.map(p => p.attack_impact)) },
    { subject: 'Transition', p1: normalise(s1.transition_impact, squadStats.map(p => p.transition_impact)), p2: normalise(s2.transition_impact, squadStats.map(p => p.transition_impact)) },
    { subject: 'Defence', p1: normalise(s1.defensive_impact, squadStats.map(p => p.defensive_impact)), p2: normalise(s2.defensive_impact, squadStats.map(p => p.defensive_impact)) },
    { subject: 'Points', p1: normalise(s1.pts, squadStats.map(p => p.pts)), p2: normalise(s2.pts, squadStats.map(p => p.pts)) },
    { subject: 'Shooting', p1: normalise(s1.shoot_pct, squadStats.map(p => p.shoot_pct)), p2: normalise(s2.shoot_pct, squadStats.map(p => p.shoot_pct)) },
    { subject: 'Tackles', p1: normalise(s1.tackles, squadStats.map(p => p.tackles)), p2: normalise(s2.tackles, squadStats.map(p => p.tackles)) },
  ] : []

  const compareMetrics = [
    { key: 'total_impact', label: 'Total Impact', color: '#a78bfa' },
    { key: 'attack_impact', label: 'Attack Impact', color: '#f0b429' },
    { key: 'transition_impact', label: 'Transition', color: '#4a9eff' },
    { key: 'defensive_impact', label: 'Defence', color: '#3ecf8e' },
    { key: 'pts', label: 'Points', color: '#f0b429' },
    { key: 'shoot_pct', label: 'Shooting %', color: '#3ecf8e' },
    { key: 'tackles', label: 'Tackles', color: '#4a9eff' },
    { key: 'forced_to', label: 'Forced TO', color: '#3ecf8e' },
    { key: 'ipm', label: 'Impact/60min', color: '#a78bfa' },
  ]

  return (
    <div className="fade-in">
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Select two players to compare</div>

      {/* Slots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[{ p: s1, slot: 1, color: '#f0b429', set: () => setCompareP1(null) }, { p: s2, slot: 2, color: '#4a9eff', set: () => setCompareP2(null) }].map(({ p, slot, color, set }) => (
          <div key={slot} onClick={set} style={{ border: `1px solid ${p ? color : 'var(--border)'}`, borderRadius: 10, padding: 10, cursor: 'pointer', background: 'var(--bg2)', textAlign: 'center' }}>
            {p ? (
              <>
                <Avatar name={p.name} size={36} style={{ margin: '0 auto 6px', borderColor: color }} />
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name.split(' ')[1] || p.name}</div>
                <div style={{ fontSize: 10, color: POS_COLORS[p.position] || 'var(--text2)' }}>{p.position}</div>
              </>
            ) : (
              <div style={{ padding: 8 }}>
                <div style={{ fontSize: 22, color: 'var(--border)' }}>+</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Player {slot}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {(!s1 || !s2) && (
        <>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Pick from squad</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {[...squadStats].sort((a, b) => b.total_impact - a.total_impact).map(p => {
              const isSel = p.name === compareP1 || p.name === compareP2
              const posColor = POS_COLORS[p.position] || 'var(--text2)'
              return (
                <div key={p.name} onClick={() => pickPlayer(p.name)}
                  style={{ border: `1px solid ${isSel ? posColor : 'var(--border)'}`, borderRadius: 9, padding: 9, cursor: 'pointer', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={p.name} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: posColor }}>{p.position}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {s1 && s2 && (
        <>
          {/* Spider chart */}
          <div className="card" style={{ padding: 14, marginBottom: 13 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Impact Profile</div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="rgba(26,51,86,0.6)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text2)', fontSize: 11 }} />
                <Radar name={s1.name.split(' ')[0]} dataKey="p1" stroke="#f0b429" fill="#f0b429" fillOpacity={0.15} strokeWidth={2} />
                <Radar name={s2.name.split(' ')[0]} dataKey="p2" stroke="#4a9eff" fill="#4a9eff" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
              {[s1, s2].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: i === 0 ? '#f0b429' : '#4a9eff' }} />
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{s.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side by side bars */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: 13 }}>
            <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 6 }}>
              <div>Metric</div>
              <div style={{ color: '#f0b429', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s1.name.split(' ')[0]}</div>
              <div style={{ color: '#4a9eff', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s2.name.split(' ')[0]}</div>
            </div>
            {compareMetrics.map(m => {
              const v1 = s1[m.key] || 0, v2 = s2[m.key] || 0
              const maxV = Math.max(v1, v2, 1)
              const w1 = Math.round(v1 / maxV * 100), w2 = Math.round(v2 / maxV * 100)
              return (
                <div key={m.key} style={{ padding: '8px 14px', borderTop: '1px solid rgba(26,51,86,0.3)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>{m.label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${w1}%`, height: '100%', background: '#f0b429', borderRadius: 3 }} /></div>
                      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${w2}%`, height: '100%', background: '#4a9eff', borderRadius: 3 }} /></div>
                    </div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 800, textAlign: 'center', color: v1 > v2 ? '#f0b429' : 'var(--text3)' }}>{v1}</div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 800, textAlign: 'center', color: v2 > v1 ? '#4a9eff' : 'var(--text3)' }}>{v2}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={() => { setCompareP1(null); setCompareP2(null) }}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 20px', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
              Clear comparison
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── MATCH VIEW TAB ──────────────────────────────────────────────────────────
function MatchViewTab({ allStats, players, matchView, setMatchView }) {
  const matchRows = allStats.filter(r => r.match_id === matchView && n(r.total_minutes) > 0)
    .sort((a, b) => n(b.total_impact) - n(a.total_impact))

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {MATCHES.map(m => {
          const on = m === matchView
          return (
            <button key={m} onClick={() => setMatchView(m)}
              style={{ padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? 'var(--blue)' : 'var(--border)'}`, background: on ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: on ? 'var(--blue)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
              <div>{m}</div>
              <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{OPP[m]}</div>
            </button>
          )
        })}
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
          const p1 = n(r.one_pointer_scored) + n(r.one_pointer_scored_f)
          const p2 = n(r.two_pointer_scored) + n(r.two_pointer_scored_f)
          const g = n(r.goals_scored) + n(r.goals_scored_f)
          const pts = p1 + p2 * 2 + g * 3
          const ppos = players.find(p => p.name === r.player_name)?.position || ''
          const posColor = POS_COLORS[ppos] || 'var(--text2)'
          return (
            <div key={r.id} style={{ padding: '8px 12px', borderTop: '1px solid rgba(26,51,86,0.3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 36px 36px 36px 36px 40px', gap: 4, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.player_name}</div>
                  <div style={{ fontSize: 9, color: posColor }}>{ppos}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{n(r.total_minutes)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0b429', textAlign: 'center' }}>{ai}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4a9eff', textAlign: 'center' }}>{ti}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3ecf8e', textAlign: 'center' }}>{di}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0b429', textAlign: 'center' }}>{pts || '—'}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, textAlign: 'right', color: impactColor(imp) }}>{imp}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
