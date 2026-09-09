#!/usr/bin/env python3
"""Validate the committed Supabase Edge Function deployment manifest."""
from __future__ import annotations
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "supabase" / "functions" / "DEPLOYMENT_MANIFEST.json"
SHA_RE = re.compile(r"^[0-9a-f]{64}$")


def main() -> int:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    functions = data.get("functions")
    if not isinstance(functions, list) or not functions:
        raise SystemExit("manifest.functions must be a non-empty list")

    slugs: set[str] = set()
    errors: list[str] = []
    for entry in functions:
        slug = entry.get("slug")
        path = entry.get("source_path")
        sha = entry.get("deployed_sha256")
        auth = entry.get("verify_jwt")
        lifecycle = entry.get("lifecycle", "active")
        if not slug or slug in slugs:
            errors.append(f"duplicate/missing slug: {slug!r}")
        slugs.add(slug)
        if not path or not (ROOT / path).is_file():
            errors.append(f"missing source_path for {slug}: {path}")
        if not isinstance(sha, str) or not SHA_RE.fullmatch(sha):
            errors.append(f"invalid deployed_sha256 for {slug}")
        if not isinstance(auth, bool):
            errors.append(f"verify_jwt must be boolean for {slug}")
        if lifecycle not in {"active", "legacy_disabled_scheduler"}:
            errors.append(f"invalid lifecycle for {slug}: {lifecycle}")

    if errors:
        print("EDGE FUNCTION MANIFEST: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"EDGE FUNCTION MANIFEST: PASS ({len(functions)} functions)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
