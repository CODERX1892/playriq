import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

// Emails every player (with an email) that a performance-review window is open.
// POST { windowId } — or omit windowId to use the currently-open window.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { windowId } = req.body || {}

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' })

  // Resolve the window: explicit id, else the currently-open one
  let windowRow
  if (windowId) {
    const { data } = await supabase.from('review_windows').select('*').eq('id', windowId).single()
    windowRow = data
  } else {
    const { data } = await supabase.from('review_windows').select('*').eq('is_open', true)
      .order('id', { ascending: false }).limit(1).maybeSingle()
    windowRow = data
  }
  if (!windowRow) return res.status(404).json({ error: 'No review window found' })

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
          subject: `Your ${windowRow.label} is open`,
          html: `
            <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px">
              <div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div>
              <div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div>
              <div style="font-size:16px;margin-bottom:16px">Hi ${player.name.split(' ')[0]},</div>
              <div style="font-size:15px;color:#e8edf5;margin-bottom:8px">Your <strong style="color:#f0b429">${windowRow.label}</strong> is now open.</div>
              <div style="font-size:14px;color:#8ba8c8;margin-bottom:24px">Rate yourself 1–5 across Defence, Attack, Transition, Overall and Off-Field, and explain why using your own numbers as evidence.</div>
              <a href="https://playriq.io" style="display:block;background:#f0b429;color:#07111f;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:1px">START YOUR REVIEW →</a>
              <div style="font-size:11px;color:#3d5a7a;margin-top:20px;text-align:center">Login with your name and PIN at playriq.io · open the Review tab</div>
            </div>
          `
        })
      })
      sent++
    } catch (e) { console.error('Review email failed for', player.name, e) }
  }

  res.json({ sent, total: players.length, window: windowRow.label })
}
