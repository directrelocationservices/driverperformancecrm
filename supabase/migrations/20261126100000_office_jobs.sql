-- File: supabase/migrations/20261126100000_office_jobs.sql
-- (NEW file)
-- =========================================================
-- Jobs entered by the office (admins) for a driver
--   * jobs.entered_by: the admin who logged it (null = the driver did)
--   * jobs.customer_name, jobs.delivery_date
--   * jobs.import_batch: past jobs loaded from a CSV (to undo an import)
--   * pre_damages.office_entered: photos the driver sent by text/email and
--     the office uploaded later (no device time, GPS or on-site signature)
--   * job_documents: photos and signed paperwork uploaded after the fact
--   * Evidence bucket now also takes PDFs (signed paperwork)
-- =========================================================

alter table public.jobs
  add column customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  add column delivery_date date,
  add column entered_by uuid references public.profiles(id),
  add column import_batch text;
create index jobs_entered_by_idx on public.jobs (driver_id) where entered_by is not null;

-- Drivers create jobs as themselves; admins' jobs are stamped "entered by"
create or replace function public.stamp_job_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.driver_id := auth.uid();
    if not (auth.uid() = any(new.crew_ids)) then
      new.crew_ids := array_prepend(auth.uid(), new.crew_ids);
    end if;
    new.entered_by := null;
    new.import_batch := null;
  elsif auth.uid() is not null then
    new.entered_by := auth.uid();
  end if;
  -- (service key, e.g. the past-jobs CSV import: entered_by is set by the script)
  new.created_at := now();
  return new;
end $$;

-- Drivers still can't change job details
create or replace function public.guard_job_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if (new.job_number, new.date, new.origin_city, new.origin_state, new.dest_city, new.dest_state,
      new.driver_id, new.crew_ids, new.delivered_by, new.created_at, new.carrier_id,
      new.customer_name, new.delivery_date, new.entered_by, new.import_batch)
     is distinct from
     (old.job_number, old.date, old.origin_city, old.origin_state, old.dest_city, old.dest_state,
      old.driver_id, old.crew_ids, old.delivered_by, old.created_at, old.carrier_id,
      old.customer_name, old.delivery_date, old.entered_by, old.import_batch) then
    raise exception 'Only an admin can change job details';
  end if;

  if old.on_time_pickup is not null and new.on_time_pickup is distinct from old.on_time_pickup then
    raise exception 'Pickup status is already recorded';
  end if;
  if old.on_time_delivery is not null and new.on_time_delivery is distinct from old.on_time_delivery then
    raise exception 'Delivery status is already recorded';
  end if;

  return new;
end $$;

-- New jobs go into the record history too ("Created by ...")
create trigger jobs_audit_insert after insert on public.jobs
  for each row execute function public.audit_row('job');

-- ---------- Pre-existing damage entered by the office ----------
alter table public.pre_damages
  add column office_entered boolean not null default false;
alter table public.pre_damages alter column signature_path drop not null;
alter table public.pre_damages alter column captured_at_device drop not null;
alter table public.pre_damages drop constraint if exists pre_damages_customer_shown_check;
-- On-site records still need the signature, device time and "customer shown"
alter table public.pre_damages add constraint pre_damages_onsite_check check (
  office_entered
  or (signature_path is not null and captured_at_device is not null and customer_shown)
);

create or replace function public.stamp_evidence_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.deleted_at := null;

  if tg_table_name = 'pre_damages' then
    new.received_at_server := now();   -- never trust the phone's clock
    new.locked := true;
    if not public.is_admin() then
      new.office_entered := false;     -- drivers always capture on site
    end if;
  else
    new.created_at := now();
  end if;

  if tg_table_name in ('reviews', 'upsells') and not public.is_admin() then
    new.verified := false;             -- only admins verify
  end if;

  return new;
end $$;

-- Locked pre-damage records: evidence can never change; text corrections need a reason
create or replace function public.guard_pre_damage_update()
returns trigger language plpgsql set search_path = public as $$
declare
  v_reason text := nullif(current_setting('app.change_reason', true), '');
begin
  if new.job_id is distinct from old.job_id
     or new.photo_paths is distinct from old.photo_paths
     or new.signature_path is distinct from old.signature_path
     or new.captured_at_device is distinct from old.captured_at_device
     or new.received_at_server is distinct from old.received_at_server
     or new.synced_offline is distinct from old.synced_offline
     or new.lat is distinct from old.lat
     or new.lng is distinct from old.lng
     or new.created_by is distinct from old.created_by
     or new.locked is distinct from old.locked
     or new.office_entered is distinct from old.office_entered then
    raise exception 'Evidence on a locked record cannot be changed';
  end if;

  if (new.item, new.location, new.description, new.notes, new.customer_name, new.customer_shown)
     is distinct from
     (old.item, old.location, old.description, old.notes, old.customer_name, old.customer_shown)
     and v_reason is null then
    raise exception 'A reason is required to correct this record';
  end if;

  if old.deleted_at is null and new.deleted_at is not null and v_reason is null then
    raise exception 'A reason is required to delete this record';
  end if;

  return new;
end $$;

-- ---------- Documents uploaded after the fact ----------
create table public.job_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  kind text not null check (kind in ('photo', 'paperwork', 'other')),
  path text not null,
  name text not null check (char_length(name) between 1 and 200),
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index job_documents_job_idx on public.job_documents (job_id, created_at);

create or replace function public.stamp_job_document()
returns trigger language plpgsql set search_path = public as $$
begin
  new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  new.created_at := now();
  new.deleted_at := null;
  return new;
end $$;
create trigger job_documents_stamp before insert on public.job_documents
  for each row execute function public.stamp_job_document();
create trigger job_documents_audit after insert or update on public.job_documents
  for each row execute function public.audit_row('document');

alter table public.job_documents enable row level security;
create policy job_documents_select on public.job_documents
  for select to authenticated
  using (public.is_admin() or (deleted_at is null and public.owns_job(job_id)));
create policy job_documents_insert on public.job_documents
  for insert to authenticated with check (public.is_admin());
create policy job_documents_update on public.job_documents
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Signed paperwork can be a PDF
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
 where id = 'evidence';