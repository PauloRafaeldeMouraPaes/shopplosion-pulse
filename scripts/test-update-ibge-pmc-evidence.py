#!/usr/bin/env python3
"""Regression test for scripts/update-ibge-pmc-evidence.py.

Rebuilds the evidence item for August 2026 from the raw captures of 2026-10-31 kept in docs/data and
checks that every number the generator writes equals what the published item ibge-pmc-super-agosto-2026
states (the item was written by hand from the same captures and verified against the API). Also checks
the small helpers and that a gap in the adjusted series is refused. Offline: no network.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("upd", ROOT / "scripts/update-ibge-pmc-evidence.py")
upd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upd)

ADJ = ROOT / "docs/data/ibge-pmc-8882-v7170-a90672-2026-10-31.capture.json"
VAR = ROOT / "docs/data/ibge-pmc-8882-a90672-variacoes-2026-10-31.capture.json"
NUM = re.compile(r"-?\d+(?:,\d+)?")
failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


check(upd.shift("2026-08", 1) == "2026-09" and upd.shift("2026-01", -1) == "2025-12" and upd.shift("2026-08", -12) == "2025-08", "shift")
check(upd.move(0.5) == "cresceu 0,5%" and upd.move(-0.3) == "caiu 0,3%" and upd.move(0.0) == "ficou estável (0,0%)", "move")
check(upd.accumulated(1.4) == "alta de 1,4%" and upd.accumulated(-2.0) == "queda de 2,0%", "accumulated")
check(upd.signed(0.5) == "+0,5" and upd.signed(-0.4) == "-0,4" and upd.pt(110.86, 2) == "110,86", "formatting")

adjusted = json.loads(ADJ.read_text(encoding="utf-8"))
variations = json.loads(VAR.read_text(encoding="utf-8"))
item = upd.build_item(adjusted, variations)
published = next(e for e in upd.load_evidence() if e["id"] == "ibge-pmc-super-agosto-2026")

check(item["id"] == published["id"], "id of the regenerated item")
for key in ("periodo", "valor", "comparacao", "fonte", "url", "indicador"):
    check(item[key] == published[key], f"{key}: {item[key]!r} != {published[key]!r}")
check(NUM.findall(item["fato"]) == NUM.findall(published["fato"]), f"numbers in fato differ: {NUM.findall(item['fato'])} vs {NUM.findall(published['fato'])}")
check([(s["period"], s["value"]) for s in item["serie_historica"]] == [(s["period"], s["value"]) for s in published["serie_historica"]], "serie_historica values")
check(all({k: v for k, v in a.items() if k != "source"} == {k: v for k, v in b.items() if k != "source"}
          for a, b in zip(item["serie_historica"], published["serie_historica"])), "serie_historica fields (metric, unit, methodology, provenance, url)")
check("108,98" in item["interpretacao"] and "111,80" in item["interpretacao"] and "1,3% acima" in item["interpretacao"], "interpretacao range and same-month comparison")
check("+0,5% ante o mês anterior" in item["hipotese"] and "11708" in item["hipotese"], "hipotese base effect read from 11708")
check(adjusted["raw_sha256"] in item["fonte_primaria"] and variations["raw_sha256"] in item["fonte_primaria"], "raw SHA-256 recorded in fonte_primaria")
check(item["fato_verificado_na_fonte"].startswith("SIM:"), "verified flag")
check("–" not in json.dumps(item, ensure_ascii=False) and "—" not in json.dumps(item, ensure_ascii=False), "no U+2013/U+2014")
check("[A DEFINIR]" not in json.dumps(item, ensure_ascii=False), "no placeholders")

broken = json.loads(json.dumps(adjusted))
broken["serie_historica"] = [s for s in broken["serie_historica"] if s["period"] != "2026-03"] + [dict(broken["serie_historica"][0], period="2025-07")]
broken["serie_historica"].sort(key=lambda s: s["period"])
try:
    upd.build_item(broken, variations)
    failures.append("a gap in the adjusted series must be refused")
except ValueError:
    pass
missing = json.loads(json.dumps(variations))
missing["values"] = [v for v in missing["values"] if not (v["variable"] == "11709" and v["period"] == "2026-08")]
try:
    upd.build_item(adjusted, missing)
    failures.append("a missing variation must be refused")
except ValueError:
    pass

if failures:
    print("IBGE PMC evidence generator: FAIL")
    for f in failures:
        print(f" - {f}")
    sys.exit(1)
print("IBGE PMC evidence generator: PASS (August 2026 regenerated from the raw captures matches the published item; gaps and missing variations refused)")
