import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

// Allow the batch of Claude calls + emails a little headroom.
export const config = { maxDuration: 60 }

// Goal metrics → column in player_stats + display label. Mirrors the player
// Targets form (PlayerReflection METRIC_OPTIONS).
const METRIC_LABELS = {
  tackles: 'Tackles', forced_to_win: 'Forced Turnovers Won', advance_pass: 'Advance Passes',
  simple_pass: 'Simple Passes', carries: 'Carries', dne: 'Defensive Non-Engagements',
  breach_1v1: '1v1 Breaches', defensive_duels_won: 'Duels Won', one_pointer_scored: '1-Point Scores',
  two_pointer_scored: '2-Point Scores', goals_scored: 'Goals', drop_shorts: 'Drop Shorts',
  turnovers_in_contact: 'Contact Turnovers', turnovers_kicked_away: 'Kickaway Turnovers',
  ko_target_won_clean: 'Kickouts Won Clean (for + against)', won_break_our: 'Own KO Break Balls',
  won_break_opp: 'Opp KO Break Balls', assists_shots: 'Shot Assists',
}
// Metrics where a LOWER number is better (target is usually 0).
const LOWER_IS_BETTER = new Set(['dne', 'breach_1v1', 'drop_shorts', 'turnovers_in_contact', 'turnovers_kicked_away'])

const num = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0)

// Percentage goal metrics. actual% = sum(num cols) / sum(den cols) * 100.
// Formulas mirror src/lib/playerMetrics.js so a goal % matches the leaderboards.
const PCT_METRICS = {
  pct_1:         { label: '1-Pointer Shot %', num: ['one_pointer_scored'], den: ['one_pointer_scored', 'one_pointer_wide', 'one_pointer_drop_short_block'] },
  pct_2:         { label: '2-Pointer Shot %', num: ['two_pointer_scored'], den: ['two_pointer_scored', 'two_pointer_wide', 'two_pointer_drop_short_block'] },
  pct_goal:      { label: 'Goal Shot %',      num: ['goals_scored'],       den: ['goals_scored', 'goals_wide', 'goal_drop_short_block'] },
  pct_ko_target: { label: 'Kickout Win %',    num: ['ko_target_won_clean', 'ko_target_won_break'], den: ['ko_target_won_clean', 'ko_target_won_break', 'ko_target_lost_clean', 'ko_target_lost_contest'] },
  pct_gk_ko_clean: { label: 'GK Kickout Clean %', num: ['goalie_ko_clean_wins'], den: ['goalie_ko_taken'] },
  pct_gk_ko_break: { label: 'GK Kickout Break %', num: ['goalie_ko_break_wins'], den: ['goalie_ko_taken'] },
  pct_1f:        { label: '1-Pt Free %',      num: ['one_pointer_scored_f'], den: ['one_pointer_attempts_f'] },
  pct_2f:        { label: '2-Pt Free %',      num: ['two_pointer_scored_f'], den: ['two_pointer_attempts_f'] },
  pct_goalf:     { label: 'Goal Free %',      num: ['goals_scored_f'],      den: ['goal_attempts_f'] },
}
const sumc = (row, cols) => cols.reduce((a, c) => a + num(row[c]), 0)
// Count goals that aggregate several columns — e.g. clean kickouts won on BOTH
// our own restarts and the opposition's. Falls back to the raw column.
const SUM_METRICS = {
  ko_target_won_clean: ['won_clean_p1_our', 'won_clean_p2_our', 'won_clean_p3_our', 'won_clean_p1_opp', 'won_clean_p2_opp', 'won_clean_p3_opp'],
}
const countVal = (row, metric) => (SUM_METRICS[metric] ? sumc(row, SUM_METRICS[metric]) : num(row[metric]))
const pctFromRow = (row, cfg) => { const d = sumc(row, cfg.den); return d > 0 ? Math.round(sumc(row, cfg.num) / d * 100) : null }
const labelOf = (metric) => METRIC_LABELS[metric] || (PCT_METRICS[metric] && PCT_METRICS[metric].label) || metric

// Competition bucket: championship vs league (challenge counts as league),
// matching how the app groups seasons.
const bucketOf = (m) => {
  const c = String((m && (m.competition || m.match_type)) || '').toLowerCase()
  if (c.startsWith('champ')) return 'championship'
  if (String(m && m.match_id || '').toUpperCase().startsWith('SFC')) return 'championship'
  return 'league'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { matchId, force } = req.body || {}
  if (!matchId) return res.status(400).json({ error: 'Missing matchId' })

  // Same key PlayrIQ Edge uses (server reads VITE_-prefixed vars fine).
  const ANTHROPIC_KEY = process.env.VITE_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'Anthropic key not configured' })

  // Load everything we need.
  const [{ data: match }, { data: matchStats }, { data: targetsRows }, { data: allMatches }, { data: allStats }, { data: existing }, { data: squadRows }] =
    await Promise.all([
      supabase.from('matches').select('*').eq('match_id', matchId).single(),
      supabase.from('player_stats').select('*').eq('match_id', matchId),
      supabase.from('player_targets').select('*').eq('match_id', matchId),
      supabase.from('matches').select('match_id, competition, match_type'),
      supabase.from('player_stats').select('*'),
      supabase.from('game_reports').select('player_name').eq('match_id', matchId),
      supabase.from('matchday_squad').select('player_name, is_starter').eq('match_id', matchId),
    ])
  if (!match) return res.status(404).json({ error: 'Match not found' })
  if (!targetsRows?.length) return res.json({ generated: 0, note: 'No player targets set for this match' })

  const thisBucket = bucketOf(match)
  const bucketIds = new Set((allMatches || []).filter(m => bucketOf(m) === thisBucket).map(m => m.match_id))
  const statsByName = {}
  ;(matchStats || []).forEach(s => { statsByName[s.player_name] = s })
  const done = new Set((existing || []).map(r => r.player_name))
  // Subs set goals on a 60-min basis; their counting-stat targets are pro-rated
  // to the minutes they actually played (lower-is-better/zero targets stay as-is).
  const isSubByName = {}
  ;(squadRows || []).forEach(r => { isSubByName[r.player_name] = r.is_starter === false })

  // Player emails
  const names = targetsRows.map(t => t.player_name)
  const { data: players } = await supabase.from('players').select('name, email').in('name', names)
  const emailByName = {}
  ;(players || []).forEach(p => { emailByName[p.name] = p.email })

  // Best value ON THE DAY for a metric (across everyone who played this match).
  const bestOnDay = (metric) => {
    const cfg = PCT_METRICS[metric]
    if (cfg) {
      const vals = (matchStats || []).map(s => pctFromRow(s, cfg)).filter(v => v != null)
      return vals.length ? Math.max(...vals) : null
    }
    const vals = (matchStats || []).map(s => countVal(s, metric))
    if (!vals.length) return null
    return LOWER_IS_BETTER.has(metric) ? Math.min(...vals) : Math.max(...vals)
  }
  // A player's season figure for a metric, within this competition bucket.
  // Counts → per-game average; percentages → aggregate rate (sum num / sum den).
  const seasonAvg = (name, metric) => {
    const rows = (allStats || []).filter(s => s.player_name === name && bucketIds.has(s.match_id) && num(s.total_minutes) > 0)
    if (!rows.length) return null
    const cfg = PCT_METRICS[metric]
    if (cfg) {
      const d = rows.reduce((a, s) => a + sumc(s, cfg.den), 0)
      if (d <= 0) return null
      const nu = rows.reduce((a, s) => a + sumc(s, cfg.num), 0)
      return { avg: Math.round(nu / d * 100), games: rows.length, total: nu }
    }
    const total = rows.reduce((a, s) => a + countVal(s, metric), 0)
    return { avg: Math.round((total / rows.length) * 10) / 10, games: rows.length, total }
  }

  let generated = 0, sent = 0
  const results = []

  for (const t of targetsRows) {
    const name = t.player_name
    if (done.has(name) && !force) continue
    const statRow = statsByName[name]
    if (!statRow || num(statRow.total_minutes) === 0) continue // didn't play — skip

    // Build the 3 goals with actual + met/missed.
    const isSub = isSubByName[name] === true
    const mins = num(statRow.total_minutes)
    const goals = []
    for (let i = 1; i <= 3; i++) {
      const metric = t[`metric_${i}`]
      const target = t[`target_${i}`]
      if (!metric || target == null) continue
      const cfg = PCT_METRICS[metric]
      const isPctM = !!cfg
      const lower = LOWER_IS_BETTER.has(metric)
      const rawTarget = num(target)
      // Pro-rate a sub's counting target to minutes played (never below 1). Percentages don't scale.
      const scaled = isSub && !lower && !isPctM && mins > 0 && mins < 60
      const effTarget = scaled ? Math.max(1, Math.round(rawTarget * mins / 60)) : rawTarget
      const actual = isPctM ? pctFromRow(statRow, cfg) : countVal(statRow, metric)
      const met = actual == null ? false : (lower ? actual <= effTarget : actual >= effTarget)
      const season = seasonAvg(name, metric)
      goals.push({
        metric, label: labelOf(metric), target: effTarget, rawTarget, scaled, minutes: mins, pct: isPctM,
        actual, met, lower,
        bestOnDay: bestOnDay(metric), seasonAvg: season?.avg ?? null, seasonGames: season?.games ?? 0,
      })
    }
    if (!goals.length) continue

    const compLabel = thisBucket === 'championship' ? 'Championship' : 'League'
    const anyScaled = goals.some(g => g.scaled)
    const goalLines = goals.map(g => {
      const u = g.pct ? '%' : ''
      return `- ${g.label}: goal ${g.lower ? '≤' : '≥'} ${g.target}${u}${g.scaled ? ` (pro-rated from ${g.rawTarget}, as he played ${g.minutes} mins off the bench)` : ''}, achieved ${g.actual == null ? 'n/a (no attempts)' : g.actual + u} → ${g.met ? 'HIT' : 'MISSED'}. ` +
        `Best in the squad that day: ${g.bestOnDay == null ? 'n/a' : g.bestOnDay + u}. His ${compLabel} ${g.pct ? 'season rate' : 'season average per game'}: ${g.seasonAvg == null ? 'n/a' : g.seasonAvg + u}${g.pct ? '' : ` (over ${g.seasonGames} games)`}.`
    }).join('\n')

    const prompt = `You are writing a short, personal post-match note to a Gaelic football player about the goals he set himself for this game.

Player: ${name.split(' ')[0]}
Match: vs ${match.opposition} (${compLabel})

His goals for this game, with how he did, the best any teammate managed that day, and his own season form so far:
${goalLines}

Write a warm, honest, motivating note (about 140-180 words), addressed to him directly ("you"). Cover: which goals he hit and which he missed (use the actual numbers); how he stacked up against the best in the squad on the day; and put it in the context of his ${compLabel} season form so far so it feels relatable (e.g. above/below his usual level). Finish with one clear focus for the next game. Plain sentences and short paragraphs only — no headings, no bullet points, no markdown. Encouraging but truthful; this is a teammate-style nudge, not a lecture.${anyScaled ? ' Note: he came off the bench, so his counting-stat goals were pro-rated to the minutes he played — weave in naturally that the targets were adjusted for his game time so he is judged fairly on his cameo.' : ''}`

    let reportText = ''
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 700,
          system: 'You are a stateless writing assistant for a GAA analytics app. Treat all data as transient and confidential; each request is independent.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await r.json()
      reportText = (data.content || []).map(c => c.text || '').join('').trim()
    } catch (e) {
      console.error('Claude failed for', name, e)
    }
    if (!reportText) continue

    // Store (idempotent per player+match).
    await supabase.from('game_reports').upsert({
      player_name: name, match_id: matchId,
      targets: goals, report: reportText, sent_at: null,
    }, { onConflict: 'player_name,match_id' })
    generated++

    // Email it.
    const email = emailByName[name]
    if (RESEND_KEY && email) {
      await new Promise(r => setTimeout(r, 700))
      const rows = goals.map(g => `
        <tr>
          <td style="padding:6px 10px;font-size:13px;color:#e8edf5">${g.label}</td>
          <td style="padding:6px 10px;font-size:13px;color:#8ba8c8;text-align:center">${g.lower ? '≤' : '≥'} ${g.target}${g.pct ? '%' : ''}${g.scaled ? `<div style="font-size:10px;color:#3d5a7a">pro-rated from ${g.rawTarget} · ${g.minutes} mins</div>` : ''}</td>
          <td style="padding:6px 10px;font-size:13px;color:#e8edf5;text-align:center;font-weight:700">${g.actual == null ? '—' : g.actual}${g.pct ? '%' : ''}</td>
          <td style="padding:6px 10px;font-size:13px;text-align:center;color:${g.met ? '#3ecf8e' : '#f06060'};font-weight:700">${g.met ? '✓' : '✗'}</td>
        </tr>`).join('')
      const body = reportText.split(/\n\s*\n/).map(p => `<p style="font-size:14px;line-height:1.6;color:#e8edf5;margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`).join('')
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PlayrIQ <noreply@reset.playriq.io>',
            to: email,
            subject: `Your ${matchId} goals report`,
            html: `
              <div style="font-family:sans-serif;max-width:460px;margin:0 auto;padding:28px;background:#07111f;color:#e8edf5;border-radius:12px">
                <div style="font-size:22px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:4px">PlayrIQ</div>
                <div style="font-size:12px;color:#3d5a7a;margin-bottom:20px">Goals review · ${matchId} vs ${match.opposition}</div>
                <div style="font-size:15px;margin-bottom:14px">Hi ${name.split(' ')[0]},</div>
                ${body}
                <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#0d1f3c;border-radius:8px">
                  <tr><td colspan="4" style="padding:8px 10px;font-size:11px;color:#8ba8c8;letter-spacing:1px;text-transform:uppercase">Your goals this game</td></tr>
                  ${rows}
                </table>
                <a href="https://playriq.io" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:13px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:1px">OPEN PLAYRIQ →</a>
              </div>`,
          }),
        })
        await supabase.from('game_reports').update({ sent_at: new Date().toISOString() }).eq('player_name', name).eq('match_id', matchId)
        sent++
      } catch (e) { console.error('Email failed for', name, e) }
    }
    results.push({ name, hit: goals.filter(g => g.met).length, of: goals.length })
  }

  res.json({ generated, sent, results })
}
