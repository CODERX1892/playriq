import { supabase } from './supabase'

// ─── STATIC HELPERS ───────────────────────────────────────────────────────────
export const n = (v) => (!v && v !== 0) ? 0 : (typeof v === 'number' ? v : parseFloat(v) || 0)
export const r1 = (v) => Math.round((v || 0) * 10) / 10
export const pct = (s, t) => t > 0 ? Math.round(s / t * 100) : 0
export const sf = (rows, field) => rows.reduce((s, r) => s + n(r[field]), 0)

// Round number from a match_id like "AFL 9" → 9 (used to order matches chronologically)
export const matchRound = (id) => {
  const v = parseInt(String(id).trim().split(/\s+/).pop(), 10)
  return Number.isNaN(v) ? Infinity : v
}

export const POS_COLORS = {
  Forward: '#f0b429',
  Defender: '#4a9eff',
  Midfield: '#3ecf8e',
  Goalkeeper: '#a78bfa',
}

export const impactColor = (v) => {
  if (v >= 15) return '#ffd700'
  if (v >= 10) return '#a78bfa'
  if (v >= 5)  return '#4a9eff'
  if (v > 0)   return '#3ecf8e'
  if (v < 0)   return '#f06060'
  return 'var(--text3)'
}

export const normalise = (val, arr) => {
  let max = 1
  arr.forEach(v => { if (v != null && v > max) max = v })
  return Math.round((val || 0) / max * 100)
}

export const buildStatRows = (rows, fields, mc, teamAvgs) =>
  fields.map(([field, label]) => {
    const total = sf(rows, field)
    const avg = r1(total / mc)
    const teamAvg = teamAvgs?.[field] != null ? r1(teamAvgs[field]) : null
    return { field, label, total, avg, teamAvg }
  })

// ─── DYNAMIC MATCH DATA ───────────────────────────────────────────────────────
// These are populated by loadMatches() — used as fallback until loaded
let _matches = ['AFL 1', 'AFL 2', 'AFL 3', 'AFL 4']
let _opp = { 'AFL 1': 'Kilmacud Crokes', 'AFL 2': "St Pat's Donabate", 'AFL 3': 'Ballymun Kickhams', 'AFL 4': 'St Vincents' }
let _matchData = []

export let MATCHES = _matches
export let OPP = _opp
export let MATCH_DATA = _matchData

// ─── COMPETITION FILTER ───────────────────────────────────────────────────────
// MATCHES / OPP / MATCH_DATA above are the *visible* set — they reflect the active
// competition filter. The full, unfiltered list lives in _allMatchData.
//
// Buckets: 'championship' = anything whose competition/match_type starts with
// "champ" (or a match_id starting "SFC"). Everything else — League, Challenge,
// blank — buckets as 'league'. So challenge games sit alongside league games.
let _allMatchData = []
let _compFilter = 'all'                       // 'all' | 'league' | 'championship'

export const COMP_OF = {}                     // match_id -> 'league' | 'championship'
export const ACTIVE_MATCH_IDS = new Set()     // match_ids currently visible

const _normComp = (m) => {
  const c = String(m?.competition || m?.match_type || '').toLowerCase()
  if (c.startsWith('champ')) return 'championship'
  if (String(m?.match_id || '').toUpperCase().startsWith('SFC')) return 'championship'
  return 'league'
}

export const competitionOf = (matchId) => COMP_OF[matchId] || 'league'
export const inActiveComp = (matchId) =>
  _compFilter === 'all' || competitionOf(matchId) === _compFilter
export const getCompFilter = () => _compFilter

export function setCompFilter(f) {
  _compFilter = (f === 'league' || f === 'championship') ? f : 'all'
  _applyCompFilter()
}

// Re-derive the visible exports from _allMatchData + the active filter.
function _applyCompFilter() {
  // COMP_OF is built from the *full* list so competitionOf() works for any match.
  Object.keys(COMP_OF).forEach(k => delete COMP_OF[k])
  _allMatchData.forEach(m => { COMP_OF[m.match_id] = _normComp(m) })

  const visible = _allMatchData.filter(
    m => _compFilter === 'all' || _normComp(m) === _compFilter
  )

  ACTIVE_MATCH_IDS.clear()
  visible.forEach(m => ACTIVE_MATCH_IDS.add(m.match_id))

  MATCHES.length = 0
  visible.forEach(m => MATCHES.push(m.match_id))

  Object.keys(OPP).forEach(k => delete OPP[k])
  visible.forEach(m => { OPP[m.match_id] = m.opposition })

  MATCH_DATA.splice(0, MATCH_DATA.length, ...visible)
}

export async function loadMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true })

  if (error || !data?.length) return

  // Sort by the round number in match_id ("AFL 9" → 9) rather than relying on
  // match_date. Postgres sorts NULL match_date last on an ASC order, which pushed
  // any match with a missing date (e.g. AFL 9) to the end — after AFL 10. Sorting
  // on the round number is immune to missing/incorrect dates and always gives
  // G1 → G2 → … → G9 → G10. (Still set match_date in the DB — the email crons read it.)
  _allMatchData = [...data].sort((a, b) => matchRound(a.match_id) - matchRound(b.match_id))

  // Derive the visible exports from the current filter (defaults to 'all').
  _applyCompFilter()
}
