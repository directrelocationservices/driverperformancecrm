-- File: supabase/migrations/20261120100000_csv_import.sql
-- (NEW file)
-- =========================================================
-- 1. Imported leads carry a batch name, so one import can be removed
--    and run again without touching leads from the live webhook:
--      delete from public.leads where import_batch = 'granot-csv-2026';
-- 2. Test leads: only the whole word "test" counts now
--    ("Test", "test lead", "John Test"), not names like "Tester".
-- =========================================================

alter table public.leads add column import_batch text;
create index leads_import_batch_idx on public.leads (import_batch) where import_batch is not null;

alter table public.leads drop column is_test;
alter table public.leads
  add column is_test boolean generated always as (
    (coalesce(raw->>'first_name', '') || ' ' ||
     coalesce(raw->>'last_name', '') || ' ' ||
     coalesce(raw->>'name', '') || ' ' ||
     coalesce(granot_source, '')) ~* '\mtest\M'
  ) stored;