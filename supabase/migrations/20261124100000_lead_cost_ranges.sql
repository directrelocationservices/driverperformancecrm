-- File: supabase/migrations/20261124100000_lead_cost_ranges.sql
-- (NEW file)

-- =========================================================
-- Bulk lead costs for a date range (e.g. Jan 1 to Nov 15)
--   mode 'per_lead': every lead of the source in the range costs `amount`
--   mode 'total'   : `amount` is what was spent; it's divided across the
--                    source's leads in the range (updates as leads come in).
--                    Leads with a manual cost keep it and aren't counted.
-- A range cost wins over the weekly cost for dates inside the range.
-- Ranges of the same source can't overlap.
-- Every create / edit / delete is kept in lead_cost_range_log.
-- =========================================================

create table public.lead_cost_ranges (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lead_sources(id),
  start_date date not null,
  end_date date not null,
  mode text not null check (mode in ('per_lead', 'total')),
  amount numeric(12, 2) not null check (amount >= 0),
  -- Worked out by refresh_cost_range(): the cost each lead gets
  cost_per_lead numeric(14, 4) not null default 0,
  lead_count integer not null default 0,
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index lead_cost_ranges_source_idx on public.lead_cost_ranges (source_id, start_date);

create table public.lead_cost_range_log (
  id uuid primary key default gen_random_uuid(),
  range_id uuid not null,            -- no FK: the log stays after a delete
  source_id uuid not null references public.lead_sources(id),
  action text not null check (action in ('create', 'update', 'delete')),
  before jsonb,
  after jsonb,
  changed_by uuid references public.profiles(id) default auth.uid(),
  changed_at timestamptz not null default now()
);
create index lead_cost_range_log_idx on public.lead_cost_range_log (changed_at desc);

alter table public.lead_cost_ranges enable row level security;
alter table public.lead_cost_range_log enable row level security;
create policy lead_cost_ranges_admin_all on public.lead_cost_ranges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lead_cost_range_log_admin_select on public.lead_cost_range_log
  for select to authenticated using (public.is_admin());
create policy lead_cost_range_log_admin_insert on public.lead_cost_range_log
  for insert to authenticated with check (public.is_admin());

-- Cost in effect for a source on a date: a date-range cost if one covers
-- the date, otherwise that week's cost (or the latest earlier week's)
create or replace function public.lead_cost_for(p_source uuid, p_date date)
returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select round(r.cost_per_lead, 2) from public.lead_cost_ranges r
      where r.source_id = p_source
        and p_date between r.start_date and r.end_date
      order by r.start_date desc
      limit 1),
    (select cost from public.lead_costs
      where source_id = p_source and week <= date_trunc('week', p_date)::date
      order by week desc
      limit 1),
    0)
$$;

-- Works out a range's cost per lead and applies it to its leads
create or replace function public.refresh_cost_range(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.lead_cost_ranges;
  v_count integer;
  v_cpl numeric;
begin
  select * into r from public.lead_cost_ranges where id = p_id;
  if not found then return; end if;

  select count(*) into v_count
    from public.leads
   where source_id = r.source_id
     and date between r.start_date and r.end_date
     and not is_test
     and not cost_overridden;   -- leads with a manual cost keep their own

  v_cpl := case
    when r.mode = 'per_lead' then r.amount
    when v_count > 0 then r.amount / v_count
    else 0
  end;

  update public.lead_cost_ranges
     set lead_count = v_count, cost_per_lead = v_cpl
   where id = p_id
     and (lead_count is distinct from v_count or cost_per_lead is distinct from v_cpl);

  update public.leads
     set lead_cost = round(v_cpl, 2)
   where source_id = r.source_id
     and date between r.start_date and r.end_date
     and not cost_overridden
     and lead_cost is distinct from round(v_cpl, 2);
end $$;

-- A lead added, moved or removed changes a "total spend" range's split
create or replace function public.leads_refresh_cost_ranges()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    for v_id in
      select id from public.lead_cost_ranges
       where mode = 'total' and source_id = new.source_id
         and new.date between start_date and end_date
    loop
      perform public.refresh_cost_range(v_id);
    end loop;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    for v_id in
      select id from public.lead_cost_ranges
       where mode = 'total' and source_id = old.source_id
         and old.date between start_date and end_date
    loop
      perform public.refresh_cost_range(v_id);
    end loop;
  end if;
  return null;
end $$;

create trigger leads_refresh_cost_ranges
  after insert or delete or update of source_id, date, cost_overridden on public.leads
  for each row execute function public.leads_refresh_cost_ranges();

-- Create (p_id null) or edit a date-range cost. Returns its id.
create or replace function public.admin_save_cost_range(
  p_id uuid,
  p_source uuid,
  p_start date,
  p_end date,
  p_mode text,
  p_amount numeric,
  p_note text
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_old public.lead_cost_ranges;
  v_new public.lead_cost_ranges;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'The end date must be on or after the start date';
  end if;
  if p_mode not in ('per_lead', 'total') then raise exception 'Choose a cost type'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Amount must be 0 or more'; end if;

  if exists (
    select 1 from public.lead_cost_ranges
     where source_id = p_source
       and id is distinct from p_id
       and start_date <= p_end and end_date >= p_start
  ) then
    raise exception 'This source already has a date-range cost in these dates';
  end if;

  if p_id is null then
    insert into public.lead_cost_ranges (source_id, start_date, end_date, mode, amount, note)
    values (p_source, p_start, p_end, p_mode, p_amount, nullif(trim(p_note), ''))
    returning * into v_new;
  else
    select * into v_old from public.lead_cost_ranges where id = p_id for update;
    if not found then raise exception 'Cost range not found'; end if;
    update public.lead_cost_ranges
       set source_id = p_source, start_date = p_start, end_date = p_end,
           mode = p_mode, amount = p_amount, note = nullif(trim(p_note), ''),
           updated_by = auth.uid(), updated_at = now()
     where id = p_id
    returning * into v_new;
  end if;

  perform public.refresh_cost_range(v_new.id);
  select * into v_new from public.lead_cost_ranges where id = v_new.id;

  -- Leads that left the range go back to the weekly cost
  perform public.recalc_lead_costs(p_source);
  if v_old.id is not null and v_old.source_id <> p_source then
    perform public.recalc_lead_costs(v_old.source_id);
  end if;

  insert into public.lead_cost_range_log (range_id, source_id, action, before, after)
  values (
    v_new.id, v_new.source_id,
    case when v_old.id is null then 'create' else 'update' end,
    case when v_old.id is null then null else to_jsonb(v_old) end,
    to_jsonb(v_new)
  );
  return v_new.id;
end $$;

-- Removes a date-range cost; its leads go back to the weekly cost
create or replace function public.admin_delete_cost_range(p_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_old public.lead_cost_ranges;
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  select * into v_old from public.lead_cost_ranges where id = p_id;
  if not found then raise exception 'Cost range not found'; end if;

  delete from public.lead_cost_ranges where id = p_id;
  perform public.recalc_lead_costs(v_old.source_id);

  insert into public.lead_cost_range_log (range_id, source_id, action, before, after)
  values (v_old.id, v_old.source_id, 'delete', to_jsonb(v_old), null);
end $$;

grant execute on function public.admin_save_cost_range(uuid, uuid, date, date, text, numeric, text) to authenticated;
grant execute on function public.admin_delete_cost_range(uuid) to authenticated;