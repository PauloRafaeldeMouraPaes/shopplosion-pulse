# Recovered production migration SQL — audit archive

These `.sql.txt` files are verbatim bodies read from the read-only production ledger `supabase_migrations.schema_migrations.statements[1]` on 2026-10-15.

Each file is named by the recorded 14-digit version and production migration name. Before archiving, the retrieved body length was checked against the recorded manifest length and its Git blob SHA-1 was recomputed; all 68 recovered bodies matched their production ledger SHA exactly at archival time. One of them, `20260907230216_harden_internal_worker_auth_vault.sql.txt`, was redacted on 2026-10-31 because it carried the plaintext value of a Vault secret; its production hash stays in the manifest and the file intentionally no longer matches the ledger (see `production-migration-lineage-manifest.csv`, status `recovered_from_production_history_redacted`). The filenames intentionally end in `.sql.txt` and this directory is outside `supabase/migrations/`; these are historical audit artifacts, **not executable or replayable migration files**.

This recovers the exact SQL bodies for the 68 versions that lacked a match in the checked-in Git tree. It does not recover their original Git authoring path, review/approval context, commit history, or the reason their original files are absent. The four separately verified mappings to current migration files remain documented in the canonical manifest.

Do not copy these files into the active migrations directory, do not mark migrations applied from this archive alone, and do not use `supabase db push` until a forward-only reconciliation strategy is reviewed and validated in an isolated staging project.
