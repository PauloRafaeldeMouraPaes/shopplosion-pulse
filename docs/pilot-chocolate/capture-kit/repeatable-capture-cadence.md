# Repeatable capture cadence — Chocolate pilot

Status: **protocol ready; cadence not started**. This file defines the repeatable capture run once the first human QA gate is accepted. It does not itself start the four-week baseline.

## Unit of observation

- **Shopper/search:** one Google Trends term × query configuration × time point, sourced only from an actual unchanged CSV export.
- **Retail offer:** one product × retailer × delivery region/ZIP × exact observation timestamp. Capture regular price, promotional price, offer mechanic, pack weight, displayed availability, currency, URL and evidence snapshot where permitted.
- **Public qualitative signal:** one dated article, recipe, review, Q&A or public conversation, with exact URL, publication date if shown, capture timestamp, short paraphrase, source family and deduplication/fingerprint.
- **Context only:** macro, cocoa supply, sector totals or trade data. Keep separate from shopper behavior and retail offer evidence.

## Fixed collection cadence

1. **Before baseline start:** export all four registered Google Trends comparisons manually; keep each original CSV unchanged; record exact settings, local and UTC export timestamps, URL and SHA-256 in `trends-export-manifest.template.csv`. If no export is present, mark it `not_captured`, never zero.
2. **Retail, same day each week:** revisit the same public product URLs in `product-universe-initial-2026-10-14.csv` where available. Record exact capture time and delivery ZIP/region; if the page does not expose EAN, keep product identity unverified. Do not treat a missing product/page/field as zero or out of stock.
3. **Shopper qualitative, weekly:** collect a small fixed sample from each pre-registered family (public news, recipe/content, public reviews/Q&A when ordinarily accessible). Search with fixed queries and record query, platform/page context, date range, URLs, publication dates, and duplicate/syndication relationships. Do not choose only items that support an emerging hypothesis.
4. **Provenance and QA, each run:** append source provenance, run identifier, query/settings, capture timestamps, coverage gaps, reuse limits and reviewer decision. Preserve contradictory and null observations.
5. **Weekly review:** evaluate recurrence, direction, source independence, coverage stability, alternative explanations and whether the signal is shopper-side, retail-side or context-only. One source family or one viral item cannot establish a consolidated signal.
6. **After four complete weeks:** compare the same items and settings across all weeks; document missing observations, sample changes and any method changes. A human reviewer records whether the series is suitable for analysis. If coverage or method changes materially, segment or restart the series rather than silently joining it.

## Baseline gate — all required

- [ ] Four real Google Trends CSVs are present, unchanged, hashed and reproducible from their recorded settings.
- [ ] Retail product identity, pack size, currency, timestamp and offer mechanics are sufficiently verified for like-for-like comparisons.
- [ ] Public-source access methods and relevant source-specific restrictions are documented; no access controls were bypassed.
- [ ] At least one shopper-side signal family and one repeatable retail observation stream are captured with provenance.
- [ ] Sampling/query schedule is frozen and the reviewer accepts the first reproducible capture.
- [ ] Baseline start timestamp and timezone are explicitly recorded after acceptance.

Until all gates pass, status remains `not_started`. Public-source discovery and one-off snapshots are useful preliminary work, but they are not a four-week baseline. Do not infer purchases, preference, switching, elasticity or causality from search interest, content engagement or prices alone.
