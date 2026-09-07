# Pulse Autonomous Execution

## Objective

Allow an executor such as Codex, ChatGPT-connected tooling, or a future CI agent to resume Pulse work without reconstructing project context from conversation history.

## Execution loop

`READ STATE → SELECT PRIORITY → DIAGNOSE → CONTRACT → BUILD → TEST → ADVERSARIAL REVIEW → RELEASE GATE → RECORD → NEXT PRIORITY`

The loop continues until a safe next task is unavailable or a real external blocker requires human action.

## Mandatory stop conditions

Stop and ask the user only when the next action requires:

- a secret, credential, OAuth authorization, or external account action;
- destructive data deletion or irreversible production change;
- changing the LLM provider or security architecture;
- a product decision not encoded in the roadmap;
- a failed prerequisite that cannot be resolved safely by code changes.

Routine implementation, testing, documentation, branch creation, PR creation, and code review should not require a user prompt.

## Evidence and gates

- RLS and authenticated tenant scope are the security authority for private data.
- Deterministic audits are release authority.
- PASS, FAIL and SKIP must remain distinct.
- No model-generated confidence score can override a failed gate.
- After every fix, rerun the relevant gate and regression checks.

## Current execution state

- P0 Ask AI: remove fragile natural-language tenant guards; enforce tenant scope through authenticated Supabase session, RLS, and defense-in-depth filtering before Gemini.
- P1 Private documents/PDF: verify ingestion, provenance, orphan cleanup and private retrieval.
- P2 Multi-tenant: maintain runtime A/B isolation for documents, analyses and Storage.
- P3 Gates: keep browser smoke, regression, evidence, adversarial and multi-tenant audits green.
- P4 Governance: maintain roadmap, AGENTS.md and traceability.
- P5 Quality: improve UX and maintainability only after security and correctness gates are stable.

## Handoff rule

A new executor should read `AGENTS.md`, this file, `docs/PULSE_ROADMAP.md`, the latest open PRs, the latest release-gate results, and the most recent changelog before selecting the next task.
