-- File: supabase/migrations/20261123100000_carrier_role.sql
-- (NEW file)
-- New login role for partner carriers. Kept in its own file:
-- a new enum value can't be used in the same step that adds it.
alter type public.user_role add value if not exists 'carrier';