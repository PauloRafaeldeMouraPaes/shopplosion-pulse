#!/usr/bin/env python3
"""Test the review-only SECURITY DEFINER ACL draft in localhost PostgreSQL only."""
from __future__ import annotations

import os
import subprocess
import sys
from urllib.parse import urlsplit
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRAFT = ROOT / "docs/database/security-definer-acl-draft.sql"

FIXTURE = r"""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE public.intelligence_signals (id integer PRIMARY KEY, status text NOT NULL);
CREATE TABLE public.intelligence_signal_events (signal_id integer NOT NULL);

CREATE FUNCTION public.auth_industry_context() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT 'user-context'::text $$;
CREATE FUNCTION public.capture_document_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.capture_intelligence_signal_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.intelligence_signal_events(signal_id) VALUES (NEW.id); RETURN NEW; END $$;
CREATE FUNCTION public.current_industry_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.pulse_capture_document_version(p_document_id uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT p_document_id $$;
CREATE FUNCTION public.pulse_external_backstop_schedule_tick() RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 1::bigint $$;
CREATE FUNCTION public.pulse_external_intelligence_contract_check() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.pulse_external_intelligence_fallback_candidate(p_item_id uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('id', p_item_id) $$;
CREATE FUNCTION public.pulse_external_intelligence_self_test() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.pulse_external_signal_deterministic_backstop() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.pulse_intelligence_external_quality_check() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.pulse_resolve_stale_intelligence_signals() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 0 $$;

REVOKE ALL ON FUNCTION public.current_industry_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_industry_id() TO authenticated, service_role;

CREATE TRIGGER intelligence_signal_event_capture
AFTER UPDATE OF status ON public.intelligence_signals
FOR EACH ROW EXECUTE FUNCTION public.capture_intelligence_signal_event();

GRANT SELECT, UPDATE ON public.intelligence_signals TO service_role;
"""

ASSERTIONS = r"""
DO $acl_contract$
DECLARE
  api_denied text[] := ARRAY[
    'public.capture_document_version()',
    'public.capture_intelligence_signal_event()',
    'public.pulse_capture_document_version(uuid)',
    'public.pulse_external_backstop_schedule_tick()',
    'public.pulse_external_intelligence_contract_check()',
    'public.pulse_external_intelligence_fallback_candidate(uuid)',
    'public.pulse_external_intelligence_self_test()',
    'public.pulse_external_signal_deterministic_backstop()',
    'public.pulse_intelligence_external_quality_check()',
    'public.pulse_resolve_stale_intelligence_signals()'
  ];
  signature text;
BEGIN
  IF has_function_privilege('anon', 'public.auth_industry_context()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon retained auth_industry_context access';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.auth_industry_context()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated user-context contract was removed';
  END IF;

  FOREACH signature IN ARRAY api_denied LOOP
    IF has_function_privilege('anon', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can still execute %', signature;
    END IF;
    IF has_function_privilege('authenticated', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated can still execute %', signature;
    END IF;
  END LOOP;

  IF has_function_privilege('service_role', 'public.capture_intelligence_signal_event()', 'EXECUTE') THEN
    RAISE EXCEPTION 'trigger-only function remains directly executable by service_role';
  END IF;
  IF has_function_privilege('service_role', 'public.capture_document_version()', 'EXECUTE') THEN
    RAISE EXCEPTION 'unused trigger-returning function remains directly executable by service_role';
  END IF;
  IF has_function_privilege('service_role', 'public.pulse_external_backstop_schedule_tick()', 'EXECUTE') THEN
    RAISE EXCEPTION 'cron-only scheduler remains directly executable by service_role';
  END IF;
  IF has_function_privilege('service_role', 'public.pulse_external_intelligence_self_test()', 'EXECUTE') THEN
    RAISE EXCEPTION 'fixture-mutating self-test remains directly executable by service_role';
  END IF;

  FOREACH signature IN ARRAY ARRAY[
    'public.pulse_capture_document_version(uuid)',
    'public.pulse_external_intelligence_fallback_candidate(uuid)',
    'public.pulse_external_intelligence_contract_check()',
    'public.pulse_external_signal_deterministic_backstop()',
    'public.pulse_intelligence_external_quality_check()',
    'public.pulse_resolve_stale_intelligence_signals()'
  ] LOOP
    IF NOT has_function_privilege('service_role', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'trusted internal role cannot execute %', signature;
    END IF;
  END LOOP;

  IF has_function_privilege('anon', 'public.current_industry_id()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.current_industry_id()', 'EXECUTE') THEN
    RAISE EXCEPTION 'current_industry_id authenticated-only control changed';
  END IF;
END;
$acl_contract$;

INSERT INTO public.intelligence_signals (id, status) VALUES (1, 'active');
SET LOCAL ROLE service_role;
UPDATE public.intelligence_signals SET status = 'resolved' WHERE id = 1;
RESET ROLE;

DO $trigger_contract$
BEGIN
  IF (SELECT count(*) FROM public.intelligence_signal_events WHERE signal_id = 1) <> 1 THEN
    RAISE EXCEPTION 'trigger did not run after direct EXECUTE was revoked';
  END IF;
END;
$trigger_contract$;
"""

def main() -> int:
    raw_url = os.environ.get("DATABASE_URL", "")
    if not raw_url:
        raise SystemExit("DATABASE_URL is required")
    parsed = urlsplit(raw_url)
    if parsed.hostname not in {"localhost", "127.0.0.1", "::1"} or parsed.port not in {None, 5432} or parsed.path != "/pulse_test":
        raise SystemExit("Refusing non-local/non-pulse_test DATABASE_URL")
    if not DRAFT.is_file():
        raise SystemExit("ACL design draft is missing")
    lines = DRAFT.read_text(encoding="utf-8").splitlines()
    executable = [(index, line.strip().upper()) for index, line in enumerate(lines)
                  if line.strip() and not line.lstrip().startswith("--")]
    if not executable or executable[0][1] != "BEGIN;" or executable[-1][1] != "ROLLBACK;":
        raise SystemExit("ACL draft must be transaction-wrapped and end in ROLLBACK")
    begin_line, rollback_line = executable[0][0], executable[-1][0]
    draft_body = "\n".join(lines[:begin_line] + lines[begin_line + 1:rollback_line] + lines[rollback_line + 1:])
    sql = "BEGIN;\n" + FIXTURE + "\n" + draft_body + "\n" + ASSERTIONS + "\nROLLBACK;\n"
    subprocess.run(["psql", raw_url, "-v", "ON_ERROR_STOP=1"], input=sql, text=True, check=True)
    print("PASS: ACL draft denies client execution, preserves the authenticated context/internal contracts, and trigger invocation.")
    print("LIMIT: synthetic PostgreSQL contract; production migration lineage and staging call-graph checks remain required.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"FAIL: psql contract exited {exc.returncode}", file=sys.stderr)
        raise SystemExit(exc.returncode)
