# Migration lineage reconciliation

Status: investigation only. No production schema, data, grants, or migration history has been changed.

## Verified state

- Supabase production reports **72 timestamped migrations**, from `20260907035807` through `20260922041853`.
- The repository contains 10 numbered SQL files. Hash comparison against the SQL stored in production confirms four mappings in the recent knowledge-layer set: three byte-for-byte matches and one match after trimming only terminal CR/LF. This is not proof of complete lineage.
- The production history also includes entries such as `005_performance_indexes`, `007_document_search_vector`, and `008_document_indexing_summary`. The corresponding files were not found at the expected `supabase/migrations/<name>.sql` paths on the default branch. This does not establish whether they were renamed, squashed, stored elsewhere, or applied out of band.
- The live signal-event trigger/function and the current SECURITY DEFINER grants require a separate reviewed migration. Do not infer its original migration from current production state alone.

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
- The other production entries still need evidence-backed mapping to SQL/history, or an explicit disposition (for example, older baseline already present before timestamped history, squashed into a later file, out-of-band change, or unrecoverable source).

The historical commit/tree inspection also did not find the three exact production-named files under those paths. It does not prove that no equivalent SQL ever existed; Git history and the actual SQL bodies still need to be compared.

## Next safe technical step

Build a reviewed manifest with one row per production version: `version`, `production_name`, `repo_path`, `repo_blob_sha`, `mapping_type`, `evidence`, `review_status`. Only after this manifest accounts for all 72 entries should CI enforce it. Do not fabricate placeholder migrations or create timestamped no-op files just to make counts match.


### Live schema cross-check for the four recent candidate mappings

A read-only comparison of production columns, indexes and RLS policies against the checked-in SQL confirms that the following files describe the corresponding live feature sets, although exact historical SQL equivalence still requires the original migration bodies or a reviewed normalized diff:

- `007_investigations_and_analysis_link.sql`: production `investigations` table and `analyses.investigation_id` are present, with the expected tenant-scoped indexes/policies.
- `008_analysis_artifact_metadata.sql`: production `analyses.status`, `limits`, `published_at`, and `analyses_status_idx` are present.
- `009_shopper_knowledge_layer.sql`: production `shopper_knowledge` has the expected claim/source/segment/category/mission/period/confidence/status/evidence/payload fields and investigation indexes.
- `010_knowledge_updates_saved_evidence.sql`: production `knowledge_updates`, `saved_evidence`, scope column and their indexes/policies match the checked-in feature definitions.

The live schema cross-check corroborates the four hash-based mappings. The other 68 production history rows remain unresolved. Production schema state can have been modified by later migrations, so it cannot substitute for original historical SQL.


## Machine-readable inventory

The full read-only production migration listing is recorded in [production-migration-lineage-manifest.csv](production-migration-lineage-manifest.csv): **72 rows**, one per production version. Each row has an explicit mapping status and evidence note. Four recent feature migrations are mapped by SQL hash; the other 68 rows remain unresolved and must not be guessed. This manifest is a working audit artifact, not a declaration that lineage is reconciled.


## Exact SQL identity checks (2026-10-15)

The production migration table stores the SQL statement payloads. I computed the Git blob SHA-1 for each stored statement directly in PostgreSQL (without returning the SQL text) and compared it with the Git blob SHAs of the 10 checked-in files. Results:

- **3 exact byte-for-byte matches:** production `20260922030641 / complete_analysis_artifact_metadata` ↔ `008_analysis_artifact_metadata.sql`; `20260922031240 / create_shopper_knowledge_layer` ↔ `009_shopper_knowledge_layer.sql`; and `20260922032516 / 010_knowledge_updates_saved_evidence` ↔ `010_knowledge_updates_saved_evidence.sql`.
- **1 match after trimming terminal CR/LF only:** production `20260922030555 / create_investigations_and_link_analyses` ↔ `007_investigations_and_analysis_link.sql`. The stored statement is one character longer; the trimmed Git blob SHA matches exactly.
- The other **68 production versions** do not exactly match any of the 10 current files, even after terminal CR/LF trimming. They remain unmapped and require historical-baseline/squash/out-of-band classification.
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

This is stronger evidence that the 68 unmatched production statements are not recoverable as tracked SQL files in the inspected Git history snapshots. It still does **not** prove they were never present in another branch, repository, unreachable commit, manual SQL session, or external backup. The responsible disposition is therefore still `unmapped` pending independent provenance, rather than asserting `out_of_band` as a fact.

The latest PR #93 documentation commit has all repository CI checks complete: regression, browser smoke, evidence contract, private AI audit, multi-tenant audit, and validate passed; Netlify redirect processing passed, while header/pages checks concluded neutral. This validates the documentation change only, not production lineage or database behavior.


## Cross-branch candidate migration review (2026-10-15)

A targeted branch-tip audit found one additional SQL candidate outside `main`: branch `docs/cross-signal-market-human-behavior` contains `supabase/migrations/20261011174650_immutable_source_observation_history.sql`, its design draft under `docs/pilots/`, and a synthetic PostgreSQL fixture. Its Git blob does not match any of the 72 production SQL statement hashes, and its timestamp (2026-10-11) is later than the newest production migration version (2026-09-22). It is therefore a **proposed future migration**, not historical source for the 68 unresolved production rows.

The branch's PR #80 remains open as Draft. Its actual 23-file diff includes the source worker and the candidate migration, although the previous description said the PR did not change workers or the database. The description was corrected on 2026-10-15 to identify the real scope and the release gates: [PR #80](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/pull/80). After comparing the 31 paths changed by main since the original merge base against the 23 paths changed by PR #80 and finding no overlap, I merged current main commit `64f9a31d3421e560ca91c53a4585011cba779980` into the PR branch using merge commit `ed2efb84942d10b2a8082ea3a829786de5a51420`. Compare now reports the branch as ahead by 124 and behind by 0. This was a branch synchronization only; PR #80 remains Draft and is not merged into main.

CI on the branch head passed the five Pulse workflows; specifically, its Regression job generated/verified the migration with Supabase CLI, tested it against PostgreSQL 17 in an ephemeral database, type-checked the worker, and ran unit tests for retry, failure bookkeeping, fingerprinting and source identity. This is useful isolated validation, but **not** completion of H01-H15 and not proof of production compatibility. The branch's own test contract still flags H13 as not implemented, H07 as deny-all rather than tenant-scoped read validation, and H09/H15 as missing end-to-end worker failure/reconciliation tests.

A read-only query of production confirms that the existing `intelligence_source_item_versions` and `intelligence_source_item_observations` tables are absent. Current `intelligence_source_items` has five `active` and 21 `rejected` rows at the time of this check. The current `main` worker still sets `status='active'` during a source-item upsert, so it can silently undo a rejection on recapture. In the separate candidate branch PR #80, the proposed RPC was updated to preserve `status='rejected'` until explicit review; the R01 synthetic PostgreSQL regression exercises an identical recapture. Regression passed on code head `20f7361ed56c32a101ba91b4f56c9b65f82fc996` and again on synchronized branch head `ed2efb84942d10b2a8082ea3a829786de5a51420`, where all five Pulse workflows passed. On the latest docs-only head `9fee64b1369973113bd265fe5c5b621edc558e12`, all five Pulse workflows passed: Regression (both jobs), Browser Smoke, Evidence Contract, Private AI Audit and Multi-Tenant Audit; Validate passed as well. Netlify redirect processing passed and header/pages checks were neutral because those rule files were unchanged. This remains synthetic CI only. PR #80 remains Draft, and this behavior has not been applied to production. No production DDL or data was changed.

This candidate may help the future Chocolate capture system preserve history, but it does not solve the historical migration gap and is not authorized for production application. The 68 unmatched production versions remain unresolved.


## Accessible branch-tip sweep completed (2026-10-15)

The repository exposes 113 branch names across its two paginated branch listings. I inspected the recursive Git tree for all 93 distinct commit SHAs at those branch tips (duplicate branch names pointing to the same commit were counted once). For each tree, I compared tracked SQL blob SHAs with the 72 production statement blob hashes and terminal-CR/LF-trimmed hashes in the manifest.

Result: no additional SQL blob in those accessible branch-tip snapshots maps to the 68 unresolved production statements. The only positive production-hash mappings remain the same four recent feature migrations; the other SQL files in older branch tips are the cumulative 001–006 set, or the same current 001–010 set. One separate candidate migration for immutable source history exists on `docs/cross-signal-market-human-behavior`, but its content hash does not match any production statement and its timestamp follows the latest production migration version. It is a future proposal, not historical recovery.

This materially broadens the negative search evidence, but it is not proof about non-tip/unreachable Git objects, deleted remote refs not exposed by the current branch listing, another repository, manual SQL, or backups. Accordingly, keep the 68 rows labelled `unmapped`; do not infer `out_of_band` solely from absence in the inspected branch tips.

## Latest verification

On commit `de15f7702b066739bf89894d26e2ca364f4735f9`, all Pulse CI checks have now completed successfully, including Browser Smoke, Regression, Evidence Contract, Private AI Audit, Multi-Tenant Audit and Validate. Netlify redirect processing succeeded; header/pages checks were neutral because that commit did not include those rule files. These checks validate this documentation-only branch; they do not establish production migration lineage or production database correctness.
