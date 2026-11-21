-- File: supabase/migrations/20261125100000_sales_settings.sql
-- (NEW file)

-- Sales leaderboard settings:
--   leaderboardMinLeads: leads a rep needs to rank on Close % (default 20)
--   repsSeeLeaderboard:  sales reps can open the leaderboard from their login
alter table public.settings
  add column sales jsonb not null
  default '{"leaderboardMinLeads": 20, "repsSeeLeaderboard": false}'::jsonb;