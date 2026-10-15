-- Disposable schema for the source-worker/PostgREST integration test.
-- Run only against the CI-only pulse_test database; never use with a hosted project.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'CREATE ROLE anon NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated NOLOGIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'CREATE ROLE service_role NOLOGIN BYPASSRLS';
  END IF;
END
$roles$;

CREATE TABLE public.intelligence_sources (
  id uuid PRIMARY KEY,
  industry_id uuid NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL,
  url text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  poll_interval_minutes integer NOT NULL DEFAULT 0,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz
);

CREATE TABLE public.intelligence_source_fetch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  industry_id uuid NOT NULL,
  previous_fetch_run_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  items_seen integer NOT NULL DEFAULT 0,
  items_changed integer NOT NULL DEFAULT 0,
  error text,
  scope_fingerprint text,
  parser_version text,
  completeness_status text NOT NULL,
  absence_inference_eligible boolean NOT NULL DEFAULT false,
  completeness_reason text,
  pagination_exhausted boolean NOT NULL DEFAULT false,
  finite_scope_proven boolean NOT NULL DEFAULT false,
  response_status integer,
  response_content_type text,
  reported_total_count bigint,
  returned_item_count integer NOT NULL DEFAULT 0
);

CREATE TABLE public.intelligence_source_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL
);
CREATE TABLE public.intelligence_source_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL
);
CREATE TABLE public.intelligence_source_item_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL
);

CREATE OR REPLACE FUNCTION public.pulse_intelligence_worker_token()
RETURNS text LANGUAGE sql STABLE
AS $token$ SELECT 'test-cron-token'::text $token$;

CREATE OR REPLACE FUNCTION public.pulse_record_source_item_observation(
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
RETURNS TABLE (
  source_item_id uuid,
  version_id uuid,
  observation_id uuid,
  outcome text,
  version_created boolean,
  current_item_changed boolean
)
LANGUAGE plpgsql
AS $rpc$
BEGIN
  RAISE EXCEPTION 'injected observation persistence failure'
    USING ERRCODE = '55000';
END;
$rpc$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.intelligence_sources TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.intelligence_source_fetch_runs TO service_role;
GRANT SELECT ON public.intelligence_source_items, public.intelligence_source_item_versions,
  public.intelligence_source_item_observations TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_intelligence_worker_token() TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_record_source_item_observation(
  uuid, uuid, uuid, text, text, text, timestamptz, text, text, jsonb
) TO service_role;

INSERT INTO public.intelligence_sources
  (id, industry_id, name, source_type, url, active, poll_interval_minutes)
VALUES
  ('22222222-2222-4222-8222-222222222222',
   '11111111-1111-4111-8111-111111111111',
   'PostgREST atomic failure fixture',
   'json',
   'https://example.test/feed.json',
   true,
   0);

NOTIFY pgrst, 'reload schema';
