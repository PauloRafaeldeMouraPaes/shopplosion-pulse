# Applying Superpowers to Pulse

**Purpose:** adopt the parts of [obra/superpowers](https://github.com/obra/superpowers) that improve the Pulse development cycle without copying the entire third-party framework into the application repository or weakening Pulse's own release guardrails.

## Recommended setup

Superpowers is an agent-development workflow delivered through skills and harness-specific plugins. Install it in the coding-agent environment you actually use; keep the upstream installation separate from the Pulse application repository so it can be updated without maintaining a private fork.

- **ChatGPT:** connect the Superpowers integration from the installation suggestion surfaced in this conversation. It is not connected until you complete that action.
- **Codex app / CLI:** open the Codex plugin interface, search for **Superpowers**, and install the official plugin. The upstream project's [README](https://github.com/obra/superpowers#installation) lists current installation routes.
- **Manual Codex CLI setup (if you prefer a checkout):**

  ```bash
  git clone https://github.com/obra/superpowers.git ~/.codex/superpowers
  mkdir -p ~/.agents/skills
  ln -s ~/.codex/superpowers/skills ~/.agents/skills/superpowers
  ```

  Restart Codex after installation. Use the upstream installation documentation if the current harness or operating system differs.

## Skills with the clearest value for Pulse

| Situation | Superpowers skill | How we apply it here |
|---|---|---|
| New product behavior or a genuinely ambiguous change | `brainstorming` | Define outcome, non-goals and acceptance criteria; avoid redundant questions when the request is already clear |
| Work spanning multiple files or systems | `writing-plans` | Break the change into small, testable tasks and identify touched files |
| Feature, regression or bug fix | `test-driven-development` | Confirm the test fails for the intended reason, implement minimally, verify green |
| Failed CI, broken UI, unexpected runtime behavior | `systematic-debugging` | Reproduce and trace the root cause before changing code |
| Before saying “fixed” or “complete” | `verification-before-completion` | Verify the exact final commit and describe any unverified checks honestly |
| Significant code change or review feedback | `requesting-code-review`, `receiving-code-review` | Review the diff, challenge feedback with evidence, and fix valid blocking findings |
| Finished implementation | `finishing-a-development-branch` | Check tests, branch target and integration readiness; leave merge/deploy decisions to the authorized human |

The highest-value immediate improvements for the Pulse project are systematic debugging, test-first regression fixes, and evidence-based verification. Brainstorming and written plans should be proportional to the change; they must not turn a clear instruction into unnecessary conversation.

## Precedence and adaptation

Apply priorities in this order:

1. Explicit user decisions and the accepted task scope.
2. Pulse-specific architecture, design-system, evidence, security and release requirements in the repository.
3. The relevant Superpowers skill.
4. Generic defaults.

In particular, generic workflows must not override Pulse's stricter gates: no speculative production changes; no fabricated evidence; no silent expansion of scope; no production migration or grant change while lineage is unresolved; no merge or deploy just because checks are green. For a request to continue autonomously, make safe, reversible decisions and proceed rather than repeatedly asking for confirmation.

## What is intentionally not vendored

This adoption does not copy all Superpowers scripts, plugin hooks, visual companions or every skill into the Pulse codebase. Those pieces depend on the coding-agent harness and would create duplicate, drifting copies. The root [`AGENTS.md`](../../AGENTS.md) preserves the project-specific operating rules even when the plugin is not available. The upstream project remains the authoritative source for its skills and installation updates.

Upstream project: [obra/superpowers](https://github.com/obra/superpowers), licensed under MIT. This document summarizes how Pulse will use the approach; it does not claim to be a full copy or complete installation of the upstream project.
