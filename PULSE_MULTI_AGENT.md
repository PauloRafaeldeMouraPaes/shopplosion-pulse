# Pulse Multi-Agent Quality Loop

## Purpose

Define the operating protocol for evolving Shopplosion Pulse with specialized AI roles while preserving deterministic quality gates and the project's single-file deployment contract.

## Roles

### Claude — Ideation
Primary source of product ideas and improvement hypotheses for Pulse. Suggestions are inputs, not approvals.

### Pulse Orchestrator — Coordination
Turns an approved idea into a bounded task, assigns the appropriate role, tracks status, and decides when the task is ready for deterministic gates. It does not replace objective tests.

### Researcher — Evidence
Finds and validates external evidence. Every material claim must be classified as FACT, INFERENCE, or HYPOTHESIS and retain source/date/context where applicable.

### Strategist — Product specification
Converts validated evidence into a product specification: problem, opportunity, target user, hypothesis, scope, non-scope, acceptance criteria, risks, and required tests.

### Builder — Implementation
Implements only the approved specification while preserving existing contracts and functionality. The final web artifact remains a single `index.html` ready for Netlify Drop.

### Adversarial Reviewer — Independent challenge
Attempts to disprove the implementation. It looks for regressions, unsupported claims, data inconsistencies, UX/accessibility problems, broken interactions, HTML/JS defects, and violations of the single-file contract.

### Deterministic QA — Final authority
Automated tests and gates are the release authority. An AI score from 0–10 is never sufficient for approval.

## Standard lifecycle

1. IDEA — Claude or human proposes an improvement.
2. TRIAGE — Orchestrator checks value, evidence, scope, duplication, and regression risk.
3. RESEARCH — Researcher validates claims when external evidence is needed.
4. STRATEGY — Strategist writes the implementation specification.
5. CONTRACT — Acceptance criteria and tests are explicit before coding.
6. BUILD — Builder implements the change.
7. REVIEW — Adversarial Reviewer attempts to break or invalidate it.
8. TEST — Deterministic regression, QA, artifact, browser, UX/accessibility and relevant feature gates run.
9. CORRECT — Failures return to Builder and then to Reviewer/tests.
10. APPROVE — Only after required gates pass and no blocker/critical issue remains.
11. DEPLOY — Publish the validated artifact.

## Status vocabulary

- `BACKLOG`: identified but not started.
- `IN PROGRESS`: active work.
- `BLOCKED`: waiting on missing evidence, decision, or dependency.
- `REVIEW`: implementation exists and is under adversarial review.
- `GATED`: deterministic validation is running or awaiting results.
- `DONE`: acceptance criteria and required gates passed.

## Non-negotiable principles

- Never invent evidence, numbers, sources, names, or product behavior.
- Never treat an inference as a fact.
- Never declare completion because an agent says it is complete.
- Prefer deterministic tests over subjective scoring.
- Preserve backward compatibility unless the specification explicitly changes it.
- A bug found during review should become a regression test whenever practical.
- Avoid unnecessary agent proliferation; create a separate role only when separation materially improves quality or reliability.

## Release contract

The production artifact must remain a single `index.html` suitable for Netlify Drop, with images embedded as base64 and no `assets/` dependency. JavaScript, HTML, data consistency, evidence/provenance consistency, relevant regression checks, and browser smoke validation must pass before release.
