# Chocolate pilot — capture kit (pre-production)

Status: **schema and protocol only**. This directory contains no collected observations and must not be interpreted as evidence or a started baseline.

## Files

- `trends-observations.template.csv`: one row per exported Google Trends series/term and time point, with query settings repeated for auditability.
- `retail-observations.template.csv`: one row per product × retailer/location × observation time.
- `review-protocol.md`: evidence, quality and interpretation rules.

## Activation gates

1. Trends CSV exported manually from the official interface and original file retained; record export timestamp and exact settings.
2. Retail data obtained from a source whose access, license, retention and commercial use are explicitly permitted.
3. Product matching validated by EAN, net weight and variant.
4. Review rejects missing provenance, ambiguous timestamps, duplicate records and unsupported shopper claims.
5. Four-week baseline starts only after the first authorized, reproducible capture is accepted.

No scraper, credentials, external API calls, production writes or recurring capture are included in this kit.

## Baseline status record

**Current status: `not_started`.** This is a documentation/preparation kit, not a collected dataset.

| Gate | Status | Evidence required to change status |
|---|---|---|
| Google Trends capture | Pending | Original CSV exported manually from the official interface; exact query settings, geography, category, search type, date range, export timestamp and SHA-256 recorded |
| Retail source authorization | Pending | Written license/terms confirming permitted collection, retention and commercial analytical use |
| Retail coverage | Pending | Authorized sample proving exact EAN × retailer/store coverage, including Lindt where available, plus comparable products; no inferred coverage |
| Reproducibility and QA | Pending | Repeat capture with source and observation timestamps, stable deduplication keys, documented gaps, verified pack weight and prices |
| Human signal review | Pending | Weekly review log with observed facts, hypotheses, alternatives, confidence, and accept/reject decision with reasons |
| Four-week baseline | **Not started** | All prerequisite gates accepted and fixed query/EAN sets, sampling schedule and coverage documented |

No source has been authorized or connected by this kit, no supplier request has been sent, no CSV observations have been collected, and no coverage or matching threshold has been measured. Do not change the baseline status based on a plan, a public product page, a preview deployment, or CI success alone.

### First weekly review record

For the first review, retain both accepted and rejected candidates. For each candidate record: stable signal ID; capture artifact/hash; source family and publication/observation dates; universe and method; observed fact; separate hypothesis; alternative explanations (seasonality, promotion, distribution, source coverage, sampling and syndicated reporting); independence/corroboration status; confidence; reviewer; decision and rationale. Contradictory signals remain visible. A single-source signal is labeled preliminary, not consolidated.

## Provider shortlist note

A public-source desk review identified Cnova Tech Data Market as a candidate for written coverage/sample diligence only. A separate Cnova Tech institutional licensing page describes feeds for commercial analytics products with SKU × source × day granularity and samples after NDA; this route appears more aligned with Pulse's intended use than assuming a self-service API trial grants the necessary rights. Both pages contain provider claims, not verified pilot results. Lindt/EAN coverage, exact history, sample quality and contractual permissions remain unconfirmed. No account, trial, NDA, API call or supplier contact has been initiated. See `retail-provider-diligence.md` for the decision gates and questions.

