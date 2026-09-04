# Pulse Adversarial Review

## Purpose

This document defines the deterministic adversarial layer for Shopplosion Pulse.
It complements, rather than replaces, human/LLM review.

The reviewer must try to disprove a change instead of merely confirming that it looks correct.

## Review order

1. **Contract** — the requested behavior and the permanent Pulse contracts are explicit.
2. **Evidence** — claims and data have traceable provenance; hypotheses are not presented as facts.
3. **Regression** — existing functionality remains intact.
4. **Artifact** — `index.html` remains deployable as the single-file product; no `assets/` dependency is introduced.
5. **JavaScript** — inline JavaScript parses successfully.
6. **UX/accessibility** — deterministic accessibility and interaction checks pass.
7. **Browser** — browser smoke checks pass when applicable.

## Severity

- **BLOCKER** — unsafe or invalid artifact; must be fixed before merge/deploy.
- **CRITICAL** — core behavior, evidence integrity, or major regression; must be fixed.
- **MAJOR** — important functional/UX problem; must be fixed unless explicitly waived.
- **MINOR** — limited defect that does not compromise the release contract.
- **OBSERVATION** — improvement opportunity, not a release blocker.

## Adversarial questions

### Evidence
- Can every material factual claim be traced to a source?
- Are source dates/context appropriate for the claim?
- Is an inference clearly distinguished from a fact?
- Are evidence IDs and displayed evidence synchronized?

### Product behavior
- What happens with empty, invalid, or unexpected input?
- Does every new control have a meaningful state change?
- Can an existing filter, navigation path, or interaction regress?
- Does the UI remain coherent when no result matches?

### Artifact
- Is `index.html` present and valid?
- Did `assets/` or another local dependency appear?
- Did a new external script/style/font dependency appear?
- Are there broken local references?

### Code
- Does every inline JS block parse?
- Are there obvious dead references, missing DOM targets, or placeholder markers?
- Did the change introduce accidental debug output or development-only endpoints?

## Approval rule

A subjective score from 0–10 is informative only. It is **not** a release gate.

A change is release-ready only when deterministic gates pass and there are no unresolved BLOCKER/CRITICAL findings.
