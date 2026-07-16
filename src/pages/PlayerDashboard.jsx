// Simplified player dashboard. Replaces the Attack / Transition / Defence tabs
// on the player portal with the handful of outputs players actually care about.
// Every tile shows the value for the selected scope (all games or one game) and
// — in small print underneath — where the player ranks per 60 minutes across the
// season, so they can measure themselves against the rest of the squad.

import { MATCHES } from '../lib/utils'
import { metricByKey, buildPool, standingFor } from '../lib/playerMetrics'

// Match filter pills (mirrors the ones on the other player tabs).
function MatchFilterPills({ matchFilter, setMatchFilter }) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 5, marginBottom: 12, scrollbarWidth: 'none' }}>
      {['all', ...MATCHES].map((m) => (
        <button key={m} className={`pill${matchFilter === m ? ' active' : ''}`} onClick={() => setMatchFilter(m)}>
          {m === 'all' ? 'All' : m}
        </button>
      ))}
    </div>
  )
}

// The value shown big on a tile, for the currently-filtered rows.
function tileValue(metric, rows) {
  if (metric.type === 'count') {
    const raw = metric.agg(rows)
    return { big: String(raw), sub: null, empty: false }
  }
  if (metric.type === 'pct') {
    const { scored, att } = metric.pct(rows)
    return { big: att > 0 ? `${Math.round((scored / att) * 100)}%` : '—', sub: att > 0 ? `${scored}/${att}` : 'no attempts', empty: att === 0, att }
  }
  // ratio (PER)
  return { big: metric.ratio(rows).toFixed(2), sub: null, empty: false }
}

// Small "rank per 60" line under the number. standing comes from the season pool.
function RankLine({ metric, standing }) {
  if (!standing || !standing.qualified) {
    return <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 5, fontStyle: 'italic' }}>{standing ? standing.reason : '—'}</div>
  }
  const { rank, of, entry } = standing
  const ord = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`
  const rateBit = metric.type === 'count' ? <> · <b style={{ color: 'var(--text2)' }}>{entry.p60}</b>/60</> : null
  const rankColor = rank <= 3 ? 'var(--teal)' : rank <= Math.ceil(of / 2) ? 'var(--text2)' : 'var(--text3)'
  return (
    <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 5, letterSpacing: 0.3 }}>
      <span style={{ color: rankColor, fontWeight: 700 }}>{ord}</span> of {of}{rateBit}
    </div>
  )
}

function StatTile({ metricKey, rows, seasonPool, viewerName, compact }) {
  const metric = metricByKey[metricKey]
  const v = tileValue(metric, rows)
  const standing = standingFor(metric, seasonPool, viewerName)
  const big = v.empty ? 'var(--text3)' : metric.color
  return (
    <div className="card" style={{ padding: compact ? '11px 8px' : 13, textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5, lineHeight: 1.2, minHeight: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {metric.short}
      </div>
      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: compact ? 30 : 34, fontWeight: 800, color: big, lineHeight: 1 }}>
        {v.big}
      </div>
      {v.sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{v.sub}</div>}
      {metric.inverted && <div style={{ fontSize: 8, color: 'var(--text3)', marginTop: 2, fontStyle: 'italic' }}>fewer is better</div>}
      <RankLine metric={metric} standing={standing} />
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', margin: '4px 0 8px' }}>
      {children}
    </div>
  )
}

export default function PlayerDashboard({ rows, stats, player, matchFilter, setMatchFilter, allStats, allPlayers }) {
  // Season pool (all competitions) — the basis for every /60 rank line. Stable
  // regardless of which match the tiles above are filtered to.
  const seasonPool = buildPool(allStats, allPlayers)
  const viewer = player.name

  // Which free tiles to show — only the free types this player has actually taken
  // in the current scope.
  const freeKeys = ['pct_1f', 'pct_2f', 'pct_goalf'].filter((k) => {
    const { att } = metricByKey[k].pct(rows)
    return att > 0
  })

  const tileProps = { rows, seasonPool, viewerName: viewer }

  return (
    <div className="fade-in">
      <MatchFilterPills matchFilter={matchFilter} setMatchFilter={setMatchFilter} />

      <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4, marginBottom: 13 }}>
        Your key numbers{matchFilter === 'all' ? ' across the season' : ` for ${matchFilter}`}. The small figure under each is
        where you rank <b style={{ color: 'var(--text2)' }}>per 60 minutes</b> against the squad this season.
      </div>

      {/* Kickouts */}
      <SectionHeader>Kickouts</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
        <StatTile metricKey="own_ko" {...tileProps} />
        <StatTile metricKey="opp_ko" {...tileProps} />
      </div>

      {/* Defence */}
      <SectionHeader>Defence</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <StatTile metricKey="tackles" compact {...tileProps} />
        <StatTile metricKey="lost_1v1" compact {...tileProps} />
        <StatTile metricKey="pos_to" compact {...tileProps} />
      </div>

      {/* Shooting */}
      <SectionHeader>Shooting Accuracy</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <StatTile metricKey="pct_1" compact {...tileProps} />
        <StatTile metricKey="pct_2" compact {...tileProps} />
        <StatTile metricKey="pct_goal" compact {...tileProps} />
      </div>

      {/* Frees — only shown if the player takes them */}
      {freeKeys.length > 0 && (
        <>
          <SectionHeader>From Frees</SectionHeader>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${freeKeys.length}, 1fr)`, gap: 8, marginBottom: 14 }}>
            {freeKeys.map((k) => <StatTile key={k} metricKey={k} compact {...tileProps} />)}
          </div>
        </>
      )}

      {/* Playmaking & ball retention */}
      <SectionHeader>Attack</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 6 }}>
        <StatTile metricKey="assists" {...tileProps} />
        <StatTile metricKey="neg_to" {...tileProps} />
      </div>
    </div>
  )
}
