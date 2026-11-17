# Tenant access restored for signed-in users (2026-11-17)

Migration `012_restore_tenant_access_and_rls_performance.sql` (production version `20261117192957`).

## Defect

Since production migration `20260907040351_harden_rls_policy_execution`, `private.current_industry_id()` was executable only by its owner and the `private` schema had no usage grant. Every RLS policy that calls it raised `permission denied for function current_industry_id` for the `authenticated` role, so a signed-in user could not read or write `documents`, `industries`, `document_chunks`, `analyses`, `ask_ai_events`, `rag_eval_*`, `investigations`, `shopper_knowledge`, `knowledge_updates` or `saved_evidence`. Reproduced read-only in production with an existing profile before the fix. The last document upload in production is from 2026-09-07 01:30 UTC.

## Change

1. `GRANT USAGE ON SCHEMA private` and `EXECUTE ON FUNCTION private.current_industry_id()` to `authenticated`. The schema is not exposed by the API (the Security Advisor shows no new finding) and the function returns only the caller's own industry.
2. The five policies flagged by lint 0003 evaluate `auth.uid()` and the tenant check once per statement.
3. Covering indexes for the eight foreign keys flagged by lint 0001.

## Acceptance

Staging (two synthetic tenants, rolled back): A reads its own document and only its own industry; A inserts and reads its own investigation; A cannot write evidence into B; B sees none of A's documents or evidence and cannot delete A's evidence; `anon` reads no document. Performance Advisor: lints 0001 and 0003 cleared. Security Advisor: no new finding.

Production after the release (read-only check with an existing profile, rolled back): the user reads 3 documents, 1 industry and 3 chunks; `anon` reads no document.

## Rollback

Not recommended: it brings the defect back. If ever needed: `REVOKE EXECUTE ON FUNCTION private.current_industry_id() FROM authenticated; REVOKE USAGE ON SCHEMA private FROM authenticated;`. The policy rewrite and the indexes are semantically neutral and can stay.
