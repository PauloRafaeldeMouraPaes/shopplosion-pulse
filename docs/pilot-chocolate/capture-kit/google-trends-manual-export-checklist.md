# Google Trends manual export checklist — Chocolate pilot

Status: **execution guide only; no export is implied by this file**. Use this checklist in the Google Trends interface. Do not populate observations, hashes or export timestamps until the original CSV has actually been downloaded and inspected.

## Required exports

1. [Set A — Brazil, last 5 years](https://trends.google.com/trends/explore?date=today%205-y&geo=BR&cat=0&q=chocolate%2Cbarra%20de%20chocolate%2Cchocolate%20amargo%2Cchocolate%20ao%20leite%2Cchocolate%20sem%20a%C3%A7%C3%BAcar)
2. [Set A — Brazil, last 12 months](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&cat=0&q=chocolate%2Cbarra%20de%20chocolate%2Cchocolate%20amargo%2Cchocolate%20ao%20leite%2Cchocolate%20sem%20a%C3%A7%C3%BAcar)
3. [Set B — Brazil, last 5 years](https://trends.google.com/trends/explore?date=today%205-y&geo=BR&cat=0&q=Lindt%2CLacta%2CGaroto%2CNestl%C3%A9%2CFerrero%20Rocher)
4. [Set B — Brazil, last 12 months](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&cat=0&q=Lindt%2CLacta%2CGaroto%2CNestl%C3%A9%2CFerrero%20Rocher)

## For each comparison

- [ ] Open the registered link and verify all five query terms and their order.
- [ ] Verify geography is Brazil and category is **All categories (`cat=0`)** for every export. If the interface does not reflect this exact setting, stop and record the mismatch rather than exporting under a different category.
- [ ] Confirm every item is a **Search term**, not a Topic. If Google interprets a term as a Topic, stop and record the discrepancy rather than silently mixing query types.
- [ ] Confirm the requested time window and Web Search.
- [ ] Use the chart download menu to export CSV. Preserve the downloaded original byte-for-byte; do not edit the original or infer missing values.
- [ ] Record the actual UTC export timestamp, original filename, exact Explore URL and settings in `trends-export-status-2026-10-15.csv` and `trends-export-manifest.template.csv`.
- [ ] Compute SHA-256 on the original file and enter the hash only after the command succeeds. On macOS/Linux: `shasum -a 256 <filename>` or `sha256sum <filename>`; on PowerShell: `Get-FileHash <filename> -Algorithm SHA256`.
- [ ] Store the original file in the approved raw-data location. Before committing it to a public repository, confirm the repository's data-retention policy and applicable terms; otherwise retain it locally and commit only metadata/hash.
- [ ] Inspect the CSV header, date coverage, expected series and empty/low-volume values. Document missing/low-volume results as limitations, not zeros.
- [ ] Update the matching status row from `not_captured` only when the file exists, its settings are verified and its hash is recorded. Set QA to `pending_review` until a reviewer accepts it.
- [ ] Run `node scripts/parse-google-trends-export.js --export-id <slot> --file <original.csv> --out <observations.csv> --report <report.json>`. The parser validates the multiTimeline structure (metadata header, time header, one column per term, index 0..100 or `<1`, peak = 100) and the time axis (calendar-valid, strictly increasing, uniform cadence, no duplicates), and rejects a file whose terms, category (in either direction), geography label or window length (points and cadence for the registered `window_label`) differ from the registered slot. The SHA-256 check only applies once a hash is recorded in the slot: on the first capture the parser reports the file hash (`hash_check: unregistered_hash_reported_only`) and the operator records it after review. It writes rows in the `trends-observations` template with `<1` preserved as low volume, refuses `--out`/`--report` paths inside the capture kit and never changes the status file. Attach the JSON report to the review.

## Interpretation controls

- Values are normalized relative search interest within each comparison, not absolute search counts, sales, preference or market share.
- Never join numeric indices across separate exports as if they shared one scale. Compare shapes and seasonal timing within each export, and label cross-export limits.
- Mark Easter and other seasonal events before calling a peak an emerging signal.
- Do not start the four-week baseline until all four exports exist, their settings/provenance are reviewed, the retail and source-provenance gates pass, and a human reviewer records acceptance.

## Current state

All four slots were captured on 2026-11-03 (UTC 05:17) and registered in `trends-export-status-2026-10-15.csv` as `captured`; QA `accepted` by Paulo on 2026-11-04, with the limitations recorded in each row. The original CSVs (`GT-CHOC-A-5Y.csv`, `GT-CHOC-A-12M.csv`, `GT-CHOC-B-5Y.csv`, `GT-CHOC-B-12M.csv`) are kept byte for byte in this folder and their SHA-256 is enforced by `scripts/test-chocolate-capture-kit-integrity.js`. Each passed `scripts/parse-google-trends-export.js` (VALID, weekly, peak 100, `<1` preserved). The last week of each file (2026-11-01) is partial. Data source: Google Trends. The four-week baseline still waits for the source-provenance, retail coverage, reproducibility and human signal review gates.

On 2026-11-04 method v2 (`trends-method-v2.md`) added Set B2 (`GT-CHOC-B2-5Y`, `GT-CHOC-B2-12M`) and three single-term Set A exports (`GT-CHOC-AS-*`), captured the same way, parser VALID, QA `accepted` by Paulo on 2026-11-04 (`chocolate amargo` flagged by the screen until its 2026 spike is explained).
