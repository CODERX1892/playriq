// scoutParse.js — Opponent scouting parser.
//
// Takes a GAA Insights / Hudl match-tags XML string and returns an
// OPPONENT-CENTRIC profile (the non-Ballyboden team), suitable for the
// Scout section. Pure function, no DB. Mirrors the XML semantics already
// proven in XMLUpload.jsx but framed around the opposition and with the
// per-player intel (shooters, kickout targets) that scouting needs.
//
// XML facts this relies on (reconciled against GAA Insights PDF p3/p8/p11/p22):
//   - Events are <instance> rows sharing an <ID>; <code> is "<Team> Shot|Kickout|Turnover Won".
//   - Shot labels: Player, Outcome (Point/Two Points/Goal/Wide Left/Wide Right/Short/Saved),
//     Description (Play/Free/Penalty), Source (Own Kickout/Opp Kickout/Turnover).
//   - Kickout labels: Player (= the RECEIVER/target, matches PDF Kickout Targets),
//     Kickout_Length (Short/Mid-Range/Long), PO_Result (KT/RT Won Clean/Break).
//     KT = kicking team, RT = receiving team. For the opponent's own kickout,
//     KT = opponent, so KT Won = they retained, RT Won = we won it off them.

const BODEN = 'Ballyboden St Endas'
const SCORE_OUTCOMES = new Set(['Point', 'Two Points', 'Goal'])
const WIDE_OUTCOMES = new Set(['Wide Left', 'Wide Right', 'Short', 'Saved'])

function groupEvents(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML')
  const events = {}
  doc.querySelectorAll('instance').forEach(inst => {
    const id = inst.querySelector('ID')?.textContent
    if (!id) return
    const code = inst.querySelector('code')?.textContent || ''
    if (!events[id]) events[id] = { code, labels: {} }
    inst.querySelectorAll('label').forEach(label => {
      const g = label.querySelector('group')?.textContent
      const t = (label.querySelector('text')?.textContent || '').trim()
      if (g && !(g in events[id].labels)) events[id].labels[g] = t
    })
  })
  return Object.values(events)
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0)

function koSplit(kos) {
  const taken = kos.length
  const count = r => kos.filter(e => e.labels.PO_Result === r).length
  const kc = count('KT Won Clean'), kb = count('KT Won Break')
  const rb = count('RT Won Break'), rc = count('RT Won Clean')
  return {
    taken,
    // raw counts kept alongside the pcts so multi-game aggregation can
    // re-derive exact rates (summing percentages across games is wrong).
    won_clean: kc, won_break: kb, lost_break: rb, lost_clean: rc,
    won_clean_pct: pct(kc, taken),   // they kept it cleanly
    won_break_pct: pct(kb, taken),   // they won the break
    lost_break_pct: pct(rb, taken),  // we won the break off them
    lost_clean_pct: pct(rc, taken),  // we picked it clean
    retained_pct: pct(kc + kb, taken),
  }
}

export function parseScoutXML(xmlText) {
  const evs = groupEvents(xmlText)

  const teamNames = [...new Set(evs.map(e => {
    const m = e.code?.match(/^(.+?)\s+(Shot|Kickout|Turnover)/)
    return m ? m[1] : null
  }).filter(Boolean))]
  const opp = teamNames.find(t => !t.includes('Ballyboden')) || ''
  if (!opp) throw new Error('Could not detect an opposition team in this XML')

  const oppShots = evs.filter(e => e.code === `${opp} Shot`)
  const oppKOs = evs.filter(e => e.code === `${opp} Kickout`)
  const bodenKOs = evs.filter(e => e.code === `${BODEN} Kickout`)
  const oppTOs = evs.filter(e => e.code === `${opp} Turnover Won`)

  // Totals
  const count = (lst, pred) => lst.filter(pred).length
  const goals = count(oppShots, e => e.labels.Outcome === 'Goal')
  const twopt = count(oppShots, e => e.labels.Outcome === 'Two Points')
  const pts = count(oppShots, e => e.labels.Outcome === 'Point')
  const totals = {
    shots: oppShots.length,
    goals, twopt, pts,
    scores: count(oppShots, e => SCORE_OUTCOMES.has(e.labels.Outcome)),
    score_pts: goals * 3 + twopt * 2 + pts,
  }

  // Per-player shooters — scores broken out by type (1pt/2pt/goal) x source
  // (play/free). Misses can't be typed (a wide doesn't say point-or-goal), so
  // they're tracked only by source.
  const sh = {}
  oppShots.forEach(e => {
    const p = e.labels.Player || 'Unknown'
    const o = e.labels.Outcome
    const free = e.labels.Description === 'Free' || e.labels.Description === 'Penalty'
    const src = free ? 'free' : 'play'
    const s = (sh[p] ||= {
      player: p, shots: 0, goals: 0, twopt: 0, pts: 0, wides: 0, frees: 0, play: 0,
      pt: { play: 0, free: 0 }, tp: { play: 0, free: 0 }, gl: { play: 0, free: 0 }, miss: { play: 0, free: 0 },
    })
    s.shots++
    if (free) s.frees++; else s.play++
    if (o === 'Goal') { s.goals++; s.gl[src]++ }
    else if (o === 'Two Points') { s.twopt++; s.tp[src]++ }
    else if (o === 'Point') { s.pts++; s.pt[src]++ }
    else if (WIDE_OUTCOMES.has(o)) { s.wides++; s.miss[src]++ }
  })
  const shooters = Object.values(sh)
    .map(s => ({ ...s, scored: s.goals + s.twopt + s.pts, score_pts: s.goals * 3 + s.twopt * 2 + s.pts }))
    .filter(s => s.player !== 'Unknown')
    .sort((a, b) => b.shots - a.shots)

  // Shot sources / outcomes / types
  const srcCount = key => count(oppShots, e => e.labels.Source === key)
  const shot_sources = {
    own_ko: srcCount('Own Kickout'),
    opp_ko: srcCount('Opp Kickout'),
    turnover: srcCount('Turnover'),
  }
  const shot_outcomes = {}
  oppShots.forEach(e => { const o = e.labels.Outcome || 'Unknown'; shot_outcomes[o] = (shot_outcomes[o] || 0) + 1 })
  const shot_types = {
    play: count(oppShots, e => e.labels.Description === 'Play'),
    free: count(oppShots, e => e.labels.Description === 'Free'),
    penalty: count(oppShots, e => e.labels.Description === 'Penalty'),
  }

  // Their kickouts: retention overall + by length
  const their_kickouts = koSplit(oppKOs)
  const their_kickouts_by_length = {
    Short: koSplit(oppKOs.filter(e => e.labels.Kickout_Length === 'Short')),
    'Mid-Range': koSplit(oppKOs.filter(e => e.labels.Kickout_Length === 'Mid-Range')),
    Long: koSplit(oppKOs.filter(e => e.labels.Kickout_Length === 'Long')),
  }

  // Where they put kickouts — placement by distance band (the "where" the
  // heatmap shows, at band resolution; pure XML so always available).
  const kickout_placement = {
    short: their_kickouts_by_length.Short.taken,
    mid: their_kickouts_by_length['Mid-Range'].taken,
    long: their_kickouts_by_length.Long.taken,
    total: oppKOs.length,
  }

  // Their kickout targets (Player on their KO events = receiver)
  const tgt = {}
  oppKOs.forEach(e => { const p = e.labels.Player; if (p) tgt[p] = (tgt[p] || 0) + 1 })
  const kickout_targets = Object.entries(tgt)
    .map(([player, targeted]) => ({ player, targeted }))
    .sort((a, b) => b.targeted - a.targeted)

  // How they defend OUR kickouts (RT win on a Boden KO = opponent won it)
  const faced = bodenKOs.length
  const won = count(bodenKOs, e => ['RT Won Clean', 'RT Won Break'].includes(e.labels.PO_Result))
  const defending_our_kickouts = { faced, won, won_pct: pct(won, faced) }

  // Turnovers won by zone
  const zone = {}
  oppTOs.forEach(e => { const z = e.labels.turnover_zone || 'Unknown'; zone[z] = (zone[z] || 0) + 1 })
  const turnovers_won = { total: oppTOs.length, by_zone: zone }

  return {
    opponent: opp,
    totals,
    shot_sources,
    shot_outcomes,
    shot_types,
    // shot_origins (by pitch third) is not in the XML — it comes from the PDF
    // (p22) and is added by the loader. Null until provided.
    shot_origins: null,
    shooters,
    their_kickouts,
    their_kickouts_by_length,
    kickout_placement,
    kickout_targets,
    defending_our_kickouts,
    turnovers_won,
  }
}

// Flattens a profile into the scalar columns stored alongside the JSONB blob,
// so the Scout list can sort/filter without unpacking JSON.
export function scoutHeadline(profile) {
  return {
    opp_shots: profile.totals.shots,
    opp_scores: profile.totals.scores,
    opp_goals: profile.totals.goals,
    opp_2pt: profile.totals.twopt,
    opp_1pt: profile.totals.pts,
    opp_score_pts: profile.totals.score_pts,
    their_ko_taken: profile.their_kickouts.taken,
    their_ko_retained_pct: profile.their_kickouts.retained_pct,
  }
}
