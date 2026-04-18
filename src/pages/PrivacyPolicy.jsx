import { useState } from 'react'

export default function PrivacyPolicy() {
  const [section, setSection] = useState(null)

  const sections = [
    {
      id: 'who',
      title: 'Who We Are',
      content: `PlayrIQ is a sports performance analytics platform operated by Eamon O'Reilly, a company incorporated in Ireland.

Data Controller: Eamon O'Reilly
Contact: eamon@sparc.ie

For any questions about how we handle your personal data, or to exercise your rights, please contact us at the email above.`
    },
    {
      id: 'collect',
      title: 'What Data We Collect',
      content: `We collect the following categories of personal data:

ACCOUNT DATA
• Full name
• Email address
• Date of birth
• A PIN code you create to access the platform

PERFORMANCE DATA
• Match statistics recorded by your coaching staff (tackles, passes, scores, turnovers etc.)
• Impact scores calculated from your match statistics
• AI-generated performance analysis based on your anonymised statistics

PROFILE DATA (optional)
• A profile photo you choose to upload

GPS & MOVEMENT DATA (optional — requires separate consent)
• Post-match speed and distance data
• This feature is optional. You may use PlayrIQ fully without enabling GPS data collection.
• You may opt in or out of GPS data collection at any time in your account settings.

We do not collect health or medical data, financial data, or any data about your activity outside of sporting performance.`
    },
    {
      id: 'why',
      title: 'Why We Use Your Data',
      content: `We process your personal data for the following purposes:

1. TO PROVIDE THE SERVICE
   Legal basis: Contractual necessity
   • Creating and managing your player account
   • Displaying your performance statistics and analysis
   • Enabling coaches to review and compare player performance

2. PERFORMANCE ANALYSIS
   Legal basis: Legitimate interests (sports performance improvement)
   • Calculating impact scores and benchmarks
   • Generating AI-powered performance analysis
   • Note: AI analysis uses fully anonymised statistical data only — your name and identifying information are never sent to any AI system

3. PROFILE PHOTO
   Legal basis: Consent
   • Displaying your photo within the platform
   • You may remove your photo at any time

4. GPS & MOVEMENT DATA
   Legal basis: Explicit consent
   • Analysing post-match physical performance (speed, distance)
   • This requires your separate explicit consent and can be withdrawn at any time
   • Withdrawing GPS consent does not affect your access to any other features`
    },
    {
      id: 'ai',
      title: 'AI & Third Party Processing',
      content: `PlayrIQ uses an AI system to generate personalised performance analysis (PlayrIQ Edge).

HOW WE PROTECT YOUR DATA IN AI PROCESSING
• Your name, email, date of birth, and any identifying information are never included in data sent to AI systems
• Only anonymised statistical averages and position role data are used
• Match references are replaced with generic labels (Game 1, Game 2 etc.)
• No sport, league, club, or location information is included
• Each AI analysis request is fully independent — no data is retained between requests

OUR AI PROVIDER
We use Anthropic PBC as our AI processing provider. Anthropic operates a zero data retention policy for API usage, meaning your data is not stored or used to train AI models after processing is complete.

Anthropic's data processing terms: anthropic.com/legal/privacy`
    },
    {
      id: 'retention',
      title: 'How Long We Keep Your Data',
      content: `STANDARD RETENTION
We retain your personal data and performance statistics for a period of 5 seasons from the date of collection.

EXTENDED RETENTION
At the end of the standard retention period, you will be given the option to extend retention of your performance data if you wish to maintain a longer personal record.

ACCOUNT DELETION
You may request deletion of your account and all associated data at any time by contacting eamon@sparc.ie. We will action deletion requests within 30 days.

EXCEPTIONS
We may retain certain data for longer where required by law or for the establishment, exercise, or defence of legal claims.`
    },
    {
      id: 'sharing',
      title: 'Who We Share Your Data With',
      content: `We do not sell your personal data to any third party.

We share your data only with the following categories of recipients, strictly for the purposes of operating the platform:

• Supabase Inc — database hosting and storage (EU servers, GDPR compliant)
• Vercel Inc — application hosting (EU servers available)
• Anthropic PBC — AI analysis processing (anonymised data only, zero retention policy)
• Your club's coaching staff — performance statistics as entered and reviewed within the platform

We do not share your data with advertisers, data brokers, or any other commercial third parties.`
    },
    {
      id: 'rights',
      title: 'Your Rights',
      content: `Under GDPR you have the following rights in relation to your personal data:

RIGHT OF ACCESS
You may request a copy of all personal data we hold about you.

RIGHT TO RECTIFICATION
You may request correction of any inaccurate data we hold.

RIGHT TO ERASURE
You may request deletion of your personal data, subject to our legal obligations.

RIGHT TO RESTRICTION
You may request that we restrict processing of your data in certain circumstances.

RIGHT TO DATA PORTABILITY
You may request your performance data in a machine-readable format.

RIGHT TO OBJECT
You may object to processing based on legitimate interests.

RIGHT TO WITHDRAW CONSENT
Where processing is based on consent (profile photo, GPS data), you may withdraw consent at any time without affecting the lawfulness of prior processing.

TO EXERCISE ANY OF THESE RIGHTS
Contact: eamon@sparc.ie
We will respond within 30 days.

RIGHT TO LODGE A COMPLAINT
If you are unhappy with how we handle your data, you have the right to lodge a complaint with the Data Protection Commission (Ireland): dataprotection.ie`
    },
    {
      id: 'security',
      title: 'Security',
      content: `We take the security of your personal data seriously. Measures in place include:

• All data is encrypted in transit using TLS
• Database access is restricted by row-level security policies
• API keys and credentials are stored as encrypted environment variables — never exposed in application code
• Player accounts are protected by PIN authentication
• Coaching staff accounts are separately authenticated with role-based access controls
• We do not store passwords in plain text

In the event of a data breach that poses a risk to your rights and freedoms, we will notify the Data Protection Commission within 72 hours and affected individuals without undue delay.`
    },
    {
      id: 'cookies',
      title: 'Cookies & Tracking',
      content: `PlayrIQ does not currently use cookies, tracking pixels, or any third-party analytics tools.

We do not track your activity outside of the platform and we do not use your data for advertising purposes.

If we introduce any cookies or tracking in future, this policy will be updated and you will be notified.`
    },
    {
      id: 'changes',
      title: 'Changes to This Policy',
      content: `We may update this privacy policy from time to time. Where changes are material, we will notify you within the platform and update the effective date below.

If you continue to use PlayrIQ after changes are notified, this constitutes acceptance of the updated policy.

Effective date: April 2026
Version: 1.0
Operated by: Eamon O'Reilly`
    },
  ]

  return (
    <div className="fade-in" style={{ padding: '0 2px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--blue)', marginBottom: 4 }}>Privacy Policy</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>How PlayrIQ collects, uses and protects your personal data</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Effective April 2026 · Eamon O'Reilly</div>
      </div>

      {sections.map(s => (
        <div key={s.id} className="card" style={{ overflow: 'hidden', marginBottom: 8 }}>
          <div
            onClick={() => setSection(section === s.id ? null : s.id)}
            style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
            <div style={{ fontSize: 16, color: 'var(--text3)', transform: section === s.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</div>
          </div>
          {section === s.id && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
              {s.content.split('\n').map((line, i) => {
                if (!line.trim()) return <div key={i} style={{ height: 8 }} />
                const isHeader = line === line.toUpperCase() && line.length > 3 && !line.includes('•')
                const isBullet = line.trim().startsWith('•')
                return (
                  <div key={i} style={{
                    fontSize: isHeader ? 10 : 12,
                    color: isHeader ? 'var(--text3)' : isBullet ? 'var(--text2)' : 'var(--text2)',
                    letterSpacing: isHeader ? 1.5 : 0,
                    textTransform: isHeader ? 'uppercase' : 'none',
                    fontWeight: isHeader ? 600 : 400,
                    marginTop: isHeader ? 12 : 4,
                    lineHeight: 1.6,
                    paddingLeft: isBullet ? 4 : 0,
                  }}>{line}</div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: 'var(--text3)' }}>
        Questions? Contact <span style={{ color: 'var(--blue)' }}>eamon@sparc.ie</span>
      </div>
    </div>
  )
}
