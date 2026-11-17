-- File: supabase/migrations/20261117100000_source_relink.sql
-- (NEW file)
-- =========================================================
-- When admin adds or renames a lead source, leads that Granot sent with
-- that source name (and that went to "Other" or another source) move to
-- it by themselves, and get that source's weekly cost.
-- No SQL needs to be run by hand after adding a source.
-- =========================================================

create or replace function public.relink_leads_to_source()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.name is not distinct from old.name then
    return new;
  end if;

  update public.leads l
     set source_id = new.id,
         lead_cost = case when l.cost_overridden then l.lead_cost
                          else public.lead_cost_for(new.id, l.date) end
   where l.granot_source is not null
     and lower(trim(l.granot_source)) = lower(trim(new.name))
     and l.source_id is distinct from new.id;

  return new;
end $$;

drop trigger if exists lead_sources_relink on public.lead_sources;
create trigger lead_sources_relink
  after insert or update of name on public.lead_sources
  for each row execute function public.relink_leads_to_source();

-- One time: move leads already saved under the wrong source
update public.leads l
   set source_id = s.id,
       lead_cost = case when l.cost_overridden then l.lead_cost
                        else public.lead_cost_for(s.id, l.date) end
  from public.lead_sources s
 where l.granot_source is not null
   and lower(trim(l.granot_source)) = lower(trim(s.name))
   and l.source_id is distinct from s.id;