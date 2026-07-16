// Squad leaderboards. One board per key metric, scoped to League / Challenge /
// Championship, with a per-60 ⇄ total toggle for the counting stats. Used on the
// player portal (where `player` highlights the viewer) AND on the coach/analyst
// dashboards (no viewer — pass no props and it fetches its own data).

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { POS_COLORS } from '../lib/utils'
import { metricByKey, buildPool, buildBoard, computeEntry, matchMapOf, compOf, MIN_RANK_MINS } from '../lib/playerMetrics'

const SCOPES = [['league', 'League'], ['challenge', 'Challenge'], ['championship', 'Championship']]

// Boards in the order requested, grouped for readability.
const GROUPS = [
  { title: 'Kickouts', keys: ['own_ko', 'opp_ko'] },
  { title: 'Defence', keys: ['tackles', 'pos_to'] },
  { title: 'Shooting', keys: ['pct_1', 'pct_2', 'pct_goal'] },
  { title: 'From Frees', keys: ['pct_1f', 'pct_2f', 'pct_goalf'] },
  { title: 'Efficiency', keys: ['per'] },
]

const TOP_N = 12

function Pill({ active, onClick, children, color }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'Barlow, sans-serif', whiteSpace: 'nowrap',
        border: `1px solid ${active ? (color || 'var(--blue)') : 'var(--border)'}`,
        background: active ? `${color || 'var(--blue)'}22` : 'var(--bg3)',
        color: active ? (color || 'var(--blue)') : 'var(--text3)',
      }}>
      {children}
    </button>
  )
}

// Render one metric's board.
function Board({ metric, pool, mode, viewerName }) {
  const entries = buildBoard(metric, pool, mode)
  const isCount = metric.type === 'count'
  const unit = isCount && mode === 'p60' ? '/60' : ''

  const viewerIdx = entries.findIndex((e) => e.name === viewerName)
  const visible = entries.slice(0, TOP_N)
  const viewerHidden = viewerIdx >= TOP_N ? entries[viewerIdx] : null

  // Viewer hasn't qualified for this board — still show them their own number
  // (clearly not ranked) so they know where they stand.
  const viewerPoolEntry = pool.find((p) => p.name === viewerName)
  const viewerUnranked = viewerIdx < 0 && viewerPoolEntry ? computeEntry(metric, viewerPoolEntry, mode) : null
  const showUnranked = viewerUnranked && (metric.type === 'pct' ? viewerUnranked.att > 0 : viewerUnranked.raw > 0 || metric.type === 'ratio')

  const badge = metric.inverted
    ? 'fewer = better'
    : metric.type === 'pct'
      ? `min ${metric.minAtt} att`
      : metric.type === 'ratio'
        ? `min ${MIN_RANK_MINS} min`
        : mode === 'p60' ? `min ${MIN_RANK_MINS} min` : 'season total'

  // Top value on this board — used to scale the PER bars (ratio boards only).
  const maxVal = metric.type === 'ratio' ? Math.max(...entries.map((e) => e.value), 0.0001) : 0

  const Row = ({ e, rank }) => {
    const me = e.name === viewerName
    const posColor = POS_COLORS[e.position] || 'var(--text3)'
    const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c9d1d9' : rank === 3 ? '#cd7f32' : 'var(--text3)'
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 13px',
        borderTop: '1px solid rgba(26,51,86,0.25)',
        background: me ? 'rgba(74,158,255,0.12)' : 'transparent',
      }}>
        <div style={{ width: 20, textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 15, fontWeight: 800, color: rankColor }}>{rank}</div>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: posColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: me ? 700 : 500, color: me ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {e.name}{me && <span style={{ fontSize: 9, color: 'var(--blue)', marginLeft: 6 }}>YOU</span>}
        </div>
        {metric.type === 'pct' && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{e.scored}/{e.att}</div>}
        {metric.type === 'ratio' && (
          <div style={{ width: 56, height: 6, borderRadius: 3, background: 'rgba(26,51,86,0.5)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${Math.max(5, Math.round((e.value / maxVal) * 100))}%`, height: '100%', background: metric.color, borderRadius: 3 }} />
          </div>
        )}
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 17, fontWeight: 800, color: metric.color, minWidth: 44, textAlign: 'right' }}>
          {e.display}{unit && <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>{unit}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: 11 }}>
      <div className="card-header">
        <span style={{ color: metric.color }}>{metric.label}</span>
        <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)', borderRadius: 4, padding: '2px 7px' }}>{badge}</span>
      </div>
      {metric.note && (
        <div style={{ padding: '8px 13px', fontSize: 10, color: 'var(--text3)', lineHeight: 1.4, borderBottom: '1px solid rgba(26,51,86,0.25)', background: 'rgba(26,51,86,0.12)' }}>
          {metric.note}
        </div>
      )}
      {entries.length === 0 ? (
        <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>No qualifying players yet.</div>
      ) : (
        <>
          {visible.map((e, i) => <Row key={e.name} e={e} rank={i + 1} />)}
          {viewerHidden && (
            <>
              <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '2px 0' }}>⋯</div>
              <Row e={viewerHidden} rank={viewerIdx + 1} />
            </>
          )}
          {showUnranked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 13px', borderTop: '1px solid rgba(26,51,86,0.25)', background: 'rgba(74,158,255,0.06)' }}>
              <div style={{ width: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>–</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {viewerName}<span style={{ fontSize: 9, color: 'var(--blue)', marginLeft: 6 }}>YOU · not ranked</span>
              </div>
              {metric.type === 'pct' && <div style={{ fontSize: 10, color: 'var(--text3)' }}>{viewerUnranked.scored}/{viewerUnranked.att}</div>}
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--text3)', minWidth: 44, textAlign: 'right' }}>
                {viewerUnranked.display}{unit && <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>{unit}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Leaderboards({ player, allStats: pStats, allPlayers: pPlayers, matches: pMatches }) {
  const [scope, setScope] = useState('league')
  const [mode, setMode] = useState('p60') // 'p60' | 'total' — counting boards only

  // Use data passed from the player portal, or fetch our own when dropped into a
  // coach/analyst dashboard with no props.
  const hasProps = !!(pStats && pPlayers && pMatches)
  const [fetched, setFetched] = useState(hasProps ? { allStats: pStats, allPlayers: pPlayers, matches: pMatches } : null)
  useEffect(() => {
    if (hasProps) return
    Promise.all([
      supabase.from('player_stats').select('*'),
      supabase.from('players').select('name, position'),
      supabase.from('matches').select('match_id, competition, match_type, opposition'),
    ]).then(([{ data: s }, { data: pl }, { data: ms }]) => {
      setFetched({ allStats: s || [], allPlayers: pl || [], matches: ms || [] })
    })
  }, [])

  if (!fetched) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>

  const { allStats, allPlayers, matches } = fetched
  const viewerName = player ? player.name : null

  const matchMap = matchMapOf(matches)
  const scopeIds = new Set((matches || []).filter((m) => compOf(m.match_id, matchMap) === scope).map((m) => m.match_id))
  const pool = buildPool(allStats, allPlayers, scopeIds)

  const hasGames = scopeIds.size > 0

  return (
    <div className="fade-in">
      {/* Scope */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 10, scrollbarWidth: 'none' }}>
        {SCOPES.map(([k, label]) => (
          <Pill key={k} active={scope === k} onClick={() => setScope(k)}>{label}</Pill>
        ))}
      </div>

      {/* Per-60 / total toggle (affects counting boards only) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1 }}>Counting stats shown as</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['p60', 'Per 60'], ['total', 'Total']].map(([k, label]) => (
            <Pill key={k} active={mode === k} onClick={() => setMode(k)}>{label}</Pill>
          ))}
        </div>
      </div>

      {!hasGames ? (
        <div className="card" style={{ padding: '30px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
          No {scope} games recorded yet.
        </div>
      ) : (
        GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', margin: '4px 0 8px' }}>{g.title}</div>
            {g.keys.map((k) => (
              <Board key={k} metric={metricByKey[k]} pool={pool} mode={mode} viewerName={viewerName} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
