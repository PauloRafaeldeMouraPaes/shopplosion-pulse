DO $precondition$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.capture_intelligence_signal_event()',
    'public.capture_document_version()',
    'public.pulse_external_backstop_schedule_tick()',
    'public.pulse_external_intelligence_self_test()',
    'public.pulse_external_intelligence_fallback_candidate(uuid)',
    'public.pulse_capture_document_version(uuid)',
    'public.pulse_external_signal_deterministic_backstop()',
    'public.pulse_resolve_stale_intelligence_signals()',
    'public.pulse_external_intelligence_contract_check()',
    'public.pulse_intelligence_external_quality_check()',
    'public.auth_industry_context()'
  ] LOOP
    IF v_sig <> 'public.capture_intelligence_signal_event()' AND to_regprocedure(v_sig) IS NULL THEN
      v_missing := v_missing || v_sig;
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'signal-event migration precondition failed; missing routines: %', array_to_string(v_missing, ', ');
  END IF;
END
$precondition$;

CREATE OR REPLACE FUNCTION public.capture_intelligence_signal_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $signal_event_capture$
DECLARE
  v_direction text;
  v_change numeric := 0;
  v_delta numeric := 0;
  v_fingerprint_changed boolean := false;
  v_emit boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_direction := CASE WHEN NEW.status = 'resolved' THEN 'resolved' ELSE 'new' END;
    v_change := 1;
    v_emit := true;
  ELSE
    IF OLD.status = 'resolved' AND NEW.status = 'resolved' THEN
      RETURN NEW;
    END IF;

    IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
      v_direction := 'resolved';
      v_change := 1;
      v_emit := true;
    ELSE
      v_delta := COALESCE(NEW.confidence, 0) - COALESCE(OLD.confidence, 0);
      v_fingerprint_changed :=
        COALESCE(NEW.fingerprint, NEW.id::text)
        IS DISTINCT FROM
        COALESCE(OLD.fingerprint, OLD.id::text);

      IF abs(v_delta) >= 0.05 THEN
        v_direction := CASE WHEN v_delta > 0 THEN 'up' ELSE 'down' END;
        v_change := LEAST(1, abs(v_delta));
        v_emit := true;
      ELSIF v_fingerprint_changed THEN
        v_direction := 'stable';
        v_change := 0;
        v_emit := true;
      ELSE
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  IF v_emit THEN
    INSERT INTO public.intelligence_signal_events
      (signal_id, industry_id, fingerprint, observed_at, confidence,
       direction, change_score, evidence)
    VALUES
      (NEW.id, NEW.industry_id, COALESCE(NEW.fingerprint, NEW.id::text),
       CASE WHEN TG_OP = 'INSERT'
            THEN COALESCE(NEW.observed_at, pg_catalog.clock_timestamp())
            ELSE GREATEST(COALESCE(NEW.observed_at, pg_catalog.clock_timestamp()), pg_catalog.clock_timestamp())
       END,
       LEAST(1, GREATEST(0, COALESCE(NEW.confidence, 0))),
       v_direction, v_change, COALESCE(NEW.evidence, '[]'::jsonb));
  END IF;

  RETURN NEW;
END;
$signal_event_capture$;

REVOKE ALL ON FUNCTION public.capture_intelligence_signal_event()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.capture_document_version()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pulse_external_backstop_schedule_tick()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pulse_external_intelligence_self_test()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pulse_external_intelligence_fallback_candidate(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_external_intelligence_fallback_candidate(uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.pulse_capture_document_version(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_capture_document_version(uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.pulse_external_signal_deterministic_backstop()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_external_signal_deterministic_backstop()
  TO service_role;
REVOKE ALL ON FUNCTION public.pulse_resolve_stale_intelligence_signals()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_resolve_stale_intelligence_signals()
  TO service_role;
REVOKE ALL ON FUNCTION public.pulse_external_intelligence_contract_check()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_external_intelligence_contract_check()
  TO service_role;
REVOKE ALL ON FUNCTION public.pulse_intelligence_external_quality_check()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_intelligence_external_quality_check()
  TO service_role;

REVOKE ALL ON FUNCTION public.auth_industry_context()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_industry_context()
  TO authenticated;

DROP TRIGGER IF EXISTS intelligence_signal_event_capture
  ON public.intelligence_signals;

CREATE TRIGGER intelligence_signal_event_capture
  AFTER INSERT OR UPDATE OF confidence, status, evidence, observed_at, fingerprint
  ON public.intelligence_signals
  FOR EACH ROW EXECUTE FUNCTION public.capture_intelligence_signal_event();