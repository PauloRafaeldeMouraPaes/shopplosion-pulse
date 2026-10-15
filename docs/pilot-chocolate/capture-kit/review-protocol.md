# Review protocol — Chocolate pilot capture kit

## Purpose

Create an auditable starting point for evaluating two independent dimensions:
- **Shopper-side search interest**: relative search interest from Google Trends.
- **Retail offer observations**: dated observations from public product listings, plus optional licensed feeds when they materially improve coverage.

Neither dimension alone proves purchase, sell-out, preference, switching, price elasticity or causal impact.

## Google Trends

1. Use the official Explore interface and export CSV manually. Do not assume programmatic API access.
2. Preserve the raw export unchanged; calculate SHA-256 separately and record it in the working manifest.
3. Record exact query text and whether each query is a search term or a topic. Do not combine or relabel these as equivalent.
4. Record geography, date window, category, search type, export time and source URL.
5. Interest values are normalized indices, not absolute search counts. Values can be sampled/rounded and low-volume terms may show zero.
6. Keep separate exports when settings differ. Do not join series unless the comparison method is documented and defensible.

## Retail observations

1. Start with pages ordinarily accessible to the public. Record URL, capture time, page context, displayed values, attribution and material reuse limits. Public-source discovery does not require bespoke brand/supplier approval by default; document the actual access basis and check source-specific terms before systematic collection, redistribution or commercial display.
2. Respect applicable site terms and technical controls. Do not bypass authentication, CAPTCHAs, rate limits or access controls, and do not automate collection where the source prohibits it. If a source restricts the intended collection or reuse, limit the activity accordingly or choose a suitable alternative; this is source-specific, not a universal brand-approval gate.
3. A paid/private feed is optional enrichment, not a baseline prerequisite. Before using one, record its specific access and license basis and confirm the intended use is within scope.
4. Match products by EAN first, then verify brand, variant and net weight. A name-only match is insufficient for like-for-like comparison; retain unverified public listings as exploratory records with an explicit match status.
5. Preserve source values and price fields exactly. Record regular and promotional prices separately and include promotion conditions where published.
6. Compute price_per_100g_brl = observed_price_brl / net_weight_g * 100 only when both values are confirmed. Keep raw inputs.
7. Availability values: in_stock, out_of_stock, not_stated, not_observed, or ambiguous. Missing records are not proof of out-of-stock.
8. Keep observation time separate from source-published time. Never infer historical price from search snippets or stale indexed pages.
9. Hash raw files where practical and permitted; avoid storing personal data or unnecessary customer information.

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
1. the specific public-source collection method and any material source restrictions are documented (a paid feed, if used, must have its own compatible access/license basis);
2. a real capture has been reproduced and QA accepted;
3. source URLs, settings, timestamps, and raw files/hashes where permitted are retained;
4. fixed category query sets, transparent sample method and sampling schedule are documented.

Before that gate, the baseline status is not_started.
