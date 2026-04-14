export default function StatGroup({ title, badge, color, rows }) {
  const hasData = rows.some(r => r.total > 0)
  if (!hasData) return null

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
      <div className="card-header">
        <span style={{ color }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', borderRadius: 4, padding: '2px 7px' }}>{badge}</span>
      </div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px 32px', gap: 4, padding: '5px 14px 3px', borderBottom: '1px solid rgba(26,51,86,0.3)' }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '1px', textTransform: 'uppercase' }}>Metric</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right' }}>Avg/gm</div>
        <div style={{ fontSize: 9, color: 'var(--teal)', textAlign: 'right' }}>Team</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right' }}>Tot</div>
      </div>
      {rows.map((r, i) => {
        const aboveTeam = r.teamAvg !== null && r.avg > 0 && r.avg >= r.teamAvg
        const avgColor = r.teamAvg !== null && r.avg > 0 ? (aboveTeam ? color : 'var(--text3)') : color
        return (
          <div key={i} className="stat-row">
            <div className="stat-label">{r.label}</div>
            <div className="stat-avg" style={{ color: avgColor }}>{r.avg}</div>
            <div className="stat-team">{r.teamAvg !== null ? r.teamAvg : ''}</div>
            <div className="stat-total" style={{ color: r.total > 0 ? color : 'var(--text3)' }}>
              {r.total > 0 ? r.total : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
