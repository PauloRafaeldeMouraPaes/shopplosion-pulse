# Chocolate pilot — capture kit (pre-production)

Status: **schema and protocol only**. This directory contains no collected observations and must not be interpreted as evidence or a started baseline.

## Files

- `trends-observations.template.csv`: one row per exported Google Trends series/term and time point, with query settings repeated for auditability.
- `trends-export-manifest.template.csv`: one row per actual export, with settings, timestamp, original filename, SHA-256 and comparison-export reference.
- `retail-observations.template.csv`: one row per product × retailer/location × observation time.
- `retail-sample-acceptance.template.csv`: coverage, missing-day, field, matching and rights acceptance checks by sample/product.
- `category-scope.md`: category-first discovery principles; brand-specific approval is not a gate for category-level insight discovery.
- `product-universe.template.csv`: transparent record of the representative multi-brand product/retailer sample, inclusion rationale and coverage gaps; it is not an approval request.
- `source-provenance.template.csv`: record source URL, access method, timestamps, attribution and applicable reuse notes; this is a provenance register, not a universal permission gate.
- `weekly-signal-review.template.csv`: log observed facts separately from hypotheses, alternatives, corroboration, confidence and human accept/reject decisions.
- `review-protocol.md`: evidence, quality and interpretation rules.
- `first-capture-runbook.md`: execution steps, hard stop gates, QA acceptance and baseline start conditions.

## Activation gates

1. Trends CSV exported manually from the official interface and original file retained; record export timestamp and exact settings.
2. Retail observations gathered from accessible public sources using appropriate access methods; paid/restricted feeds are optional enrichment.
3. Category taxonomy and sampling method documented before interpreting results; EAN/weight/variant checks validate item identity rather than require brand approval.
4. Review rejects missing provenance, ambiguous timestamps, duplicate records and unsupported shopper claims.
5. Four-week baseline starts after the first reproducible, lawfully obtained, QA-accepted category capture.

No scraper, credentials, external API calls, production writes or recurring capture are included in this kit.

## Baseline status record

**Current status: `not_started`.** This is a documentation/preparation kit, not a collected dataset.

| Gate | Status | Evidence required to change status |
|---|---|---|
| Google Trends capture | Pending | Original CSV exported manually from the official interface; exact query settings, geography, category, search type, date range, export timestamp and SHA-256 recorded |
| Source provenance | Pending | Public URL, access method, timestamps, attribution and relevant reuse limits documented; no bespoke permission gate for ordinary public-source discovery |
| Retail coverage | Pending | Multi-brand/category sample with documented EAN × retailer/store coverage and gaps; Lindt is optional, not a prerequisite |
| Reproducibility and QA | Pending | Repeat capture with source and observation timestamps, stable deduplication keys, documented gaps, verified pack weight and prices |
| Human signal review | Pending | Weekly review log with observed facts, hypotheses, alternatives, confidence, and accept/reject decision with reasons |
| Four-week baseline | **Not started** | All prerequisite gates accepted and fixed category queries, transparent sampling method, schedule and coverage documented |

No restricted source has been connected by this kit, no supplier request has been sent, no CSV observations have been collected, and no coverage or matching threshold has been measured. Do not change the baseline status based on a plan, a public product page, a preview deployment, or CI success alone.

### First weekly review record

For the first review, retain both accepted and rejected candidates. For each candidate record: stable signal ID; capture artifact/hash; source family and publication/observation dates; universe and method; observed fact; separate hypothesis; alternative explanations (seasonality, promotion, distribution, source coverage, sampling and syndicated reporting); independence/corroboration status; confidence; reviewer; decision and rationale. Contradictory signals remain visible. A single-source signal is labeled preliminary, not consolidated.

## Provider shortlist note

A public-source desk review identified Cnova Tech Data Market as a candidate for written coverage/sample diligence only. A separate Cnova Tech institutional licensing page describes feeds for commercial analytics products with SKU × source × day granularity and samples after NDA; this route appears more aligned with Pulse's intended use than assuming a self-service API trial grants the necessary rights. Both pages contain provider claims, not verified pilot results. SKU-level coverage, exact history, sample quality and contractual permissions remain unconfirmed. Brand-specific coverage is optional for category discovery. No account, trial, NDA, API call or supplier contact has been initiated. See `retail-provider-diligence.md` for the decision gates and questions.

