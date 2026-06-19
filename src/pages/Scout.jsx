import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { aggregateOpponent, groupByOpponent } from '../lib/scoutAggregate'
import ScoutUpload from './ScoutUpload'

const Section = ({ title, hint, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)' }}>{title}</div>
      {hint && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{hint}</div>}
    </div>
    {children}
  </div>
)

function Bar({ label, sub, value, max, accent = 'var(--blue)', right }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
      <div style={{ width: 104, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}{sub != null && <span style={{ color: 'var(--text3)' }}> {sub}</span>}
      </div>
      <div style={{ flex: 1, height: 16, background: 'var(--bg3)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: accent, opacity: 0.85 }} />
      </div>
      <div style={{ width: 78, textAlign: 'right', fontSize: 11, color: 'var(--text2)' }}>{right}</div>
    </div>
  )
}

const Metric = ({ label, value, sub }) => (
  <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{sub}</div>}
  </div>
)

export default function Scout({ canLoad = false }) {
  const [rows, setRows] = useState(null)
  const [opp, setOpp] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    const { data, error: err } = await supabase.from('scout_matches').select('*')
    if (err) { setError(err.message); setRows([]); return }
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const byOpp = useMemo(() => rows ? groupByOpponent(rows) : {}, [rows])
  const opponents = useMemo(() => Object.keys(byOpp).sort(), [byOpp])
  useEffect(() => { if (!opp && opponents.length) setOpp(opponents[0]) }, [opponents, opp])

  const oppRows = useMemo(() => (opp && byOpp[opp]) ? byOpp[opp] : [], [opp, byOpp])
  const includedRows = useMemo(() => oppRows.filter(r => r.included !== false), [oppRows])
  const agg = useMemo(() => includedRows.length ? aggregateOpponent(includedRows) : null, [includedRows])

  const toggleGame = async (row) => {
    const next = row.included === false // currently excluded -> include
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, included: next } : r))
    const { error: err } = await supabase.from('scout_matches').update({ included: next }).eq('id', row.id)
    if (err) { setError(err.message); load() }
  }

  if (rows === null) return <div style={{ padding: 20, color: 'var(--text3)', fontSize: 13 }}>Loading scout data…</div>

  return (
    <div style={{ paddingBottom: 24 }}>
      {canLoad && <ScoutUpload onSaved={load} />}

      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

      {opponents.length === 0 ? (
        <div className="card" style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          No opponents scouted yet.{canLoad ? ' Load a game XML above to start.' : ''}
        </div>
      ) : (
        <>
          {/* Opponent selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {opponents.map(o => (
              <button key={o} className={`pill${opp === o ? ' active' : ''}`} onClick={() => setOpp(o)}>{o}</button>
            ))}
          </div>

          {agg
            ? <Profile agg={agg} totalGames={oppRows.length} />
            : (
              <div className="card" style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 14 }}>
                No games included for {opp}. Toggle one on below to build the profile.
              </div>
            )}

          <GamesList games={oppRows} canLoad={canLoad} onToggle={toggleGame} />
        </>
      )}
    </div>
  )
}

function Profile({ agg, totalGames }) {
  const maxShooter = Math.max(1, ...agg.shooters.map(s => s.shots))
  const maxSrc = Math.max(1, agg.shot_sources.own_ko.total, agg.shot_sources.opp_ko.total, agg.shot_sources.turnover.total)
  const koLen = agg.their_kickouts_by_length
  const gamesLabel = totalGames > agg.games
    ? `${agg.games} of ${totalGames} games included`
    : `${agg.games} game${agg.games > 1 ? 's' : ''} scouted`

  return (
    <div className="card" style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{agg.opponent}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{gamesLabel}</div>
        </div>
      </div>

      {/* Per-game headline */}
      <Section title="Per game" hint="averages across scouted games">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Metric label="Scoreline" value={`${agg.perGame.goals}-${agg.perGame.pts}`} sub={`${agg.perGame.score_pts} pts/game`} />
          <Metric label="Shots / scores" value={`${agg.perGame.shots}`} sub={`${agg.perGame.scores} scores/game`} />
        </div>
      </Section>

      {/* Dangermen — per game rates */}
      <Section title="Dangermen" hint="shots · pts/game">
        {agg.shooters.slice(0, 8).map(s => (
          <Bar key={s.player} label={s.player} value={s.shots} max={maxShooter}
            accent="var(--blue)"
            right={`${s.shots_pg}/g · ${s.score_pts_pg}p${s.frees ? ` · ${s.frees}f` : ''}`} />
        ))}
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
          Bars = total shots; right = per-game shots · per-game points scored.
        </div>
      </Section>

      {/* How they score */}
      <Section title="How they score" hint="shots by source">
        <Bar label="Own kickout" value={agg.shot_sources.own_ko.total} max={maxSrc} accent="var(--teal)" right={`${agg.shot_sources.own_ko.perGame}/g`} />
        <Bar label="Opp kickout" value={agg.shot_sources.opp_ko.total} max={maxSrc} accent="var(--teal)" right={`${agg.shot_sources.opp_ko.perGame}/g`} />
        <Bar label="Turnover" value={agg.shot_sources.turnover.total} max={maxSrc} accent="var(--teal)" right={`${agg.shot_sources.turnover.perGame}/g`} />
      </Section>

      {/* Where they shoot from (by third) */}
      {agg.shot_origins && (
        <Section title="Where they shoot from" hint={`by third · ${agg.shot_origins.games} game${agg.shot_origins.games > 1 ? 's' : ''}`}>
          <Bar label="Attacking 3rd" value={agg.shot_origins.att} max={agg.shot_origins.total} accent="var(--gold)" right={`${agg.shot_origins.att_pct}%`} />
          <Bar label="Middle 3rd" value={agg.shot_origins.mid} max={agg.shot_origins.total} accent="var(--gold)" right={`${agg.shot_origins.mid_pct}%`} />
          <Bar label="Defensive 3rd" value={agg.shot_origins.def} max={agg.shot_origins.total} accent="var(--gold)" right={`${agg.shot_origins.def_pct}%`} />
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            Third the possession started in before they shot.
          </div>
        </Section>
      )}

      {/* Where they put kickouts (placement by length) */}
      {agg.kickout_placement.total > 0 && (
        <Section title="Where they put kickouts" hint="placement by length">
          <Bar label="Short" value={agg.kickout_placement.short} max={agg.kickout_placement.total} accent="var(--teal)" right={`${agg.kickout_placement.short_pct}%`} />
          <Bar label="Mid-range" value={agg.kickout_placement.mid} max={agg.kickout_placement.total} accent="var(--teal)" right={`${agg.kickout_placement.mid_pct}%`} />
          <Bar label="Long" value={agg.kickout_placement.long} max={agg.kickout_placement.total} accent="var(--teal)" right={`${agg.kickout_placement.long_pct}%`} />
        </Section>
      )}

      {/* Their kickouts */}
      <Section title={`Their kickouts · ${agg.their_kickouts.retained_pct}% kept`} hint="% retained by length">
        {['Short', 'Mid-Range', 'Long'].map(L => {
          const k = koLen[L]
          if (!k || !k.taken) return null
          const weak = k.retained_pct < 60
          return (
            <Bar key={L} label={L} sub={`(${k.taken})`} value={k.retained_pct} max={100}
              accent={weak ? 'var(--red)' : 'var(--blue)'}
              right={`${k.retained_pct}% kept`} />
          )
        })}
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
          Lowest band is where their restart is most pressable.
        </div>
      </Section>

      {/* Kickout targets */}
      {agg.kickout_targets.length > 0 && (
        <Section title="Their kickout targets" hint="who they aim for">
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
            {agg.kickout_targets.slice(0, 8).map((t, i) => (
              <span key={t.player}>
                {i > 0 && <span style={{ color: 'var(--text3)' }}> · </span>}
                {t.player} <span style={{ color: 'var(--text3)' }}>({t.targeted})</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Defending + turnovers */}
      <Section title="Defence & turnovers">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Metric label="Win on our KO" value={`${agg.defending_our_kickouts.won_pct}%`} sub={`${agg.defending_our_kickouts.won}/${agg.defending_our_kickouts.faced} faced`} />
          <Metric label="Turnovers won" value={`${agg.turnovers_won.perGame}/g`} sub={zoneSub(agg.turnovers_won.by_zone)} />
        </div>
      </Section>
    </div>
  )
}

// Game list with per-game include/exclude. Excluded games stay stored and
// listed (greyed) but don't feed the aggregate above.
function GamesList({ games, canLoad, onToggle }) {
  const sorted = [...games].sort((a, b) =>
    String(b.match_date || '').localeCompare(String(a.match_date || '')))
  return (
    <div className="card" style={{ padding: 16, marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 8 }}>
        Game by game{canLoad ? ' · tap to include / exclude' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(r => {
          const inc = r.included !== false
          const t = r.profile?.totals || {}
          return (
            <div key={r.id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '9px 11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: inc ? 1 : 0.5 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.match_label || 'Game'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{r.match_date || ''}{r.competition ? ` · ${r.competition}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap', padding: '0 8px' }}>
                <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{t.goals}-{t.pts} ({t.score_pts})</div>
                <div style={{ color: 'var(--text3)' }}>{t.shots} sh</div>
              </div>
              {canLoad && (
                <button onClick={() => onToggle(r)}
                  style={{ border: `1px solid ${inc ? 'var(--teal)' : 'var(--border2)'}`, background: inc ? 'rgba(62,207,142,0.12)' : 'transparent', color: inc ? 'var(--teal)' : 'var(--text3)', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', minWidth: 64 }}>
                  {inc ? '✓ In' : 'Out'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function zoneSub(byZone) {
  const parts = Object.entries(byZone || {})
    .sort((a, b) => b[1] - a[1])
    .map(([z, n]) => `${z.replace(' Third', '')} ${n}`)
  return parts.slice(0, 2).join(' · ') || '—'
}
