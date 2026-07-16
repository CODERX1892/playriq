// Shared metric definitions for the simplified Player Dashboard and the
// Leaderboards tab. Keeping the maths in one place guarantees the tile a player
// sees and the leaderboard they're ranked on always agree.
//
// A "metric" describes how to turn a set of player_stats rows into a single
// comparable number. Three shapes:
//   - count : a tally (kickouts, tackles, turnovers…). Ranked per-60 or by total.
//   - pct   : a shooting percentage. Ranked by %, gated by a min-attempts qualifier.
//   - ratio : Pass Efficiency Rating (already a 0–1+ ratio). Ranked high→low.

import { n, sf } from './utils'

// Minimum minutes (in the active scope) before a player is ranked on a per-60
// board. Stops a short cameo posting a silly per-60 rate. Matches the 120-min
// season floor used by the Home benchmark. Unqualified players are still shown
// their own standing separately, just not ranked.
export const MIN_RANK_MINS = 120

// Minimum season attempts to qualify for each shooting-% board, so 1-from-1
// (100%) can't top a leaderboard. Tuned for a GAA season's sample sizes — adjust
// here if you want them tighter/looser.
export const MIN_ATT = {
  pct_1: 5, pct_2: 3, pct_goal: 2,
  // Frees are ranked regardless of attempts (see qualifies()), so these are unused.
  pct_1f: 1, pct_2f: 1, pct_goalf: 1,
}

export const minutesOf = (rows) => rows.reduce((s, r) => s + n(r.total_minutes), 0)

// ─── Raw aggregators over a set of rows ──────────────────────────────────────
// Own kickout won  = clean (any pressure) + break, ours
const ownKo = (r) =>
  sf(r, 'won_clean_p1_our') + sf(r, 'won_clean_p2_our') + sf(r, 'won_clean_p3_our') + sf(r, 'won_break_our')
// Opposition kickout won = clean + break, on their restart
const oppKo = (r) =>
  sf(r, 'won_clean_p1_opp') + sf(r, 'won_clean_p2_opp') + sf(r, 'won_clean_p3_opp') + sf(r, 'won_break_opp')
// 1v1 battle lost where the opponent got a shot away = DNE + breach
const lost1v1 = (r) => sf(r, 'dne') + sf(r, 'breach_1v1')
// Positive turnover made = contact (forced) + interception
const posTo = (r) => sf(r, 'forced_to_win') + sf(r, 'kickaway_to_received')
// Negative turnover made = every ball given away (incl. drop shorts)
const negTo = (r) =>
  sf(r, 'turnovers_in_contact') + sf(r, 'turnover_skill_error') + sf(r, 'turnovers_kicked_away') + sf(r, 'drop_shorts')

// Shooting-% helpers → { scored, att }
// From-play attempts = scored + wide + drop-short/block (a miss is a miss).
const playPct = (r, scored, wide, ds) => ({ scored: sf(r, scored), att: sf(r, scored) + sf(r, wide) + sf(r, ds) })
// Frees keep their stored *_attempts_f count (no wide_f column to derive from).
const freePct = (r, scored, att) => ({ scored: sf(r, scored), att: sf(r, att) })

// Pass Efficiency Rating — identical formula to the Coach dashboard so the two
// views never disagree. Advance passes weighted 3×, turnovers penalised 3×.
export const perRating = (r) => {
  const sp = sf(r, 'simple_pass'), ap = sf(r, 'advance_pass')
  const to = negTo(r)
  const denom = Math.max(sp + ap + to * 3, 1)
  return Math.round((sp * 1 + ap * 3) / denom * 100) / 100
}

// ─── Metric catalogue ────────────────────────────────────────────────────────
export const METRICS = [
  { key: 'own_ko',   group: 'Kickouts', color: 'var(--teal)', type: 'count', label: 'Own Kickout Won',        short: 'Own KO Won',      agg: ownKo },
  { key: 'opp_ko',   group: 'Kickouts', color: 'var(--blue)', type: 'count', label: 'Opposition Kickout Won', short: 'Opp KO Won',      agg: oppKo },
  // showZeros: true → every 120+ min player is ranked, even on zero (effort stats
  // everyone racks up). Without it, only players with at least one are listed
  // (opportunity/skill stats — a zero is just "didn't get one", not worth listing).
  { key: 'tackles',  group: 'Defence',  color: 'var(--blue)', type: 'count', label: 'Tackles Made',           short: 'Tackles',         agg: (r) => sf(r, 'tackles'), showZeros: true },
  { key: 'lost_1v1', group: 'Defence',  color: 'var(--red)',  type: 'count', label: '1v1 Lost — Opp Shot',    short: '1v1 Lost',        agg: lost1v1, inverted: true, showZeros: true },
  { key: 'pos_to',   group: 'Defence',  color: 'var(--teal)', type: 'count', label: 'Positive Turnover Made', short: 'Positive TO',     agg: posTo, showZeros: true },
  { key: 'assists',  group: 'Attack',   color: 'var(--purple)', type: 'count', label: 'Assists',              short: 'Assists',         agg: (r) => sf(r, 'assists_shots') },
  { key: 'neg_to',   group: 'Attack',   color: 'var(--red)',  type: 'count', label: 'Negative Turnover Made', short: 'Negative TO',     agg: negTo, inverted: true, showZeros: true, invertedNote: 'Highest ranked (1st) has fewest turnovers (min 120 mins)' },

  { key: 'pct_1',    group: 'Shooting', color: 'var(--gold)', type: 'pct', label: '1-Pointer %',   short: '1-Pointer', minAtt: MIN_ATT.pct_1,    pct: (r) => playPct(r, 'one_pointer_scored', 'one_pointer_wide', 'one_pointer_drop_short_block') },
  { key: 'pct_2',    group: 'Shooting', color: 'var(--gold)', type: 'pct', label: '2-Pointer %',   short: '2-Pointer', minAtt: MIN_ATT.pct_2,    pct: (r) => playPct(r, 'two_pointer_scored', 'two_pointer_wide', 'two_pointer_drop_short_block') },
  { key: 'pct_goal', group: 'Shooting', color: 'var(--gold)', type: 'pct', label: 'Goal Shot %',   short: 'Goal Shot', minAtt: MIN_ATT.pct_goal, pct: (r) => playPct(r, 'goals_scored', 'goals_wide', 'goal_drop_short_block') },

  { key: 'pct_1f',   group: 'Frees', color: 'var(--purple)', type: 'pct', free: true, label: '1-Pt Free % (incl 45s)', short: '1-Pt Free', minAtt: MIN_ATT.pct_1f,    pct: (r) => freePct(r, 'one_pointer_scored_f', 'one_pointer_attempts_f') },
  { key: 'pct_2f',   group: 'Frees', color: 'var(--purple)', type: 'pct', free: true, label: '2-Pt Free %',           short: '2-Pt Free', minAtt: MIN_ATT.pct_2f,    pct: (r) => freePct(r, 'two_pointer_scored_f', 'two_pointer_attempts_f') },
  { key: 'pct_goalf',group: 'Frees', color: 'var(--purple)', type: 'pct', free: true, label: 'Goal Free %',           short: 'Goal Free', minAtt: MIN_ATT.pct_goalf, pct: (r) => freePct(r, 'goals_scored_f', 'goal_attempts_f') },

  { key: 'per',      group: 'Efficiency', color: 'var(--blue)', type: 'ratio', label: 'Pass Efficiency (PER)', short: 'Pass Efficiency', ratio: perRating,
    note: 'A measure of how many possessions you\'ve had and what you did with them. Having more of the ball brings the potential for more turnovers, so it\'s scored as a ratio — the possessions you\'ve had against what you did with them afterwards. Advancing the ball forward is worth more than a simple pass and is rewarded, while giving it away is not.' },
]

export const metricByKey = Object.fromEntries(METRICS.map((m) => [m.key, m]))

// ─── Competition bucketing ───────────────────────────────────────────────────
// Unlike lib/utils' COMP_OF (which folds Challenge in with League for the staff
// toggle), the leaderboards want Challenge as its own scope. Detect from the
// match's competition/match_type, falling back to the match_id prefix
// (AFL → league, CHL → challenge, SFC → championship).
export const compOf = (matchId, matchMap) => {
  const m = matchMap && matchMap[matchId]
  const c = String((m && (m.competition || m.match_type)) || '').toLowerCase()
  if (c.startsWith('champ')) return 'championship'
  if (c.startsWith('chall')) return 'challenge'
  const id = String(matchId || '').toUpperCase()
  if (id.startsWith('SFC')) return 'championship'
  if (id.startsWith('CHL')) return 'challenge'
  return 'league'
}

// Build a { match_id -> match } lookup from a matches array.
export const matchMapOf = (matches) => {
  const map = {}
  ;(matches || []).forEach((m) => { map[m.match_id] = m })
  return map
}

// ─── Pool + board builders ───────────────────────────────────────────────────
// pool = one entry per player: their rows (optionally scoped to a set of
// match_ids) plus total minutes in that scope.
export function buildPool(allStats, allPlayers, scopeIds) {
  return allPlayers
    .map((p) => {
      let rows = allStats.filter((r) => r.player_name === p.name)
      if (scopeIds) rows = rows.filter((r) => scopeIds.has(r.match_id))
      return { name: p.name, position: p.position, rows, mins: minutesOf(rows) }
    })
    .filter((x) => x.rows.length > 0)
}

// Compute a single player's entry for a metric (no filtering). Used both to
// build boards and to show a viewer their own line when they haven't qualified.
// Each entry: { name, position, value, display, mins, raw?, p60?, scored?, att? }
export function computeEntry(metric, x, mode) {
  if (metric.type === 'count') {
    const raw = metric.agg(x.rows)
    const p60 = x.mins > 0 ? Math.round((raw / x.mins) * 60 * 10) / 10 : 0
    const value = mode === 'total' ? raw : p60
    return { name: x.name, position: x.position, mins: x.mins, raw, p60, value, display: mode === 'total' ? String(raw) : `${p60}` }
  }
  if (metric.type === 'pct') {
    const { scored, att } = metric.pct(x.rows)
    const v = att > 0 ? Math.round((scored / att) * 100) : 0
    return { name: x.name, position: x.position, mins: x.mins, scored, att, value: v, display: att > 0 ? `${v}%` : '—' }
  }
  // ratio (PER)
  const v = metric.ratio(x.rows)
  return { name: x.name, position: x.position, mins: x.mins, value: v, display: v.toFixed(2) }
}

// Does this player entry qualify to be RANKED on the board? (The viewer is not
// special-cased here — an unqualified viewer is surfaced separately so a 1/1
// can never top a percentage board.)
function qualifies(metric, e, mode) {
  if (e.mins <= 0) return false
  // Counting boards: always past the 120-min floor. showZeros metrics then rank
  // everyone; the rest only list players with at least one of the stat.
  if (metric.type === 'count') {
    if (e.mins < MIN_RANK_MINS) return false
    if (!metric.showZeros && e.raw <= 0) return false
    return true
  }
  if (metric.type === 'pct') {
    // Frees: rank everyone who took one, no attempts minimum.
    if (metric.free) return e.att >= 1
    // Play shots: per-type attempts minimum, AND a 0% only shows once a player
    // has taken more than 4 shots (so the odd 1-of-2 miss doesn't post a 0%).
    return e.att >= metric.minAtt && (e.scored > 0 || e.att > 4)
  }
  return e.mins >= MIN_RANK_MINS // ratio
}

// Turn a pool into a ranked, ordered list of QUALIFIED players for one metric.
//   mode : 'p60' | 'total' (only affects count metrics)
export function buildBoard(metric, pool, mode) {
  const entries = pool.map((x) => computeEntry(metric, x, mode)).filter((e) => qualifies(metric, e, mode))
  entries.sort((a, b) => (metric.inverted ? a.value - b.value : b.value - a.value))
  return entries
}

// Why a player doesn't qualify to be ranked — a short human hint.
function unqualifiedReason(metric, entry, mode) {
  if (!entry || entry.mins <= 0) return 'no minutes yet'
  if (metric.type === 'count') {
    if (entry.mins < MIN_RANK_MINS) return `min ${MIN_RANK_MINS} min to rank`
    return `no ${metric.short.toLowerCase()} yet`
  }
  if (metric.type === 'pct') {
    if (entry.att === 0) return metric.free ? 'no frees taken' : 'no attempts yet'
    if (!metric.free && entry.att < metric.minAtt) return `${metric.minAtt}+ attempts to rank`
    return '5+ shots to rank at 0%'
  }
  return `min ${MIN_RANK_MINS} min to rank`
}

// A player's standing on one metric — used for the small rank line under each
// dashboard tile. season-wide (all competitions), per-60 basis for counts.
// Returns { qualified, rank, of, entry, reason }.
export function standingFor(metric, pool, viewerName) {
  const mode = metric.type === 'count' ? 'p60' : null
  const board = buildBoard(metric, pool, mode)
  const idx = board.findIndex((e) => e.name === viewerName)
  if (idx >= 0) return { qualified: true, rank: idx + 1, of: board.length, entry: board[idx] }
  const me = pool.find((p) => p.name === viewerName)
  const entry = me ? computeEntry(metric, me, mode) : null
  return { qualified: false, of: board.length, entry, reason: unqualifiedReason(metric, entry, mode) }
}
