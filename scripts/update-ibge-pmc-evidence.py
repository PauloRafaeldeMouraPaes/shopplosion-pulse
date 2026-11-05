#!/usr/bin/env python3
"""Write the public evidence item for a new month of the IBGE PMC series, from the SIDRA API only.

Companion of scripts/check-ibge-pmc-freshness.py (which detects a new month) and of
scripts/fetch-ibge-pmc-series.py (which captures raw API responses with their SHA-256). This script:

1. captures, through fetch-ibge-pmc-series.py, the last 13 months of the seasonally adjusted index
   (variable 7170) and the four published variations (11708 month on previous month with seasonal
   adjustment, 11709 month on same month of the previous year, 11710 accumulated in the year, 11711
   accumulated in 12 months) for the latest month, the same month one year earlier and the three
   months before the latest; raw responses go to docs/data with the capture date in the name;
2. writes one evidence item whose every number comes from those captures. The sentences are fixed
   templates: they state the published variations, the range of the 13 adjusted indices, the
   same-month comparison inside the adjusted series and where the latest year-on-year variation sits
   among the four months captured. No sentence goes beyond what the captured rows say;
3. appends the item to the three public layers through scripts/sync-public-evidence.js.

It never rewrites an earlier month's item: each release gets its own item (ibge-pmc-super-<mes>-<ano>),
so what the Pulse said at the time stays on record and the freshness check compares only the latest.

Usage:
  python3 scripts/update-ibge-pmc-evidence.py                 # latest month in the API; refuses when the Pulse already has it
  python3 scripts/update-ibge-pmc-evidence.py --dry-run       # print the item, write nothing
  python3 scripts/update-ibge-pmc-evidence.py --from-captures docs/data/x-v7170.capture.json docs/data/x-variacoes.capture.json --dry-run
                                                              # rebuild the item from saved captures (tests, audits)
Exit codes: 0 written (or printed with --dry-run); 3 nothing to do (month already published); 2 API or validation failure.
"""
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FETCH = ROOT / "scripts/fetch-ibge-pmc-series.py"
SYNC = ROOT / "scripts/sync-public-evidence.js"
EVIDENCE_TS = ROOT / "supabase/functions/pulse-ask-ai/public-evidence.ts"
DATA_DIR = ROOT / "docs/data"
TABLE, INDEX_TYPE, ACTIVITY = "8882", "56734", "90672"
ADJUSTED, VARIATIONS = "7170", ["11708", "11709", "11710", "11711"]
MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
SLUGS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
ACTIVITY_TEXT = "hipermercados, supermercados, produtos alimentícios, bebidas e fumo"


def month_name(period):
    y, m = period.split("-")
    return f"{MONTHS[int(m) - 1]} de {y}"


def short(period):
    y, m = period.split("-")
    return f"{MONTHS[int(m) - 1]}/{y}"


def shift(period, months):
    y, m = (int(x) for x in period.split("-"))
    idx = y * 12 + (m - 1) + months
    return f"{idx // 12}-{idx % 12 + 1:02d}"


def pt(value, decimals=1):
    return f"{value:.{decimals}f}".replace(".", ",")


def signed(value, decimals=1):
    return ("+" if value > 0 else "") + pt(value, decimals)


def move(value, up="cresceu", down="caiu", flat="ficou estável"):
    if value > 0:
        return f"{up} {pt(value)}%"
    if value < 0:
        return f"{down} {pt(abs(value))}%"
    return f"{flat} (0,0%)"


def accumulated(value):
    if value > 0:
        return f"alta de {pt(value)}%"
    if value < 0:
        return f"queda de {pt(abs(value))}%"
    return "variação nula (0,0%)"


def load_evidence():
    s = EVIDENCE_TS.read_text(encoding="utf-8")
    start = s.index("[", s.index("export const PULSE_PUBLIC_EVIDENCE ="))
    return json.loads(s[start:s.rindex("] as const") + 1])


def run_fetch(args, out):
    cmd = [sys.executable, str(FETCH), "--table", TABLE, "--index-type", INDEX_TYPE, "--activity", ACTIVITY, "--out", str(out)] + args
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or f"fetch exited with {r.returncode}")
    return json.loads(Path(re.sub(r"\.json$", "", str(out)) + ".capture.json").read_text(encoding="utf-8"))


def rel(path):
    p = Path(path)
    try:
        return str(p.resolve().relative_to(ROOT))
    except ValueError:
        return str(p)


def build_item(adjusted_capture, variations_capture):
    series = adjusted_capture["serie_historica"]
    if len(series) != 13:
        raise ValueError(f"expected 13 adjusted months, got {len(series)}")
    periods = [s["period"] for s in series]
    for a, b in zip(periods, periods[1:]):
        if shift(a, 1) != b:
            raise ValueError(f"gap in the adjusted series between {a} and {b}")
    latest = periods[-1]
    year_ago = shift(latest, -12)
    window = [shift(latest, -3), shift(latest, -2), shift(latest, -1), latest]
    var = {}
    for v in variations_capture["values"]:
        var[(v["variable"], v["period"])] = v["value"]
    needed = [(code, p) for code in VARIATIONS for p in [year_ago] + window]
    missing = [f"{c} {p}" for c, p in needed if (c, p) not in var]
    if missing:
        raise ValueError("variations missing in the capture: " + ", ".join(missing))
    if periods[0] != year_ago:
        raise ValueError(f"adjusted series must start at {year_ago}, starts at {periods[0]}")

    mom, yoy, ytd, r12 = (var[(c, latest)] for c in VARIATIONS)
    idx = {s["period"]: s["value"] for s in series}
    lo, hi = min(idx.values()), max(idx.values())
    same_month_adj = (idx[latest] / idx[year_ago] - 1) * 100
    yoy_window = {p: var[("11709", p)] for p in window}
    values = list(yoy_window.values())
    if yoy == max(values) and values.count(yoy) == 1:
        rank = "é a maior"
    elif yoy == min(values) and values.count(yoy) == 1:
        rank = "é a menor"
    else:
        p_min = min(window, key=lambda p: yoy_window[p]); p_max = max(window, key=lambda p: yoy_window[p])
        rank = f"fica entre a menor ({short(p_min)}, {signed(yoy_window[p_min])}%) e a maior ({short(p_max)}, {signed(yoy_window[p_max])}%)"
    prev = shift(latest, -1)
    prev_yoy = yoy_window[prev]
    pace = "desacelerou" if yoy < prev_yoy else "acelerou" if yoy > prev_yoy else "repetiu"
    pace_text = (f"ante {short(prev)} ({signed(prev_yoy)}%), {pace}" if pace != "repetiu" else f"ante {short(prev)}, repetiu {signed(prev_yoy)}%")
    window_text = ", ".join(f"{short(p)} {signed(yoy_window[p])}%" for p in window)
    adj_file, var_file = rel(adjusted_capture["raw_file"]), rel(variations_capture["raw_file"])
    label_period = f"{MONTHS[int(latest[5:]) - 1]} de {latest[:4]}"
    source = f"IBGE: PMC, tabela {TABLE} do SIDRA ({label_period})"
    query_day = adjusted_capture["captured_at_utc"][:10]
    y, m = query_day.split("-")[0], query_day.split("-")[1]
    query_text = f"{query_day[8:10]}/{m}/{y}"

    fato = (f"Em {label_period}, o volume de vendas de {ACTIVITY_TEXT} {move(mom)} ante {MONTHS[int(prev[5:]) - 1]}, "
            f"na série com ajuste sazonal, e {move(yoy)} ante {month_name(year_ago)}, na série sem ajuste; "
            f"no ano, acumula {accumulated(ytd)} e, em 12 meses, {accumulated(r12)}.")
    contexto = (f"IBGE; Pesquisa Mensal de Comércio; Brasil; tabela {TABLE} do SIDRA, índice de volume de vendas (2022=100). "
                f"A série com ajuste sazonal é revisada a cada divulgação; os valores refletem a consulta à API SIDRA de {query_text} "
                f"(UTC; registros brutos em docs/data). Item escrito por scripts/update-ibge-pmc-evidence.py a partir das respostas da API, sem edição manual.")
    interpretacao = (f"O índice com ajuste sazonal oscilou entre {pt(lo, 2)} e {pt(hi, 2)} nos 13 meses até {label_period}, e "
                     f"{MONTHS[int(latest[5:]) - 1]} ({pt(idx[latest], 2)}) ficou {pt(abs(same_month_adj))}% "
                     f"{'acima' if same_month_adj >= 0 else 'abaixo'} de {month_name(year_ago)} nessa série. "
                     f"Entre as variações interanuais sem ajuste dos quatro meses consultados ({window_text}), a de {MONTHS[int(latest[5:]) - 1]} {rank}; {pace_text}.")
    hipotese = (f"Verificar se a variação interanual de {MONTHS[int(latest[5:]) - 1]} ({signed(yoy)}%) reflete a base de comparação: "
                f"na série com ajuste sazonal, {month_name(year_ago)} havia variado {signed(var[('11708', year_ago)])}% ante o mês anterior "
                f"(variável 11708 na resposta bruta {var_file}). Isso precisa ser medido, não presumido.")
    acao = (f"Acompanhar a divulgação de {month_name(shift(latest, 1))}; usar a série histórica deste registro apenas como variação observada "
            f"e cruzar com IPCA Alimentação e bebidas, Abras e Scanntech sem misturar universos.")
    fonte_primaria = (f"IBGE, SIDRA, tabela {TABLE}. Respostas brutas da API gravadas em docs/data: série com ajuste sazonal, variável {ADJUSTED}, "
                      f"{periods[0]} a {latest}: {adj_file} (consulta {adjusted_capture['captured_at_utc']}, SHA-256 {adjusted_capture['raw_sha256']}, {adjusted_capture['url']}); "
                      f"variações {VARIATIONS[0]} a {VARIATIONS[-1]} para {year_ago} e {window[0]} a {latest}: {var_file} "
                      f"(consulta {variations_capture['captured_at_utc']}, SHA-256 {variations_capture['raw_sha256']}, {variations_capture['url']})")
    verificado = (f"SIM: {pt(mom)}% (11708), {pt(yoy)}% (11709), {pt(ytd)}% (11710) e {pt(r12)}% (11711) para {label_period}, "
                  f"{pt(var[('11709', year_ago)])}% (11709) e {pt(var[('11708', year_ago)])}% (11708) para {month_name(year_ago)} e as variações interanuais de "
                  f"{MONTHS[int(window[0][5:]) - 1]} a {MONTHS[int(latest[5:]) - 1]} de {latest[:4]} lidos da resposta bruta {var_file}; "
                  f"os 13 índices com ajuste sazonal de {short(periods[0])} a {short(latest)} lidos da resposta bruta {adj_file} e registrados em serie_historica "
                  f"com arredondamento a duas casas")
    item = {
        "id": f"ibge-pmc-super-{SLUGS[int(latest[5:]) - 1]}-{latest[:4]}",
        "categoria": "varejo alimentar",
        "tipo": "PMC",
        "fato": fato,
        "contexto": contexto,
        "interpretacao": interpretacao,
        "hipotese": hipotese,
        "acao": acao,
        "fonte": source,
        "url": f"https://sidra.ibge.gov.br/tabela/{TABLE}",
        "periodo": latest,
        "indicador": "Índice de volume de vendas (2022=100), séries com e sem ajuste sazonal",
        "valor": f"{pt(idx[latest], 2)} ({short(latest)}, com ajuste sazonal)",
        "comparacao": (f"{signed(mom)}% vs {short(prev)} (com ajuste sazonal); {signed(yoy)}% vs {short(year_ago)} (sem ajuste); "
                       f"{signed(ytd)}% no ano; {signed(r12)}% em 12 meses"),
        "classificacao": "estatística oficial de volume do varejo; não comprova comportamento de shopper",
        "natureza": "Estatística oficial de volume de vendas do varejo (índice mensal); não mede comportamento individual do shopper",
        "universo_observado": (f"Empresas do comércio varejista pesquisadas pela PMC do IBGE na atividade {ACTIVITY_TEXT}; Brasil; "
                               f"índice de volume de vendas (2022=100)"),
        "representa": "Variação agregada do volume de vendas da atividade no Brasil, nas séries com e sem ajuste sazonal publicadas pelo IBGE",
        "nao_representa": ("Não representa categorias específicas, canais fora do comércio varejista formal, regiões isoladas, marcas, unidades vendidas "
                           "ou motivação de compra; não permite atribuir causa à variação"),
        "fonte_primaria": fonte_primaria,
        "fato_verificado_na_fonte": verificado,
        "alcance_para_pergunta": "DIRETO para volume do varejo alimentar no Brasil; CONTEXTUAL para categorias, canais ou shoppers específicos",
        "keywords": ["PMC", "IBGE", "varejo alimentar", "supermercados", "hipermercados", "volume de vendas",
                     f"{MONTHS[int(latest[5:]) - 1]} {latest[:4]}", "série histórica", "ajuste sazonal", f"SIDRA {TABLE}"],
        "serie_historica": [dict(s, source=source) for s in series],
    }
    return item


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="print the item, write nothing")
    ap.add_argument("--from-captures", nargs=2, metavar=("ADJUSTED_CAPTURE", "VARIATIONS_CAPTURE"),
                    help="rebuild the item from saved .capture.json files instead of the network")
    ap.add_argument("--month", help="AAAA-MM to publish (default: latest month in the API)")
    ap.add_argument("--force", action="store_true", help="write even when an item for that month exists (tests only)")
    args = ap.parse_args()

    published = {e["periodo"] for e in load_evidence() if str(e.get("id", "")).startswith("ibge-pmc-super-")}
    if args.from_captures:
        adjusted = json.loads(Path(args.from_captures[0]).read_text(encoding="utf-8"))
        variations = json.loads(Path(args.from_captures[1]).read_text(encoding="utf-8"))
    else:
        today = dt.date.today().isoformat()
        tmp = Path(tempfile.mkdtemp(prefix="ibge-pmc-"))
        try:
            probe = run_fetch(["--variable", ADJUSTED, "--months", "13", "--allow-gaps"], tmp / "probe.json")
        except Exception as exc:
            print(f"ERRO ao consultar o SIDRA: {exc}", file=sys.stderr)
            return 2
        latest = max(v["period"] for v in probe["values"])
        if args.month and args.month != latest:
            print(f"ERRO: o SIDRA tem {latest} como último mês, não {args.month}", file=sys.stderr)
            return 2
        if latest in published and not args.force:
            print(f"Nada a fazer: o Pulse já publica {latest}.")
            return 3
        adj_out = DATA_DIR / f"ibge-pmc-{TABLE}-v{ADJUSTED}-a{ACTIVITY}-{today}.json"
        var_out = DATA_DIR / f"ibge-pmc-{TABLE}-a{ACTIVITY}-variacoes-{today}.json"
        if args.dry_run:
            adj_out, var_out = tmp / adj_out.name, tmp / var_out.name
        periods = [shift(latest, -12), shift(latest, -3), shift(latest, -2), shift(latest, -1), latest]
        try:
            adjusted = run_fetch(["--variable", ADJUSTED, "--months", "13"], adj_out)
            variations = run_fetch(["--variable", ",".join(VARIATIONS), "--periods", ",".join(p.replace("-", "") for p in periods)], var_out)
        except Exception as exc:
            print(f"ERRO ao consultar o SIDRA: {exc}", file=sys.stderr)
            return 2
    try:
        item = build_item(adjusted, variations)
    except ValueError as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 2
    if item["periodo"] in published and not args.force and not args.dry_run:
        print(f"Nada a fazer: o Pulse já publica {item['periodo']}.")
        return 3
    if args.dry_run:
        print(json.dumps(item, ensure_ascii=False, indent=1))
        return 0
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
        json.dump([item], fh, ensure_ascii=False)
        items_path = fh.name
    r = subprocess.run(["node", str(SYNC), "--add", items_path], cwd=ROOT, capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr)
        return 2
    print(f"Item {item['id']} escrito nas três camadas; registros brutos em docs/data.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
