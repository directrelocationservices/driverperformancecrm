-- File: supabase/migrations/20261119100000_must_change_password.sql
-- (NEW file)
-- =========================================================
-- Every user must change their password the first time they log in.
-- New accounts start with must_change_password = true. It turns off when
-- the user sets their own password, and turns on again when an admin
-- sets a new password for them.
-- =========================================================

alter table public.profiles
  add column must_change_password boolean not null default true;

-- The insurance review login keeps working exactly as before
update public.profiles
   set must_change_password = false
 where lower(email) = 'admin@gmail.com';