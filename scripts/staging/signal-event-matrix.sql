-- Staging acceptance: signal-event behaviour matrix and SECURITY DEFINER ACL matrix.
-- Runs ONLY on the staging project (Pulse Staging, ymitcepxpavjedntylem). Never on production.
-- Creates schema pulse_staging_test (not exposed through the API) with two invoker functions.
-- Nothing is persisted by a run: run_signal_event_matrix_rollback() raises at the end so every synthetic
-- row rolls back, and the results travel in the error message as JSON (prefix MATRIX_RESULT:).
-- Usage: SELECT pulse_staging_test.run_signal_event_matrix_rollback();

CREATE SCHEMA IF NOT EXISTS pulse_staging_test;

CREATE OR REPLACE FUNCTION pulse_staging_test.run_signal_event_matrix()
RETURNS TABLE(area text, scenario text, expected text, actual text, pass boolean)
LANGUAGE plpgsql
AS $matrix$
DECLARE
  v_industry uuid;
  v_sig uuid;
  v_before int;
  v_new int;
  v_dirs text;
  v_t0 timestamptz := timestamptz '2026-11-01 12:00:00+00';
  r record;
BEGIN
  INSERT INTO public.industries(name, slug) VALUES ('Staging matrix', 'pulse-staging-matrix')
  ON CONFLICT (slug) DO UPDATE SET status = 'active'
  RETURNING id INTO v_industry;

  -- Helper pattern for every scenario: insert a fresh synthetic signal, count events, apply the
  -- step under test, report the number and directions of events written by that step only.

  -- 1. Insert active signal
  INSERT INTO public.intelligence_signals(industry_id, signal_type, title, summary, confidence, status, observed_at, fingerprint, signal_key)
  VALUES (v_industry, 'trend', 'm1', 's', 0.5, 'active', v_t0, 'fp1', 'm1') RETURNING id INTO v_sig;
  SELECT count(*), string_agg(direction, ',') INTO v_new, v_dirs FROM public.intelligence_signal_events WHERE signal_id = v_sig;
  area := 'event'; scenario := 'Insert active signal'; expected := '1 new'; actual := v_new || ' ' || coalesce(v_dirs, '-');
  pass := (v_new = 1 AND v_dirs = 'new'); RETURN NEXT;

  -- 2. Insert already-resolved signal
  INSERT INTO public.intelligence_signals(industry_id, signal_type, title, summary, confidence, status, observed_at, fingerprint, signal_key)
  VALUES (v_industry, 'trend', 'm2', 's', 0.5, 'resolved', v_t0, 'fp2', 'm2') RETURNING id INTO v_sig;
  SELECT count(*), string_agg(direction, ',') INTO v_new, v_dirs FROM public.intelligence_signal_events WHERE signal_id = v_sig;
  scenario := 'Insert already-resolved signal'; expected := '1 resolved'; actual := v_new || ' ' || coalesce(v_dirs, '-');
  pass := (v_new = 1 AND v_dirs = 'resolved'); RETURN NEXT;

  FOR r IN
    SELECT * FROM (VALUES
      (3,  'Update only observed_at/updated_at',               0, NULL),
      (4,  'Reapply identical confidence/status/fp/evidence',   0, NULL),
      (5,  'Confidence change below 0.05 (+0.04)',             0, NULL),
      (6,  'Confidence change of exactly +0.05',               1, 'up'),
      (7,  'Confidence change of -0.10',                       1, 'down'),
      (8,  'Fingerprint change, confidence unchanged',         1, 'stable'),
      (9,  'Evidence change without fingerprint change',       0, NULL),
      (10, 'Transition active to resolved',                    1, 'resolved'),
      (11, 'Update an already-resolved signal',                0, NULL),
      (12, 'Fingerprint and confidence change in one statement', 1, 'up')
    ) AS t(n, label, want_count, want_dir)
  LOOP
    INSERT INTO public.intelligence_signals(industry_id, signal_type, title, summary, confidence, status, evidence, observed_at, fingerprint, signal_key)
    VALUES (v_industry, 'trend', 'm' || r.n, 's', 0.5, CASE WHEN r.n = 11 THEN 'resolved' ELSE 'active' END,
            '[{"quote":"a"}]'::jsonb, v_t0, 'fp' || r.n, 'm' || r.n)
    RETURNING id INTO v_sig;
    SELECT count(*) INTO v_before FROM public.intelligence_signal_events WHERE signal_id = v_sig;

    CASE r.n
      WHEN 3  THEN UPDATE public.intelligence_signals SET observed_at = v_t0 + interval '1 hour', updated_at = now() WHERE id = v_sig;
      WHEN 4  THEN UPDATE public.intelligence_signals SET confidence = confidence, status = status, fingerprint = fingerprint, evidence = evidence WHERE id = v_sig;
      WHEN 5  THEN UPDATE public.intelligence_signals SET confidence = 0.54 WHERE id = v_sig;
      WHEN 6  THEN UPDATE public.intelligence_signals SET confidence = 0.55 WHERE id = v_sig;
      WHEN 7  THEN UPDATE public.intelligence_signals SET confidence = 0.40 WHERE id = v_sig;
      WHEN 8  THEN UPDATE public.intelligence_signals SET fingerprint = 'fp8-changed' WHERE id = v_sig;
      WHEN 9  THEN UPDATE public.intelligence_signals SET evidence = '[{"quote":"b"}]'::jsonb WHERE id = v_sig;
      WHEN 10 THEN UPDATE public.intelligence_signals SET status = 'resolved' WHERE id = v_sig;
      WHEN 11 THEN UPDATE public.intelligence_signals SET confidence = 0.9, evidence = '[{"quote":"c"}]'::jsonb WHERE id = v_sig;
      WHEN 12 THEN UPDATE public.intelligence_signals SET fingerprint = 'fp12-changed', confidence = 0.8 WHERE id = v_sig;
    END CASE;

    SELECT count(*) - v_before INTO v_new FROM public.intelligence_signal_events WHERE signal_id = v_sig;
    SELECT string_agg(direction, ',' ORDER BY observed_at, id) INTO v_dirs
    FROM (SELECT direction, observed_at, id FROM public.intelligence_signal_events WHERE signal_id = v_sig
          ORDER BY observed_at DESC, id DESC LIMIT greatest(v_new, 0)) q;
    area := 'event'; scenario := r.label;
    expected := r.want_count || ' ' || coalesce(r.want_dir, '-');
    actual := v_new || ' ' || CASE WHEN v_new > 0 THEN coalesce(v_dirs, '-') ELSE '-' END;
    pass := (v_new = r.want_count AND (r.want_dir IS NULL OR v_dirs = r.want_dir));
    RETURN NEXT;
  END LOOP;

  -- ACL contract: effective EXECUTE privileges, checked without calling any routine.
  FOR r IN
    SELECT * FROM (VALUES
      ('public.capture_intelligence_signal_event()',                 false, false, false),
      ('public.capture_document_version()',                          false, false, false),
      ('public.pulse_external_backstop_schedule_tick()',             false, false, false),
      ('public.pulse_external_intelligence_self_test()',             false, false, false),
      ('public.pulse_external_intelligence_fallback_candidate(uuid)', false, false, true),
      ('public.pulse_capture_document_version(uuid)',                false, false, true),
      ('public.pulse_external_signal_deterministic_backstop()',      false, false, true),
      ('public.pulse_resolve_stale_intelligence_signals()',          false, false, true),
      ('public.pulse_external_intelligence_contract_check()',        false, false, true),
      ('public.pulse_intelligence_external_quality_check()',         false, false, true),
      ('public.auth_industry_context()',                             false, true,  NULL),
      ('public.current_industry_id()',                               false, true,  NULL),
      ('private.current_industry_id()',                              false, false, NULL)
    ) AS t(sig, want_anon, want_auth, want_service)
  LOOP
    area := 'acl'; scenario := r.sig;
    expected := 'anon=' || r.want_anon || ' auth=' || r.want_auth || ' service=' || coalesce(r.want_service::text, 'any');
    actual := 'anon=' || has_function_privilege('anon', r.sig::regprocedure, 'EXECUTE')
           || ' auth=' || has_function_privilege('authenticated', r.sig::regprocedure, 'EXECUTE')
           || ' service=' || has_function_privilege('service_role', r.sig::regprocedure, 'EXECUTE');
    pass := has_function_privilege('anon', r.sig::regprocedure, 'EXECUTE') = r.want_anon
        AND has_function_privilege('authenticated', r.sig::regprocedure, 'EXECUTE') = r.want_auth
        AND (r.want_service IS NULL OR has_function_privilege('service_role', r.sig::regprocedure, 'EXECUTE') = r.want_service);
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$matrix$;

CREATE OR REPLACE FUNCTION pulse_staging_test.run_signal_event_matrix_rollback()
RETURNS void
LANGUAGE plpgsql
AS $wrap$
DECLARE v_json text;
BEGIN
  SELECT json_agg(m)::text INTO v_json FROM pulse_staging_test.run_signal_event_matrix() m;
  RAISE EXCEPTION 'MATRIX_RESULT:%', v_json;
END;
$wrap$;
