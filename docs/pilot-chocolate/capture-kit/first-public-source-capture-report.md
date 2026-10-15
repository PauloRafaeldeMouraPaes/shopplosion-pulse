# First public-source desk capture — 14 October 2026

Status: **exploratory capture completed; not a four-week baseline**.

## What was captured

- `public-source-capture-2026-10-14.csv`: twenty-four dated public-source records across shopper survey reporting, price context, macro retail, cocoa supply, historical retail observations and recipe content.
- `public-retail-snapshot-2026-10-14.csv`: seven publicly visible 80g product listing snapshots across Pão de Açúcar and Super Muffato, covering Lacta, Garoto and Nestlé.
- `public-source-review-2026-10-14.csv`: eleven preliminary signal candidates with facts, hypotheses, alternative explanations, independence assessment and follow-up actions.
- `public-source-provenance-2026-10-14.csv`: provenance and reuse caveats for the sources used or planned, including the official Google Trends export instructions.
- `product-universe-initial-2026-10-14.csv`: seven product × retailer records, all exploratory because EANs are not visible and exact timestamps/regions are incomplete.
- `retail-sample-acceptance-2026-10-14.csv`: seven row-level QA decisions; none is baseline-accepted. They remain exploratory pending exact timestamps, product identity and source-use review.
- `trends-query-plan.md`: registered category and brand query sets with direct Google Trends Explore links.
- `trends-export-status-2026-10-15.csv`: four required export slots, explicitly marked `not_captured`; this is a tracking register, not search-interest data.
- `google-trends-manual-export-checklist.md`: reproducible UI-export steps, settings verification, SHA-256 handling and QA controls; it does not imply exports were captured.

The filenames use the São Paulo local capture date (2026-10-14). UTC-date fields are recorded as 2026-10-15 because capture occurred after midnight UTC; exact clock time was not recorded. Historical publication/observation dates inside source pages remain their own dates. This was a manual desk capture of public webpages/search results, not an automated scrape or direct survey collection. No raw Google Trends export, repeated Pulse multi-retailer panel or social listening corpus was collected. The direct retail snapshot spans two online retailers but has no delivery ZIP selected and no EAN displayed; exact SKU equivalence across retailers is unverified.

## Preliminary signals

- **Price/value trade-off (seasonal historical context, not an October shift).** An Agência Brasil report on an Instituto Locomotiva/QuestionPro survey of 1,557 adults, fielded 25 February–13 March 2026, reports that 61% cited price as a choice factor, followed by ingredient quality (53%), size (44%), known brand (43%) and flavor variety (40%); 12% cited special-diet options. This supports a hypothesis to test against non-Easter evidence, not a current trend claim.
- **Novel recipe experimentation and social visibility (low confidence).** Foodnews's 10 September editorial discusses ingredient combinations and texture contrast; Receitas Globo's 28 February article reports one unusual chocolate mousse video with over 20 million views, while noting mixed reactions. This suggests a qualitative coding dimension only. One viral episode does not prove sustained preference or purchases.

- **Direct online price/offer contrast (preliminary, not like-for-like).** Pão de Açúcar displays Lacta ao leite 80g at R$13.99 with a Leve 3 Pague 2 offer (R$9.33 per unit when buying three); Super Muffato displays R$7.20 regular and R$6.15 promotional. Both pages say online prices/offers are day-specific. EAN and delivery ZIP are not visible/selected, and exact SKU equivalence and offer comparability are unverified; do not interpret this as a validated retailer price premium.

- **Expanded secondary price benchmark (one source family).** Four additional product pages extend the CustoPorPrato set: Lacta Laka Oreo 80g (6 observations, São Paulo mean R$7.99; page reports -29.2% between August and September), Lacta Ao Leite bar 80g (12 observations across 5 states; regional means from R$8.99 in PE to R$12.29 in SP), Garoto Ao Leite 80g (10 markets in 4 states; national median R$8.74; SP mean R$7.99, +5.8% since August), and Classic 40% cocoa 80g (51 markets in 5 states; national median R$11.08; state averages from R$7.98 in SC to R$12.34 in SP). The Laka Oreo sample is very small, and these product pages are not independent sources. Treat reported monthly movement as a monitoring hypothesis only; sample composition, promotions and coverage can explain differences.

- **Cross-SKU price monitoring candidate (one source family).** The aggregator reports +1.1% between August and September monthly averages for Lacta milk 80g, +1.5% since August for Lacta Diamante Negro 80g, and +9.3% between August and September for Suflair Duo 80g. Suflair's São Paulo subset is small (9 observations across 9 markets/cities), and coverage/date windows differ across products. This is a candidate for repeat capture of retail prices, not an emerging shopper trend or evidence of a brand pricing strategy.


1. **Retail offer snapshot (two retailers, one day).** Seven 80g pages show displayed prices from R$6.15 to R$13.99 (R$7.69–R$17.49 per 100g), including conditional promotions. This is not a trend or like-for-like comparison: variants, offers and delivery regions differ, and EAN-level matching was not possible.
2. **Price scrutiny and format flexibility (preliminary).** Two separate nationwide Easter surveys report price sensitivity and planned interest in bars/bonbons as well as eggs. This is corroboration across survey organizations, but it is seasonal, self-reported and does not establish a year-round or emerging trend.
3. **Input and shelf-price divergence (hypothesis).** FGV's Easter basket metrics and Banco do Nordeste's cocoa-market context suggest aggregate basket movement, chocolate item movement and cocoa inputs need to be measured separately. This does not establish causal price transmission.
4. **Pressure in the broader retail environment (context only).** Cielo's reported September retail decline is not chocolate-specific and cannot be presented as a category result.
5. **Historical retail benchmark (preliminary).** CustoPorPrato reports a Lacta 80g online-price series through 26 September 2026 and a 1.1% rise between the August and September monthly means for its São Paulo sample. Its methodology says the sample is non-probabilistic and coverage changes can affect comparisons. Use it as a secondary benchmark, not independent corroboration of supermarket pages that may underlie it.
6. **Format price comparisons need direct observation.** A Folha Easter field report contains historical prices from a limited set of outlets; these are not current prices or a representative time series.
7. **Recipe-content seed (not a signal).** A dated Receitas Globo chocolate-recipe page is recorded as a seed source. One article cannot establish recipe popularity or emerging behavior; a repeated corpus is required.

## Interpretation guardrails

- The aggregator's own methodology states that its 26 September 2026 release covers 597,451 products, 463 supermarkets, 270 cities and 27 states, with 3,279,896 prices; the sample is non-probabilistic, not weighted by household consumption, online-only, uneven across states and explicitly not an official inflation index. These are platform-reported coverage figures, not independently audited counts.

- **Quarantined data-quality issue:** the CustoPorPrato Nestlé Diplomata 80g page returned conflicting coverage/date summaries between the search result and opened page. Its capture and provenance rows are retained for auditability but explicitly quarantined; do not use its values in synthesis until a stable dated page capture resolves the discrepancy.

- These are observations and hypotheses, not a validated emerging shopper trend.
- Survey results describe stated intent, not completed purchases.
- Seasonal Easter findings must not be extrapolated to October/year-round demand without further evidence.
- Broad retail, cocoa supply and aggregate price indexes remain separate from direct shopper behavior.
- The CustoPorPrato history is a secondary online-price sample, not official inflation data, and may overlap with supermarket sources; avoid double-counting it as independent corroboration.
- Historical retail examples must not be backfilled into Pulse's own longitudinal series.
- The reviewer field is unassigned; no human acceptance decision has been recorded. The seven direct retail rows have explicit preliminary QA decisions and remain exploratory only.

## Next capture sequence

1. Manually export the four registered Google Trends comparisons in `trends-query-plan.md` (Brazil; separate five-year and twelve-month windows; same search settings), preserving original CSVs, URLs, settings and SHA-256 hashes.
2. Repeat the direct public retail snapshot across multiple retailer networks and a transparent multi-brand sample, recording URL, observation time, product/pack weight, price, promotion, availability wording and currency. Treat each as a dated snapshot; verify EAN/product identity before like-for-like comparisons.
3. Compare repeated Pulse captures with the public CustoPorPrato history only after reviewing its methodology and intended reuse; do not count the same underlying supermarket observations as an independent source family.
4. Collect independent public recipe/review/conversation sources with publication dates and deduplicate syndicated content.
5. Have a human reviewer accept/reject candidate signals with reasons. Start the four-week baseline only when a reproducible capture stream and QA process are operating.

## Current gate

The public-source discovery work has begun; the baseline remains `not_started` because the four Google Trends CSV exports still require manual download through the official chart UI, repeatable capture stream, reproducibility and human QA gates are not yet satisfied.
