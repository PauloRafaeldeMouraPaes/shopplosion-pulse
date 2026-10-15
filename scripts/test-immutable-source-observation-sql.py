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
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE FUNCTION public.pulse_test_fail_observation_write()
RETURNS trigger
LANGUAGE plpgsql
AS $pulse_test_fail_observation_write$
BEGIN
  IF NEW.external_id = 'rpc-atomic-failure' THEN
    RAISE EXCEPTION 'injected observation persistence failure'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$pulse_test_fail_observation_write$;

CREATE TRIGGER pulse_test_fail_observation_write
BEFORE INSERT ON public.intelligence_source_item_observations
FOR EACH ROW EXECUTE FUNCTION public.pulse_test_fail_observation_write();

DO $pulse_schema_contract$
DECLARE
  v_industry_a uuid := gen_random_uuid();
  v_industry_b uuid := gen_random_uuid();
  v_source_a uuid := gen_random_uuid();
  v_source_b uuid := gen_random_uuid();
  v_run_a uuid := gen_random_uuid();
  v_run_b uuid := gen_random_uuid();
  v_run_a2 uuid := gen_random_uuid();
  v_run_a3 uuid := gen_random_uuid();
  v_run_a4 uuid := gen_random_uuid();
  v_run_a5 uuid := gen_random_uuid();
  v_run_a6 uuid := gen_random_uuid();
  v_run_a7 uuid := gen_random_uuid();
  v_run_a8 uuid;
  v_run_a9 uuid := gen_random_uuid();
  v_atomic_failure boolean := false;
  v_item_a uuid := gen_random_uuid();
  v_item_b uuid := gen_random_uuid();
  v_version_a uuid := gen_random_uuid();
  v_version_b uuid := gen_random_uuid();
  v_rpc_first record;
  v_rpc_same record;
  v_rpc_parser record;
  v_rpc_changed record;
  v_rpc_reverted record;
  v_rpc_stale record;
  v_rpc_retry record;
  v_rpc_rejected_repeat record;
  v_function_oid oid;
  v_function_is_definer boolean;
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

  SELECT p.oid, p.prosecdef
    INTO v_function_oid, v_function_is_definer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'pulse_record_source_item_observation'
     AND p.pronargs = 10;
  IF NOT FOUND OR v_function_is_definer THEN
    RAISE EXCEPTION 'atomic RPC is missing or unexpectedly SECURITY DEFINER';
  END IF;
  IF NOT has_function_privilege('service_role', v_function_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute the atomic RPC';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_function_privilege(v_role, v_function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'client role % can execute the server-only RPC', v_role;
    END IF;
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
           (v_run_b, v_source_b, v_industry_b, 'running'),
           (v_run_a2, v_source_a, v_industry_a, 'running'),
           (v_run_a3, v_source_a, v_industry_a, 'running'),
           (v_run_a4, v_source_a, v_industry_a, 'running'),
           (v_run_a5, v_source_a, v_industry_a, 'running'),
           (v_run_a6, v_source_a, v_industry_a, 'running'),
           (v_run_a7, v_source_a, v_industry_a, 'running'),
           (v_run_a9, v_source_a, v_industry_a, 'running');
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

  -- H05: equal external IDs under different sources remain independent.
  INSERT INTO public.intelligence_source_item_versions
    (industry_id, source_id, external_id, content_fingerprint, title, content)
    VALUES
      (v_industry_a, v_source_a, 'shared-external', repeat('1', 64), 'Shared A', 'A'),
      (v_industry_b, v_source_b, 'shared-external', repeat('2', 64), 'Shared B', 'B');
  IF (SELECT count(*) FROM public.intelligence_source_item_versions
       WHERE external_id = 'shared-external') <> 2 THEN
    RAISE EXCEPTION 'H05 identical external IDs from distinct sources collided';
  END IF;

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

  -- Exercise the atomic RPC: first capture, identical repeat, change, revert,
  -- same-run retry, conflicting retry, and source/run tenant mismatch.
  SELECT * INTO v_rpc_first
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
  IF v_rpc_first.outcome <> 'captured'
     OR NOT v_rpc_first.version_created
     OR NOT v_rpc_first.current_item_changed THEN
    RAISE EXCEPTION 'H01 first capture returned unexpected result: %', row_to_json(v_rpc_first);
  END IF;
  -- H11: the source publication date is retained separately from collection time.
  IF NOT EXISTS (
    SELECT 1 FROM public.intelligence_source_item_versions v
     WHERE v.id = v_rpc_first.version_id
       AND v.published_at = '2026-01-01T00:00:00Z'::timestamptz
  ) OR NOT EXISTS (
    SELECT 1 FROM public.intelligence_source_item_observations o
     WHERE o.id = v_rpc_first.observation_id
       AND o.observed_at > '2026-01-01T00:00:00Z'::timestamptz
  ) THEN
    RAISE EXCEPTION 'H11 publication time and observation time were conflated';
  END IF;

  SELECT * INTO v_rpc_same
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a2, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
  IF v_rpc_same.outcome <> 'unchanged'
     OR v_rpc_same.version_created
     OR v_rpc_same.current_item_changed
     OR v_rpc_same.version_id IS DISTINCT FROM v_rpc_first.version_id
     OR v_rpc_same.observation_id IS NOT DISTINCT FROM v_rpc_first.observation_id THEN
    RAISE EXCEPTION 'H02 identical repeat did not reuse version and create new observation';
  END IF;

  -- H14: parser metadata can change without duplicating an identical content version.
  SELECT * INTO v_rpc_parser
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a5, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-2'));
  IF v_rpc_parser.version_created
     OR v_rpc_parser.current_item_changed
     OR v_rpc_parser.version_id IS DISTINCT FROM v_rpc_first.version_id
     OR NOT EXISTS (
       SELECT 1 FROM public.intelligence_source_item_observations o
        WHERE o.id = v_rpc_parser.observation_id
          AND o.metadata->>'parser_version' = 'test-2'
     ) THEN
    RAISE EXCEPTION 'H14 parser metadata change was not separated from content versioning';
  END IF;

  SELECT * INTO v_rpc_changed
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a3, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload two', repeat('e', 64), jsonb_build_object('parser_version', 'test-1'));
  IF v_rpc_changed.outcome <> 'captured'
     OR NOT v_rpc_changed.version_created
     OR NOT v_rpc_changed.current_item_changed
     OR v_rpc_changed.version_id IS NOT DISTINCT FROM v_rpc_first.version_id THEN
    RAISE EXCEPTION 'H03 content change did not create a distinct version';
  END IF;

  -- Retrying the original run after a later version arrived must not
  -- regress the current projection to stale content.
  SELECT * INTO v_rpc_stale
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
  IF v_rpc_stale.version_id IS DISTINCT FROM v_rpc_first.version_id
     OR v_rpc_stale.observation_id IS DISTINCT FROM v_rpc_first.observation_id
     OR v_rpc_stale.current_item_changed THEN
    RAISE EXCEPTION 'stale retry did not return the original observation without changing projection';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.intelligence_source_items
     WHERE source_id = v_source_a AND external_id = 'rpc-item'
       AND content_fingerprint = repeat('e', 64) AND content = 'payload two'
  ) THEN
    RAISE EXCEPTION 'stale retry incorrectly regressed the current projection';
  END IF;

  SELECT * INTO v_rpc_reverted
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a4, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
  IF v_rpc_reverted.outcome <> 'captured'
     OR v_rpc_reverted.version_created
     OR NOT v_rpc_reverted.current_item_changed
     OR v_rpc_reverted.version_id IS DISTINCT FROM v_rpc_first.version_id THEN
    RAISE EXCEPTION 'H04 revert failed to reuse the original immutable version';
  END IF;

  SELECT * INTO v_rpc_retry
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a4, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
  IF v_rpc_retry.observation_id IS DISTINCT FROM v_rpc_reverted.observation_id
     OR v_rpc_retry.outcome <> 'captured'
     OR v_rpc_retry.current_item_changed
     OR v_rpc_retry.version_created THEN
    RAISE EXCEPTION 'H10 same-run retry was not idempotent';
  END IF;

  -- A reused fetch_run/external_id with a different fingerprint must roll back
  -- all writes from that conflicting call, not silently overwrite the projection.
  BEGIN
    PERFORM * FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a4, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'conflicting payload', repeat('9', 64), jsonb_build_object('parser_version', 'test-1'));
    RAISE EXCEPTION 'conflicting same-run retry was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- H09: inject an error after the version and current projection writes
  -- but before the observation can be inserted. The RPC statement must roll
  -- back every write for this item.
  BEGIN
    PERFORM * FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a7, 'rpc-atomic-failure', 'Atomic failure test',
      'https://example.test/atomic-failure', '2026-01-01T00:00:00Z'::timestamptz,
      'payload that must roll back', repeat('8', 64),
      jsonb_build_object('parser_version', 'test-1'));
  EXCEPTION WHEN SQLSTATE '55000' THEN
    v_atomic_failure := true;
  END;

  IF NOT v_atomic_failure THEN
    RAISE EXCEPTION 'H09 injected observation persistence error did not reach caller';
  END IF;
  IF EXISTS (SELECT 1 FROM public.intelligence_source_item_versions
             WHERE source_id = v_source_a AND external_id = 'rpc-atomic-failure')
     OR EXISTS (SELECT 1 FROM public.intelligence_source_items
                WHERE source_id = v_source_a AND external_id = 'rpc-atomic-failure')
     OR EXISTS (SELECT 1 FROM public.intelligence_source_item_observations
                WHERE source_id = v_source_a AND external_id = 'rpc-atomic-failure') THEN
    RAISE EXCEPTION 'H09 failed RPC left partial version, projection, or observation writes';
  END IF;

  -- H12: reject malformed hashes and reject a valid hash reused for
  -- a different payload. Neither error may leave a partial version/observation
  -- or overwrite the current projection.
  BEGIN
    PERFORM * FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a6, 'rpc-invalid-hash', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload invalid hash', repeat('g', 64), jsonb_build_object('parser_version', 'test-1'));
    RAISE EXCEPTION 'malformed content fingerprint was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM * FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a6, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'different payload with reused fingerprint', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
    RAISE EXCEPTION 'fingerprint collision with a different payload was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  IF EXISTS (
    SELECT 1 FROM public.intelligence_source_item_observations
     WHERE fetch_run_id = v_run_a6 AND external_id IN ('rpc-item', 'rpc-invalid-hash')
  ) OR EXISTS (
    SELECT 1 FROM public.intelligence_source_item_versions
     WHERE external_id = 'rpc-invalid-hash'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.intelligence_source_items
     WHERE source_id = v_source_a AND external_id = 'rpc-item'
       AND content_fingerprint = repeat('f', 64) AND content = 'payload one'
  ) THEN
    RAISE EXCEPTION 'H12 invalid/colliding fingerprint left partial writes or changed projection';
  END IF;

  BEGIN
    PERFORM * FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_b, 'rpc-bad-run', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
    RAISE EXCEPTION 'RPC accepted a fetch run from a different source/industry';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Re-fetch must not silently undo an explicit moderation/rejection decision.
  UPDATE public.intelligence_source_items
     SET status = 'rejected'
   WHERE source_id = v_source_a AND external_id = 'rpc-item';

  SELECT * INTO v_rpc_rejected_repeat
    FROM public.pulse_record_source_item_observation(
      v_industry_a, v_source_a, v_run_a9, 'rpc-item', 'RPC item',
      'https://example.test/rpc', '2026-01-01T00:00:00Z'::timestamptz,
      'payload one', repeat('f', 64), jsonb_build_object('parser_version', 'test-1'));
  IF v_rpc_rejected_repeat.outcome <> 'unchanged'
     OR v_rpc_rejected_repeat.version_created
     OR v_rpc_rejected_repeat.current_item_changed THEN
    RAISE EXCEPTION 're-fetch of rejected item returned unexpected version/change flags';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.intelligence_source_items
     WHERE source_id = v_source_a AND external_id = 'rpc-item'
       AND status = 'rejected'
  ) THEN
    RAISE EXCEPTION 'identical re-fetch silently reactivated a rejected item';
  END IF;

  IF (SELECT count(*) FROM public.intelligence_source_item_versions
       WHERE external_id = 'rpc-item') <> 2
     OR (SELECT count(*) FROM public.intelligence_source_item_observations
       WHERE external_id = 'rpc-item') <> 6
     OR NOT EXISTS (
       SELECT 1 FROM public.intelligence_source_items
       WHERE source_id = v_source_a AND external_id = 'rpc-item'
         AND content_fingerprint = repeat('f', 64) AND content = 'payload one'
         AND published_at = '2026-01-01T00:00:00Z'::timestamptz
     )
     OR (SELECT count(*) FROM public.intelligence_source_item_versions) <> 6
     OR (SELECT count(*) FROM public.intelligence_source_item_observations) <> 7 THEN
    RAISE EXCEPTION 'RPC persistence/idempotency/reversion assertions failed';
  END IF;

  -- H12: persist the exact canonical fingerprint vector verified by the Deno test.
  INSERT INTO public.intelligence_source_fetch_runs (source_id, industry_id, status)
    VALUES (v_source_a, v_industry_a, 'running')
    RETURNING id INTO v_run_a8;

  PERFORM * FROM public.pulse_record_source_item_observation(
    v_industry_a, v_source_a, v_run_a8, 'rpc-known-vector', 'Title',
    'https://example.test', NULL, 'body',
    'd7ad18a30127691a8d7589dd77fb832e6bf52834981dcea15845f175c87ad550',
    jsonb_build_object('parser_version', 'fingerprint-vector-test'));

  IF NOT EXISTS (
    SELECT 1 FROM public.intelligence_source_item_versions v
     WHERE v.source_id = v_source_a
       AND v.external_id = 'rpc-known-vector'
       AND v.title = 'Title'
       AND v.url = 'https://example.test'
       AND v.content = 'body'
       AND v.content_fingerprint = 'd7ad18a30127691a8d7589dd77fb832e6bf52834981dcea15845f175c87ad550'
  ) THEN
    RAISE EXCEPTION 'H12 known fingerprint vector was not preserved in the version row';
  END IF;

  -- Independently recompute the fingerprint from the actual persisted snapshot.
  -- json text values are concatenated without whitespace to match JSON.stringify.
  IF NOT EXISTS (
    SELECT 1
      FROM public.intelligence_source_item_versions v
     WHERE v.source_id = v_source_a
       AND v.external_id = 'rpc-known-vector'
       AND encode(
         digest(
           convert_to(
             '[' || to_json(v.title)::text || ',' ||
             to_json(coalesce(v.url, ''))::text || ',' ||
             to_json(v.content)::text || ']',
             'UTF8'
           ),
           'sha256'
         ),
         'hex'
       ) = v.content_fingerprint
  ) THEN
    RAISE EXCEPTION 'H12 independently recomputed persisted snapshot hash did not match';
  END IF;

END;
$pulse_schema_contract$;

-- H07/H08: exercise real SET ROLE queries for both client roles.
-- The intended architecture is worker-only history, so deny direct reads of
-- both tables rather than exposing tenant-filtered history through the API.
SET LOCAL ROLE anon;
DO $pulse_anon_history_access$
DECLARE
  v_denied boolean;
BEGIN
  v_denied := false;
  BEGIN
    PERFORM 1 FROM public.intelligence_source_item_versions LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'H07 anon unexpectedly read source versions'; END IF;
  v_denied := false;
  BEGIN
    PERFORM 1 FROM public.intelligence_source_item_observations LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'H07 anon unexpectedly read source observations'; END IF;
END;
$pulse_anon_history_access$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $pulse_authenticated_history_access$
DECLARE
  v_denied boolean;
BEGIN
  v_denied := false;
  BEGIN
    PERFORM 1 FROM public.intelligence_source_item_versions LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'H07 authenticated unexpectedly read source versions'; END IF;
  v_denied := false;
  BEGIN
    PERFORM 1 FROM public.intelligence_source_item_observations LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'H07 authenticated unexpectedly read source observations'; END IF;
END;
$pulse_authenticated_history_access$;
RESET ROLE;
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
    migration_file = os.environ.get("MIGRATION_SQL_FILE", "").strip()
    if migration_file:
        migration_path = Path(migration_file).resolve()
        migrations_root = (ROOT / "supabase/migrations").resolve()
        if migration_path.parent != migrations_root:
            return fail("safety stop: MIGRATION_SQL_FILE must be inside supabase/migrations")
        if not re.fullmatch(r"\d{14}_immutable_source_observation_history\.sql", migration_path.name):
            return fail("safety stop: migration filename must match Supabase CLI timestamp format")
        if not migration_path.exists():
            return fail("MIGRATION_SQL_FILE does not exist")
        migration_sql = migration_path.read_text(encoding="utf-8")
        if re.search(r"(?im)^(begin|rollback);[ \t]*$", migration_sql):
            return fail("generated migration must not contain the draft's BEGIN/ROLLBACK wrapper")
        if not migration_sql.strip():
            return fail("generated migration is empty")
        sql_to_test = "BEGIN;\n" + migration_sql + "\n" + ASSERTIONS + "\nROLLBACK;\n"
        label = f"CLI-generated migration {migration_path.name}"
    else:
        matches = list(re.finditer(r"(?im)^rollback;[ \t]*$", draft))
        begins = list(re.finditer(r"(?im)^begin;[ \t]*$", draft))
        if len(matches) != 1 or draft[matches[0].start():].strip().lower() != "rollback;":
            return fail("draft must contain exactly one final ROLLBACK statement")
        if len(begins) != 1 or begins[0].start() >= matches[0].start():
            return fail("draft must contain one BEGIN preceding its final ROLLBACK")
        sql_to_test = draft[:matches[0].start()] + ASSERTIONS + "\nROLLBACK;\n"
        label = "review-only schema draft"

    def run_psql(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["psql", "-X", "--no-psqlrc", raw_url, "-v", "ON_ERROR_STOP=1", *args],
            text=True, capture_output=True, check=False,
        )

    fixture_result = run_psql("-f", str(FIXTURE))
    if fixture_result.returncode:
        return fail("failed to create synthetic baseline: " + fixture_result.stderr[-3000:])

    statement = sql_to_test
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

    print(f"PASS: PostgreSQL parsed the {label} and passed tenant-FK, RLS/privilege,")
    print("      atomic RPC, uniqueness, append-only, and rollback assertions on synthetic data.")
    print("LIMIT: synthetic schema only; no production schema, Edge Function, or H01-H15 end-to-end run.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
