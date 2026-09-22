create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  question text not null,
  scope text not null default 'industry' check (scope in ('industry','universe','both')),
  originating_evidence_id text,
  status text not null default 'open' check (status in ('open','validated','archived')),
  payload jsonb not null default '{}'::jsonb,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.investigations enable row level security;
create index if not exists investigations_industry_updated_idx on public.investigations(industry_id,last_updated_at desc);
create index if not exists investigations_originating_evidence_idx on public.investigations(originating_evidence_id);
drop policy if exists investigations_industry_select on public.investigations;
drop policy if exists investigations_industry_insert on public.investigations;
drop policy if exists investigations_industry_update on public.investigations;
drop policy if exists investigations_industry_delete on public.investigations;
create policy investigations_industry_select on public.investigations for select using (industry_id = private.current_industry_id());
create policy investigations_industry_insert on public.investigations for insert with check (industry_id = private.current_industry_id() and created_by = auth.uid());
create policy investigations_industry_update on public.investigations for update using (industry_id = private.current_industry_id()) with check (industry_id = private.current_industry_id());
create policy investigations_industry_delete on public.investigations for delete using (industry_id = private.current_industry_id());
alter table public.analyses add column if not exists investigation_id uuid references public.investigations(id) on delete set null;
create index if not exists analyses_investigation_idx on public.analyses(investigation_id);