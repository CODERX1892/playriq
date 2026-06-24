// scoutAggregate.js — combine every scouted game of one opponent into a
// single profile: totals, per-game averages, per-player per-game rates, and
// volume-weighted kickout numbers (percentages are re-derived from raw
// counts, never averaged across games).
//
// NOTE on "per 60 mins": opposition player minutes are NOT available from the
// XML or the GAA Insights PDF. The per-player rate here is per-GAME (output /
// games the player featured in), which equals per-60 for anyone playing a full
// ~60-min game. If opp minutes are ever captured, swap perGame for per-60.

const r1 = n => Math.round(n * 10) / 10           // 1 dp for averages
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

function blankKO() {
  return { taken: 0, won_clean: 0, won_break: 0, lost_break: 0, lost_clean: 0 }
}
function addKO(acc, ko) {
  if (!ko) return acc
  acc.taken += ko.taken || 0
  acc.won_clean += ko.won_clean || 0
  acc.won_break += ko.won_break || 0
  acc.lost_break += ko.lost_break || 0
  acc.lost_clean += ko.lost_clean || 0
  return acc
}
function finishKO(acc) {
  const t = acc.taken
  return {
    ...acc,
    won_clean_pct: pct(acc.won_clean, t),
    won_break_pct: pct(acc.won_break, t),
    lost_break_pct: pct(acc.lost_break, t),
    lost_clean_pct: pct(acc.lost_clean, t),
    retained_pct: pct(acc.won_clean + acc.won_break, t),
  }
}

// rows: array of scout_matches rows, each with a `profile` object plus
// match_label / match_date / competition scalars.
export function aggregateOpponent(rows) {
  const games = rows.length
  if (!games) return null

  const opponent = rows[0].profile?.opponent || rows[0].opponent || 'Unknown'

  // ---- team totals + per-game ----
  const sum = key => rows.reduce((a, r) => a + (r.profile?.totals?.[key] || 0), 0)
  const totals = {
    shots: sum('shots'), scores: sum('scores'), goals: sum('goals'),
    twopt: sum('twopt'), pts: sum('pts'), score_pts: sum('score_pts'),
  }
  const perGame = Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, r1(v / games)])
  )

  // ---- shot sources (totals + per game) ----
  const srcKeys = ['own_ko', 'opp_ko', 'turnover']
  const shot_sources = {}
  srcKeys.forEach(k => {
    const t = rows.reduce((a, r) => a + (r.profile?.shot_sources?.[k] || 0), 0)
    shot_sources[k] = { total: t, perGame: r1(t / games) }
  })

  // ---- per-player shooters across games ----
  const sh = {}
  const addBd = (e, s) => {
    for (const k of ['pt', 'tp', 'gl', 'miss']) {
      e[k] ||= { play: 0, free: 0 }
      e[k].play += s[k]?.play || 0
      e[k].free += s[k]?.free || 0
    }
  }
  rows.forEach(r => {
    (r.profile?.shooters || []).forEach(s => {
      const e = (sh[s.player] ||= { player: s.player, games: 0, shots: 0, score_pts: 0, frees: 0, goals: 0, twopt: 0, pts: 0, wides: 0, play: 0, scored: 0 })
      e.games++
      e.shots += s.shots || 0
      e.score_pts += s.score_pts || 0
      e.frees += s.frees || 0
      e.goals += s.goals || 0
      e.twopt += s.twopt || 0
      e.pts += s.pts || 0
      e.wides += s.wides || 0
      e.play += (s.play != null ? s.play : Math.max(0, (s.shots || 0) - (s.frees || 0)))
      e.scored += (s.scored != null ? s.scored : (s.goals || 0) + (s.twopt || 0) + (s.pts || 0))
      addBd(e, s)
    })
  })
  const shooters = Object.values(sh).map(e => ({
    ...e,
    shots_pg: r1(e.shots / e.games),
    score_pts_pg: r1(e.score_pts / e.games),
  })).sort((a, b) => b.shots - a.shots || b.score_pts - a.score_pts)

  // ---- kickout targets across games ----
  const tgt = {}
  rows.forEach(r => {
    (r.profile?.kickout_targets || []).forEach(t => {
      const e = (tgt[t.player] ||= { player: t.player, targeted: 0, games: 0 })
      e.targeted += t.targeted || 0
      e.games++
    })
  })
  const kickout_targets = Object.values(tgt)
    .map(e => ({ ...e, targeted_pg: r1(e.targeted / e.games) }))
    .sort((a, b) => b.targeted - a.targeted)

  // ---- where they put kickouts (placement by distance band) ----
  const kp = { short: 0, mid: 0, long: 0, total: 0 }
  rows.forEach(r => {
    const k = r.profile?.kickout_placement
    if (!k) return
    kp.short += k.short || 0; kp.mid += k.mid || 0
    kp.long += k.long || 0; kp.total += k.total || 0
  })
  const kickout_placement = {
    ...kp,
    short_pct: pct(kp.short, kp.total),
    mid_pct: pct(kp.mid, kp.total),
    long_pct: pct(kp.long, kp.total),
  }

  // ---- where they shoot from (by pitch third; from PDF, may be missing) ----
  const soGames = rows.filter(r => r.profile?.shot_origins)
  let shot_origins = null
  if (soGames.length) {
    const so = { att: 0, mid: 0, def: 0 }
    soGames.forEach(r => {
      const s = r.profile.shot_origins
      so.att += s.att || 0; so.mid += s.mid || 0; so.def += s.def || 0
    })
    const tot = so.att + so.mid + so.def
    shot_origins = {
      ...so, total: tot, games: soGames.length,
      att_pct: pct(so.att, tot), mid_pct: pct(so.mid, tot), def_pct: pct(so.def, tot),
    }
  }

  // ---- shot zones (scoring heatmap; from PDF chart, may be missing) ----
  const zGames = rows.filter(r => r.profile?.shot_zones)
  let shot_zones = null
  if (zGames.length) {
    const acc = {}
    zGames.forEach(r => {
      Object.entries(r.profile.shot_zones).forEach(([k, v]) => {
        const e = (acc[k] ||= { sc: 0, ms: 0, fr: 0 })
        e.sc += v.sc || 0; e.ms += v.ms || 0; e.fr += v.fr || 0
      })
    })
    Object.values(acc).forEach(e => {
      const t = e.sc + e.ms
      e.total = t
      e.pct = t > 0 ? Math.round((e.sc / t) * 100) : null
    })
    shot_zones = { zones: acc, games: zGames.length }
  }

  // ---- their kickouts (overall + by length), volume-weighted ----
  const their_kickouts = finishKO(rows.reduce((a, r) => addKO(a, r.profile?.their_kickouts), blankKO()))
  const lengths = ['Short', 'Mid-Range', 'Long']
  const their_kickouts_by_length = {}
  lengths.forEach(L => {
    their_kickouts_by_length[L] = finishKO(
      rows.reduce((a, r) => addKO(a, r.profile?.their_kickouts_by_length?.[L]), blankKO())
    )
  })

  // ---- defending our kickouts ----
  const dFaced = rows.reduce((a, r) => a + (r.profile?.defending_our_kickouts?.faced || 0), 0)
  const dWon = rows.reduce((a, r) => a + (r.profile?.defending_our_kickouts?.won || 0), 0)
  const defending_our_kickouts = { faced: dFaced, won: dWon, won_pct: pct(dWon, dFaced) }

  // ---- turnovers won (total + by zone + per game) ----
  const toTotal = rows.reduce((a, r) => a + (r.profile?.turnovers_won?.total || 0), 0)
  const toZone = {}
  rows.forEach(r => {
    const z = r.profile?.turnovers_won?.by_zone || {}
    Object.entries(z).forEach(([k, v]) => { toZone[k] = (toZone[k] || 0) + v })
  })
  const turnovers_won = { total: toTotal, perGame: r1(toTotal / games), by_zone: toZone }

  // ---- per-game breakdown (for the games list) ----
  const games_list = rows
    .map(r => ({
      match_label: r.match_label,
      match_date: r.match_date,
      competition: r.competition,
      totals: r.profile?.totals || {},
      their_ko_retained_pct: r.profile?.their_kickouts?.retained_pct ?? null,
      top_shooter: (r.profile?.shooters || [])[0] || null,
    }))
    .sort((a, b) => String(b.match_date || '').localeCompare(String(a.match_date || '')))

  return {
    opponent,
    games,
    totals,
    perGame,
    shot_sources,
    shot_origins,
    shot_zones,
    shooters,
    kickout_targets,
    their_kickouts,
    their_kickouts_by_length,
    kickout_placement,
    defending_our_kickouts,
    turnovers_won,
    games_list,
  }
}

// Group a flat list of scout_matches rows into { opponent: rows[] }.
export function groupByOpponent(rows) {
  const byOpp = {}
  rows.forEach(r => {
    const opp = r.opponent || r.profile?.opponent || 'Unknown'
    ;(byOpp[opp] ||= []).push(r)
  })
  return byOpp
}
