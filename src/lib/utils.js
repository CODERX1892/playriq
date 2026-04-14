export const MATCHES = ['AFL 1', 'AFL 2', 'AFL 3', 'AFL 4']
export const OPP = {
  'AFL 1': 'Kilmacud Crokes',
  'AFL 2': "St Pat's Donabate",
  'AFL 3': 'Ballymun Kickhams',
  'AFL 4': 'St Vincents',
}
export const POS_COLORS = {
  Forward: '#f0b429',
  Defender: '#4a9eff',
  Midfield: '#3ecf8e',
  Goalkeeper: '#a78bfa',
}
export const COACH_PIN = '1111'

export const n = (v) => (!v && v !== 0) ? 0 : (typeof v === 'number' ? v : parseFloat(v) || 0)
export const r1 = (v) => Math.round(v * 10) / 10
export const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0

export function sf(rows, field) {
  return rows.reduce((s, r) => s + n(r[field]), 0)
}

export function impactColor(val) {
  if (val >= 10) return 'var(--teal)'
  if (val >= 5) return 'var(--gold)'
  if (val < 0) return 'var(--red)'
  return 'var(--text2)'
}

// Map DB column names to display-friendly stat rows for each category
export function buildStatRows(rows, fields, mc, teamAvgs = {}) {
  return fields.map(([field, label]) => {
    const total = sf(rows, field)
    const avg = mc > 0 ? r1(total / mc) : 0
    const teamAvg = teamAvgs[field] !== undefined ? teamAvgs[field] : null
    return { field, label, total, avg, teamAvg }
  })
}

// Normalise a value vs squad max (for radar chart)
export function normalise(val, allVals) {
  const max = Math.max(...allVals.map(v => n(v)), 1)
  return Math.round((n(val) / max) * 100)
}
