# Recovered production migration SQL — audit archive

These `.sql.txt` files are verbatim bodies read from the read-only production ledger `supabase_migrations.schema_migrations.statements[1]` on 2026-10-15.

Each file is named by the recorded 14-digit version and production migration name. Before archiving, the retrieved body length was checked against the recorded manifest length and its Git blob SHA-1 was recomputed; all 68 recovered bodies matched their production ledger SHA exactly. The filenames intentionally end in `.sql.txt` and this directory is outside `supabase/migrations/`; these are historical audit artifacts, **not executable or replayable migration files**.

This recovers the exact SQL bodies for the 68 versions that lacked a match in the checked-in Git tree. It does not recover their original Git authoring path, review/approval context, commit history, or the reason their original files are absent. The four separately verified mappings to current migration files remain documented in the canonical manifest.

Do not copy these files into the active migrations directory, do not mark migrations applied from this archive alone, and do not use `supabase db push` until a forward-only reconciliation strategy is reviewed and validated in an isolated staging project.
