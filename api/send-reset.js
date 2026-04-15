export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email, name, token } = req.body
  if (!email || !name || !token) return res.status(400).json({ error: 'Missing fields' })

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'PlayrIQ <noreply@playriq.io>',
      to: email,
      subject: 'Your PlayrIQ PIN Reset Code',
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;background:#07111f;color:#e8edf5;border-radius:12px">
          <div style="font-size:24px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:8px">PlayrIQ</div>
          <div style="font-size:13px;color:#3d5a7a;margin-bottom:24px">Ballyboden St Enda's · 2026</div>
          <div style="font-size:16px;margin-bottom:16px">Hi ${name},</div>
          <div style="font-size:14px;color:#8ba8c8;margin-bottom:24px">Your PIN reset code is:</div>
          <div style="font-size:48px;font-weight:800;letter-spacing:12px;color:#f0b429;text-align:center;margin:24px 0;background:#0b1829;padding:20px;border-radius:8px;border:1px solid #1a3356">${token}</div>
          <div style="font-size:12px;color:#3d5a7a">This code expires in 15 minutes. If you didn't request this, ignore this email.</div>
        </div>
      `
    })
  })

  if (!response.ok) {
    const err = await response.text()
    return res.status(500).json({ error: err })
  }
  res.json({ success: true })
}
