-- DESIGN DRAFT ONLY — NOT A PRODUCTION MIGRATION.
-- This draft must be tested in isolated PostgreSQL and reviewed against the live
-- cron/Vault -> Edge Function path before any release. Do not apply directly.
--
-- The trigger is the sole event writer. Worker-side duplicate INSERTs into
-- intelligence_signal_events must be removed in the same reviewed release.
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
    -- Do not create repeated events for a signal that is already resolved.
    IF OLD.status = 'resolved' AND NEW.status = 'resolved' THEN
      RETURN NEW;
    END IF;

    IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
      v_direction := 'resolved';
      v_change := 1;
      v_emit := true;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_direction := CASE WHEN NEW.status = 'active' THEN 'new' ELSE 'stable' END;
      v_change := 0;
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
        -- Evidence/fingerprint changes alone are not confidence increases.
        v_direction := 'stable';
        v_change := 0;
        v_emit := true;
      ELSE
        -- Includes observed_at-only, updated_at-only, no-op and evidence-only
        -- changes when the approved fingerprint did not change.
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
       COALESCE(NEW.observed_at, pg_catalog.now()),
       LEAST(1, GREATEST(0, COALESCE(NEW.confidence, 0))),
       v_direction, v_change, COALESCE(NEW.evidence, '[]'::jsonb));
  END IF;

  RETURN NEW;
END;
$signal_event_capture$;

-- Trigger functions are not a direct RPC API. Trigger invocation continues to
-- work; direct execution by API roles is unnecessary.
REVOKE ALL ON FUNCTION public.capture_intelligence_signal_event()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS intelligence_signal_event_capture
  ON public.intelligence_signals;

CREATE TRIGGER intelligence_signal_event_capture
  AFTER INSERT OR UPDATE OF confidence, status, evidence, observed_at, fingerprint
  ON public.intelligence_signals
  FOR EACH ROW EXECUTE FUNCTION public.capture_intelligence_signal_event();
