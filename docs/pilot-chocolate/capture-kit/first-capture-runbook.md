# First capture runbook — Chocolate pilot

Status: **prepared, not executed**. No real observations are included in this runbook.

## Hard stop conditions

Do not start capture or a four-week baseline until all applicable boxes are accepted by a human owner.

- [ ] Category taxonomy, discovery questions and transparent sampling method are documented in `category-scope.md`; brand approval is not required for category-level discovery.
- [ ] Each source has a completed `source-permissions.template.csv` record documenting access method, terms/license version, collection rules, retention, derived analytics, citation and commercial display. For legitimately public sources, record the applicable terms and access basis; obtain a written license/agreement when required for restricted feeds.
- [ ] Any restricted retail sample/feed is covered by the provider's required written authorization and has a recorded sample ID/hash; public observations may proceed only where the source's terms permit the intended method and use.
- [ ] Source-specific settings, time zone, collection method, cadence, and known gaps are documented.
- [ ] QA reviewer approves the first reproducible capture and records the decision.
- [ ] Fixed category query sets, sampling method and observation schedule are frozen before the baseline start date.

A public marketing page, green CI, a draft email, a preview deployment or a planned query is not proof that any gate passed.

## Workspace layout

Keep a restricted working directory outside production code. Use a run identifier such as `chocolate-YYYYMMDD-run01` and store:

- `raw/trends/`: original Google Trends CSV exports, unchanged.
- `raw/retail/`: authorized provider sample/export, unchanged and subject to license restrictions.
- `manifests/`: completed export manifest, source permission register and sample acceptance scorecard.
- `normalized/`: derived tables, with transformation version and source-row reference.
- `qa/`: validation report, duplicate/gap report and reviewer decision.
- `sha256sums.txt`: SHA-256 hashes for files where hashing/storage is permitted.

Never put credentials, tokens, personal data or restricted raw data in a public repository, pull request, GitHub issue or production bundle. If the source license forbids retaining or hashing raw payloads, record that restriction and obtain legal/owner guidance rather than bypassing it.

## Google Trends capture procedure

1. Open the official Explore interface manually.
2. Use the pre-registered query set in `trends-query-plan.md`; do not change query type, geography, category, search type or period after seeing results without recording a protocol amendment.
3. Export each configured comparison separately and retain the original CSV unchanged.
4. Record each export in `trends-export-manifest.template.csv`, including exact settings, export time in UTC, source URL, original filename and SHA-256.
5. Check date coverage, header/encoding, duplicate dates, missing dates and whether values are low-volume/zero. Preserve zeros as exported; do not interpret them as zero demand.
6. Do not concatenate independently normalized 0–100 exports as if they were absolute or directly comparable. Document any defensible comparison method before analysis.

## Retail sample procedure

1. Use a public source only where its terms permit the intended access and use, or use a provider sample/API/feed under the expressly authorized scope recorded in the source register.
2. Retain the received artifact only as permitted. Record sample ID, retrieval time, license version, original filename and hash if allowed.
3. Validate each product match by EAN where available, plus brand, variant and net weight; record store/network granularity and earliest/latest observation dates. This is data QA, not a buyer-approval gate.
4. Distinguish observed price, regular price, promotional price, promotion mechanics, availability and missing/not-observed states. Never infer out-of-stock from a missing row.
5. Fill `retail-sample-acceptance.template.csv` and reject any price without verified EAN, weight, currency, source and timestamp.
6. Report coverage by product/format/price tier × retailer/store × date, including missing days. Use EAN for exact matching when present; do not treat a provider's overall store count or brand list as proof of actual coverage. Lindt coverage is optional for a category-wide baseline.

## QA acceptance for the first run

- Source terms and access basis support the intended collection, retention and use; obtain a written license where required.
- All retained rows have source provenance and unambiguous observation timestamps.
- No unexplained duplicate observation keys; corrections are appended with notes rather than silently overwriting history.
- Product/EAN, variant, net weight, currency and price values pass the documented checks.
- Missingness, coverage and gaps are explicit; no absent row is treated as zero price or out-of-stock.
- Shopper search interest, retail offers and industry/supply statistics remain separate signal families.
- A human reviewer records accepted/rejected status and rationale in the weekly signal review template.

## Baseline clock

The four-week baseline start timestamp is the first accepted capture after every hard gate passes. A failed or unauthorized sample does not start the clock. Record start/end timestamps and capture schedule in a versioned manifest. If settings, coverage, license or methodology materially changes, document the change and decide explicitly whether the baseline must restart.

## First-run outcome record

- Run ID:
- Owner:
- Reviewer:
- Category scope and sampling register reference:
- Trends export manifest reference:
- Retail sample/license reference:
- QA report reference:
- Accepted/rejected decision and rationale:
- Baseline start timestamp (leave blank until accepted):
- Known limitations:

Until this record is completed with real evidence, status remains `not_started`.
