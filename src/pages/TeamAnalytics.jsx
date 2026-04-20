import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MATCHES, OPP, n, r1 } from '../lib/utils'

function SectionHeader({ title, color }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color,
      marginBottom: 8, marginTop: 16, borderBottom: `1px solid ${color}33`, paddingBottom: 5 }}>
      {title}
    </div>
  )
}

function MetricCard({ label, us, opp, usTarget, format = 'number', higherBetter = true, description }) {
  const [open, setOpen] = useState(false)
  const fmt = (v) => v == null ? '—' : format === 'pct' ? `${v}%` : `${r1(v)}`
  const usColor = usTarget != null
    ? (higherBetter
        ? (us >= usTarget ? 'var(--teal)' : us >= usTarget * 0.8 ? 'var(--gold)' : 'var(--red)')
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
        <div style={{ padding: '8px 14px 10px', borderTop: '1px solid rgba(26,51,86,0.2)', fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
          {description}
        </div>
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
        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700,
          color: isUs ? (wonPct >= 60 ? 'var(--teal)' : wonPct >= 40 ? 'var(--gold)' : 'var(--red)') : 'var(--text2)' }}>
          {wonPct}% won · {taken} taken
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '10px 14px', gap: 6 }}>
        {[['Won Clean', cleanN, cleanPct, 'var(--teal)'], ['Won Break', breakN, breakPct, 'var(--blue)'],
          ['Lost Break', lostBreakN, lostBreakPct, 'var(--gold)'], ['Lost Clean', lostCleanN, lostCleanPct, 'var(--red)']
        ].map(([l, count, pct, c]) => (
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

  const ourPoss     = n(d?.our_possessions)
  const ourAttacks  = n(d?.our_attacks)
  const ourShots    = n(d?.our_shots)
  const ourScores   = n(d?.our_scores)
  const ourGoals    = n(d?.our_goals)
  const our2pt      = n(d?.our_2pt)
  const our1pt      = n(d?.our_1pt)
  const ourPts      = n(d?.our_score_pts)
  const oppShots    = n(d?.opp_shots)
  const oppGoals    = n(d?.opp_goals)
  const opp2pt      = n(d?.opp_2pt)
  const opp1pt      = n(d?.opp_1pt)
  const oppPts      = n(d?.opp_score_pts)

  // Score display — GAA format "G-P" where P = 2pt*2 + points (goals shown separately)
  const ourDisplayPts = our2pt * 2 + our1pt
  const ourScoreMain  = ourGoals > 0 ? `${ourGoals}-${ourDisplayPts}` : `${ourDisplayPts}`
  const ourScoreSub   = `(${ourGoals > 0 ? `${ourGoals}-` : ''}${our2pt > 0 ? `${our2pt}-` : ''}${our1pt})`

  const oppDisplayPts = opp2pt * 2 + opp1pt
  const oppScoreMain  = oppGoals > 0 ? `${oppGoals}-${oppDisplayPts}` : `${oppDisplayPts}`
  const oppScoreSub   = `(${oppGoals > 0 ? `${oppGoals}-` : ''}${opp2pt > 0 ? `${opp2pt}-` : ''}${opp1pt})`

  // Possession metrics
  const ourPossToAttack  = ourPoss > 0 ? Math.round(ourAttacks / ourPoss * 100) : 0
  const ourAttackToShot  = ourAttacks > 0 ? Math.round(ourShots / ourAttacks * 100) : 0
  const ourShotToScore   = ourShots > 0 ? Math.round(ourScores / ourShots * 100) : 0
  const ourProd          = ourPoss > 0 ? r1(ourPts * 10 / ourPoss) : 0

  // Turnover ratio — stored directly from PDF chart
  const ourTurnoversLost = n(d?.our_turnovers_lost)
  const ourTORatio       = ourPoss > 0 ? Math.round(ourTurnoversLost / ourPoss * 100) : 0

  // Source of shots
  const bodenFromOwnKO   = n(d?.boden_from_own_ko)
  const bodenFromOppKO   = n(d?.boden_from_opp_ko)
  const bodenFromTO      = n(d?.boden_from_turnover)
  const bodenShotsTotal  = bodenFromOwnKO + bodenFromOppKO + bodenFromTO
  const oppFromBodenKO   = n(d?.opp_from_boden_ko)
  const oppFromOppKO     = n(d?.opp_from_opp_ko)
  const oppFromTO        = n(d?.opp_from_turnover)
  const oppShotsTotal    = oppFromBodenKO + oppFromOppKO + oppFromTO

  // Source of scores — GAA format helper
  const scoreRow = (team, src) => {
    const g  = n(d?.[`${team}_goals_${src}`])
    const t  = n(d?.[`${team}_2pt_${src}`])
    const sc = n(d?.[`${team}_scores_${src}`])
    const p  = Math.max(0, sc - g - t)
    const pts = t * 2 + p
    const main = (g > 0 || t > 0 || p > 0)
      ? (g > 0 ? `${g}-${pts}` : `${pts}`)
      : '—'
    const sub = (g > 0 || t > 0 || p > 0)
      ? `(${g > 0 ? `${g}-` : ''}${t > 0 ? `${t}-` : ''}${p})`
      : ''
    return { main, sub, shots: n(d?.[`${team === 'boden' ? 'boden' : 'opp'}_from_${src}`]) }
  }

  // KO battle — short+mid won clean / total taken
  const ourKOTaken          = n(d?.our_ko_taken)
  const ourShortClean       = n(d?.our_ko_short_won_clean)
  const ourMidClean         = n(d?.our_ko_mid_won_clean)
  const ourShortMidClean    = ourShortClean + ourMidClean
  const ourKOBattlePct      = ourKOTaken > 0 ? Math.round(ourShortMidClean / ourKOTaken * 100) : 0

  const oppKOTaken          = n(d?.opp_ko_taken)
  const oppShortClean       = n(d?.opp_ko_short_we_won_clean) // they won clean = KT Won Clean
  const oppMidClean         = n(d?.opp_ko_mid_we_won_clean)
  const oppShortMidClean    = oppShortClean + oppMidClean
  const oppKOBattlePct      = oppKOTaken > 0 ? Math.round(oppShortMidClean / oppKOTaken * 100) : 0

  // Intensity Index
  const intTackles  = matchPlayerStats.reduce((s, r) => s + n(r.tackles), 0)
  const intForced   = matchPlayerStats.reduce((s, r) => s + n(r.forced_to_win), 0)
  const intKickaway = matchPlayerStats.reduce((s, r) => s + n(r.kickaway_to_received), 0)
  const intDuels    = matchPlayerStats.reduce((s, r) => s + n(r.defensive_duels_won), 0)
  const intTotal    = intTackles + intForced + intKickaway + intDuels
  const intensityIndex = oppShots > 0 ? r1(intTotal / oppShots) : 0

  return (
    <div className="fade-in">
      {/* Match selector */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {MATCHES.map(m => {
          const hasData = !!analytics[m]
          return (
            <button key={m} onClick={() => setMatchView(m)}
              style={{ padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${m === matchView ? 'var(--blue)' : 'var(--border)'}`,
                background: m === matchView ? 'rgba(74,158,255,0.12)' : 'var(--bg2)',
                color: m === matchView ? 'var(--blue)' : hasData ? 'var(--text2)' : 'var(--text3)',
                fontFamily: 'Barlow, sans-serif' }}>
              <div>{m}</div>
              <div style={{ fontSize: 9, opacity: 0.7 }}>{OPP[m]}</div>
            </button>
          )
        })}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>}

      {!loading && !d && (
        <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 12, color: 'var(--text3)' }}>
          No analytics data for {matchView} yet — upload XML in the Data tab
        </div>
      )}

      {!loading && d && <>

        {/* ── SCORE ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--blue)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Boden</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 36, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{ourScoreMain}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{ourScoreSub}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Opposition</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 36, fontWeight: 800, color: 'var(--text2)', lineHeight: 1 }}>{oppScoreMain}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{oppScoreSub}</div>
          </div>
        </div>

        {/* ── POSSESSION & ATTACK ── */}
        <SectionHeader title="Possession & Attack" color="var(--blue)" />
        <MetricCard label="Possession → Attack %" us={ourPossToAttack} usTarget={92} format="pct"
          description="Attacks as % of total possessions. Target 92%." />
        <MetricCard label="Attack → Shot %" us={ourAttackToShot} usTarget={80} format="pct"
          description="Shots as % of attacks. Target 80%." />
        <MetricCard label="Turnover Ratio" us={ourTORatio} usTarget={30} higherBetter={false} format="pct"
          description={`Turnovers lost ÷ possessions. ${ourTurnoversLost} turnovers from ${ourPoss} possessions. Target below 30%.`} />
        <MetricCard label="Productivity Rate" us={ourProd} usTarget={5.0}
          description={`Pts × 10 ÷ possessions. ${ourPts}pts × 10 ÷ ${ourPoss} = ${ourProd}. Target 5.0+.`} />
        <MetricCard label="Shot → Score %" us={ourShotToScore} usTarget={70} format="pct"
          description="Scores as % of shots taken. Target 70%." />

        {/* ── SOURCE OF SHOTS & SCORES ── */}
        {bodenShotsTotal > 0 && <>
          <SectionHeader title="Source of Shots & Scores" color="var(--purple)" />
          <div className="card" style={{ overflow: 'hidden', marginBottom: 10 }}>
            {/* Team headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(26,51,86,0.3)' }}>
              <div style={{ padding: '7px 14px', fontSize: 10, color: 'var(--blue)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Boden</div>
              <div style={{ padding: '7px 14px', fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderLeft: '1px solid rgba(26,51,86,0.2)' }}>Opposition</div>
            </div>
            {/* Col labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(26,51,86,0.15)' }}>
              {[false, true].map(isOpp => (
                <div key={String(isOpp)} style={{ display: 'grid', gridTemplateColumns: '1fr 36px 72px', padding: '3px 14px', gap: 4, borderLeft: isOpp ? '1px solid rgba(26,51,86,0.2)' : 'none' }}>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>Source</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>Shots</div>
                  <div style={{ fontSize: 9, color: isOpp ? 'var(--red)' : 'var(--teal)', textAlign: 'center' }}>Score</div>
                </div>
              ))}
            </div>

            {/* Data rows */}
            {[
              { bLabel: 'Our KO',   bShots: bodenFromOwnKO, bSrc: 'own_ko',    oLabel: 'Boden KO', oShots: oppFromBodenKO, oSrc: 'own_ko' },
              { bLabel: 'Opp KO',   bShots: bodenFromOppKO, bSrc: 'opp_ko',    oLabel: 'Opp KO',   oShots: oppFromOppKO,   oSrc: 'opp_ko' },
              { bLabel: 'Turnover', bShots: bodenFromTO,    bSrc: 'turnover',  oLabel: 'Turnover', oShots: oppFromTO,      oSrc: 'turnover' },
            ].map(row => {
              const bg = n(d?.[`boden_goals_${row.bSrc}`])
              const bt = n(d?.[`boden_2pt_${row.bSrc}`])
              const bsc = n(d?.[`boden_scores_${row.bSrc}`])
              const bp = Math.max(0, bsc - bg - bt)
              const bPts = bt*2 + bp
              const bMain = bsc > 0 ? (bg > 0 ? `${bg}-${bPts}` : `${bPts}`) : '—'
              const bSub  = bsc > 0 ? `(${bg > 0 ? `${bg}-` : ''}${bt > 0 ? `${bt}-` : ''}${bp})` : ''

              const og = n(d?.[`opp_goals_${row.oSrc}`])
              const ot = n(d?.[`opp_2pt_${row.oSrc}`])
              const osc = n(d?.[`opp_scores_${row.oSrc}`])
              const op = Math.max(0, osc - og - ot)
              const oPts = ot*2 + op
              const oMain = osc > 0 ? (og > 0 ? `${og}-${oPts}` : `${oPts}`) : '—'
              const oSub  = osc > 0 ? `(${og > 0 ? `${og}-` : ''}${ot > 0 ? `${ot}-` : ''}${op})` : ''

              return (
                <div key={row.bLabel} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(26,51,86,0.15)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 72px', padding: '7px 14px', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{row.bLabel}</span>
                    <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, color: row.bShots > 0 ? 'var(--blue)' : 'var(--text3)', textAlign: 'center' }}>{row.bShots || '—'}</span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: bsc > 0 ? 'var(--teal)' : 'var(--text3)' }}>{bMain}</div>
                      {bSub && <div style={{ fontSize: 9, color: 'var(--text3)' }}>{bSub}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 72px', padding: '7px 14px', gap: 4, alignItems: 'center', borderLeft: '1px solid rgba(26,51,86,0.2)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{row.oLabel}</span>
                    <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, color: row.oShots > 0 ? 'var(--text2)' : 'var(--text3)', textAlign: 'center' }}>{row.oShots || '—'}</span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: osc > 0 ? 'var(--red)' : 'var(--text3)' }}>{oMain}</div>
                      {oSub && <div style={{ fontSize: 9, color: 'var(--text3)' }}>{oSub}</div>}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Totals row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(26,51,86,0.3)', background: 'rgba(26,51,86,0.1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 72px', padding: '7px 14px', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Total</span>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--blue)', textAlign: 'center' }}>{bodenShotsTotal}</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--teal)' }}>
                    {ourScoreMain}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{ourScoreSub}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 72px', padding: '7px 14px', gap: 4, alignItems: 'center', borderLeft: '1px solid rgba(26,51,86,0.2)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Total</span>
                <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--text2)', textAlign: 'center' }}>{oppShotsTotal}</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--red)' }}>{oppScoreMain}</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{oppScoreSub}</div>
                </div>
              </div>
            </div>
          </div>
        </>}

        {/* ── KICKOUT BATTLE ── */}
        <SectionHeader title="Kickout Battle" color="var(--teal)" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--teal)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Our KO Clean %</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, lineHeight: 1,
              color: ourKOBattlePct >= 35 ? 'var(--teal)' : ourKOBattlePct >= 25 ? 'var(--gold)' : 'var(--red)' }}>
              {ourKOBattlePct}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
              {ourShortMidClean} short/mid clean of {ourKOTaken}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>target 35%+</div>
          </div>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--purple)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Opp KO They Got Clean %</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, lineHeight: 1,
              color: oppKOBattlePct <= 20 ? 'var(--teal)' : oppKOBattlePct <= 30 ? 'var(--gold)' : 'var(--red)' }}>
              {oppKOBattlePct}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
              {oppShortMidClean} short/mid clean of {oppKOTaken}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>target &lt;20%</div>
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

        {/* ── INTENSITY INDEX ── */}
        <SectionHeader title="Intensity Index" color="var(--red)" />
        <div className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>Intensity Index</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Defensive actions ÷ opp shots · Target 2.0+</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>{intTotal} actions ÷ {oppShots} opp shots</div>
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 40, fontWeight: 800, lineHeight: 1,
              color: intensityIndex >= 2.0 ? 'var(--teal)' : intensityIndex >= 1.5 ? 'var(--gold)' : 'var(--red)' }}>
              {intensityIndex}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {[['Tackles', intTackles, 'var(--blue)'], ['Forced TO', intForced, 'var(--teal)'],
              ['Kickaway TO', intKickaway, 'var(--teal)'], ['Duels Won', intDuels, 'var(--blue)']
            ].map(([label, val, color]) => (
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
