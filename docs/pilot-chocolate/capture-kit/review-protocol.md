# Review protocol — Chocolate pilot capture kit

## Purpose

Create an auditable starting point for evaluating two independent dimensions:
- **Shopper-side search interest**: relative search interest from Google Trends.
- **Retail offer observations**: observed prices and availability from a retailer data source with explicitly permitted access.

Neither dimension alone proves purchase, sell-out, preference, switching, price elasticity or causal impact.

## Google Trends

1. Use the official Explore interface and export CSV manually. Do not assume programmatic API access.
2. Preserve the raw export unchanged; calculate SHA-256 separately and record it in the working manifest.
3. Record exact query text and whether each query is a search term or a topic. Do not combine or relabel these as equivalent.
4. Record geography, date window, category, search type, export time and source URL.
5. Interest values are normalized indices, not absolute search counts. Values can be sampled/rounded and low-volume terms may show zero.
6. Keep separate exports when settings differ. Do not join series unless the comparison method is documented and defensible.

## Retail observations

1. Use only data obtained through a source/API/feed whose terms explicitly permit the intended collection and analytical/commercial use. Record the permission/license reference.
2. Do not scrape sources that prohibit automated collection; do not bypass authentication, CAPTCHAs, rate limits or access controls.
3. Match products by EAN first, then verify brand, variant and net weight. A name-only match is insufficient.
4. Preserve source values and price fields exactly. Record regular and promotional prices separately and include promotion conditions where published.
5. Compute price_per_100g_brl = observed_price_brl / net_weight_g * 100 only when both values are confirmed. Keep raw inputs.
6. Availability values: in_stock, out_of_stock, not_stated, not_observed, or ambiguous. Missing records are not proof of out-of-stock.
7. Keep observation time separate from source-published time. Never infer historical price from search snippets or stale indexed pages.
8. Hash the raw payload/export where permitted; avoid storing personal data or unnecessary customer information.

## Deduplication and QA

- Stable deduplication key for retail: source + retailer + store/region + EAN + observed timestamp + offer type.
- Stable deduplication key for Trends: source + export settings + query type + query text + series date.
- Flag exact duplicates, changed payloads with identical keys, missing provenance, invalid EAN, non-positive weight/price, currency mismatch and impossible dates.
- Never silently replace an earlier observation. Append a corrected row with a review note and retain the original artifact.
- Proposed retail QA gate: document the share of sampled observations with verified item identity, timestamp, price/weight and retailer/store context across multiple product types and retailer networks where available. Do not use a single brand's EAN list as the category denominator; set and justify any numerical threshold before reviewing results.

## Signal review

Every candidate signal must include:
- observed fact(s) with links and observation timestamps;
- hypothesis separated from fact;
- confidence and rationale;
- alternative explanations (seasonality, promotion, distribution, source coverage, sampling, duplicated/syndicated reporting);
- independent corroboration or an explicit single-source/preliminary label;
- limitations and a human accept/reject decision with reason.

Do not label price changes as shopper shifts. Do not infer sales, purchase intent, preference, elasticity or brand switching from search interest and shelf prices alone.

## Baseline start condition

A four-week baseline begins only after:
1. source access and usage rights are approved;
2. a real capture has been reproduced and QA accepted;
3. raw files, settings, hashes and timestamps are retained;
4. the fixed category query sets, transparent sample method and sampling schedule are documented.

Before that gate, the baseline status is not_started.
