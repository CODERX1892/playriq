import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import { MATCHES, OPP, POS_COLORS, n, r1, pct, sf, impactColor, normalise } from '../lib/utils'
import DataEntry from './DataEntry'
import AdminPanel from './AdminPanel'
import Glossary from './Glossary'
import PrivacyPolicy from './PrivacyPolicy'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

// p60Key = per/60 field, rawKey = total field, null = already a ratio
const METRICS = {
  ipm:               { label: 'Avg Impact/Game', color: '#a78bfa', p60Key: 'ipm',           rawKey: 'total_impact' },
  attack_impact:     { label: 'Attack Impact',   color: '#f0b429', p60Key: 'attack_p60',     rawKey: 'attack_impact' },
  transition_impact: { label: 'Transition',      color: '#4a9eff', p60Key: 'transition_p60', rawKey: 'transition_impact' },
  defensive_impact:  { label: 'Defence',         color: '#3ecf8e', p60Key: 'defence_p60',    rawKey: 'defensive_impact' },
  pts_p60:           { label: 'Points',          color: '#f0b429', p60Key: 'pts_p60',        rawKey: 'pts' },
  shoot_pct:         { label: 'Shooting %',      color: '#3ecf8e', p60Key: 'shoot_pct',      rawKey: null },
  tackles_p60:       { label: 'Tackles',         color: '#4a9eff', p60Key: 'tackles_p60',    rawKey: 'tackles' },
  forced_to_p60:     { label: 'Forced TO',       color: '#3ecf8e', p60Key: 'forced_to_p60',  rawKey: 'forced_to' },
  dne_p60:           { label: 'DNE',             color: '#f06060', p60Key: 'dne_p60',        rawKey: 'dne' },
  adv_pass_p60:      { label: 'Adv Passes',      color: '#4a9eff', p60Key: 'adv_pass_p60',   rawKey: 'adv_pass' },
  per:               { label: 'Pass Efficiency', color: '#4a9eff', p60Key: 'per',            rawKey: null },
  ko_our_p60:        { label: 'Our KOs',         color: '#3ecf8e', p60Key: 'ko_our_p60',     rawKey: null },
  ko_opp_p60:        { label: 'Opp KOs',         color: '#3ecf8e', p60Key: 'ko_opp_p60',     rawKey: null },
}

export default function CoachDashboard() {
  const { logout, appUser } = useAuth()
  const [tab, setTab] = useState('squad')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [changingPin, setChangingPin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [pinStatus, setPinStatus] = useState(null)
  const [allStats, setAllStats] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchFilter, setMatchFilter] = useState('all')
  const [posFilter, setPosFilter] = useState('All')
  const [metric, setMetric] = useState('ipm')
  const [viewMode, setViewMode] = useState('p60') // 'p60' | 'total'
  const [compareP1, setCompareP1] = useState(null)
  const [compareP2, setCompareP2] = useState(null)
  const [matchView, setMatchView] = useState('AFL 1')
  const [matchStatuses, setMatchStatuses] = useState({})
  const [publishing, setPublishing] = useState(false)
  const [pubStatus, setPubStatus] = useState(null)
  const [teamStats, setTeamStats] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('player_stats').select('*'),
      supabase.from('players').select('name,position,irish_name,dob,role'),
      supabase.from('match_status').select('*'),
      supabase.from('team_stats').select('*'),
    ]).then(([{ data: stats }, { data: pls }, { data: ms }, { data: ts }]) => {
      setAllStats(stats || [])
      setPlayers(pls || [])
      const msMap = {}
      if (ms) ms.forEach(m => { msMap[m.match_id] = m })
      setMatchStatuses(msMap)
      setTeamStats(ts || [])
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
        ipm: mc > 0 ? r1(ti / mc) : 0,
        attack_p60: mins > 0 ? r1(ai / mins * 60) : 0,
        transition_p60: mins > 0 ? r1(tri / mins * 60) : 0,
        defence_p60: mins > 0 ? r1(di / mins * 60) : 0,
        // Per 60 min metrics
        tackles_p60: mins > 0 ? r1(sf(rows,'tackles') / mins * 60) : 0,
        forced_to_p60: mins > 0 ? r1(sf(rows,'forced_to_win') / mins * 60) : 0,
        dne_p60: mins > 0 ? r1(sf(rows,'dne') / mins * 60) : 0,
        breach_p60: mins > 0 ? r1(sf(rows,'breach_1v1') / mins * 60) : 0,
        simple_pass_p60: mins > 0 ? r1(sf(rows,'simple_pass') / mins * 60) : 0,
        adv_pass_p60: mins > 0 ? r1(sf(rows,'advance_pass') / mins * 60) : 0,
        carries_p60: mins > 0 ? r1(sf(rows,'carries') / mins * 60) : 0,
        pts_p60: mins > 0 ? r1(pts / mins * 60) : 0,
        ko_our_p60: mins > 0 ? r1((sf(rows,'won_clean_p1_our')+sf(rows,'won_clean_p2_our')+sf(rows,'won_clean_p3_our')+sf(rows,'won_break_our')) / mins * 60) : 0,
        ko_opp_p60: mins > 0 ? r1((sf(rows,'won_clean_p1_opp')+sf(rows,'won_clean_p2_opp')+sf(rows,'won_clean_p3_opp')+sf(rows,'won_break_opp')) / mins * 60) : 0,
        ko_our_break_p60: mins > 0 ? r1(sf(rows,'won_break_our') / mins * 60) : 0,
        ko_opp_break_p60: mins > 0 ? r1(sf(rows,'won_break_opp') / mins * 60) : 0,
        duels_won_p60: mins > 0 ? r1(sf(rows,'defensive_duels_won') / mins * 60) : 0,
        assists_p60: mins > 0 ? r1((sf(rows,'assists_shots')+sf(rows,'assists_goals')+sf(rows,'assists_2pt')) / mins * 60) : 0,
        // EV per shot from play and frees
        ev_play: (() => {
          const p1s=sf(rows,'one_pointer_scored'),p1a=sf(rows,'one_pointer_attempts')
          const p2s=sf(rows,'two_pointer_scored'),p2a=sf(rows,'two_pointer_attempts')
          const gs=sf(rows,'goals_scored'),ga=sf(rows,'goal_attempts')
          const att=p1a+p2a+ga
          return att>0 ? Math.round((p1s*1+p2s*2+gs*3)/att*100)/100 : 0
        })(),
        ev_free: (() => {
          const f1s=sf(rows,'one_pointer_scored_f'),f1a=sf(rows,'one_pointer_attempts_f')
          const f2s=sf(rows,'two_pointer_scored_f'),f2a=sf(rows,'two_pointer_attempts_f')
          const fgs=sf(rows,'goals_scored_f'),fga=sf(rows,'goal_attempts_f')
          const att=f1a+f2a+fga
          return att>0 ? Math.round((f1s*1+f2s*2.5+fgs*4)/att*100)/100 : 0
        })(),
        // Pass Efficiency Rating
        per: (() => {
          const sp = sf(rows,'simple_pass'), ap = sf(rows,'advance_pass')
          const to = sf(rows,'turnovers_in_contact')+sf(rows,'turnover_skill_error')+sf(rows,'turnovers_kicked_away')+sf(rows,'drop_shorts')
          const denom = Math.max(sp + ap + to * 3, 1)
          return Math.round((sp * 1 + ap * 3) / denom * 100) / 100
        })(),
        adv_pct: (() => {
          const sp = sf(rows,'simple_pass'), ap = sf(rows,'advance_pass')
          return sp + ap > 0 ? Math.round(ap / (sp + ap) * 100) : 0
        })(),
      }
    }).filter(Boolean)
  }

  const handleChangePin = async () => {
    if (newPin.length !== 4) { setPinStatus('PIN must be 4 digits'); return }
    const { error } = await supabase.from('app_users').update({ pin: newPin }).eq('id', appUser.id)
    if (error) setPinStatus('Error: ' + error.message)
    else { setPinStatus('✓ PIN updated'); setNewPin(''); setTimeout(() => { setChangingPin(false); setPinStatus(null) }, 1500) }
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
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Ballyboden St Enda's · AFL 2026 · <span style={{ color: 'var(--border2)' }}>v0.4.0</span></div>
        </div>
        <button onClick={() => setChangingPin(v => !v)}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', marginRight: 4 }}>PIN</button>
        <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>Sign Out</button>
      </div>
      {changingPin && (
        <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', flex: 1 }}>New PIN (4 digits)</div>
          <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/,'').slice(0,4))}
            maxLength={4} type="password" placeholder="••••"
            style={{ width: 70, padding: '6px 8px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontSize: 16, fontFamily: 'Barlow Condensed', fontWeight: 700, textAlign: 'center', outline: 'none', letterSpacing: 4 }} />
          <button onClick={handleChangePin}
            style={{ padding: '6px 12px', background: 'rgba(62,207,142,0.12)', border: '1px solid var(--teal)', borderRadius: 6, color: 'var(--teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>Save</button>
          {pinStatus && <div style={{ fontSize: 11, color: pinStatus.startsWith('✓') ? 'var(--teal)' : 'var(--red)' }}>{pinStatus}</div>}
        </div>
      )}

      {/* Tabs — two rows of 5 so nothing is hidden */}
      {(() => {
        const COACH_TABS = ['squad', 'compare', 'match', 'team', 'kickouts', 'turnovers', 'entry', 'publish', 'admin', 'glossary']
        const label = t => t === 'entry' ? 'Data' : t === 'kickouts' ? 'Kickouts' : t === 'turnovers' ? 'TOs' : t === 'publish' ? 'Publish' : t === 'admin' ? 'Admin' : t === 'glossary' ? 'Guide' : t === 'team' ? 'Team' : t.charAt(0).toUpperCase() + t.slice(1)
        return (
          <div style={{ position: 'sticky', top: 61, zIndex: 39, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {COACH_TABS.slice(0, 5).map(t => (
                <button key={t} className={`tab${tab === t ? ' coach-active' : ''}`} onClick={() => setTab(t)}>{label(t)}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderTop: '1px solid rgba(26,51,86,0.3)' }}>
              {COACH_TABS.slice(5).map(t => (
                <button key={t} className={`tab${tab === t ? ' coach-active' : ''}`} onClick={() => setTab(t)}>{label(t)}</button>
              ))}
            </div>
          </div>
        )
      })()}

      <div style={{ padding: 14 }}>
        {tab === 'squad' && (
          selectedPlayer
            ? <PlayerDetailView
                name={selectedPlayer}
                allStats={allStats}
                players={players}
                onBack={() => setSelectedPlayer(null)}
                onCompare={(name) => { setCompareP1(name); setCompareP2(null); setTab('compare') }}
              />
            : <SquadTab squadStats={squadStats} matchFilter={matchFilter} setMatchFilter={setMatchFilter}
                posFilter={posFilter} setPosFilter={setPosFilter} metric={metric} setMetric={setMetric}
                viewMode={viewMode} setViewMode={setViewMode}
                onPickPlayer={(name) => setSelectedPlayer(name)} />
        )}
        {tab === 'compare' && (
          <CompareTab squadStats={squadStats} compareP1={compareP1} compareP2={compareP2}
            setCompareP1={setCompareP1} setCompareP2={setCompareP2} />
        )}
        {tab === 'match' && (
          <MatchViewTab allStats={allStats} players={players} matchView={matchView} setMatchView={setMatchView} />
        )}
        {tab === 'team' && <TeamStatsTab teamStats={teamStats} />}
        {tab === 'kickouts' && <KickoutsTab allStats={allStats} players={players} />}
        {tab === 'turnovers' && <TurnoversTab allStats={allStats} players={players} />}
        {tab === 'entry' && <DataEntry />}
        {tab === 'publish' && <PublishTab matchStatuses={matchStatuses} setMatchStatuses={setMatchStatuses} appUser={appUser} allStats={allStats} />}
        {tab === 'admin' && <AdminPanel />}
        {tab === 'glossary' && <Glossary />}
        {tab === 'privacy' && <div style={{padding:14}}><PrivacyPolicy /></div>}
        {/* Privacy footer link */}
        {tab !== 'privacy' && (
          <div style={{ textAlign: 'center', padding: '20px 0 8px', borderTop: '1px solid rgba(26,51,86,0.2)', marginTop: 8 }}>
            <button onClick={() => setTab('privacy')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 10, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
              Privacy Policy
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SQUAD TAB ───────────────────────────────────────────────────────────────
function SquadTab({ squadStats, matchFilter, setMatchFilter, posFilter, setPosFilter, metric, setMetric, viewMode, setViewMode, onPickPlayer }) {
  const metricDef = METRICS[metric] || {}
  // In p60 mode use per/60 key, in total mode use raw key
  const displayKey = viewMode === 'p60' ? (metricDef.p60Key || metric) : (metricDef.rawKey || metricDef.p60Key || metric)
  const secondaryKey = viewMode === 'p60' ? null : metricDef.p60Key  // show /60 as pill in total view

  let filtered = posFilter === 'All' ? squadStats : squadStats.filter(p => p.position === posFilter)
  filtered = [...filtered].sort((a, b) => (b[displayKey] || 0) - (a[displayKey] || 0))
  const maxVal = filtered.length ? Math.max(...filtered.map(p => p[displayKey] || 0), 1) : 1
  const color = metricDef.color || 'var(--blue)'
  const label = metricDef.label || metric

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

      {/* View mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>View:</span>
        {[['p60', 'Per 60 min'], ['total', 'Totals']].map(([mode, mLabel]) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${viewMode === mode ? 'var(--blue)' : 'var(--border)'}`, background: viewMode === mode ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: viewMode === mode ? 'var(--blue)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
            {mLabel}
          </button>
        ))}
      </div>

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
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
          const val = p[displayKey] || 0
          const secondaryVal = secondaryKey ? p[secondaryKey] : null
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: posColor }}>{p.position} · {p.mc}gm · {p.mins}min</span>
                    {secondaryVal > 0 && (
                      <span style={{ fontSize: 9, color: 'var(--text3)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 5px' }}>{secondaryVal}/60</span>
                    )}
                  </div>
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

// ─── PLAYER DETAIL VIEW ──────────────────────────────────────────────────────
function PlayerDetailView({ name, allStats, players, onBack, onCompare }) {
  const [selectedMatch, setSelectedMatch] = useState(null)
  const playerRows = allStats.filter(r => r.player_name === name)
  const player = players.find(p => p.name === name) || {}
  const posColor = POS_COLORS[player.position] || 'var(--text2)'
  const mc = [...new Set(playerRows.map(r => r.match_id))].length
  const mins = playerRows.reduce((s, r) => s + n(r.total_minutes), 0)

  const ai = r1(playerRows.reduce((s, r) => s + n(r.attack_impact), 0))
  const ti = r1(playerRows.reduce((s, r) => s + n(r.transition_impact), 0))
  const di = r1(playerRows.reduce((s, r) => s + n(r.defensive_impact), 0))
  const tot = r1(playerRows.reduce((s, r) => s + n(r.total_impact), 0))

  // Shooting
  const p1s = playerRows.reduce((s,r) => s+n(r.one_pointer_scored),0)
  const p1w = playerRows.reduce((s,r) => s+n(r.one_pointer_wide),0)
  const p1ds = playerRows.reduce((s,r) => s+n(r.one_pointer_drop_short_block),0)
  const p1a = p1s+p1w+p1ds
  const p2s = playerRows.reduce((s,r) => s+n(r.two_pointer_scored),0)
  const p2w = playerRows.reduce((s,r) => s+n(r.two_pointer_wide),0)
  const p2a = p2s+p2w
  const gs = playerRows.reduce((s,r) => s+n(r.goals_scored),0)
  const gw = playerRows.reduce((s,r) => s+n(r.goals_wide),0)
  const ga = gs+gw
  const f1s = playerRows.reduce((s,r) => s+n(r.one_pointer_scored_f),0)
  const f1a = playerRows.reduce((s,r) => s+n(r.one_pointer_attempts_f),0)
  const f2s = playerRows.reduce((s,r) => s+n(r.two_pointer_scored_f),0)
  const f2a = playerRows.reduce((s,r) => s+n(r.two_pointer_attempts_f),0)
  const fgs = playerRows.reduce((s,r) => s+n(r.goals_scored_f),0)
  const fga = playerRows.reduce((s,r) => s+n(r.goal_attempts_f),0)
  const totalAtt = p1a+f1a+p2a+f2a+ga+fga
  const totalScr = p1s+f1s+p2s+f2s+gs+fgs
  const pts = p1s+f1s+(p2s+f2s)*2+(gs+fgs)*3
  const sp = totalAtt > 0 ? Math.round((totalScr/totalAtt)*100) : 0
  const spColor = sp >= 60 ? 'var(--teal)' : sp >= 45 ? 'var(--gold)' : 'var(--red)'

  // Transition
  const simPass = playerRows.reduce((s,r) => s+n(r.simple_pass),0)
  const advPass = playerRows.reduce((s,r) => s+n(r.advance_pass),0)
  const carries = playerRows.reduce((s,r) => s+n(r.carries),0)
  const koOursClean = playerRows.reduce((s,r) => s+n(r.won_clean_p1_our)+n(r.won_clean_p2_our)+n(r.won_clean_p3_our),0)
  const koOursBreak = playerRows.reduce((s,r) => s+n(r.won_break_our),0)
  const koOppClean = playerRows.reduce((s,r) => s+n(r.won_clean_p1_opp)+n(r.won_clean_p2_opp)+n(r.won_clean_p3_opp),0)
  const koOppBreak = playerRows.reduce((s,r) => s+n(r.won_break_opp),0)

  // Defence
  const tackles = playerRows.reduce((s,r) => s+n(r.tackles),0)
  const forcedTO = playerRows.reduce((s,r) => s+n(r.forced_to_win),0)
  const kickawayTO = playerRows.reduce((s,r) => s+n(r.kickaway_to_received),0)
  const dne = playerRows.reduce((s,r) => s+n(r.dne),0)
  const breach = playerRows.reduce((s,r) => s+n(r.breach_1v1),0)
  const assists = playerRows.reduce((s,r) => s+n(r.assists_shots)+n(r.assists_goals)+n(r.assists_2pt),0)

  // Turnovers
  const toNeg = playerRows.reduce((s,r) => s+n(r.turnovers_in_contact)+n(r.turnover_skill_error)+n(r.turnovers_kicked_away),0)
  const dropShorts = playerRows.reduce((s,r) => s+n(r.drop_shorts),0)

  // If a match is selected drill into it
  if (selectedMatch) {
    const r = playerRows.find(row => row.match_id === selectedMatch)
    if (r) return <PlayerMatchDrillDown r={r} players={players} matchView={selectedMatch} onBack={() => setSelectedMatch(null)} />
  }

  const [expandedStat, setExpandedStat] = useState(null)

  const statRow = (label, val, color, perGame = true, field = null) => val > 0 ? (
    <div>
      <div
        onClick={() => field && setExpandedStat(expandedStat === field ? null : field)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 14px', borderTop: '1px solid rgba(26,51,86,0.2)', cursor: field ? 'pointer' : 'default' }}
        onMouseEnter={e => field && (e.currentTarget.style.background = 'var(--bg3)')}
        onMouseLeave={e => field && (e.currentTarget.style.background = '')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
          {field && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{expandedStat === field ? '▲' : '▾'}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {perGame && mc > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r1(val/mc)}/gm</span>}
          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, color }}>{val}</span>
        </div>
      </div>
      {field && expandedStat === field && (
        <div style={{ background: 'rgba(26,51,86,0.2)', padding: '6px 14px 8px' }}>
          {MATCHES.map(m => {
            const r = playerRows.find(row => row.match_id === m)
            const v = r ? n(r[field]) : null
            return (
              <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(26,51,86,0.2)' }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m} <span style={{ color: 'var(--text3)', fontSize: 10 }}>{OPP[m]}</span></span>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 15, fontWeight: 700, color: v > 0 ? color : 'var(--text3)' }}>{v === null ? 'DNP' : v > 0 ? v : '—'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  ) : null

  const sectionCard = (title, color, children) => (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
      <div className="card-header"><span style={{ color }}>{title}</span></div>
      {children}
    </div>
  )

  return (
    <div className="fade-in">
      {/* Back + Compare */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0 }}>
          ← Back to Squad
        </button>
        <button onClick={() => onCompare(name)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0 }}>
          Compare →
        </button>
      </div>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={name} size={48} />
            <div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{name}</div>
              <div style={{ fontSize: 10, color: posColor, marginTop: 4 }}>{player.position} · {mc} games · {mins} mins</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 36, fontWeight: 800, color: impactColor(tot), lineHeight: 1 }}>{tot}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Total Impact</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(26,51,86,0.4)' }}>
          {[['Attack', ai, 'var(--gold)'], ['Transition', ti, 'var(--blue)'], ['Defence', di, 'var(--teal)']].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shooting */}
      {totalAtt > 0 && sectionCard('Shooting', 'var(--gold)', <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px 28px 34px 34px', gap: 2, padding: '5px 13px 3px', borderBottom: '1px solid rgba(26,51,86,0.3)' }}>
          {['Type','Att','Scr','Wde','DS','%','EV'].map((h, i) => (
            <div key={h} style={{ fontSize: 9, color: ['var(--text3)','var(--text2)','var(--teal)','var(--red)','var(--gold)','var(--text3)','var(--purple)'][i], textAlign: i > 0 ? 'center' : 'left', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
          ))}
        </div>
        {[['1pt Play',p1a,p1s,p1w,p1ds,1],['2pt Play',p2a,p2s,p2w,0,2],['Goal Play',ga,gs,gw,0,3],
          f1a>0?['1pt Free',f1a,f1s,0,0,1]:null, f2a>0?['2pt Free',f2a,f2s,0,0,2]:null, fga>0?['Goal Free',fga,fgs,0,0,3]:null
        ].filter(Boolean).filter(([,a])=>a>0).map(([label,att,scr,wide,ds,shotPts]) => {
          const p = att>0?Math.round((scr/att)*100):0
          const pc = p>=60?'var(--teal)':p>=40?'var(--gold)':'var(--red)'
          const ev = att>0?Math.round((scr*shotPts/att)*100)/100:null
          const evc = ev===null?'var(--text3)':ev>=shotPts*0.65?'var(--teal)':ev>=shotPts*0.45?'var(--gold)':'var(--red)'
          return (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px 28px 34px 34px', gap: 2, padding: '7px 13px', borderTop: '1px solid rgba(26,51,86,0.25)', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{att}</div>
              <div style={{ fontSize: 12, color: 'var(--teal)', textAlign: 'center' }}>{scr}</div>
              <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{wide||'—'}</div>
              <div style={{ fontSize: 12, color: 'var(--gold)', textAlign: 'center' }}>{ds||'—'}</div>
              <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: pc }}>{p}%</div>
              <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: evc }}>{ev!==null?ev:'—'}</div>
            </div>
          )
        })}
        {assists > 0 && (
          <div style={{ padding: '8px 13px', borderTop: '1px solid rgba(26,51,86,0.3)', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Assists</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--purple)' }}>{assists}</div>
          </div>
        )}
      </>)}

      {/* Transition */}
      {sectionCard('Transition', 'var(--blue)', <>
        {statRow('Simple Passes', simPass, 'var(--blue)', true, 'simple_pass')}
        {statRow('Advance Passes', advPass, 'var(--blue)', true, 'advance_pass')}
        {statRow('Carries', carries, 'var(--blue)', true, 'carries')}
        {(koOursClean+koOursBreak) > 0 && statRow('Our KO Clean', koOursClean, 'var(--teal)', true, null)}
        {koOursBreak > 0 && statRow('Our KO Break Ball', koOursBreak, 'var(--teal)', true, 'won_break_our')}
        {(koOppClean) > 0 && statRow('Opp KO Clean', koOppClean, 'var(--blue)', true, null)}
      </>)}

      {/* Defence */}
      {(tackles+forcedTO+kickawayTO+dne+breach+koOppBreak) > 0 && sectionCard('Defence', 'var(--teal)', <>
        {statRow('Tackles', tackles, 'var(--blue)', true, 'tackles')}
        {statRow('Forced TO Won', forcedTO, 'var(--teal)', true, 'forced_to_win')}
        {statRow('Kickaway TO Won', kickawayTO, 'var(--teal)', true, 'kickaway_to_received')}
        {koOppBreak > 0 && statRow('Opp KO Break Won', koOppBreak, 'var(--teal)', true, 'won_break_opp')}
        {dne > 0 && statRow('DNE', dne, 'var(--red)', true, 'dne')}
        {breach > 0 && statRow('Breach 1v1', breach, 'var(--red)', true, 'breach_1v1')}
      </>)}

      {/* Turnovers Lost */}
      {(toNeg+dropShorts) > 0 && sectionCard('Turnovers Lost', 'var(--red)', <>
        {statRow('Contact/Skill/Kickaway', toNeg, 'var(--red)', true, null)}
        {statRow('Drop Shorts', dropShorts, 'var(--gold)', true, 'drop_shorts')}
      </>)}

      {/* Per game match breakdown */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
        <div className="card-header"><span style={{ color: 'var(--purple)' }}>Match by Match</span></div>
        {MATCHES.map(m => {
          const r = playerRows.find(row => row.match_id === m)
          if (!r) return (
            <div key={m} style={{ padding: '8px 14px', borderTop: '1px solid rgba(26,51,86,0.2)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{m}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>DNP</div>
            </div>
          )
          const imp = r1(n(r.total_impact))
          const mPts = n(r.one_pointer_scored)+n(r.one_pointer_scored_f)+(n(r.two_pointer_scored)+n(r.two_pointer_scored_f))*2+(n(r.goals_scored)+n(r.goals_scored_f))*3
          return (
            <div key={m} onClick={() => setSelectedMatch(m)} style={{ padding: '8px 14px', borderTop: '1px solid rgba(26,51,86,0.2)', display: 'grid', gridTemplateColumns: '1fr 44px 44px 44px 44px 44px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{m}<span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>{OPP[m]}</span><span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6 }}>›</span></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: impactColor(imp) }}>{imp}</div><div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase' }}>Imp</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{r1(n(r.attack_impact))}</div><div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase' }}>Atk</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{r1(n(r.transition_impact))}</div><div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase' }}>Trans</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>{r1(n(r.defensive_impact))}</div><div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase' }}>Def</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>{mPts||'—'}</div><div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase' }}>Pts</div></div>
            </div>
          )
        })}
      </div>
      <div style={{ height: 40 }} />
    </div>
  )
}

// ─── COMPARE TAB ─────────────────────────────────────────────────────────────
function CompareTab({ squadStats, compareP1, compareP2, setCompareP1, setCompareP2 }) {
  const [compareTab, setCompareTab] = useState('attack')
  const s1 = compareP1 ? squadStats.find(p => p.name === compareP1) : null
  const s2 = compareP2 ? squadStats.find(p => p.name === compareP2) : null

  const pickPlayer = (name) => {
    if (!compareP1) { setCompareP1(name); return }
    if (!compareP2 && name !== compareP1) { setCompareP2(name); return }
    setCompareP1(name); setCompareP2(null)
  }

  // Compare row helper
  const cRow = (label, k1, k2, color, unit = '') => {
    const v1 = s1?.[k1] ?? 0, v2 = s2?.[k2 || k1] ?? 0
    const maxV = Math.max(Math.abs(v1), Math.abs(v2), 0.01)
    const w1 = Math.round(Math.abs(v1) / maxV * 100)
    const w2 = Math.round(Math.abs(v2) / maxV * 100)
    const win1 = v1 > v2, win2 = v2 > v1
    return (
      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(26,51,86,0.3)' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 54px 54px', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${w1}%`, height: '100%', background: '#f0b429', borderRadius: 2 }} />
            </div>
            <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${w2}%`, height: '100%', background: '#4a9eff', borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, textAlign: 'center', color: win1 ? '#f0b429' : 'var(--text3)' }}>{v1}{unit}</div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, textAlign: 'center', color: win2 ? '#4a9eff' : 'var(--text3)' }}>{v2}{unit}</div>
        </div>
      </div>
    )
  }

  const COMPARE_TABS = [
    { id: 'attack', label: 'Attack & Scores', color: '#f0b429' },
    { id: 'defence', label: 'Defence', color: '#3ecf8e' },
    { id: 'transition', label: 'Transition', color: '#4a9eff' },
    { id: 'kickouts', label: 'Kickouts', color: '#a78bfa' },
    { id: 'physical', label: 'Physical', color: '#f06060' },
  ]

  const radarData = s1 && s2 ? [
    { subject: 'Attack', p1: normalise(s1.pts_p60, squadStats.map(p => p.pts_p60)), p2: normalise(s2.pts_p60, squadStats.map(p => p.pts_p60)) },
    { subject: 'Defence', p1: normalise(s1.defensive_impact, squadStats.map(p => p.defensive_impact)), p2: normalise(s2.defensive_impact, squadStats.map(p => p.defensive_impact)) },
    { subject: 'Transition', p1: normalise(s1.per, squadStats.map(p => p.per)), p2: normalise(s2.per, squadStats.map(p => p.per)) },
    { subject: 'KOs', p1: normalise(s1.ko_our_p60, squadStats.map(p => p.ko_our_p60)), p2: normalise(s2.ko_our_p60, squadStats.map(p => p.ko_our_p60)) },
    { subject: 'Shooting', p1: normalise(s1.shoot_pct, squadStats.map(p => p.shoot_pct)), p2: normalise(s2.shoot_pct, squadStats.map(p => p.shoot_pct)) },

  ] : []

  return (
    <div className="fade-in">
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Select two players to compare</div>

      {/* Player slots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[{ p: s1, slot: 1, color: '#f0b429', set: () => setCompareP1(null) }, { p: s2, slot: 2, color: '#4a9eff', set: () => setCompareP2(null) }].map(({ p, slot, color, set }) => (
          <div key={slot} onClick={set} style={{ border: `1px solid ${p ? color : 'var(--border)'}`, borderRadius: 10, padding: 10, cursor: 'pointer', background: 'var(--bg2)', textAlign: 'center' }}>
            {p ? (
              <>
                <Avatar name={p.name} size={36} />
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>{p.name.split(' ')[0]} {p.name.split(' ').slice(-1)}</div>
                <div style={{ fontSize: 10, color: POS_COLORS[p.position] || 'var(--text2)' }}>{p.position} · {p.mc}gm</div>
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
            {[...squadStats].sort((a, b) => b.ipm - a.ipm).map(p => {
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
          {/* Radar */}
          <div className="card" style={{ padding: 14, marginBottom: 13 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Overall Profile</div>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="rgba(26,51,86,0.6)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text2)', fontSize: 10 }} />
                <Radar name={s1.name.split(' ')[0]} dataKey="p1" stroke="#f0b429" fill="#f0b429" fillOpacity={0.15} strokeWidth={2} />
                <Radar name={s2.name.split(' ')[0]} dataKey="p2" stroke="#4a9eff" fill="#4a9eff" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 4 }}>
              {[s1, s2].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? '#f0b429' : '#4a9eff' }} />
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{s.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5, marginBottom: 12 }}>
            {COMPARE_TABS.map(t => (
              <button key={t.id} onClick={() => setCompareTab(t.id)}
                style={{ padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${compareTab === t.id ? t.color : 'var(--border)'}`, background: compareTab === t.id ? 'rgba(255,255,255,0.04)' : 'var(--bg2)', color: compareTab === t.id ? t.color : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div className="card" style={{ overflow: 'hidden', marginBottom: 13 }}>
            <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '1fr 54px 54px', gap: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Metric</div>
              <div style={{ color: '#f0b429', textAlign: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s1.name.split(' ')[0]}</div>
              <div style={{ color: '#4a9eff', textAlign: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s2.name.split(' ')[0]}</div>
            </div>

            {/* ATTACK & SCORES */}
            {compareTab === 'attack' && <>
              {cRow('Pts / 60 min', 'pts_p60', null, '#f0b429')}
              {cRow('Total Points', 'pts', null, '#f0b429')}
              {cRow('Shooting %', 'shoot_pct', null, '#3ecf8e', '%')}
              {cRow('EV / Shot (Play)', 'ev_play', null, '#f0b429')}
              {cRow('EV / Shot (Frees)', 'ev_free', null, '#a78bfa')}
              {cRow('Assists / 60', 'assists_p60', null, '#3ecf8e')}
              {cRow('Pass Efficiency', 'per', null, '#4a9eff')}
              {cRow('Avg Impact / Game', 'ipm', null, '#a78bfa')}
            </>}

            {/* DEFENCE */}
            {compareTab === 'defence' && <>
              {cRow('Tackles / 60', 'tackles_p60', null, '#4a9eff')}
              {cRow('Forced TO / 60', 'forced_to_p60', null, '#3ecf8e')}
              {cRow('Duels Won / 60', 'duels_won_p60', null, '#3ecf8e')}
              {cRow('DNE / 60', 'dne_p60', null, '#f06060')}
              {cRow('Breach 1v1 / 60', 'breach_p60', null, '#f06060')}
            </>}

            {/* TRANSITION */}
            {compareTab === 'transition' && <>
              {cRow('Adv Passes / 60', 'adv_pass_p60', null, '#4a9eff')}
              {cRow('Simple Passes / 60', 'simple_pass_p60', null, '#4a9eff')}
              {cRow('Carries / 60', 'carries_p60', null, '#4a9eff')}
              {cRow('Pass Efficiency', 'per', null, '#a78bfa')}
              {cRow('Adv Pass %', 'adv_pct', null, '#a78bfa', '%')}
            </>}

            {/* KICKOUTS */}
            {compareTab === 'kickouts' && <>
              {cRow('Our KO Wins / 60', 'ko_our_p60', null, '#3ecf8e')}
              {cRow('Our KO Breaks / 60', 'ko_our_break_p60', null, '#3ecf8e')}
              {cRow('Opp KO Wins / 60', 'ko_opp_p60', null, '#a78bfa')}
              {cRow('Opp KO Breaks / 60', 'ko_opp_break_p60', null, '#a78bfa')}
            </>}

            {/* PHYSICAL — GPS placeholder */}
            {compareTab === 'physical' && <>
              <div style={{ padding: '16px 14px', borderTop: '1px solid rgba(26,51,86,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f06060', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>GPS data coming soon</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Distance, speed, sprints and high intensity runs will appear once GPS is enabled</div>
                </div>
              </div>
              {cRow('Distance / game (km)', 'gps_distance', null, '#f06060')}
              {cRow('Top Speed (km/h)', 'gps_top_speed', null, '#f06060')}
              {cRow('Sprint Count', 'gps_sprints', null, '#f06060')}
              {cRow('High Intensity Runs', 'gps_hir', null, '#f06060')}
            </>}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
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
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const matchRows = allStats.filter(r => r.match_id === matchView && n(r.total_minutes) > 0)
    .sort((a, b) => n(b.total_impact) - n(a.total_impact))

  const selectedRow = selectedPlayer ? matchRows.find(r => r.player_name === selectedPlayer) : null

  if (selectedRow) {
    return <PlayerMatchDrillDown r={selectedRow} players={players} matchView={matchView} onBack={() => setSelectedPlayer(null)} />
  }

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
            <div key={r.id} onClick={() => setSelectedPlayer(r.player_name)}
              style={{ padding: '8px 12px', borderTop: '1px solid rgba(26,51,86,0.3)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 36px 36px 36px 36px 40px', gap: 4, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.player_name}</div>
                  <div style={{ fontSize: 9, color: posColor }}>{ppos} · tap to drill down</div>
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

// ─── PLAYER MATCH DRILL-DOWN ──────────────────────────────────────────────────
function PlayerMatchDrillDown({ r, players, matchView, onBack }) {
  const ppos = players.find(p => p.name === r.player_name)?.position || ''
  const posColor = POS_COLORS[ppos] || 'var(--text2)'
  const imp = r1(n(r.total_impact))
  const ai = r1(n(r.attack_impact)), ti = r1(n(r.transition_impact)), di = r1(n(r.defensive_impact))

  // Shooting
  const p1s = n(r.one_pointer_scored), p1w = n(r.one_pointer_wide), p1ds = n(r.one_pointer_drop_short_block)
  const p1a = p1s + p1w + p1ds
  const p2s = n(r.two_pointer_scored), p2w = n(r.two_pointer_wide), p2ds = n(r.two_pointer_drop_short_block)
  const p2a = p2s + p2w + p2ds
  const gs = n(r.goals_scored), gw = n(r.goals_wide), gds = n(r.goal_drop_short_block)
  const ga = gs + gw + gds
  const f1s = n(r.one_pointer_scored_f), f1a = n(r.one_pointer_attempts_f)
  const f2s = n(r.two_pointer_scored_f), f2a = n(r.two_pointer_attempts_f)
  const fgs = n(r.goals_scored_f), fga = n(r.goal_attempts_f)
  const totalAtt = p1a + f1a + p2a + f2a + ga + fga
  const totalScored = p1s + f1s + p2s + f2s + gs + fgs
  const pts = p1s + f1s + (p2s + f2s) * 2 + (gs + fgs) * 3
  const shootPct = totalAtt > 0 ? Math.round((totalScored / totalAtt) * 100) : 0
  const assists = n(r.assists_shots) + n(r.assists_goals) + n(r.assists_2pt)

  // Kickouts
  const koOursClean = n(r.won_clean_p1_our) + n(r.won_clean_p2_our) + n(r.won_clean_p3_our)
  const koOursBreak = n(r.won_break_our)
  const koOppClean = n(r.won_clean_p1_opp) + n(r.won_clean_p2_opp) + n(r.won_clean_p3_opp)
  const koOppBreak = n(r.won_break_opp)

  // Defence
  const forcedTO = n(r.forced_to_win)
  const kickawayTO = n(r.kickaway_to_received)
  const tackles = n(r.tackles)
  const dne = n(r.dne)
  const breach = n(r.breach_1v1)

  // Turnovers lost
  const toContact = n(r.turnovers_in_contact)
  const toKickaway = n(r.turnovers_kicked_away)
  const toSkill = n(r.turnover_skill_error)
  const dropShorts = n(r.drop_shorts)
  const toNegTotal = toContact + toKickaway + toSkill

  const section = (title, color, items) => {
    const hasData = items.some(([,v]) => v > 0)
    if (!hasData) return null
    return (
      <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
        <div className="card-header"><span style={{ color }}>{title}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`, padding: '10px 14px', gap: 8 }}>
          {items.map(([label, val, c]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 24, fontWeight: 800, color: val > 0 ? (c || color) : 'var(--text3)', lineHeight: 1 }}>{val > 0 ? val : '—'}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Back button */}
      <button onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0, marginBottom: 14 }}>
        ← Back to {matchView}
      </button>

      {/* Player header */}
      <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{r.player_name}</div>
            <div style={{ fontSize: 10, color: posColor, marginTop: 4 }}>{ppos} · {n(r.total_minutes)} mins · {OPP[matchView]}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 36, fontWeight: 800, color: impactColor(imp), lineHeight: 1 }}>{imp}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Total Impact</div>
          </div>
        </div>
        {/* Impact breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(26,51,86,0.4)' }}>
          {[['Attack', ai, 'var(--gold)'], ['Transition', ti, 'var(--blue)'], ['Defence', di, 'var(--teal)']].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shooting */}
      {totalAtt > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
          <div className="card-header">
            <span style={{ color: 'var(--gold)' }}>Shooting</span>
            <span style={{ color: shootPct >= 60 ? 'var(--teal)' : shootPct >= 45 ? 'var(--gold)' : 'var(--red)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700 }}>{shootPct}%</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px 28px 34px 34px', gap: 2, padding: '5px 13px 3px', borderBottom: '1px solid rgba(26,51,86,0.3)' }}>
            {['Type','Att','Scr','Wde','DS','%','EV'].map((h, i) => (
              <div key={h} style={{ fontSize: 9, color: ['var(--text3)','var(--text2)','var(--teal)','var(--red)','var(--gold)','var(--text3)','var(--purple)'][i], textAlign: i > 0 ? 'center' : 'left', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
            ))}
          </div>
          {[
            ['1pt Play', p1a, p1s, p1w, p1ds, 1],
            ['2pt Play', p2a, p2s, p2w, p2ds, 2],
            ['Goal Play', ga, gs, gw, gds, 3],
            f1a > 0 ? ['1pt Free', f1a, f1s, 0, 0, 1] : null,
            f2a > 0 ? ['2pt Free', f2a, f2s, 0, 0, 2] : null,
            fga > 0 ? ['Goal Free', fga, fgs, 0, 0, 3] : null,
          ].filter(Boolean).filter(([,att]) => att > 0).map(([label, att, scr, wide, ds, shotPts]) => {
            const pct2 = att > 0 ? Math.round((scr / att) * 100) : 0
            const pc = pct2 >= 60 ? 'var(--teal)' : pct2 >= 40 ? 'var(--gold)' : 'var(--red)'
            const ev = att > 0 ? Math.round((scr * shotPts / att) * 100) / 100 : null
            const evc = ev === null ? 'var(--text3)' : ev >= shotPts * 0.65 ? 'var(--teal)' : ev >= shotPts * 0.45 ? 'var(--gold)' : 'var(--red)'
            return (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px 28px 34px 34px', gap: 2, padding: '7px 13px', borderTop: '1px solid rgba(26,51,86,0.25)', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{att}</div>
                <div style={{ fontSize: 12, color: 'var(--teal)', textAlign: 'center' }}>{scr}</div>
                <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{wide || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--gold)', textAlign: 'center' }}>{ds || '—'}</div>
                <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: att > 0 ? pc : 'var(--text3)' }}>{att > 0 ? `${pct2}%` : '—'}</div>
                <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: evc }}>{ev !== null ? ev : '—'}</div>
              </div>
            )
          })}
          {assists > 0 && (
            <div style={{ padding: '8px 13px', borderTop: '1px solid rgba(26,51,86,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Assists</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--purple)' }}>{assists}</div>
            </div>
          )}
        </div>
      )}

      {/* Kickouts */}
      {section('Kickouts', 'var(--blue)', [
        ['Our Clean', koOursClean, 'var(--teal)'],
        ['Our Break', koOursBreak, 'var(--teal)'],
        ['Opp Clean', koOppClean, 'var(--blue)'],
        ['Opp Break', koOppBreak, 'var(--blue)'],
      ])}

      {/* Defence Won */}
      {section('Defence — Won', 'var(--teal)', [
        ['Forced TO', forcedTO, 'var(--teal)'],
        ['Kickaway TO', kickawayTO, 'var(--teal)'],
        ['Tackles', tackles, 'var(--blue)'],
      ])}

      {/* Defence — Conceded */}
      {(dne > 0 || breach > 0) && section('Defence — Conceded', 'var(--red)', [
        ['DNE', dne, 'var(--red)'],
        ['Breach 1v1', breach, 'var(--red)'],
      ])}

      {/* Turnovers Lost */}
      {section('Turnovers Lost', 'var(--red)', [
        ['Contact', toContact, 'var(--red)'],
        ['Kickaway', toKickaway, 'var(--red)'],
        ['Skill Error', toSkill, 'var(--red)'],
        ['Drop Shorts', dropShorts, 'var(--gold)'],
      ])}

      {/* Points total */}
      {pts > 0 && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text3)', fontSize: 11 }}>
          {p1s > 0 && <span style={{ marginRight: 10 }}>1pt: <b style={{ color: 'var(--blue)' }}>{p1s}</b></span>}
          {p2s > 0 && <span style={{ marginRight: 10 }}>2pt: <b style={{ color: 'var(--purple)' }}>{p2s}</b></span>}
          {gs > 0 && <span style={{ marginRight: 10 }}>Goals: <b style={{ color: 'var(--teal)' }}>{gs}</b></span>}
          <span>Total: <b style={{ color: 'var(--gold)' }}>{pts}</b></span>
        </div>
      )}
    </div>
  )
}

// ─── KICKOUTS TAB ─────────────────────────────────────────────────────────────
function KickoutsTab({ allStats, players }) {
  const [matchView, setMatchView] = useState('AFL 1')
  const [matchStatuses, setMatchStatuses] = useState({})
  const [publishing, setPublishing] = useState(false)
  const [pubStatus, setPubStatus] = useState(null)
  const matchRows = allStats.filter(r => r.match_id === matchView && n(r.total_minutes) > 0)
    .sort((a, b) => n(b.total_minutes) - n(a.total_minutes))
  const getPos = (name) => players.find(p => p.name === name)?.position || ''
  const sumRow = (field) => matchRows.reduce((s, r) => s + n(r[field]), 0)

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {MATCHES.map(m => (
          <button key={m} onClick={() => setMatchView(m)} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${m === matchView ? 'var(--blue)' : 'var(--border)'}`, background: m === matchView ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: m === matchView ? 'var(--blue)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
            <div>{m}</div><div style={{ fontSize: 9, opacity: 0.7 }}>{OPP[m]}</div>
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 580 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)' }}>
              <th style={kth}>Player</th>
              <th style={{ ...kth, color: 'var(--teal)', borderLeft: '2px solid var(--border)' }} colSpan={6}>Our Kickouts</th>
              <th style={{ ...kth, color: 'var(--purple)', borderLeft: '2px solid var(--border)' }} colSpan={6}>Their Kickouts</th>
            </tr>
            <tr style={{ background: 'var(--bg3)' }}>
              <th style={kth}></th>
              {['P1','P2','P3','Break','C.Opp','C.Us'].map(l => (
                <th key={l} style={{ ...kth, color: 'var(--teal)', borderLeft: '1px solid rgba(26,51,86,0.4)', fontWeight: 400 }}>{l}</th>
              ))}
              {['P1','P2','P3','Break','C.Opp','C.Us'].map(l => (
                <th key={'t'+l} style={{ ...kth, color: 'var(--purple)', borderLeft: '1px solid rgba(26,51,86,0.4)', fontWeight: 400 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matchRows.map((r, i) => {
              const pos = getPos(r.player_name)
              const pc = POS_COLORS[pos] || 'var(--text2)'
              const ourF = ['won_clean_p1_our','won_clean_p2_our','won_clean_p3_our','won_break_our','our_ko_contest_opp','our_ko_contest_us']
              const theirF = ['won_clean_p1_opp','won_clean_p2_opp','won_clean_p3_opp','won_break_opp','their_ko_contest_opp','their_ko_contest_us']
              return (
                <tr key={r.player_name} style={{ background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderBottom: '1px solid rgba(26,51,86,0.2)' }}>
                  <td style={{ ...ktd, minWidth: 130 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.player_name}</div>
                    <div style={{ fontSize: 9, color: pc }}>{pos} · {n(r.total_minutes)}min</div>
                  </td>
                  {ourF.map((f, j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', color: n(r[f])>0?'var(--teal)':'var(--text3)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{n(r[f])>0?n(r[f]):'—'}</td>)}
                  {theirF.map((f, j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', color: n(r[f])>0?'var(--purple)':'var(--text3)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{n(r[f])>0?n(r[f]):'—'}</td>)}
                </tr>
              )
            })}
            <tr style={{ background: 'var(--bg4)', borderTop: '2px solid var(--border)' }}>
              <td style={{ ...ktd, fontWeight: 700, color: 'var(--text2)', fontSize: 11 }}>TOTAL</td>
              {['won_clean_p1_our','won_clean_p2_our','won_clean_p3_our','won_break_our','our_ko_contest_opp','our_ko_contest_us'].map((f,j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800, textAlign: 'center', color: 'var(--teal)' }}>{sumRow(f)||'—'}</td>)}
              {['won_clean_p1_opp','won_clean_p2_opp','won_clean_p3_opp','won_break_opp','their_ko_contest_opp','their_ko_contest_us'].map((f,j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800, textAlign: 'center', color: 'var(--purple)' }}>{sumRow(f)||'—'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── TURNOVERS TAB ────────────────────────────────────────────────────────────
function TurnoversTab({ allStats, players }) {
  const [matchView, setMatchView] = useState('AFL 1')
  const [matchStatuses, setMatchStatuses] = useState({})
  const [publishing, setPublishing] = useState(false)
  const [pubStatus, setPubStatus] = useState(null)
  const matchRows = allStats.filter(r => r.match_id === matchView && n(r.total_minutes) > 0)
    .sort((a, b) => n(b.total_minutes) - n(a.total_minutes))
  const getPos = (name) => players.find(p => p.name === name)?.position || ''
  const sumRow = (field) => matchRows.reduce((s, r) => s + n(r[field]), 0)

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {MATCHES.map(m => (
          <button key={m} onClick={() => setMatchView(m)} style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${m === matchView ? 'var(--blue)' : 'var(--border)'}`, background: m === matchView ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: m === matchView ? 'var(--blue)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
            <div>{m}</div><div style={{ fontSize: 9, opacity: 0.7 }}>{OPP[m]}</div>
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)' }}>
              <th style={kth}>Player</th>
              <th style={{ ...kth, color: 'var(--teal)', borderLeft: '2px solid var(--border)' }} colSpan={3}>Turnovers Won</th>
              <th style={{ ...kth, color: 'var(--red)', borderLeft: '2px solid var(--border)' }} colSpan={7}>Turnovers Lost</th>
            </tr>
            <tr style={{ background: 'var(--bg3)' }}>
              <th style={kth}></th>
              {['Tackles','Forced TO','Kickaway TO'].map(l => <th key={l} style={{ ...kth, color: 'var(--teal)', borderLeft: '1px solid rgba(26,51,86,0.4)', fontWeight: 400 }}>{l}</th>)}
              {['Contact','Skill Err','Kicked Away','Drop Shts','1pt DS','2pt DS','Goal DS'].map(l => <th key={l} style={{ ...kth, color: 'var(--red)', borderLeft: '1px solid rgba(26,51,86,0.4)', fontWeight: 400 }}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {matchRows.map((r, i) => {
              const pos = getPos(r.player_name)
              const pc = POS_COLORS[pos] || 'var(--text2)'
              const wonF = ['tackles','forced_to_win','kickaway_to_received']
              const lostF = ['turnovers_in_contact','turnover_skill_error','turnovers_kicked_away','drop_shorts','one_pointer_drop_short_block','two_pointer_drop_short_block','goal_drop_short_block']
              return (
                <tr key={r.player_name} style={{ background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderBottom: '1px solid rgba(26,51,86,0.2)' }}>
                  <td style={{ ...ktd, minWidth: 130 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.player_name}</div>
                    <div style={{ fontSize: 9, color: pc }}>{pos} · {n(r.total_minutes)}min</div>
                  </td>
                  {wonF.map((f, j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', color: n(r[f])>0?'var(--teal)':'var(--text3)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{n(r[f])>0?n(r[f]):'—'}</td>)}
                  {lostF.map((f, j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', color: n(r[f])>0?'var(--red)':'var(--text3)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{n(r[f])>0?n(r[f]):'—'}</td>)}
                </tr>
              )
            })}
            <tr style={{ background: 'var(--bg4)', borderTop: '2px solid var(--border)' }}>
              <td style={{ ...ktd, fontWeight: 700, color: 'var(--text2)', fontSize: 11 }}>TOTAL</td>
              {['tackles','forced_to_win','kickaway_to_received'].map((f,j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800, textAlign: 'center', color: 'var(--teal)' }}>{sumRow(f)||'—'}</td>)}
              {['turnovers_in_contact','turnover_skill_error','turnovers_kicked_away','drop_shorts','one_pointer_drop_short_block','two_pointer_drop_short_block','goal_drop_short_block'].map((f,j) => <td key={f} style={{ ...ktd, borderLeft: j===0?'2px solid var(--border)':'1px solid rgba(26,51,86,0.2)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800, textAlign: 'center', color: 'var(--red)' }}>{sumRow(f)||'—'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── TEAM STATS TAB ───────────────────────────────────────────────────────────
const TARGETS = {
  possessions:        { label: 'Possessions',       target: 40,    higher: true,  format: v => v },
  possession_pct:     { label: 'Poss → Attack %',   target: 0.9,   higher: true,  format: v => Math.round(v*100)+'%' },
  attack_pct:         { label: 'Attack → Shot %',   target: 0.75,  higher: true,  format: v => Math.round(v*100)+'%' },
  shot_pct:           { label: 'Shot → Score %',    target: 0.65,  higher: true,  format: v => Math.round(v*100)+'%' },
  overall_shot_pct:   { label: 'Overall Shot %',    target: 0.543, higher: true,  format: v => Math.round(v*100)+'%' },
  pct_from_play:      { label: 'Play Conv %',       target: null,  higher: true,  format: v => Math.round(v*100)+'%' },
  pct_from_frees:     { label: 'Free Conv %',       target: null,  higher: true,  format: v => Math.round(v*100)+'%' },
  ko_overall_win_pct: { label: 'KO Win %',          target: 0.66,  higher: true,  format: v => Math.round(v*100)+'%' },
  turnover_ratio:     { label: 'TO Ratio',          target: 0.3,   higher: false, format: v => Math.round(v*100)+'%' },
  intensity_index:    { label: 'Intensity Index',   target: 1.14,  higher: true,  format: v => v?.toFixed(2) },
}

const SECTIONS = [
  {
    label: 'Possession & Scoring', color: '#f0b429',
    rows: [
      { key: 'possessions',    label: 'Possessions' },
      { key: 'attacks',        label: 'Attacks',       format: v => v },
      { key: 'shots',          label: 'Shots',         format: v => v },
      { key: 'scores',         label: 'Scores',        format: v => v },
      { key: 'possession_pct', label: 'Poss → Atk %',  format: v => Math.round(v*100)+'%' },
      { key: 'attack_pct',     label: 'Atk → Shot %',  format: v => Math.round(v*100)+'%' },
      { key: 'shot_pct',       label: 'Shot → Score %',format: v => Math.round(v*100)+'%' },
    ]
  },
  {
    label: 'Shooting', color: '#3ecf8e',
    rows: [
      { key: 'shots_from_play',  label: 'Play Shots' },
      { key: 'scores_from_play', label: 'Play Scores' },
      { key: 'pct_from_play',    label: 'Play Conv %',  format: v => v != null ? Math.round(v*100)+'%' : '—' },
      { key: 'shots_from_frees', label: 'Free Shots' },
      { key: 'scores_from_frees',label: 'Free Scores' },
      { key: 'pct_from_frees',   label: 'Free Conv %',  format: v => v != null ? Math.round(v*100)+'%' : '—' },
      { key: 'overall_shot_pct', label: 'Overall %',    format: v => v != null ? Math.round(v*100)+'%' : '—' },
    ]
  },
  {
    label: 'Kickouts', color: '#4a9eff',
    rows: [
      { key: 'ko_total',          label: 'Total KOs' },
      { key: 'ko_won',            label: 'Won' },
      { key: 'ko_lost',           label: 'Lost' },
      { key: 'ko_won_pct',        label: 'Won %',   format: v => v != null ? Math.round(v*100)+'%' : '—' },
      { key: 'ko_overall_win_pct',label: 'Win % (Overall)', format: v => v != null ? Math.round(v*100)+'%' : '—' },
    ]
  },
  {
    label: 'Turnovers Won', color: '#3ecf8e',
    rows: [
      { key: 'turnovers_forced',   label: 'Forced Won' },
      { key: 'turnovers_unforced', label: 'Unforced Won' },
      { key: 'turnover_total',     label: 'Total Won' },
    ]
  },
  {
    label: 'Turnovers Lost', color: '#f06060',
    rows: [
      { key: 'turnovers_lost_forced',   label: 'Forced Lost' },
      { key: 'turnovers_lost_unforced', label: 'Unforced Lost' },
      { key: 'turnovers_lost_total',    label: 'Total Lost' },
      { key: 'turnover_ratio',          label: 'TO Ratio', format: v => v != null ? Math.round(v*100)+'%' : '—' },
    ]
  },
]

function trafficLight(key, usVal, targetInfo) {
  if (!targetInfo || targetInfo.target == null || usVal == null) return null
  const met = targetInfo.higher ? usVal >= targetInfo.target : usVal <= targetInfo.target
  return met ? 'var(--teal)' : 'var(--red)'
}

function fmt(val, key) {
  const section = SECTIONS.flatMap(s => s.rows).find(r => r.key === key)
  if (section?.format) return section.format(val)
  if (val == null) return '—'
  return typeof val === 'number' && val < 2 && val > 0 ? Math.round(val * 100) + '%' : val
}

// Trend table KPIs — rows shown across all games
const TREND_ROWS = [
  { key: 'possessions',          label: 'Possessions',      format: v => v,                          target: 40,    higher: true  },
  { key: 'possession_pct',       label: 'Poss → Atk %',     format: v => Math.round(v*100)+'%',      target: 0.9,   higher: true  },
  { key: 'attack_pct',           label: 'Atk → Shot %',     format: v => Math.round(v*100)+'%',      target: 0.75,  higher: true  },
  { key: 'shot_pct',             label: 'Shot → Score %',   format: v => Math.round(v*100)+'%',      target: 0.65,  higher: true  },
  { key: 'overall_shot_pct',     label: 'Overall Shot %',   format: v => Math.round(v*100)+'%',      target: 0.543, higher: true  },
  { key: 'shots_from_play',      label: 'Play Shots',       format: v => v,                          target: null              },
  { key: 'pct_from_play',        label: 'Play Conv %',      format: v => Math.round(v*100)+'%',      target: null              },
  { key: 'shots_from_frees',     label: 'Free Shots',       format: v => v,                          target: null              },
  { key: 'pct_from_frees',       label: 'Free Conv %',      format: v => Math.round(v*100)+'%',      target: null              },
  { key: 'ko_overall_win_pct',   label: 'Our KO Win %',     format: v => Math.round(v*100)+'%', target: 0.66, higher: true  },
  { key: 'ko_short_won',    label: 'Our KO Short Won', format: v => v, target: null },
  { key: 'ko_short_total',  label: 'Our KO Short Tot', format: v => v, target: null },
  { key: 'ko_mid_won',      label: 'Our KO Mid Won',   format: v => v, target: null },
  { key: 'ko_mid_total',    label: 'Our KO Mid Tot',   format: v => v, target: null },
  { key: 'ko_long_won',     label: 'Our KO Long Won',  format: v => v, target: null },
  { key: 'ko_long_total',   label: 'Our KO Long Tot',  format: v => v, target: null },
  { key: 'ko_breaks_won',   label: 'Our KO Breaks',    format: v => v, target: null },
  { key: 'opp_ko_short_won',   label: 'Opp KO Short Won', format: v => v, target: null },
  { key: 'opp_ko_short_total', label: 'Opp KO Short Tot', format: v => v, target: null },
  { key: 'opp_ko_mid_won',     label: 'Opp KO Mid Won',   format: v => v, target: null },
  { key: 'opp_ko_mid_total',   label: 'Opp KO Mid Tot',   format: v => v, target: null },
  { key: 'opp_ko_long_won',    label: 'Opp KO Long Won',  format: v => v, target: null },
  { key: 'opp_ko_long_total',  label: 'Opp KO Long Tot',  format: v => v, target: null },
  { key: 'opp_ko_breaks_won',  label: 'Opp KO Breaks',    format: v => v, target: null },
  { key: 'turnovers_forced',     label: 'TOs Won (F)',      format: v => v,                          target: null              },
  { key: 'turnovers_unforced',   label: 'TOs Won (U)',      format: v => v,                          target: null              },
  { key: 'turnovers_lost_forced',   label: 'TOs Lost (F)', format: v => v,                          target: null,  higher: false },
  { key: 'turnovers_lost_unforced', label: 'TOs Lost (U)', format: v => v,                          target: null,  higher: false },
  { key: 'tackles',              label: 'Tackles',          format: v => v,                          target: 50,    higher: true  },
]

function trendColor(row, val) {
  if (val == null || row.target == null) return null
  return row.higher ? (val >= row.target ? 'var(--teal)' : 'var(--red)') : (val <= row.target ? 'var(--teal)' : 'var(--red)')
}

function TeamStatsTab({ teamStats }) {
  const [view, setView] = useState('trend')
  const [trendTeam, setTrendTeam] = useState('us')
  const gamesWithData = MATCHES.filter(m => teamStats.some(r => r.match_id === m && r.team === 'us'))

  // ── GAME DETAIL VIEW ──────────────────────────────────────────────────────
  if (view !== 'trend') {
    const matchId = view
    const us = teamStats.find(r => r.match_id === matchId && r.team === 'us')
    const them = teamStats.find(r => r.match_id === matchId && r.team === 'them')
    return (
      <div className="fade-in">
        <button onClick={() => setView('trend')}
          style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', marginBottom: 14, padding: 0 }}>
          ← Back to Trends
        </button>

        {/* Score header */}
        <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Ballyboden</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{us?.scores ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{us?.possessions} poss · {us?.shots} shots</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>v</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{OPP[matchId]}</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{them?.scores ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{them?.possessions} poss · {them?.shots} shots</div>
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {Object.entries(TARGETS).filter(([k]) => us?.[k] != null).map(([key, info]) => {
            const val = us[key]
            const color = trafficLight(key, val, info)
            return (
              <div key={key} style={{ background: 'var(--bg2)', border: `1px solid ${color || 'var(--border)'}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{info.label}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, color: color || 'var(--text)' }}>{info.format(val)}</div>
                {info.target != null && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Target: {info.format(info.target)}</div>}
              </div>
            )
          })}
        </div>

        {/* Section tables */}
        {SECTIONS.map(section => {
          const rows = section.rows.filter(r => us?.[r.key] != null || them?.[r.key] != null)
          if (!rows.length) return null
          return (
            <div key={section.label} className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
              <div className="card-header">
                <span style={{ color: section.color }}>{section.label}</span>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 60px', gap: 4, textAlign: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--teal)' }}>BODEN</span>
                  <span style={{ fontSize: 9, color: 'var(--red)' }}>{OPP[matchId]?.split(' ')[0]?.toUpperCase()}</span>
                </div>
              </div>
              {rows.map((row, i) => {
                const usVal = us?.[row.key]
                const themVal = them?.[row.key]
                const targetInfo = TARGETS[row.key]
                const usColor = trafficLight(row.key, usVal, targetInfo) || section.color
                const displayFn = row.format || (v => v != null ? v : '—')
                return (
                  <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', alignItems: 'center', padding: '8px 14px', borderTop: i === 0 ? 'none' : '1px solid rgba(26,51,86,0.25)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{row.label}</div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, textAlign: 'center', color: usColor }}>{usVal != null ? displayFn(usVal) : '—'}</div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, textAlign: 'center', color: 'var(--text3)' }}>{themVal != null ? displayFn(themVal) : '—'}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  // ── TREND TABLE VIEW ──────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Header + Boden/Opposition toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase' }}>
          Season Trends
        </div>
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, gap: 3 }}>
          {[{ val: 'us', label: 'Boden', color: 'var(--teal)' }, { val: 'them', label: 'Opposition', color: 'var(--red)' }].map(opt => (
            <button key={opt.val} onClick={() => setTrendTeam(opt.val)}
              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Barlow, sans-serif', border: 'none',
                background: trendTeam === opt.val ? 'var(--bg4)' : 'transparent',
                color: trendTeam === opt.val ? opt.color : 'var(--text3)' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {gamesWithData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14 }}>No team data yet</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ ...tth, minWidth: 130, position: 'sticky', left: 0, background: 'var(--bg3)', zIndex: 2, textAlign: 'left' }}>KPI</th>
                <th style={{ ...tth, color: 'var(--text3)', borderLeft: '1px solid var(--border)', minWidth: 55 }}>
                  {trendTeam === 'us' ? 'Target' : 'Boden'}
                </th>
                {gamesWithData.map(m => (
                  <th key={m} style={{ ...tth, borderLeft: '1px solid var(--border)', minWidth: 60,
                    cursor: trendTeam === 'us' ? 'pointer' : 'default',
                    color: trendTeam === 'us' ? 'var(--blue)' : 'var(--red)' }}
                    onClick={() => trendTeam === 'us' && setView(m)}>
                    <div>{m.replace('AFL ', 'G')}</div>
                    <div style={{ fontSize: 8, fontWeight: 400, color: 'var(--text3)', marginTop: 2 }}>{OPP[m]?.split(' ')[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TREND_ROWS.map((row, ri) => {
                const vals = gamesWithData.map(m => {
                  const entry = teamStats.find(r => r.match_id === m && r.team === trendTeam)
                  return entry?.[row.key] ?? null
                })
                const usVals = trendTeam === 'them' ? gamesWithData.map(m => {
                  const us = teamStats.find(r => r.match_id === m && r.team === 'us')
                  return us?.[row.key] ?? null
                }) : null
                const hasAny = vals.some(v => v != null)
                if (!hasAny) return null
                return (
                  <tr key={row.key} style={{ background: ri % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderBottom: '1px solid rgba(26,51,86,0.2)' }}>
                    <td style={{ ...ttd, position: 'sticky', left: 0, background: ri % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', zIndex: 1, fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                      {row.label}
                    </td>
                    <td style={{ ...ttd, borderLeft: '1px solid var(--border)', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
                      {trendTeam === 'us'
                        ? (row.target != null ? row.format(row.target) : '—')
                        : '—'}
                    </td>
                    {vals.map((val, vi) => {
                      const color = trendTeam === 'us' ? trendColor(row, val) : null
                      const usVal = usVals?.[vi]
                      return (
                        <td key={vi} style={{ ...ttd, borderLeft: '1px solid rgba(26,51,86,0.3)', textAlign: 'center',
                          fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700,
                          color: color || 'var(--red)',
                          background: color === 'var(--teal)' ? 'rgba(62,207,142,0.07)' : color === 'var(--red)' ? 'rgba(240,96,96,0.07)' : '' }}>
                          {val != null ? row.format(val) : '—'}
                          {trendTeam === 'them' && usVal != null && (
                            <div style={{ fontSize: 9, color: 'var(--teal)', fontWeight: 400, marginTop: 1 }}>
                              {row.format(usVal)}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const tth = { padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text2)', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const ttd = { padding: '7px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }

const kth = { padding: '7px 8px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const ktd = { padding: '8px 6px', verticalAlign: 'middle' }

// ─── PUBLISH TAB ──────────────────────────────────────────────────────────────
function PublishTab({ matchStatuses, setMatchStatuses, appUser, allStats }) {
  const { isAdmin } = useAuth()
  const [publishing, setPublishing] = useState(false)
  const [status, setStatus] = useState(null)

  const handlePublish = async (matchId) => {
    setPublishing(matchId)
    const { error } = await supabase.from('match_status').upsert(
      { match_id: matchId, status: 'published', published_at: new Date().toISOString(), published_by: appUser?.name || 'coach' },
      { onConflict: 'match_id' }
    )
    if (!error) {
      setMatchStatuses(prev => ({ ...prev, [matchId]: { ...prev[matchId], status: 'published' } }))
      setStatus({ type: 'success', message: `✓ ${matchId} published — notifying players...` })
      try { await fetch('/api/notify-publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId }) }) } catch(e) {}
    } else setStatus({ type: 'error', message: error.message })
    setPublishing(null)
  }

  const handleUnpublish = async (matchId) => {
    if (!isAdmin) { setStatus({ type: 'error', message: 'Only admin can unpublish' }); return }
    const { error } = await supabase.from('match_status').upsert(
      { match_id: matchId, status: 'draft', unpublished_at: new Date().toISOString(), unpublished_by: appUser?.name || 'admin' },
      { onConflict: 'match_id' }
    )
    if (!error) {
      setMatchStatuses(prev => ({ ...prev, [matchId]: { ...prev[matchId], status: 'draft' } }))
      setStatus({ type: 'success', message: `${matchId} moved back to draft` })
    }
    setPublishing(null)
  }

  return (
    <div className="fade-in">
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Match Publication Status</div>

      {status && (
        <div style={{ padding: '9px 13px', borderRadius: 8, marginBottom: 12, background: status.type === 'success' ? 'rgba(62,207,142,0.1)' : 'rgba(240,96,96,0.1)', border: `1px solid ${status.type === 'success' ? 'var(--teal)' : 'var(--red)'}`, color: status.type === 'success' ? 'var(--teal)' : 'var(--red)', fontSize: 13 }}>
          {status.message}
        </div>
      )}

      {MATCHES.map(m => {
        const ms = matchStatuses[m]
        const isPublished = ms?.status === 'published'
        const playerCount = allStats.filter(r => r.match_id === m).length
        return (
          <div key={m} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{m}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{OPP[m]} · {playerCount} players</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isPublished ? 'var(--teal)' : 'var(--gold)' }}>
                  {isPublished ? '● Published' : '○ Draft'}
                </div>
                {isPublished && ms?.published_at && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                    {new Date(ms.published_at).toLocaleDateString('en-IE', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isPublished && (
                <button onClick={() => handlePublish(m)} disabled={publishing === m}
                  style={{ flex: 1, padding: '10px', background: 'rgba(62,207,142,0.12)', border: '1px solid var(--teal)', borderRadius: 8, color: 'var(--teal)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                  {publishing === m ? 'Publishing...' : '↑ Publish & Notify Players'}
                </button>
              )}
              {isPublished && isAdmin && (
                <button onClick={() => handleUnpublish(m)} disabled={publishing === m}
                  style={{ padding: '8px 16px', background: 'rgba(240,96,96,0.08)', border: '1px solid var(--red)', borderRadius: 8, color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
                  Unpublish
                </button>
              )}
              {isPublished && !isAdmin && (
                <div style={{ fontSize: 11, color: 'var(--text3)', padding: '8px 0', fontStyle: 'italic' }}>Only admin can unpublish</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
