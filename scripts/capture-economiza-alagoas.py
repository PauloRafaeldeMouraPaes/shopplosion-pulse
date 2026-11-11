#!/usr/bin/env python3
"""Weekly capture of chocolate prices with EAN from Economiza Alagoas (SEFAZ/AL), free and public.

Economiza Alagoas publishes prices of real sales taken from consumer electronic invoices (NFC-e) in Alagoas, per
product barcode (GTIN/EAN) and per store. The official JSON API needs a token requested by e-mail
(api@sefaz.al.gov.br); until it is granted this script reads the public consultation page, which is what the
site offers any visitor, with deliberate restraint:

* one request at a time, a pause of PAUSE_SECONDS between requests, a User-Agent that identifies the Pulse;
* only the terms in docs/pilot-chocolate/capture-kit/economiza-alagoas-terms.csv, once a week;
* only the food category page of each term (GPC segment 50000000), never a crawl of the site;
* stop on any HTTP error, 403 or 429 included, and record it instead of retrying.

For each request the SHA-256 of the raw bytes is recorded; raw pages are not committed (about 2 MB each).
Rows kept are the cards whose description is chocolate (regex CHOCOLATE_RE); the rest are counted, not stored.
Each card gives: GTIN, description as written on the invoice, "valor unitário" and "última venda" exactly as
labelled on the page, how long ago the last sale happened, store name and address. Nothing here is a volume,
a share or a national figure: it is Alagoas, transacted prices, and which stores sold each EAN recently.

Output (UTC capture date in the names):
  docs/pilot-chocolate/capture-kit/economiza-alagoas-<date>.csv.gz       one row per card kept (gzip, mtime 0)
  docs/pilot-chocolate/capture-kit/economiza-alagoas-requests-<date>.csv one row per HTTP request (status, bytes, SHA-256)
Usage: python3 scripts/capture-economiza-alagoas.py [--dry-run] [--from-html term=file ...]
"""
import argparse
import csv
import gzip
import datetime as dt
import hashlib
import html as htmllib
import http.client
import io
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "docs/pilot-chocolate/capture-kit"
TERMS = KIT / "economiza-alagoas-terms.csv"
BASE = "https://economizaalagoas.sefaz.al.gov.br"
UA = "ShopplosionPulse/1.0 (public price research, weekly, low rate; github.com/PauloRafaeldeMouraPaes/shopplosion-pulse)"
FOOD_SEGMENT = "50000000"
PAUSE_SECONDS = 5
# Kept: chocolate confectionery. A description is kept when it names chocolate or a chocolate product line and is not
# a drink, ice cream, biscuit, cake, yoghurt or powder. Excluded rows are counted per request, never stored.
CHOCOLATE_RE = re.compile(r"CHOC|BOMB|TRUFA|CACAU|OVO\s+(DE\s+)?PASC|OURO\s*BRANCO|\bO\s*BRANCO\b|SONHO\s+DE\s+VALSA|SONHO\s+VALS|DIAMANTE\s+NEGRO|\bLAKA\b|"
                          r"TALENTO|SERENATA|BATON|PRESTIGIO|CHARGE|KIT\s*KAT|\bBIS\b|5\s*STAR|FERRERO|LINDT|LINDOR|KINDER|TORTUGUITA|SUFLAIR|ALPINO|CLASSIC\b", re.I)
NOT_CHOCOLATE_RE = re.compile(r"BEB(IDA)?\b|ACHOC|NESCAU|TODDY|LEITE\s+(UHT|LONGA|INTEGRAL|DESNAT)|\bLT\b|\d\s*L\b|1,5L|SORV|PICOL|BISC|COOKIE|WAFER\s+RECH|TRAKINAS|BOLO|IOGUR|"
                              r"\bPO\b|EM\s+PO|CEREAL|SUCRILHOS|ROSQ|PANETONE|CHOCOTONE|CAPPUC|MOUSSE|PUDIM|DANONE|DANETTE|CALDA|COBERT|GRANULADO", re.I)


def is_chocolate(desc):
    return bool(CHOCOLATE_RE.search(desc)) and not NOT_CHOCOLATE_RE.search(desc)


def keep_rows(rows):
    """One decision per GTIN: the same barcode is written differently by each store, so a GTIN is chocolate when
    most of its descriptions in the run are; rows without a GTIN are decided by their own description."""
    votes = {}
    for r in rows:
        if r["gtin"]:
            votes.setdefault(r["gtin"], []).append(is_chocolate(r["descricao_nfce"]))
    decided = {g: sum(v) * 2 >= len(v) for g, v in votes.items()}
    return [r for r in rows if (decided[r["gtin"]] if r["gtin"] else is_chocolate(r["descricao_nfce"]))]
FIELDS = ["capture_id", "captured_at_utc", "search_term", "gtin", "descricao_nfce", "valor_unitario_brl", "unidade",
          "valor_ultima_venda_brl", "ultima_venda_texto", "ultima_venda_estimada_utc", "loja", "inscricao_estadual", "endereco",
          "municipio_bairro_cep", "request_sha256"]
REQ_FIELDS = ["captured_at_utc", "search_term", "method", "url", "http_status", "bytes", "sha256", "cards_total", "cards_kept", "note"]


def brl(text):
    m = re.search(r"R\$\s*([\d.]+),(\d{2})", text or "")
    return f"{int(m.group(1).replace('.', ''))}.{m.group(2)}" if m else ""


def clean(s):
    return re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def relative_to_utc(text, captured):
    t = text.lower()
    total = dt.timedelta()
    for n, unit in re.findall(r"(\d+)\s*(dia|hora|minuto)", t):
        total += {"dia": dt.timedelta(days=int(n)), "hora": dt.timedelta(hours=int(n)), "minuto": dt.timedelta(minutes=int(n))}[unit]
    if not total:
        return ""
    return (captured - total).replace(second=0, microsecond=0).isoformat().replace("+00:00", "Z")


def parse_cards(page, term, captured, sha):
    cards = re.split(r'<div class="cartao\b', page, flags=re.I)[1:]
    rows = []
    for c in cards:
        title = re.search(r'class="cartao_titulo_texto[^"]*"[^>]*>\s*([^<]+?)\s*<', c, re.I)
        desc = clean(title.group(1)) if title else ""
        gt = re.search(r"consultarPorCodigoBarra\(\s*'(\d+)'", c)
        def block(cls):
            m = re.search(r'class="' + cls + r'[^"]*"[^>]*>(.*?)</div>', c, re.S | re.I)
            return m.group(1) if m else ""
        unit_txt = clean(block("bloco_venda_esquerdo"))
        right_txt = clean(block("bloco_venda_direito"))
        unidade = re.sub(r"R\$\s*[\d.,]+", "", unit_txt).strip()
        quando = re.search(r"(Há .*)$", right_txt)
        lines = [clean(x) for x in re.split(r"<br\s*/?>", block("cartao_contribuinte_bloco_esquerdo"), flags=re.I)]
        lines = [x for x in lines if x]
        loja = lines[0] if lines else ""
        endereco = lines[1] if len(lines) > 1 else ""
        mbc = re.sub(r",\s*$", "", " ".join(lines[2:])).replace(", ,", ",") if len(lines) > 2 else ""
        ie = re.search(r"exibirEstabelecimento\('(\d+)'\)", c)
        rows.append({
            "search_term": term, "gtin": gt.group(1) if gt else "", "descricao_nfce": desc,
            "valor_unitario_brl": brl(unit_txt), "unidade": unidade, "valor_ultima_venda_brl": brl(right_txt),
            "ultima_venda_texto": quando.group(1) if quando else "", "ultima_venda_estimada_utc": relative_to_utc(quando.group(1), captured) if quando else "",
            "loja": loja, "inscricao_estadual": ie.group(1) if ie else "", "endereco": endereco, "municipio_bairro_cep": mbc, "request_sha256": sha,
        })
    return rows


class Session:
    def __init__(self):
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, url, data=None, referer=None):
        headers = {"User-Agent": UA}
        if referer:
            headers["Referer"] = referer
        body = urllib.parse.urlencode(data).encode() if data else None
        req = urllib.request.Request(url, data=body, headers=headers)
        # A dropped connection (not an HTTP status) gets one more attempt after a pause; 403 and 429 never retry.
        for attempt in (1, 2):
            try:
                with self.opener.open(req, timeout=150) as r:
                    return r.status, r.read()
            except urllib.error.HTTPError:
                raise
            except (http.client.HTTPException, ConnectionError, TimeoutError, urllib.error.URLError):
                if attempt == 2:
                    raise
                time.sleep(PAUSE_SECONDS * 3)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="print counts, write nothing")
    ap.add_argument("--from-html", nargs="*", default=[], help="term=path pairs: parse saved category pages (tests), no network")
    args = ap.parse_args()
    captured = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    stamp = captured.isoformat().replace("+00:00", "Z")
    day = captured.date().isoformat()
    rows, reqs = [], []
    if args.from_html:
        for pair in args.from_html:
            term, path = pair.split("=", 1)
            raw = Path(path).read_bytes()
            sha = hashlib.sha256(raw).hexdigest()
            got = parse_cards(raw.decode("utf-8", "replace"), term, captured, sha)
            kept = keep_rows(got)
            rows += kept
            reqs.append({"captured_at_utc": stamp, "search_term": term, "method": "FILE", "url": path, "http_status": "", "bytes": len(raw), "sha256": sha, "cards_total": len(got), "cards_kept": len(kept), "note": "parsed from saved page"})
    else:
        terms = [r["term"] for r in csv.DictReader(TERMS.open(encoding="utf-8")) if r.get("active", "yes") == "yes"]
        for term in terms:
            s = Session()
            steps = [("GET", BASE + "/", None, None),
                     ("POST", BASE + "/exibicaoPrecoProduto.htm", {"textoConsulta": term[:30]}, BASE + "/"),
                     ("GET", BASE + f"/exibicaoPrecoProduto.htm?codSegmentoGPC={FOOD_SEGMENT}", None, BASE + "/exibicaoPrecoProduto.htm")]
            for i, (method, url, data, ref) in enumerate(steps):
                if reqs:
                    time.sleep(PAUSE_SECONDS)
                try:
                    status, raw = s.call(url, data, ref)
                except urllib.error.HTTPError as e:
                    reqs.append({"captured_at_utc": stamp, "search_term": term, "method": method, "url": url, "http_status": e.code, "bytes": 0, "sha256": "", "cards_total": "", "cards_kept": "", "note": "HTTP error: capture stopped, not retried"})
                    print(f"HTTP {e.code} em {url}: captura interrompida", file=sys.stderr)
                    break
                except (urllib.error.URLError, TimeoutError, http.client.HTTPException, ConnectionError) as e:
                    reqs.append({"captured_at_utc": stamp, "search_term": term, "method": method, "url": url, "http_status": "", "bytes": 0, "sha256": "", "cards_total": "", "cards_kept": "", "note": f"network error: {e}"})
                    break
                sha = hashlib.sha256(raw).hexdigest()
                rec = {"captured_at_utc": stamp, "search_term": term, "method": method, "url": url, "http_status": status, "bytes": len(raw), "sha256": sha, "cards_total": "", "cards_kept": "", "note": ""}
                if i == 1 and f"consultarPorCategoria({FOOD_SEGMENT})" not in raw.decode("utf-8", "replace"):
                    rec["note"] = "no food category for this term"
                    reqs.append(rec)
                    break
                if i == 2:
                    got = parse_cards(raw.decode("utf-8", "replace"), term, captured, sha)
                    kept = keep_rows(got)
                    rec["cards_total"], rec["cards_kept"] = len(got), len(kept)
                    rows += kept
                reqs.append(rec)
            else:
                continue
            if reqs and str(reqs[-1]["http_status"]) in ("403", "429"):
                break
    seen, out = set(), []
    for r in rows:
        key = (r["gtin"], r["inscricao_estadual"], r["loja"], r["valor_unitario_brl"], r["valor_ultima_venda_brl"], r["ultima_venda_texto"])
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    for n, r in enumerate(out, 1):
        r["capture_id"] = f"EAL-{day.replace('-', '')}-{n:05d}"
        r["captured_at_utc"] = stamp
    eans = {r["gtin"] for r in out if r["gtin"]}
    stores = {r["inscricao_estadual"] or (r["loja"], r["endereco"]) for r in out}
    print(f"{len(out)} linhas de chocolate, {len(eans)} EAN, {len(stores)} lojas; {len(reqs)} requisições")
    if args.dry_run:
        return 0
    if not out:
        print("Nada gravado: nenhuma linha de chocolate.", file=sys.stderr)
        return 2
    def as_csv(fields, data):
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(data)
        return buf.getvalue().encode("utf-8")
    # The observations file is gzipped (about 3,5 MB raw per week); mtime=0 keeps the bytes reproducible.
    body = as_csv(FIELDS, out)
    with open(KIT / f"economiza-alagoas-{day}.csv.gz", "wb") as fh:
        with gzip.GzipFile(filename="", mode="wb", fileobj=fh, mtime=0, compresslevel=9) as gz:
            gz.write(body)
    for r in reqs:
        if r["method"] == "GET" and str(r["cards_total"]) != "":
            r["note"] = (r["note"] + "; " if r["note"] else "") + f"observations SHA-256 (uncompressed CSV) {hashlib.sha256(body).hexdigest()}"
    (KIT / f"economiza-alagoas-requests-{day}.csv").write_bytes(as_csv(REQ_FIELDS, reqs))
    print(f"Gravado: economiza-alagoas-{day}.csv.gz e economiza-alagoas-requests-{day}.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())
