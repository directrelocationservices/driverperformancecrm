-- File: supabase/migrations/20261121100000_admin_damage.sql
-- (NEW file)
-- =========================================================
-- Admin damage reports
-- 1. Damage incidents get a date and a source (driver, customer call, claim,
--    inspection, other). Admins can add damage without photos.
-- 2. Every new damage incident goes into the audit history (who and when).
-- 3. Admins can correct a damage incident (reason goes into the history).
-- 4. Admin notes (with photos) on an existing damage incident.
-- =========================================================

alter table public.damage_incidents
  add column damage_date date,
  add column source text not null default 'driver'
    check (source in ('driver', 'customer_call', 'claim', 'inspection', 'other'));

-- Drivers still need at least 1 photo (checked in the app); admins can add 0
alter table public.damage_incidents drop constraint if exists damage_incidents_photo_paths_check;
alter table public.damage_incidents
  add constraint damage_incidents_photo_paths_check check (cardinality(photo_paths) <= 5);

-- "Created by ... at ..." in the record history
create trigger damage_incidents_audit_insert after insert on public.damage_incidents
  for each row execute function public.audit_row('damage');

-- Admin correction; the reason goes into the audit log
create or replace function public.admin_correct_damage(
  p_id uuid,
  p_item text,
  p_description text,
  p_damage_date date,
  p_source text,
  p_claim_filed boolean,
  p_estimated_cost numeric,
  p_reason text
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_job uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'A reason is required'; end if;

  perform set_config('app.change_reason', trim(p_reason), true);

  update public.damage_incidents
     set item = p_item,
         description = p_description,
         damage_date = p_damage_date,
         source = p_source,
         claim_filed = p_claim_filed,
         estimated_cost = p_estimated_cost
   where id = p_id
  returning job_id into v_job;

  if v_job is null then raise exception 'Record not found'; end if;
  return v_job;
end $$;

grant execute on function public.admin_correct_damage(uuid, text, text, date, text, boolean, numeric, text) to authenticated;

-- Admin notes on a damage incident (can't be edited or removed)
create table public.damage_notes (
  id uuid primary key default gen_random_uuid(),
  damage_id uuid not null references public.damage_incidents(id),
  job_id uuid not null references public.jobs(id),
  note text not null check (char_length(note) between 1 and 2000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 5),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index damage_notes_damage_idx on public.damage_notes (damage_id, created_at);

create or replace function public.stamp_damage_note()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  new.job_id := (select job_id from public.damage_incidents where id = new.damage_id);
  return new;
end $$;

create trigger damage_notes_stamp before insert on public.damage_notes
  for each row execute function public.stamp_damage_note();

alter table public.damage_notes enable row level security;
create policy damage_notes_select on public.damage_notes
  for select to authenticated using (public.is_admin());
create policy damage_notes_insert on public.damage_notes
  for insert to authenticated with check (public.is_admin());