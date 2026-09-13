# Pulse Roadmap

## P0 — Ask AI security and correctness

**Status:** in progress.

Acceptance:
- legitimate questions about the authenticated industry's own private documents are not blocked by heuristic scope guards;
- retrieval is filtered by authenticated `industry_id`;
- chunks and documents are defense-in-depth validated before Gemini receives evidence;
- cross-tenant access remains blocked by RLS;
- browser contains no provider or Supabase secret;
- deterministic private-AI audit passes.

## P1 — Private document intelligence

**Status:** next.

Scope:
- TXT/CSV/JSON/MD/LOG and PDF ingestion;
- provenance and chunk integrity;
- private Storage access;
- orphan cleanup/cascade behavior;
- evidence quality and Ask AI retrieval.

## P2 — Runtime multi-tenant isolation

**Status:** established, maintain.

Acceptance:
- A/B runtime isolation for documents, analyses and Storage remains PASS;
- no cross-tenant read, insert or download path;
- regression tests remain green.

## P3 — Release authority

**Status:** established, maintain.

Scope:
- deterministic release gate;
- browser smoke;
- regression;
- evidence contract;
- adversarial audit;
- multi-tenant audit.

## P4 — Autonomous governance

**Status:** in progress.

Scope:
- persistent `AGENTS.md`;
- autonomous execution protocol;
- traceable roadmap and changelog;
- stop conditions limited to real external/human blockers.

## P5 — Product quality

**Status:** backlog.

Scope:
- UX clarity;
- performance;
- maintainability;
- evidence presentation;
- product polish after P0–P3 are stable.

## Definition of done

A priority is complete only when its contract is implemented, relevant tests pass, no unresolved BLOCKER/CRITICAL remains, release authority passes where applicable, and the change is recorded.
