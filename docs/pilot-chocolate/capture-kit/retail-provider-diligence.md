# Retail data provider — pilot diligence request

Use this checklist to request a written answer and a small authorized sample before creating an account, accepting terms, consuming trial quota, or signing a contract. No request has been sent by this document.

## Pilot scope

- Category: chocolate in Brazil.
- Intended analysis: historical shelf/online offer observations, price per 100 g, pack size, promotion and availability over time.
- Initial sample: 5–10 verified EANs, including Lindt products available in Brazil and at least four comparable products from Lacta, Garoto and/or Nestlé. The buyer/operator must supply or approve the actual EAN list; do not invent EANs.
- Geography: at least two retailer networks and specified São Paulo stores/regions, subject to actual coverage.
- Desired time series: daily observations where available, including the full available historical window and explicit gaps.

## Questions requiring written answers

1. Which of the supplied EANs are covered today? Return exact EAN, product title, brand, variant and net weight, separated by retailer/store.
2. Is Lindt coverage confirmed for the Brazilian retailers requested? Which exact EANs and retailers? Do not answer only with a general brand list.
3. What is the earliest available observation date for each EAN × retailer/store? Is the history complete, sampled or subject to retention limits?
4. Which timestamps are supplied: source publication time, observation/crawl time, ingestion time, or more than one? State timezone and precision.
5. Are regular price, observed price, promotional price, promotion mechanics/eligibility, currency, net weight, and availability included as distinct fields? Provide the data dictionary.
6. What does missing data mean? Can the feed distinguish not observed, unavailable, out of stock, discontinued and not covered?
7. How are variants, multipacks, unit price and pack-weight changes represented? Is the EAN verified against the retailer listing?
8. What are the API rate limits, trial limits, refresh frequency, uptime/support commitments and any additional charges?
9. Do the license and terms expressly allow retention of raw observations, derived analytics, source citations and use inside a commercial analytics product? Specify restrictions on redistribution, customer-facing display, model training and deletion.
10. Can the provider supply a small sample under written permission before account creation or quota consumption? Please identify any NDA or other prerequisites.
11. What is the total cost after trial, including setup, tax, minimum term, overages and cancellation conditions?

## Sample acceptance test

Accept the source for a limited proof of concept only if the sample supports all applicable checks:

- At least 80% of the fixed EAN list matched correctly across at least two retailer networks (proposed threshold, not an observed result).
- Every retained price has a verifiable EAN, net weight, currency, retailer/store and observation timestamp.
- Regular and promotional prices are distinguishable; promotion conditions are supplied or explicitly marked not stated.
- Availability semantics and missing-record behavior are documented.
- A repeat sample has no unexplained changes for identical observation keys.
- Written rights cover the intended retention and commercial analytical use.
- Coverage results are reported by brand and retailer; no inference is made from missing EANs.

## Decision record

Record supplier response date, contact/reference, permitted sample identifier, license version, coverage table, failed checks, cost and reviewer decision. Until approved, status is `not_evaluated` and no API call, paid plan, production integration or four-week retail baseline may begin.
