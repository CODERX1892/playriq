import { useState } from 'react'

const CATEGORIES = [
  {
    key: 'defence',
    label: 'Defence',
    color: '#4a9eff',
    icon: '🛡',
    metrics: [
      { name: 'Duels Contested', definition: 'Any 1v1 physical defensive engagement.' },
      { name: 'Defensive Duels Won', definition: 'Defensive contest won without conceding progression.' },
      { name: 'Duels Lost', definition: 'Defensive contest clearly lost allowing opponent progression.' },
      { name: 'Breach 1v1', definition: 'Defender beaten cleanly resulting in scoring or line-break opportunity.', negative: true },
      { name: 'DNE', full: 'Defensive Non-Engagement', definition: 'Failure to apply expected defensive pressure in a contest situation, leading to a shot or assist to shot.', negative: true },
      { name: 'Tackles (no TO)', definition: 'Defensive contact that disrupts play but does not regain possession.' },
      { name: 'Forced TO Win', definition: 'Turnover directly created and secured through tackle or pressure.' },
      { name: 'Kickaway TO Received', definition: 'Possession secured from opposition kickout without primary contest role.' },
    ]
  },
  {
    key: 'fouls',
    label: 'Fouls & Discipline',
    color: '#f06060',
    icon: '⚠️',
    metrics: [
      { name: 'Free Conceded', definition: 'Defensive foul conceded not resulting in a shot.', negative: true },
      { name: 'Shot Free Conceded', definition: 'Defensive foul resulting directly in a one-point free attempt.', negative: true },
      { name: '2pt Free Conceded', definition: 'Defensive foul resulting directly in a two-point free attempt.', negative: true },
      { name: 'Yellow Card', definition: 'Official caution resulting in disciplinary sanction.', negative: true },
      { name: 'Black Card', definition: 'Temporary 10-minute dismissal.', negative: true },
      { name: 'Red Card', definition: 'Permanent dismissal from the game.', negative: true },
    ]
  },
  {
    key: 'shooting',
    label: 'Shooting — From Play',
    color: '#f0b429',
    icon: '🎯',
    metrics: [
      { name: '1pt Scored', full: 'One-Pointer Scored', definition: 'Successful one-point score from open play.' },
      { name: '1pt Wide', full: 'One-Pointer Wide', definition: 'One-point shot attempt from play that misses.' },
      { name: '2pt Scored', full: 'Two-Pointer Scored', definition: 'Successful two-point score from open play.' },
      { name: '2pt Wide', full: 'Two-Pointer Wide', definition: 'Two-point shot attempt from play that misses.' },
      { name: 'Goal Scored', definition: 'Successful goal scored from open play.' },
      { name: 'Goal Wide', definition: 'Goal attempt from play that does not result in a goal.' },
      { name: 'Drop Short', definition: 'Shot attempt that fails to reach the end line.', negative: true },
    ]
  },
  {
    key: 'frees',
    label: 'Shooting — From Frees',
    color: '#a78bfa',
    icon: '🅵',
    metrics: [
      { name: '1pt Free Scored', full: 'One-Pointer Scored (Free)', definition: 'Successful one-point score from a free.' },
      { name: '2pt Free Scored', full: 'Two-Pointer Scored (Free)', definition: 'Successful two-point score from a free.' },
      { name: 'Goal (Free)', definition: 'Goal scored from a free or penalty.' },
    ]
  },
  {
    key: 'turnovers',
    label: 'Turnovers',
    color: '#f06060',
    icon: '🔄',
    metrics: [
      { name: 'Turnover in Contact', definition: 'Possession lost under physical pressure.', negative: true },
      { name: 'Skill Error', definition: 'Unforced possession loss due to technical execution error.', negative: true },
      { name: 'Kickaway Turnover', definition: 'Possession lost through a poor or misplaced kick pass.', negative: true },
      { name: 'Acceptable Turnover', definition: 'Strategic or high-risk turnover acceptable within the team framework.' },
    ]
  },
  {
    key: 'possession',
    label: 'Possession & Passing',
    color: '#3ecf8e',
    icon: '🤝',
    metrics: [
      { name: 'Simple Pass', definition: 'Short low-risk pass maintaining possession.' },
      { name: 'Simple Receive', definition: 'Clean receipt of a routine possession pass.' },
      { name: 'Advance Pass', definition: 'Forward pass that meaningfully progresses field position past an opponent in a forward direction.' },
      { name: 'Advance Receive', definition: 'Receipt of an advance pass that advances territory.' },
      { name: 'Shot Assist', definition: 'Final pass directly leading to a shot attempt.' },
      { name: '2pt Assist', definition: 'Final pass directly leading to a successful two-point score.' },
      { name: 'Goal Assist', definition: 'Final pass directly leading to a goal.' },
    ]
  },
  {
    key: 'kickouts',
    label: 'Kickouts — Ours',
    color: '#3ecf8e',
    icon: '🥅',
    metrics: [
      { name: 'Won Clean P1', definition: 'Clean possession win from our kickout — no pressure on the receiver.' },
      { name: 'Won Clean P2', definition: 'Clean possession win from our kickout — receiver under clear pressure.' },
      { name: 'Won Clean P3', definition: 'Clean possession win from our kickout — 50/50 ball.' },
      { name: 'Won Break', definition: 'Loose ball secured after contested or broken play from our restart.' },
      { name: 'Contest (Opp)', full: 'KO Contest — Opp Break', definition: 'Engagement in a contest leading to a break to our player.' },
      { name: 'Contest (Us)', full: 'KO Contest — Us Break', definition: 'Engagement in a contest leading to a break to the opposition player.' },
      { name: 'Target Won Clean', definition: 'Targeted as primary receiver — cleanly won.' },
      { name: 'Target Won Break', definition: 'Targeted as primary receiver — won from broken play.' },
      { name: 'Target Lost Clean', definition: 'Targeted as primary receiver — cleanly lost.', negative: true },
      { name: 'Target Lost Contest', definition: 'Targeted as primary receiver — lost in contested play.', negative: true },
    ]
  },
  {
    key: 'kickouts_opp',
    label: 'Kickouts — Opposition',
    color: '#a78bfa',
    icon: '⚽',
    metrics: [
      { name: 'Opp P1 Won', full: 'Won Clean P1 (Opp KO)', definition: 'Clean win of opposition kickout — no pressure on the receiver.' },
      { name: 'Opp P2 Won', full: 'Won Clean P2 (Opp KO)', definition: 'Clean win of opposition kickout — receiver under clear pressure.' },
      { name: 'Opp P3 Won', full: 'Won Clean P3 (Opp KO)', definition: 'Clean win of opposition kickout — 50/50 ball.' },
      { name: 'Opp Break Won', full: 'Won Break (Opp KO)', definition: 'Loose ball secured following a contested opposition kickout.' },
    ]
  },
  {
    key: 'impact',
    label: 'Impact Scores',
    color: '#f0b429',
    icon: '⚡',
    metrics: [
      { name: 'Attack Impact', definition: 'Weighted score reflecting a player\'s contribution to scoring and attacking play. Incorporates shooting accuracy, assists, and attacking possession.' },
      { name: 'Transition Impact', definition: 'Weighted score reflecting a player\'s effectiveness in moving the ball from defence to attack. Incorporates kickout wins, possession progression, and turnovers won.' },
      { name: 'Defensive Impact', definition: 'Weighted score reflecting a player\'s defensive contribution. Incorporates duels, tackles, turnovers won, and foul discipline.' },
      { name: 'Total Impact', definition: 'Combined weighted score across all three impact categories. The primary performance indicator used for squad ranking.' },
    ]
  },
  {
    key: 'general',
    label: 'General',
    color: '#8ba8c8',
    icon: '📋',
    metrics: [
      { name: 'Total Minutes', definition: 'Total time played in the match.' },
    ]
  },
]

const ALL_METRICS = CATEGORIES.flatMap(c =>
  c.metrics.map(m => ({ ...m, category: c.label, color: c.color }))
)

export default function Glossary() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [expanded, setExpanded] = useState(null)

  const filtered = ALL_METRICS.filter(m => {
    const matchesSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.definition.toLowerCase().includes(search.toLowerCase()) ||
      (m.full && m.full.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = activeCategory === 'all' || m.category === CATEGORIES.find(c => c.key === activeCategory)?.label
    return matchesSearch && matchesCategory
  })

  const groupedFiltered = CATEGORIES.map(cat => ({
    ...cat,
    metrics: filtered.filter(m => m.category === cat.label)
  })).filter(cat => cat.metrics.length > 0)

  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--gold)', letterSpacing: 2, marginBottom: 4 }}>
          Metric Definitions
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Every metric tracked in PlayrIQ — what it means and how it's recorded
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text3)' }}>🔍</div>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setActiveCategory('all') }}
          placeholder="Search metrics..."
          style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontFamily: 'Barlow, sans-serif', outline: 'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        )}
      </div>

      {/* Category pills */}
      {!search && (
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8, marginBottom: 14, scrollbarWidth: 'none' }}>
          <button onClick={() => setActiveCategory('all')}
            style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${activeCategory === 'all' ? 'var(--gold)' : 'var(--border)'}`, background: activeCategory === 'all' ? 'var(--gold-dim)' : 'var(--bg2)', color: activeCategory === 'all' ? 'var(--gold)' : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}>
            All ({ALL_METRICS.length})
          </button>
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setActiveCategory(c.key)}
              style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${activeCategory === c.key ? c.color : 'var(--border)'}`, background: activeCategory === c.key ? 'rgba(255,255,255,0.04)' : 'var(--bg2)', color: activeCategory === c.key ? c.color : 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Barlow, sans-serif' }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Search results count */}
      {search && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
        </div>
      )}

      {/* Metric groups */}
      {groupedFiltered.map(cat => (
        <div key={cat.key} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
            <span style={{ fontSize: 14 }}>{cat.icon}</span>
            <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700, color: cat.color, letterSpacing: 1.5, textTransform: 'uppercase' }}>{cat.label}</span>
            <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '1px 6px', borderRadius: 10 }}>{cat.metrics.length}</span>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            {cat.metrics.map((m, i) => {
              const isExpanded = expanded === `${cat.key}-${i}`
              return (
                <div key={i}
                  onClick={() => setExpanded(isExpanded ? null : `${cat.key}-${i}`)}
                  style={{ padding: '11px 14px', borderTop: i === 0 ? 'none' : '1px solid rgba(26,51,86,0.25)', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.02)' : '' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Indicator dot */}
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.negative ? 'var(--red)' : cat.color, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isExpanded ? 6 : 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                        {m.negative && (
                          <span style={{ fontSize: 9, background: 'rgba(240,96,96,0.1)', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.5 }}>KEEP LOW</span>
                        )}
                        {m.full && !isExpanded && (
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{m.full}</span>
                        )}
                      </div>
                      {isExpanded ? (
                        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                          {m.full && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontStyle: 'italic' }}>{m.full}</div>}
                          {m.definition}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.definition}
                        </div>
                      )}
                    </div>
                    <div style={{ color: 'var(--text3)', fontSize: 12, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14 }}>No metrics found for "{search}"</div>
        </div>
      )}
    </div>
  )
}
