\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$roles$;

BEGIN;

CREATE TABLE public.intelligence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id uuid NOT NULL,
  confidence numeric,
  status text NOT NULL DEFAULT 'active',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text
);

CREATE FUNCTION public.pulse_external_backstop_schedule_tick()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT 0::bigint $stub$;
CREATE FUNCTION public.pulse_external_intelligence_fallback_candidate(p_item_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT '{}'::jsonb $stub$;
CREATE FUNCTION public.pulse_capture_document_version(p_document_id uuid)
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT 0::bigint $stub$;
CREATE FUNCTION public.pulse_external_intelligence_self_test()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT 0::bigint $stub$;
CREATE FUNCTION public.pulse_external_signal_deterministic_backstop()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT 0::bigint $stub$;
CREATE FUNCTION public.pulse_resolve_stale_intelligence_signals()
RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT 0::bigint $stub$;
CREATE FUNCTION public.pulse_external_intelligence_contract_check()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT '{}'::jsonb $stub$;
CREATE FUNCTION public.pulse_intelligence_external_quality_check()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT '{}'::jsonb $stub$;
CREATE FUNCTION public.capture_document_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $stub$
BEGIN
  RETURN NEW;
END;
$stub$;
CREATE FUNCTION public.auth_industry_context()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $stub$ SELECT '{}'::jsonb $stub$;
GRANT EXECUTE ON FUNCTION public.pulse_external_backstop_schedule_tick() TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_external_intelligence_fallback_candidate(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_capture_document_version(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_external_intelligence_self_test() TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_external_signal_deterministic_backstop() TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_resolve_stale_intelligence_signals() TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_external_intelligence_contract_check() TO service_role;
GRANT EXECUTE ON FUNCTION public.pulse_intelligence_external_quality_check() TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_document_version() TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_industry_context() TO anon, authenticated;

CREATE TABLE public.intelligence_signal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL,
  industry_id uuid NOT NULL,
  fingerprint text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  confidence numeric NOT NULL,
  direction text NOT NULL,
  change_score numeric NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb
);

\ir ../docs/database/signal-event-trigger-draft.sql

DO $contract$
DECLARE
  v_signal uuid;
  v_industry uuid := gen_random_uuid();
  v_count integer;
  v_direction text;
  v_score numeric;
  v_resolved_signal uuid;
BEGIN
  IF has_function_privilege('anon', 'public.capture_intelligence_signal_event()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.capture_intelligence_signal_event()', 'EXECUTE') THEN
    RAISE EXCEPTION 'API roles must not directly execute the trigger function';
  END IF;

  IF has_function_privilege('anon', 'public.pulse_external_backstop_schedule_tick()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_external_backstop_schedule_tick()', 'EXECUTE') THEN
    RAISE EXCEPTION 'API roles must not directly execute the cron scheduler';
  END IF;
  IF NOT has_function_privilege('postgres', 'public.pulse_external_backstop_schedule_tick()', 'EXECUTE') THEN
    RAISE EXCEPTION 'cron owner lost scheduler execution';
  END IF;
  IF has_function_privilege('anon', 'public.pulse_external_intelligence_fallback_candidate(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_external_intelligence_fallback_candidate(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'API roles must not directly execute internal candidate lookup';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.pulse_external_intelligence_fallback_candidate(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'trusted worker role lost candidate lookup execution';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.pulse_capture_document_version(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.pulse_external_intelligence_self_test()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.pulse_external_signal_deterministic_backstop()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.pulse_resolve_stale_intelligence_signals()', 'EXECUTE') THEN
    RAISE EXCEPTION 'an internal service-role path lost its explicit EXECUTE grant';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.auth_industry_context()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.auth_industry_context()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated user-context access must remain while anonymous access is denied';
  END IF;
  IF has_function_privilege('anon', 'public.pulse_external_intelligence_contract_check()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_external_intelligence_contract_check()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pulse_intelligence_external_quality_check()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_intelligence_external_quality_check()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.capture_document_version()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.capture_document_version()', 'EXECUTE') THEN
    RAISE EXCEPTION 'internal diagnostics or unbound trigger function remain API-executable';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.pulse_external_intelligence_contract_check()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.pulse_intelligence_external_quality_check()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.capture_document_version()', 'EXECUTE') THEN
    RAISE EXCEPTION 'trusted service-role access was lost for internal routines';
  END IF;
  IF has_function_privilege('anon', 'public.pulse_capture_document_version(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_capture_document_version(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pulse_external_intelligence_self_test()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_external_intelligence_self_test()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pulse_external_signal_deterministic_backstop()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_external_signal_deterministic_backstop()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pulse_resolve_stale_intelligence_signals()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pulse_resolve_stale_intelligence_signals()', 'EXECUTE') THEN
    RAISE EXCEPTION 'an internal-only SECURITY DEFINER routine remains directly executable by API roles';
  END IF;

  INSERT INTO public.intelligence_signals
    (industry_id, confidence, status, evidence, fingerprint)
  VALUES (v_industry, 0.65, 'active', '[{"quote":"baseline"}]'::jsonb, 'fp-1')
  RETURNING id INTO v_signal;

  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 1 THEN RAISE EXCEPTION 'insert must create exactly one initial event'; END IF;

  UPDATE public.intelligence_signals SET status = 'paused' WHERE id = v_signal;
  UPDATE public.intelligence_signals SET status = 'active' WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 1 THEN RAISE EXCEPTION 'non-resolution status-only changes must not create events'; END IF;

  UPDATE public.intelligence_signals SET observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
  UPDATE public.intelligence_signals SET confidence = 0.66 WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 1 THEN RAISE EXCEPTION 'timestamp-only and sub-threshold updates must not create events'; END IF;

  UPDATE public.intelligence_signals SET confidence = 0.71, observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  SELECT direction, change_score INTO v_direction, v_score FROM public.intelligence_signal_events WHERE signal_id = v_signal ORDER BY observed_at DESC LIMIT 1;
  IF v_count <> 2 OR v_direction <> 'up' OR v_score <> 0.05 THEN
    RAISE EXCEPTION 'meaningful confidence increase must create one up event (count %, direction %, score %)', v_count, v_direction, v_score;
  END IF;

  UPDATE public.intelligence_signals SET confidence = 0.65, observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 3 OR (SELECT direction FROM public.intelligence_signal_events WHERE signal_id = v_signal ORDER BY observed_at DESC, id DESC LIMIT 1) <> 'down' THEN
    RAISE EXCEPTION 'meaningful confidence decrease must create one down event';
  END IF;

  UPDATE public.intelligence_signals SET fingerprint = 'fp-2', observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 4 OR (SELECT direction FROM public.intelligence_signal_events WHERE signal_id = v_signal ORDER BY observed_at DESC, id DESC LIMIT 1) <> 'stable' THEN
    RAISE EXCEPTION 'fingerprint-only change must create one stable, not upward, event';
  END IF;

  UPDATE public.intelligence_signals SET evidence = '[{"quote":"edited evidence"}]'::jsonb WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 4 THEN RAISE EXCEPTION 'evidence-only change with unchanged fingerprint must not create an event'; END IF;

  UPDATE public.intelligence_signals SET status = 'resolved', observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 5 OR (SELECT direction FROM public.intelligence_signal_events WHERE signal_id = v_signal ORDER BY observed_at DESC, id DESC LIMIT 1) <> 'resolved' THEN
    RAISE EXCEPTION 'active-to-resolved transition must create exactly one resolved event';
  END IF;

  UPDATE public.intelligence_signals SET observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 5 THEN RAISE EXCEPTION 'already-resolved signal must not emit repeated events'; END IF;

  INSERT INTO public.intelligence_signals (industry_id, confidence, status, evidence, fingerprint)
  VALUES (v_industry, 0.8, 'resolved', '[]'::jsonb, 'fp-resolved') RETURNING id INTO v_resolved_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE industry_id = v_industry;
  IF v_count <> 6 OR (SELECT direction FROM public.intelligence_signal_events WHERE signal_id = v_resolved_signal LIMIT 1) <> 'resolved' THEN
    RAISE EXCEPTION 'initial resolved signal must emit a resolved event';
  END IF;
END;
$contract$;

ROLLBACK;
