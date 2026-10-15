# Staging acceptance — signal-event trigger and SECURITY DEFINER ACLs

**Purpose:** provide an executable review gate for issues #90, #91 and #92. This runbook is for a disposable/staging Supabase project only. It is not authorization to change production.

## Hard stops

- Do not use production project references, production API URLs, production database URLs, production keys, or production secrets in this procedure.
- Do not run recovered `docs/database/recovered-production-migrations/*.sql.txt` archives.
- Do not run `supabase db push` until the migration lineage decision and the forward-only migration have been reviewed and approved.
- Do not invoke mutating SECURITY DEFINER functions merely to see whether access is denied. Test permissions through catalog assertions and harmless controlled calls only.
- Never print, query for display, or log Vault values or worker tokens.

## Entry criteria

- [ ] PR #93's manifest check passes and the reviewer accepts the documented lineage limitation: SQL bodies are recoverable, original authoring/review provenance is not.
- [ ] A forward-only migration is generated with the supported Supabase CLI in a clean branch, based on current staged schema—not copied from an audit archive.
- [ ] The migration includes an explicit rollback/recovery decision. If restoring the prior trigger is the rollback, preserve the exact staged prior function body and trigger definition as review artifacts.
- [ ] PR #89's event behavior contract passes in ephemeral PostgreSQL.
- [ ] The staging project is disposable or restorable, has no production data, and uses staging-only Vault/Edge Function secrets.
- [ ] A reviewer confirms each ACL row's intended role and whether `PUBLIC`, `anon`, `authenticated`, `service_role`, or owner execution is required.

## Capture a baseline before applying the candidate

Record these values in the staging change record; do not treat event counts alone as proof of correctness.

1. Current trigger definition and its event/column scope.
2. Current `capture_intelligence_signal_event()` definition, owner, SECURITY DEFINER flag and function settings.
3. Effective `anon`, `authenticated`, `service_role` and owner EXECUTE privileges for every routine in `security-definer-acl-manifest-2026-10-15.csv`.
4. Current scheduled job name, owner, schedule and command for the external backstop.
5. Current event counts for a fixed synthetic signal fixture, plus event row values and ordering.
6. Security Advisor results and the existing multi-tenant regression result.

Do not copy production secrets or production signal payloads into the staging record.

## Required post-migration checks

### Event contract

Use isolated synthetic signal rows and deterministic timestamps. Assert both event count and row contents.

| Scenario | Required result |
|---|---|
| Insert active signal | Exactly one `new` event |
| Insert already-resolved signal | Exactly one `resolved` event |
| Update only `observed_at` / `updated_at` | No new event |
| Reapply identical confidence, status, fingerprint and evidence | No new event |
| Change confidence by less than 0.05 | No new event |
| Change confidence by exactly 0.05 or more | One event; direction matches delta |
| Change fingerprint with confidence unchanged | One `stable` event |
| Change evidence without changing fingerprint | No event |
| Transition active → resolved | Exactly one `resolved` event |
| Update an already-resolved signal | No repeated resolution event |
| Update fingerprint and confidence materially in one statement | Exactly one event, not one per field |

The ephemeral SQL contract in PR #89 is the minimum baseline; repeat the matrix against the candidate migration in the staging database before release.

### ACL contract

For each routine marked `internal_only` or `trigger_only` in the ACL manifest:

- [ ] `anon` direct EXECUTE is denied.
- [ ] `authenticated` direct EXECUTE is denied.
- [ ] Trigger execution continues for `capture_intelligence_signal_event()` when an authorized test statement updates a synthetic signal.
- [ ] The internal caller that legitimately uses the routine still succeeds with its intended role.
- [ ] User-context functions are tested with two distinct authenticated test users/industries; each receives only its own context.
- [ ] `review_required` routines are not revoked until call-site and returned-data review is signed off.
- [ ] No client-facing API can invoke a mutating routine indirectly without the expected authorization check.

Use `has_function_privilege(role, function_oid, 'EXECUTE')` to verify effective privileges without executing mutating functions. A denied-call assertion may use a harmless dedicated fixture routine in the isolated database, not a production routine with side effects.

### Cron → Vault → Edge Function

This is a separate end-to-end gate; the ephemeral trigger SQL test alone does not prove it.

- [ ] Verify the active staging cron job owner is the intended database owner and that the job remains enabled at the intended schedule.
- [ ] Run one controlled staging cron tick through the actual scheduler path.
- [ ] Confirm the Edge Function receives the staging token and accepts it without emitting the token to logs.
- [ ] Confirm a missing/invalid staging token is denied.
- [ ] Confirm the scheduler's direct EXECUTE is denied to `anon` and `authenticated`, while the scheduled owner path succeeds.
- [ ] Confirm no extra event rows appear from a no-op worker refresh.
- [ ] Confirm the scheduled run completes and produces redacted operational logs.
- [ ] Recheck the job schedule and owner after the migration.

Do not substitute a direct API call to the scheduler for the cron test: that bypasses the exact ownership and invocation path being validated.

## Release decision

Release is blocked if any event count/direction differs from the matrix, any API role can invoke an internal-only routine, the trigger stops firing, a legitimate server/cron call fails, the token is logged, cross-tenant isolation fails, or the Security Advisor reports a new unexplained finding.

Attach the migration hash, CI links, staging change record, before/after privilege matrix, event matrix results, cron execution evidence, Security Advisor delta and rollback steps to the reviewed PR. Require a separate explicit release decision after all evidence is attached.

**Current state (2026-10-15):** this runbook is a checklist only. No staging migration has been applied and no production state has changed.
