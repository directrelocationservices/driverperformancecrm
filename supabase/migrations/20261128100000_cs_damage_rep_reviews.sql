-- File: supabase/migrations/20261128100000_cs_damage_rep_reviews.sql
-- (NEW file)
-- =========================================================
-- 1. Damage reported by customer service (admins), after the fact
--    * reported_on / reported_by: when and who took the report
--    * attributed_to: pickup crew, delivery crew or a partner carrier
--      (driver-logged damage keeps attributed_to = null and counts as before)
--    * up to 10 photos
-- 2. Reviews attributed to sales reps (and / or the driver)
--    * rep_id, counts_for_driver, reason, review_date
--    * admins can add a review themselves (link / screenshot optional)
-- Admin-only: drivers can't set any of these.
-- =========================================================

-- ---------- 1. Damage ----------
alter table public.damage_incidents
  add column reported_on date,
  add column reported_by uuid references public.profiles(id),
  add column attributed_to text check (attributed_to in ('pickup', 'delivery', 'carrier')),
  add column attributed_driver_id uuid references public.profiles(id),
  add column carrier_id uuid references public.carriers(id),
  add constraint damage_attribution_check check (
    attributed_to is null
    or (attributed_to = 'carrier' and carrier_id is not null)
    or (attributed_to in ('pickup', 'delivery') and attributed_driver_id is not null)
  );
create index damage_incidents_attributed_driver_idx
  on public.damage_incidents (attributed_driver_id) where attributed_driver_id is not null;
create index damage_incidents_carrier_idx
  on public.damage_incidents (carrier_id) where carrier_id is not null;

alter table public.damage_incidents drop constraint if exists damage_incidents_photo_paths_check;
alter table public.damage_incidents
  add constraint damage_incidents_photo_paths_check check (cardinality(photo_paths) <= 10);

-- Only admins report damage for customer service
create or replace function public.stamp_damage_attribution()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.reported_on := null;
    new.reported_by := null;
    new.attributed_to := null;
    new.attributed_driver_id := null;
    new.carrier_id := null;
  elsif new.attributed_to is not null then
    new.reported_by := coalesce(new.reported_by, auth.uid());
    new.reported_on := coalesce(new.reported_on, (now() at time zone 'America/New_York')::date);
  end if;
  return new;
end $$;
create trigger damage_incidents_attribution before insert on public.damage_incidents
  for each row execute function public.stamp_damage_attribution();

-- Correct a damage incident, including who it is attributed to
drop function if exists public.admin_correct_damage(uuid, text, text, date, text, boolean, numeric, text);
create or replace function public.admin_correct_damage(
  p_id uuid,
  p_item text,
  p_description text,
  p_damage_date date,
  p_source text,
  p_claim_filed boolean,
  p_estimated_cost numeric,
  p_reason text,
  p_attributed_to text default null,
  p_attributed_driver_id uuid default null,
  p_carrier_id uuid default null,
  p_reported_on date default null,
  p_reported_by uuid default null,
  p_keep_attribution boolean default true
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

  if not p_keep_attribution then
    update public.damage_incidents
       set attributed_to = p_attributed_to,
           attributed_driver_id = case when p_attributed_to in ('pickup', 'delivery') then p_attributed_driver_id end,
           carrier_id = case when p_attributed_to = 'carrier' then p_carrier_id end,
           reported_on = coalesce(p_reported_on, reported_on),
           reported_by = coalesce(p_reported_by, reported_by)
     where id = p_id;
  end if;

  return v_job;
end $$;
grant execute on function public.admin_correct_damage(uuid, text, text, date, text, boolean, numeric, text, text, uuid, uuid, date, uuid, boolean) to authenticated;

-- ---------- 2. Reviews ----------
alter table public.reviews
  add column rep_id uuid references public.profiles(id),
  add column counts_for_driver boolean not null default true,
  add column reason text check (reason is null or char_length(reason) <= 300),
  add column review_date date,
  add column added_by_admin boolean not null default false,
  add constraint reviews_counts_for_someone check (counts_for_driver or rep_id is not null);
create index reviews_rep_idx on public.reviews (rep_id) where rep_id is not null;

-- Admins can add a review without a link or screenshot (e.g. read out on a call)
alter table public.reviews drop constraint if exists reviews_check;
alter table public.reviews add constraint reviews_link_or_screenshot check (
  added_by_admin or link is not null or screenshot_path is not null
);

create or replace function public.stamp_review_extra()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.rep_id := null;
    new.counts_for_driver := true;
    new.reason := null;
    new.added_by_admin := false;
  end if;
  new.review_date := coalesce(new.review_date, (now() at time zone 'America/New_York')::date);
  return new;
end $$;
create trigger reviews_extra before insert on public.reviews
  for each row execute function public.stamp_review_extra();

-- New reviews go into the record history too
create trigger reviews_audit_insert after insert on public.reviews
  for each row execute function public.audit_row('review');

-- Existing reviews: the day they were added
update public.reviews
   set review_date = (created_at at time zone 'America/New_York')::date
 where review_date is null;

-- Attribute a review to a sales rep and/or the driver (reason goes into the history)
create or replace function public.admin_attribute_review(
  p_id uuid,
  p_rep_id uuid,
  p_counts_for_driver boolean,
  p_stars smallint,
  p_platform public.review_platform,
  p_reason text,
  p_change_reason text
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_job uuid;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_rep_id is not null and not exists (
    select 1 from public.profiles where id = p_rep_id and role = 'sales_rep'
  ) then
    raise exception 'Choose a sales rep';
  end if;

  perform set_config('app.change_reason', coalesce(nullif(trim(p_change_reason), ''), 'Review attribution'), true);

  update public.reviews
     set rep_id = p_rep_id,
         counts_for_driver = p_counts_for_driver,
         stars = p_stars,
         platform = p_platform,
         reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_id
  returning job_id into v_job;

  if v_job is null then raise exception 'Record not found'; end if;
  return v_job;
end $$;
grant execute on function public.admin_attribute_review(uuid, uuid, boolean, smallint, public.review_platform, text, text) to authenticated;

-- A sales rep can see the reviews attributed to them (on their own dashboard)
create policy reviews_rep_select on public.reviews
  for select to authenticated
  using (deleted_at is null and rep_id = auth.uid());