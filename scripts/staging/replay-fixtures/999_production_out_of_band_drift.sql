-- Objects present in production but absent from tracked migration history.
-- Definitions read from production (read-only) on 2026-11-17. Staging only.
create table if not exists public.intelligence_quality_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  signals_checked integer not null default 0,
  grounded_signals integer not null default 0,
  evidence_failures integer not null default 0,
  duplicate_failures integer not null default 0,
  pass boolean,
  error text
);
alter table public.intelligence_quality_runs enable row level security;
drop policy if exists intelligence_quality_runs_select on public.intelligence_quality_runs;
create policy intelligence_quality_runs_select on public.intelligence_quality_runs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.industry_id is not null));

CREATE OR REPLACE FUNCTION public.capture_intelligence_signal_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE v_direction text; v_change numeric; v_prev numeric; BEGIN IF TG_OP='INSERT' THEN v_direction:=CASE WHEN NEW.status='resolved' THEN 'resolved' ELSE 'new' END; v_change:=CASE WHEN v_direction='new' THEN 1 ELSE 1 END; ELSE IF NEW.status='resolved' AND COALESCE(OLD.status,'active')<>'resolved' THEN v_direction:='resolved'; v_change:=1; ELSE v_prev:=COALESCE(OLD.confidence,0); v_change:=LEAST(1,ABS(COALESCE(NEW.confidence,0)-v_prev)); v_direction:=CASE WHEN COALESCE(NEW.confidence,0)-v_prev >= 0.05 THEN 'up' WHEN v_prev-COALESCE(NEW.confidence,0) >= 0.05 THEN 'down' ELSE 'stable' END; END IF; END IF; INSERT INTO public.intelligence_signal_events(signal_id,industry_id,fingerprint,observed_at,confidence,direction,change_score,evidence) VALUES(NEW.id,NEW.industry_id,COALESCE(NEW.fingerprint,NEW.id::text),COALESCE(NEW.observed_at,now()),LEAST(1,GREATEST(0,COALESCE(NEW.confidence,0))),v_direction,v_change,COALESCE(NEW.evidence,'[]'::jsonb)) ON CONFLICT DO NOTHING; RETURN NEW; END; $function$;
drop trigger if exists intelligence_signal_event_capture on public.intelligence_signals;
CREATE TRIGGER intelligence_signal_event_capture AFTER INSERT OR UPDATE OF confidence, status, evidence, observed_at ON public.intelligence_signals FOR EACH ROW EXECUTE FUNCTION public.capture_intelligence_signal_event();

alter table public.document_chunks drop constraint if exists document_chunks_source_type_check;
alter table public.document_chunks add constraint document_chunks_source_type_check check (source_type = any (array['text','csv','json','manual','pdf']));

revoke execute on function public.pulse_intelligence_quality_check() from public, anon, authenticated;
grant execute on function public.pulse_intelligence_quality_check() to service_role;

-- Production also runs cron job pulse-intelligence-quality-daily (45 6 * * *, SELECT public.pulse_intelligence_quality_check();).
-- It is not scheduled here: every cron job is unscheduled on staging after the replay.
