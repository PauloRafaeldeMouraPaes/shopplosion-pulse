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

-- Durable per-run completeness metadata. These fields describe collection
-- quality separately from the operational running/completed/failed lifecycle.
alter table public.intelligence_source_fetch_runs
  add column previous_fetch_run_id uuid,
  add column scope_fingerprint text,
  add column parser_version text,
  add column completeness_status text not null default 'incomplete'
    check (completeness_status in ('complete', 'incomplete', 'failed')),
  add column absence_inference_eligible boolean not null default false,
  add column completeness_reason text,
  add column pagination_exhausted boolean not null default false,
  add column finite_scope_proven boolean not null default false,
  add column response_status integer,
  add column response_content_type text,
  add column reported_total_count bigint,
  add column returned_item_count integer not null default 0
    check (returned_item_count >= 0);

alter table public.intelligence_source_fetch_runs
  add constraint intelligence_source_fetch_runs_previous_run_fk
  foreign key (previous_fetch_run_id, source_id, industry_id)
  references public.intelligence_source_fetch_runs (id, source_id, industry_id)
  on delete restrict;

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
    on delete restrict,

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


-- Prevent accidental UPDATE/DELETE of retained evidence, including by the
-- server worker. Corrections should be represented by a new version/observation.
create function public.reject_intelligence_source_history_mutation()
returns trigger
language plpgsql
as $immutable_history$
begin
  raise exception 'source history is append-only; insert a new observation/version instead'
    using errcode = '55000';
end;
$immutable_history$;

create trigger intelligence_source_item_versions_append_only
  before update or delete on public.intelligence_source_item_versions
  for each row execute function public.reject_intelligence_source_history_mutation();

create trigger intelligence_source_item_observations_append_only
  before update or delete on public.intelligence_source_item_observations
  for each row execute function public.reject_intelligence_source_history_mutation();

revoke all on function public.reject_intelligence_source_history_mutation()
  from public, anon, authenticated;

-- Default deny: these tables are not intended as direct client-write APIs.
alter table public.intelligence_source_item_versions enable row level security;
alter table public.intelligence_source_item_observations enable row level security;
revoke all on public.intelligence_source_item_versions from anon, authenticated;
revoke all on public.intelligence_source_item_observations from anon, authenticated;


-- Atomic server-side write path. The worker calls this RPC once per parsed
-- item so the immutable version, current projection, and observation commit or
-- roll back together. SECURITY INVOKER is intentional; no SECURITY DEFINER.
create function public.pulse_record_source_item_observation(
  p_industry_id uuid,
  p_source_id uuid,
  p_fetch_run_id uuid,
  p_external_id text,
  p_title text,
  p_url text,
  p_published_at timestamptz,
  p_content text,
  p_content_fingerprint text,
  p_metadata jsonb
)
returns table (
  source_item_id uuid,
  version_id uuid,
  observation_id uuid,
  outcome text,
  version_created boolean,
  current_item_changed boolean
)
language plpgsql
security invoker
set search_path = ''
as $pulse_record_observation$
declare
  v_previous_fingerprint text;
  v_has_current_item boolean := false;
  v_current_item_id uuid;
  v_version_id uuid;
  v_observation_id uuid;
  v_version_created boolean := false;
  v_current_item_changed boolean := false;
  v_outcome text;
  v_existing_source_id uuid;
  v_existing_industry_id uuid;
  v_existing_version_id uuid;
  v_existing_outcome text;
  v_existing_version_title text;
  v_existing_version_url text;
  v_existing_version_content text;
  v_retry_observation_id uuid;
  v_retry_version_id uuid;
  v_retry_outcome text;
  v_retry_fingerprint text;
  v_retry_title text;
  v_retry_url text;
  v_retry_content text;
  v_retry_item_id uuid;

begin
  if p_external_id is null or length(p_external_id) = 0 or length(p_external_id) > 1000 then
    raise exception 'external_id must contain 1-1000 characters' using errcode = '23514';
  end if;
  if p_title is null or length(p_title) = 0 or length(p_title) > 500 then
    raise exception 'title must contain 1-500 characters' using errcode = '23514';
  end if;
  if p_content is null or length(p_content) > 12000 then
    raise exception 'content is required and must not exceed 12000 characters' using errcode = '23514';
  end if;
  if p_content_fingerprint is null or p_content_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'content_fingerprint must be a lowercase SHA-256 hex digest' using errcode = '23514';
  end if;
  if p_metadata is null then
    p_metadata := '{}'::jsonb;
  end if;

  if not exists (
    select 1 from public.intelligence_sources s
    where s.id = p_source_id and s.industry_id = p_industry_id
  ) then
    raise exception 'source does not belong to the supplied industry' using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.intelligence_source_fetch_runs r
    where r.id = p_fetch_run_id
      and r.source_id = p_source_id
      and r.industry_id = p_industry_id
  ) then
    raise exception 'fetch run does not belong to the supplied source and industry' using errcode = '23503';
  end if;

  -- Serialize concurrent updates for the same source identity.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_source_id::text || ':' || p_external_id, 0)
  );

  -- An existing observation makes this call a retry, not a new projection update.
  -- Resolve and compare it before touching the current projection; stale retries
  -- must never roll a newer projection back to older content.
  select o.id, o.version_id, o.outcome, v.content_fingerprint, v.title, v.url,
         v.content, o.source_item_id
    into v_retry_observation_id, v_retry_version_id, v_retry_outcome,
         v_retry_fingerprint, v_retry_title, v_retry_url, v_retry_content,
         v_retry_item_id
    from public.intelligence_source_item_observations o
    left join public.intelligence_source_item_versions v
      on v.id = o.version_id
     and v.source_id = o.source_id
     and v.industry_id = o.industry_id
   where o.fetch_run_id = p_fetch_run_id
     and o.external_id = p_external_id;

  if found then
    if v_retry_version_id is null
       or v_retry_outcome not in ('captured', 'unchanged') then
      raise exception 'retry conflicts with an existing non-content observation'
        using errcode = '23505';
    end if;
    if v_retry_fingerprint is distinct from p_content_fingerprint
       or v_retry_title is distinct from p_title
       or v_retry_url is distinct from p_url
       or v_retry_content is distinct from p_content then
      raise exception 'retry conflicts with the existing observation payload'
        using errcode = '23505';
    end if;
    return query select
      v_retry_item_id, v_retry_version_id, v_retry_observation_id,
      v_retry_outcome, false, false;
    return;
  end if;

  select i.content_fingerprint
    into v_previous_fingerprint
    from public.intelligence_source_items i
   where i.source_id = p_source_id and i.external_id = p_external_id
   for update;
  v_has_current_item := found;
  v_current_item_changed :=
    (not v_has_current_item) or (v_previous_fingerprint is distinct from p_content_fingerprint);

  insert into public.intelligence_source_item_versions
    (industry_id, source_id, external_id, content_fingerprint, title, url,
     published_at, content, metadata)
  values
    (p_industry_id, p_source_id, p_external_id, p_content_fingerprint, p_title, p_url,
     p_published_at, p_content, p_metadata)
  on conflict (source_id, external_id, content_fingerprint) do nothing
  returning id into v_version_id;

  v_version_created := found;
  if not v_version_created then
    select v.id, v.title, v.url, v.content
      into v_version_id, v_existing_version_title, v_existing_version_url, v_existing_version_content
      from public.intelligence_source_item_versions v
     where v.source_id = p_source_id
       and v.external_id = p_external_id
       and v.content_fingerprint = p_content_fingerprint;
    if v_existing_version_title is distinct from p_title
       or v_existing_version_url is distinct from p_url
       or v_existing_version_content is distinct from p_content then
      raise exception 'content fingerprint maps to a different payload; refusing inconsistent history'
        using errcode = '23514';
    end if;
  end if;
  if v_version_id is null then
    raise exception 'could not resolve immutable version after insert' using errcode = '23503';
  end if;

  insert into public.intelligence_source_items as current_item
    (source_id, industry_id, external_id, title, url, published_at, content,
     content_fingerprint, fetched_at, status)
  values
    (p_source_id, p_industry_id, p_external_id, p_title, p_url, p_published_at, p_content,
     p_content_fingerprint, pg_catalog.now(), 'active')
  on conflict (source_id, external_id) do update set
    industry_id = excluded.industry_id,
    title = excluded.title,
    url = excluded.url,
    published_at = excluded.published_at,
    content = excluded.content,
    content_fingerprint = excluded.content_fingerprint,
    fetched_at = excluded.fetched_at,
    -- Re-fetching is not authorization to undo an explicit moderation decision.
    -- A rejected item stays rejected until a separate review action changes it.
    status = case when current_item.status = 'rejected' then 'rejected' else 'active' end
  returning id into v_current_item_id;

  v_outcome := case when v_current_item_changed then 'captured' else 'unchanged' end;

  insert into public.intelligence_source_item_observations
    (industry_id, source_id, fetch_run_id, source_item_id, version_id, external_id, outcome, metadata)
  values
    (p_industry_id, p_source_id, p_fetch_run_id, v_current_item_id, v_version_id,
     p_external_id, v_outcome, p_metadata)
  on conflict (fetch_run_id, external_id) do nothing
  returning id into v_observation_id;

  if v_observation_id is null then
    select o.id, o.source_id, o.industry_id, o.version_id, o.outcome
      into v_observation_id, v_existing_source_id, v_existing_industry_id,
           v_existing_version_id, v_existing_outcome
      from public.intelligence_source_item_observations o
     where o.fetch_run_id = p_fetch_run_id and o.external_id = p_external_id;

    if not found
       or v_existing_source_id is distinct from p_source_id
       or v_existing_industry_id is distinct from p_industry_id
       or v_existing_version_id is distinct from v_version_id then
      raise exception 'retry conflicts with the existing observation payload'
        using errcode = '23505';
    end if;
    -- Idempotent retry: retain the original observation and its original outcome.
    v_outcome := v_existing_outcome;
  end if;

  return query select
    v_current_item_id, v_version_id, v_observation_id, v_outcome,
    v_version_created, v_current_item_changed;
end;
$pulse_record_observation$;

revoke all on function public.pulse_record_source_item_observation(
  uuid, uuid, uuid, text, text, text, timestamptz, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.pulse_record_source_item_observation(
  uuid, uuid, uuid, text, text, text, timestamptz, text, text, jsonb
) to service_role;

grant select on public.intelligence_sources, public.intelligence_source_fetch_runs to service_role;
grant select, insert, update on public.intelligence_source_items to service_role;
grant select, insert on public.intelligence_source_item_versions to service_role;
grant select, insert on public.intelligence_source_item_observations to service_role;

comment on table public.intelligence_source_item_versions is
  'Design draft: deduplicated immutable content snapshots for source items.';
comment on table public.intelligence_source_item_observations is
  'Design draft: per-fetch-run evidence that a source item/version was observed.';

rollback;
