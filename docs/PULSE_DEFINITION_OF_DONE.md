# Pulse Definition of Done

A Pulse improvement is complete only when **product intent, evidence, implementation, adversarial review and deterministic validation agree**.

## 1. Product contract

- [ ] Objective and user problem are explicit.
- [ ] Evidence is classified as `FACT`, `INFERENCE` or `HYPOTHESIS`.
- [ ] In-scope and out-of-scope decisions are explicit.
- [ ] Acceptance criteria are testable.
- [ ] No unsupported product claim is introduced.

## 2. Implementation contract

- [ ] The production artifact remains a single `index.html`.
- [ ] Images and required assets are embedded; no `assets/` dependency exists.
- [ ] Inline JavaScript parses successfully.
- [ ] Visible data, evidence and provenance remain consistent.
- [ ] Existing UX/accessibility contracts are preserved unless the task explicitly changes them.

## 3. Adversarial contract

- [ ] The reviewer attempts to falsify the acceptance criteria.
- [ ] Findings are classified as `BLOCKER`, `CRITICAL`, `MAJOR`, `MINOR` or `OBSERVATION`.
- [ ] No unresolved `BLOCKER`, `CRITICAL` or `MAJOR` finding remains at release.
- [ ] Every recurring defect worth preventing is converted into a deterministic guardrail when practical.

## 4. Deterministic release contract

The official Release Gate must pass:

1. Artifact validation.
2. Orchestrator protocol validation.
3. Adversarial audit.
4. Single-file contract audit.
5. JavaScript syntax validation.
6. Product regression guardrails.
7. Semantic data integrity.
8. Ask AI behavioral regression.
9. Evidence/provenance contract.
10. Accessibility/UX audit.
11. Shopper browser smoke tests.
12. Next-level browser smoke tests.

## 5. Traceability contract

Each completed task must leave a durable record containing:

- task ID and title;
- objective/problem;
- evidence and confidence;
- scope/non-scope;
- acceptance criteria;
- files/artifacts changed;
- validation results and run IDs;
- adversarial findings;
- release decision;
- short changelog.

## 6. Release authority

Agent self-reports never authorize publication. The deterministic Release Gate is the technical release authority. A task is `RELEASE VERIFIED` only after the official gate passes on the exact commit being released.

## 7. Post-release

- [ ] Deployment completed or explicitly handed to the deployment queue.
- [ ] Public artifact is reachable when a publication check is part of the task.
- [ ] Handoff record is updated with the final commit and validation evidence.
- [ ] No open blocking question is hidden inside the handoff.
