#!/usr/bin/env python3
"""Execute the review-only schema draft against a dedicated local/ephemeral PostgreSQL.

Safety: accepts only localhost PostgreSQL on database pulse_test. The script
runs all draft DDL and synthetic assertions inside a transaction, then verifies
the transaction rolled back. It cannot be pointed at Supabase or a remote host.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DRAFT = ROOT / "docs/pilots/immutable-source-observation-schema-draft.sql"
FIXTURE = ROOT / "tests/fixtures/immutable-source-history-baseline.sql"

ASSERTIONS = r"""
DO $pulse_schema_contract$
DECLARE
  v_industry_a uuid := gen_random_uuid();
  v_industry_b uuid := gen_random_uuid();
  v_source_a uuid := gen_random_uuid();
  v_source_b uuid := gen_random_uuid();
  v_run_a uuid := gen_random_uuid();
  v_run_b uuid := gen_random_uuid();
  v_item_a uuid := gen_random_uuid();
  v_item_b uuid := gen_random_uuid();
  v_version_a uuid := gen_random_uuid();
  v_version_b uuid := gen_random_uuid();
  v_role text;
BEGIN
  IF to_regclass('public.intelligence_source_item_versions') IS NULL
     OR to_regclass('public.intelligence_source_item_observations') IS NULL THEN
    RAISE EXCEPTION 'history tables were not created inside the transaction';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.intelligence_source_item_versions'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class
             WHERE oid = 'public.intelligence_source_item_observations'::regclass) THEN
    RAISE EXCEPTION 'RLS is not enabled on both history tables';
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'intelligence_source_item_observations_run_fk'
        AND convalidated
        AND pg_get_constraintdef(oid) ILIKE
          'FOREIGN KEY (fetch_run_id, source_id, industry_id)%'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'intelligence_source_item_observations_version_fk'
        AND convalidated
        AND pg_get_constraintdef(oid) ILIKE
          'FOREIGN KEY (version_id, source_id, industry_id)%'
    )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'intelligence_source_item_observations_item_fk'
        AND convalidated
        AND pg_get_constraintdef(oid) ILIKE
          'FOREIGN KEY (source_item_id, source_id, industry_id)%'
    ) THEN
    RAISE EXCEPTION 'tenant-aware composite foreign keys are missing or unvalidated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgname = 'intelligence_source_item_versions_append_only'
        AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgname = 'intelligence_source_item_observations_append_only'
        AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'append-only triggers are missing';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.intelligence_source_item_versions', 'SELECT')
       OR has_table_privilege(v_role, 'public.intelligence_source_item_versions', 'INSERT')
       OR has_table_privilege(v_role, 'public.intelligence_source_item_versions', 'UPDATE')
       OR has_table_privilege(v_role, 'public.intelligence_source_item_versions', 'DELETE')
       OR has_table_privilege(v_role, 'public.intelligence_source_item_observations', 'SELECT')
       OR has_table_privilege(v_role, 'public.intelligence_source_item_observations', 'INSERT')
       OR has_table_privilege(v_role, 'public.intelligence_source_item_observations', 'UPDATE')
       OR has_table_privilege(v_role, 'public.intelligence_source_item_observations', 'DELETE') THEN
      RAISE EXCEPTION 'unexpected client privileges on history tables for role %', v_role;
    END IF;
  END LOOP;

  INSERT INTO public.industries (id, slug, status)
    VALUES (v_industry_a, 'contract-a', 'active'),
           (v_industry_b, 'contract-b', 'active');
  INSERT INTO public.intelligence_sources (id, industry_id)
    VALUES (v_source_a, v_industry_a), (v_source_b, v_industry_b);
  INSERT INTO public.intelligence_source_fetch_runs (id, source_id, industry_id, status)
    VALUES (v_run_a, v_source_a, v_industry_a, 'running'),
           (v_run_b, v_source_b, v_industry_b, 'running');
  INSERT INTO public.intelligence_source_items
    (id, source_id, industry_id, external_id, title, content, content_fingerprint)
    VALUES
      (v_item_a, v_source_a, v_industry_a, 'item-a', 'A', 'content A', repeat('c', 64)),
      (v_item_b, v_source_b, v_industry_b, 'item-b', 'B', 'content B', repeat('d', 64));
  INSERT INTO public.intelligence_source_item_versions
    (id, industry_id, source_id, external_id, content_fingerprint, title, url, content)
    VALUES
      (v_version_a, v_industry_a, v_source_a, 'item-a', repeat('a', 64), 'A', 'https://example.test/a', 'content A'),
      (v_version_b, v_industry_b, v_source_b, 'item-b', repeat('b', 64), 'B', 'https://example.test/b', 'content B');

  -- A correctly scoped observation must be accepted.
  INSERT INTO public.intelligence_source_item_observations
    (industry_id, source_id, fetch_run_id, source_item_id, version_id, external_id, outcome)
    VALUES (v_industry_a, v_source_a, v_run_a, v_item_a, v_version_a, 'item-a', 'captured');

  -- Cross-tenant run, item, and version references must fail independently.
  BEGIN
    INSERT INTO public.intelligence_source_item_observations
      (industry_id, source_id, fetch_run_id, source_item_id, version_id, external_id, outcome)
      VALUES (v_industry_a, v_source_a, v_run_b, v_item_a, v_version_a, 'bad-run', 'captured');
    RAISE EXCEPTION 'cross-tenant fetch_run_id was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.intelligence_source_item_observations
      (industry_id, source_id, fetch_run_id, source_item_id, version_id, external_id, outcome)
      VALUES (v_industry_a, v_source_a, v_run_a, v_item_b, v_version_a, 'bad-item', 'captured');
    RAISE EXCEPTION 'cross-tenant source_item_id was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.intelligence_source_item_observations
      (industry_id, source_id, fetch_run_id, source_item_id, version_id, external_id, outcome)
      VALUES (v_industry_a, v_source_a, v_run_a, v_item_a, v_version_b, 'bad-version', 'captured');
    RAISE EXCEPTION 'cross-tenant version_id was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Retry within the same run/external identity must not duplicate an observation.
  BEGIN
    INSERT INTO public.intelligence_source_item_observations
      (industry_id, source_id, fetch_run_id, source_item_id, version_id, external_id, outcome)
      VALUES (v_industry_a, v_source_a, v_run_a, v_item_a, v_version_a, 'item-a', 'captured');
    RAISE EXCEPTION 'duplicate observation was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Identical content identity must map to a single version.
  BEGIN
    INSERT INTO public.intelligence_source_item_versions
      (industry_id, source_id, external_id, content_fingerprint, title, content)
      VALUES (v_industry_a, v_source_a, 'item-a', repeat('a', 64), 'A duplicate', 'duplicate');
    RAISE EXCEPTION 'duplicate version identity was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Versions and observations cannot be silently changed or deleted.
  BEGIN
    UPDATE public.intelligence_source_item_versions SET content = 'tampered' WHERE id = v_version_a;
    RAISE EXCEPTION 'version UPDATE was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.intelligence_source_item_versions WHERE id = v_version_a;
    RAISE EXCEPTION 'version DELETE was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    UPDATE public.intelligence_source_item_observations SET metadata = '{"tampered":true}'::jsonb
      WHERE fetch_run_id = v_run_a AND external_id = 'item-a';
    RAISE EXCEPTION 'observation UPDATE was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;
  BEGIN
    DELETE FROM public.intelligence_source_item_observations
      WHERE fetch_run_id = v_run_a AND external_id = 'item-a';
    RAISE EXCEPTION 'observation DELETE was accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
  END;

  IF (SELECT count(*) FROM public.intelligence_source_item_versions) <> 2
     OR (SELECT count(*) FROM public.intelligence_source_item_observations) <> 1 THEN
    RAISE EXCEPTION 'unexpected row counts after acceptance assertions';
  END IF;
END;
$pulse_schema_contract$;
"""

def fail(message: str) -> int:
    print(f"FAIL: {message}", file=sys.stderr)
    return 1

def main() -> int:
    raw_url = os.environ.get("DATABASE_URL", "")
    if not raw_url:
        return fail("DATABASE_URL is required")
    parsed = urlsplit(raw_url)
    host = (parsed.hostname or "").lower()
    database = unquote(parsed.path.lstrip("/"))
    if host not in {"localhost", "127.0.0.1", "::1"}:
        return fail("safety stop: DATABASE_URL host must be localhost/loopback")
    if database != "pulse_test":
        return fail("safety stop: DATABASE_URL database must be exactly pulse_test")
    if parsed.port not in {None, 5432}:
        return fail("safety stop: DATABASE_URL port must be 5432")
    if not shutil.which("psql"):
        return fail("psql client was not found on the runner")

    if not DRAFT.exists() or not FIXTURE.exists():
        return fail("schema draft or synthetic fixture is missing")
    draft = DRAFT.read_text(encoding="utf-8")
    matches = list(re.finditer(r"(?im)^rollback;\s*$", draft))
    if len(matches) != 1 or matches[0].end() != len(draft.rstrip()):
        return fail("draft must contain exactly one final ROLLBACK statement")

    def run_psql(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["psql", "-X", "--no-psqlrc", raw_url, "-v", "ON_ERROR_STOP=1", *args],
            text=True, capture_output=True, check=False,
        )

    fixture_result = run_psql("-f", str(FIXTURE))
    if fixture_result.returncode:
        return fail("failed to create synthetic baseline: " + fixture_result.stderr[-3000:])

    statement = draft[:matches[0].start()] + ASSERTIONS + "\nROLLBACK;\n"
    import tempfile
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".sql") as temp:
        temp.write(statement)
        temp.flush()
        result = run_psql("-f", temp.name)
    if result.returncode:
        return fail("PostgreSQL rejected the schema/assertions: " + result.stderr[-5000:])

    clean = run_psql(
        "-At", "-c",
        "SELECT CASE WHEN "
        "to_regclass('public.intelligence_source_item_versions') IS NULL AND "
        "to_regclass('public.intelligence_source_item_observations') IS NULL AND "
        "NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN "
        "('intelligence_sources_id_industry_unique', "
        "'intelligence_source_fetch_runs_id_source_industry_unique', "
        "'intelligence_source_items_id_source_industry_unique')) "
        "THEN 'clean' ELSE 'dirty' END;"
    )
    if clean.returncode or clean.stdout.strip() != "clean":
        return fail("draft did not leave the synthetic database unchanged after rollback")

    print("PASS: PostgreSQL parsed the draft and passed tenant-FK, RLS/privilege,")
    print("      uniqueness, append-only, and rollback assertions on synthetic data.")
    print("LIMIT: synthetic schema only; no production schema, Edge Function, or H01-H15 end-to-end run.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
