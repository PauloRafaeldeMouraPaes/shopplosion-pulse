# Migration lineage reconciliation

Status: investigation only. No production schema, data, grants, or migration history has been changed.

## Verified state

- Supabase production reports **72 timestamped migrations**, from `20260907035807` through `20260922041853`.
- The active repository migration directory still contains 10 SQL files. Four production versions map to current files by SQL Git-blob SHA (three exact and one after trimming only terminal CR/LF).
- The remaining 68 SQL bodies have now been retrieved read-only from `supabase_migrations.schema_migrations.statements[1]` and archived verbatim under `docs/database/recovered-production-migrations/*.sql.txt`; each archive's Git-blob SHA-1 matches the production-stored statement SHA-1. The original Git authoring paths, reviews and commit provenance for these 68 entries remain unproven.
- The live signal-event trigger/function and SECURITY DEFINER grant fixes still require separately reviewed forward migrations. Recovering exact SQL bodies does not make them safe to replay or make `supabase db push` safe.

## Per-version reconciliation manifest (2026-10-15)

The read-only production migration listing is preserved row-by-row in `docs/database/production-migration-lineage-manifest.csv`. It contains all 72 production versions. Four rows map to existing active migration files by Git-blob SHA; the other 68 map to new, verbatim audit archives recovered from the production migration ledger. An archive mapping establishes the exact SQL body, not its original Git authoring path or review provenance.

The manifest is an auditable snapshot, not a live drift detector and not authorization to replay migrations. The legacy production names `005_performance_indexes`, `007_document_search_vector`, and `008_document_indexing_summary` do not match current active filenames; their SQL bodies are available in the archive using their production version/name. Git authoring history and the reason the original files are absent remain unclassified.

## Required reconciliation

1. Inventory every tracked SQL migration and its Git history, including deleted/renamed files and migrations stored outside `supabase/migrations/`.
2. Map all 72 production versions to authoritative SQL or explicitly document each gap as renamed, squashed, out-of-band, or unrecoverable. Record the evidence for each mapping.
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


## Repository inventory cross-check (2026-10-15)

A recursive tree read of the current `main` commit confirms there are exactly 10 tracked `.sql` files, all under `supabase/migrations/`; there are no additional SQL migration files elsewhere in the current tree. The repository uses descriptive numbered filenames, while production uses 14-digit timestamp versions and historical names. Therefore, comparing filenames alone is insufficient.

### Evidence-backed mappings found so far

| Production version | Production name | Current repository file | Assessment |
|---|---|---|---|
| `20260922030555` | `create_investigations_and_link_analyses` | `007_investigations_and_analysis_link.sql` | Strong semantic match; verify complete SQL equivalence before calling exact |
| `20260922030641` | `complete_analysis_artifact_metadata` | `008_analysis_artifact_metadata.sql` | Strong semantic match; verify complete SQL equivalence before calling exact |
| `20260922031240` | `create_shopper_knowledge_layer` | `009_shopper_knowledge_layer.sql` | Strong semantic match; verify complete SQL equivalence before calling exact |
| `20260922032516` | `010_knowledge_updates_saved_evidence` | `010_knowledge_updates_saved_evidence.sql` | Name and content correspondence confirmed |

These four mappings are supported by SQL Git-blob hashes, not just names. The checked-in files `005_evidence_qualification.sql` and `007_investigations_and_analysis_link.sql` do **not** correspond by filename to production `005_performance_indexes` or `007_document_search_vector`; likewise `008_analysis_artifact_metadata.sql` is not the same named migration as production `008_document_indexing_summary`. Treating numeric prefixes as identities would be unsafe.

### Quantified gap

- Current tracked SQL files: **10**.
- Production migration-history rows: **72**.
- Four mappings are confirmed by SQL Git-blob SHA-1: three exact matches and one match after trimming terminal CR/LF only.
- The other 68 statements are now recoverable exactly from the production ledger and archived outside the active migration directory. Their original Git path/approval provenance is still unresolved, so they must not be treated as reviewed current migrations.

The historical commit/tree inspection did not find the three exact production-named files under those paths. The SQL archive closes the exact-body gap but does not prove where the statements were authored, reviewed, or why their original files are absent.

## Next safe technical step

Build a reviewed manifest with one row per production version: `version`, `production_name`, `repo_path`, `repo_blob_sha`, `mapping_type`, `evidence`, `review_status`. Only after this manifest accounts for all 72 entries should CI enforce it. Do not fabricate placeholder migrations or create timestamped no-op files just to make counts match.


### Live schema cross-check for the four recent candidate mappings

A read-only comparison of production columns, indexes and RLS policies against the checked-in SQL confirms that the following files describe the corresponding live feature sets, although exact historical SQL equivalence still requires the original migration bodies or a reviewed normalized diff:

- `007_investigations_and_analysis_link.sql`: production `investigations` table and `analyses.investigation_id` are present, with the expected tenant-scoped indexes/policies.
- `008_analysis_artifact_metadata.sql`: production `analyses.status`, `limits`, `published_at`, and `analyses_status_idx` are present.
- `009_shopper_knowledge_layer.sql`: production `shopper_knowledge` has the expected claim/source/segment/category/mission/period/confidence/status/evidence/payload fields and investigation indexes.
- `010_knowledge_updates_saved_evidence.sql`: production `knowledge_updates`, `saved_evidence`, scope column and their indexes/policies match the checked-in feature definitions.

The live schema cross-check corroborates the four mappings to current active files. For the other 68 rows, exact SQL is now archived directly from the production ledger, but the live schema still cannot establish original authoring/review history or explain why the original files are absent.


## Machine-readable inventory

The full read-only production listing is recorded in [production-migration-lineage-manifest.csv](production-migration-lineage-manifest.csv): **72 rows**, one per production version. Four rows map to existing active migrations and 68 map to exact SQL archives recovered from production. Original authoring provenance remains unresolved, and this manifest is not authorization to replay or push migrations.


## Exact SQL identity checks (2026-10-15)

The production migration table stores the SQL statement payloads. I computed the Git blob SHA-1 for each stored statement directly in PostgreSQL (without returning the SQL text) and compared it with the Git blob SHAs of the 10 checked-in files. Results:

- **3 exact byte-for-byte matches:** production `20260922030641 / complete_analysis_artifact_metadata` ↔ `008_analysis_artifact_metadata.sql`; `20260922031240 / create_shopper_knowledge_layer` ↔ `009_shopper_knowledge_layer.sql`; and `20260922032516 / 010_knowledge_updates_saved_evidence` ↔ `010_knowledge_updates_saved_evidence.sql`.
- **1 match after trimming terminal CR/LF only:** production `20260922030555 / create_investigations_and_link_analyses` ↔ `007_investigations_and_analysis_link.sql`. The stored statement is one character longer; the trimmed Git blob SHA matches exactly.
- The other **68 production versions** do not match the 10 current active files, even after terminal CR/LF trimming. Their exact production SQL bodies are now archived under `docs/database/recovered-production-migrations/`; their original Git paths and review provenance still require classification.
- This also proves the numeric prefix is not an identity: production `005_performance_indexes`, `007_document_search_vector`, and `008_document_indexing_summary` do not match current files with the same numeric prefixes.

The manifest now records statement length, production Git blob SHA-1, trimmed SHA-1, checked-in file SHA, and mapping status for every one of the 72 production versions. This is a stronger, reproducible comparison than filename matching. No SQL payload was copied into the active migration directory, and no production changes were made.


## Historical Git path audit (2026-10-15)

I queried GitHub's commit history separately for each of the 10 SQL paths currently tracked under `supabase/migrations/`. The current tracked files first appear in these commits:

| File(s) | First observed commit date (UTC) | Commit |
|---|---|---|
| `001_multitenant_core.sql`, `002_storage_and_membership_hardening.sql` | 2026-09-04 | `d293073f` |
| `003_private_document_intelligence.sql` | 2026-09-04 | `842b03b4` |
| `004_private_document_integrity.sql` | 2026-09-06 | `66cb6907` |
| `005_evidence_qualification.sql` | 2026-09-20 | `f39f226b` |
| `006_analysis_artifact_state.sql` | 2026-09-20 | `852da60c` |
| `007_investigations_and_analysis_link.sql` | 2026-09-22 | `da059386` |
| `008_analysis_artifact_metadata.sql` | 2026-09-22 | `42132cfa` |
| `009_shopper_knowledge_layer.sql` | 2026-09-22 | `d72aaa19` |
| `010_knowledge_updates_saved_evidence.sql` | 2026-09-22 | `5aa4e393` |

The path-history endpoints returned only these introduction commits for the respective paths; no later path revisions or deletion/rename entries were returned for these current filenames. This is a path-history finding, **not** proof that an equivalent SQL statement never existed under another path, in a squash/baseline, or outside Git.

The timeline narrows the search but does not classify the 68 unmatched production versions. In particular, production history begins on 2026-09-07, while current files 005 and 006 were first committed on 2026-09-20; that chronology alone cannot prove which historical SQL was applied or whether it was consolidated. Keep those rows unresolved until the original SQL, authoritative baseline, or independently reviewable normalized schema diff establishes provenance. No migration files were created or changed as part of this history check.


## Full SQL-tree sweep across migration-path history (2026-10-15)

I retrieved the nine commits returned by GitHub's history endpoint for `supabase/migrations` (from 2026-09-04 through 2026-09-22), then recursively inspected each commit tree. Across those nine snapshots, the only tracked `.sql` files found anywhere in the repository are the same cumulative set of ten files under `supabase/migrations/`. No additional SQL file path was found in any of those snapshots, and the per-file history endpoints did not return rename/deletion history for the ten current paths.

This is evidence that the 68 production statements are not present as matching SQL blobs in the inspected Git branch-tip snapshots. Their exact bodies have since been recovered from the live production migration ledger into non-executable `.sql.txt` audit archives. This still does **not** prove where they were originally authored or whether they were ever present in unreachable commits, another repository, manual SQL sessions or external backups; do not assert `out_of_band` solely from the branch-tip sweep.

The latest PR #93 documentation commit has all repository CI checks complete: regression, browser smoke, evidence contract, private AI audit, multi-tenant audit, and validate passed; Netlify redirect processing passed, while header/pages checks concluded neutral. This validates the documentation change only, not production lineage or database behavior.


## Cross-branch candidate migration review (2026-10-15)

A targeted branch-tip audit found one additional SQL candidate outside `main`: branch `docs/cross-signal-market-human-behavior` contains `supabase/migrations/20261011174650_immutable_source_observation_history.sql`, its design draft under `docs/pilots/`, and a synthetic PostgreSQL fixture. Its Git blob does not match any of the 72 production SQL statement hashes, and its timestamp (2026-10-11) is later than the newest production migration version (2026-09-22). It is therefore a **proposed future migration**, not historical source for the 68 unresolved production rows.

The branch's PR #80 remains open as Draft. Its actual 23-file diff includes the source worker and the candidate migration, although the previous description said the PR did not change workers or the database. The description was corrected on 2026-10-15 to identify the real scope and the release gates: [PR #80](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/pull/80). After comparing the 31 paths changed by main since the original merge base against the 23 paths changed by PR #80 and finding no overlap, I merged current main commit `64f9a31d3421e560ca91c53a4585011cba779980` into the PR branch using merge commit `ed2efb84942d10b2a8082ea3a829786de5a51420`. Compare now reports the branch as ahead by 124 and behind by 0. This was a branch synchronization only; PR #80 remains Draft and is not merged into main.

CI on the branch head passed the five Pulse workflows; specifically, its Regression job generated/verified the migration with Supabase CLI, tested it against PostgreSQL 17 in an ephemeral database, type-checked the worker, and ran unit tests for retry, failure bookkeeping, fingerprinting and source identity. This is useful isolated validation, but **not** completion of H01-H15 and not proof of production compatibility. The branch's own test contract still flags H13 as not implemented, H07 as deny-all rather than tenant-scoped read validation, and H09/H15 as missing end-to-end worker failure/reconciliation tests.

A read-only query of production confirms that the existing `intelligence_source_item_versions` and `intelligence_source_item_observations` tables are absent. Current `intelligence_source_items` has five `active` and 21 `rejected` rows at the time of this check. The current `main` worker still sets `status='active'` during a source-item upsert, so it can silently undo a rejection on recapture. In the separate candidate branch PR #80, the proposed RPC was updated to preserve `status='rejected'` until explicit review; the R01 synthetic PostgreSQL regression exercises an identical recapture. Regression passed on code head `20f7361ed56c32a101ba91b4f56c9b65f82fc996` and again on synchronized branch head `ed2efb84942d10b2a8082ea3a829786de5a51420`, where all five Pulse workflows passed. On the latest docs-only head `9fee64b1369973113bd265fe5c5b621edc558e12`, all five Pulse workflows passed: Regression (both jobs), Browser Smoke, Evidence Contract, Private AI Audit and Multi-Tenant Audit; Validate passed as well. Netlify redirect processing passed and header/pages checks were neutral because those rule files were unchanged. This remains synthetic CI only. PR #80 remains Draft, and this behavior has not been applied to production. No production DDL or data was changed.

This candidate may help the future Chocolate capture system preserve history, but it does not solve the historical migration gap and is not authorized for production application. The 68 unmatched production versions remain unresolved.


## Accessible branch-tip sweep completed (2026-10-15)

The repository exposes 113 branch names across its two paginated branch listings. I inspected the recursive Git tree for all 93 distinct commit SHAs at those branch tips (duplicate branch names pointing to the same commit were counted once). For each tree, I compared tracked SQL blob SHAs with the 72 production statement blob hashes and terminal-CR/LF-trimmed hashes in the manifest.

Result: no additional SQL blob in those accessible branch-tip snapshots maps to the 68 bodies missing from the current active migration files. The four positive mappings to active files remain unchanged; the other SQL files in older branch tips are the cumulative 001–006 set, or the same current 001–010 set. The missing bodies are now archived from production-ledger source, but this still does not recover their original Git provenance. The separate immutable-source-history migration remains a future proposal, not historical source for any production version.

This materially broadens the negative Git-history evidence, but it is not proof about non-tip/unreachable Git objects, deleted remote refs, another repository, manual SQL or backups. The manifest now labels those 68 bodies `recovered_from_production_history` rather than `unmapped`; the original authoring provenance remains unknown and must not be inferred to be `out_of_band` solely from absence in the inspected branch tips.

## Latest verification

On commit `de15f7702b066739bf89894d26e2ca364f4735f9`, all Pulse CI checks have now completed successfully, including Browser Smoke, Regression, Evidence Contract, Private AI Audit, Multi-Tenant Audit and Validate. Netlify redirect processing succeeded; header/pages checks were neutral because that commit did not include those rule files. These checks validate this documentation-only branch; they do not establish production migration lineage or production database correctness.


## Targeted signal-worker ACL cross-check (2026-10-15)

A fresh read-only inspection of production confirms the following current grants:

- `public.capture_intelligence_signal_event()`: `SECURITY DEFINER`, owner `postgres`, direct EXECUTE for `PUBLIC`, `anon`, `authenticated`, and `service_role`; `search_path=public`.
- `public.pulse_external_backstop_schedule_tick()`: `SECURITY DEFINER`, owner `postgres`, direct EXECUTE for `anon`, `authenticated`, and `service_role`; `search_path=public, extensions, vault, pg_catalog`.
- `public.pulse_external_intelligence_fallback_candidate(uuid)`: `SECURITY DEFINER`, owner `postgres`, direct EXECUTE for `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- `public.pulse_intelligence_worker_token()` is not directly executable by `anon` or `authenticated`; `service_role` can execute it.

The active cron job `pulse-external-backstop-hourly` runs as `postgres` on schedule `15 * * * *` and invokes `select public.pulse_external_backstop_schedule_tick();`. This means direct API grants on the scheduler are not required for the current cron owner, but any revocation must be validated against the real scheduled execution and its Vault-to-Edge-Function token path before release.

The latest Security Advisor read still reports 11 SECURITY DEFINER routines executable by `anon` and 12 executable by `authenticated`. No ACL, trigger, function, cron definition, or production data was changed during this read-only check. The signal-trigger draft in PR #89 proposes narrowly revoking direct API execution from the trigger, scheduler, and internal fallback-candidate lookup while preserving `service_role` access where required; this remains a candidate, not an applied production change. Other Advisor findings require call-graph classification and must not be bulk-revoked.


## Function ACL inventory refresh (read-only, 2026-10-15)

A fresh catalog query enumerated every SECURITY DEFINER function in exposed schema public, including effective EXECUTE privileges for anon, authenticated, and service_role. This is a privilege inventory, not authorization to change grants. It confirms that the current issue is broader than the two routines named in the initial event-fix draft.

### Client-executable SECURITY DEFINER routines observed

| Routine | anon | authenticated | Initial disposition |
|---|---:|---:|---|
| auth_industry_context() | yes | yes | User-context RPC; inspect RLS/callers before deciding whether anon access is intentional |
| capture_document_version() | yes | yes | Trigger function; review/revoke direct execution without breaking trigger invocation |
| capture_intelligence_signal_event() | yes | yes | Trigger function; review/revoke direct execution without breaking trigger invocation |
| pulse_capture_document_version(uuid) | yes | yes | Mutating/version-capture RPC; inspect application call sites and intended audience |
| pulse_external_backstop_schedule_tick() | yes | yes | High priority: internal scheduler that reads Vault token and dispatches Edge Function work |
| pulse_external_intelligence_contract_check() | yes | yes | Diagnostic/quality routine; classify returned data and operational exposure |
| pulse_external_intelligence_fallback_candidate(uuid) | yes | yes | Internal content/evidence candidate lookup; restrict to trusted server path unless reviewed otherwise |
| pulse_external_intelligence_self_test() | yes | yes | Mutating self-test; inspect fixture creation and cleanup before any access is allowed |
| pulse_external_signal_deterministic_backstop() | yes | yes | Mutating backstop; should be internal-only unless a constrained caller is proven |
| pulse_intelligence_external_quality_check() | yes | yes | Diagnostic/quality routine; classify returned data and operational exposure |
| pulse_resolve_stale_intelligence_signals() | yes | yes | Mutating resolution routine; should be internal-only unless a constrained caller is proven |

The same catalog query observed current_industry_id() as executable by authenticated but not anon; scheduler functions for Ask AI, external signals, external source collection, indexing, RAG evaluation and intelligence were executable only by service_role (and their database owner), as was pulse_intelligence_worker_token(). These are comparison controls, not proof that every other grant is correct.

### Confirmed behavior and limits

- capture_intelligence_signal_event() remains a duplicate-event source: it inserts an event for every qualifying trigger invocation and has no semantic OLD/NEW no-op guard.
- pulse_external_backstop_schedule_tick() uses Vault and net.http_post to invoke the deterministic-backstop Edge Function with x-pulse-cron; the function itself checks that token. The database scheduler path must be validated in staging as the database owner, without exposing scheduler execution to API roles.
- This refresh did not call any exposed routines, invoke the scheduler, read secrets, or change production grants/data/schema.
- A blanket revoke is not yet justified for all 11 rows: auth_industry_context() may be a deliberate user-facing context RPC, and trigger functions must remain invocable through their triggers even when direct EXECUTE is removed. For each routine, document the caller, expected role, data returned/mutated, trigger/cron dependencies, and positive/negative test before generating the ACL migration.
- Security Advisor findings are privilege warnings, not a substitute for reviewing each function body and call graph. Do not declare the security issue closed until the post-change advisor and staging acceptance matrix pass.

### Required follow-up before migration

1. Add a per-routine disposition to the ACL manifest: internal_only, authenticated_user_context, trigger_only, or review_required.
2. For every routine, record direct and inherited grants, ownership, trigger/cron references, and application call sites.
3. Stage least-privilege revokes and only the minimum positive grants. Explicitly test that trigger execution continues after direct EXECUTE is revoked, and that the trusted cron owner can still execute the scheduler.
4. Validate API denial for anon and authenticated, expected authenticated context access (if retained), service-role worker access, cron-to-Vault-to-Edge Function execution, and the complete signal-event behavior matrix.
5. Re-run Security Advisor and the multi-tenant audit; compare results against a recorded baseline.

This inventory adds evidence to issue #90 and issue #91; it does not change their release gates.


The routine-by-routine read-only ACL inventory is now tracked in [security-definer-acl-manifest-2026-10-15.csv](security-definer-acl-manifest-2026-10-15.csv). It records the observed effective grants, dependencies, initial disposition and required positive/negative tests for all exposed SECURITY DEFINER routines reviewed. This manifest is an audit artifact only; the dispositions are not a production grant change.


### Trigger dependency cross-check

A fresh read-only catalog inventory of non-internal triggers in schema public whose target function is SECURITY DEFINER found one attachment: intelligence_signals.intelligence_signal_event_capture → capture_intelligence_signal_event(), AFTER INSERT OR UPDATE OF confidence, status, evidence, observed_at. No non-internal public trigger currently references capture_document_version(); its initial manifest disposition is therefore review_required (possible legacy/orphaned routine), not trigger_only. This distinction must be preserved in the ACL migration: never infer a trigger dependency from a function name alone.


### Active cron call graph cross-check (read-only)

The active cron inventory confirms the database scheduler owner is postgres for the current worker schedules: external backstop (15 * * * *), external signal worker (15 */3 * * *), external source worker (0 */3 * * *), index worker (every minute), intelligence daily (06:30), Ask AI eval (06:15), RAG eval (06:00), and intelligence quality check (06:45). Each command is a direct call to its named public scheduler/check routine. In the current ACL catalog, the worker/scheduler routines in this list are denied to anon/authenticated except pulse_external_backstop_schedule_tick(), which remains exposed and is the highest-priority scheduler grant defect. The quality-check job calls pulse_intelligence_quality_check(), which is not SECURITY DEFINER in the current inventory and is outside this specific manifest.

The cron owner being postgres is evidence for preserving owner execution; it is not evidence that service_role must have EXECUTE on every scheduler. Stage the least-privilege grant matrix and verify cron still succeeds after direct API privileges are removed.

## Production SQL-body recovery archive — 2026-10-15

The read-only production ledger `supabase_migrations.schema_migrations` contains one SQL statement in `statements[1]` for each of its 72 versions. I retrieved the 68 bodies that lacked a source-file match, checked each character length against the manifest, recomputed its Git blob SHA-1, and verified the result exactly matched the production statement hash. A literal-secret heuristic was also applied before archival; no retrieved body tripped it.

The exact bodies are now preserved under `docs/database/recovered-production-migrations/` as `.sql.txt` audit artifacts, outside the active `supabase/migrations/` directory. The canonical machine-readable manifest now has **4 mappings to current active migration files + 68 exact body recoveries from the production ledger = 72/72 recoverable SQL bodies**, with 0 versions left without a SQL body. The regression validator checks every recovered archive file, its recorded Git blob hash, production hash and character length. The active migration directory remains the same ten files.

This closes the missing-SQL-body recovery gap, but **does not establish the original Git authoring path, code review/approval context, or why those SQL bodies were absent from the reachable Git history**. It also does not make the recovered files executable migrations. No file was copied into `supabase/migrations/`, no migration history was modified, and no DDL or data was applied to production. A reviewed forward-only migration/lineage strategy, rollback plan, isolated staging test and release review remain mandatory before any database change.

### Byte-accurate Git blob hash correction

Archive validation exposed a manifest defect: for three SQL bodies containing non-ASCII characters, the earlier hash calculation used SQL character length in the Git blob header instead of UTF-8 byte length. I recomputed exact and terminal-CR/LF-trimmed hashes for all 72 production bodies using `octet_length()` and the actual UTF-8 bytes, added `production_sql_bytes`, corrected those values in the manifest, and extended CI to verify exact and trimmed hashes/byte lengths against every current file and every archive. This corrects the audit manifest only; it does not change any SQL body or production state.
