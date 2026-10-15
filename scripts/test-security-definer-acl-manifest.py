#!/usr/bin/env python3
"""Validate the read-only SECURITY DEFINER ACL inventory; this does not change grants."""
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs/database/security-definer-acl-manifest-2026-10-15.csv"
REQUIRED_COLUMNS = {
    "routine", "identity_arguments", "security_definer", "anon_execute",
    "authenticated_execute", "service_role_execute", "owner",
    "observed_dependency", "initial_disposition", "required_validation",
}
ALLOWED_DISPOSITIONS = {
    "internal_only", "authenticated_user_context", "trigger_only", "review_required",
}
EXPECTED_EXPOSED = {
    "auth_industry_context", "capture_document_version",
    "capture_intelligence_signal_event", "pulse_capture_document_version",
    "pulse_external_backstop_schedule_tick",
    "pulse_external_intelligence_contract_check",
    "pulse_external_intelligence_fallback_candidate",
    "pulse_external_intelligence_self_test",
    "pulse_external_signal_deterministic_backstop",
    "pulse_intelligence_external_quality_check",
    "pulse_resolve_stale_intelligence_signals",
}

def main() -> int:
    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        columns = set(reader.fieldnames or [])
        if not REQUIRED_COLUMNS.issubset(columns):
            raise AssertionError(f"Missing manifest columns: {sorted(REQUIRED_COLUMNS - columns)}")
        rows = list(reader)
    if len(rows) < 22:
        raise AssertionError(f"Expected at least 22 catalogued SECURITY DEFINER routines, found {len(rows)}")
    names = [row["routine"] for row in rows]
    if len(names) != len(set(names)):
        raise AssertionError("Duplicate routine name in ACL manifest")
    missing = EXPECTED_EXPOSED - set(names)
    if missing:
        raise AssertionError(f"Missing client-executable routine(s): {sorted(missing)}")
    for row in rows:
        if row["security_definer"].lower() != "true":
            raise AssertionError(f"Manifest row is not SECURITY DEFINER: {row['routine']}")
        for field in ("anon_execute", "authenticated_execute", "service_role_execute"):
            if row[field].lower() not in {"true", "false"}:
                raise AssertionError(f"Invalid boolean {field} for {row['routine']}")
        if row["initial_disposition"] not in ALLOWED_DISPOSITIONS:
            raise AssertionError(f"Invalid disposition for {row['routine']}: {row['initial_disposition']}")
        if not row["required_validation"].strip():
            raise AssertionError(f"Missing validation requirement for {row['routine']}")
    print(f"Validated {len(rows)} SECURITY DEFINER inventory rows; no production changes performed.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"SECURITY DEFINER ACL manifest check failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
