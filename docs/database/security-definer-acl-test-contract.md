# SECURITY DEFINER ACL release contract

**State:** draft validation only. No production grants, routines, tables, cron jobs, or data were modified.

## Findings addressed by the candidate

The candidate SQL in `security-definer-acl-draft.sql` separates user-context, trigger-only, server-worker, cron-only, diagnostics, and fixture-mutating routines rather than applying a blanket revoke:

- `auth_industry_context()` remains authenticated-only; anonymous execution is denied.
- `capture_document_version()` and `capture_intelligence_signal_event()` are not directly executable by API or service roles. Trigger execution must continue to work.
- `pulse_capture_document_version(uuid)` and `pulse_external_intelligence_fallback_candidate(uuid)` remain available to the trusted `service_role`, matching the inspected Edge Function callers.
- `pulse_external_backstop_schedule_tick()` remains executable by its database owner (`postgres`) for the active pg_cron job, not by API roles or `service_role`.
- `pulse_external_intelligence_self_test()` is owner-only because it creates fixture data.
- Quality diagnostics and maintenance routines are server-only; any additional client-facing contract must be explicitly reviewed rather than assumed.

## Local contract tests

`scripts/test-security-definer-acl-contract.py` applies the candidate statements against stub SECURITY DEFINER routines in an isolated PostgreSQL 17 transaction, asserts effective role privileges, performs an UPDATE as `service_role`, and verifies that the trigger still records an event after direct execute access is revoked. The test runner refuses any database URL that is not loopback host + database `pulse_test`; the transaction rolls back.

## Still required before production

1. Finish the migration-lineage investigation: 72 production versions exist, with only four hash-backed source mappings; the other 68 are unresolved.
2. Confirm any hidden callers for the routines classified owner-only, especially the self-test and cron-only scheduler.
3. Apply the candidate only to a dedicated staging project after the lineage and call graph are reviewed.
4. Exercise the real pg_cron owner → Vault token → Edge Function path, PostgREST denials for `anon` and `authenticated`, service-role worker calls, the signal trigger, regression, and multi-tenant audit.
5. Re-run Supabase Security Advisor and compare against the 11 anonymous / 12 authenticated findings observed on 2026-10-15.
6. Document rollback and require human review before any production migration.

This draft is not evidence that production has been hardened and is not authorization to run `supabase db push`.
