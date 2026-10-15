# Pulse — engineering instructions

These instructions are project-specific guardrails for coding agents. Apply them alongside the installed Superpowers skills when available. If a skill is unavailable in the current harness, follow the equivalent procedure below; do not pretend the plugin or subagents ran.

## Project priorities

1. Preserve existing Pulse architecture, product scope, routes, IDs, anchors, and workflows unless the task explicitly asks to change them. Visual polish is not a redesign.
2. For design work, use `design/tokens.json` as the source of truth, followed by `pulse-tokens.css` and `docs/DESIGN_SYSTEM_SYNC.md`. Do not silently replace existing patterns with a new design system.
3. Prefer the smallest change that solves the evidenced problem. Avoid new screens, abstractions, dependencies, data pipelines, and schema objects unless they are necessary for the accepted scope.
4. Work autonomously when the request is sufficiently clear. Use conservative, reversible assumptions and document them instead of repeatedly asking questions. Ask only when a material decision cannot safely be inferred.
5. Do not claim work is done, fixed, or passing without fresh, relevant verification evidence.

## Development workflow

Use the corresponding Superpowers skills when available:

- **New or ambiguous product behavior — `brainstorming`:** identify the user outcome, non-goals, constraints, and acceptance criteria before implementation. If the request already specifies these sufficiently, do not add a redundant discovery round.
- **Multi-step work — `writing-plans`:** define the smallest testable tasks and affected files. Create a plan artifact only when it helps coordination or traceability, not for routine edits.
- **Feature or bug fix — `test-driven-development`:** add a focused test, run it to confirm the expected failure, implement the smallest fix, then rerun the test and relevant regression suite. Do not invent a test result when the environment cannot run it.
- **Unexpected behavior or failing checks — `systematic-debugging`:** reproduce, inspect the failure and recent changes, trace the failing data/control path, establish root cause, and only then patch. Avoid chains of speculative fixes.
- **Before reporting completion — `verification-before-completion`:** run the actual relevant command or inspect the actual completed CI run for the exact commit; distinguish verified, unverified, and blocked items.
- **Review — `requesting-code-review` / `receiving-code-review`:** examine feedback against the repository, requirements, security and tests. Fix valid blocking issues; explain evidence-based disagreement rather than accepting or rejecting feedback reflexively.
- **Branch completion — `finishing-a-development-branch`:** confirm the target branch and test status. Keep changes in a reviewable branch/PR; do not merge or deploy on your own for changes affecting production data, schema, security or release behavior.

Do not claim that subagents, worktrees, local commands, browser tests or local files were used unless they actually were available and used. Parallelize only independent work when the current environment supports it.

## Pulse-specific safety gates

- **Database migrations:** consult `docs/database/migration-lineage-reconciliation.md` before any schema release. The production history is not fully reconciled; do not use `supabase db push`, apply production DDL, alter grants, or merge a database-changing PR until the complete migration lineage is evidence-backed and the change has passed isolated/staging validation with a documented rollback.
- **Production data and security:** prefer read-only diagnosis first. Do not bulk-revoke grants or modify SECURITY DEFINER functions without call-graph analysis and tests for both denied client access and legitimate trusted scheduler/worker paths.
- **Multi-tenancy:** test tenant boundaries at the database/API layer. Do not rely solely on UI hiding or caller-provided industry IDs.
- **Evidence and shopper intelligence:** keep source, timestamp, scope, capture status, and limitations explicit. Never fabricate a capture, timestamp, export, hash, price, shopper signal or trend. Industry/product announcements are not proof of shopper behavior. Preserve rejected/dismissed states unless the task explicitly authorizes a reviewed state transition.
- **Chocolate pilot:** do not mark the baseline started or validated until the real capture, provenance, data-quality, comparability and human acceptance gates are satisfied.
- **External source access:** respect HTTP 403, terms, rate limits and licensing; do not bypass access controls.
- **Release hygiene:** use a focused branch and PR; run relevant tests and audits; inspect the final diff. Draft PRs remain drafts until explicitly asked to promote them. No production deploy or merge merely because CI is green.

## Reporting

Report the actual commit/branch and verification evidence, then list only material gaps or blockers. Keep status updates useful and avoid repeating a question or emitting a progress loop. A green check on one commit does not verify a later commit.
