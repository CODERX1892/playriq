import { useState } from 'react'
import { n, r1, pct, sf, MATCHES } from '../lib/utils'

// ─── BENCHMARKS ──────────────────────────────────────────────────────────────
// Hard targets per role. As dataset grows these can be replaced with dynamic p75/p90.
// lower_is_better + warning = acceptable ceiling (not zero — realistic low target)
// zero_target removed — replaced with explicit warning thresholds

const DYNAMIC_BENCHMARKS = {
  "Inside Forward": {
    // Shooting
    one_pointer_attempts:  { good: 3.0,  p90: 4.0,  lower_is_better: false, zero_target: false, warning: 3.0,  label: "1pt Attempts per game" },
    one_pointer_pct:       { good: 75,   p90: 85,   lower_is_better: false, zero_target: false, warning: 75,   label: "1pt Shooting %" },
    two_pointer_attempts:  { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "2pt Attempts per game" },
    two_pointer_pct:       { good: 50,   p90: 65,   lower_is_better: false, zero_target: false, warning: 50,   label: "2pt Shooting %" },
    pts:                   { good: 2.5,  p90: 4.0,  lower_is_better: false, zero_target: false, warning: 2.5,  label: "Points per game" },
    assists_shots:         { good: 1.0,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Assists (3 scores) per game" },
    // Defence & workrate
    tackles:               { good: 3.0,  p90: 4.0,  lower_is_better: false, zero_target: false, warning: 3.0,  label: "Tackles per game" },
    forced_to_win:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Forced TOs Won per game" },
    kickaway_to_received:  { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "Kickaway TOs Won per game" },
    // Opp kickouts
    won_clean_p1_opp:      { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "Opp KO Clean Wins per game" },
    won_break_opp:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Opp KO Breaks per game" },
    // Our kickouts
    won_clean_p1_our:      { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "Our KO Clean Wins per game" },
    won_break_our:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO Breaks per game" },
    // Turnovers lost — realistic low targets (not zero)
    drop_shorts:           { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Drop Shorts per game" },
    turnovers_in_contact:  { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "TOs in Contact per game" },
    turnovers_kicked_away: { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Kickaway TOs Lost per game" },
    turnover_skill_error:  { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Skill Errors per game" },
  },

  "Half Forward": {
    // Shooting
    one_pointer_attempts:  { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "1pt Attempts per game" },
    one_pointer_pct:       { good: 75,   p90: 85,   lower_is_better: false, zero_target: false, warning: 75,   label: "1pt Shooting %" },
    two_pointer_pct:       { good: 50,   p90: 65,   lower_is_better: false, zero_target: false, warning: 50,   label: "2pt Shooting %" },
    assists_shots:         { good: 3.0,  p90: 4.0,  lower_is_better: false, zero_target: false, warning: 3.0,  label: "Assists (3 scores) per game" },
    // Possession
    simple_pass:           { good: 8.0,  p90: 12.0, lower_is_better: false, zero_target: false, warning: 8.0,  label: "Simple Passes per game" },
    advance_pass:          { good: 2.0,  p90: 3.5,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Advance Passes per game" },
    carries:               { good: 1.5,  p90: 2.5,  lower_is_better: false, zero_target: false, warning: 1.5,  label: "Carries per game" },
    // Defence
    tackles:               { good: 3.0,  p90: 4.0,  lower_is_better: false, zero_target: false, warning: 3.0,  label: "Tackles per game" },
    forced_to_win:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Forced TOs Won per game" },
    kickaway_to_received:  { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "Kickaway TOs Won per game" },
    // Opp kickouts
    won_clean_p1_opp:      { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Opp KO Clean Wins per game" },
    won_break_opp:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Opp KO Breaks per game" },
    // Our kickouts
    won_clean_p1_our:      { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO Clean Wins per game" },
    won_break_our:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO Breaks per game" },
    // Turnovers lost
    drop_shorts:           { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Drop Shorts per game" },
    turnovers_in_contact:  { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "TOs in Contact per game" },
    turnovers_kicked_away: { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Kickaway TOs Lost per game" },
    turnover_skill_error:  { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Skill Errors per game" },
  },

  "Midfielder": {
    // Possession
    simple_pass:           { good: 12.0, p90: 18.0, lower_is_better: false, zero_target: false, warning: 12.0, label: "Simple Passes per game" },
    advance_pass:          { good: 3.0,  p90: 4.5,  lower_is_better: false, zero_target: false, warning: 3.0,  label: "Advance Passes per game" },
    carries:               { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Carries per game" },
    assists_shots:         { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Assists (3 scores) per game" },
    // Defence
    tackles:               { good: 3.0,  p90: 5.0,  lower_is_better: false, zero_target: false, warning: 3.0,  label: "Tackles per game" },
    forced_to_win:         { good: 1.0,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Forced TOs Won per game" },
    kickaway_to_received:  { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Kickaway TOs Won per game" },
    dne:                   { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "DNE per game" },
    // Opp kickouts
    won_clean_p1_opp:      { good: 1.5,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.5,  label: "Opp KO Clean Wins per game" },
    won_clean_p2_opp:      { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "Opp KO P2 Wins per game" },
    won_break_opp:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Opp KO Breaks per game" },
    // Our kickouts
    won_clean_p1_our:      { good: 1.5,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.5,  label: "Our KO Clean Wins per game" },
    won_clean_p2_our:      { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "Our KO P2 Wins per game" },
    won_break_our:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO Breaks per game" },
    // Turnovers lost
    drop_shorts:           { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Drop Shorts per game" },
    turnovers_in_contact:  { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "TOs in Contact per game" },
    turnovers_kicked_away: { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Kickaway TOs Lost per game" },
    turnover_skill_error:  { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "Skill Errors per game" },
  },

  "Half Back": {
    // Possession
    simple_pass:           { good: 10.0, p90: 15.0, lower_is_better: false, zero_target: false, warning: 10.0, label: "Simple Passes per game" },
    advance_pass:          { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Advance Passes per game" },
    carries:               { good: 1.5,  p90: 2.5,  lower_is_better: false, zero_target: false, warning: 1.5,  label: "Carries per game" },
    assists_shots:         { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Assists (3 scores) per game" },
    // Defence
    tackles:               { good: 4.0,  p90: 6.0,  lower_is_better: false, zero_target: false, warning: 4.0,  label: "Tackles per game" },
    forced_to_win:         { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Forced TOs Won per game" },
    kickaway_to_received:  { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Kickaway TOs Won per game" },
    dne:                   { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "DNE per game" },
    breach_1v1:            { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "Breach 1v1 per game" },
    // Our kickouts — higher targets for half backs
    won_clean_p1_our:      { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Our KO Clean Wins per game" },
    won_clean_p2_our:      { good: 0.5,  p90: 1.0,  lower_is_better: false, zero_target: false, warning: 0.5,  label: "Our KO P2 Wins per game" },
    won_break_our:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO Breaks per game" },
    // Opp kickouts
    won_clean_p1_opp:      { good: 1.5,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.5,  label: "Opp KO Clean Wins per game" },
    won_break_opp:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Opp KO Breaks per game" },
    // Turnovers lost — backs must protect possession
    drop_shorts:           { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "Drop Shorts per game" },
    turnovers_in_contact:  { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "TOs in Contact per game" },
    turnovers_kicked_away: { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "Kickaway TOs Lost per game" },
    turnover_skill_error:  { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "Skill Errors per game" },
  },

  "Full Back": {
    // Possession — full backs recycle a lot
    simple_pass:           { good: 12.0, p90: 18.0, lower_is_better: false, zero_target: false, warning: 12.0, label: "Simple Passes per game" },
    advance_pass:          { good: 1.0,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Advance Passes per game" },
    // Defence
    tackles:               { good: 4.0,  p90: 6.0,  lower_is_better: false, zero_target: false, warning: 4.0,  label: "Tackles per game" },
    forced_to_win:         { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Forced TOs Won per game" },
    kickaway_to_received:  { good: 2.0,  p90: 3.0,  lower_is_better: false, zero_target: false, warning: 2.0,  label: "Kickaway TOs Won per game" },
    dne:                   { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "DNE per game" },
    breach_1v1:            { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "Breach 1v1 per game" },
    // Our kickouts — full backs are primary targets
    won_clean_p1_our:      { good: 2.5,  p90: 3.5,  lower_is_better: false, zero_target: false, warning: 2.5,  label: "Our KO Clean Wins per game" },
    won_clean_p2_our:      { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO P2 Wins per game" },
    won_break_our:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO Breaks per game" },
    ko_target_lost_clean:  { good: 0.3,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "KO Target Lost Clean per game" },
    // Turnovers lost — strict for full backs
    turnovers_in_contact:  { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "TOs in Contact per game" },
    turnovers_kicked_away: { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "Kickaway TOs Lost per game" },
    turnover_skill_error:  { good: 0.2,  p90: 0.1,  lower_is_better: true,  zero_target: false, warning: 0.2,  label: "Skill Errors per game" },
  },

  "Goalkeeper": {
    shots_saved:           { good: 1.0,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Shots Saved per game" },
    ko_target_lost_clean:  { good: 0.3,  p90: 0.2,  lower_is_better: true,  zero_target: false, warning: 0.3,  label: "KO Target Lost Clean per game" },
    won_clean_p1_our:      { good: 3.0,  p90: 4.0,  lower_is_better: false, zero_target: false, warning: 3.0,  label: "Our KO P1 Won per game" },
    won_clean_p2_our:      { good: 1.0,  p90: 2.0,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO P2 Won per game" },
    won_break_our:         { good: 1.0,  p90: 1.5,  lower_is_better: false, zero_target: false, warning: 1.0,  label: "Our KO Breaks per game" },
  },
}

const ROLE_BENCHMARKS = {
  "Inside Forward": {
    description: "Primary scoring threat. Shoot early and often, convert chances, win the ball back in scoring zones.",
    key_metrics: {
      one_pointer_attempts:  { good: 3.0,  label: "1pt attempts per game",       higher_better: true  },
      one_pointer_pct:       { good: 75,   label: "1pt shooting %",              higher_better: true  },
      two_pointer_pct:       { good: 50,   label: "2pt shooting %",              higher_better: true  },
      pts:                   { good: 2.5,  label: "Points per game",             higher_better: true  },
      assists_shots:         { good: 1.0,  label: "Assists (3 scores) per game", higher_better: true  },
      tackles:               { good: 3.0,  label: "Tackles per game",            higher_better: true  },
      forced_to_win:         { good: 1.0,  label: "Forced TOs Won per game",     higher_better: true  },
      kickaway_to_received:  { good: 0.5,  label: "Kickaway TOs Won per game",   higher_better: true  },
      won_clean_p1_opp:      { good: 0.5,  label: "Opp KO Clean Wins per game",  higher_better: true  },
      won_break_opp:         { good: 1.0,  label: "Opp KO Breaks per game",      higher_better: true  },
      won_clean_p1_our:      { good: 0.5,  label: "Our KO Clean Wins per game",  higher_better: true  },
      won_break_our:         { good: 1.0,  label: "Our KO Breaks per game",      higher_better: true  },
      drop_shorts:           { good: 0.3,  label: "Drop Shorts per game",        higher_better: false },
      turnovers_in_contact:  { good: 0.3,  label: "TOs in Contact per game",     higher_better: false },
      turnovers_kicked_away: { good: 0.3,  label: "Kickaway TOs Lost per game",  higher_better: false },
      turnover_skill_error:  { good: 0.3,  label: "Skill Errors per game",       higher_better: false },
    }
  },
  "Half Forward": {
    description: "Link player. Creates scores, recycles possession, contributes defensively across the pitch.",
    key_metrics: {
      one_pointer_attempts:  { good: 2.0,  label: "1pt attempts per game",       higher_better: true  },
      one_pointer_pct:       { good: 75,   label: "1pt shooting %",              higher_better: true  },
      two_pointer_pct:       { good: 50,   label: "2pt shooting %",              higher_better: true  },
      assists_shots:         { good: 3.0,  label: "Assists (3 scores) per game", higher_better: true  },
      simple_pass:           { good: 8.0,  label: "Simple passes per game",      higher_better: true  },
      advance_pass:          { good: 2.0,  label: "Advance passes per game",     higher_better: true  },
      carries:               { good: 1.5,  label: "Carries per game",            higher_better: true  },
      tackles:               { good: 3.0,  label: "Tackles per game",            higher_better: true  },
      forced_to_win:         { good: 1.0,  label: "Forced TOs Won per game",     higher_better: true  },
      kickaway_to_received:  { good: 0.5,  label: "Kickaway TOs Won per game",   higher_better: true  },
      won_clean_p1_opp:      { good: 1.0,  label: "Opp KO Clean Wins per game",  higher_better: true  },
      won_break_opp:         { good: 1.0,  label: "Opp KO Breaks per game",      higher_better: true  },
      won_clean_p1_our:      { good: 1.0,  label: "Our KO Clean Wins per game",  higher_better: true  },
      won_break_our:         { good: 1.0,  label: "Our KO Breaks per game",      higher_better: true  },
      drop_shorts:           { good: 0.3,  label: "Drop Shorts per game",        higher_better: false },
      turnovers_in_contact:  { good: 0.3,  label: "TOs in Contact per game",     higher_better: false },
      turnovers_kicked_away: { good: 0.3,  label: "Kickaway TOs Lost per game",  higher_better: false },
      turnover_skill_error:  { good: 0.3,  label: "Skill Errors per game",       higher_better: false },
    }
  },
  "Midfielder": {
    description: "Engine of the team. Dominates kickouts, recycles ball, wins turnovers, covers the most ground.",
    key_metrics: {
      simple_pass:           { good: 12.0, label: "Simple passes per game",      higher_better: true  },
      advance_pass:          { good: 3.0,  label: "Advance passes per game",     higher_better: true  },
      carries:               { good: 2.0,  label: "Carries per game",            higher_better: true  },
      assists_shots:         { good: 2.0,  label: "Assists (3 scores) per game", higher_better: true  },
      tackles:               { good: 3.0,  label: "Tackles per game",            higher_better: true  },
      forced_to_win:         { good: 1.0,  label: "Forced TOs Won per game",     higher_better: true  },
      kickaway_to_received:  { good: 2.0,  label: "Kickaway TOs Won per game",   higher_better: true  },
      dne:                   { good: 0.2,  label: "DNE per game",                higher_better: false },
      won_clean_p1_opp:      { good: 1.5,  label: "Opp KO Clean Wins per game",  higher_better: true  },
      won_break_opp:         { good: 1.0,  label: "Opp KO Breaks per game",      higher_better: true  },
      won_clean_p1_our:      { good: 1.5,  label: "Our KO Clean Wins per game",  higher_better: true  },
      won_break_our:         { good: 1.0,  label: "Our KO Breaks per game",      higher_better: true  },
      drop_shorts:           { good: 0.3,  label: "Drop Shorts per game",        higher_better: false },
      turnovers_in_contact:  { good: 0.3,  label: "TOs in Contact per game",     higher_better: false },
      turnovers_kicked_away: { good: 0.3,  label: "Kickaway TOs Lost per game",  higher_better: false },
      turnover_skill_error:  { good: 0.3,  label: "Skill Errors per game",       higher_better: false },
    }
  },
  "Half Back": {
    description: "Ball-playing defender. Win kickouts, protect possession, drive forward, win the ball back high.",
    key_metrics: {
      simple_pass:           { good: 10.0, label: "Simple passes per game",      higher_better: true  },
      advance_pass:          { good: 2.0,  label: "Advance passes per game",     higher_better: true  },
      carries:               { good: 1.5,  label: "Carries per game",            higher_better: true  },
      assists_shots:         { good: 2.0,  label: "Assists (3 scores) per game", higher_better: true  },
      tackles:               { good: 4.0,  label: "Tackles per game",            higher_better: true  },
      forced_to_win:         { good: 2.0,  label: "Forced TOs Won per game",     higher_better: true  },
      kickaway_to_received:  { good: 2.0,  label: "Kickaway TOs Won per game",   higher_better: true  },
      dne:                   { good: 0.2,  label: "DNE per game",                higher_better: false },
      breach_1v1:            { good: 0.2,  label: "Breach 1v1 per game",         higher_better: false },
      won_clean_p1_our:      { good: 2.0,  label: "Our KO Clean Wins per game",  higher_better: true  },
      won_break_our:         { good: 1.0,  label: "Our KO Breaks per game",      higher_better: true  },
      won_clean_p1_opp:      { good: 1.5,  label: "Opp KO Clean Wins per game",  higher_better: true  },
      won_break_opp:         { good: 1.0,  label: "Opp KO Breaks per game",      higher_better: true  },
      drop_shorts:           { good: 0.2,  label: "Drop Shorts per game",        higher_better: false },
      turnovers_in_contact:  { good: 0.2,  label: "TOs in Contact per game",     higher_better: false },
      turnovers_kicked_away: { good: 0.2,  label: "Kickaway TOs Lost per game",  higher_better: false },
      turnover_skill_error:  { good: 0.2,  label: "Skill Errors per game",       higher_better: false },
    }
  },
  "Full Back": {
    description: "Last line of defence. Win kickouts, protect the goal, force turnovers, give nothing away.",
    key_metrics: {
      simple_pass:           { good: 12.0, label: "Simple passes per game",      higher_better: true  },
      advance_pass:          { good: 1.0,  label: "Advance passes per game",     higher_better: true  },
      tackles:               { good: 4.0,  label: "Tackles per game",            higher_better: true  },
      forced_to_win:         { good: 2.0,  label: "Forced TOs Won per game",     higher_better: true  },
      kickaway_to_received:  { good: 2.0,  label: "Kickaway TOs Won per game",   higher_better: true  },
      dne:                   { good: 0.2,  label: "DNE per game",                higher_better: false },
      breach_1v1:            { good: 0.2,  label: "Breach 1v1 per game",         higher_better: false },
      won_clean_p1_our:      { good: 2.5,  label: "Our KO Clean Wins per game",  higher_better: true  },
      won_clean_p2_our:      { good: 1.0,  label: "Our KO P2 Wins per game",     higher_better: true  },
      won_break_our:         { good: 1.0,  label: "Our KO Breaks per game",      higher_better: true  },
      ko_target_lost_clean:  { good: 0.3,  label: "KO Target Lost Clean per game", higher_better: false },
      turnovers_in_contact:  { good: 0.2,  label: "TOs in Contact per game",     higher_better: false },
      turnovers_kicked_away: { good: 0.2,  label: "Kickaway TOs Lost per game",  higher_better: false },
      turnover_skill_error:  { good: 0.2,  label: "Skill Errors per game",       higher_better: false },
    }
  },
  "Goalkeeper": {
    description: "Shot stopper and kickout distributor. Accuracy and decision-making on restarts is critical.",
    key_metrics: {
      shots_saved:           { good: 1.0,  label: "Shots saved per game",        higher_better: true  },
      won_clean_p1_our:      { good: 3.0,  label: "Our KO P1 Won per game",      higher_better: true  },
      won_clean_p2_our:      { good: 1.0,  label: "Our KO P2 Won per game",      higher_better: true  },
      won_break_our:         { good: 1.0,  label: "Our KO Breaks per game",      higher_better: true  },
      ko_target_lost_clean:  { good: 0.3,  label: "KO Target Lost Clean per game", higher_better: false },
    }
  }
}

// Field name map for DB columns — add opp kickout fields
const FIELD_MAP = {
  one_pointer_attempts: 'one_pointer_attempts',
  two_pointer_attempts: 'two_pointer_attempts',
  pts: 'pts',
  drop_shorts: 'drop_shorts',
  one_pointer_drop_short_block: 'one_pointer_drop_short_block',
  two_pointer_drop_short_block: 'two_pointer_drop_short_block',
  goal_drop_short_block: 'goal_drop_short_block',
  duels_contested: 'duels_contested',
  defensive_duels_won: 'defensive_duels_won',
  tackles: 'tackles',
  forced_to_win: 'forced_to_win',
  kickaway_to_received: 'kickaway_to_received',
  turnovers_in_contact: 'turnovers_in_contact',
  turnovers_kicked_away: 'turnovers_kicked_away',
  turnover_skill_error: 'turnover_skill_error',
  dne: 'dne',
  breach_1v1: 'breach_1v1',
  shot_free_conceded: 'shot_free_conceded',
  simple_pass: 'simple_pass',
  advance_pass: 'advance_pass',
  carries: 'carries',
  assists_shots: 'assists_shots',
  won_clean_p1_our: 'won_clean_p1_our',
  won_clean_p2_our: 'won_clean_p2_our',
  won_clean_p3_our: 'won_clean_p3_our',
  won_break_our: 'won_break_our',
  won_clean_p1_opp: 'won_clean_p1_opp',
  won_clean_p2_opp: 'won_clean_p2_opp',
  won_break_opp: 'won_break_opp',
  shots_saved: 'shots_saved',
  ko_target_lost_clean: 'ko_target_lost_clean',
}


export default function PlayrIQEdge({ stats, player }) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)

  const role = player.role
  // Use dynamic benchmarks (from squad data) if available, fall back to static
  const dynamicBench = DYNAMIC_BENCHMARKS[role]
  const staticBench = ROLE_BENCHMARKS[role]
  const benchmarks = staticBench  // keep static for descriptions
  const activeBenchmarks = dynamicBench || staticBench?.key_metrics

  if (!role || !benchmarks) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)' }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>No role assigned</div>
        <div style={{ fontSize: 12 }}>Ask your coach to assign your playing role to unlock PlayrIQ Edge</div>
      </div>
    )
  }

  const mc = [...new Set(stats.map(r => r.match_id))].length || 1

  // Calculate player averages per game
  const playerAvgs = {}
  Object.keys(FIELD_MAP).forEach(metric => {
    const total = stats.reduce((s, r) => s + n(r[FIELD_MAP[metric]]), 0)
    playerAvgs[metric] = r1(total / mc)
  })

  // Shooting percentages — computed metrics not in FIELD_MAP
  const onePtAtt   = stats.reduce((s,r) => s + n(r.one_pointer_attempts), 0)
  const onePtScored = stats.reduce((s,r) => s + n(r.one_pointer_scored), 0)
  const twoPtAtt   = stats.reduce((s,r) => s + n(r.two_pointer_attempts), 0)
  const twoPtScored = stats.reduce((s,r) => s + n(r.two_pointer_scored), 0)
  playerAvgs.one_pointer_pct = onePtAtt > 0 ? Math.round((onePtScored / onePtAtt) * 100) : 0
  playerAvgs.two_pointer_pct = twoPtAtt > 0 ? Math.round((twoPtScored / twoPtAtt) * 100) : 0
  const totalAtt = onePtAtt + twoPtAtt + stats.reduce((s,r) => s + n(r.one_pointer_attempts_f) + n(r.two_pointer_attempts_f) + n(r.goal_attempts) + n(r.goal_attempts_f), 0)
  const totalScored = onePtScored + twoPtScored + stats.reduce((s,r) => s + n(r.one_pointer_scored_f) + n(r.two_pointer_scored_f) + n(r.goals_scored) + n(r.goals_scored_f), 0)
  playerAvgs.shoot_pct = pct(totalScored, totalAtt)

  // Match by match data for pattern detection
  const matchData = MATCHES.map(m => {
    const r = stats.find(s => s.match_id === m)
    if (!r) return null
    return { match: m, ...r }
  }).filter(Boolean)

  // Score each metric
  const metricScores = {}
  Object.entries(activeBenchmarks || {}).forEach(([metric, bench]) => {
    const avg = playerAvgs[metric] ?? 0
    let status, gap
    const lowerIsBetter = bench.lower_is_better !== undefined ? bench.lower_is_better : !bench.higher_better

    if (!lowerIsBetter) {
      // Higher is better — bench.good is target, bench.p90 is elite
      if (avg >= (bench.p90 || bench.good)) { status = 'strong'; gap = null }
      else if (avg >= bench.good) { status = 'ok'; gap = `${r1((bench.p90 || bench.good) - avg)} below elite` }
      else { status = 'work_on'; gap = `${r1(bench.good - avg)} below target` }
    } else {
      // Lower is better — bench.good is the realistic acceptable ceiling (not zero)
      const target = bench.good || bench.warning || 0.3
      if (avg === 0) { status = 'strong'; gap = null }
      else if (avg <= target) { status = 'strong'; gap = null }
      else if (avg <= target * 2) { status = 'ok'; gap = `${avg}/game — target \u22640.${String(Math.round(target*10))}` }
      else { status = 'work_on'; gap = `${avg}/game — target \u2264${target}` }
    }
    metricScores[metric] = { avg, status, gap, bench }
  })

  const strongAreas = Object.entries(metricScores).filter(([,v]) => v.status === 'strong')
  const workOnAreas = Object.entries(metricScores).filter(([,v]) => v.status === 'work_on')
  const okAreas = Object.entries(metricScores).filter(([,v]) => v.status === 'ok')

  const generateAnalysis = async () => {
    setLoading(true)
    setError(null)

    // Build pattern analysis for turnovers/dropshorts
    const turnoverPatterns = matchData.map(m => ({
      match: m.match,
      dropShorts: n(m.drop_shorts),
      oneDS: n(m.one_pointer_drop_short_block),
      twoDS: n(m.two_pointer_drop_short_block),
      goalDS: n(m.goal_drop_short_block),
      kickawayTO: n(m.turnovers_kicked_away),
      skillError: n(m.turnover_skill_error),
      contactTO: n(m.turnovers_in_contact),
    }))

    const prompt = `You are PlayrIQ Edge, an AI performance analyst for GAA football. Give a direct, honest performance analysis for a player. No fluff, no generic praise. Coaching language. Focus on patterns and specific actionable improvements.

PLAYER: ${player.name}
ROLE: ${role}
ROLE DESCRIPTION: ${benchmarks.description}
GAMES ANALYSED: ${mc} (${matchData.map(m=>m.match).join(', ')})

PERFORMANCE AVERAGES PER GAME:
${Object.entries(metricScores).map(([metric, data]) => 
  `${data.bench.label}: ${data.avg} [${data.status.toUpperCase()}${data.gap ? ' — ' + data.gap : ''}]`
).join('\n')}

MATCH-BY-MATCH TURNOVER/DROP SHORT PATTERNS:
${turnoverPatterns.map(m => 
  `${m.match}: Drop Shorts=${m.dropShorts} (1pt=${m.oneDS}, 2pt=${m.twoDS}, Goal=${m.goalDS}), Kickaway TOs=${m.kickawayTO}, Skill Errors=${m.skillError}, Contact TOs=${m.contactTO}`
).join('\n')}

SHOOTING ACCURACY: ${playerAvgs.shoot_pct}%

Write a performance analysis with these sections:
1. OVERALL ASSESSMENT (2-3 sentences, honest summary of where this player is at)
2. STRENGTHS (bullet points, specific to the numbers — mention actual figures)
3. WORK-ONS (bullet points, be direct and specific — if drop shorts are a pattern say exactly that and when it happened)
4. TARGETS FOR NEXT GAME (3 specific, measurable targets based on the gaps identified)

Keep it under 350 words. Be direct. This is a performance review not a pep talk.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await response.json()
      const text = data.content?.map(c => c.text || '').join('')
      setAnalysis(text)
    } catch(e) {
      setError('Analysis unavailable — please try again')
    }
    setLoading(false)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0a1628,#0d1f3c)', border: '1px solid #1a3356', borderRadius: 13, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--gold)', letterSpacing: 2 }}>PlayrIQ Edge</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 7px', borderRadius: 10, border: '1px solid var(--border)' }}>AI Performance Analysis</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
          <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{role}</span> · {mc} games analysed
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{benchmarks.description}</div>
      </div>

      {/* Quick scorecard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          ['Strong', strongAreas.length, 'var(--teal)'],
          ['On Track', okAreas.length, 'var(--gold)'],
          ['Work On', workOnAreas.length, 'var(--red)'],
        ].map(([label, count, color]) => (
          <div key={label} style={{ background: 'var(--bg2)', border: `1px solid ${color}20`, borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Metric breakdown */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 14 }}>
        <div className="card-header"><span style={{ color: 'var(--gold)' }}>Role Performance vs Benchmarks</span></div>
        {Object.entries(metricScores).map(([metric, data], i) => {
          const statusColor = data.status === 'strong' ? 'var(--teal)' : data.status === 'ok' ? 'var(--gold)' : 'var(--red)'
          const statusLabel = data.status === 'strong' ? '✓ Strong' : data.status === 'ok' ? '~ On Track' : '↑ Work On'
          const lowerIsBetter = data.bench.lower_is_better !== undefined ? data.bench.lower_is_better : !data.bench.higher_better
          const target = data.bench.good || 1
          const barPct = !lowerIsBetter
            ? Math.min(100, (data.avg / (data.bench.p90 || data.bench.good || 1)) * 100)
            : data.avg === 0 ? 100 : Math.max(0, 100 - (data.avg / (data.bench.good * 3 || 1)) * 100)
          return (
            <div key={metric} style={{ padding: '9px 14px', borderTop: i === 0 ? 'none' : '1px solid rgba(26,51,86,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{benchmarks?.key_metrics?.[metric]?.label || data.bench.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: statusColor }}>{statusLabel}</span>
                  <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, color: statusColor }}>
                    {metric.endsWith('_pct') ? data.avg + '%' : data.avg}
                  </span>
                </div>
              </div>
              <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, barPct)}%`, height: '100%', background: statusColor, borderRadius: 2, transition: 'width 0.5s' }} />
              </div>
              {(data.status === 'work_on' || data.status === 'ok') && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                  {lowerIsBetter ? `Target: ≤${data.bench.good} per game` : `Target: ${data.bench.good}+ per game`}
                  {data.gap && <span style={{ color: data.status === 'work_on' ? 'var(--red)' : 'var(--gold)', marginLeft: 6 }}>({data.gap})</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Turnover/DS pattern grid */}
      {matchData.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 14 }}>
          <div className="card-header"><span style={{ color: 'var(--red)' }}>Turnover & Drop Short Patterns</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 400 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1 }}>Metric</th>
                  {matchData.map(m => <th key={m.match} style={{ padding: '6px 8px', fontSize: 10, color: 'var(--text2)', textAlign: 'center', fontWeight: 700 }}>{m.match.replace('AFL ','G')}</th>)}
                  <th style={{ padding: '6px 8px', fontSize: 10, color: 'var(--text3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>Tot</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Drop Shorts Total', 'drop_shorts'],
                  ['1pt Drop Short', 'one_pointer_drop_short_block'],
                  ['2pt Drop Short', 'two_pointer_drop_short_block'],
                  ['Goal Drop Short', 'goal_drop_short_block'],
                  ['Kickaway TO', 'turnovers_kicked_away'],
                  ['Skill Error', 'turnover_skill_error'],
                  ['Contact TO', 'turnovers_in_contact'],
                ].map(([label, field], ri) => {
                  const vals = matchData.map(m => n(m[field]))
                  const total = vals.reduce((s,v) => s+v, 0)
                  if (total === 0) return null
                  return (
                    <tr key={field} style={{ background: ri % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderTop: '1px solid rgba(26,51,86,0.2)' }}>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text2)' }}>{label}</td>
                      {vals.map((v, j) => (
                        <td key={j} style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 700, color: v > 0 ? 'var(--red)' : 'var(--text3)' }}>{v > 0 ? v : '—'}</td>
                      ))}
                      <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: total > 0 ? 'var(--red)' : 'var(--text3)' }}>{total > 0 ? total : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Analysis button */}
      {!analysis ? (
        <button onClick={generateAnalysis} disabled={loading}
          style={{ width: '100%', padding: '14px', background: loading ? 'var(--bg3)' : 'linear-gradient(135deg,rgba(240,180,41,0.15),rgba(240,180,41,0.08))', border: `1px solid ${loading ? 'var(--border)' : 'var(--gold)'}`, borderRadius: 10, color: loading ? 'var(--text3)' : 'var(--gold)', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Barlow, sans-serif', letterSpacing: 1 }}>
          {loading ? 'Analysing...' : '⚡ Generate PlayrIQ Edge Analysis'}
        </button>
      ) : (
        <div>
          <div style={{ background: 'linear-gradient(135deg,#0d1f12,#0a1a10)', border: '1px solid #1a4a28', borderRadius: 13, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 16, fontWeight: 800, color: 'var(--teal)', letterSpacing: 1 }}>⚡ PlayrIQ Edge Analysis</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{analysis}</div>
          </div>
          <button onClick={() => setAnalysis(null)}
            style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Barlow, sans-serif' }}>
            Regenerate Analysis
          </button>
        </div>
      )}
      {error && <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>{error}</div>}
    </div>
  )
}
