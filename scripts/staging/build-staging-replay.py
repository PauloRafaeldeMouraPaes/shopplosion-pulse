#!/usr/bin/env python3
"""Build the ordered SQL replay of production migration history for the staging project.

Output: one file per step in OUT_DIR (default: ./staging-replay), in apply order:
  000  out-of-band objects that production has outside tracked history (rls_auto_enable + ensure_rls)
  001-003  repo migrations applied in production before tracking began (004 never reached production)
  then the production versions in ledger order (72 at the time of the replay; the 73rd, 011, is the released fix) (repo file when mapped, recovered body otherwise)
  999  remaining production drift outside tracked history (see staging-replay-2026-11-17.md)

Substitutions, staging only:
  - production project ref -> staging project ref (cron and Edge Function URLs)
  - the two redacted Vault values in 20260907230216 -> freshly generated random values

Never point this output at production. Nothing here contains a secret.
"""
import csv
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs/database/production-migration-lineage-manifest.csv"
FIXTURES = ROOT / "scripts/staging/replay-fixtures"
PROD_REF = "ppfuygnpgywfpiqxsfys"
STAGING_REF = "ymitcepxpavjedntylem"
REDACTIONS = {
    "'[REDIGIDO 2026-10-31: hash do token removido]'":
        "encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex')",
    "'[REDIGIDO 2026-10-31: segredo removido deste repositorio publico; token rotacionado fora do repositorio]'":
        "gen_random_uuid()::text",
}
PRE_TRACKING_REPO = ["001_multitenant_core.sql", "002_storage_and_membership_hardening.sql",
                     "003_private_document_intelligence.sql"]


def staging_sql(text: str) -> str:
    for old, new in REDACTIONS.items():
        text = text.replace(old, new)
    text = text.replace(PROD_REF, STAGING_REF)
    if "REDIGIDO" in text or PROD_REF in text:
        raise SystemExit("unreplaced redaction or production ref left in replay step")
    return text


def main() -> int:
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "staging-replay")
    out.mkdir(parents=True, exist_ok=True)
    steps = [("000_out_of_band_rls_auto_enable", (FIXTURES / "000_out_of_band_rls_auto_enable.sql").read_text())]
    for name in PRE_TRACKING_REPO:
        steps.append((name[:-4], (ROOT / "supabase/migrations" / name).read_text()))
    with MANIFEST.open(newline="") as fh:
        rows = sorted(csv.DictReader(fh), key=lambda r: r["production_version"])
    for row in rows:
        body = (ROOT / row["repo_path"]).read_text()
        steps.append((f"{row['production_version']}_{row['production_name']}", body))
    steps.append(("999_production_out_of_band_drift", (FIXTURES / "999_production_out_of_band_drift.sql").read_text()))
    if len(rows) < 72:
        raise SystemExit(f"expected at least 72 production versions, manifest has {len(rows)}")
    for i, (name, body) in enumerate(steps):
        (out / f"{i:03d}_{name}.sql").write_text(staging_sql(body))
    print(f"{len(steps)} steps written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
