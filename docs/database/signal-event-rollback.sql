-- Rollback for supabase/migrations/011_signal_event_trigger_and_acl.sql.
-- Restores the previous trigger function and trigger exactly as read from production on 2026-11-17.
-- Grants are intentionally NOT reopened: the previous state let the public API key call internal routines.
-- If a legitimate caller breaks, grant EXECUTE to that caller's role only (service_role for Edge Functions).
CREATE OR REPLACE FUNCTION public.capture_intelligence_signal_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE v_direction text; v_change numeric; v_prev numeric; BEGIN IF TG_OP='INSERT' THEN v_direction:=CASE WHEN NEW.status='resolved' THEN 'resolved' ELSE 'new' END; v_change:=CASE WHEN v_direction='new' THEN 1 ELSE 1 END; ELSE IF NEW.status='resolved' AND COALESCE(OLD.status,'active')<>'resolved' THEN v_direction:='resolved'; v_change:=1; ELSE v_prev:=COALESCE(OLD.confidence,0); v_change:=LEAST(1,ABS(COALESCE(NEW.confidence,0)-v_prev)); v_direction:=CASE WHEN COALESCE(NEW.confidence,0)-v_prev >= 0.05 THEN 'up' WHEN v_prev-COALESCE(NEW.confidence,0) >= 0.05 THEN 'down' ELSE 'stable' END; END IF; END IF; INSERT INTO public.intelligence_signal_events(signal_id,industry_id,fingerprint,observed_at,confidence,direction,change_score,evidence) VALUES(NEW.id,NEW.industry_id,COALESCE(NEW.fingerprint,NEW.id::text),COALESCE(NEW.observed_at,now()),LEAST(1,GREATEST(0,COALESCE(NEW.confidence,0))),v_direction,v_change,COALESCE(NEW.evidence,'[]'::jsonb)) ON CONFLICT DO NOTHING; RETURN NEW; END; $function$;
REVOKE ALL ON FUNCTION public.capture_intelligence_signal_event() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS intelligence_signal_event_capture ON public.intelligence_signals;
CREATE TRIGGER intelligence_signal_event_capture AFTER INSERT OR UPDATE OF confidence, status, evidence, observed_at ON public.intelligence_signals FOR EACH ROW EXECUTE FUNCTION public.capture_intelligence_signal_event();
