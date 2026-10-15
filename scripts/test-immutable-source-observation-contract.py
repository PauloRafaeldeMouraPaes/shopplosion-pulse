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
SQL_TEST = ROOT / "scripts/test-immutable-source-observation-sql.py"
WORKER = ROOT / "supabase/functions/pulse-external-source-worker/index.ts"
FETCH_HELPER = ROOT / "supabase/functions/_shared/fetch-source.ts"
FETCH_TEST = ROOT / "supabase/functions/_shared/fetch-source.test.ts"
FAILURE_HELPER = ROOT / "supabase/functions/_shared/record-source-failure.ts"
FAILURE_TEST = ROOT / "supabase/functions/_shared/record-source-failure.test.ts"
WORKER_INTEGRATION_TEST = ROOT / "supabase/functions/pulse-external-source-worker/index.postgres.test.ts"
FINGERPRINT_HELPER = ROOT / "supabase/functions/_shared/source-content-fingerprint.ts"
FINGERPRINT_TEST = ROOT / "supabase/functions/_shared/source-content-fingerprint.test.ts"

def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)

def main() -> int:
    design = DESIGN.read_text(encoding="utf-8")
    cases = CASES.read_text(encoding="utf-8")
    sql = SQL_DRAFT.read_text(encoding="utf-8")
    sql_test = SQL_TEST.read_text(encoding="utf-8")
    worker = WORKER.read_text(encoding="utf-8")
    fetch_helper = FETCH_HELPER.read_text(encoding="utf-8")
    fetch_test = FETCH_TEST.read_text(encoding="utf-8")
    failure_helper = FAILURE_HELPER.read_text(encoding="utf-8")
    failure_test = FAILURE_TEST.read_text(encoding="utf-8")
    worker_integration_test = WORKER_INTEGRATION_TEST.read_text(encoding="utf-8")
    fingerprint_helper = FINGERPRINT_HELPER.read_text(encoding="utf-8")
    fingerprint_test = FINGERPRINT_TEST.read_text(encoding="utf-8")

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
                  "pulse_record_source_item_observation", "RLS", "anon", "authenticated"):
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
    require("R01" in cases and "status='rejected'" in cases.lower(),
            "Test contract must cover preservation of rejected moderation state")

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
                  "previous_fetch_run_id",
                  "intelligence_source_fetch_runs_previous_run_fk",
                  "intelligence_source_fetch_runs_single_successor_idx",
                  "reject_intelligence_source_history_mutation",
                  "versions_append_only",
                  "observations_append_only",
                  "pulse_record_source_item_observation",
                  "security invoker",
                  "grant execute on function",
                  "pg_advisory_xact_lock",
                  "An existing observation makes this call a retry",
                  "stale retries",
                  "current_item.status = 'rejected'",
                  "re-fetching is not authorization to undo an explicit moderation decision"):
        require(token.lower() in sql.lower(),
                f"SQL draft is missing required safeguard: {token}")

    # Guard that the actual collector uses the new atomic write path rather
    # than silently preserving the old overwrite-only upsert implementation.
    for token in (
        "admin.rpc('pulse_record_source_item_observation'",
        "source_item_history_persist_failed:",
        "if(!Array.isArray(recorded)||recorded.length!==1)",
        "scope_fingerprint:scopeFingerprint,absence_inference_eligible:false,completeness_status:" + chr(34) + "incomplete" + chr(34) + ",completeness_reason:" + chr(34) + "exhaustive_scope_and_pagination_not_proven" + chr(34) + "}",
        "const fp=await sourceContentFingerprint(title,url,content);",
        "previous_fetch_run_id:previousRun?.id||null",
        "fetch_run_predecessor_query_failed",
        "fetch_run_create_failed:",
        "fetch_run_finish_failed:",
        "fetchSource(s.url,fetchWithTimeout,wait)",
        "dependencies.fetchSource ?? fetchSourceWithRetry",
        "if (import.meta.main) Deno.serve(createSourceWorkerHandler())",
    ):
        require(token in worker, f"Worker is missing required history guard: {token}")
    run_finish = worker.index("status:'completed',items_seen:itemsSeen,items_changed:itemsChanged")
    source_success = worker.index("last_success_at:now,last_error:null")
    require(run_finish < source_success,
            "Worker records source success before fetch-run completion can fail")

    for token in (
        "response.ok || response.status === 403",
        "throw new Error(`http_${response?.status || 0}`)",
    ):
        require(token in fetch_helper, f"HTTP retry helper is missing safety behavior: {token}")
    require("HTTP 403 is not retried" in fetch_test,
            "HTTP 403 no-retry unit test is missing")
    require("transient server errors can retry before success" in fetch_test,
            "transient retry unit test is missing")
    require("failureWrites.sourceStatusPersisted" in worker and "failureWrites.runStatusPersisted" in worker,
            "Worker must observe failed error-state persistence rather than reporting success")
    require("status:failureBookkeepingFailed>0?'reconciliation_incomplete'" in worker,
            "Worker must expose incomplete failure reconciliation in its response")
    require("completeness_status:'incomplete'" in worker and "absence_inference_eligible:false" in worker,
            "Worker must keep unproven snapshots ineligible for absence inference")
    require("scope_fingerprint:scopeFingerprint" in worker and "response_content_type:responseContentType" in worker,
            "Worker must persist run scope and response metadata")
    require("recordSourceFailure" in worker,
            "Worker failure path does not use failure bookkeeping helper")
    require("source_failure_status_persist_failed" in failure_helper,
            "Failure bookkeeping helper does not report status-write failures")
    require("failure bookkeeping errors are observable and do not escape" in failure_test,
            "Failure bookkeeping failure-path unit test is missing")
    for token in ("PostgreSQL-backed worker reconciles a forbidden source",
                  "PostgreSQL-backed worker reconciles observation RPC persistence failure",
                  "absence_inference_eligible", "source_item_history_persist_failed"):
        require(token in worker_integration_test,
                f"Worker PostgreSQL failure contract is missing: {token}")
    require("sourceContentFingerprint(title,url,content)" in worker,
            "Worker does not use the canonical fingerprint helper")
    require("SHA-256(JSON.stringify([title, url ?? \"\", content]))" in fingerprint_helper,
            "Canonical fingerprint tuple contract is missing")
    require("d7ad18a30127691a8d7589dd77fb832e6bf52834981dcea15845f175c87ad550" in fingerprint_test,
            "Known canonical fingerprint vector is missing")
    require("null URL normalizes to empty string" in fingerprint_test,
            "Null URL normalization test is missing")

    require("admin.from('intelligence_source_items').upsert" not in worker,
            "Worker still writes the current projection via the old upsert-only path")
    require("stableSourceExternalId(x)" in worker,
            "JSON collector must use the tested stable identity helper")
    require("x.external_id.length>0" in worker,
            "JSON collector must reject records without stable external identity")
    require("x.id||x.guid||x.url||i" not in worker,
            "JSON collector must not use mutable array position as identity")
    require("stableFeedExternalId(tag(b,\"guid\"),link)||\"\"" in worker,
            "RSS parser must not use position/title as an identity fallback")
    require("stableFeedExternalId(tag(b,\"id\"),link)||\"\"" in worker,
            "Atom parser must not use position/title as an identity fallback")
    require("x.external_id.length>0&&x.content.length>=30" in worker,
            "Feed parsers must reject entries without stable identity")
    require("coverage_status" in design and "scope_fingerprint" in design,
            "H13 source completeness contract is missing")
    require("duas execuções completas consecutivas" in cases,
            "H13 must require consecutive complete snapshots")

    # H07/H08 deliberately keep retained source history worker-only. Assert
    # the SQL contract tests both client roles against both history tables.
    for token in (
        "SET LOCAL ROLE anon;",
        "SET LOCAL ROLE authenticated;",
        "intelligence_source_item_versions",
        "intelligence_source_item_observations",
        "H07 anon unexpectedly read",
        "H07 authenticated unexpectedly read",
    ):
        require(token in sql_test,
                f"SQL contract is missing client-access denial case: {token}")

    print("PASS: static design preflight; H01-H15, safety contract, and SQL-draft guardrails are present.")
    print("LIMIT: static checks are not runtime validation; PostgreSQL contract tests run separately in CI.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
