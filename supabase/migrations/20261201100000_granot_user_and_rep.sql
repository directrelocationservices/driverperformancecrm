-- File: supabase/migrations/20261201100000_granot_user_and_rep.sql
-- (NEW file)
-- =========================================================
-- Granot sends two names on a lead:
--   user = the salesperson the lead is assigned to (leads, Close %)  → granot_rep / rep_id (as before)
--   rep  = the rep / book_by on the job                              → granot_book_rep / book_rep_id (new)
-- The new "User Update" event fills both when they change in Granot.
-- =========================================================
alter table public.leads
  add column granot_book_rep text,
  add column book_rep_id uuid references public.profiles(id);
create index leads_book_rep_idx on public.leads (book_rep_id) where book_rep_id is not null;