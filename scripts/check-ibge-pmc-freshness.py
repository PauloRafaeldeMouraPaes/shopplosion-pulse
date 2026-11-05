#!/usr/bin/env python3
"""Check whether the IBGE PMC series published in the Pulse is behind the IBGE SIDRA API.

Read-only. It compares the `serie_historica` of every public evidence item whose series comes
from SIDRA table 8882 (supabase/functions/pulse-ask-ai/public-evidence.ts, which CI keeps in
parity with index.html and pulse-public-evidence.js) with a fresh query made by
scripts/fetch-ibge-pmc-series.py using the same table, variable, index type and activity.

It never edits evidence. When a new month is out, scripts/update-ibge-pmc-evidence.py writes the
new month's item from the API captures (each release keeps its own item, so only the latest item of
a series is compared here; earlier items record what the Pulse said at the time and are expected to
differ from later revisions). It reports:
- new periods: months the API has and the Pulse does not;
- revisions: months present in both whose value changed by 0.01 or more (IBGE revises the
  seasonally adjusted index every release).

Exit code 0 when the check ran (stale or not), 2 when the API could not be read. With
GITHUB_OUTPUT set it writes `stale=true|false`; with --report it writes a Markdown report.
--api-series FILE uses a saved JSON series (output of the fetch script) instead of the network,
for tests.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE_TS = ROOT / "supabase/functions/pulse-ask-ai/public-evidence.ts"
FETCH = ROOT / "scripts/fetch-ibge-pmc-series.py"
TOLERANCE = 0.01


def load_evidence():
    s = EVIDENCE_TS.read_text(encoding="utf-8")
    start = s.index("[", s.index("export const PULSE_PUBLIC_EVIDENCE ="))
    end = s.rindex("] as const")
    return json.loads(s[start:end + 1])


def series_params(entry):
    m = re.search(r"tabela (\d+) do SIDRA, variável (\d+), tipo de índice (\d+), atividade (\d+)", entry.get("methodology", ""))
    return m.groups() if m else None


def fetch_api(table, variable, index_type, activity, months):
    cmd = [sys.executable, "-I", str(FETCH), "--table", table, "--variable", variable, "--index-type", index_type,
           "--activity", activity, "--months", str(months), "--allow-gaps"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or f"fetch exited with {r.returncode}")
    return json.loads(r.stdout)


def compare(published, api):
    pub = {e["period"]: e["value"] for e in published}
    new = [e for e in api if e["period"] not in pub and e["period"] > max(pub)]
    revised = [(e["period"], pub[e["period"]], e["value"]) for e in api
               if e["period"] in pub and abs(pub[e["period"]] - e["value"]) >= TOLERANCE]
    return new, revised


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--report", help="write a Markdown report here")
    ap.add_argument("--api-series", help="saved API series JSON (tests only)")
    args = ap.parse_args()

    groups = {}
    for item in load_evidence():
        sh = item.get("serie_historica") or []
        if not sh:
            continue
        params = series_params(sh[0])
        if params and params[0] == "8882":
            groups.setdefault(params, []).append((item["id"], sh))
    # Only the latest release of each series is compared: earlier items are kept as published.
    for params, items in groups.items():
        latest = max(items, key=lambda it: max(e["period"] for e in it[1]))
        groups[params] = [latest]
    if not groups:
        print("Nenhum item com serie_historica da tabela 8882 encontrado.", file=sys.stderr)
        return 2

    lines, stale = [], False
    for params, items in groups.items():
        table, variable, index_type, activity = params
        try:
            api = json.loads(Path(args.api_series).read_text(encoding="utf-8")) if args.api_series else \
                fetch_api(table, variable, index_type, activity, 15)
        except Exception as exc:  # network, HTTP or validation failure: report, do not guess
            print(f"ERRO ao consultar o SIDRA ({table}/{variable}/{index_type}/{activity}): {exc}", file=sys.stderr)
            return 2
        for item_id, published in items:
            new, revised = compare(published, api)
            last_pub = max(e["period"] for e in published)
            last_api = max(e["period"] for e in api) if api else "?"
            lines.append(f"### `{item_id}`\n")
            lines.append(f"- Série: tabela {table}, variável {variable}, tipo de índice {index_type}, atividade {activity}")
            lines.append(f"- Último mês no Pulse: {last_pub}; último mês no SIDRA: {last_api}")
            if new:
                stale = True
                lines.append("- Meses novos no SIDRA: " + ", ".join(f"{e['period']} ({e['value']:.2f})" for e in new))
            if revised:
                stale = True
                lines.append("- Revisões (Pulse -> SIDRA): " + ", ".join(f"{p} {a:.2f} -> {b:.2f}" for p, a, b in revised))
            if not new and not revised:
                lines.append("- Em dia: nenhum mês novo e nenhuma revisão de 0,01 ou mais.")
            lines.append("")

    head = ("A série do IBGE publicada no Pulse está atrás do SIDRA." if stale else "A série do IBGE publicada no Pulse está em dia com o SIDRA.")
    steps = ("\n**Como atualizar:** mês novo: `python3 scripts/update-ibge-pmc-evidence.py` captura a API, grava os registros brutos em docs/data "
             "e escreve o item do mês nas três camadas (o ciclo semanal agendado faz isso, abre o PR e, depois do merge, "
             "roda o deploy guardado do `pulse-ask-ai`). Só revisão sem mês novo: nada a fazer, o item publicado registra a consulta da época.\n") if stale else ""
    report = f"{head}\n\n" + "\n".join(lines) + steps
    print(report)
    if args.report:
        Path(args.report).write_text(report, encoding="utf-8")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as fh:
            fh.write(f"stale={'true' if stale else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
