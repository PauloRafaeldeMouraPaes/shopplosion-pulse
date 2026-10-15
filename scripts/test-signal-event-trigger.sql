\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
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

  INSERT INTO public.intelligence_signals
    (industry_id, confidence, status, evidence, fingerprint)
  VALUES (v_industry, 0.65, 'active', '[{"quote":"baseline"}]'::jsonb, 'fp-1')
  RETURNING id INTO v_signal;

  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 1 THEN RAISE EXCEPTION 'insert must create exactly one initial event'; END IF;

  UPDATE public.intelligence_signals SET observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
  UPDATE public.intelligence_signals SET confidence = 0.66 WHERE id = v_signal;
  SELECT count(*) INTO v_count FROM public.intelligence_signal_events WHERE signal_id = v_signal;
  IF v_count <> 1 THEN RAISE EXCEPTION 'timestamp-only and sub-threshold updates must not create events'; END IF;

  UPDATE public.intelligence_signals SET confidence = 0.70, observed_at = observed_at + interval '1 minute' WHERE id = v_signal;
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
