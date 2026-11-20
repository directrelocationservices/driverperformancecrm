-- File: supabase/migrations/20261123100100_carrier_claims.sql
-- (NEW file)
-- =========================================================
-- Carriers part B + D
--   * jobs.carrier_id: which carrier delivered a "Partner" job
--   * carrier_claims: damage on partner deliveries, with claim / paid /
--     charged-back amounts and a status (open, submitted, paid, closed)
--   * carrier_claim_notes: comments + documents on a claim
--     (internal notes are only for admins)
--   * Carrier login: profiles.carrier_id + role 'carrier'. A carrier sees
--     only its own company, its own claims and the jobs on those claims.
-- Files: "carriers" bucket, claims/<claim_id>/<file>
-- =========================================================

-- ---------- Jobs: which carrier delivered it ----------
alter table public.jobs add column carrier_id uuid references public.carriers(id);
create index jobs_carrier_idx on public.jobs (carrier_id) where carrier_id is not null;

-- Drivers still can't change job details (now including the carrier)
create or replace function public.guard_job_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if (new.job_number, new.date, new.origin_city, new.origin_state, new.dest_city, new.dest_state,
      new.driver_id, new.crew_ids, new.delivered_by, new.created_at, new.carrier_id)
     is distinct from
     (old.job_number, old.date, old.origin_city, old.origin_state, old.dest_city, old.dest_state,
      old.driver_id, old.crew_ids, old.delivered_by, old.created_at, old.carrier_id) then
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

-- ---------- Carrier logins ----------
alter table public.profiles add column carrier_id uuid references public.carriers(id);

create or replace function public.my_carrier_id()
returns uuid language sql stable security definer set search_path = public as $$
  select carrier_id from public.profiles
   where id = auth.uid() and role = 'carrier' and active
$$;
grant execute on function public.my_carrier_id() to authenticated;

-- ---------- Claims ----------
create table public.carrier_claims (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers(id),
  job_id uuid not null references public.jobs(id),
  item text not null check (char_length(item) between 1 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 10),
  claim_amount numeric(12, 2) not null default 0 check (claim_amount >= 0),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  charged_back_amount numeric(12, 2) not null default 0 check (charged_back_amount >= 0),
  status text not null default 'open'
    check (status in ('open', 'submitted', 'paid', 'closed')),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index carrier_claims_carrier_idx on public.carrier_claims (carrier_id, created_at desc);
create index carrier_claims_job_idx on public.carrier_claims (job_id);

create trigger carrier_claims_updated_at before update on public.carrier_claims
  for each row execute function public.set_updated_at();
create trigger carrier_claims_audit after insert or update on public.carrier_claims
  for each row execute function public.audit_row('carrier_claim');

create table public.carrier_claim_notes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.carrier_claims(id),
  note text not null check (char_length(note) between 1 and 4000),
  file_paths text[] not null default '{}' check (cardinality(file_paths) <= 5),
  file_names text[] not null default '{}',
  internal boolean not null default false,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index carrier_claim_notes_claim_idx on public.carrier_claim_notes (claim_id, created_at);

create or replace function public.stamp_claim_note()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.created_at := now();
  if not public.is_admin() then
    new.internal := false;   -- only admins write internal notes
  end if;
  return new;
end $$;

create trigger carrier_claim_notes_stamp before insert on public.carrier_claim_notes
  for each row execute function public.stamp_claim_note();

-- ---------- Row security ----------
alter table public.carrier_claims enable row level security;
alter table public.carrier_claim_notes enable row level security;

create policy carrier_claims_admin_all on public.carrier_claims
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy carrier_claims_carrier_select on public.carrier_claims
  for select to authenticated
  using (deleted_at is null and carrier_id = public.my_carrier_id());

create policy claim_notes_admin_select on public.carrier_claim_notes
  for select to authenticated using (public.is_admin());
create policy claim_notes_admin_insert on public.carrier_claim_notes
  for insert to authenticated with check (public.is_admin());
create policy claim_notes_carrier_select on public.carrier_claim_notes
  for select to authenticated
  using (
    not internal
    and exists (
      select 1 from public.carrier_claims c
       where c.id = claim_id and c.deleted_at is null
         and c.carrier_id = public.my_carrier_id()
    )
  );
create policy claim_notes_carrier_insert on public.carrier_claim_notes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.carrier_claims c
       where c.id = claim_id and c.deleted_at is null
         and c.carrier_id = public.my_carrier_id()
    )
  );

-- A carrier sees its own company profile ...
create policy carriers_carrier_select on public.carriers
  for select to authenticated using (id = public.my_carrier_id());

-- ... and only the jobs that have one of its claims
create policy jobs_carrier_select on public.jobs
  for select to authenticated
  using (
    exists (
      select 1 from public.carrier_claims c
       where c.job_id = jobs.id and c.deleted_at is null
         and c.carrier_id = public.my_carrier_id()
    )
  );

-- Carriers upload documents to their own claims: claims/<claim_id>/<file>
create policy carriers_files_carrier_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'carriers'
    and (storage.foldername(name))[1] = 'claims'
    and exists (
      select 1 from public.carrier_claims c
       where c.id::text = (storage.foldername(name))[2]
         and c.deleted_at is null
         and c.carrier_id = public.my_carrier_id()
    )
  );

-- Carriers are outside the company: they see only their own profile, not staff
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.app_role() is distinct from 'carrier');