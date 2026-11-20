-- File: supabase/migrations/20261122100000_carriers.sql
-- (NEW file)
-- =========================================================
-- Carriers (partner companies that deliver jobs)
--   Profile: company, USDOT, MC, contact, insurance certificate + expiry,
--   notes, active / inactive.
--   An email alert goes out 30 days before the insurance expires
--   (insurance_alert_sent_for remembers which expiry date was alerted).
-- Files: private "carriers" bucket, admins only:
--   insurance/<uuid>.(pdf|jpg|png)
-- =========================================================

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 1 and 160),
  usdot text check (usdot is null or char_length(usdot) <= 20),
  mc_number text check (mc_number is null or char_length(mc_number) <= 20),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  contact_email text check (contact_email is null or char_length(contact_email) <= 200),
  insurance_path text,
  insurance_file_name text check (insurance_file_name is null or char_length(insurance_file_name) <= 200),
  insurance_expires date,
  insurance_alert_sent_for date,
  notes text check (notes is null or char_length(notes) <= 4000),
  active boolean not null default true,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index carriers_company_name_key on public.carriers (lower(trim(company_name)));

create trigger carriers_updated_at before update on public.carriers
  for each row execute function public.set_updated_at();

alter table public.carriers enable row level security;
create policy carriers_admin_all on public.carriers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private bucket for insurance certificates
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carriers',
  'carriers',
  false,
  15728640,  -- 15 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy carriers_files_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'carriers' and public.is_admin());

create policy carriers_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'carriers' and public.is_admin());
-- No update/delete policies: an uploaded certificate is kept; a new one gets a new file.