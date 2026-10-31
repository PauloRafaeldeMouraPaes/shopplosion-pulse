#!/usr/bin/env python3
"""Fetch a PMC (Pesquisa Mensal de Comercio) series from the IBGE SIDRA API and emit a
`serie_historica` block for a public evidence item, plus an auditable raw capture.

Maintainer tool. It is never run by CI and it never edits the evidence files: the operator
pastes the printed block into the three public evidence layers (index.html embedded JSON,
pulse-public-evidence.js and supabase/functions/pulse-ask-ai/public-evidence.ts) and CI
enforces their parity.

Defaults reproduce the series used by evidence item `ibge-pmc-super-agosto-2026`:
table 8882 (PMC by activity, Brasil), variable 7170 (index with seasonal adjustment,
2022=100), index type 56734 (sales volume), activity 90672 (hipermercados, supermercados,
produtos alimenticios, bebidas e fumo), last 13 months.

What is validated before anything is printed:
- the response is a JSON array whose first row is the SIDRA header (NC, V, D2C, D3C, ...);
- every data row carries the requested variable, index type and activity codes;
- period codes are AAAAMM; values are finite numbers ("-" and ".." mark absences and are
  listed, never converted to zero);
- the number of distinct periods equals the number requested, unless --allow-gaps is passed.

Values are rounded to two decimals in the emitted block (the raw capture keeps the API's
precision) and that rounding is declared in the block's methodology field.

Usage:
  python3 scripts/fetch-ibge-pmc-series.py --out docs/data/ibge-pmc-8882-v7170-a90672-2026-10-31.json
  python3 scripts/fetch-ibge-pmc-series.py --months 25 --variable 7169   # unadjusted series
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import sys
import urllib.error
import urllib.request

API = "https://apisidra.ibge.gov.br/values"
TABLE_URL = "https://sidra.ibge.gov.br/tabela/{table}"
VARIABLE_METHODOLOGY = {
    "7169": "Índice de base fixa sem ajuste sazonal (2022=100)",
    "7170": "Índice de base fixa com ajuste sazonal (2022=100)",
}
INDEX_TYPE_LABEL = {
    "56733": "índice de receita nominal de vendas",
    "56734": "índice de volume de vendas",
}
MONTHS_PT = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}


def build_url(table, variable, index_type, activity, months):
    return (f"{API}/t/{table}/n1/all/v/{variable}/p/last%20{months}"
            f"/c11046/{index_type}/c85/{activity}")


def fetch(url, timeout):
    req = urllib.request.Request(url, headers={"User-Agent": "pulse-evidence-tool/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
        return body, resp.status


def parse_value(raw):
    text = str(raw).strip()
    if text in ("-", "..", "...", "X", ""):
        return None, text
    try:
        value = float(text)
    except ValueError:
        return None, text
    if not math.isfinite(value):
        return None, text
    return value, text


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--table", default="8882")
    ap.add_argument("--variable", default="7170", help="7170 = com ajuste sazonal; 7169 = sem ajuste")
    ap.add_argument("--index-type", default="56734", help="56734 = volume de vendas; 56733 = receita nominal")
    ap.add_argument("--activity", default="90672", help="codigo c85 da atividade (90672 = hiper/super, alimentos, bebidas e fumo)")
    ap.add_argument("--months", type=int, default=13)
    ap.add_argument("--geography", default="Brasil")
    ap.add_argument("--source", default="IBGE: PMC, tabela 8882 do SIDRA (agosto de 2026)",
                    help="texto do campo fonte do item de evidencia que recebera o bloco")
    ap.add_argument("--out", help="arquivo JSON do registro bruto (recomendado: docs/data/...)")
    ap.add_argument("--allow-gaps", action="store_true")
    ap.add_argument("--timeout", type=int, default=60)
    args = ap.parse_args()

    url = build_url(args.table, args.variable, args.index_type, args.activity, args.months)
    captured_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    try:
        body, status = fetch(url, args.timeout)
    except urllib.error.HTTPError as exc:
        print(f"ERRO: HTTP {exc.code} ao consultar {url}", file=sys.stderr)
        return 2
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"ERRO: falha de rede ao consultar {url}: {exc}", file=sys.stderr)
        return 2
    sha256 = hashlib.sha256(body).hexdigest()
    try:
        rows = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        print(f"ERRO: resposta nao e JSON valido: {exc}", file=sys.stderr)
        return 2
    if not isinstance(rows, list) or len(rows) < 2 or not isinstance(rows[0], dict) or rows[0].get("V") != "Valor":
        print("ERRO: a resposta nao tem a linha de cabecalho do SIDRA seguida de dados", file=sys.stderr)
        return 2

    header, data = rows[0], rows[1:]
    problems = []
    observations = []
    absences = []
    for row in data:
        if row.get("D2C") != args.variable:
            problems.append(f"variavel inesperada {row.get('D2C')} em {row.get('D3C')}")
        if row.get("D4C") != args.index_type:
            problems.append(f"tipo de indice inesperado {row.get('D4C')} em {row.get('D3C')}")
        if row.get("D5C") != args.activity:
            problems.append(f"atividade inesperada {row.get('D5C')} em {row.get('D3C')}")
        code = str(row.get("D3C", ""))
        if len(code) != 6 or not code.isdigit() or not 1 <= int(code[4:]) <= 12:
            problems.append(f"codigo de periodo invalido: {code!r}")
            continue
        period = f"{code[:4]}-{code[4:]}"
        value, text = parse_value(row.get("V"))
        if value is None:
            absences.append({"period": period, "raw": text})
            continue
        observations.append({"period": period, "value": value, "raw": text, "label": row.get("D3N")})

    periods = sorted({o["period"] for o in observations})
    if len(periods) != len(observations):
        problems.append("periodos repetidos na resposta")
    if len(periods) != args.months and not args.allow_gaps:
        problems.append(f"{len(periods)} periodos com valor, {args.months} solicitados (use --allow-gaps para aceitar)")
    if problems:
        print("ERRO: a resposta nao passou nas validacoes:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1

    variable_label = data[0].get("D2N", "")
    index_label = data[0].get("D4N", "")
    activity_label = data[0].get("D5N", "")
    unit = "número-índice (2022=100)" if data[0].get("MN", "").lower().startswith("n") else data[0].get("MN", "")
    metric = f"PMC: {INDEX_TYPE_LABEL.get(args.index_type, index_label.lower())}, {activity_label.lower()}, " + (
        "com ajuste sazonal" if args.variable == "7170" else "sem ajuste sazonal" if args.variable == "7169" else variable_label)
    methodology = (f"{VARIABLE_METHODOLOGY.get(args.variable, variable_label)}, tabela {args.table} do SIDRA, variável {args.variable}, "
                   f"tipo de índice {args.index_type}, atividade {args.activity}; valores arredondados a duas casas decimais a partir da API")
    provenance = (f"API SIDRA, consulta de {captured_at}, tabela {args.table}; registro bruto"
                  + (f" em {args.out}" if args.out else "") + f" (SHA-256 {sha256}); URL completa no campo fonte_primaria do item")
    series = [{
        "period": o["period"],
        "value": round(o["value"], 2),
        "metric": metric,
        "unit": unit,
        "methodology": methodology,
        "geography": args.geography,
        "source": args.source,
        "provenance": provenance,
        "url": TABLE_URL.format(table=args.table),
    } for o in sorted(observations, key=lambda o: o["period"])]

    record = {
        "captured_at_utc": captured_at,
        "url": url,
        "http_status": status,
        "sha256": sha256,
        "table": args.table, "variable": args.variable, "index_type": args.index_type, "activity": args.activity,
        "labels": {"variable": variable_label, "index_type": index_label, "activity": activity_label, "unit": data[0].get("MN", "")},
        "months_requested": args.months,
        "periods_with_value": len(periods),
        "absences": absences,
        "header": header,
        "rows": data,
        "serie_historica": series,
    }
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(record, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        print(f"Registro bruto gravado em {args.out} ({len(body)} bytes, SHA-256 {sha256})", file=sys.stderr)
    print(json.dumps(series, ensure_ascii=False, indent=1))
    if absences:
        print(f"AVISO: {len(absences)} periodo(s) sem valor na fonte: " + ", ".join(a['period'] for a in absences), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
