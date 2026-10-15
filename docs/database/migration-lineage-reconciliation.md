# Migration lineage reconciliation

Status: investigation only. No production schema or migration history has been changed.

Production Supabase history uses timestamped versions through 20260922041853, while checked-in migrations use numbered filenames such as 010_knowledge_updates_saved_evidence.sql. Before applying any database migration, map every production version to its authoritative repository SQL and explain gaps, renames, squashed migrations, or out-of-band changes.

Do not run supabase db push until this reconciliation is reviewed. Once complete, test the signal-event trigger fix and SECURITY DEFINER grants in staging, including cron/trigger behavior, anon/authenticated denial, trusted internal success, regression tests, and Security Advisor.
