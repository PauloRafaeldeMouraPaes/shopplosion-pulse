# SECURITY DEFINER ACL audit — 2026-10-15

**Read-only inventory. No function was invoked and no production ACL, schema, data, cron job, or secret was changed.** Effective privileges were queried with `has_function_privilege` against every SECURITY DEFINER routine in the exposed `public` schema. This is a snapshot, not a remediation migration.

## Routines currently executable by API roles

| Routine signature | anon | authenticated | Observed dependency / initial disposition |
|---|---:|---:|---|
| `auth_industry_context()` | yes | yes | Returns only the row whose `profiles.id = auth.uid()`. Intended user-facing context appears authenticated-only; revoke `anon`, preserve `authenticated`, then verify no unauthenticated RPC contract depends on the empty result. |
| `capture_document_version()` | yes | yes | Trigger-returning function; no non-internal trigger dependency was found in the live catalog. Direct API execution is unnecessary for ordinary clients; revoke direct API grants after confirming no hidden trigger attachment in staging. |
| `capture_intelligence_signal_event()` | yes | yes | Attached to the `intelligence_signals` trigger. Remove direct API access only after proving trigger invocation remains functional. |
| `pulse_capture_document_version(uuid)` | yes | yes | Called by `supabase/functions/pulse-intelligence-worker/index.ts` through the server-side Supabase admin client. Preserve the internal worker path; direct `anon`/`authenticated` access is not required by the inspected caller. |
| `pulse_external_backstop_schedule_tick()` | yes | yes | Internal scheduler reads Vault token and dispatches the deterministic-backstop Edge Function; internal-only. |
| `pulse_external_intelligence_contract_check()` | yes | yes | Aggregates active signals and evidence-grounding failures across industries. This is a cross-tenant operational diagnostic, not a demonstrated client contract; internal-only unless an explicit product/API contract is found. |
| `pulse_external_intelligence_fallback_candidate(uuid)` | yes | yes | Called by `supabase/functions/pulse-external-deterministic-backstop/index.ts` through its server-side admin client. Preserve service-role access; direct `anon`/`authenticated` access is not required by the inspected caller. |
| `pulse_external_intelligence_self_test()` | yes | yes | Confirmed mutating: creates a synthetic source, item, and signal in an active industry. Internal-only; direct API execution is inappropriate and the test must run only in isolated environments. |
| `pulse_external_signal_deterministic_backstop()` | yes | yes | Confirmed mutating: scans recent active source items and creates or updates intelligence signals/events. Internal-only; allow only the trusted server worker path. |
| `pulse_intelligence_external_quality_check()` | yes | yes | Aggregates active signal/evidence checks across industries. No user-scoped filter or client contract was found in the definition; internal-only by default. |
| `pulse_resolve_stale_intelligence_signals()` | yes | yes | Confirmed mutating: resolves active signals older than three days when no recent event exists. Internal-only; allow only the trusted temporal/worker path. |
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

## Definition-level classification refinement (read-only, 2026-10-15)

A second catalog pass inspected function bodies without invoking them:

- `auth_industry_context()` filters on `profiles.id = auth.uid()`, so the minimum plausible API contract is `authenticated`, not `anon`.
- `capture_document_version()` is a trigger-returning routine with no non-internal trigger dependency in the current catalog; it should not be callable directly by API roles.
- `pulse_capture_document_version(uuid)` is a mutating document-version capture path and its inspected application caller is the internal intelligence worker; retain the trusted worker's ability, not direct API-role execution.
- `pulse_external_intelligence_contract_check()` and `pulse_intelligence_external_quality_check()` aggregate quality findings across active signals without a user/tenant filter in the routine body. Treat these as internal diagnostics unless a constrained, tenant-scoped client contract is demonstrated.
- `pulse_external_intelligence_self_test()` creates synthetic source/item/signal rows in an active industry. It must not be directly callable by client roles and should run only in an isolated test environment.
- `pulse_external_signal_deterministic_backstop()` creates or updates signals/events from recent active source items; `pulse_resolve_stale_intelligence_signals()` changes active signals to resolved. Both are internal mutation paths.

This narrows the disposition but is still not an ACL migration. Before remediation, confirm grants inherited through `PUBLIC`, run positive/negative role tests in staging, and preserve trigger/cron/service-role execution. The production database remains read-only for this investigation.

## Candidate ACL coverage cross-reference (2026-10-15)

Draft PR #89 now proposes direct API-role revokes for the trigger function, backstop scheduler and fallback-candidate lookup, plus the internal-only routines `pulse_capture_document_version(uuid)`, `pulse_external_intelligence_self_test()`, `pulse_external_signal_deterministic_backstop()`, `pulse_resolve_stale_intelligence_signals()`, `pulse_external_intelligence_contract_check()`, `pulse_intelligence_external_quality_check()`, and the currently unattached `capture_document_version()` trigger function. It also proposes removing `PUBLIC`/`anon` access to `auth_industry_context()` while explicitly preserving `authenticated` access. The ephemeral PostgreSQL contract now verifies these denials, the authenticated-only user-context contract, and preservation of explicit `service_role` execution. `current_industry_id()` remains unchanged pending the final frontend/RLS contract review.

The expanded candidate is still not a production migration. The actual staging cron → Vault → Edge Function path, API denial against the staged grants, trigger execution after revocation, and Security Advisor delta remain release gates. The linked runbook is `staging-signal-event-acl-acceptance.md`.
