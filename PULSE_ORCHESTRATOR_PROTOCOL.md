# PULSE ORCHESTRATOR PROTOCOL

## Purpose

Turn every Pulse evolution into a traceable, reviewable, testable delivery cycle.

## Operating states

`IDEA -> TRIAGE -> RESEARCH -> STRATEGY -> CONTRACT -> BUILD -> REVIEW -> GATED -> DONE`

`BLOCKED` may occur from any state when required evidence, decision, dependency, or test is missing.

## Required task record

Every material evolution must define:

- Objective
- Problem
- Evidence / sources
- Hypothesis
- Scope
- Non-scope
- Acceptance criteria
- Risks
- Required tests
- Release decision
- Changelog

## Role boundaries

### Claude — Ideation
Generates candidate ideas and hypotheses for Pulse. Suggestions are inputs, not approvals.

### Orchestrator — Control
Decomposes the task, assigns the next role, tracks state, checks prerequisites, and prevents premature completion. It must not declare technical success without the release gates.

### Researcher — Evidence
Validates external facts and source provenance. Separates FACT, INFERENCE, and HYPOTHESIS.

### Strategist — Product specification
Converts validated evidence into a product contract, acceptance criteria, and risks.

### Builder — Implementation
Changes the product only within the approved contract and preserves existing contracts.

### Adversarial Reviewer — Challenge
Attempts to disprove the implementation. It classifies findings as BLOCKER, CRITICAL, MAJOR, MINOR, or OBSERVATION.

### Deterministic Gates — Authority
Automated checks are the technical release authority. A model score, reviewer confidence, or subjective 0–10 rating cannot override a failed gate.

## Completion rule

A task is `DONE` only when:

1. the approved contract is satisfied;
2. no unresolved BLOCKER or CRITICAL review finding remains;
3. deterministic release gates pass;
4. the final artifact satisfies the single-file contract;
5. required browser and regression checks pass;
6. the changelog is recorded.

## Correction loop

If review or gates fail:

`FAIL -> DIAGNOSE -> BUILD FIX -> REVIEW -> GATES`

Do not skip directly from a failed gate to deployment.

## Evidence discipline

No unsupported factual claim may become product evidence merely because an agent generated it. Source, date/context, and confidence must remain traceable.

## Single-file invariant

The production artifact remains one `index.html`, ready for Netlify Drop, with embedded images and no `assets/` dependency. Supporting source files may exist in the repository for development and CI, but they must not become runtime dependencies of the production artifact.

## Release authority

`Pulse Release Gate` is the publication gate. Specialized workflows remain useful as diagnostics, but deployment must not bypass the release gate.
