import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES, OPP, n, r1 } from '../lib/utils'

function SectionHeader({ title, color }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color, marginBottom: 8, marginTop: 16, borderBottom: `1px solid ${color}33`, paddingBottom: 5 }}>
      {title}
    </div>
  )
}

function MetricCard({ label, us, opp, usTarget, oppTarget, format = 'number', higherBetter = true, description, suffix = '' }) {
  const [open, setOpen] = useState(false)
  const fmt = (v) => v == null ? '—' : format === 'pct' ? `${v}%` : `${r1(v)}${suffix}`
  const usColor = usTarget != null
    ? (higherBetter ? (us >= usTarget ? 'var(--teal)' : us >= usTarget * 0.8 ? 'var(--gold)' : 'var(--red)')
                    : (us <= usTarget ? 'var(--teal)' : us <= usTarget * 1.2 ? 'var(--gold)' : 'var(--red)'))
    : 'var(--blue)'

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 10 }}>
      <div style={{ padding: '10px 14px', cursor: description ? 'pointer' : 'default' }}
        onClick={() => description && setOpen(v => !v)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>{label}</div>
            {usTarget != null && (
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                Target: {higherBetter ? '≥' : '≤'}{format === 'pct' ? `${usTarget}%` : usTarget}
                {oppTarget != null && ` · Opp target: ${higherBetter ? '<' : '>'}${format === 'pct' ? `${oppTarget}%` : oppTarget}`}
              </div>
            )}
          </div>
          {description && <span style={{ fontSize: 10, color: 'var(--text3)' }}>{open ? '▲' : 'ⓘ'}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: opp != null ? '1fr 1fr' : '1fr', gap: 8 }}>
          <div style={{ background: 'rgba(26,51,86,0.3)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--blue)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Boden</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28, fontWeight: 800, color: usColor, lineHeight: 1 }}>{fmt(us)}</div>
          </div>
          {opp != null && (
            <div style={{ background: 'rgba(26,51,86,0.15)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Opposition</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28, fontWeight: 800, color: 'var(--text2)', lineHeight: 1 }}>{fmt(opp)}</div>
            </div>
          )}
        </div>
      </div>
      {open && description && (
        <div style={{ padding: '8px 14px 10px', borderTop: '1px solid rgba(26,51,86,0.2)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>{description}</div>
      )}
    </div>
  )
}

function KOCard({ title, taken, cleanPct, breakPct, lostBreakPct, lostCleanPct, isUs }) {
  if (!taken) return null
  const cleanN = Math.round(taken * (cleanPct || 0) / 100)
  const breakN = Math.round(taken * (breakPct || 0) / 100)
  const lostBreakN = Math.round(taken * (lostBreakPct || 0) / 100)
  const lostCleanN = Math.round(taken * (lostCleanPct || 0) / 100)
  const wonPct = Math.round((cleanPct || 0) + (breakPct || 0))

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 10 }}>
      <div className="card-header">
        <span style={{ color: isUs ? 'var(--teal)' : 'var(--purple)' }}>{title}</span>
        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, color: isUs ? (wonPct >= 60 ? 'var(--teal)' : wonPct >= 40 ? 'var(--gold)' : 'var(--red)') : 'var(--text2)' }}>
          {wonPct}% won · {taken} taken
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '10px 14px', gap: 6 }}>
        {[['Won Clean', cleanN, cleanPct, 'var(--teal)'], ['Won Break', breakN, breakPct, 'var(--blue)'], ['Lost Break', lostBreakN, lostBreakPct, 'var(--gold)'], ['Lost Clean', lostCleanN, lostCleanPct, 'var(--red)']].map(([l, count, pct, c]) => (
          <div key={l} style={{ textAlign: 'center', background: 'rgba(26,51,86,0.2)', borderRadius: 6, padding: '7px 4px' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 800, color: count > 0 ? c : 'var(--text3)' }}>{count}</div>
            <div style={{ fontSize: 8, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{l}</div>
            <div style={{ fontSize: 9, color: 'var(--text3)' }}>{pct || 0}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TeamAnalytics({ allStats, matchView, setMatchView }) {
  const [analytics, setAnalytics] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('team_analytics').select('*').then(({ data }) => {
      const map = {}
      data?.forEach(r => { map[r.match_id] = r })
      setAnalytics(map)
      setLoading(false)
    })
  }, [])

  const d = analytics[matchView]
  const matchPlayerStats = allStats?.filter(r => r.match_id === matchView) || []

  // Calculations from database row
  const ourPoss = n(d?.our_possessions)
  const ourAttacks = n(d?.our_attacks)
  const ourShots = n(d?.our_shots)
  const ourScores = n(d?.our_scores)
  const ourGoals = n(d?.our_goals)
  const our2pt = n(d?.our_2pt)
  const our1pt = n(d?.our_1pt)
  const ourPts = n(d?.our_score_pts)
  const ourExpPts = n(d?.our_exp_pts)

  const oppShots = n(d?.opp_shots)
  const oppPts = n(d?.opp_score_pts)
  const oppExpPts = n(d?.opp_exp_pts)

  // Possession → Shot % (attacks / possessions * 100)
  const ourPossToShot = ourPoss > 0 ? Math.round(ourAttacks / ourPoss * 100) : 0
  const oppPossToShot = null // not tracked for opp

  // Productivity = actual pts * 10 / possessions
  const ourProd = ourPoss > 0 ? r1(ourPts * 10 / ourPoss) : 0
  const oppProd = null // opp possessions not tracked

  // Turnover ratio = (possessions - attacks + drop_shorts) / possessions
  const ourDropShorts = matchPlayerStats.reduce((s, r) => s + n(r.drop_shorts), 0)
  const ourTurnovers = (ourPoss - ourAttacks) + ourDropShorts
  const ourTORatio = ourPoss > 0 ? Math.round(ourTurnovers / ourPoss * 100) : 0

  // KO battle — Our P1 (won clean) / total KOs taken
  const ourKOTaken = n(d?.our_ko_taken)
  const ourKOWonCleanPct = n(d?.our_ko_won_clean_pct)
  const ourKOWonCleanN = ourKOTaken > 0 ? Math.round(ourKOTaken * ourKOWonCleanPct / 100) : 0
  const ourKOBattlePct = ourKOTaken > 0 ? Math.round(ourKOWonCleanN / ourKOTaken * 100) : 0

  const oppKOTaken = n(d?.opp_ko_taken)
  const oppKOWonCleanPct = n(d?.opp_ko_won_clean_pct) // % WE won of their KOs
  const oppKOWonCleanN = oppKOTaken > 0 ? Math.round(oppKOTaken * oppKOWonCleanPct / 100) : 0
  const oppKOBattlePct = oppKOTaken > 0 ? Math.round(oppKOWonCleanN / oppKOTaken * 100) : 0

  // Source of shots
  const bodenFromOwnKO = n(d?.boden_from_own_ko)
  const bodenFromOppKO = n(d?.boden_from_opp_ko)
  const bodenFromTO = n(d?.boden_from_turnover)
  const bodenShotsTotal = bodenFromOwnKO + bodenFromOppKO + bodenFromTO
  const oppFromBodenKO = n(d?.opp_from_boden_ko)
  const oppFromOppKO = n(d?.opp_from_opp_ko)
  const oppFromTO = n(d?.opp_from_turnover)
  const oppShotsTotal = oppFromBodenKO + oppFromOppKO + oppFromTO

  // Intensity Index — from player stats in Supabase
  const intTackles = matchPlayerStats.reduce((s, r) => s + n(r.tackles), 0)
  const intForced = matchPlayerStats.reduce((s, r) => s + n(r.forced_to_win), 0)
  const intKickaway = matchPlayerStats.reduce((s, r) => s + n(r.kickaway_to_received), 0)
  const intDuels = matchPlayerStats.reduce((s, r) => s + n(r.defensive_duels_won), 0)
  const intTotal = intTackles + intForced + intKickaway + intDuels
  const intensityIndex = oppShots > 0 ? r1(intTotal / oppShots) : 0

  // Over/Under expected
  const overUnder = ourExpPts > 0 ? r1(ourPts - ourExpPts) : null

  return (
    <div className="fade-in">
      {/* Match selector */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {MATCHES.map(m => {
          const hasData = !!analytics[m]
          return (
            <button key={m} onClick={() => setMatchView(m)}
              style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${m === matchView ? 'var(--blue)' : 'var(--border)'}`, background: m === matchView ? 'rgba(74,158,255,0.12)' : 'var(--bg2)', color: m === matchView ? 'var(--blue)' : hasData ? 'var(--text2)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
              <div>{m}</div>
              <div style={{ fontSize: 9, opacity: 0.7 }}>{OPP[m]}</div>
            </button>
          )
        })}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      {!loading && !d && (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'var(--text3)' }}>
          No analytics data for {matchView} yet
        </div>
      )}

      {!loading && d && <>

        {/* Score summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--blue)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Boden</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{ourGoals > 0 ? `${ourGoals}-` : ''}{our2pt > 0 ? `${our2pt}-` : ''}{our1pt}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{ourPts} pts · xPts {r1(ourExpPts)}</div>
            {overUnder != null && <div style={{ fontSize: 10, color: overUnder >= 0 ? 'var(--teal)' : 'var(--red)', marginTop: 2 }}>{overUnder >= 0 ? '+' : ''}{overUnder} vs expected</div>}
          </div>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Opposition</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text2)', lineHeight: 1 }}>{oppPts} pts</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>xPts {r1(oppExpPts)}</div>
          </div>
        </div>

        {/* ── POSSESSION ── */}
        <SectionHeader title="Possession & Attack" color="var(--blue)" />

        <MetricCard label="Possession → Attack %" us={ourPossToShot} opp={null}
          usTarget={92} format="pct"
          description="Attacks as % of total possessions. Target 92% — every possession should become an attack."
        />
        <MetricCard label="Attack → Shot %" us={ourAttacks > 0 ? Math.round(ourShots/ourAttacks*100) : 0} opp={null}
          usTarget={80} format="pct"
          description="Shots as % of attacks. Target 80%."
        />
        <MetricCard label="Turnover Ratio" us={ourTORatio} opp={null}
          usTarget={30} higherBetter={false} format="pct"
          description={`Possessions not converted to attacks + drop shorts ÷ total possessions. Turnovers: ${ourTurnovers} (${ourPoss - ourAttacks} non-attacks + ${ourDropShorts} drop shorts) from ${ourPoss} poss. Target below 30%.`}
        />
        <MetricCard label="Productivity Rate" us={ourProd} opp={null}
          usTarget={5.0}
          description={`Actual pts × 10 ÷ possessions. ${ourPts}pts × 10 ÷ ${ourPoss} = ${ourProd}. Elite target 6.0+.`}
        />
        <MetricCard label="Shot → Score %" us={ourShots > 0 ? Math.round(ourScores/ourShots*100) : 0} opp={null}
          usTarget={70} format="pct"
          description="Scores as % of shots taken. Target 70%."
        />

        {/* Source of shots & scores */}
        {bodenShotsTotal > 0 && (
          <>
            <SectionHeader title="Source of Shots & Scores" color="var(--purple)" />
            <div className="card" style={{ overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(26,51,86,0.2)' }}>
                <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--blue)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Boden</div>
                <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderLeft: '1px solid rgba(26,51,86,0.2)' }}>Opposition</div>
              </div>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(26,51,86,0.2)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px', padding: '4px 14px', gap: 4 }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>Source</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>Shots</div>
                  <div style={{ fontSize: 9, color: 'var(--teal)', textAlign: 'center' }}>Scores</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px', padding: '4px 14px', gap: 4, borderLeft: '1px solid rgba(26,51,86,0.2)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>Source</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>Shots</div>
                  <div style={{ fontSize: 9, color: 'var(--red)', textAlign: 'center' }}>Scores</div>
                </div>
              </div>
              {[
                ['Our KO', bodenFromOwnKO, n(d?.boden_scores_own_ko), 'Boden KO', oppFromBodenKO, n(d?.opp_scores_own_ko)],
                ['Opp KO', bodenFromOppKO, n(d?.boden_scores_opp_ko), 'Opp KO', oppFromOppKO, n(d?.opp_scores_opp_ko)],
                ['Turnover', bodenFromTO, n(d?.boden_scores_turnover), 'Turnover', oppFromTO, n(d?.opp_scores_turnover)],
              ].map(([bl, bs, bsc, ol, os, osc]) => (
                <div key={bl} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(26,51,86,0.15)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px', padding: '7px 14px', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{bl}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: bs > 0 ? 'var(--blue)' : 'var(--text3)', textAlign: 'center' }}>{bs || '—'}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: bsc > 0 ? 'var(--teal)' : 'var(--text3)', textAlign: 'center' }}>{bsc || '—'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px', padding: '7px 14px', gap: 4, alignItems: 'center', borderLeft: '1px solid rgba(26,51,86,0.2)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{ol}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: os > 0 ? 'var(--text2)' : 'var(--text3)', textAlign: 'center' }}>{os || '—'}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: osc > 0 ? 'var(--red)' : 'var(--text3)', textAlign: 'center' }}>{osc || '—'}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(26,51,86,0.3)', background: 'rgba(26,51,86,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px', padding: '7px 14px', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Total</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--blue)', textAlign: 'center' }}>{bodenShotsTotal}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal)', textAlign: 'center' }}>{n(d?.boden_scores_own_ko)+n(d?.boden_scores_opp_ko)+n(d?.boden_scores_turnover) || '—'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px', padding: '7px 14px', gap: 4, alignItems: 'center', borderLeft: '1px solid rgba(26,51,86,0.2)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Total</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', textAlign: 'center' }}>{oppShotsTotal}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)', textAlign: 'center' }}>{n(d?.opp_scores_own_ko)+n(d?.opp_scores_opp_ko)+n(d?.opp_scores_turnover) || '—'}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── KICKOUT BATTLE ── */}
        <SectionHeader title="Kickout Battle" color="var(--teal)" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--teal)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Our KO P1 Won %</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: ourKOBattlePct >= 35 ? 'var(--teal)' : ourKOBattlePct >= 25 ? 'var(--gold)' : 'var(--red)', lineHeight: 1 }}>{ourKOBattlePct}%</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{ourKOWonCleanN} of {ourKOTaken} · target 35%+</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--purple)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Opp KO P1 We Won %</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: oppKOBattlePct <= 20 ? 'var(--teal)' : oppKOBattlePct <= 30 ? 'var(--gold)' : 'var(--red)', lineHeight: 1 }}>{oppKOBattlePct}%</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{oppKOWonCleanN} of {oppKOTaken} · target &lt;20%</div>
          </div>
        </div>

        <KOCard title="Our Kickouts" taken={ourKOTaken}
          cleanPct={n(d?.our_ko_won_clean_pct)} breakPct={n(d?.our_ko_won_break_pct)}
          lostBreakPct={n(d?.our_ko_lost_break_pct)} lostCleanPct={n(d?.our_ko_lost_clean_pct)}
          isUs={true} />

        <KOCard title="Opposition Kickouts (Defending)" taken={oppKOTaken}
          cleanPct={n(d?.opp_ko_won_clean_pct)} breakPct={n(d?.opp_ko_won_break_pct)}
          lostBreakPct={n(d?.opp_ko_lost_break_pct)} lostCleanPct={n(d?.opp_ko_lost_clean_pct)}
          isUs={false} />

        {/* ── INTENSITY ── */}
        <SectionHeader title="Intensity Index" color="var(--red)" />

        <div className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>Intensity Index</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Defensive actions ÷ opp shots · Target 2.0+</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>= {intTotal} actions ÷ {oppShots} opp shots</div>
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 40, fontWeight: 800, color: intensityIndex >= 2.0 ? 'var(--teal)' : intensityIndex >= 1.5 ? 'var(--gold)' : 'var(--red)', lineHeight: 1 }}>{intensityIndex}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {[['Tackles', intTackles, 'var(--blue)'], ['Forced TO', intForced, 'var(--teal)'], ['Kickaway TO', intKickaway, 'var(--teal)'], ['Duels Won', intDuels, 'var(--blue)']].map(([label, val, color]) => (
              <div key={label} style={{ textAlign: 'center', background: 'rgba(26,51,86,0.25)', borderRadius: 7, padding: '8px 4px' }}>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, color: val > 0 ? color : 'var(--text3)' }}>{val}</div>
                <div style={{ fontSize: 8, color: 'var(--text3)', letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 30 }} />
      </>}
    </div>
  )
}
