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
ALLOWED_STATUSES = {"unmapped", "confirmed_exact_blob_match", "confirmed_after_trailing_newline_trim", "recovered_from_production_history"}

def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()

def main() -> int:
    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {
            "production_version", "production_name", "production_sql_chars", "production_sql_bytes",
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
        actual_bytes = path.read_bytes()
        actual_blob = git_blob_sha(actual_bytes)
        expected_production_hash = row["production_git_blob_sha1"] if expected_status == "confirmed_exact_blob_match" else row["production_trimmed_blob_sha1"]
        if actual_blob != row["repo_blob_sha"] or actual_blob != expected_production_hash:
            raise AssertionError(f"Git blob hash mismatch for {expected_path}: expected {expected_production_hash}, got {actual_blob}")
        if git_blob_sha(actual_bytes.rstrip(b"\r\n")) != row["production_trimmed_blob_sha1"]:
            raise AssertionError(f"Trimmed production Git blob hash mismatch for {expected_path}")
        if expected_status == "confirmed_exact_blob_match" and len(actual_bytes) != int(row["production_sql_bytes"]):
            raise AssertionError(f"Production byte length mismatch for {expected_path}")

    current_mappings = [row for row in rows if row["mapping_status"] in {"confirmed_exact_blob_match", "confirmed_after_trailing_newline_trim"}]
    recovered = [row for row in rows if row["mapping_status"] == "recovered_from_production_history"]
    unmapped = [row for row in rows if row["mapping_status"] == "unmapped"]
    if len(current_mappings) != 4 or len(recovered) != 68 or len(unmapped) != 0:
        raise AssertionError(
            f"Expected 4 current-file mappings, 68 exact production-body archives, and 0 unmapped rows; "
            f"found {len(current_mappings)} / {len(recovered)} / {len(unmapped)}"
        )
    for row in recovered:
        if not row["repo_path"].startswith("docs/database/recovered-production-migrations/") or not row["repo_path"].endswith(".sql.txt"):
            raise AssertionError(f"Recovered body must be a non-executable .sql.txt archive: {row['production_version']}")
        if row["repo_blob_sha"] != row["production_git_blob_sha1"]:
            raise AssertionError(f"Recovered production SQL SHA mismatch in manifest: {row['production_version']}")
        path = ROOT / row["repo_path"]
        if not path.is_file():
            raise AssertionError(f"Recovered archive missing: {row['repo_path']}")
        actual_bytes = path.read_bytes()
        actual_blob = git_blob_sha(actual_bytes)
        if actual_blob != row["repo_blob_sha"] or actual_blob != row["production_git_blob_sha1"]:
            raise AssertionError(f"Recovered archive Git blob hash mismatch for {row['production_version']}")
        if len(actual_bytes) != int(row["production_sql_bytes"]):
            raise AssertionError(f"Recovered archive byte length mismatch for {row['production_version']}")
        if git_blob_sha(actual_bytes.rstrip(b"\r\n")) != row["production_trimmed_blob_sha1"]:
            raise AssertionError(f"Recovered archive trimmed hash mismatch for {row['production_version']}")
        text = path.read_text(encoding="utf-8")
        if len(text) != int(row["production_sql_chars"]):
            raise AssertionError(f"Recovered archive character length mismatch for {row['production_version']}")
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

    print("Validated 72 production SQL bodies with UTF-8 byte-accurate Git blob hashes, 4 current migration-file mappings, 68 exact archived SQL bodies, 0 unmapped versions, and 10 active migration files.")
    print("Archived bodies are exact read-only copies from the production ledger; original Git authoring context and safe forward-only release strategy remain separate gates. No database connection was made by this validator.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"Migration lineage manifest check failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
