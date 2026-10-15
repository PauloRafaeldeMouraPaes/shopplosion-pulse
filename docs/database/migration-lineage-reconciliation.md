# Migration lineage reconciliation

Status: investigation only. No production schema, data, grants, or migration history has been changed.

## Verified state

- Supabase production reports **69 timestamped migrations**, from `20260907035807` through `20260922041853`.
- The repository contains a numbered migration at `supabase/migrations/010_knowledge_updates_saved_evidence.sql`. Its content matches the production migration named `010_knowledge_updates_saved_evidence` at version `20260922032516`; this is one confirmed mapping, not proof of complete lineage.
- The production history also includes entries such as `005_performance_indexes`, `007_document_search_vector`, and `008_document_indexing_summary`. The corresponding files were not found at the expected `supabase/migrations/<name>.sql` paths on the default branch. This does not establish whether they were renamed, squashed, stored elsewhere, or applied out of band.
- The live signal-event trigger/function and the current SECURITY DEFINER grants require a separate reviewed migration. Do not infer its original migration from current production state alone.

## Required reconciliation

1. Inventory every tracked SQL migration and its Git history, including deleted/renamed files and migrations stored outside `supabase/migrations/`.
2. Map all 69 production versions to authoritative SQL or explicitly document each gap as renamed, squashed, out-of-band, or unrecoverable. Record the evidence for each mapping.
3. Compare the live trigger, function bodies, grants, policies, and scheduler definitions against the reconciled source.
4. Add CI drift detection so checked-in migrations and production history cannot silently diverge again.
5. Stage the trigger deduplication and SECURITY DEFINER grant corrections, then test timestamp-only updates, no-op updates, confidence/fingerprint changes, resolution transitions, cron execution, denial for `anon`/`authenticated`, trusted internal success, regression, and Security Advisor.
6. Document rollback and recovery before any production release.

## Release gate

**Do not run `supabase db push`, apply DDL, alter grants, or merge the database fix until the complete lineage is reconciled and reviewed.** The current branch is documentation only; no migration or production change is included.


## Additional read-only production findings (2026-10-15)

The live trigger/function definition was retrieved read-only:

- Trigger: `AFTER INSERT OR UPDATE OF confidence, status, evidence, observed_at` on `public.intelligence_signals`.
- The trigger function inserts an event on every invocation and does not compare `OLD` and `NEW` semantically. The update branch classifies confidence movement below 0.05 as `stable`, but still inserts the event.
- The `ON CONFLICT DO NOTHING` clause does not provide semantic deduplication: the event table's only unique index observed is the UUID primary key on `id`; the signal/time indexes are non-unique.
- Current read-only counts: 2,156 events for 33 signals. These counts are diagnostic, not proof that all rows are duplicates.
- The cron-facing `pulse_external_backstop_schedule_tick()` reads a token from Vault and sends it in `x-pulse-cron` to the deterministic-backstop Edge Function. The Edge Function independently checks that header against `pulse_intelligence_worker_token` before doing work. Keep this internal path working when tightening direct RPC privileges.

## Trigger behavior acceptance matrix

The staging migration/test suite should establish the following observable behavior before production rollout:

| Operation | Expected event behavior |
|---|---|
| Insert a signal | Exactly one initial event |
| Update only `observed_at` / `updated_at` | No new event |
| Reapply identical confidence, status, fingerprint and evidence | No new event |
| Change confidence by less than 0.05 with no material fingerprint/status change | No new event |
| Change confidence by at least 0.05 | One event, direction matches confidence delta |
| Change fingerprint materially | One event, direction not incorrectly labelled `up` solely because evidence changed |
| Change evidence while fingerprint is unchanged | No event unless the approved contract explicitly treats the evidence change as material |
| Transition active to resolved | Exactly one `resolved` event |
| Update an already resolved signal without another resolution transition | No repeated resolution event |
| Run scheduler as trusted database role | Scheduler continues to invoke the authenticated Edge Function |
| Attempt direct invocation as `anon` or `authenticated` | Denied for internal-only routines |
| Invoke internal path with valid token | Continues to work; invalid/missing token denied |

The fingerprint/evidence materiality rule must be agreed in the reviewed migration, because the current worker code fingerprints evidence payloads. Tests must use deterministic timestamps and verify both event count and row values.

## Security review note

The current Security Advisor reports 11 functions executable by `anon` and 12 by `authenticated` among the exposed `SECURITY DEFINER` functions. Do not bulk-revoke without call-graph analysis: distinguish trigger-only functions, user-facing context RPCs, and internal worker/scheduler functions. The scheduler/Edge Function path above is a required regression case. No ACLs were changed during this audit.
