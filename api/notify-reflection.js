import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' })

  const dayAgo = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  const { data: statuses } = await supabase
    .from('match_status').select('*').eq('status', 'published')
    .gte('published_at', dayAgo).lte('published_at', cutoff)

  if (!statuses?.length) return res.json({ skipped: 'no matches published in target window' })

  let totalSent = 0
  const matchSummaries = []

  for (const ms of statuses) {
    const matchId = ms.match_id
    const { data: match } = await supabase.from('matches').select('*').eq('match_id', matchId).single()
    if (!match) continue

    const { data: stats } = await supabase.from('player_stats').select('player_name').eq('match_id', matchId)
    if (!stats?.length) continue

    const playerNames = stats.map(s => s.player_name)
    const { data: players } = await supabase.from('players').select('name, email').in('name', playerNames)
    if (!players?.length) continue

    const emailsToSend = players.filter(p => p.email)
    let sent = 0

    for (const player of emailsToSend) {
      await new Promise(r => setTimeout(r, 700))
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PlayrIQ <noreply@reset.playriq.io>',
            to: player.email,
            subject: `Reflect on ${matchId} — how did you go?`,
            html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px"><div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div><div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div><div style="font-size:16px;margin-bottom:16px">Hi ${player.name.split(' ')[0]},</div><div style="font-size:15px;color:#e8edf5;margin-bottom:8px">Your <strong style="color:#f0b429">${matchId}</strong> stats are now live.</div><div style="font-size:14px;color:#8ba8c8;margin-bottom:24px">vs ${match.opposition} · ${new Date(match.match_date).toLocaleDateString('en-IE', {day:'numeric',month:'long'})}</div><div style="font-size:14px;color:#e8edf5;margin-bottom:20px">Take 2 minutes to log your reflection — what went well, what to work on, and how you measured up against your targets.</div><a href="https://playriq.io" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">REFLECT ON YOUR MATCH →</a><div style="font-size:11px;color:#3d5a7a;margin-top:20px;text-align:center">Login with your name and PIN at playriq.io</div></div>`
          })
        })
        sent++
      } catch(e) { console.error('Reflection email failed for', player.name, e) }
    }
    totalSent += sent
    matchSummaries.push({ match: matchId, sent, total: emailsToSend.length })
  }
  res.json({ totalSent, matches: matchSummaries })
}
