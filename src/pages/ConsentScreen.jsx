import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ConsentScreen({ player, onConsented }) {
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [gpsConsent, setGpsConsent] = useState(false)
  const [showPolicy, setShowPolicy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleAgree = async () => {
    if (!privacyAgreed) {
      setError('You must read and agree to the Privacy Policy to continue.')
      return
    }
    setSaving(true)
    setError(null)
    const now = new Date().toISOString()
    const { error: err } = await supabase.from('player_consent').upsert({
      player_name: player.name,
      privacy_agreed: true,
      privacy_agreed_at: now,
      gps_consent: gpsConsent,
      gps_consent_at: gpsConsent ? now : null,
      privacy_version: '1.0',
      updated_at: now,
    }, { onConflict: 'player_name' })
    setSaving(false)
    if (err) { setError('Something went wrong. Please try again.'); return }
    onConsented({ gps_consent: gpsConsent })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '16px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--gold)', letterSpacing: 1 }}>PlayrIQ</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Before you begin</div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {/* Welcome */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            Welcome, {player.name.split(' ')[0]}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            PlayrIQ collects and processes your performance data to provide personalised analysis and feedback. Before you access the platform, please review and agree to our Privacy Policy.
          </div>
        </div>

        {/* What we collect summary */}
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>What we collect</div>
          {[
            ['Account data', 'Name, email, date of birth, PIN'],
            ['Performance stats', 'Match statistics entered by your coaching staff'],
            ['AI analysis', 'Generated from anonymised stats only — your name is never sent to AI systems'],
            ['Profile photo', 'Optional — uploaded by you, removable at any time'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 6 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* GPS consent — separate optional */}
        <div className="card" style={{ padding: 14, marginBottom: 12, border: gpsConsent ? '1px solid var(--blue)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                📍 GPS & Movement Data
                <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--teal)', background: 'rgba(62,207,142,0.1)', borderRadius: 4, padding: '2px 6px' }}>Optional</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                Allow PlayrIQ to collect post-match speed and distance data. This is entirely optional — you can opt in or out at any time in your account settings without affecting any other features.
              </div>
            </div>
            <div
              onClick={() => setGpsConsent(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0, cursor: 'pointer', marginTop: 2,
                background: gpsConsent ? 'var(--blue)' : 'var(--bg3)',
                border: `1px solid ${gpsConsent ? 'var(--blue)' : 'var(--border)'}`,
                position: 'relative', transition: 'background 0.2s',
              }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 2, left: gpsConsent ? 22 : 2,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>
        </div>

        {/* Privacy policy link */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => setShowPolicy(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', padding: 0, textDecoration: 'underline' }}>
            {showPolicy ? 'Hide Privacy Policy ▲' : 'Read Full Privacy Policy ▼'}
          </button>

          {showPolicy && (
            <div style={{ marginTop: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, maxHeight: 300, overflowY: 'auto', fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>PlayrIQ Privacy Policy — v1.0 — April 2026</div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text3)', letterSpacing: 1, fontSize: 10, textTransform: 'uppercase' }}>Data Controller</div>
              <div style={{ marginBottom: 10 }}>Eamon O'Reilly. Contact: eamon@sparc.ie</div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text3)', letterSpacing: 1, fontSize: 10, textTransform: 'uppercase' }}>Data We Collect</div>
              <div style={{ marginBottom: 10 }}>Name, email, date of birth, PIN, match performance statistics, optional profile photo, and optional GPS movement data. We do not collect health or financial data.</div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text3)', letterSpacing: 1, fontSize: 10, textTransform: 'uppercase' }}>AI Processing</div>
              <div style={{ marginBottom: 10 }}>PlayrIQ Edge uses AI to generate performance analysis. Only anonymised statistical data is sent — your name and all identifying information are removed before processing. AI provider: Anthropic PBC (zero data retention policy).</div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text3)', letterSpacing: 1, fontSize: 10, textTransform: 'uppercase' }}>Retention</div>
              <div style={{ marginBottom: 10 }}>Data is retained for 5 seasons. You may request deletion at any time by contacting eamon@sparc.ie.</div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text3)', letterSpacing: 1, fontSize: 10, textTransform: 'uppercase' }}>Your Rights</div>
              <div style={{ marginBottom: 10 }}>Under GDPR you have the right to access, correct, delete, and port your data, and to withdraw consent at any time. Complaints may be made to the Data Protection Commission at dataprotection.ie.</div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text3)', letterSpacing: 1, fontSize: 10, textTransform: 'uppercase' }}>Data Sharing</div>
              <div>We share data only with: Supabase (database hosting, EU servers), Vercel (app hosting), Anthropic (anonymised AI processing), and your club's coaching staff. We do not sell your data.</div>
            </div>
          )}
        </div>

        {/* Privacy agree checkbox */}
        <div
          onClick={() => { setPrivacyAgreed(v => !v); setError(null) }}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, cursor: 'pointer' }}>
          <div style={{
            width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
            background: privacyAgreed ? 'var(--blue)' : 'transparent',
            border: `2px solid ${privacyAgreed ? 'var(--blue)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
            {privacyAgreed && <div style={{ color: 'white', fontSize: 13, lineHeight: 1, fontWeight: 700 }}>✓</div>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            I confirm I am 18 or over, I have read and understood the Privacy Policy, and I consent to PlayrIQ collecting and processing my personal data as described.
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(240,96,96,0.1)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleAgree}
          disabled={saving}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: privacyAgreed ? 'pointer' : 'not-allowed',
            background: privacyAgreed ? 'var(--blue)' : 'var(--bg3)',
            color: privacyAgreed ? 'white' : 'var(--text3)',
            border: 'none', fontFamily: 'Barlow, sans-serif',
            transition: 'all 0.2s',
          }}>
          {saving ? 'Saving…' : 'Agree & Continue →'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--text3)' }}>
          Your agreement is recorded with a timestamp for GDPR compliance.
        </div>
      </div>
    </div>
  )
}
