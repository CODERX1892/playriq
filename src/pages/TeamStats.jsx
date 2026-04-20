// Shared TeamStats component — used by CoachDashboard, AnalystDashboard, PlayerPortal
// Shows team-level aggregated stats only (no individual player data)

import { useState } from 'react'
import { MATCHES, OPP } from '../lib/utils'

const TARGETS = {
  possessions:        { label: 'Possessions',       target: 40,    higher: true,  format: v => v },
  possession_pct:     { label: 'Poss Share %',      target: null, higher: true,  format: v => Math.round(v)+'%' },
  attack_pct:         { label: 'Poss → Atk %',      target: 90,   higher: true,  format: v => Math.round(v)+'%' },
  shot_pct:           { label: 'Atk → Shot %',      target: 75,   higher: true,  format: v => Math.round(v)+'%' },
  score_pct:          { label: 'Shot → Score %',    target: 65,   higher: true,  format: v => Math.round(v)+'%' },
  overall_shot_pct:   { label: 'Overall Shot %',    target: 54.3, higher: true,  format: v => Math.round(v)+'%' },
  pct_from_play:      { label: 'Play Conv %',       target: null,  higher: true,  format: v => Math.round(v)+'%' },
  pct_from_frees:     { label: 'Free Conv %',       target: null,  higher: true,  format: v => Math.round(v)+'%' },
  ko_overall_win_pct: { label: 'KO Win %',          target: 66,  higher: true,  format: v => Math.round(v)+'%' },
  turnover_ratio:     { label: 'TO Ratio',          target: 30,   higher: false, format: v => Math.round(v)+'%' },
  intensity_index:    { label: 'Intensity Index',   target: 1.14,  higher: true,  format: v => v?.toFixed(2) },
}

const SECTIONS = [
  {
    label: 'Possession & Scoring', color: '#f0b429',
    rows: [
      { key: 'possessions',    label: 'Possessions' },
      { key: 'attacks',        label: 'Attacks',       format: v => v },
      { key: 'shots',          label: 'Shots',         format: v => v },
      { key: 'scores',         label: 'Scores',        format: v => v },
      { key: 'possession_pct', label: 'Poss Share %',  format: v => Math.round(v)+'%' },
      { key: 'attack_pct',     label: 'Poss → Atk %',  format: v => Math.round(v)+'%' },
      { key: 'shot_pct',       label: 'Atk → Shot %',  format: v => Math.round(v)+'%' },
      { key: 'score_pct',      label: 'Shot → Score %',format: v => Math.round(v)+'%' },
    ]
  },
  {
    label: 'Shooting', color: '#3ecf8e',
    rows: [
      { key: 'shots_from_play',  label: 'Play Shots' },
      { key: 'scores_from_play', label: 'Play Scores' },
      { key: 'pct_from_play',    label: 'Play Conv %',  format: v => v != null ? Math.round(v)+'%' : '—' },
      { key: 'shots_from_frees', label: 'Free Shots' },
      { key: 'scores_from_frees',label: 'Free Scores' },
      { key: 'pct_from_frees',   label: 'Free Conv %',  format: v => v != null ? Math.round(v)+'%' : '—' },
      { key: 'overall_shot_pct', label: 'Overall %',    format: v => v != null ? Math.round(v)+'%' : '—' },
    ]
  },
  {
    label: 'Kickouts', color: '#4a9eff',
    rows: [
      { key: 'ko_total',          label: 'Total KOs' },
      { key: 'ko_won',            label: 'Won' },
      { key: 'ko_lost',           label: 'Lost' },
      { key: 'ko_won_pct',        label: 'Won %',   format: v => v != null ? Math.round(v)+'%' : '—' },
      { key: 'ko_overall_win_pct',label: 'Win % (Overall)', format: v => v != null ? Math.round(v)+'%' : '—' },
    ]
  },
  {
    label: 'Turnovers Won', color: '#3ecf8e',
    rows: [
      { key: 'turnovers_forced',   label: 'Forced Won' },
      { key: 'turnovers_unforced', label: 'Unforced Won' },
      { key: 'turnover_total',     label: 'Total Won' },
    ]
  },
  {
    label: 'Turnovers Lost', color: '#f06060',
    rows: [
      { key: 'turnovers_lost_forced',   label: 'Forced Lost' },
      { key: 'turnovers_lost_unforced', label: 'Unforced Lost' },
      { key: 'turnovers_lost_total',    label: 'Total Lost' },
      { key: 'turnover_ratio',          label: 'TO Ratio', format: v => v != null ? Math.round(v)+'%' : '—' },
    ]
  },
]

function trafficLight(key, usVal, targetInfo) {
  if (!targetInfo || targetInfo.target == null || usVal == null) return null
  const met = targetInfo.higher ? usVal >= targetInfo.target : usVal <= targetInfo.target
  return met ? 'var(--teal)' : 'var(--red)'
}

function fmt(val, key) {
  const section = SECTIONS.flatMap(s => s.rows).find(r => r.key === key)
  if (section?.format) return section.format(val)
  if (val == null) return '—'
  return typeof val === 'number' && val < 2 && val > 0 ? Math.round(val * 100) + '%' : val
}

// Trend table KPIs — rows shown across all games
const TREND_ROWS = [
  { key: 'possessions',          label: 'Possessions',      format: v => v,                          target: 40,    higher: true  },
  { key: 'attack_pct',           label: 'Poss → Atk %',     format: v => Math.round(v)+'%',      target: 90,   higher: true  },
  { key: 'shot_pct',             label: 'Atk → Shot %',     format: v => Math.round(v)+'%',      target: 75,  higher: true  },
  { key: 'score_pct',            label: 'Shot → Score %',   format: v => Math.round(v)+'%',      target: 70,  higher: true  },
  { key: 'two_pt_score_pct',     label: '2pt Shot → Score %', format: v => v == null ? '—' : Math.round(v)+'%', target: 50,  higher: true,
    compute: e => (e.two_point_shots > 0 ? (e.two_point_scores / e.two_point_shots * 100) : null) },
  { key: 'shots_from_play',      label: 'Play Shots',       format: v => v,                          target: null              },
  { key: 'pct_from_play',        label: 'Play Conv %',      format: v => Math.round(v)+'%',      target: null              },
  { key: 'shots_from_frees',     label: 'Free Shots',       format: v => v,                          target: null              },
  { key: 'pct_from_frees',       label: 'Free Conv %',      format: v => Math.round(v)+'%',      target: null              },
  { key: 'ko_overall_win_pct',   label: 'Our KO Win %',     format: v => Math.round(v)+'%', target: 66, higher: true  },
  { key: 'ko_short_won',    label: 'Our KO Short Won', format: v => v, target: null },
  { key: 'ko_short_total',  label: 'Our KO Short Tot', format: v => v, target: null },
  { key: 'ko_mid_won',      label: 'Our KO Mid Won',   format: v => v, target: null },
  { key: 'ko_mid_total',    label: 'Our KO Mid Tot',   format: v => v, target: null },
  { key: 'ko_long_won',     label: 'Our KO Long Won',  format: v => v, target: null },
  { key: 'ko_long_total',   label: 'Our KO Long Tot',  format: v => v, target: null },
  { key: 'ko_breaks_won',   label: 'Our KO Breaks',    format: v => v, target: null },
  { key: 'opp_ko_short_won',   label: 'Opp KO Short Won', format: v => v, target: null },
  { key: 'opp_ko_short_total', label: 'Opp KO Short Tot', format: v => v, target: null },
  { key: 'opp_ko_mid_won',     label: 'Opp KO Mid Won',   format: v => v, target: null },
  { key: 'opp_ko_mid_total',   label: 'Opp KO Mid Tot',   format: v => v, target: null },
  { key: 'opp_ko_long_won',    label: 'Opp KO Long Won',  format: v => v, target: null },
  { key: 'opp_ko_long_total',  label: 'Opp KO Long Tot',  format: v => v, target: null },
  { key: 'opp_ko_breaks_won',  label: 'Opp KO Breaks',    format: v => v, target: null },
  { key: 'turnovers_forced',     label: 'TOs Won (F)',      format: v => v,                          target: null              },
  { key: 'turnovers_unforced',   label: 'TOs Won (U)',      format: v => v,                          target: null              },
  { key: 'turnovers_lost_forced',   label: 'TOs Lost (F)', format: v => v,                          target: null,  higher: false },
  { key: 'turnovers_lost_unforced', label: 'TOs Lost (U)', format: v => v,                          target: null,  higher: false },
  { key: 'tackles',              label: 'Tackles',          format: v => v,                          target: 50,    higher: true  },
]

function trendColor(row, val) {
  if (val == null || row.target == null) return null
  return row.higher ? (val >= row.target ? 'var(--teal)' : 'var(--red)') : (val <= row.target ? 'var(--teal)' : 'var(--red)')
}

function TeamStatsTab({ teamStats }) {
  const [view, setView] = useState('trend')
  const [trendTeam, setTrendTeam] = useState('us')
  const gamesWithData = MATCHES.filter(m => teamStats.some(r => r.match_id === m && r.team === 'us'))

  // ── GAME DETAIL VIEW ──────────────────────────────────────────────────────
  if (view !== 'trend') {
    const matchId = view
    const us = teamStats.find(r => r.match_id === matchId && r.team === 'us')
    const them = teamStats.find(r => r.match_id === matchId && r.team === 'them')
    return (
      <div className="fade-in">
        <button onClick={() => setView('trend')}
          style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif', marginBottom: 14, padding: 0 }}>
          ← Back to Trends
        </button>

        {/* Score header */}
        <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid var(--border)', borderRadius: 13, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Ballyboden</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{us?.scores ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{us?.possessions} poss · {us?.shots} shots</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>v</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{OPP[matchId]}</div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{them?.scores ?? '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{them?.possessions} poss · {them?.shots} shots</div>
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {Object.entries(TARGETS).filter(([k]) => us?.[k] != null).map(([key, info]) => {
            const val = us[key]
            const color = trafficLight(key, val, info)
            return (
              <div key={key} style={{ background: 'var(--bg2)', border: `1px solid ${color || 'var(--border)'}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{info.label}</div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 22, fontWeight: 800, color: color || 'var(--text)' }}>{info.format(val)}</div>
                {info.target != null && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>Target: {info.format(info.target)}</div>}
              </div>
            )
          })}
        </div>

        {/* Section tables */}
        {SECTIONS.map(section => {
          const rows = section.rows.filter(r => us?.[r.key] != null || them?.[r.key] != null)
          if (!rows.length) return null
          return (
            <div key={section.label} className="card" style={{ overflow: 'hidden', marginBottom: 12 }}>
              <div className="card-header">
                <span style={{ color: section.color }}>{section.label}</span>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 60px', gap: 4, textAlign: 'center' }}>
                  <span style={{ fontSize: 9, color: 'var(--teal)' }}>BODEN</span>
                  <span style={{ fontSize: 9, color: 'var(--red)' }}>{OPP[matchId]?.split(' ')[0]?.toUpperCase()}</span>
                </div>
              </div>
              {rows.map((row, i) => {
                const usVal = us?.[row.key]
                const themVal = them?.[row.key]
                const targetInfo = TARGETS[row.key]
                const usColor = trafficLight(row.key, usVal, targetInfo) || section.color
                const displayFn = row.format || (v => v != null ? v : '—')
                return (
                  <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', alignItems: 'center', padding: '8px 14px', borderTop: i === 0 ? 'none' : '1px solid rgba(26,51,86,0.25)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{row.label}</div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, textAlign: 'center', color: usColor }}>{usVal != null ? displayFn(usVal) : '—'}</div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 18, fontWeight: 700, textAlign: 'center', color: 'var(--text3)' }}>{themVal != null ? displayFn(themVal) : '—'}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  // ── TREND TABLE VIEW ──────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Header + Boden/Opposition toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase' }}>
          Season Trends
        </div>
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, gap: 3 }}>
          {[{ val: 'us', label: 'Boden', color: 'var(--teal)' }, { val: 'them', label: 'Opposition', color: 'var(--red)' }].map(opt => (
            <button key={opt.val} onClick={() => setTrendTeam(opt.val)}
              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Barlow, sans-serif', border: 'none',
                background: trendTeam === opt.val ? 'var(--bg4)' : 'transparent',
                color: trendTeam === opt.val ? opt.color : 'var(--text3)' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {gamesWithData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14 }}>No team data yet</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={{ ...tth, minWidth: 130, position: 'sticky', left: 0, background: 'var(--bg3)', zIndex: 2, textAlign: 'left' }}>KPI</th>
                <th style={{ ...tth, color: 'var(--text3)', borderLeft: '1px solid var(--border)', minWidth: 55 }}>
                  {trendTeam === 'us' ? 'Target' : 'Boden'}
                </th>
                {gamesWithData.map(m => (
                  <th key={m} style={{ ...tth, borderLeft: '1px solid var(--border)', minWidth: 60,
                    cursor: trendTeam === 'us' ? 'pointer' : 'default',
                    color: trendTeam === 'us' ? 'var(--blue)' : 'var(--red)' }}
                    onClick={() => trendTeam === 'us' && setView(m)}>
                    <div>{m.replace('AFL ', 'G')}</div>
                    <div style={{ fontSize: 8, fontWeight: 400, color: 'var(--text3)', marginTop: 2 }}>{OPP[m]?.split(' ')[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TREND_ROWS.map((row, ri) => {
                const vals = gamesWithData.map(m => {
                  const entry = teamStats.find(r => r.match_id === m && r.team === trendTeam)
                  if (!entry) return null
                  return row.compute ? row.compute(entry) : (entry[row.key] ?? null)
                })
                const usVals = trendTeam === 'them' ? gamesWithData.map(m => {
                  const us = teamStats.find(r => r.match_id === m && r.team === 'us')
                  if (!us) return null
                  return row.compute ? row.compute(us) : (us[row.key] ?? null)
                }) : null
                const hasAny = vals.some(v => v != null)
                if (!hasAny) return null
                return (
                  <tr key={row.key} style={{ background: ri % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderBottom: '1px solid rgba(26,51,86,0.2)' }}>
                    <td style={{ ...ttd, position: 'sticky', left: 0, background: ri % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', zIndex: 1, fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                      {row.label}
                    </td>
                    <td style={{ ...ttd, borderLeft: '1px solid var(--border)', textAlign: 'center', fontSize: 11, color: 'var(--text3)' }}>
                      {trendTeam === 'us'
                        ? (row.target != null ? row.format(row.target) : '—')
                        : '—'}
                    </td>
                    {vals.map((val, vi) => {
                      const color = trendTeam === 'us' ? trendColor(row, val) : null
                      const usVal = usVals?.[vi]
                      return (
                        <td key={vi} style={{ ...ttd, borderLeft: '1px solid rgba(26,51,86,0.3)', textAlign: 'center',
                          fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700,
                          color: color || 'var(--red)',
                          background: color === 'var(--teal)' ? 'rgba(62,207,142,0.07)' : color === 'var(--red)' ? 'rgba(240,96,96,0.07)' : '' }}>
                          {val != null ? row.format(val) : '—'}
                          {trendTeam === 'them' && usVal != null && (
                            <div style={{ fontSize: 9, color: 'var(--teal)', fontWeight: 400, marginTop: 1 }}>
                              {row.format(usVal)}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const tth = { padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text2)', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const ttd = { padding: '7px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }

const kth = { padding: '7px 8px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const ktd = { padding: '8px 6px', verticalAlign: 'middle' }

export default TeamStatsTab
