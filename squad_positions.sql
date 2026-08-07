-- Pre-game goal-setting: starter/sub + position on the matchday squad.
-- matchday_squad already exists (match_id, player_name, selected_by).
-- New columns default RLS-disabled, matching the app's anon read/write pattern.

alter table matchday_squad add column if not exists is_starter boolean not null default true;
alter table matchday_squad add column if not exists position    text;

-- is_starter = true  -> in the starting XV (gets the standard goal-setting email)
-- is_starter = false -> on the bench / a sub (gets the 60-min extrapolation email,
--                       and post-game goal targets are pro-rated to minutes played)
-- position          -> 'Goalkeeper' | 'Defender' | 'Midfield' | 'Forward'
--                       captured pre-game so it's ready for bonus-points scoring later.
