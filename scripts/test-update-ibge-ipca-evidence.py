#!/usr/bin/env python3
"""Regression test for scripts/update-ibge-ipca-evidence.py (offline).

Rebuilds every published IPCA item that the generator wrote (ibge-ipca-alimentos-<AAAA-MM> with a capture in
docs/data) from its saved raw SIDRA response and checks that the result equals the published item field for
field. Also checks the helpers and that a response missing a value is refused."""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("upd", ROOT / "scripts/update-ibge-ipca-evidence.py")
upd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upd)
fail = []

if not (upd.shift("2026-01", -1) == "2025-12" and upd.pt(-0.34) == "-0,34" and upd.var_text(0.83) == "subiu 0,83%" and upd.var_text(-0.24) == "caiu 0,24%"):
    fail.append("helpers")
published = {e["id"]: e for e in upd.load_evidence()}
captures = sorted((ROOT / "docs/data").glob("ibge-ipca-7060-*.capture.json"))
if not captures:
    fail.append("no IPCA capture in docs/data")
for cap_path in captures:
    cap = json.loads(cap_path.read_text(encoding="utf-8"))
    item = upd.build_item(cap)
    pub = published.get(item["id"])
    if not pub:
        fail.append(f"{item['id']}: capture without published item")
        continue
    for k, v in item.items():
        if k == "keywords":
            continue
        if pub.get(k) != v:
            fail.append(f"{item['id']}.{k} differs from the published item")
    raw = ROOT / cap["raw_file"]
    import hashlib
    if hashlib.sha256(raw.read_bytes()).hexdigest() != cap["raw_sha256"]:
        fail.append(f"{cap['raw_file']}: SHA-256 differs from the capture record")
cap = json.loads(captures[-1].read_text(encoding="utf-8"))
rows = json.loads((ROOT / cap["raw_file"]).read_bytes())
broken = [rows[0]] + [r for r in rows[1:] if not (r["D2C"] == "63" and r["D4C"] == "7170" and r["D3C"] == cap["month"].replace("-", ""))]
tmp = ROOT / "docs/data/_test-broken.json"
try:
    tmp.write_text(json.dumps(broken), encoding="utf-8")
    try:
        upd.build_item(dict(cap, raw_file=str(tmp)))
        fail.append("a response missing a value must be refused")
    except ValueError:
        pass
finally:
    tmp.unlink(missing_ok=True)

if fail:
    print("IBGE IPCA evidence generator: FAIL")
    for f in fail:
        print(" -", f)
    sys.exit(1)
print(f"IBGE IPCA evidence generator: PASS ({len(captures)} published month(s) regenerated from their raw captures, identical; missing values refused)")
