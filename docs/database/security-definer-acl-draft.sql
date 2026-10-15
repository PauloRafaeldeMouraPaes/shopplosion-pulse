-- DESIGN DRAFT ONLY — NOT A MIGRATION.
-- Do not run against production. Production migration lineage is unresolved.
-- Review each routine's call graph and apply only through a reconciled forward migration.
-- Test harness strips the safety wrapper, applies these statements in an outer
-- transaction against a synthetic PostgreSQL schema, verifies effective rights
-- and trigger behavior, then rolls the transaction back.

BEGIN;

-- User context must be authenticated, never anonymous. Keep the existing
-- user-facing contract only if frontend/RLS tests confirm it is required.
REVOKE EXECUTE ON FUNCTION public.auth_industry_context()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_industry_context()
  TO authenticated;

-- Trigger-only functions do not need direct API or service-role EXECUTE.
-- PostgreSQL still invokes them through their attached triggers; the test
-- proves the signal trigger continues to work after the direct grant is gone.
REVOKE EXECUTE ON FUNCTION public.capture_document_version()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.capture_intelligence_signal_event()
  FROM PUBLIC, anon, authenticated, service_role;

-- Internal application paths verified in the repository call graph.
REVOKE EXECUTE ON FUNCTION public.pulse_capture_document_version(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_capture_document_version(uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.pulse_external_intelligence_fallback_candidate(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_external_intelligence_fallback_candidate(uuid)
  TO service_role;

-- Internal scheduler runs from pg_cron as postgres and must not be callable
-- through PostgREST, including with the service_role key.
REVOKE EXECUTE ON FUNCTION public.pulse_external_backstop_schedule_tick()
  FROM PUBLIC, anon, authenticated, service_role;

-- Diagnostics and mutating maintenance remain server-only. service_role may
-- call them for controlled operations; no client-role access is intended.
REVOKE EXECUTE ON FUNCTION public.pulse_external_intelligence_contract_check()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_external_intelligence_contract_check()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.pulse_external_intelligence_self_test()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pulse_external_signal_deterministic_backstop()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_external_signal_deterministic_backstop()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.pulse_intelligence_external_quality_check()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_intelligence_external_quality_check()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.pulse_resolve_stale_intelligence_signals()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_resolve_stale_intelligence_signals()
  TO service_role;

-- Intentionally not changed here:
-- * public.current_industry_id(): already authenticated-only in the live catalog.
-- * Schedule-tick routines already service_role-only.
-- Neither should be altered without its own regression contract.

ROLLBACK;
