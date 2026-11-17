# Staging replay of the production migration history (2026-11-17)

Status: staging only. Production was read, never written: no DDL, grant, data or migration-history change in project `ppfuygnpgywfpiqxsfys`.

## Staging project

- Supabase project **Pulse Staging**, ref `ymitcepxpavjedntylem`, region `sa-east-1`, free plan, organization "Shopplosion Pulse". Created 2026-11-16 because Supabase branching is a paid feature.
- No production data, keys or Vault values. Vault secrets on staging are random values generated during the replay.
- Every pg_cron job is unscheduled after the replay (the seven replayed jobs). Staging Edge Functions are not deployed.

## How the replay was built and applied

`scripts/staging/build-staging-replay.py <dir>` writes the 77 ordered steps from the lineage manifest:

| Step | Source | Note |
|---|---|---|
| 000 | `scripts/staging/replay-fixtures/000_out_of_band_rls_auto_enable.sql` | `public.rls_auto_enable()` and event trigger `ensure_rls` exist in production but no tracked migration creates them (dashboard "auto-enable RLS" option). Step 005 revokes on that function and fails without it. |
| 001-003 | `supabase/migrations/001..003` | Applied in production before the ledger started on 2026-09-07. |
| 004-075 | the 72 production versions in ledger order | Repo file when the manifest maps one (4 rows), recovered body otherwise (68 rows). Production ref replaced by the staging ref; the two redacted Vault values in `20260907230216` replaced by `gen_random_uuid()`-based values. |
| 076 | `scripts/staging/replay-fixtures/999_production_out_of_band_drift.sql` | Production drift found by the catalog comparison below. |

Applied with the Supabase MCP `apply_migration` in 10 groups plus the fixtures. One deviation during the run: step `20260907213555` (`cron.unschedule('pulse-index-pending-worker')`) was made conditional because the job had been unscheduled early in the run; the generated file keeps the original body. Every step ran without error.

## Findings

1. **Repo migration 004 never reached production.** `document_chunks_document_industry_fkey`, `documents_id_industry_id_uidx` and `document_chunks_document_industry_idx` are absent from production. Earlier notes assumed 001-004 predate the ledger; only 001-003 do. Staging mirrors production (004 is not in the replay).
2. **Out-of-band objects in production** (not created by any tracked migration):
   - table `public.intelligence_quality_runs` and policy `intelligence_quality_runs_select`;
   - function `public.capture_intelligence_signal_event()` and trigger `intelligence_signal_event_capture` (the object issues #89/#90 fix);
   - check `document_chunks_source_type_check` also accepts `'pdf'`;
   - EXECUTE on `pulse_intelligence_quality_check()` limited to owner and `service_role`;
   - pg_cron job `pulse-intelligence-quality-daily` (`45 6 * * *`).
3. `public.current_industry_id()` in production differs from the repo only by CRLF line endings.

## Catalog comparison

`scripts/staging/catalog-fingerprint.sql` hashes, per category, tables and columns (types, nullability, defaults), RLS flags, views, function bodies (project ref and CR normalised), function ACLs, policies, triggers, indexes, table ACLs, constraints, extensions and event triggers. After steps 000-076, **all 12 categories are identical between staging and production** (same object counts and same hash per category). pg_cron is the only intended difference: production keeps 8 active jobs, staging has none.

## Acceptance run for the signal-event migration (issues #89, #90, #99)

Harness: `scripts/staging/signal-event-matrix.sql`, schema `pulse_staging_test` on staging only. A run raises at the end, so all synthetic rows roll back and the results come back as JSON in the error message.

Baseline (current production trigger and grants, reproduced on staging):

| Area | Pass | Fail |
|---|---|---|
| Event matrix (12 scenarios of `staging-signal-event-acl-acceptance.md`) | 4 | 8 |
| ACL matrix (13 routines) | 2 | 11 |

Event failures on the current trigger: a timestamp-only update, a no-op update, an evidence-only change and a sub-0.05 confidence change each write an event; a fingerprint change writes none; active to resolved is recorded as `new`; an update to a resolved signal writes another `resolved`; a fingerprint plus confidence change is recorded as `new` instead of `up`.

ACL failures: `anon` and `authenticated` hold EXECUTE (through the default `PUBLIC` grant) on the two trigger functions, the backstop scheduler, the fixture-writing self test, the six worker routines and `auth_industry_context()`. Revokes from `anon` alone in earlier migrations did not remove the `PUBLIC` grant. In production this means the public API key can call, for example, `rpc/pulse_external_backstop_schedule_tick` and `rpc/pulse_external_signal_deterministic_backstop`.

Candidate: `docs/database/signal-event-trigger-draft.sql` (sha256 `1ad64025e1277eb61c1c8ab3813b0dc005c1de42d75fe48a69e0ddd81371252e`). **Not yet applied on staging**: the Supabase connector asks the owner to confirm DDL that contains REVOKE/DROP, and the confirmation was cancelled automatically while the owner was away. Next run, once confirmed: apply the candidate, rerun the matrix, then the remaining gates of `staging-signal-event-acl-acceptance.md` (authenticated tenant isolation with two synthetic users, cron to Vault to Edge Function with staging functions deployed, Security Advisor delta).

## Reproduce

```bash
python3 scripts/staging/build-staging-replay.py /tmp/staging-replay   # 77 files
# apply in order to the staging project only, then:
#   select cron.unschedule(jobid) from cron.job;
# compare: run scripts/staging/catalog-fingerprint.sql on both projects (read-only)
```
