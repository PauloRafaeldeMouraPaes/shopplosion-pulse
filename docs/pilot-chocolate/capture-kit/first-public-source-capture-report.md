# First public-source desk capture — 15 October 2026

Status: **completed as a secondary-source desk capture; not a four-week baseline**.

## What was captured

- `public-source-capture-2026-10-15.csv`: seven dated public-source records across shopper survey reporting, industry/price context, macro retail context and historical Easter retail snapshots.
- `public-retail-snapshot-2026-10-15.csv`: seven publicly visible 80g product listing snapshots across Pão de Açúcar and Super Muffato, covering Lacta, Garoto and Nestlé, including conditional promotions and normalized price per 100g.
- `public-source-review-2026-10-15.csv`: four preliminary signal candidates with observed facts separated from hypotheses, alternatives, independence assessment and follow-up actions.

Capture date is 2026-10-15 UTC at date precision; exact clock time was not recorded. This was a manual desk capture of public webpages/search results, not an automated scrape or direct survey collection. No raw Google Trends export, repeated multi-retailer panel, social listening corpus, or SKU-level historical retail series was collected. The retail snapshot spans two online retailers but has no delivery ZIP selected and no EAN displayed; exact SKU equivalence across retailers is unverified.

## Preliminary signals

0. **Retail offer snapshot (two retailers, one day).** Seven 80g pages show displayed prices from R$6.15 to R$13.99 (R$7.69–R$17.49 per 100g), including conditional promotions. This is not a trend or like-for-like comparison: variants, offers and delivery regions differ, and EAN-level matching was not possible.

1. **Price scrutiny and format flexibility (preliminary).** Two separate nationwide Easter surveys report price sensitivity and planned interest in bars/bonbons as well as eggs. This is corroboration across survey organizations, but it is seasonal, self-reported and does not establish a year-round or emerging trend.
2. **Input and shelf-price divergence (hypothesis).** FGV's Easter basket metrics and Banco do Nordeste's cocoa-market context suggest aggregate basket movement, chocolate item movement and cocoa inputs need to be measured separately. This does not establish causal price transmission.
3. **Pressure in the broader retail environment (context only).** Cielo's reported September retail decline is not chocolate-specific and cannot be presented as a category result.
4. **Format price comparisons need direct observation.** A Folha Easter field report contains historical prices from a limited set of outlets; these are not current prices or a representative time series.

## Interpretation guardrails

- These are source observations and hypotheses, not a validated emerging shopper trend.
- Survey results describe stated intent, not completed purchases.
- Seasonal Easter findings must not be extrapolated to October/year-round demand without further evidence.
- Broad retail, cocoa supply and aggregate price indexes remain separate from direct shopper behavior.
- Historical retail examples must not be backfilled into a longitudinal series.
- The reviewer field is unassigned; no human acceptance decision has been recorded.

## Next capture sequence

1. Manually export Google Trends for the registered category and need-state query sets (Brazil; separate 5-year and 12-month windows; same search settings), preserving original CSVs and exact settings in the manifest.
2. Repeat the public retail snapshot across multiple retailer networks and a transparent multi-brand sample, recording URL, observation time, product/pack weight, price, promotion, availability wording and currency. Treat each as a dated snapshot; verify EAN/product identity before like-for-like comparisons.
3. Collect a second round on a fixed cadence and use stable observation keys; do not infer historical prices from current pages.
4. Add independent public recipe/review/conversation sources with publication dates and deduplicate syndicated content.
5. Have a human reviewer accept/reject the candidate signals with reasons. Start the four-week baseline only when a reproducible capture stream and QA process are operating.

## Current gate

The public-source discovery work has begun; the baseline remains `not_started` because the time-series capture, reproducibility and human QA gates are not yet satisfied.
