import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY
)

// Emails each accountability group's LEADER a goals-vs-actual summary for one
// match (for the weekly AAR), and emails admin(s) a combined all-groups digest.
// POST { matchId }. Computes results itself from targets + stats + squad, so it
// doesn't depend on the per-player AI reports having run first.
export const config = { maxDuration: 60 }

const FROM = 'PlayrIQ <noreply@reset.playriq.io>'
const num = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0)

// Count-metric labels (mirrors PlayerReflection / generate-game-reports).
const METRIC_LABELS = {
  tackles: 'Tackles', forced_to_win: 'Forced TO Won', advance_pass: 'Advance Passes',
  simple_pass: 'Simple Passes', carries: 'Carries', dne: 'DNE', breach_1v1: '1v1 Breach',
  defensive_duels_won: 'Duels Won', one_pointer_scored: '1-Point Scores', two_pointer_scored: '2-Point Scores',
  goals_scored: 'Goals', drop_shorts: 'Drop Shorts', turnovers_in_contact: 'Contact TOs',
  turnovers_kicked_away: 'Kickaway TOs', ko_target_won_clean: 'KO Won Clean (for+against)',
  won_break_our: 'Our KO Break', won_break_opp: 'Opp KO Break', assists_shots: 'Shot Assists',
}
const LOWER_IS_BETTER = new Set(['dne', 'breach_1v1', 'drop_shorts', 'turnovers_in_contact', 'turnovers_kicked_away'])
// Percentage metrics (mirror generate-game-reports.js).
const PCT_METRICS = {
  pct_1:         { label: '1-Pt Shot %', num: ['one_pointer_scored'], den: ['one_pointer_scored', 'one_pointer_wide', 'one_pointer_drop_short_block'] },
  pct_2:         { label: '2-Pt Shot %', num: ['two_pointer_scored'], den: ['two_pointer_scored', 'two_pointer_wide', 'two_pointer_drop_short_block'] },
  pct_goal:      { label: 'Goal Shot %', num: ['goals_scored'],       den: ['goals_scored', 'goals_wide', 'goal_drop_short_block'] },
  pct_ko_target: { label: 'KO Win %',    num: ['ko_target_won_clean', 'ko_target_won_break'], den: ['ko_target_won_clean', 'ko_target_won_break', 'ko_target_lost_clean', 'ko_target_lost_contest'] },
  pct_gk_ko_clean: { label: 'GK KO Clean %', num: ['goalie_ko_clean_wins'], den: ['goalie_ko_taken'] },
  pct_gk_ko_break: { label: 'GK KO Break %', num: ['goalie_ko_break_wins'], den: ['goalie_ko_taken'] },
  pct_1f:        { label: '1-Pt Free %', num: ['one_pointer_scored_f'], den: ['one_pointer_attempts_f'] },
  pct_2f:        { label: '2-Pt Free %', num: ['two_pointer_scored_f'], den: ['two_pointer_attempts_f'] },
  pct_goalf:     { label: 'Goal Free %', num: ['goals_scored_f'],      den: ['goal_attempts_f'] },
}
const sumc = (row, cols) => cols.reduce((a, c) => a + num(row[c]), 0)
// Count goals that aggregate several columns — e.g. clean kickouts won on BOTH
// our own restarts and the opposition's. Falls back to the raw column.
const SUM_METRICS = {
  ko_target_won_clean: ['won_clean_p1_our', 'won_clean_p2_our', 'won_clean_p3_our', 'won_clean_p1_opp', 'won_clean_p2_opp', 'won_clean_p3_opp'],
}
const countVal = (row, metric) => (SUM_METRICS[metric] ? sumc(row, SUM_METRICS[metric]) : num(row[metric]))
const pctFromRow = (row, cfg) => { const d = sumc(row, cfg.den); return d > 0 ? Math.round(sumc(row, cfg.num) / d * 100) : null }
const labelOf = (metric) => METRIC_LABELS[metric] || (PCT_METRICS[metric] && PCT_METRICS[metric].label) || metric

async function sendEmail(RESEND_KEY, to, subject, html) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { matchId } = req.body || {}
  if (!matchId) return res.status(400).json({ error: 'Missing matchId' })

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(500).json({ error: 'Email not configured' })

  const [{ data: match }, { data: groups }, { data: gm }, { data: appUsers }, { data: players }, { data: targets }, { data: stats }, { data: squad }] =
    await Promise.all([
      supabase.from('matches').select('*').eq('match_id', matchId).single(),
      supabase.from('groups').select('*').order('created_at'),
      supabase.from('group_members').select('*'),
      supabase.from('app_users').select('id, name, email, role'),
      supabase.from('players').select('name, email'),
      supabase.from('player_targets').select('*').eq('match_id', matchId),
      supabase.from('player_stats').select('*').eq('match_id', matchId),
      supabase.from('matchday_squad').select('player_name, is_starter').eq('match_id', matchId),
    ])
  if (!match) return res.status(404).json({ error: 'Match not found' })
  if (!groups?.length) return res.json({ sent: 0, note: 'no groups' })

  const membersByGroup = {}
  ;(gm || []).forEach(r => { (membersByGroup[r.group_id] = membersByGroup[r.group_id] || []).push(r.player_name) })
  const targetsByName = {}; (targets || []).forEach(t => { targetsByName[t.player_name] = t })
  const statsByName = {};   (stats || []).forEach(s => { statsByName[s.player_name] = s })
  const subByName = {};     (squad || []).forEach(r => { subByName[r.player_name] = r.is_starter === false })
  const userByName = {};    (appUsers || []).forEach(u => { userByName[u.name] = u })
  const userById = {};      (appUsers || []).forEach(u => { userById[u.id] = u })
  const playerEmail = {};   (players || []).forEach(p => { playerEmail[p.name] = p.email })

  // Resolve a leader/coach display name to an email (player first, then staff).
  const emailForName = (name) => (name && (playerEmail[name] || userByName[name]?.email)) || null

  // Evaluate one member's goals vs actual for this match.
  const evalMember = (name) => {
    const t = targetsByName[name]
    const s = statsByName[name]
    const played = s && num(s.total_minutes) > 0
    const mins = played ? num(s.total_minutes) : 0
    const isSub = subByName[name] === true
    if (!t) return { name, set: false, played, goals: [] }
    const goals = []
    for (let i = 1; i <= 3; i++) {
      const metric = t[`metric_${i}`], target = t[`target_${i}`]
      if (!metric || target == null) continue
      const cfg = PCT_METRICS[metric]
      const isPctM = !!cfg
      const lower = LOWER_IS_BETTER.has(metric)
      const rawTarget = num(target)
      const scaled = isSub && !lower && !isPctM && mins > 0 && mins < 60
      const effTarget = scaled ? Math.max(1, Math.round(rawTarget * mins / 60)) : rawTarget
      const actual = !played ? null : (isPctM ? pctFromRow(s, cfg) : countVal(s, metric))
      const met = actual == null ? null : (lower ? actual <= effTarget : actual >= effTarget)
      goals.push({ label: labelOf(metric), target: effTarget, actual, met, lower, pct: isPctM })
    }
    return { name, set: true, played, goals }
  }

  const chip = (g) => {
    const u = g.pct ? '%' : ''
    const color = g.met == null ? '#8ba8c8' : g.met ? '#3ecf8e' : '#f06060'
    const actual = g.actual == null ? '' : ` <b style="color:${color}">${g.actual}${u} ${g.met ? '✓' : '✗'}</b>`
    return `<span style="display:inline-block;font-size:12px;background:#0d1f3c;border:1px solid ${g.met == null ? '#1a3356' : color};border-radius:6px;padding:3px 8px;margin:2px 4px 2px 0;color:#c9d6e8">${g.label} ${g.lower ? '≤' : '≥'}${g.target}${u}${actual}</span>`
  }

  // Build the HTML block for one group; also returns its hit/result tallies.
  const buildGroupBlock = (group) => {
    const mem = (membersByGroup[group.id] || []).slice().sort((a, b) => a.localeCompare(b))
    let hit = 0, res = 0, withGoals = 0
    const rows = mem.map(name => {
      const e = evalMember(name)
      if (e.set) withGoals++
      e.goals.forEach(g => { if (g.met != null) { res++; if (g.met) hit++ } })
      const status = !e.set
        ? '<span style="font-size:11px;color:#8ba8c8;font-style:italic">no goals set</span>'
        : !e.played
          ? '<span style="font-size:11px;color:#8ba8c8;font-style:italic">didn\'t play</span>'
          : `<span style="font-size:11px;color:${e.goals.filter(g => g.met).length === e.goals.length ? '#3ecf8e' : '#f0b429'}">${e.goals.filter(g => g.met).length}/${e.goals.length} hit</span>`
      return `<div style="padding:9px 0;border-top:1px solid #14243d">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${e.goals.length ? 6 : 0}px">
          <span style="font-size:13px;font-weight:600;color:#e8edf5">${name}</span>${status}
        </div>${e.goals.map(chip).join('')}</div>`
    }).join('')
    const html = `<div style="margin-bottom:22px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
        <span style="font-size:16px;font-weight:700;color:#f0b429">${group.name}</span>
        <span style="font-size:12px;color:#8ba8c8">${withGoals}/${mem.length} set goals · ${res ? Math.round(hit / res * 100) : 0}% of goals hit</span>
      </div>
      ${rows || '<div style="font-size:12px;color:#8ba8c8;padding:8px 0">No members in this group.</div>'}
    </div>`
    return { html, hit, res, withGoals, members: mem.length }
  }

  const shell = (title, inner) => `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#07111f;color:#e8edf5;border-radius:12px">
    <div style="font-size:22px;font-weight:800;color:#f0b429;letter-spacing:3px;margin-bottom:4px">PlayrIQ</div>
    <div style="font-size:12px;color:#3d5a7a;margin-bottom:18px">${title} · ${match.match_id} vs ${match.opposition}</div>
    ${inner}
    <div style="font-size:11px;color:#3d5a7a;margin-top:14px">Goals vs actual for this game — use it for your accountability review. Open PlayrIQ for the live view.</div>
  </div>`

  const blocks = groups.map(g => ({ group: g, ...buildGroupBlock(g) }))
  let sent = 0

  // Per-group emails to each leader (or the group's coach as fallback).
  for (const b of blocks) {
    const leaderName = b.group.leader_name
    const email = emailForName(leaderName) || (b.group.coach_id && userById[b.group.coach_id]?.email) || null
    if (!email) continue
    await new Promise(r => setTimeout(r, 700))
    try {
      await sendEmail(RESEND_KEY, email, `AAR summary — ${b.group.name} — ${match.match_id}`, shell(`AAR summary · ${b.group.name}`, b.html))
      sent++
    } catch (e) { console.error('Group summary failed for', b.group.name, e) }
  }

  // Combined all-groups digest to every admin.
  let admins = 0
  const adminEmails = (appUsers || []).filter(u => u.role === 'admin' && u.email).map(u => u.email)
  if (adminEmails.length) {
    const digest = shell('AAR summary · all groups', blocks.map(b => b.html).join('<hr style="border:none;border-top:1px solid #14243d;margin:0 0 18px">'))
    for (const email of adminEmails) {
      await new Promise(r => setTimeout(r, 700))
      try { await sendEmail(RESEND_KEY, email, `AAR summary — all groups — ${match.match_id}`, digest); admins++ }
      catch (e) { console.error('Admin digest failed for', email, e) }
    }
  }

  res.json({ sent, admins, groups: groups.length, match: match.match_id })
}
