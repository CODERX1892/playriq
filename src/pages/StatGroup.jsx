import { useState } from 'react'
import { MATCHES } from '../lib/utils'

const n = (v) => (!v && v !== 0) ? 0 : (typeof v === 'number' ? v : parseFloat(v) || 0)

export default function StatGroup({ title, badge, color, rows, matchRows }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const hasData = rows.some(r => r.total > 0)
  if (!hasData) return null

  // matchRows: array of raw stat objects per match { match_id, ...fields }
  const hasMatchData = matchRows && matchRows.length > 0

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
      <div className="card-header">
        <span style={{ color }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasMatchData && (
            <button onClick={() => setShowBreakdown(!showBreakdown)}
              style={{
                background: showBreakdown ? color : 'var(--bg4)',
                border: `1px solid ${showBreakdown ? color : 'var(--border)'}`,
                borderRadius: 4, padding: '2px 7px', fontSize: 9,
                color: showBreakdown ? '#000' : 'var(--text3)',
                cursor: 'pointer', fontFamily: 'Barlow, sans-serif',
                fontWeight: 600, letterSpacing: 0.5,
              }}>
              {showBreakdown ? 'SUMMARY' : 'BY GAME'}
            </button>
          )}
          <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', borderRadius: 4, padding: '2px 7px' }}>{badge}</span>
        </div>
      </div>

      {!showBreakdown ? (
        <>
          {/* Summary view */}
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
        </>
      ) : (
        <>
          {/* Match-by-match breakdown */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 'max-content' }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `1fr ${MATCHES.map(() => '44px').join(' ')} 44px`,
                gap: 3, padding: '5px 14px 3px',
                borderBottom: '1px solid rgba(26,51,86,0.3)',
              }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>Metric</div>
                {MATCHES.map(m => (
                  <div key={m} style={{ fontSize: 9, color: 'var(--text2)', textAlign: 'center', fontWeight: 700 }}>
                    {m.replace('AFL ', 'G')}
                  </div>
                ))}
                <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>Tot</div>
              </div>

              {/* Metric rows */}
              {rows.map((r, i) => {
                const matchVals = MATCHES.map(m => {
                  const mrow = matchRows.find(mr => mr.match_id === m)
                  return mrow ? n(mrow[r.field]) : null
                })
                const total = matchVals.reduce((s, v) => s + (v || 0), 0)
                if (total === 0 && !r.total) return null
                return (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: `1fr ${MATCHES.map(() => '44px').join(' ')} 44px`,
                    gap: 3, padding: '6px 14px',
                    borderTop: '1px solid rgba(26,51,86,0.25)',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.label}</div>
                    {matchVals.map((v, j) => (
                      <div key={j} style={{
                        textAlign: 'center',
                        fontFamily: 'Barlow Condensed, sans-serif',
                        fontSize: 15, fontWeight: 700,
                        color: v > 0 ? color : v === null ? 'var(--bg4)' : 'var(--text3)',
                      }}>
                        {v === null ? '·' : v > 0 ? v : '—'}
                      </div>
                    ))}
                    <div style={{
                      textAlign: 'center',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontSize: 15, fontWeight: 800,
                      color: total > 0 ? color : 'var(--text3)',
                    }}>
                      {total > 0 ? total : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
