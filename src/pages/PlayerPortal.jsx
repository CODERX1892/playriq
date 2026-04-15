import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import StatGroup from '../components/StatGroup'
import { MATCHES, OPP, POS_COLORS, n, r1, pct, sf, impactColor, buildStatRows } from '../lib/utils'
import PlayrIQEdge from './PlayrIQEdge'
import Glossary from './Glossary'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const TEAM_AVGS = {
  simple_pass: 6.4, simple_receive: 6.7, advance_pass: 0.9, advance_receive: 0.9, carries: 0.7,
  won_clean_p1_our: 0.1, won_clean_p2_our: 0.1, won_clean_p3_our: 0.1, won_break_our: 0.2,
  our_ko_contest_opp: 0.2, our_ko_contest_us: 0.2,
  ko_target_won_clean: 0.3, ko_target_won_break: 0.1, ko_target_lost_clean: 0.3, ko_target_lost_contest: 0.2,
  turnovers_in_contact: 0.2, turnover_skill_error: 0.1, turnovers_kicked_away: 0.3, drop_shorts: 0.1,
  duels_contested: 3.1, defensive_duels_won: 1.4, duels_neutral: 0.5, duels_lost: 1.1, breach_1v1: 0.2,
  dne: 0.3, forced_to_win: 0.3, kickaway_to_received: 0.5, tackles: 2.5,
  free_conceded: 0.6, shot_free_conceded: 0.3, two_pt_free_conceded: 0.0,
  won_clean_p1_opp: 0.0, won_clean_p2_opp: 0.1, won_clean_p3_opp: 0.1, won_break_opp: 0.2,
  their_ko_contest_opp: 0.1, their_ko_contest_us: 0.3,
}

export default function PlayerPortal() {
  const { player, logout } = useAuth()
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('home')
  const [matchFilter, setMatchFilter] = useState('all')
  const TABS = ['home', 'attack', 'transition', 'defence', 'matches', 'edge', 'glossary']

  useEffect(() => {
    supabase.from('player_stats').select('*').eq('player_name', player.name)
      .then(({ data }) => { setStats(data || []); setLoading(false) })
  }, [player.name])

  const rows = matchFilter === 'all' ? stats : stats.filter(r => r.match_id === matchFilter)
  const mc = [...new Set(rows.map(r => r.match_id))].length || 1
  const allMc = [...new Set(stats.map(r => r.match_id))].length

  const posColor = POS_COLORS[player.position] || 'var(--text2)'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 11, position: 'sticky', top: 0, zIndex: 40 }}>
        <Avatar name={player.name} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
            <span style={{ color: posColor }}>{player.position}</span>
            {player.dob && ` · Age ${new Date().getFullYear() - new Date(player.dob).getFullYear()}`}
          </div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
          Sign Out
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ top: 61 }}>
        {TABS.map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 14 }}>
        {tab === 'home' && <HomeTab rows={rows} stats={stats} player={player} mc={mc} allMc={allMc} posColor={posColor} />}
        {tab === 'attack' && <AttackTab rows={rows} mc={mc} matchFilter={matchFilter} setMatchFilter={setMatchFilter} />}
        {tab === 'transition' && <TransitionTab rows={rows} mc={mc} matchFilter={matchFilter} setMatchFilter={setMatchFilter} stats={stats} />}
        {tab === 'defence' && <DefenceTab rows={rows} mc={mc} matchFilter={matchFilter} setMatchFilter={setMatchFilter} stats={stats} />}
        {tab === 'matches' && <MatchesTab stats={stats} />}
        {tab === 'edge' && <PlayrIQEdge stats={stats} player={player} />}
        {tab === 'glossary' && <Glossary />}
      </div>
    </div>
  )
}

// ─── HOME TAB ───────────────────────────────────────────────────────────────
function HomeTab({ rows, stats, player, mc, allMc, posColor }) {
  const p1s = sf(rows, 'one_pointer_scored'), f1s = sf(rows, 'one_pointer_scored_f')
  const p2s = sf(rows, 'two_pointer_scored'), f2s = sf(rows, 'two_pointer_scored_f')
  const gs = sf(rows, 'goals_scored'), fgs = sf(rows, 'goals_scored_f')
  const tPl = p1s + p2s * 2 + gs * 3, tFr = f1s + f2s * 2 + fgs * 3, tot = tPl + tFr
  const ti = r1(rows.reduce((s, r) => s + n(r.total_impact), 0))
  const ai = r1(rows.reduce((s, r) => s + n(r.attack_impact), 0))
  const tri = r1(rows.reduce((s, r) => s + n(r.transition_impact), 0))
  const di = r1(rows.reduce((s, r) => s + n(r.defensive_impact), 0))
  const mins = rows.reduce((s, r) => s + n(r.total_minutes), 0)

  const totalAtt = sf(rows, 'one_pointer_attempts') + sf(rows, 'one_pointer_attempts_f') +
    sf(rows, 'two_pointer_attempts') + sf(rows, 'two_pointer_attempts_f') +
    sf(rows, 'goal_attempts') + sf(rows, 'goal_attempts_f')
  const totalScored = p1s + f1s + p2s + f2s + gs + fgs
  const shootPct = pct(totalScored, totalAtt)
  const pctColor = shootPct >= 60 ? 'var(--teal)' : shootPct >= 45 ? 'var(--gold)' : 'var(--red)'

  const dob = player.dob ? new Date(player.dob).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  // Trend data
  const trendData = MATCHES.map(m => {
    const r = stats.find(s => s.match_id === m)
    return {
      match: m.replace('AFL ', 'G'),
      atk: r ? r1(n(r.attack_impact)) : null,
      trans: r ? r1(n(r.transition_impact)) : null,
      def: r ? r1(n(r.defensive_impact)) : null,
      total: r ? r1(n(r.total_impact)) : null,
    }
  })

  return (
    <div className="fade-in">
      {/* Hero */}
      <div style={{ background: 'linear-gradient(155deg,#0d1e38,#0f2a48 50%,#0d1e38)', border: '1px solid #2a4f7a', borderRadius: 13, padding: 15, marginBottom: 13 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
          <Avatar name={player.name} size={76} round={false} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, color: posColor, marginBottom: 3 }}>{player.position}</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 26, fontWeight: 800, lineHeight: 1, marginBottom: 2 }}>{player.name}</div>
            {player.irish_name && player.irish_name !== player.name && (
              <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 6 }}>{player.irish_name}</div>
            )}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
              {dob && <span className="tag"><b>{dob}</b></span>}
              <span className="tag">Games <b>{allMc}</b></span>
              <span className="tag">Mins <b>{mins}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Impact + Points */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 13 }}>
        <div className="card" style={{ padding: 13, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Total Impact</div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 36, fontWeight: 800, color: impactColor(ti), lineHeight: 1 }}>{ti || '0'}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 9, marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--gold)' }}>A:{ai}</span>
            <span style={{ fontSize: 10, color: 'var(--blue)' }}>T:{tri}</span>
            <span style={{ fontSize: 10, color: 'var(--teal)' }}>D:{di}</span>
          </div>
        </div>
        <div className="card" style={{ padding: 13, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Total Points</div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 36, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{tot || '0'}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 9, marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--blue)' }}>Play:{tPl}</span>
            <span style={{ fontSize: 10, color: 'var(--purple)' }}>Frees:{tFr}</span>
          </div>
        </div>
      </div>

      {/* Scoring table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 13 }}>
        <div className="card-header">Scoring</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '7px 14px', borderBottom: '1px solid rgba(26,51,86,0.4)' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)' }} />
          {['From Play', 'From Frees', 'Total'].map(h => (
            <div key={h} style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>{h}</div>
          ))}
        </div>
        {[
          ['1-Pointers', p1s, f1s, 'var(--blue)'],
          ['2-Pointers', p2s, f2s, 'var(--purple)'],
          ['Goals', gs, fgs, 'var(--teal)'],
        ].map(([label, play, free, color]) => (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '7px 14px', borderTop: '1px solid rgba(26,51,86,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 700, color, textAlign: 'center' }}>{play}</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 700, color, textAlign: 'center' }}>{free}</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 700, color, textAlign: 'center' }}>{play + free}</div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '8px 14px', background: 'rgba(26,51,86,0.15)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Points</div>
          {[tPl, tFr, tot].map((v, i) => (
            <div key={i} style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--gold)', textAlign: 'center' }}>{v}</div>
          ))}
        </div>
        {totalAtt > 0 && (
          <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(26,51,86,0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(240,180,41,0.04)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Overall Shooting Accuracy</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 800, color: pctColor }}>{totalScored}/{totalAtt} · {shootPct}%</div>
          </div>
        )}
      </div>

      {/* Match chips */}
      {stats.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Match by Match Impact</div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, marginBottom: 13, scrollbarWidth: 'none' }}>
            {MATCHES.map(m => {
              const r = stats.find(s => s.match_id === m)
              if (!r) return null
              const imp = r1(n(r.total_impact))
              const pts = n(r.one_pointer_scored) + n(r.one_pointer_scored_f) + (n(r.two_pointer_scored) + n(r.two_pointer_scored_f)) * 2 + (n(r.goals_scored) + n(r.goals_scored_f)) * 3
              return (
                <div key={m} className="card" style={{ padding: '9px 11px', minWidth: 84, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1 }}>{m}</div>
                  <div style={{ fontSize: 8, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{OPP[m]}</div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 700, color: impactColor(imp), marginTop: 3 }}>{imp}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{pts > 0 ? `${pts}pt` : '—'}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Trend chart */}
      <div className="card" style={{ padding: 13 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Impact Trend</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8, justifyContent: 'center' }}>
          {[['Atk', '#f0b429'], ['Trans', '#4a9eff'], ['Def', '#3ecf8e'], ['Total', '#a78bfa']].map(([l, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{l}</span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,51,86,0.5)" />
            <XAxis dataKey="match" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="atk" stroke="#f0b429" strokeWidth={1.5} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="trans" stroke="#4a9eff" strokeWidth={1.5} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="def" stroke="#3ecf8e" strokeWidth={1.5} dot={{ r: 3 }} connectNulls={false} />
            <Line type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── ATTACK TAB ──────────────────────────────────────────────────────────────
function AttackTab({ rows, mc, matchFilter, setMatchFilter }) {
  const p1a = sf(rows, 'one_pointer_attempts'), p1s = sf(rows, 'one_pointer_scored'), p1w = sf(rows, 'one_pointer_wide'), p1ds = sf(rows, 'one_pointer_drop_short_block')
  const p2a = sf(rows, 'two_pointer_attempts'), p2s = sf(rows, 'two_pointer_scored'), p2w = sf(rows, 'two_pointer_wide'), p2ds = sf(rows, 'two_pointer_drop_short_block')
  const ga = sf(rows, 'goal_attempts'), gs = sf(rows, 'goals_scored'), gw = sf(rows, 'goals_wide'), gds = sf(rows, 'goal_drop_short_block')
  const f1a = sf(rows, 'one_pointer_attempts_f'), f1s = sf(rows, 'one_pointer_scored_f')
  const f2a = sf(rows, 'two_pointer_attempts_f'), f2s = sf(rows, 'two_pointer_scored_f')
  const fga = sf(rows, 'goal_attempts_f'), fgs = sf(rows, 'goals_scored_f')
  const tp = p1s + f1s + (p2s + f2s) * 2 + (gs + fgs) * 3
  const ai = r1(rows.reduce((s, r) => s + n(r.attack_impact), 0))
  const totalScored = p1s + f1s + p2s + f2s + gs + fgs
  const totalAtt = p1a + f1a + p2a + f2a + ga + fga
  const overallPct = pct(totalScored, totalAtt)
  const pctColor = overallPct >= 60 ? 'var(--teal)' : overallPct >= 45 ? 'var(--gold)' : 'var(--red)'

  const as1 = sf(rows, 'assists_shots'), ag2 = sf(rows, 'assists_goals'), a2pt = sf(rows, 'assists_2pt')

  const rings = [
    { label: '1-Point', scored: p1s + f1s, att: p1a + f1a, color: '#f0b429' },
    { label: '2-Point', scored: p2s + f2s, att: p2a + f2a, color: '#a78bfa' },
    { label: 'Goals', scored: gs + fgs, att: ga + fga, color: '#3ecf8e' },
  ]

  return (
    <div className="fade-in">
      <MatchFilterPills matchFilter={matchFilter} setMatchFilter={setMatchFilter} />
      {/* Banner */}
      <div style={{ background: 'linear-gradient(135deg,#1a1205,#251a08)', border: '1px solid #3d2e0a', borderRadius: 11, padding: 13, marginBottom: 13, textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>Total Points</div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 44, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{tp}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>
          Attack Impact: <b style={{ color: 'var(--gold)' }}>{ai}</b>&nbsp;&nbsp;·&nbsp;&nbsp;
          Shooting: <b style={{ color: pctColor }}>{overallPct}%</b>
        </div>
      </div>

      {/* Rings */}
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Shooting Accuracy</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, marginBottom: 13 }}>
        {rings.map((r, i) => {
          const p2 = pct(r.scored, r.att)
          const canvasId = `ring-${i}`
          return (
            <div key={i} className="card" style={{ padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>{r.label}</div>
              <RingChart value={p2} color={r.color} id={canvasId} />
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{r.scored}/{r.att}</div>
            </div>
          )
        })}
      </div>

      {/* Shooting table from play */}
      <ShootTable title="Shooting — From Play" badge={`${mc} games`}
        rows={[['1-Pointer', p1a, p1s, p1w, p1ds], ['2-Pointer', p2a, p2s, p2w, p2ds], ['Goal', ga, gs, gw, gds]]} />

      {/* Shooting from frees */}
      {f1a + f2a + fga > 0 && (
        <ShootTable title="Shooting — From Frees" badge="placed ball"
          rows={[['1-Pointer Free', f1a, f1s, f1a - f1s, 0], ['2-Pointer Free', f2a, f2s, f2a - f2s, 0], ['Goal Free', fga, fgs, fga - fgs, 0]]} />
      )}

      {/* Playmaking */}
      {as1 + ag2 + a2pt > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
          <div className="card-header"><span style={{ color: 'var(--teal)' }}>Playmaking</span><span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', borderRadius: 4, padding: '2px 7px' }}>assists</span></div>
          {[['Shot Assists', as1], ['Goal Assists', ag2], ['2pt Assists', a2pt]].filter(([, v]) => v > 0).map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid rgba(26,51,86,0.25)' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r1(val / mc)}/gm</span>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>{val}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TRANSITION TAB ──────────────────────────────────────────────────────────
function TransitionTab({ rows, mc, matchFilter, setMatchFilter, stats }) {
  const ti = r1(rows.reduce((s, r) => s + n(r.transition_impact), 0))
  const matchCount = [...new Set(rows.map(r => r.match_id))].length

  // Get all stats for this player across all matches (for breakdown)
  const allMatchRows = stats  // full stats array passed down

  const passRows = buildStatRows(rows, [
    ['simple_pass', 'Simple Passes'], ['simple_receive', 'Simple Receives'],
    ['advance_pass', 'Advance Passes'], ['advance_receive', 'Advance Receives'], ['carries', 'Carries'],
  ], mc, TEAM_AVGS)

  const koRows = buildStatRows(rows, [
    ['won_clean_p1_our', 'Won Clean P1 (Ours)'], ['won_clean_p2_our', 'Won Clean P2 (Ours)'],
    ['won_clean_p3_our', 'Won Clean P3 (Ours)'], ['won_break_our', 'Won Break (Ours)'],
    ['our_ko_contest_opp', 'KO Contest (Opp)'], ['our_ko_contest_us', 'KO Contest (Us)'],
    ['ko_target_won_clean', 'KO Target Won Clean'], ['ko_target_won_break', 'KO Target Won Break'],
    ['ko_target_lost_clean', 'KO Target Lost Clean'], ['ko_target_lost_contest', 'KO Target Lost Contest'],
  ], mc, TEAM_AVGS)

  const toRows = buildStatRows(rows, [
    ['turnovers_in_contact', 'TOs in Contact'], ['turnover_skill_error', 'TO Skill Error'],
    ['turnovers_kicked_away', 'TOs Kicked/HP Away'], ['drop_shorts', 'Drop Shorts (Total)'],
    ['acceptable_turnovers', 'Acceptable TOs'],
  ], mc, TEAM_AVGS)

  const gkRows = buildStatRows(rows, [['shots_saved', 'Shots Saved'], ['shots_conceded', 'Shots Conceded']], mc)

  return (
    <div className="fade-in">
      <MatchFilterPills matchFilter={matchFilter} setMatchFilter={setMatchFilter} />
      <ImpactBanner label="Transition Impact" value={ti} color="var(--blue)" mc={matchCount} bg="linear-gradient(135deg,#071828,#0a2038)" border="#0f3560" />
      <StatGroup title="Passing" badge="distribution" color="var(--blue)" rows={passRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: r.teamAvg, total: r.total }))} matchRows={stats} />
      <StatGroup title="Kickouts — Ours" badge="restart" color="var(--teal)" rows={koRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: r.teamAvg, total: r.total }))} matchRows={stats} />
      <StatGroup title="Turnovers" badge="possession losses" color="var(--red)" rows={toRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: r.teamAvg, total: r.total }))} matchRows={stats} />
      {gkRows.some(r => r.total > 0) && <StatGroup title="Goalkeeping" badge="shot stopping" color="var(--purple)" rows={gkRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: null, total: r.total }))} matchRows={stats} />}
    </div>
  )
}

// ─── DEFENCE TAB ─────────────────────────────────────────────────────────────
function DefenceTab({ rows, mc, matchFilter, setMatchFilter, stats }) {
  const di = r1(rows.reduce((s, r) => s + n(r.defensive_impact), 0))
  const matchCount = [...new Set(rows.map(r => r.match_id))].length
  const y = sf(rows, 'yellow'), b = sf(rows, 'black'), rd = sf(rows, 'red')

  const duelRows = buildStatRows(rows, [
    ['duels_contested', 'Duels Contested'], ['defensive_duels_won', 'Duels Won'],
    ['duels_neutral', 'Duels Neutral'], ['duels_lost', 'Duels Lost'], ['breach_1v1', 'Breach 1v1'],
  ], mc, TEAM_AVGS)

  const defRows = buildStatRows(rows, [
    ['tackles', 'Tackles'], ['forced_to_win', 'Forced TO Won'],
    ['kickaway_to_received', 'Kickaway TO Won'],
    ['dne', 'Defensive Non-Engagement (DNE)'],
  ], mc, TEAM_AVGS)

  const foulRows = buildStatRows(rows, [
    ['free_conceded', 'Free Conceded'], ['shot_free_conceded', 'Shot Free Conceded'],
    ['two_pt_free_conceded', '2pt Free Conceded'],
  ], mc, TEAM_AVGS)

  const koOppRows = buildStatRows(rows, [
    ['won_clean_p1_opp', 'Won Clean P1 (Opp KO)'], ['won_clean_p2_opp', 'Won Clean P2 (Opp KO)'],
    ['won_clean_p3_opp', 'Won Clean P3 (Opp KO)'], ['won_break_opp', 'Won Break (Opp KO)'],
    ['their_ko_contest_opp', 'Their KO Contest (Opp)'], ['their_ko_contest_us', 'Their KO Contest (Us)'],
  ], mc, TEAM_AVGS)

  return (
    <div className="fade-in">
      <MatchFilterPills matchFilter={matchFilter} setMatchFilter={setMatchFilter} />
      <ImpactBanner label="Defensive Impact" value={di} color="var(--teal)" mc={matchCount} bg="linear-gradient(135deg,#071a10,#0a2518)" border="#0f3a22" />

      {/* Discipline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 11 }}>
        {[['Yellow', y, y > 0 ? '#f5d020' : 'var(--text3)'], ['Black', b, b > 0 ? 'var(--text2)' : 'var(--text3)'], ['Red', rd, rd > 0 ? 'var(--red)' : 'var(--text3)']].map(([label, val, color]) => (
          <div key={label} className="card" style={{ padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      <StatGroup title="Duels" badge="1v1 contests" color="var(--blue)" rows={duelRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: r.teamAvg, total: r.total }))} matchRows={stats} />
      <StatGroup title="Defensive Actions" badge="turnovers & tackles" color="var(--teal)" rows={defRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: r.teamAvg, total: r.total }))} matchRows={stats} />
      <StatGroup title="Fouls Conceded" badge="free kicks against" color="var(--red)" rows={foulRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: r.teamAvg, total: r.total }))} matchRows={stats} />
      <StatGroup title="Opposition Kickouts" badge="restart defence" color="var(--purple)" rows={koOppRows.map(r => ({ label: r.label, field: r.field, avg: r.avg, teamAvg: r.teamAvg, total: r.total }))} matchRows={stats} />
    </div>
  )
}

// ─── MATCHES TAB ─────────────────────────────────────────────────────────────
function MatchesTab({ stats }) {
  return (
    <div className="fade-in">
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>All Matches</div>
      {MATCHES.map(m => {
        const r = stats.find(s => s.match_id === m)
        const imp = r ? r1(n(r.total_impact)) : null
        if (!r) return (
          <div key={m} className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ background: 'var(--bg3)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 13, fontWeight: 700 }}>{m}</div><div style={{ fontSize: 10, color: 'var(--text3)' }}>{OPP[m]}</div></div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Did not play</div>
            </div>
          </div>
        )
        const p1s = n(r.one_pointer_scored) + n(r.one_pointer_scored_f)
        const p2s = n(r.two_pointer_scored) + n(r.two_pointer_scored_f)
        const gs = n(r.goals_scored) + n(r.goals_scored_f)
        const pts = p1s + p2s * 2 + gs * 3
        const ai = r1(n(r.attack_impact)), ti = r1(n(r.transition_impact)), di = r1(n(r.defensive_impact))
        const totalAtt = n(r.one_pointer_attempts) + n(r.one_pointer_attempts_f) + n(r.two_pointer_attempts) + n(r.two_pointer_attempts_f) + n(r.goal_attempts) + n(r.goal_attempts_f)
        const totScr = p1s + p2s + gs
        const sp = pct(totScr, totalAtt)
        return (
          <div key={m} className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ background: 'var(--bg3)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <div><div style={{ fontSize: 13, fontWeight: 700 }}>{m}</div><div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{OPP[m]}</div></div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>Impact</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, color: impactColor(imp) }}>{imp}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '10px 14px', borderBottom: '1px solid rgba(26,51,86,0.3)' }}>
              {[['Mins', n(r.total_minutes), 'var(--text)'], ['Points', pts, 'var(--gold)'], ['Tackles', n(r.tackles), 'var(--blue)'], ['Forced TO', n(r.forced_to_win), 'var(--teal)']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '8px 14px' }}>
              {[['Attack', ai, 'var(--gold)'], ['Transition', ti, 'var(--blue)'], ['Defence', di, 'var(--teal)']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
                </div>
              ))}
            </div>
            {pts > 0 && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(26,51,86,0.3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {p1s > 0 && <span style={{ fontSize: 11, color: 'var(--blue)' }}>1pt: <b>{p1s}</b></span>}
                {p2s > 0 && <span style={{ fontSize: 11, color: 'var(--purple)' }}>2pt: <b>{p2s}</b></span>}
                {gs > 0 && <span style={{ fontSize: 11, color: 'var(--teal)' }}>Goals: <b>{gs}</b></span>}
                {totalAtt > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Shooting: <b style={{ color: sp >= 50 ? 'var(--teal)' : 'var(--gold)' }}>{sp}%</b></span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function buildMatchGrid(title, color, fields, allStats) {
  const hasAny = fields.some(([field]) => allStats.some(r => n(r[field]) > 0))
  if (!hasAny) return ''
  const MATCH_LABELS = ['AFL 1','AFL 2','AFL 3','AFL 4']
  let h = '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:11px">'
  h += '<div style="background:var(--bg3);padding:8px 14px;border-bottom:1px solid var(--border);font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:' + color + '">' + title + '</div>'
  // Header row
  h += '<div style="display:grid;grid-template-columns:1fr 44px 44px 44px 44px 52px;gap:3px;padding:5px 14px 3px;border-bottom:1px solid rgba(26,51,86,0.3)">'
  h += '<div style="font-size:9px;color:var(--text3);letter-spacing:1px;text-transform:uppercase">Metric</div>'
  MATCH_LABELS.forEach(function(m) { h += '<div style="font-size:10px;color:var(--text2);text-align:center;font-weight:700">' + m.replace('AFL ','G') + '</div>' })
  h += '<div style="font-size:9px;color:var(--text3);text-align:center;letter-spacing:1px;text-transform:uppercase">Total</div>'
  h += '</div>'
  // Data rows
  fields.forEach(function(pair) {
    var field = pair[0], label = pair[1]
    var vals = MATCH_LABELS.map(function(m) { var r = allStats.find(function(s) { return s.match_id === m }); return r ? n(r[field]) : null })
    var total = vals.reduce(function(s, v) { return s + (v || 0) }, 0)
    if (total === 0) return
    h += '<div style="display:grid;grid-template-columns:1fr 44px 44px 44px 44px 52px;gap:3px;padding:6px 14px;border-top:1px solid rgba(26,51,86,0.2);align-items:center">'
    h += '<div style="font-size:12px;color:var(--text2)">' + label + '</div>'
    vals.forEach(function(v) {
      var c = v > 0 ? color : v === null ? 'rgba(26,51,86,0.3)' : 'var(--text3)'
      h += '<div style="font-family:Barlow Condensed,sans-serif;font-size:16px;font-weight:700;text-align:center;color:' + c + '">' + (v === null ? '·' : v > 0 ? v : '—') + '</div>'
    })
    h += '<div style="font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:800;text-align:center;color:' + (total > 0 ? color : 'var(--text3)') + '">' + (total > 0 ? total : '—') + '</div>'
    h += '</div>'
  })
  h += '</div>'
  return h
}

function MatchFilterPills({ matchFilter, setMatchFilter }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 12, scrollbarWidth: 'none' }}>
      {['all', ...MATCHES].map(m => (
        <button key={m} className={`pill${matchFilter === m ? ' active' : ''}`}
          onClick={() => setMatchFilter(m)}>
          {m === 'all' ? 'All' : m}
        </button>
      ))}
    </div>
  )
}

function ImpactBanner({ label, value, color, mc, bg, border }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 11, padding: 14, marginBottom: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 42, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Matches</div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 30, fontWeight: 800, color: 'var(--text2)', lineHeight: 1 }}>{mc}</div>
        </div>
      </div>
    </div>
  )
}

function RingChart({ value, color, id }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, 64, 64)
    ctx.beginPath(); ctx.arc(32, 32, 26, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(26,51,86,0.8)'; ctx.lineWidth = 6; ctx.stroke()
    if (value > 0) {
      ctx.beginPath(); ctx.arc(32, 32, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value / 100)
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke()
    }
  }, [value, color])
  return (
    <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto' }}>
      <canvas ref={canvasRef} width={64} height={64} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 700, color }}>
        {value > 0 ? `${value}%` : '—'}
      </div>
    </div>
  )
}

function ShootTable({ title, badge, rows }) {
  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
      <div className="card-header">
        <span style={{ color: 'var(--gold)' }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', borderRadius: 4, padding: '2px 7px' }}>{badge}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px 28px 42px', gap: 3, padding: '5px 13px 3px', borderBottom: '1px solid rgba(26,51,86,0.3)' }}>
        {['Shot', 'Att', 'Scr', 'Wde', 'DS', '%'].map((h, i) => (
          <div key={h} style={{ fontSize: 9, color: ['var(--text3)', 'var(--text2)', 'var(--teal)', 'var(--red)', 'var(--gold)', 'var(--text3)'][i], textAlign: i > 0 ? 'center' : 'left', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
        ))}
      </div>
      {rows.map(([label, att, scored, wide, ds], i) => {
        const p = pct(scored, att)
        const pc = p >= 60 ? 'var(--teal)' : p >= 40 ? 'var(--gold)' : 'var(--red)'
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 28px 28px 28px 42px', alignItems: 'center', gap: 3, padding: '7px 13px', borderTop: '1px solid rgba(26,51,86,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>{att}</div>
            <div style={{ fontSize: 12, color: 'var(--teal)', textAlign: 'center' }}>{scored}</div>
            <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>{wide}</div>
            <div style={{ fontSize: 12, color: 'var(--gold)', textAlign: 'center' }}>{ds || 0}</div>
            <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: att > 0 ? pc : 'var(--text3)' }}>{att > 0 ? `${p}%` : '—'}</div>
          </div>
        )
      })}
    </div>
  )
}
