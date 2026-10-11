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
SQL_DRAFT = ROOT / "docs/pilots/immutable-source-observation-schema-draft.sql"
WORKER = ROOT / "supabase/functions/pulse-external-source-worker/index.ts"

def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)

def main() -> int:
    design = DESIGN.read_text(encoding="utf-8")
    cases = CASES.read_text(encoding="utf-8")
    sql = SQL_DRAFT.read_text(encoding="utf-8")
    worker = WORKER.read_text(encoding="utf-8")

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

    # The SQL is a review-only draft: require an explicit rollback and the
    # core tenant-aware constraints before it can be considered for migration.
    require("DESIGN DRAFT ONLY" in sql, "SQL draft must be marked non-migration")
    require(re.search(r"(?im)^rollback;\s*$", sql) is not None,
            "SQL draft must end in ROLLBACK so accidental execution cannot persist")
    for token in ("foreign key (fetch_run_id, source_id, industry_id)",
                  "foreign key (version_id, source_id, industry_id)",
                  "enable row level security",
                  "revoke all",
                  "on delete restrict",
                  "unique (fetch_run_id, external_id)",
                  "reject_intelligence_source_history_mutation",
                  "versions_append_only",
                  "observations_append_only",
                  "pulse_record_source_item_observation",
                  "security invoker",
                  "grant execute on function",
                  "pg_advisory_xact_lock"):
        require(token.lower() in sql.lower(),
                f"SQL draft is missing required safeguard: {token}")

    # Guard that the actual collector uses the new atomic write path rather
    # than silently preserving the old overwrite-only upsert implementation.
    for token in (
        "admin.rpc('pulse_record_source_item_observation'",
        "if(recordError)throw new Error('source_item_history_persist_failed:",
        "if(!Array.isArray(recorded)||recorded.length!==1)",
        "p_metadata:{source_type:s.source_type,parser_version:'external-source-worker-v1'}",
        "const fp=await sha(JSON.stringify([title,url||'',content]));",
        "fetch_run_create_failed:",
        "fetch_run_finish_failed:",
    ):
        require(token in worker, f"Worker is missing required history guard: {token}")
    require("admin.from('intelligence_source_items').upsert" not in worker,
            "Worker still writes the current projection via the old upsert-only path")

    print("PASS: static design preflight; H01-H15, safety contract, and SQL-draft guardrails are present.")
    print("LIMIT: static checks are not runtime validation; PostgreSQL contract tests run separately in CI.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
