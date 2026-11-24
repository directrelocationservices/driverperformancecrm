-- File: supabase/migrations/20261129100000_roadside_readiness.sql
-- (NEW file)
-- =========================================================
-- Roadside Inspection Readiness
-- 1. Truck and driver documents (with expiry dates)
-- 2. Expiry alert log (30 days, 7 days, day of expiry)
-- 3. Daily pre-trip checklist editable in Settings (9 items by default)
--    "No" on a blocking item holds the trip until an admin clears it
-- 4. Monthly truck check (3 items, one photo each)
-- 5. Pre-trip "No" answers count toward the driver score
-- =========================================================

-- ---------- 1. Documents ----------
create table public.fleet_documents (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid references public.trucks(id),
  driver_id uuid references public.profiles(id),
  doc_type text not null check (doc_type in (
    'registration', 'insurance', 'annual_inspection',
    'eld_manual', 'eld_officer', 'eld_malfunction', 'other',
    'medical_card', 'license'
  )),
  title text check (title is null or char_length(title) between 1 and 120),
  file_paths text[] not null check (cardinality(file_paths) between 1 and 2),
  file_names text[] not null default '{}',
  expires_on date,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  -- belongs to a truck or a driver, never both
  constraint fleet_documents_owner_check check ((truck_id is null) <> (driver_id is null)),
  constraint fleet_documents_type_check check (
    (driver_id is not null and doc_type in ('medical_card', 'license'))
    or (truck_id is not null and doc_type not in ('medical_card', 'license'))
  ),
  -- driver documents: front and back photo
  constraint fleet_documents_sides_check check (driver_id is null or cardinality(file_paths) = 2),
  constraint fleet_documents_expiry_check check (
    doc_type not in ('medical_card', 'license', 'registration', 'insurance', 'annual_inspection')
    or expires_on is not null
  ),
  constraint fleet_documents_other_title_check check (doc_type <> 'other' or title is not null)
);
create index fleet_documents_truck_idx on public.fleet_documents (truck_id, doc_type, created_at desc)
  where truck_id is not null;
create index fleet_documents_driver_idx on public.fleet_documents (driver_id, doc_type, created_at desc)
  where driver_id is not null;

create or replace function public.stamp_fleet_document()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
    new.created_at := now();
    new.deleted_at := null;
    new.deleted_by := null;
  else
    -- Only "deleted" can change (a new upload replaces a document)
    if (new.truck_id, new.driver_id, new.doc_type, new.title, new.file_paths, new.file_names,
        new.expires_on, new.uploaded_by, new.created_at)
       is distinct from
       (old.truck_id, old.driver_id, old.doc_type, old.title, old.file_paths, old.file_names,
        old.expires_on, old.uploaded_by, old.created_at) then
      raise exception 'Documents can''t be changed. Upload a new one instead.';
    end if;
    new.deleted_by := case when new.deleted_at is null then null else auth.uid() end;
  end if;
  return new;
end $$;
create trigger fleet_documents_stamp before insert or update on public.fleet_documents
  for each row execute function public.stamp_fleet_document();

alter table public.fleet_documents enable row level security;

-- Admins see everything. Drivers see their own documents and every truck's documents.
create policy fleet_documents_select on public.fleet_documents
  for select to authenticated
  using (
    public.is_admin()
    or (deleted_at is null and (
      driver_id = auth.uid()
      or (truck_id is not null and public.app_role() = 'driver')
    ))
  );
-- Admins upload for trucks and drivers. Drivers upload their own medical card and license.
create policy fleet_documents_insert on public.fleet_documents
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.app_role() = 'driver' and driver_id = auth.uid())
  );
create policy fleet_documents_admin_update on public.fleet_documents
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- 2. Expiry alerts sent (server only, no policies) ----------
create table public.doc_expiry_alerts (
  document_id uuid not null references public.fleet_documents(id) on delete cascade,
  stage text not null check (stage in ('30', '7', '0')),
  sent_at timestamptz not null default now(),
  primary key (document_id, stage)
);
alter table public.doc_expiry_alerts enable row level security;

-- ---------- 3. Daily pre-trip checklist ----------
-- Each item: key, label, hint, blocksTrip ("No" holds the trip until an admin clears it),
-- ticket ("No" opens a maintenance ticket), scored ("No" counts against the driver)
alter table public.settings
  add column pre_trip_items jsonb not null default '[
    {"key":"logs","label":"Logs current, plus 8 days of blank paper log sheets","hint":"Logs are up to date and 8 days of blank paper log sheets are in the truck","blocksTrip":true,"ticket":false,"scored":true},
    {"key":"safety_kit","label":"Fire extinguisher charged and mounted, plus 3 warning triangles","hint":"Gauge in the green, mounted, and 3 triangles in the truck","blocksTrip":true,"ticket":false,"scored":true},
    {"key":"shipping_papers","label":"Bill of lading and inventory for every shipment","hint":"And weight tickets when needed","blocksTrip":false,"ticket":false,"scored":true},
    {"key":"brake_leaks","label":"Brakes: no leaks","hint":"No air or fluid leaks","blocksTrip":false,"ticket":true,"scored":false},
    {"key":"all_lights","label":"All lights working","hint":"Head, tail, brake, turn signals and markers","blocksTrip":false,"ticket":true,"scored":false},
    {"key":"tires_wheels","label":"Tires and wheels","hint":"Good tread, no damage, no loose or missing lug nuts","blocksTrip":false,"ticket":true,"scored":false},
    {"key":"cab_glass","label":"Windshield, wipers, mirrors, horn, seatbelt","hint":"No cracks, everything works","blocksTrip":false,"ticket":true,"scored":false},
    {"key":"fuel_leaks","label":"No fuel, oil or exhaust leaks","hint":"Under the truck and around the engine","blocksTrip":false,"ticket":true,"scored":false},
    {"key":"load_doors","label":"Load secured, and doors latching","hint":"Straps and load bars in place, every door latches","blocksTrip":false,"ticket":false,"scored":true}
  ]'::jsonb
  check (jsonb_typeof(pre_trip_items) = 'array' and jsonb_array_length(pre_trip_items) between 1 and 30);

create or replace function public.get_pre_trip_items()
returns jsonb
language sql stable security definer set search_path = public as $$
  select pre_trip_items from public.settings where id = 1
$$;
revoke execute on function public.get_pre_trip_items() from public, anon;
grant execute on function public.get_pre_trip_items() to authenticated;

-- Any number of items now (old pre-trips keep their 6)
alter table public.pre_trips drop constraint if exists pre_trips_items_check;
alter table public.pre_trips add constraint pre_trips_items_check
  check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30);

-- Trip hold: "No" on a blocking item. Only an admin can clear it.
alter table public.pre_trips
  add column blocked boolean not null default false,
  add column cleared_at timestamptz,
  add column cleared_by uuid references public.profiles(id),
  add column clear_note text check (clear_note is null or char_length(clear_note) <= 500);
create index pre_trips_open_hold_idx on public.pre_trips (driver_id, truck_id)
  where blocked and cleared_at is null;

alter table public.maintenance_tickets add column item_label text;

-- Server-controlled fields on a new pre-trip. Item names and rules come from Settings,
-- so the phone can't change what blocks the trip or counts toward the score.
create or replace function public.stamp_pre_trip_insert()
returns trigger language plpgsql set search_path = public as $$
declare
  v_rules jsonb := coalesce(public.get_pre_trip_items(), '[]'::jsonb);  -- drivers can't read settings
begin
  if auth.uid() is not null and not public.is_admin() then
    new.driver_id := auth.uid();
  end if;
  new.received_at_server := now();   -- never trust the phone's clock

  select coalesce(jsonb_agg(
           case
             when r.rule is not null then
               (i.item - 'blocks' - 'ticket' - 'scored' - 'label') || jsonb_build_object(
                 'label', r.rule->>'label',
                 'blocks', coalesce((r.rule->>'blocksTrip')::boolean, false),
                 'ticket', coalesce((r.rule->>'ticket')::boolean, true),
                 'scored', coalesce((r.rule->>'scored')::boolean, false))
             else i.item - 'blocks' - 'scored'
           end
           order by i.ord), '[]'::jsonb)
    into new.items
    from jsonb_array_elements(new.items) with ordinality as i(item, ord)
    left join lateral (
      select x as rule from jsonb_array_elements(v_rules) x
       where x->>'key' = i.item->>'key' limit 1
    ) r on true;

  new.blocked := exists (
    select 1 from jsonb_array_elements(new.items) e
     where e->>'status' = 'attention' and coalesce((e->>'blocks')::boolean, false)
  );
  new.cleared_at := null;
  new.cleared_by := null;
  new.clear_note := null;
  return new;
end $$;

-- After a pre-trip: open a ticket per flagged item (only items that make tickets),
-- update the truck, and log the wash when the driver answered "Yes"
create or replace function public.after_pre_trip_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_flagged boolean := false;
  v_severity public.truck_status :=
    case when new.truck_status = 'safe' then 'repair_soon'::public.truck_status else new.truck_status end;
begin
  for v_item in select * from jsonb_array_elements(new.items) loop
    if v_item->>'status' = 'attention' and coalesce((v_item->>'ticket')::boolean, true) then
      v_flagged := true;
      insert into public.maintenance_tickets
        (truck_id, inspection_id, driver_id, item_key, item_label, notes, photo_paths, severity)
      values (
        new.truck_id,
        new.id,
        new.driver_id,
        v_item->>'key',
        v_item->>'label',
        nullif(v_item->>'notes', ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_item->'photos', '[]'::jsonb))), '{}'),
        v_severity
      );
    end if;
  end loop;

  -- Marked "Repair soon" / "Do not drive" without a ticket item
  if not v_flagged and new.truck_status <> 'safe' then
    insert into public.maintenance_tickets
      (truck_id, inspection_id, driver_id, item_key, notes, severity)
    values (new.truck_id, new.id, new.driver_id, 'general', nullif(trim(coalesce(new.notes, '')), ''), new.truck_status);
  end if;

  update public.trucks
     set status = new.truck_status,
         odometer = greatest(coalesce(odometer, 0), new.odometer),
         last_inspection_at = new.received_at_server
   where id = new.truck_id;

  if new.washed then
    insert into public.truck_washes
      (truck_id, driver_id, photo_path, receipt_path, captured_at_device,
       synced_offline, lat, lng, pre_trip_id)
    values
      (new.truck_id, new.driver_id, new.wash_photo_path, new.wash_receipt_path, new.captured_at_device,
       new.synced_offline, new.lat, new.lng, new.id);
  end if;

  return new;
end $$;

-- Admin clears a trip hold (the driver fixed it, e.g. got the log sheets)
create or replace function public.admin_clear_pre_trip_hold(p_id uuid, p_note text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if coalesce(char_length(trim(p_note)), 0) < 3 then raise exception 'Add a short note'; end if;
  update public.pre_trips
     set cleared_at = now(),
         cleared_by = auth.uid(),
         clear_note = left(trim(p_note), 500)
   where id = p_id and blocked and cleared_at is null
  returning id into v_id;
  if v_id is null then raise exception 'Record not found'; end if;
  return v_id;
end $$;
revoke execute on function public.admin_clear_pre_trip_hold(uuid, text) from public, anon;
grant execute on function public.admin_clear_pre_trip_hold(uuid, text) to authenticated;

-- ---------- 4. Monthly truck check ----------
-- items = [{ "key", "label", "status": "ok" | "attention", "notes", "photo": "path" }, ...]
create table public.truck_monthly_checks (
  id uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks(id),
  driver_id uuid not null references public.profiles(id),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 10),
  notes text check (notes is null or char_length(notes) <= 1000),
  captured_at_device timestamptz not null,
  received_at_server timestamptz not null default now(),
  lat double precision,
  lng double precision
);
create index truck_monthly_checks_truck_idx on public.truck_monthly_checks (truck_id, received_at_server desc);
create index truck_monthly_checks_driver_idx on public.truck_monthly_checks (driver_id, received_at_server desc);

create or replace function public.stamp_monthly_check()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.driver_id := auth.uid();
  end if;
  new.received_at_server := now();
  return new;
end $$;
create trigger truck_monthly_checks_stamp before insert on public.truck_monthly_checks
  for each row execute function public.stamp_monthly_check();

alter table public.truck_monthly_checks enable row level security;
-- Drivers see every truck's checks (to know when one is due); locked once saved
create policy truck_monthly_checks_select on public.truck_monthly_checks
  for select to authenticated using (public.is_admin() or public.app_role() = 'driver');
create policy truck_monthly_checks_insert on public.truck_monthly_checks
  for insert to authenticated
  with check (public.app_role() = 'driver' and driver_id = auth.uid());

-- ---------- 5. Scoring: points for each pre-trip "No" on a scored item ----------
alter table public.settings
  alter column scoring
  set default '{"baseScore":100,"clean":5,"violations":-10,"outOfService":-25,"washIntervalDays":14,"overdueWash":-5,"preTripNo":-2}';
update public.settings set scoring = '{"preTripNo":-2}'::jsonb || scoring;

-- ---------- Storage: docs/<user_id>/... and monthly/<user_id>/... in the fleet bucket ----------
drop policy if exists fleet_upload on storage.objects;
create policy fleet_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fleet'
    and (storage.foldername(name))[1] in ('pre_trip', 'roadside', 'wash', 'docs', 'monthly')
    and (public.is_admin() or (storage.foldername(name))[2] = auth.uid()::text)
  );

drop policy if exists fleet_read on storage.objects;
create policy fleet_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fleet'
    and (
      public.is_admin()
      or (storage.foldername(name))[2] = auth.uid()::text
      -- a report an admin uploaded for this driver
      or exists (
        select 1 from public.roadside_inspections r
        where r.report_path = name and r.driver_id = auth.uid()
      )
      -- truck documents (any driver) and the driver's own documents uploaded by an admin
      or exists (
        select 1 from public.fleet_documents d
        where name = any (d.file_paths)
          and d.deleted_at is null
          and (d.driver_id = auth.uid() or (d.truck_id is not null and public.app_role() = 'driver'))
      )
    )
  );