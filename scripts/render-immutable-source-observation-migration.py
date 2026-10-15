#!/usr/bin/env python3
"""Render or compare a CLI-generated migration from the review-only SQL draft.

This script never invents a migration filename. --output requires an existing,
empty file created by `supabase migration new <name>`. --check compares an
existing CLI-named migration with the deterministic rendering of the draft.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRAFT = ROOT / "docs/pilots/immutable-source-observation-schema-draft.sql"
MIGRATIONS = (ROOT / "supabase/migrations").resolve()
PROLOGUE = (
    "-- Generated from the reviewed Pulse source-history design draft.\n"
    "-- The filename must be created by the Supabase CLI; do not hand-author timestamps.\n"
    "-- Deployment gate: integrate the worker and pass the complete H01-H15 review first.\n\n"
)

def fail(message: str) -> int:
    print(f"FAIL: {message}", file=sys.stderr)
    return 1

def render() -> str:
    draft = DRAFT.read_text(encoding="utf-8")
    begins = list(re.finditer(r"(?im)^begin;[ \t]*$", draft))
    rollbacks = list(re.finditer(r"(?im)^rollback;[ \t]*$", draft))
    if len(begins) != 1 or len(rollbacks) != 1 or begins[0].start() >= rollbacks[0].start():
        raise ValueError("draft must contain one BEGIN and one final ROLLBACK wrapper")
    if draft[rollbacks[0].end():].strip():
        raise ValueError("draft has content after its ROLLBACK wrapper")
    body = draft[begins[0].end():rollbacks[0].start()].strip()
    if not body:
        raise ValueError("draft SQL body is empty")
    if re.search(r"(?im)^(begin|rollback);[ \t]*$", body):
        raise ValueError("transaction wrapper leaked into the migration body")
    return PROLOGUE + body + "\n"

def validate_migration_path(raw: str) -> Path:
    path = Path(raw).resolve()
    if path.parent != MIGRATIONS:
        raise ValueError("migration path must be a direct child of supabase/migrations")
    if not re.fullmatch(r"\d{14}_immutable_source_observation_history\.sql", path.name):
        raise ValueError("migration filename is not in the Supabase CLI timestamp_name.sql format")
    return path

def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", help="fill an empty migration file created by Supabase CLI")
    group.add_argument("--check", help="compare an existing migration with the reviewed draft")
    args = parser.parse_args()
    try:
        expected = render()
        path = validate_migration_path(args.output or args.check)
        if args.output:
            if not path.exists():
                return fail("output file must already exist from supabase migration new")
            if path.read_text(encoding="utf-8").strip():
                return fail("refusing to overwrite a non-empty migration file")
            path.write_text(expected, encoding="utf-8")
            print(f"PASS: rendered draft into CLI-generated migration {path.relative_to(ROOT)}")
            return 0
        if not path.exists():
            return fail("migration file does not exist")
        actual = path.read_text(encoding="utf-8")
        if actual != expected:
            return fail("committed migration differs from the reviewed schema draft")
        print(f"PASS: CLI-generated migration matches the reviewed draft: {path.relative_to(ROOT)}")
        return 0
    except (OSError, ValueError) as exc:
        return fail(str(exc))

if __name__ == "__main__":
    raise SystemExit(main())
