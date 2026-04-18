import { useState } from 'react'
import { MATCHES, OPP } from '../lib/utils'

const n = (v) => (!v && v !== 0) ? 0 : (typeof v === 'number' ? v : parseFloat(v) || 0)

export default function StatGroup({ title, badge, color, rows, matchRows }) {
  const [expandedRow, setExpandedRow] = useState(null)
  const hasData = rows.some(r => r.total > 0)
  if (!hasData) return null

  const hasMatchData = matchRows && matchRows.length > 0

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
      <div className="card-header">
        <span style={{ color }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', borderRadius: 4, padding: '2px 7px' }}>{badge}</span>
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px 32px', gap: 4, padding: '5px 14px 3px', borderBottom: '1px solid rgba(26,51,86,0.3)' }}>
        <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: '1px', textTransform: 'uppercase' }}>Metric</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right' }}>Avg/gm</div>
        <div style={{ fontSize: 9, color: 'var(--teal)', textAlign: 'right' }}>Team</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'right' }}>Tot</div>
      </div>

      {rows.map((r, i) => {
        const aboveTeam = r.teamAvg !== null && r.avg > 0 && r.avg >= r.teamAvg
        const avgColor = r.teamAvg !== null && r.avg > 0 ? (aboveTeam ? color : 'var(--text3)') : color
        const isExpanded = expandedRow === i
        const canExpand = hasMatchData && r.field && r.total > 0

        const matchVals = canExpand ? MATCHES.map(m => {
          const mrow = matchRows.find(mr => mr.match_id === m)
          return { match: m, val: mrow ? n(mrow[r.field]) : null }
        }) : []

        return (
          <div key={i}>
            {/* Summary row */}
            <div
              className="stat-row"
              onClick={() => canExpand && setExpandedRow(isExpanded ? null : i)}
              style={{ cursor: canExpand ? 'pointer' : 'default' }}
              onMouseEnter={e => canExpand && (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => canExpand && (e.currentTarget.style.background = '')}>
              <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {r.label}
                {canExpand && (
                  <span style={{ fontSize: 9, color: 'var(--text3)' }}>{isExpanded ? '▲' : '▾'}</span>
                )}
              </div>
              <div className="stat-avg" style={{ color: avgColor }}>{r.avg}</div>
              <div className="stat-team">{r.teamAvg !== null ? r.teamAvg : ''}</div>
              <div className="stat-total" style={{ color: r.total > 0 ? color : 'var(--text3)', fontWeight: r.total > 0 ? 700 : 400 }}>
                {r.total > 0 ? r.total : '—'}
              </div>
            </div>

            {/* Expanded game-by-game */}
            {isExpanded && (
              <div style={{ background: 'rgba(26,51,86,0.2)', padding: '6px 14px 8px' }}>
                {matchVals.map(({ match, val }) => (
                  <div key={match} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(26,51,86,0.15)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {match} <span style={{ fontSize: 10 }}>{OPP[match]}</span>
                    </span>
                    <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 15, fontWeight: 700, color: val > 0 ? color : 'var(--text3)' }}>
                      {val === null ? 'DNP' : val > 0 ? val : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
