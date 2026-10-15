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
