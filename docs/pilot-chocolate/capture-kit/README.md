# Chocolate pilot — capture kit (pre-production)

Status: **pre-production; exploratory public-source observations captured**. This directory includes dated secondary-source notes and one-day public retail listing snapshots. Filenames use São Paulo local capture date 2026-10-14; UTC-date fields use 2026-10-15. Exact capture clock times were not recorded. These are preliminary observations, not a validated trend or a started four-week baseline.

## Files

- `trends-observations.template.csv`: one row per exported Google Trends series/term and time point, with query settings repeated for auditability.
- `trends-export-manifest.template.csv`: one row per actual export, with settings, timestamp, original filename, SHA-256 and comparison-export reference.
- `retail-observations.template.csv`: one row per product × retailer/location × observation time.
- `retail-sample-acceptance-2026-10-14.csv`: seven preliminary row-level QA decisions; all remain exploratory until identity, exact timestamps and reuse scope are verified.
- `retail-sample-acceptance.template.csv`: blank schema for future QA runs.
- `category-scope.md`: category-first discovery principles; brand-specific approval is not a gate for category-level insight discovery.
- `public-source-first-policy.md`: public evidence collection and citation workflow; paid feeds and supplier contact are optional.
- `public-source-capture-2026-10-14.csv`: twenty-four dated public-source records across surveys, retail price context, macro context, cocoa supply and recipe content.
- `public-source-capture-2026-11-04.csv`: five dated records that explain the two off-season Google Trends spikes (Lacta, October 2023: Bis sponsorship of Felipe Neto and the boycott that followed; `chocolate amargo`, April-May 2026: the chocolate labelling law, Lei 15.404/2026) plus the law's thresholds and effective date (May 2027) as a structural watch item.
- `public-source-capture-2026-11-10.csv`: five dated records from the weekly run of 2026-11-09 (São Paulo) that explain the remaining off-season spikes listed by the term screen (Garoto recall of 2022-10-18; Nestlé infant-formula recall of 2026-01-07 and the false factory-closure claims of 2026-08-17 to 20, both on the bare term of Set B v1; Black Friday 2025 behind the Lindt week of 2025-11-23).
- `public-source-provenance-2026-10-14.csv`: provenance and reuse notes for each source used or planned.
- `trends-query-plan.md`: pre-registered category and brand query sets with direct Explore links; no export is represented as captured.
- `autonomy-rules-v1.md` and `AUTONOMY_STATUS.md`: from 2026-11-04 the gates are rules applied by `scripts/chocolate-pilot-autonomy.js` (checked in CI); the status page is generated and its exception queue is the only thing a person is asked to look at.
- `trends-method-v2.md`: method version 2 (2026-11-04): declared term screen (`scripts/trends-term-screen.js`), scoped unions for brands whose name is a common word or spans categories, single-term exports for compressed terms, Topic cross-check, comparability and reproducibility rules, pre-registration tests.
- `tests/`: Google Trends test and repeat views used by method v2 (pre-registration tests and the reproducibility check), listed with hashes in `tests/trends-test-views-2026-11-04.csv`; evidence only, never baseline exports.
- `trends-export-status-2026-10-15.csv`: four required exports and their explicit capture/QA states.
- `google-trends-manual-export-checklist.md`: step-by-step manual export, hash, provenance and QA instructions; no export is implied.
- `repeatable-capture-cadence.md`: weekly source-capture procedure and explicit gates before starting the four-week baseline.
- `public-source-review-2026-10-14.csv`: eleven preliminary signal candidates, alternative explanations and follow-up decisions.
- `public-retail-snapshot-2026-10-14.csv`: seven dated, publicly visible product listing snapshots from two retailers, with unit prices and promotion mechanics.
- `public-retail-snapshot-2026-11-04.csv`: repeat capture of the same seven listings on 2026-11-04 (UTC clock time per row, price block hashed in `content_sha256`): Pão de Açúcar moved five Lacta/Garoto 80g bars to a straight -42%/-30% (R$7.99) and the Nestlé Classic 80g from R$9.69 promoted to R$14.49 without promotion; Super Muffato's Lacta 80g went from R$6.15 promoted to R$7.20 regular.
- `first-public-source-capture-report.md`: summary, limitations and next capture sequence.
- `shopper-context-follow-up-2026-10-15.md`: supplemental Worldpanel by Numerator context on cross-category budget, promotion and channel behavior; explicitly `context_only`, not chocolate-specific evidence.
- `product-universe-initial-2026-10-14.csv`: initial seven-row exploratory product × retailer register with inclusion rationale and coverage gaps; EAN gaps are explicit, not treated as approval gates.
- `product-universe.template.csv`: blank schema for future product-sample additions.
- `source-provenance.template.csv`: record source URL, access method, timestamps, attribution and applicable reuse notes; this is a provenance register, not a universal permission gate.
- `weekly-signal-review.template.csv`: log observed facts separately from hypotheses, alternatives, corroboration, confidence and human accept/reject decisions.
- `weekly-signal-review-2026-11-02.csv`: review of the week of 2026-11-02 to 2026-11-08: six candidates written on 2026-11-04 from the accepted Google Trends captures, plus seven rows written in the weekly run of 2026-11-09 (year-on-year comparison of the latest complete week per term inside each export, and the dated explanations of the spikes listed by the screen); decisions are applied by `scripts/chocolate-pilot-autonomy.js` (rules v1). No new export was captured in that run (linked browser unavailable), so its facts come from the exports of 2026-11-03 and 2026-11-04.
- `review-protocol.md`: evidence, quality and interpretation rules.
- `first-capture-runbook.md`: execution steps, hard stop gates, QA acceptance and baseline start conditions.

## Activation gates

1. Trends CSV exported manually from the official interface and original file retained; record export timestamp and exact settings.
2. Retail observations gathered from accessible public sources using appropriate access methods; paid/restricted feeds are optional enrichment.
3. Category taxonomy and sampling method documented before interpreting results; EAN/weight/variant checks validate item identity rather than require brand approval.
4. Review rejects missing provenance, ambiguous timestamps, duplicate records and unsupported shopper claims.
5. Four-week baseline starts after the first reproducible, lawfully obtained, QA-accepted category capture.

No private API, paid provider, account creation or supplier response is a prerequisite to the public-source discovery run.

## Baseline status record

**Current status: `not_started`.** This is an exploratory desk-capture kit, not a longitudinal or representative dataset.

| Gate | Status | Evidence required to change status |
|---|---|---|
| Google Trends capture | Computed in `AUTONOMY_STATUS.md` (nine slots accepted: v1 by Paulo, v2 by Paulo; later slots by `autonomy-rules-v1.md`) |
| Source provenance | Computed in `AUTONOMY_STATUS.md` (documented 2026-11-04; sources whose terms were not located stay at citation-and-summary use) |
| Retail coverage | Computed in `AUTONOMY_STATUS.md`: open while no page exposes an EAN (a data-source decision: licensed feed or catalogue with EANs) |
| Reproducibility and QA | Computed in `AUTONOMY_STATUS.md`: Trends repeat exports and retail repeats applied by rule |
| Signal review | Rules v1 decide every row (`autonomy-rules-v1.md`); exceptions only in `AUTONOMY_STATUS.md` |
| Four-week baseline | **Not started** | All prerequisite gates accepted and fixed category queries, transparent sampling method, schedule and coverage documented |

Provenance gaps recorded on 2026-11-04 (`public-source-provenance-2026-10-14.csv`): the Pão de Açúcar terms page could not be opened (footer link without URL; only the on-page notice that prices are valid for the current day); the Super Muffato site was outside the kit browser permissions; the terms pages of FGV, BNB, UOL, Folha, Globo, InfoMoney, Foodnews and Mercado do Cacau were not located by search, so those sources stay at citation-and-summary use only; Agência Brasil's reproduction policy (journalistic reuse with attribution, commercial reuse via EBC licensing) and Google's Trends attribution guidance were read and recorded; the 2026-10-14 captures have no clock time.

No restricted source has been connected by this kit and no supplier request has been sent. The desk-capture CSVs record secondary public-source observations only; no multi-retailer observation panel or longitudinal retail time series has been collected; the first direct retail snapshot covers two retailers; the secondary price aggregator is a separate benchmark and may overlap with the same underlying supermarket sites. Do not change the baseline status based on a plan, a public product page, a preview deployment, or CI success alone.

### Signals published to the public base

A signal leaves the kit only after the rules decide it, and the public base never names a brand (contract in `scripts/test-pulse-ask-ai.js`). Published on 2026-11-04 (`scripts/sync-public-evidence.js`, three layers):

| Kit signal | Public evidence id | What was published |
|---|---|---|
| SIG-CHOC-012 (consolidated, weekly review of 2026-11-02) | `google-trends-chocolate-sazonalidade-pascoa-2022-2026` | Easter week as the yearly search peak for the category (5 of 5 years) and for the five brands as "five brands followed by the pilot" (24 of 25 brand-years), ratios computed on `GT-CHOC-A-5Y` and `GT-CHOC-B2-5Y` |
| SIG-CHOC-016 (context_only, explained by the labelling law) and the AS-AMARGO screen note | `lei-15404-2026-rotulagem-chocolate` | Lei 15.404/2026: names, minimum cocoa content, front-of-pack percentage, effective May 2027; the 2026 "chocolate amargo" peak dated to the law's news weeks |

### First weekly review record

For the first review, retain both accepted and rejected candidates. For each candidate record: stable signal ID; capture artifact/hash; source family and publication/observation dates; universe and method; observed fact; separate hypothesis; alternative explanations (seasonality, promotion, distribution, source coverage, sampling and syndicated reporting); independence/corroboration status; confidence; reviewer; decision and rationale. Contradictory signals remain visible. A single-source signal is labeled preliminary, not consolidated.

## Provider shortlist note

A public-source desk review identified Cnova Tech Data Market as a candidate for written coverage/sample diligence only. A separate Cnova Tech institutional licensing page describes feeds for commercial analytics products with SKU × source × day granularity and samples after NDA; this route appears more aligned with Pulse's intended use than assuming a self-service API trial grants the necessary rights. Both pages contain provider claims, not verified pilot results. SKU-level coverage, exact history, sample quality and contractual permissions remain unconfirmed. Brand-specific coverage is optional for category discovery. No account, trial, NDA, API call or supplier contact has been initiated. See `retail-provider-diligence.md` for the decision gates and questions.

