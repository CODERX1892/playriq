import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

// Sends the pre-match goal-setting email to the matchday squad.
// - GET  (Vercel cron): finds the next match ~12-36h out and emails its squad.
// - POST { matchId, notifyCoaches } : sends for a specific match on demand
//   (the "Send goal-setting emails" button on the squad picker).
// Starters get the standard note; subs are told to set goals on a 60-min basis
// (their post-game report pro-rates the targets to minutes played).
export const config = { maxDuration: 60 }

const GOALS_LINK = 'https://playriq.io/?goto=goals'
const FROM = 'PlayrIQ <noreply@reset.playriq.io>'
const dateLabel = (d) => new Date(d).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })

function starterHtml(first, match) {
  return `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px">
    <div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div>
    <div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div>
    <div style="font-size:16px;margin-bottom:16px">Hi ${first},</div>
    <div style="font-size:15px;color:#e8edf5;margin-bottom:8px">You're in the squad — <strong style="color:#f0b429">${match.match_id} v ${match.opposition}</strong>.</div>
    <div style="font-size:14px;color:#8ba8c8;margin-bottom:20px">${dateLabel(match.match_date)}</div>
    <div style="font-size:14px;color:#e8edf5;margin-bottom:20px">Take 2 minutes to set your 3 personal goals for the match. Pick stats you want to lift — tackles, forced turnovers, scores, whatever's been on your mind. They'll be shared in your accountability group.</div>
    <a href="${GOALS_LINK}" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">SET YOUR 3 GOALS →</a>
    <div style="font-size:11px;color:#3d5a7a;margin-top:20px;text-align:center">Login with your name and PIN at playriq.io</div>
  </div>`
}

function subHtml(first, match) {
  return `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px">
    <div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div>
    <div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div>
    <div style="font-size:16px;margin-bottom:16px">Hi ${first},</div>
    <div style="font-size:15px;color:#e8edf5;margin-bottom:8px">You're in the matchday squad — <strong style="color:#f0b429">${match.match_id} v ${match.opposition}</strong>.</div>
    <div style="font-size:14px;color:#8ba8c8;margin-bottom:20px">${dateLabel(match.match_date)}</div>
    <div style="font-size:14px;color:#e8edf5;margin-bottom:12px">Set your 3 goals as if you'll play the <strong style="color:#f0b429">full 60 minutes</strong>. If you come off the bench, we'll pro-rate each goal to the minutes you actually play — so a 20-minute cameo is judged on a 20-minute share, not the full game. Set them at your best and go earn the time.</div>
    <a href="${GOALS_LINK}" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">SET YOUR 3 GOALS →</a>
    <div style="font-size:11px;color:#3d5a7a;margin-top:20px;text-align:center">Login with your name and PIN at playriq.io</div>
  </div>`
}

function coachHtml(first, match, squadCount) {
  return `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px">
    <div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div>
    <div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Coaches · Ballyboden St Enda's</div>
    <div style="font-size:16px;margin-bottom:16px">Hi ${first},</div>
    <div style="font-size:15px;color:#e8edf5;margin-bottom:8px">Goal-setting emails have gone out to the ${squadCount}-player squad for <strong style="color:#f0b429">${match.match_id} v ${match.opposition}</strong>.</div>
    <div style="font-size:14px;color:#8ba8c8;margin-bottom:20px">${dateLabel(match.match_date)}</div>
    <div style="font-size:14px;color:#e8edf5;margin-bottom:20px">Keep an eye on the <strong>Goals</strong> and <strong>Groups</strong> tabs — the players' match targets land there as they set them, so you can see who's engaged and what they're aiming for before throw-in.</div>
    <a href="https://playriq.io/?goto=groups" style="display:block;background:#4a9eff;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">OPEN PLAYRIQ →</a>
  </div>`
}

async function sendEmail(RESEND_KEY, to, subject, html) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' })

  const body = req.method === 'POST' ? (req.body || {}) : {}
  const notifyCoaches = body.notifyCoaches !== false // default true

  // Resolve the match: explicit matchId (button) or the next-24h window (cron).
  let match
  if (body.matchId) {
    const { data } = await supabase.from('matches').select('*').eq('match_id', body.matchId).single()
    match = data
    if (!match) return res.status(404).json({ error: 'Match not found' })
  } else {
    const now = new Date()
    const tomorrowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000)
    const tomorrowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000)
    const { data: matches, error: matchErr } = await supabase
      .from('matches').select('*')
      .gte('match_date', tomorrowStart.toISOString().slice(0, 10))
      .lte('match_date', tomorrowEnd.toISOString().slice(0, 10))
    if (matchErr) return res.status(500).json({ error: matchErr.message })
    if (!matches?.length) return res.json({ skipped: 'no match in next 24h window' })
    match = matches[0]
  }

  // Matchday squad (with starter/sub flag).
  const { data: squadRows } = await supabase
    .from('matchday_squad').select('player_name, is_starter').eq('match_id', match.match_id)
  if (!squadRows?.length) {
    return res.json({ skipped: 'no matchday squad selected for ' + match.match_id, hint: 'admin needs to pick squad in app' })
  }
  const starterByName = {}
  squadRows.forEach(r => { starterByName[r.player_name] = r.is_starter !== false })

  const squadNames = squadRows.map(r => r.player_name)
  const { data: players } = await supabase
    .from('players').select('name, email').in('name', squadNames).not('email', 'is', null)

  let sent = 0
  for (const player of (players || [])) {
    await new Promise(r => setTimeout(r, 700))
    const first = player.name.split(' ')[0]
    const isStarter = starterByName[player.name]
    const html = isStarter ? starterHtml(first, match) : subHtml(first, match)
    const subject = `Set your goals for ${match.match_id} v ${match.opposition}`
    try { await sendEmail(RESEND_KEY, player.email, subject, html); sent++ }
    catch (e) { console.error('Pre-match email failed for', player.name, e) }
  }

  // Coach / admin heads-up.
  let coaches = 0
  if (notifyCoaches) {
    const { data: staff } = await supabase
      .from('app_users').select('name, email, role')
      .in('role', ['coach', 'admin']).not('email', 'is', null)
    for (const c of (staff || [])) {
      await new Promise(r => setTimeout(r, 700))
      try {
        await sendEmail(RESEND_KEY, c.email, `Squad goals going out — ${match.match_id} v ${match.opposition}`, coachHtml(c.name.split(' ')[0], match, squadNames.length))
        coaches++
      } catch (e) { console.error('Coach heads-up failed for', c.name, e) }
    }
  }

  res.json({ sent, total: (players || []).length, squad: squadNames.length, coaches, match: match.match_id })
}
