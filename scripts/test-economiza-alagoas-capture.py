#!/usr/bin/env python3
"""Checks for the Economiza Alagoas (NFC-e) captures of the Chocolate pilot. Offline.

1. Parser: the saved sample page (scripts/fixtures/economiza-alagoas-category-sample.html: two chocolate cards, one chocolate
   drink and one filled biscuit, copied from the page captured on 2026-11-11) yields the expected fields and keeps
   only the two chocolates.
2. Every docs/pilot-chocolate/capture-kit/economiza-alagoas-<date>.csv.gz: gzip readable, header as the script
   writes it, capture ids unique and dated, captured_at_utc on the file's date, prices numeric, a request log of the
   same date whose GET rows record the SHA-256 of the uncompressed observations, and no row the classifier rejects.
"""
import csv
import datetime as dt
import gzip
import hashlib
import importlib.util
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "docs/pilot-chocolate/capture-kit"
spec = importlib.util.spec_from_file_location("cap", ROOT / "scripts/capture-economiza-alagoas.py")
cap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cap)
fail = []

page = (ROOT / "scripts/fixtures/economiza-alagoas-category-sample.html").read_text(encoding="utf-8")
rows = cap.parse_cards(page, "chocolate lacta", dt.datetime(2026, 11, 11, 7, 58, tzinfo=dt.timezone.utc), "x")
kept = cap.keep_rows(rows)
first = rows[0] if rows else {}
if len(rows) != 4 or len(kept) != 2:
    fail.append(f"sample: expected 4 cards and 2 kept, got {len(rows)} and {len(kept)}")
expect = {"gtin": "7896019602105", "descricao_nfce": "BOMBOM OURO BRANCO LACTA", "valor_unitario_brl": "2.00", "unidade": "UN",
          "valor_ultima_venda_brl": "1.00", "ultima_venda_texto": "Há 11 horas e 54 minutos", "ultima_venda_estimada_utc": "2026-11-10T20:04:00Z",
          "loja": "FARMACIA MULTIFARMA POPULAR", "inscricao_estadual": "24267395", "endereco": "AV NORMA PIMENTEL DA COSTA, 233 B",
          "municipio_bairro_cep": "MACEIO, BENEDITO BENTES, 57.084-650"}
for k, v in expect.items():
    if first.get(k) != v:
        fail.append(f"sample first card {k}: {first.get(k)!r} != {v!r}")
if any(re.search("TRAKINAS|BEBIDA", r["descricao_nfce"]) for r in kept):
    fail.append("sample: the biscuit or the drink was kept")

captures = sorted(KIT.glob("economiza-alagoas-[0-9]*.csv.gz"))
for gz in captures:
    day = gz.name[len("economiza-alagoas-"):len("economiza-alagoas-") + 10]
    body = gzip.decompress(gz.read_bytes())
    recs = list(csv.DictReader(io.StringIO(body.decode("utf-8"))))
    head = body.decode("utf-8").split("\n", 1)[0].split(",")
    if head != cap.FIELDS:
        fail.append(f"{gz.name}: header differs from the capture script")
    ids = [r["capture_id"] for r in recs]
    if len(ids) != len(set(ids)) or not all(i.startswith(f"EAL-{day.replace('-', '')}-") for i in ids):
        fail.append(f"{gz.name}: capture ids not unique or not dated {day}")
    if any(not r["captured_at_utc"].startswith(day) for r in recs):
        fail.append(f"{gz.name}: captured_at_utc outside {day}")
    if any(not re.fullmatch(r"\d+\.\d{2}", r["valor_unitario_brl"]) for r in recs):
        fail.append(f"{gz.name}: non-numeric valor_unitario_brl")
    if len(cap.keep_rows(recs)) != len(recs):
        fail.append(f"{gz.name}: rows the classifier would not keep")
    log = KIT / f"economiza-alagoas-requests-{day}.csv"
    if not log.exists():
        fail.append(f"{gz.name}: request log {log.name} missing")
        continue
    sha = hashlib.sha256(body).hexdigest()
    gets = [r for r in csv.DictReader(log.open(encoding="utf-8")) if r["method"] == "GET" and r["cards_total"]]
    if not gets or any(sha not in r["note"] for r in gets):
        fail.append(f"{log.name}: observations SHA-256 not recorded on every category request")

if fail:
    print("Economiza Alagoas captures: FAIL")
    for f in fail:
        print(" -", f)
    sys.exit(1)
print(f"Economiza Alagoas captures: PASS (parser sample; {len(captures)} weekly capture(s) checked)")
