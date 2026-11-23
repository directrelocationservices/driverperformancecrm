-- File: supabase/migrations/20261127100000_offloads.sql
-- (NEW file)
-- =========================================================
-- Offloads: where a driver offloaded a job's goods
--   * photos (2+), GPS, address, server time (same rules as pre-existing damage)
--   * where: customer / warehouse / storage unit / partner carrier / other
--   * paperwork: one slot per required form, each with pages (photos or PDFs)
--   * locked once submitted; admin corrections need a reason and are logged
-- offload_forms: the list of forms, edited in Admin -> Settings
-- =========================================================

-- ---------- Forms list ----------
create table public.offload_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  required boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.offload_forms enable row level security;
create policy offload_forms_select on public.offload_forms
  for select to authenticated using (true);
create policy offload_forms_admin_write on public.offload_forms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.offload_forms (name, required, sort) values
  ('Bill of Lading', false, 1),
  ('Inventory list', false, 2),
  ('Delivery receipt', false, 3);

-- Who gets the offload alert email (empty = the damage alert emails)
alter table public.settings
  add column offload_alert_emails text[] not null default '{}';

-- ---------- Offloads ----------
create table public.offloads (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  destination text not null
    check (destination in ('customer', 'warehouse', 'storage', 'carrier', 'other')),
  storage_facility text check (storage_facility is null or char_length(storage_facility) <= 120),
  storage_address text check (storage_address is null or char_length(storage_address) <= 200),
  storage_unit text check (storage_unit is null or char_length(storage_unit) <= 40),
  carrier_id uuid references public.carriers(id),
  note text check (note is null or char_length(note) <= 1000),
  photo_paths text[] not null check (cardinality(photo_paths) between 2 and 20),
  -- [{ "formId": "...", "name": "Bill of Lading", "required": true, "pages": ["path", ...] }]
  forms jsonb not null default '[]'::jsonb,
  lat double precision,
  lng double precision,
  accuracy integer,
  address text,                       -- looked up from the GPS on the server
  captured_at_device timestamptz not null,
  received_at_server timestamptz not null default now(),
  synced_offline boolean not null default false,
  locked boolean not null default true,
  created_by uuid references public.profiles(id) default auth.uid(),
  deleted_at timestamptz,
  check (destination <> 'storage' or (storage_facility is not null and storage_address is not null and storage_unit is not null)),
  check (destination <> 'carrier' or carrier_id is not null),
  check (destination <> 'other' or note is not null)
);
create index offloads_job_idx on public.offloads (job_id, received_at_server);
create index offloads_recent_idx on public.offloads (received_at_server desc);

create or replace function public.stamp_offload()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.received_at_server := now();   -- never trust the phone's clock
  new.locked := true;
  new.deleted_at := null;
  new.address := null;               -- filled in by the server from the GPS
  return new;
end $$;
create trigger offloads_stamp before insert on public.offloads
  for each row execute function public.stamp_offload();

-- Locked: evidence never changes; corrections need a reason
create or replace function public.guard_offload_update()
returns trigger language plpgsql set search_path = public as $$
declare
  v_reason text := nullif(current_setting('app.change_reason', true), '');
begin
  if new.job_id is distinct from old.job_id
     or new.photo_paths is distinct from old.photo_paths
     or new.captured_at_device is distinct from old.captured_at_device
     or new.received_at_server is distinct from old.received_at_server
     or new.synced_offline is distinct from old.synced_offline
     or new.lat is distinct from old.lat
     or new.lng is distinct from old.lng
     or new.accuracy is distinct from old.accuracy
     or new.created_by is distinct from old.created_by
     or new.locked is distinct from old.locked then
    raise exception 'Evidence on a locked record cannot be changed';
  end if;

  -- The server fills in the address once (service key, no user)
  if new.address is distinct from old.address
     and not (auth.uid() is null and old.address is null) then
    raise exception 'Evidence on a locked record cannot be changed';
  end if;

  if (new.destination, new.storage_facility, new.storage_address, new.storage_unit,
      new.carrier_id, new.note, new.forms)
     is distinct from
     (old.destination, old.storage_facility, old.storage_address, old.storage_unit,
      old.carrier_id, old.note, old.forms)
     and v_reason is null then
    raise exception 'A reason is required to correct this record';
  end if;

  if old.deleted_at is null and new.deleted_at is not null and v_reason is null then
    raise exception 'A reason is required to delete this record';
  end if;

  return new;
end $$;
create trigger offloads_guard before update on public.offloads
  for each row execute function public.guard_offload_update();

create trigger offloads_audit_insert after insert on public.offloads
  for each row execute function public.audit_row('offload');
-- (the server filling in the address isn't a change worth logging)
create trigger offloads_audit_update after update on public.offloads
  for each row when (old.address is not distinct from new.address)
  execute function public.audit_row('offload');

alter table public.offloads enable row level security;
create policy offloads_select on public.offloads
  for select to authenticated
  using (public.is_admin() or (deleted_at is null and public.owns_job(job_id)));
create policy offloads_insert on public.offloads
  for insert to authenticated
  with check (public.is_admin() or (public.app_role() = 'driver' and public.owns_job(job_id)));
create policy offloads_update on public.offloads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Admin functions (the reason goes into the history) ----------
create or replace function public.admin_correct_offload(
  p_id uuid,
  p_destination text,
  p_storage_facility text,
  p_storage_address text,
  p_storage_unit text,
  p_carrier_id uuid,
  p_note text,
  p_forms jsonb,
  p_reason text
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_job uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if coalesce(char_length(trim(p_reason)), 0) < 3 then raise exception 'A reason is required'; end if;

  perform set_config('app.change_reason', trim(p_reason), true);

  update public.offloads
     set destination = p_destination,
         storage_facility = nullif(trim(coalesce(p_storage_facility, '')), ''),
         storage_address = nullif(trim(coalesce(p_storage_address, '')), ''),
         storage_unit = nullif(trim(coalesce(p_storage_unit, '')), ''),
         carrier_id = p_carrier_id,
         note = nullif(trim(coalesce(p_note, '')), ''),
         forms = coalesce(p_forms, forms)
   where id = p_id
  returning job_id into v_job;

  if v_job is null then raise exception 'Record not found'; end if;
  return v_job;
end $$;

create or replace function public.admin_set_offload_deleted(
  p_id uuid,
  p_deleted boolean,
  p_reason text default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_job uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_deleted and coalesce(char_length(trim(p_reason)), 0) < 3 then
    raise exception 'A reason is required';
  end if;
  perform set_config('app.change_reason', coalesce(trim(p_reason), ''), true);

  update public.offloads
     set deleted_at = case when p_deleted then now() else null end
   where id = p_id
  returning job_id into v_job;

  if v_job is null then raise exception 'Record not found'; end if;
  return v_job;
end $$;

grant execute on function public.admin_correct_offload(uuid, text, text, text, text, uuid, text, jsonb, text) to authenticated;
grant execute on function public.admin_set_offload_deleted(uuid, boolean, text) to authenticated;

-- Drivers can't read the carriers table (insurance etc.), only names to pick from
create or replace function public.carrier_choices()
returns table (id uuid, company_name text, active boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.company_name, c.active
    from public.carriers c
   where auth.uid() is not null
   order by c.company_name
$$;
grant execute on function public.carrier_choices() to authenticated;