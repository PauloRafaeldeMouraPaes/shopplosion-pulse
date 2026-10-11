#!/usr/bin/env python3
"""Static preflight for the immutable source-observation design.

This is deliberately not a substitute for database integration tests H01-H15.
It validates that the reviewed design and acceptance matrix retain the required
safety contract before a migration is generated in an isolated environment.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "docs/pilots/immutable-source-observation-history.md"
CASES = ROOT / "docs/pilots/immutable-source-observation-tests.md"

def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)

def main() -> int:
    design = DESIGN.read_text(encoding="utf-8")
    cases = CASES.read_text(encoding="utf-8")

    # The contract must stay complete and uniquely identifiable.
    ids = re.findall(r"\bH(\d{2})\s+[—-]", cases)
    require(ids == [f"{n:02d}" for n in range(1, 16)],
            f"Expected H01-H15 exactly once and in order; found {ids}")

    # Ensure both append-only entities and the critical identity fields remain
    # documented, without pretending this proves the database enforces them.
    for table in ("intelligence_source_item_versions",
                  "intelligence_source_item_observations"):
        require(table in design, f"Design is missing table {table}")
    for token in ("content_fingerprint", "first_observed_at", "observed_at",
                  "fetch_run_id", "industry_id", "source_id",
                  "ON CONFLICT", "RLS", "anon", "authenticated"):
        require(token.lower() in design.lower(),
                f"Design is missing required safety/identity term: {token}")

    # Safety gates must be explicit in both the design and test contract.
    for token in ("403", "tenant", "immutab", "não", "produção"):
        require(token.lower() in (design + "\n" + cases).lower(),
                f"Design/test contract is missing safety concept: {token}")
    require("não executados" in cases.lower(),
            "Test status must not imply H01-H15 have already run")
    require("Nunca executar fixtures destrutivas na produção" in cases,
            "Test contract must explicitly prohibit destructive production fixtures")

    print("PASS: static design preflight; H01-H15 matrix and safety contract are present.")
    print("LIMIT: this does not execute SQL, validate RLS, or prove runtime behavior.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
