import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── COACH VIEW: PLAYER PERFORMANCE REVIEWS ───────────────────────────────────
// Mirrors CoachReflectionView. Lists player self-reviews per window, shows each
// 1–5 rating + the player's "why", and clears the "new" notification on open.

const TOPICS = [
  { key: 'def',      title: 'Defence',     color: '#4a9eff' },
  { key: 'att',      title: 'Attack',      color: '#f0b429' },
  { key: 'trans',    title: 'Transition',  color: '#3ecf8e' },
  { key: 'overall',  title: 'Overall',     color: '#a78bfa' },
  { key: 'offfield', title: 'Off-Field & Leadership', color: '#f0b429' },
]

export default function CoachPerformanceReviews() {
  const [windows, setWindows] = useState([])
  const [reviews, setReviews] = useState([])
  const [windowFilter, setWindowFilter] = useState(null)
  const [openCard, setOpenCard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('review_windows').select('*').order('id', { ascending: false }),
      supabase.from('performance_reviews').select('*').order('submitted_at', { ascending: false }),
    ]).then(([{ data: w }, { data: r }]) => {
      setWindows(w || [])
      setReviews(r || [])
      const open = (w || []).find(x => x.is_open)
      setWindowFilter(open ? open.id : (w && w[0] ? w[0].id : null))
      setLoading(false)
      // Mark everything seen now that a coach has opened the tab
      const unseen = (r || []).filter(x => !x.seen_by_coach).map(x => x.id)
      if (unseen.length) {
        supabase.from('performance_reviews').update({ seen_by_coach: true }).in('id', unseen)
      }
    })
  }, [])

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>

  const shown = reviews.filter(r => r.window_id === windowFilter)
  const newCount = reviews.filter(r => !r.seen_by_coach).length

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 4 }}>
          Player Performance Reviews
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {shown.length} submitted this window
          {newCount > 0 && <span style={{ marginLeft: 8, color: 'var(--red)' }}>{newCount} new</span>}
        </div>
      </div>

      {/* Window filter */}
      {windows.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 14, scrollbarWidth: 'none' }}>
          {windows.map(w => (
            <button key={w.id} onClick={() => setWindowFilter(w.id)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${w.id === windowFilter ? 'var(--purple)' : 'var(--border)'}`, background: w.id === windowFilter ? 'rgba(167,139,250,0.12)' : 'var(--bg2)', color: w.id === windowFilter ? 'var(--purple)' : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}>
              {w.label}{w.is_open ? ' · open' : ''}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 12, color: 'var(--text3)' }}>
          No reviews submitted for this window yet
        </div>
      )}

      {shown.map(r => {
        const isOpen = openCard === r.id
        return (
          <div key={r.id} className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
            <div onClick={() => setOpenCard(isOpen ? null : r.id)}
              style={{ padding: '11px 14px', background: 'var(--bg3)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{r.player_name}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>
                  {new Date(r.submitted_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {TOPICS.map(t => r[`${t.key}_rating`] ? (
                  <span key={t.key} title={t.title} style={{ width: 24, height: 24, borderRadius: 6, background: t.color, color: '#0a1628', fontSize: 13, fontWeight: 800, fontFamily: 'Barlow Condensed, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {r[`${t.key}_rating`]}
                  </span>
                ) : null)}
                <span style={{ color: 'var(--text3)', fontSize: 16, marginLeft: 2 }}>{isOpen ? '▲' : '›'}</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '4px 14px 12px' }}>
                {TOPICS.map(t => (r[`${t.key}_rating`] || r[`${t.key}_why`]) ? (
                  <div key={t.key} style={{ borderTop: '1px solid rgba(26,51,86,0.2)', padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.title}</span>
                      {r[`${t.key}_rating`] && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r[`${t.key}_rating`]}/5</span>
                      )}
                    </div>
                    {r[`${t.key}_why`] && (
                      <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{r[`${t.key}_why`]}</div>
                    )}
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
