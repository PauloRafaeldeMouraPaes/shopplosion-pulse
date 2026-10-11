-- Synthetic baseline approximating only the columns/constraints required
-- by the review-only draft. Used exclusively by an ephemeral CI PostgreSQL.
create role anon nologin;
create role authenticated nologin;

create table public.industries (
  id uuid primary key,
  slug text not null unique,
  status text not null check (status in ('active', 'suspended'))
);

create table public.intelligence_sources (
  id uuid primary key,
  industry_id uuid not null references public.industries(id) on delete cascade
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
