# Shopplosion Pulse — Persistent Agent Instructions

## Operating model

- Continue work autonomously through diagnose → plan → implement → test → fix → review → release gate → next priority.
- Do not ask the user to say “siga”. Stop only for a real external blocker, missing credential, destructive action, security/provider decision, or required human product decision.
- Never claim completion from an agent self-report. Deterministic gates and reproducible evidence are the authority.

## Product rules

- Preserve multi-tenant isolation. RLS is the authoritative security boundary; frontend checks and natural-language heuristics are not security controls.
- Current private Ask AI provider is Gemini. Do not switch provider without explicit approval.
- Private AI must use only evidence retrieved under the authenticated tenant.
- Separate FACT / INFERENCE / HYPOTHESIS when producing research or product reasoning.
- Tests are PASS / FAIL / SKIP. SKIP is never PASS.
- Every discovered bug should become a regression test or guardrail when practical.
- Preserve the production single-file `index.html` contract where applicable: embedded images, no `assets/` dependency, validated HTML/JS/data, and short 5–8 line changelog.

## Priority order

1. P0 — Ask AI correctness and tenant-safe private retrieval.
2. P1 — Private document intelligence, including PDF provenance and indexing.
3. P2 — Runtime multi-tenant isolation and storage ownership.
4. P3 — Release gates, browser smoke, regression and adversarial audits.
5. P4 — Autonomous execution/governance and traceability.
6. P5 — Product quality, UX and maintainability.

## Change discipline

- Prefer a focused branch and pull request for material changes.
- Do not merge a change with unresolved BLOCKER/CRITICAL findings or failed deterministic gates.
- External Supabase Edge Function deployment is separate from GitHub Pages/Netlify frontend deployment and must be explicitly validated after code changes.
- Never put Supabase service-role keys, Gemini keys, or other secrets in browser code or committed source.
