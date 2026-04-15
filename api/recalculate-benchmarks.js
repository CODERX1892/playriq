const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

const LOWER_IS_BETTER = new Set([
  'drop_shorts','one_pointer_drop_short_block','two_pointer_drop_short_block',
  'goal_drop_short_block','turnovers_in_contact','turnovers_kicked_away',
  'turnover_skill_error','dne','breach_1v1','shot_free_conceded',
  'ko_target_lost_clean','ko_target_lost_contest','free_conceded'
])

const ROLE_METRICS = {
  'Inside Forward': ['one_pointer_attempts','pts','duels_contested','tackles','forced_to_win','drop_shorts','turnovers_in_contact','turnovers_kicked_away'],
  'Half Forward': ['simple_pass','advance_pass','assists_shots','tackles','forced_to_win','carries','turnovers_kicked_away','turnover_skill_error','drop_shorts'],
  'Midfielder': ['simple_pass','advance_pass','carries','tackles','forced_to_win','duels_contested','turnovers_in_contact','dne','won_clean_p1_our','won_clean_p2_our'],
  'Half Back': ['simple_pass','advance_pass','tackles','forced_to_win','kickaway_to_received','duels_contested','defensive_duels_won','turnovers_kicked_away','dne','breach_1v1'],
  'Full Back': ['duels_contested','defensive_duels_won','tackles','forced_to_win','breach_1v1','dne','simple_pass','turnovers_kicked_away'],
  'Goalkeeper': ['won_clean_p1_our','won_clean_p2_our','won_clean_p3_our','won_break_our','shots_saved','ko_target_lost_clean'],
}

function percentile(arr, p) {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  return Math.round((sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)) * 100) / 100
}

export default async function handler(req, res) {
  // Get all players with roles
  const { data: players } = await supabase.from('players').select('name,role').not('role', 'is', null)
  const { data: allStats } = await supabase.from('player_stats').select('*').gt('total_minutes', 29)

  if (!players || !allStats) return res.status(500).json({ error: 'No data' })

  const roleMap = {}
  players.forEach(p => { roleMap[p.name] = p.role })

  const benchmarks = {}

  for (const [role, metrics] of Object.entries(ROLE_METRICS)) {
    const rolePlayers = players.filter(p => p.role === role).map(p => p.name)
    const roleStats = allStats.filter(r => rolePlayers.includes(r.player_name))
    benchmarks[role] = {}

    for (const metric of metrics) {
      const vals = roleStats.map(r => parseFloat(r[metric]) || 0)
      const nonzero = vals.filter(v => v > 0)
      if (!nonzero.length) continue

      const lowerIsBetter = LOWER_IS_BETTER.has(metric)
      const good = percentile(nonzero, 75)
      const min = percentile(nonzero, 50)
      const p90 = percentile(nonzero, 90)

      benchmarks[role][metric] = {
        min, good, p90,
        lower_is_better: lowerIsBetter,
        label: lowerIsBetter ? `Target ≤${min} per game` : `Target ${good}+ per game`,
        n: vals.length
      }
    }
  }

  // Store in Supabase for the frontend to fetch
  await supabase.from('app_config').upsert({
    key: 'role_benchmarks',
    value: JSON.stringify(benchmarks),
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' })

  res.json({ success: true, roles: Object.keys(benchmarks), updated: new Date().toISOString() })
}
