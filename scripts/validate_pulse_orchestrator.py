#!/usr/bin/env python3
"""Deterministically validate the Pulse orchestrator protocol artifacts."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = {
    "PULSE_ORCHESTRATOR_PROTOCOL.md": [
        "## Purpose",
        "## Operating states",
        "## Required task record",
        "## Role boundaries",
        "## Completion rule",
        "## Correction loop",
        "## Evidence discipline",
        "## Single-file invariant",
        "## Release authority",
        "Pulse Release Gate",
    ],
    "PULSE_TASK_TEMPLATE.md": [
        "Objective",
        "Problem",
        "Evidence",
        "Hypothesis",
        "Scope",
        "Out of scope",
        "Acceptance criteria",
        "Regression risks",
        "Required gates",
        "Changelog",
    ],
    "docs/PULSE_AGENT_HANDOFF.md": [
        "- ID:",
        "- Title:",
        "## Objective",
        "## Evidence",
        "## Contract",
        "## Handoff",
        "### Completed",
        "### Open questions",
        "## Files / artifacts changed",
        "## Validation performed",
        "## Findings requiring attention",
        "## Release decision",
        "## Changelog",
    ],
}

errors = []
for relative, markers in REQUIRED.items():
    path = ROOT / relative
    if not path.is_file():
        errors.append(f"missing file: {relative}")
        continue
    text = path.read_text(encoding="utf-8")
    for marker in markers:
        if marker not in text:
            errors.append(f"{relative}: missing required marker: {marker}")

if errors:
    print("PULSE ORCHESTRATOR VALIDATION: FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("PULSE ORCHESTRATOR VALIDATION: PASS")
print(f"Validated {len(REQUIRED)} protocol artifacts and {sum(len(v) for v in REQUIRED.values())} required markers.")
