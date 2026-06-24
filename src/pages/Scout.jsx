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

// GAA scoreline incl. two-pointers: 1 goal / 1 two-pointer / 10 points -> "1-1-10",
// folding to "1-10" only when there are no two-pointers.
function scoreline(goals, twopt, pts) {
  const g = Math.round(goals || 0), t = Math.round(twopt || 0), p = Math.round(pts || 0)
  return t > 0 ? `${g}-${t}-${p}` : `${g}-${p}`
}

const Metric = ({ label, value, sub }) => (
  <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{sub}</div>}
  </div>
)

// One dangerman: volume bar + scored/shots + type chips (play/free/2pt/goal).
// One score-type line: "1-point  3 (2 play · 1 free)", dimmed if none scored.
function ScoreLine({ label, color, bd }) {
  const total = (bd?.play || 0) + (bd?.free || 0)
  const on = total > 0
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11, opacity: on ? 1 : 0.4, marginBottom: 2 }}>
      <span style={{ width: 56, color, fontWeight: 700 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 700, width: 16 }}>{total}</span>
      <span style={{ color: 'var(--text3)' }}>
        {on ? `${bd.play} play${bd.free ? ` · ${bd.free} free` : ''}` : '—'}
      </span>
    </div>
  )
}
function ThreatRow({ s, max }) {
  const w = max > 0 ? Math.round((s.shots / max) * 100) : 0
  const conv = s.shots > 0 ? Math.round((s.scored / s.shots) * 100) : 0
  const miss = s.miss || { play: 0, free: 0 }
  const missTotal = (miss.play || 0) + (miss.free || 0)
  return (
    <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.player}</span>
        <span style={{ fontSize: 11, color: 'var(--text2)' }}>
          <b style={{ color: 'var(--gold)' }}>{s.scored}</b>/{s.shots} scored · {s.shots_pg}/g · {conv}%
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 7 }}>
        <div style={{ height: '100%', width: `${w}%`, background: 'var(--blue)', opacity: 0.8 }} />
      </div>
      <ScoreLine label="1-point" color="var(--blue)" bd={s.pt} />
      <ScoreLine label="2-point" color="var(--gold)" bd={s.tp} />
      <ScoreLine label="goal" color="var(--red)" bd={s.gl} />
      {missTotal > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
          {missTotal} wide ({miss.play} play{miss.free ? ` · ${miss.free} free` : ''})
        </div>
      )}
    </div>
  )
}

// Simplified vertical GAA pitch with three shaded zones (top -> bottom).
// bands: [{label, value, pct}] x3. accent tints the shading by volume.
function PitchBands({ bands, accent = 'var(--gold)', topTag, bottomTag }) {
  const maxPct = Math.max(1, ...bands.map(b => b.pct))
  const W = 200, H = 300, m = 8
  const fW = W - m * 2, fH = H - m * 2, bH = fH / 3
  const op = p => 0.1 + 0.8 * (p / maxPct)
  const cx = W / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 230, display: 'block', margin: '0 auto' }}>
      <rect x={m} y={m} width={fW} height={fH} fill="var(--bg3)" stroke="var(--border2)" strokeWidth="1.5" rx="3" />
      {bands.map((b, i) => (
        <rect key={i} x={m} y={m + i * bH} width={fW} height={bH} fill={accent} opacity={op(b.pct)} />
      ))}
      <line x1={m} y1={m + bH} x2={m + fW} y2={m + bH} stroke="var(--border2)" strokeWidth="1" opacity="0.55" />
      <line x1={m} y1={m + 2 * bH} x2={m + fW} y2={m + 2 * bH} stroke="var(--border2)" strokeWidth="1" opacity="0.55" />
      <circle cx={cx} cy={H / 2} r="15" fill="none" stroke="var(--border2)" strokeWidth="1" opacity="0.45" />
      <rect x={cx - 13} y={m - 3} width="26" height="3" fill="var(--text3)" />
      <rect x={cx - 24} y={m} width="48" height="15" fill="none" stroke="var(--border2)" strokeWidth="1" opacity="0.45" />
      <rect x={cx - 13} y={H - m} width="26" height="3" fill="var(--text3)" />
      <rect x={cx - 24} y={H - m - 15} width="48" height="15" fill="none" stroke="var(--border2)" strokeWidth="1" opacity="0.45" />
      {bands.map((b, i) => (
        <g key={'t' + i}>
          <text x={cx} y={m + i * bH + bH / 2 - 1} textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text)">{b.pct}%</text>
          <text x={cx} y={m + i * bH + bH / 2 + 13} textAnchor="middle" fontSize="9" fill="var(--text2)">{b.label} · {b.value}</text>
        </g>
      ))}
      {topTag && <text x={cx} y={m + 11} textAnchor="middle" fontSize="8" fill="var(--text3)">{topTag}</text>}
      {bottomTag && <text x={cx} y={H - m - 5} textAnchor="middle" fontSize="8" fill="var(--text3)">{bottomTag}</text>}
    </svg>
  )
}

// Scoring heatmap on the forward boxes. zones keyed by box number.
// Rows top->bottom: full-forward (nearest goal) / half-forward / midfield.
function ZoneHeatPitch({ zones, games }) {
  const grid = [[15, 14, 13], [12, 11, 10], [9, 0, 8]]
  const lineName = ['Full-forward', 'Half-forward', 'Midfield']
  const maxTotal = Math.max(1, ...Object.values(zones).map(z => z.total || 0))
  const W = 210, H = 280, m = 10, fW = W - 2 * m, fH = H - 2 * m
  const cw = fW / 3, ch = fH / 3, cx = W / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 250, display: 'block', margin: '0 auto' }}>
      <rect x={m} y={m} width={fW} height={fH} fill="var(--bg3)" stroke="var(--border2)" strokeWidth="1.5" rx="3" />
      {grid.map((line, ri) => line.map((boxNo, ci) => {
        const z = zones[String(boxNo)] || { total: 0 }
        const x = m + ci * cw, y = m + ri * ch
        const has = z.total > 0
        const hue = has ? (z.pct / 100) * 120 : 0
        const op = has ? 0.2 + 0.65 * (z.total / maxTotal) : 0
        return (
          <g key={boxNo}>
            <rect x={x} y={y} width={cw} height={ch} fill={has ? `hsl(${hue} 68% 45%)` : 'transparent'} opacity={op} />
            <rect x={x} y={y} width={cw} height={ch} fill="none" stroke="var(--border2)" strokeWidth="0.5" opacity="0.4" />
            <text x={x + 4} y={y + 11} fontSize="8" fill="var(--text3)">{boxNo}</text>
            {has && (
              <>
                <text x={x + cw / 2} y={y + ch / 2 + 2} textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--text)">{z.pct}%</text>
                <text x={x + cw / 2} y={y + ch / 2 + 14} textAnchor="middle" fontSize="8" fill="var(--text2)">{z.sc}/{z.total}{z.fr > 0 ? ` · ${z.fr}f` : ''}</text>
              </>
            )}
          </g>
        )
      }))}
      <rect x={cx - 14} y={m - 3} width="28" height="3" fill="var(--text3)" />
      <text x={cx} y={H - 1} textAnchor="middle" fontSize="8" fill="var(--text3)">goal at top · {games} game{games > 1 ? 's' : ''}</text>
    </svg>
  )
}

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

  const deleteGame = async (row) => {
    if (!window.confirm(`Delete this scouted game?\n\n${row.match_label || 'Game'}${row.match_date ? ` · ${row.match_date}` : ''}\n\nThis removes it from ${row.opponent}'s profile permanently.`)) return
    setRows(rs => rs.filter(r => r.id !== row.id))
    const { error: err } = await supabase.from('scout_matches').delete().eq('id', row.id)
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

          <GamesList games={oppRows} canLoad={canLoad} onToggle={toggleGame} onDelete={deleteGame} />
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
          <Metric label="Scoreline" value={scoreline(agg.perGame.goals, agg.perGame.twopt, agg.perGame.pts)} sub={`${agg.perGame.score_pts} pts/game`} />
          <Metric label="Shots / scores" value={`${agg.perGame.shots}`} sub={`${agg.perGame.scores} scores/game`} />
        </div>
      </Section>

      {/* Dangermen — scores by type x play/free */}
      <Section title="Dangermen" hint="scores by type · play vs free">
        {agg.shooters.slice(0, 8).map(s => <ThreatRow key={s.player} s={s} max={maxShooter} />)}
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          Each shooter's scores split into 1-point / 2-point / goal, and how many came from open play vs frees. Wides are shown separately (a miss can't be typed). Sorted by shot volume.
        </div>
      </Section>

      {/* How they score */}
      <Section title="How they score" hint="shots by source">
        <Bar label="Own kickout" value={agg.shot_sources.own_ko.total} max={maxSrc} accent="var(--teal)" right={`${agg.shot_sources.own_ko.perGame}/g`} />
        <Bar label="Opp kickout" value={agg.shot_sources.opp_ko.total} max={maxSrc} accent="var(--teal)" right={`${agg.shot_sources.opp_ko.perGame}/g`} />
        <Bar label="Turnover" value={agg.shot_sources.turnover.total} max={maxSrc} accent="var(--teal)" right={`${agg.shot_sources.turnover.perGame}/g`} />
      </Section>

      {/* Scoring heatmap (hot/cold zones from the shot chart) */}
      {agg.shot_zones && (
        <Section title="Where they shoot from" hint="shot location · hot = high score %">
          <ZoneHeatPitch zones={agg.shot_zones.zones} games={agg.shot_zones.games} />
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
            Where shots are actually taken (not where they win the ball). Green = boxes they convert from, red = where you can force them into low-percentage shots. <b>{'\u00B7'} Nf</b> = how many of a box's shots were frees (◆ on the chart) rather than from play — a box that's hot mostly off frees is a discipline problem, not an open-play one.
          </div>
        </Section>
      )}

      {/* Where they win the ball before shooting (by third) */}
      {agg.shot_origins && (
        <Section title="Where they win the ball before shooting" hint={`possession origin · ${agg.shot_origins.games} game${agg.shot_origins.games > 1 ? 's' : ''}`}>
          <PitchBands accent="var(--gold)" topTag="they attack ↑" bands={[
            { label: 'Attacking', value: agg.shot_origins.att, pct: agg.shot_origins.att_pct },
            { label: 'Middle', value: agg.shot_origins.mid, pct: agg.shot_origins.mid_pct },
            { label: 'Defensive', value: agg.shot_origins.def, pct: agg.shot_origins.def_pct },
          ]} />
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
            Which third they <b>win possession</b> in before a shot — different from where the shot is taken. High defensive-3rd = they punish deep turnovers and break.
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
function GamesList({ games, canLoad, onToggle, onDelete }) {
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
                <div style={{ color: 'var(--gold)', fontWeight: 700 }}>{scoreline(t.goals, t.twopt, t.pts)} ({t.score_pts})</div>
                <div style={{ color: 'var(--text3)' }}>{t.shots} sh</div>
              </div>
              {canLoad && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => onToggle(r)}
                    style={{ border: `1px solid ${inc ? 'var(--teal)' : 'var(--border2)'}`, background: inc ? 'rgba(62,207,142,0.12)' : 'transparent', color: inc ? 'var(--teal)' : 'var(--text3)', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', minWidth: 64 }}>
                    {inc ? '✓ In' : 'Out'}
                  </button>
                  <button onClick={() => onDelete(r)} title="Delete game"
                    style={{ border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text3)', borderRadius: 6, padding: '4px 8px', fontSize: 13, lineHeight: 1, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
                    🗑
                  </button>
                </div>
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
