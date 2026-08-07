import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

// Reminds squad players who STILL haven't set their goals.
// - GET  (Vercel cron): finds a match happening today (0-24h out) and nudges
//   its squad members with no targets yet — the morning-of chase.
// - POST { matchId } : same, on demand ("Remind non-responders" button).
// Only emails players in matchday_squad who have no player_targets row for the match.
export const config = { maxDuration: 60 }

const GOALS_LINK = 'https://playriq.io/?goto=goals'
const FROM = 'PlayrIQ <noreply@reset.playriq.io>'
const dateLabel = (d) => new Date(d).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })

function reminderHtml(first, match) {
  return `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px">
    <div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div>
    <div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div>
    <div style="font-size:16px;margin-bottom:16px">Hi ${first},</div>
    <div style="font-size:15px;color:#e8edf5;margin-bottom:8px">Quick nudge — you haven't set your goals yet for <strong style="color:#f0b429">${match.match_id} v ${match.opposition}</strong>.</div>
    <div style="font-size:14px;color:#8ba8c8;margin-bottom:20px">${dateLabel(match.match_date)}</div>
    <div style="font-size:14px;color:#e8edf5;margin-bottom:20px">Takes 2 minutes — pick 3 stats you want to hit today. They'll be shared in your accountability group and scored automatically after the game.</div>
    <a href="${GOALS_LINK}" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">SET YOUR 3 GOALS →</a>
    <div style="font-size:11px;color:#3d5a7a;margin-top:20px;text-align:center">Login with your name and PIN at playriq.io</div>
  </div>`
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' })

  const body = req.method === 'POST' ? (req.body || {}) : {}

  // Resolve the match: explicit matchId (button) or a match happening today (cron).
  let match
  if (body.matchId) {
    const { data } = await supabase.from('matches').select('*').eq('match_id', body.matchId).single()
    match = data
    if (!match) return res.status(404).json({ error: 'Match not found' })
  } else {
    const now = new Date()
    const start = now.toISOString().slice(0, 10)
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: matches } = await supabase
      .from('matches').select('*').gte('match_date', start).lte('match_date', end)
    if (!matches?.length) return res.json({ skipped: 'no match today' })
    match = matches[0]
  }

  // Squad, minus anyone who's already set targets.
  const [{ data: squadRows }, { data: targets }] = await Promise.all([
    supabase.from('matchday_squad').select('player_name').eq('match_id', match.match_id),
    supabase.from('player_targets').select('player_name').eq('match_id', match.match_id),
  ])
  if (!squadRows?.length) return res.json({ skipped: 'no squad for ' + match.match_id })

  const hasGoals = new Set((targets || []).map(t => t.player_name))
  const outstanding = squadRows.map(r => r.player_name).filter(n => !hasGoals.has(n))
  if (!outstanding.length) return res.json({ sent: 0, note: 'everyone has set goals' })

  const { data: players } = await supabase
    .from('players').select('name, email').in('name', outstanding).not('email', 'is', null)

  let sent = 0
  for (const player of (players || [])) {
    await new Promise(r => setTimeout(r, 700))
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: player.email,
          subject: `Reminder: set your goals for ${match.match_id}`,
          html: reminderHtml(player.name.split(' ')[0], match),
        }),
      })
      sent++
    } catch (e) { console.error('Reminder failed for', player.name, e) }
  }

  res.json({ sent, outstanding: outstanding.length, match: match.match_id })
}
