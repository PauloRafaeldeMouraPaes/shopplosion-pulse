-- Pulse Multi-Tenant v1
-- Apply in a Supabase project before enabling the authenticated application.
-- No production secrets belong in this file.

create extension if not exists pgcrypto;

create table if not exists public.industries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  industry_id uuid not null references public.industries(id) on delete restrict,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null,
  filename text not null,
  mime_type text,
  created_at timestamptz not null default now(),
  unique (industry_id, storage_path)
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_industry_id_idx on public.profiles(industry_id);
create index if not exists documents_industry_id_idx on public.documents(industry_id);
create index if not exists analyses_industry_id_idx on public.analyses(industry_id);

create or replace function public.current_industry_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select industry_id from public.profiles where id = auth.uid()
$$;

alter table public.industries enable row level security;
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.analyses enable row level security;

drop policy if exists industries_member_select on public.industries;
create policy industries_member_select
on public.industries for select
using (id = public.current_industry_id());

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles for select
using (id = auth.uid());

drop policy if exists documents_industry_select on public.documents;
create policy documents_industry_select
on public.documents for select
using (industry_id = public.current_industry_id());

drop policy if exists documents_industry_insert on public.documents;
create policy documents_industry_insert
on public.documents for insert
with check (industry_id = public.current_industry_id() and uploaded_by = auth.uid());

drop policy if exists documents_industry_update on public.documents;
create policy documents_industry_update
on public.documents for update
using (industry_id = public.current_industry_id())
with check (industry_id = public.current_industry_id());

drop policy if exists documents_industry_delete on public.documents;
create policy documents_industry_delete
on public.documents for delete
using (industry_id = public.current_industry_id());

drop policy if exists analyses_industry_select on public.analyses;
create policy analyses_industry_select
on public.analyses for select
using (industry_id = public.current_industry_id());

drop policy if exists analyses_industry_insert on public.analyses;
create policy analyses_industry_insert
on public.analyses for insert
with check (industry_id = public.current_industry_id() and created_by = auth.uid());

drop policy if exists analyses_industry_update on public.analyses;
create policy analyses_industry_update
on public.analyses for update
using (industry_id = public.current_industry_id())
with check (industry_id = public.current_industry_id());

drop policy if exists analyses_industry_delete on public.analyses;
create policy analyses_industry_delete
on public.analyses for delete
using (industry_id = public.current_industry_id());

-- Storage bucket is intentionally private. Create it in Supabase as:
-- insert into storage.buckets (id, name, public) values ('pulse-documents', 'pulse-documents', false);
-- Storage policies must validate the first path segment against current_industry_id().
