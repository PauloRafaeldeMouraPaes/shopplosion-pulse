#!/usr/bin/env python3
"""Validate the checked-in migration lineage manifest without connecting to production."""
import csv
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs/database/production-migration-lineage-manifest.csv"
EXPECTED_REPOSITORY_MIGRATIONS = {
    "001_multitenant_core.sql",
    "002_storage_and_membership_hardening.sql",
    "003_private_document_intelligence.sql",
    "004_private_document_integrity.sql",
    "005_evidence_qualification.sql",
    "006_analysis_artifact_state.sql",
    "007_investigations_and_analysis_link.sql",
    "008_analysis_artifact_metadata.sql",
    "009_shopper_knowledge_layer.sql",
    "010_knowledge_updates_saved_evidence.sql",
}
EXPECTED_MAPPINGS = {
    "20260922030555": ("supabase/migrations/007_investigations_and_analysis_link.sql", "confirmed_after_trailing_newline_trim"),
    "20260922030641": ("supabase/migrations/008_analysis_artifact_metadata.sql", "confirmed_exact_blob_match"),
    "20260922031240": ("supabase/migrations/009_shopper_knowledge_layer.sql", "confirmed_exact_blob_match"),
    "20260922032516": ("supabase/migrations/010_knowledge_updates_saved_evidence.sql", "confirmed_exact_blob_match"),
}
ALLOWED_STATUSES = {"unmapped", "confirmed_exact_blob_match", "confirmed_after_trailing_newline_trim"}

def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()

def main() -> int:
    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {
            "production_version", "production_name", "production_sql_chars",
            "production_git_blob_sha1", "production_trimmed_blob_sha1",
            "repo_path", "repo_blob_sha", "mapping_status", "evidence",
        }
        if not required.issubset(set(reader.fieldnames or [])):
            raise AssertionError("Migration lineage manifest is missing required columns")
        rows = list(reader)

    if len(rows) != 72:
        raise AssertionError(f"Expected exactly 72 production migration rows, found {len(rows)}")
    versions = [row["production_version"] for row in rows]
    if len(set(versions)) != len(versions):
        raise AssertionError("Duplicate production migration version")
    if any(not re.fullmatch(r"\d{14}", version) for version in versions):
        raise AssertionError("Every production version must be a 14-digit timestamp")
    if any(row["mapping_status"] not in ALLOWED_STATUSES for row in rows):
        raise AssertionError("Unknown mapping_status in production manifest")

    by_version = {row["production_version"]: row for row in rows}
    for version, (expected_path, expected_status) in EXPECTED_MAPPINGS.items():
        row = by_version.get(version)
        if row is None:
            raise AssertionError(f"Missing confirmed production version {version}")
        if row["repo_path"] != expected_path or row["mapping_status"] != expected_status:
            raise AssertionError(f"Confirmed mapping drifted for production version {version}")
        path = ROOT / expected_path
        if not path.is_file():
            raise AssertionError(f"Mapped repository migration is missing: {expected_path}")
        actual_blob = git_blob_sha(path.read_bytes())
        if actual_blob != row["repo_blob_sha"]:
            raise AssertionError(f"Git blob hash mismatch for {expected_path}: expected {row['repo_blob_sha']}, got {actual_blob}")

    mapped = [row for row in rows if row["mapping_status"] != "unmapped"]
    unmapped = [row for row in rows if row["mapping_status"] == "unmapped"]
    if len(mapped) != 4 or len(unmapped) != 68:
        raise AssertionError(f"Expected 4 evidence-backed mappings and 68 explicit gaps; found {len(mapped)} mapped / {len(unmapped)} unmapped")
    for row in unmapped:
        if row["repo_path"] or row["repo_blob_sha"]:
            raise AssertionError(f"Unmapped production row must not invent repository provenance: {row['production_version']}")
        if not row["evidence"].strip():
            raise AssertionError(f"Unmapped row needs an evidence/disposition note: {row['production_version']}")

    migration_dir = ROOT / "supabase/migrations"
    actual_paths = {path.name for path in migration_dir.glob("*.sql")}
    if actual_paths != EXPECTED_REPOSITORY_MIGRATIONS:
        missing = sorted(EXPECTED_REPOSITORY_MIGRATIONS - actual_paths)
        unexpected = sorted(actual_paths - EXPECTED_REPOSITORY_MIGRATIONS)
        raise AssertionError(f"Repository migration inventory changed; missing={missing}, unexpected={unexpected}. Reconcile the manifest before release.")

    print("Validated 72 production history rows, 4 hash-backed mappings, 68 explicit gaps, and 10 repository migration files.")
    print("This is a checked-in inventory preflight, not proof of live production lineage; no database connection was made.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"Migration lineage manifest check failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
