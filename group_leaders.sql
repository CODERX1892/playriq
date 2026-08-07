-- Group leaders get a per-match goals-vs-actual summary email for their group
-- (for the weekly AAR). Separate from the group's assigned coach.
alter table groups add column if not exists leader_name text;

-- leader_name matches a players.name OR an app_users.name; the email is resolved
-- at send time. If a group has no leader_name, the summary falls back to the
-- group's assigned coach (coach_id → app_users.email).
