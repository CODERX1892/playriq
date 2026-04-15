const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { matchId } = req.body
  if (!matchId) return res.status(400).json({ error: 'Missing matchId' })

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' })

  // Get match details
  const { data: match } = await supabase.from('matches').select('*').eq('match_id', matchId).single()
  if (!match) return res.status(404).json({ error: 'Match not found' })

  // Get all players who have stats for this match
  const { data: stats } = await supabase.from('player_stats').select('player_name').eq('match_id', matchId)
  if (!stats?.length) return res.json({ sent: 0 })

  const playerNames = stats.map(s => s.player_name)
  const { data: players } = await supabase.from('players').select('name,email').in('name', playerNames)
  if (!players?.length) return res.json({ sent: 0 })

  const emailsToSend = players.filter(p => p.email)
  let sent = 0

  for (const player of emailsToSend) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PlayrIQ <noreply@playriq.io>',
          to: player.email,
          subject: `Your ${matchId} stats are live on PlayrIQ`,
          html: `
            <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px">
              <div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div>
              <div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div>
              <div style="font-size:16px;margin-bottom:16px">Hi ${player.name.split(' ')[0]},</div>
              <div style="font-size:15px;color:#e8edf5;margin-bottom:8px">Your <strong style="color:#f0b429">${matchId}</strong> stats are now live.</div>
              <div style="font-size:14px;color:#8ba8c8;margin-bottom:24px">vs ${match.opposition} · ${new Date(match.date).toLocaleDateString('en-IE', {day:'numeric',month:'long'})}</div>
              <a href="https://playriq.io" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">VIEW YOUR STATS →</a>
              <div style="font-size:11px;color:#3d5a7a;margin-top:20px;text-align:center">Login with your name and PIN at playriq.io</div>
            </div>
          `
        })
      })
      sent++
    } catch(e) { console.error('Email failed for', player.name, e) }
  }

  res.json({ sent, total: emailsToSend.length })
}
