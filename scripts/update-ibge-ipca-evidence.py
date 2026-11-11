#!/usr/bin/env python3
"""Write the public evidence item for a new month of the IPCA (IBGE), from the SIDRA API only.

For month M the script queries SIDRA table 7060 once: variables 63 (monthly variation), 69 (accumulated in the
year) and 2265 (accumulated in 12 months) for categories 7169 (Índice geral), 7170 (Alimentação e bebidas) and
7171 (Alimentação no domicílio), periods M and M-1. The raw response is kept byte for byte in docs/data
(ibge-ipca-7060-<AAAA-MM>-<capture date>.json) with a companion .capture.json holding URL, UTC timestamp and
SHA-256. The item ibge-ipca-alimentos-<AAAA-MM> is written from fixed templates whose every number comes from
that response and is appended to the three public layers through scripts/sync-public-evidence.js.

Each month keeps its own item; earlier items are never rewritten.

Usage:
  python3 scripts/update-ibge-ipca-evidence.py                # latest month in SIDRA; exit 3 if already published
  python3 scripts/update-ibge-ipca-evidence.py --month 2026-09
  python3 scripts/update-ibge-ipca-evidence.py --dry-run      # print the item, write nothing
  python3 scripts/update-ibge-ipca-evidence.py --from-capture docs/data/<file>.capture.json --dry-run
Exit codes: 0 written or printed; 3 month already published; 2 API or validation failure.
"""
import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SYNC = ROOT / "scripts/sync-public-evidence.js"
EVIDENCE_TS = ROOT / "supabase/functions/pulse-ask-ai/public-evidence.ts"
DATA_DIR = ROOT / "docs/data"
API = "https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63,69,2265/p/{periods}/c315/7169,7170,7171"
MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
CAT = {"7169": "geral", "7170": "alimentos", "7171": "domicilio"}
VAR = {"63": "mes", "69": "ano", "2265": "doze"}
UNIVERSO = ("Preços de produtos e serviços consumidos por famílias com rendimento de 1 a 40 salários mínimos, qualquer que seja a fonte, "
            "em dez regiões metropolitanas (Rio de Janeiro, Porto Alegre, Belo Horizonte, Recife, São Paulo, Belém, Fortaleza, Salvador, "
            "Curitiba, Vitória), Distrito Federal e os municípios de Goiânia, Campo Grande, Rio Branco, São Luís e Aracaju; índice nacional "
            "agregado dos índices regionais, conforme notas metodológicas do IBGE")


def shift(period, months):
    y, m = (int(x) for x in period.split("-"))
    i = y * 12 + (m - 1) + months
    return f"{i // 12}-{i % 12 + 1:02d}"


def mes(period, with_year=True):
    y, m = period.split("-")
    return f"{MONTHS[int(m) - 1]} de {y}" if with_year else MONTHS[int(m) - 1]


def pt(v):
    return f"{v:.2f}".replace(".", ",")


def var_text(v, up="subiu", down="caiu"):
    if v > 0:
        return f"{up} {pt(v)}%"
    if v < 0:
        return f"{down} {pt(abs(v))}%"
    return "ficou estável (0,00%)"


def load_evidence():
    s = EVIDENCE_TS.read_text(encoding="utf-8")
    start = s.index("[", s.index("export const PULSE_PUBLIC_EVIDENCE ="))
    return json.loads(s[start:s.rindex("] as const") + 1])


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "pulse-evidence-tool/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def parse(body):
    rows = json.loads(body)
    out = {}
    for r in rows[1:]:
        period = f"{r['D3C'][:4]}-{r['D3C'][4:]}"
        try:
            value = float(r["V"])
        except ValueError:
            continue
        out[(VAR[r["D2C"]], CAT[r["D4C"]], period)] = value
    return out


def latest_month():
    body = fetch("https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63/p/last%201/c315/7170")
    r = json.loads(body)[1]
    return f"{r['D3C'][:4]}-{r['D3C'][4:]}"


def build_item(capture):
    raw = Path(capture["raw_file"])
    v = parse((raw if raw.is_absolute() else ROOT / raw).read_bytes())
    month = capture["month"]
    prev = shift(month, -1)
    need = [(a, b, month) for a in VAR.values() for b in CAT.values()] + [("mes", "alimentos", prev)]
    missing = [f"{a}/{b}/{p}" for a, b, p in need if (a, b, p) not in v]
    if missing:
        raise ValueError("valores ausentes na resposta: " + ", ".join(missing))
    g, a, d = (v[("mes", c, month)] for c in ("geral", "alimentos", "domicilio"))
    a_prev = v[("mes", "alimentos", prev)]
    a_ano, a_12 = v[("ano", "alimentos", month)], v[("doze", "alimentos", month)]
    g_ano, g_12 = v[("ano", "geral", month)], v[("doze", "geral", month)]
    quando = mes(month)
    turn = ("inverteu o sinal" if (a > 0) != (a_prev > 0) and a != 0 and a_prev != 0 else "manteve o sinal")
    fato = (f"Em {quando}, o IPCA {var_text(g)}; Alimentação e bebidas {var_text(a)} e Alimentação no domicílio {var_text(d)} "
            f"ante {mes(prev, False)}. No ano, Alimentação e bebidas acumula {pt(a_ano)}% e, em 12 meses, {pt(a_12)}%.")
    interpretacao = (f"O grupo Alimentação e bebidas passou de {pt(a_prev)}% em {mes(prev, False)} para {pt(a)}% em {mes(month, False)} "
                     f"({turn} da variação mensal); em 12 meses, o grupo ({pt(a_12)}%) está "
                     f"{'acima' if a_12 > g_12 else 'abaixo' if a_12 < g_12 else 'igual ao'} do índice geral ({pt(g_12)}%).")
    url = API.format(periods=f"{prev.replace('-', '')},{month.replace('-', '')}")
    item = {
        "id": f"ibge-ipca-alimentos-{month}",
        "categoria": "preços",
        "tipo": "IPCA",
        "fato": fato,
        "contexto": (f"IPCA nacional do IBGE, tabela 7060 do SIDRA. Item escrito por scripts/update-ibge-ipca-evidence.py a partir da resposta "
                     f"da API consultada em {capture['captured_at_utc'][:10]} (UTC), sem edição manual; resposta bruta em docs/data."),
        "interpretacao": interpretacao,
        "hipotese": (f"Investigar se a variação de preços de alimentos em {mes(month, False)} aparece no volume do varejo alimentar (PMC) e no "
                     f"comportamento de compra do mesmo mês, sem presumir causa."),
        "acao": f"Acompanhar o IPCA de {mes(shift(month, 1))} e cruzar com a PMC do mesmo mês e com preço por categoria, sem misturar universos.",
        "fonte": f"IBGE: IPCA, tabela 7060 do SIDRA ({quando})",
        "url": "https://sidra.ibge.gov.br/tabela/7060",
        "periodo": month,
        "natureza": "Índice oficial de preços ao consumidor (IPCA, IBGE); mede variação de preços, não volume vendido, gasto das famílias nem comportamento de compra",
        "universo_observado": UNIVERSO,
        "representa": (f"Variação mensal, acumulada no ano e em 12 meses do IPCA geral e dos grupos Alimentação e bebidas e Alimentação no "
                       f"domicílio em {quando}, Brasil"),
        "nao_representa": ("Não representa volume de vendas, gasto, sell-out, preço de marca ou canal específico, nem variação de uma região isolada; "
                           "não indica causa nem reação do shopper"),
        "fonte_primaria": (f"IBGE, SIDRA tabela 7060, resposta bruta da API gravada em {capture['raw_file']} (consulta {capture['captured_at_utc']}, "
                           f"SHA-256 {capture['raw_sha256']}): {url}"),
        "fato_verificado_na_fonte": (f"SIM: IPCA {pt(g)}%, Alimentação e bebidas {pt(a)}% e Alimentação no domicílio {pt(d)}% em {quando} (variável 63), "
                                     f"Alimentação e bebidas {pt(a_prev)}% em {mes(prev)}, {pt(a_ano)}% no ano (variável 69) e {pt(a_12)}% em 12 meses "
                                     f"(variável 2265), índice geral {pt(g_ano)}% no ano e {pt(g_12)}% em 12 meses, lidos da resposta bruta {capture['raw_file']}"),
        "alcance_para_pergunta": (f"DIRETO para inflação geral e de alimentos e bebidas no Brasil em {quando}; CONTEXTUAL para categorias, marcas, "
                                  f"canais e comportamento do shopper"),
        "keywords": ["IPCA", "IBGE", "inflação", "alimentos", "alimentação e bebidas", "alimentação no domicílio", "preços",
                     f"{mes(month, False)} {month[:4]}", "SIDRA 7060"],
    }
    text = json.dumps(item, ensure_ascii=False)
    assert "–" not in text and "—" not in text
    return item


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--month")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-capture")
    args = ap.parse_args()
    published = {e["periodo"] for e in load_evidence() if str(e.get("id", "")).startswith("ibge-ipca-alimentos-")}
    if args.from_capture:
        capture = json.loads(Path(args.from_capture).read_text(encoding="utf-8"))
    else:
        try:
            month = args.month or latest_month()
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError, IndexError) as exc:
            print(f"ERRO ao consultar o SIDRA: {exc}", file=sys.stderr)
            return 2
        if month in published and not args.dry_run:
            print(f"Nada a fazer: o Pulse já publica o IPCA de {month}.")
            return 3
        url = API.format(periods=f"{shift(month, -1).replace('-', '')},{month.replace('-', '')}")
        try:
            body = fetch(url)
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"ERRO ao consultar o SIDRA: {exc}", file=sys.stderr)
            return 2
        now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
        base = DATA_DIR / f"ibge-ipca-7060-{month}-{now.date().isoformat()}.json"
        if args.dry_run:
            base = Path(tempfile.mkdtemp(prefix="ipca-")) / base.name
        base.write_bytes(body)
        try:
            raw_rel = str(base.relative_to(ROOT))
        except ValueError:
            raw_rel = str(base)
        capture = {"month": month, "url": url, "captured_at_utc": now.isoformat().replace("+00:00", "Z"),
                   "raw_file": raw_rel, "raw_sha256": hashlib.sha256(body).hexdigest()}
        if not args.dry_run:
            base.with_suffix(".capture.json").write_text(json.dumps(capture, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    try:
        item = build_item(capture)
    except (ValueError, KeyError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 2
    if args.dry_run:
        print(json.dumps(item, ensure_ascii=False, indent=1))
        return 0
    if item["periodo"] in published:
        print(f"Nada a fazer: o Pulse já publica o IPCA de {item['periodo']}.")
        return 3
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
        json.dump([item], fh, ensure_ascii=False)
    r = subprocess.run(["node", str(SYNC), "--add", fh.name], cwd=ROOT, capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr.strip(), file=sys.stderr)
        return 2
    print(f"Item {item['id']} escrito nas três camadas; resposta bruta em {capture['raw_file']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
