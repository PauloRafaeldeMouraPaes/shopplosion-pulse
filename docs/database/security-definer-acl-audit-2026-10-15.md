# SECURITY DEFINER ACL audit — 2026-10-15

**Read-only inventory. No function was invoked and no production ACL, schema, data, cron job, or secret was changed.** Effective privileges were queried with `has_function_privilege` against every SECURITY DEFINER routine in the exposed `public` schema. This is a snapshot, not a remediation migration.

## Routines currently executable by API roles

| Routine signature | anon | authenticated | Observed dependency / initial disposition |
|---|---:|---:|---|
| `auth_industry_context()` | yes | yes | Returns the caller's profile/industry context. Confirm the intended user-facing contract; likely authenticated-only, not anonymous. |
| `capture_document_version()` | yes | yes | Trigger-returning function; catalog query found no attached non-internal trigger. Review direct API exposure and any hidden caller before revoking. |
| `capture_intelligence_signal_event()` | yes | yes | Attached to the `intelligence_signals` trigger. Remove direct API access only after proving trigger invocation remains functional. |
| `pulse_capture_document_version(uuid)` | yes | yes | Called by `supabase/functions/pulse-intelligence-worker/index.ts` through the server-side Supabase admin client. Preserve the internal worker path; direct `anon`/`authenticated` access is not required by the inspected caller. |
| `pulse_external_backstop_schedule_tick()` | yes | yes | Internal scheduler reads Vault token and dispatches the deterministic-backstop Edge Function; internal-only. |
| `pulse_external_intelligence_contract_check()` | yes | yes | Diagnostic/quality output; classify returned data and intended audience. |
| `pulse_external_intelligence_fallback_candidate(uuid)` | yes | yes | Called by `supabase/functions/pulse-external-deterministic-backstop/index.ts` through its server-side admin client. Preserve service-role access; direct `anon`/`authenticated` access is not required by the inspected caller. |
| `pulse_external_intelligence_self_test()` | yes | yes | Mutating test routine; review fixture creation/cleanup; internal-only by default. |
| `pulse_external_signal_deterministic_backstop()` | yes | yes | Mutating backstop; internal-only. |
| `pulse_intelligence_external_quality_check()` | yes | yes | Diagnostic/quality output; classify returned data and intended audience. |
| `pulse_resolve_stale_intelligence_signals()` | yes | yes | Mutates temporal signal state; internal-only. |
| `current_industry_id()` | no | yes | Authenticated user-context function; preserve only if the application contract and RLS assumptions validate it. |

The current Supabase Security Advisor reports 11 `anon` and 12 `authenticated` findings in this class. The counts are consistent with the catalog snapshot above: 11 routines are callable by `anon`, and `current_industry_id()` adds the twelfth authenticated-callable routine.

## Comparison controls

The following SECURITY DEFINER routines were observed as not executable by either `anon` or `authenticated` in the effective privilege check; `service_role` can execute them:

- `pulse_ask_ai_schedule_tick()`
- `pulse_external_signal_schedule_tick()`
- `pulse_external_source_schedule_tick()`
- `pulse_index_pending_internal()`
- `pulse_index_schedule_tick()`
- `pulse_intelligence_quality_check()`
- `pulse_intelligence_schedule_tick()`
- `pulse_intelligence_worker_token()`
- `pulse_rag_eval_schedule_tick()`
- `rls_auto_enable()`
- `verify_pulse_internal_token(text, text)`

These are comparison controls, not proof that every grant is correct. Routine owner observed as `postgres` across this inventory.

## Verified scheduler path

- Cron job: `pulse-external-backstop-hourly`.
- Owner: `postgres`.
- Schedule: `15 * * * *`.
- Command: `select public.pulse_external_backstop_schedule_tick();`.
- The scheduler reads the named worker token from Vault and invokes the deterministic-backstop Edge Function with `x-pulse-cron`; the Edge Function independently validates that token.

The cron owner does not need direct API-role grants for this schedule. Any grant correction must nevertheless be validated through the actual cron/Vault/Edge Function path in staging; do not test by invoking the exposed scheduler from an API role or by reading secrets.

## Required remediation contract

1. Record a caller, data read/write scope, trigger/cron dependencies, intended role, and positive/negative test for each routine.
2. Revoke direct `PUBLIC`/`anon`/`authenticated` execution only for routines confirmed internal-only; grant the minimum required internal role.
3. Preserve user-facing authenticated context functions only where the product contract proves they are needed.
4. Prove trigger execution continues after direct EXECUTE is revoked.
5. In staging, test API denial, positive service-role/internal worker access, cron execution, the token boundary, regression, and the multi-tenant audit.
6. Re-run Security Advisor and compare the new findings with the recorded baseline.

**Release gate:** no bulk revoke and no production DDL until migration lineage is reconciled, the call graph is reviewed, and the staging acceptance matrix passes. The separate event-trigger draft in PR #89 is not applied to production.


## Function-body risk notes (read-only inspection; do not invoke)

- `pulse_external_intelligence_self_test()` creates a source, source item, signal and event under the first active industry, then attempts cleanup. It is a mutating production routine, not a harmless health check; do not use it to validate ACLs or staging behavior. Test its SQL body only against isolated fixtures.
- `pulse_capture_document_version(uuid)` writes document versions, per-version chunks and change events for the supplied document ID, with no caller authorization check in the function body. The inspected caller is the server-side intelligence worker; direct API execution is unnecessary and should be denied after staging verifies the worker call.
- `pulse_external_signal_deterministic_backstop()` mutates signal/event state over active recent source items, and `pulse_resolve_stale_intelligence_signals()` resolves signals. Both should be internal-only; never run them as part of an ACL audit.
- `pulse_external_intelligence_contract_check()` and `pulse_intelligence_external_quality_check()` are diagnostics that aggregate active-signal/evidence quality across the tenant data. Even though their result shape is counts/status rather than source content, their intended API audience and cross-industry aggregation should be reviewed before any public grant is retained.
- `auth_industry_context()` filters by `profiles.id = auth.uid()` and returns no row for an anonymous caller; `current_industry_id()` also derives its value from `auth.uid()` and active industry status. Preserve authenticated access only if the frontend genuinely needs these helpers and tests prove a user cannot switch or spoof industry context.

These function-body findings are based on `pg_get_functiondef` read-only catalog queries. No function was executed, no secret was read, and no production state changed. They strengthen the priority of least-privilege ACL staging but do not authorize a production revoke.
