import { supabase } from './supabase'

// ─── STATIC HELPERS ───────────────────────────────────────────────────────────
export const n = (v) => (!v && v !== 0) ? 0 : (typeof v === 'number' ? v : parseFloat(v) || 0)
export const r1 = (v) => Math.round((v || 0) * 10) / 10
export const pct = (s, t) => t > 0 ? Math.round(s / t * 100) : 0
export const sf = (rows, field) => rows.reduce((s, r) => s + n(r[field]), 0)

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
  const max = Math.max(...arr.filter(v => v != null), 1)
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

export async function loadMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true })

  if (error || !data?.length) return

  _matchData = data
  _matches = data.map(m => m.match_id)
  _opp = {}
  data.forEach(m => { _opp[m.match_id] = m.opposition })

  // Update exports
  MATCHES.length = 0
  _matches.forEach(m => MATCHES.push(m))
  Object.keys(OPP).forEach(k => delete OPP[k])
  Object.assign(OPP, _opp)
  MATCH_DATA.splice(0, MATCH_DATA.length, ..._matchData)
}
