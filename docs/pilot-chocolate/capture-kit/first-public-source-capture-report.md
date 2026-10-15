# First public-source desk capture — 14 October 2026

Status: **exploratory capture completed; not a four-week baseline**.

## What was captured

- `public-source-capture-2026-10-14.csv`: nine dated public-source records across shopper survey reporting, price context, macro retail, cocoa supply, historical retail observations and recipe content.
- `public-retail-snapshot-2026-10-14.csv`: seven publicly visible 80g product listing snapshots across Pão de Açúcar and Super Muffato, covering Lacta, Garoto and Nestlé.
- `public-source-review-2026-10-14.csv`: six preliminary signal candidates with facts, hypotheses, alternative explanations, independence assessment and follow-up actions.
- `public-source-provenance-2026-10-14.csv`: provenance and reuse caveats for the sources used or planned.
- `google-trends-capture-plan.md`: registered category and brand query sets with direct Google Trends Explore links; no actual Trends CSV is represented as captured.

Capture date is 2026-10-14 UTC at date precision; exact clock time was not recorded. This was a manual desk capture of public webpages/search results, not an automated scrape or direct survey collection. No raw Google Trends export, repeated Pulse multi-retailer panel or social listening corpus was collected. The direct retail snapshot spans two online retailers but has no delivery ZIP selected and no EAN displayed; exact SKU equivalence across retailers is unverified.

## Preliminary signals

1. **Retail offer snapshot (two retailers, one day).** Seven 80g pages show displayed prices from R$6.15 to R$13.99 (R$7.69–R$17.49 per 100g), including conditional promotions. This is not a trend or like-for-like comparison: variants, offers and delivery regions differ, and EAN-level matching was not possible.
2. **Price scrutiny and format flexibility (preliminary).** Two separate nationwide Easter surveys report price sensitivity and planned interest in bars/bonbons as well as eggs. This is corroboration across survey organizations, but it is seasonal, self-reported and does not establish a year-round or emerging trend.
3. **Input and shelf-price divergence (hypothesis).** FGV's Easter basket metrics and Banco do Nordeste's cocoa-market context suggest aggregate basket movement, chocolate item movement and cocoa inputs need to be measured separately. This does not establish causal price transmission.
4. **Pressure in the broader retail environment (context only).** Cielo's reported September retail decline is not chocolate-specific and cannot be presented as a category result.
5. **Historical retail benchmark (preliminary).** CustoPorPrato reports a Lacta 80g online-price series through 26 September 2026 and a 1.1% rise between the August and September monthly means for its São Paulo sample. Its methodology says the sample is non-probabilistic and coverage changes can affect comparisons. Use it as a secondary benchmark, not independent corroboration of supermarket pages that may underlie it.
6. **Format price comparisons need direct observation.** A Folha Easter field report contains historical prices from a limited set of outlets; these are not current prices or a representative time series.
7. **Recipe-content seed (not a signal).** A dated Receitas Globo chocolate-recipe page is recorded as a seed source. One article cannot establish recipe popularity or emerging behavior; a repeated corpus is required.

## Interpretation guardrails

- These are observations and hypotheses, not a validated emerging shopper trend.
- Survey results describe stated intent, not completed purchases.
- Seasonal Easter findings must not be extrapolated to October/year-round demand without further evidence.
- Broad retail, cocoa supply and aggregate price indexes remain separate from direct shopper behavior.
- The CustoPorPrato history is a secondary online-price sample, not official inflation data, and may overlap with supermarket sources; avoid double-counting it as independent corroboration.
- Historical retail examples must not be backfilled into Pulse's own longitudinal series.
- The reviewer field is unassigned; no human acceptance decision has been recorded.

## Next capture sequence

1. Manually export the four registered Google Trends comparisons in `google-trends-capture-plan.md` (Brazil; separate five-year and twelve-month windows; same search settings), preserving original CSVs, URLs, settings and SHA-256 hashes.
2. Repeat the direct public retail snapshot across multiple retailer networks and a transparent multi-brand sample, recording URL, observation time, product/pack weight, price, promotion, availability wording and currency. Treat each as a dated snapshot; verify EAN/product identity before like-for-like comparisons.
3. Compare repeated Pulse captures with the public CustoPorPrato history only after reviewing its methodology and intended reuse; do not count the same underlying supermarket observations as an independent source family.
4. Collect independent public recipe/review/conversation sources with publication dates and deduplicate syndicated content.
5. Have a human reviewer accept/reject candidate signals with reasons. Start the four-week baseline only when a reproducible capture stream and QA process are operating.

## Current gate

The public-source discovery work has begun; the baseline remains `not_started` because the Trends export, repeatable capture stream, reproducibility and human QA gates are not yet satisfied.
