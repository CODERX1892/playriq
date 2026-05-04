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

  const now = new Date()
  const tomorrowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  const tomorrowEnd   = new Date(now.getTime() + 36 * 60 * 60 * 1000)

  const { data: matches, error: matchErr } = await supabase
    .from('matches').select('*')
    .gte('match_date', tomorrowStart.toISOString().slice(0, 10))
    .lte('match_date', tomorrowEnd.toISOString().slice(0, 10))

  if (matchErr) return res.status(500).json({ error: matchErr.message })
  if (!matches?.length) return res.json({ skipped: 'no match in next 24h window' })

  const match = matches[0]
  const { data: players } = await supabase.from('players').select('name, email').not('email', 'is', null)
  if (!players?.length) return res.json({ sent: 0, total: 0 })

  let sent = 0
  for (const player of players) {
    await new Promise(r => setTimeout(r, 700))
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PlayrIQ <noreply@reset.playriq.io>',
          to: player.email,
          subject: `Set your goals for ${match.match_id} v ${match.opposition}`,
          html: `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px"><div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div><div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div><div style="font-size:16px;margin-bottom:16px">Hi ${player.name.split(' ')[0]},</div><div style="font-size:15px;color:#e8edf5;margin-bottom:8px">Match day tomorrow — <strong style="color:#f0b429">${match.match_id} v ${match.opposition}</strong>.</div><div style="font-size:14px;color:#8ba8c8;margin-bottom:24px">${new Date(match.match_date).toLocaleDateString('en-IE', {weekday:'long',day:'numeric',month:'long'})}</div><div style="font-size:14px;color:#e8edf5;margin-bottom:20px">Take 2 minutes to set 2-3 personal targets for the match. Pick stats you want to lift — tackles, forced TOs, scoring, whatever's been on your mind.</div><a href="https://playriq.io" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">SET YOUR TARGETS →</a><div style="font-size:11px;color:#3d5a7a;margin-top:20px;text-align:center">Login with your name and PIN at playriq.io</div></div>`
        })
      })
      sent++
    } catch(e) { console.error('Pre-match email failed for', player.name, e) }
  }
  res.json({ sent, total: players.length, match: match.match_id })
}
