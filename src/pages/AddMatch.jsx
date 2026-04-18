import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadMatches, MATCH_DATA } from '../lib/utils'

export default function AddMatch({ onMatchAdded }) {
  const [form, setForm] = useState({
    match_id: '',
    opposition: '',
    match_date: '',
    competition: 'League',
    home_away: 'Away',
    venue: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Auto-suggest next match ID
  const suggestId = (competition) => {
    const prefix = competition === 'Championship' ? 'SFC' : 'AFL'
    const existing = MATCH_DATA.filter(m => m.match_id.startsWith(prefix))
    const nums = existing.map(m => parseInt(m.match_id.replace(prefix + ' ', '')) || 0)
    const next = Math.max(0, ...nums) + 1
    return `${prefix} ${next}`
  }

  const handleCompetitionChange = (comp) => {
    setForm(f => ({ ...f, competition: comp, match_id: suggestId(comp) }))
  }

  const handleSubmit = async () => {
    if (!form.opposition || !form.match_date || !form.match_id) {
      setError('Please fill in Match ID, Opposition and Date')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('matches').insert(form)
    if (err) { setError(err.message); setSaving(false); return }
    await loadMatches()
    setSuccess(true)
    setSaving(false)
    setForm({ match_id: '', opposition: '', match_date: '', competition: 'League', home_away: 'Away', venue: '' })
    if (onMatchAdded) onMatchAdded()
    setTimeout(() => setSuccess(false), 3000)
  }

  const inp = (label, field, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        value={form[field]}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="card-header" style={{ marginBottom: 14 }}>
        <span style={{ color: 'var(--blue)' }}>Add New Match</span>
      </div>

      {/* Competition type */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Competition</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['League', 'Championship'].map(c => (
            <button key={c} onClick={() => handleCompetitionChange(c)}
              style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.competition === c ? 'var(--blue)' : 'var(--border)'}`, background: form.competition === c ? 'rgba(74,158,255,0.12)' : 'var(--bg3)', color: form.competition === c ? 'var(--blue)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {inp('Match ID', 'match_id', 'text', 'e.g. AFL 5 or SFC 1')}
      {inp('Opposition', 'opposition', 'text', 'e.g. Thomas Davis')}
      {inp('Date', 'match_date', 'date')}
      {inp('Venue (optional)', 'venue', 'text', 'e.g. Parnell Park')}

      {/* Home/Away */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Home / Away</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Home', 'Away'].map(ha => (
            <button key={ha} onClick={() => setForm(f => ({ ...f, home_away: ha }))}
              style={{ flex: 1, padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.home_away === ha ? 'var(--teal)' : 'var(--border)'}`, background: form.home_away === ha ? 'rgba(62,207,142,0.12)' : 'var(--bg3)', color: form.home_away === ha ? 'var(--teal)' : 'var(--text3)', fontFamily: 'Barlow, sans-serif' }}>
              {ha}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}
      {success && <div style={{ color: 'var(--teal)', fontSize: 12, marginBottom: 10 }}>✓ Match added successfully</div>}

      <button onClick={handleSubmit} disabled={saving}
        style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--blue)', border: 'none', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
        {saving ? 'Saving…' : 'Add Match'}
      </button>
    </div>
  )
}
