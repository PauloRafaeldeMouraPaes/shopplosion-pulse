-- DESIGN DRAFT ONLY — NOT A SUPABASE MIGRATION.
-- Do not apply this file directly. Generate the eventual migration with
-- `supabase migration new ...` in an isolated local Supabase environment,
-- reconcile names/constraints with the live schema, then run the integration
-- contract H01-H15. No production DDL has been executed.
--
-- Intent: append-only source snapshots + observations, with tenant-aware FKs.
-- History deliberately does not cascade-delete when a source/item is removed.

begin;

-- Composite unique keys let PostgreSQL enforce tenant/source/run consistency
-- through foreign keys, rather than relying on application checks alone.
alter table public.intelligence_sources
  add constraint intelligence_sources_id_industry_unique
  unique (id, industry_id);

alter table public.intelligence_source_fetch_runs
  add constraint intelligence_source_fetch_runs_id_source_industry_unique
  unique (id, source_id, industry_id);

alter table public.intelligence_source_items
  add constraint intelligence_source_items_id_source_industry_unique
  unique (id, source_id, industry_id);

create table public.intelligence_source_item_versions (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null,
  source_id uuid not null,
  external_id text not null,
  content_fingerprint text not null
    check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  title text not null,
  url text,
  published_at timestamptz,
  first_observed_at timestamptz not null default now(),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint intelligence_source_item_versions_source_industry_fk
    foreign key (source_id, industry_id)
    references public.intelligence_sources (id, industry_id)
    on delete restrict,
  constraint intelligence_source_item_versions_identity_fingerprint_unique
    unique (source_id, external_id, content_fingerprint),
  constraint intelligence_source_item_versions_id_source_industry_unique
    unique (id, source_id, industry_id)
);

create table public.intelligence_source_item_observations (
  id uuid primary key default gen_random_uuid(),
  industry_id uuid not null,
  source_id uuid not null,
  fetch_run_id uuid not null,
  source_item_id uuid,
  version_id uuid,
  external_id text not null,
  observed_at timestamptz not null default now(),
  outcome text not null
    check (outcome in ('captured', 'unchanged', 'parse_error', 'missing')),
  metadata jsonb not null default '{}'::jsonb,

  constraint intelligence_source_item_observations_source_industry_fk
    foreign key (source_id, industry_id)
    references public.intelligence_sources (id, industry_id)
    on delete restrict,

  constraint intelligence_source_item_observations_run_fk
    foreign key (fetch_run_id, source_id, industry_id)
    references public.intelligence_source_fetch_runs (id, source_id, industry_id)
    on delete restrict,

  constraint intelligence_source_item_observations_item_fk
    foreign key (source_item_id, source_id, industry_id)
    references public.intelligence_source_items (id, source_id, industry_id)
    on delete set null (source_item_id),

  constraint intelligence_source_item_observations_version_fk
    foreign key (version_id, source_id, industry_id)
    references public.intelligence_source_item_versions (id, source_id, industry_id)
    on delete restrict,

  constraint intelligence_source_item_observations_run_external_unique
    unique (fetch_run_id, external_id),

  constraint intelligence_source_item_observations_outcome_version_check
    check (
      (outcome in ('captured', 'unchanged') and version_id is not null)
      or (outcome in ('parse_error', 'missing') and version_id is null)
    )
);

create index intelligence_source_item_versions_industry_first_seen_idx
  on public.intelligence_source_item_versions (industry_id, first_observed_at desc);
create index intelligence_source_item_observations_industry_observed_idx
  on public.intelligence_source_item_observations (industry_id, observed_at desc);
create index intelligence_source_item_observations_source_external_time_idx
  on public.intelligence_source_item_observations (source_id, external_id, observed_at desc);
create index intelligence_source_item_observations_version_idx
  on public.intelligence_source_item_observations (version_id);

-- Default deny: these tables are not intended as direct client-write APIs.
alter table public.intelligence_source_item_versions enable row level security;
alter table public.intelligence_source_item_observations enable row level security;
revoke all on public.intelligence_source_item_versions from anon, authenticated;
revoke all on public.intelligence_source_item_observations from anon, authenticated;

comment on table public.intelligence_source_item_versions is
  'Design draft: deduplicated immutable content snapshots for source items.';
comment on table public.intelligence_source_item_observations is
  'Design draft: per-fetch-run evidence that a source item/version was observed.';

rollback;
