-- Isolated Supabase/PostgREST integration fixture.
-- Apply only to the local stack started by source-history-postgrest-integration.yml.
-- The candidate history migration is applied after these minimal pre-existing tables.
create table public.intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null references public.industries(id) on delete cascade,
  name text not null,
  source_type text not null,
  url text not null,
  active boolean not null default true,
  poll_interval_minutes integer not null default 0,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz
);

create table public.intelligence_source_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.intelligence_sources(id) on delete cascade,
  industry_id uuid not null references public.industries(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'completed', 'failed')),
  items_seen integer not null default 0,
  items_changed integer not null default 0,
  error text
);

create table public.intelligence_source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.intelligence_sources(id) on delete cascade,
  industry_id uuid not null references public.industries(id) on delete cascade,
  external_id text not null,
  title text not null,
  url text,
  published_at timestamptz,
  content text not null,
  content_fingerprint text not null,
  fetched_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'expired', 'rejected')),
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);

grant select, insert, update on public.intelligence_sources to service_role;
grant select, insert, update on public.intelligence_source_fetch_runs to service_role;
grant select, insert, update on public.intelligence_source_items to service_role;
