# Retail data provider — pilot diligence request

Optional paid-data diligence only. No request has been sent. Do not block the public-source pilot on a supplier response.

## Optional paid-feed scope

This document is an optional diligence checklist only; it is not a prerequisite to category discovery. Start with public, directly accessible retail listings and broader category signals. Consider a paid feed only if it materially improves historical depth or coverage.

- Category: chocolate in Brazil.
- Intended analysis: historical shelf/online offer observations, price per 100 g, pack size, promotion and availability over time.
- If evaluating a provider, use a transparent multi-brand basket selected by format, pack size, price tier and retailer coverage. Lindt may be included where available but is not required, and no brand's approval defines the category universe.
- Geography: record actual coverage; use at least two retailer networks where feasible.
- Desired time series: daily observations where available, with full available history and explicit gaps.

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

Record supplier response date, contact/reference, permitted sample identifier, license version, coverage table, failed checks, cost and reviewer decision. Until evaluated, status is `not_evaluated`; the public-source category baseline may proceed independently. Do not initiate paid plans, supplier contact or production integration without a separate decision.

## Public-source desk review — Cnova Tech Data Market (candidate only)

**Review status: `public_claims_only`; not evaluated or approved.** This is a desk review of the provider's own public page, not a test of the API, sample, license or actual coverage. No account was created, no trial quota was consumed, and no supplier was contacted.

Public page reviewed: https://datamarket.cnovatech.com.br/conectar

Claims relevant to the pilot, as stated by the provider:
- Product lookup by EAN and dimensions for brand, retailer/store, state and channel.
- Daily collection with a capture date on each price, and historical price series described as up to 180 days.
- Coverage described as 250+ stores, with e-commerce and delivery channels.
- Brand examples include Lacta and Garoto; the page does **not** establish Lindt coverage for the requested EANs.
- Public plan page advertises a 14-day test with 50 requests and no credit card; the listed Starter plan is R$ 999/month. These are provider-published terms and must be rechecked before any decision.

Preliminary fit: **worth requesting a written sample and coverage statement**, because the advertised EAN-level daily history is aligned with the intended price baseline. This is not a recommendation to sign up or buy.

Unresolved diligence questions before any account/trial/API use:
1. Confirm in writing the exact EAN × retailer/store coverage for 5–10 buyer-approved chocolate products, including Lindt if available and at least four comparable products.
2. Confirm the actual historical start date and whether 180 days are available for each exact EAN/store, not just as a general product feature.
3. Obtain a permitted sample or written approval for a sample, including price, promotion mechanics, net weight, availability semantics, source URL, capture timestamp and repeat-observation behavior.
4. Obtain the applicable license/terms version and written confirmation of retention of raw observations, derived analytics, citations, and display inside a commercial analytics product. The public page describes allowed product display but also restricts reselling the API or replicating the base as a competing data service; clarify that Pulse's proposed use is permitted.
5. Confirm whether data are store-level or only network-level for the selected products, and document gaps/coverage separately from zero price or out-of-stock.
6. Reconfirm all fees, tax, overages, trial restrictions and cancellation terms before using the trial.

Decision remains `not_evaluated` until a human reviewer records the supplier response, license version, sample ID/hash, per-EAN coverage and acceptance-test results. The published claims are not observed pilot data and must not be entered into the baseline.

## Additional route found — institutional data licensing (public-page review)

Reviewed on 2026-10-15: https://cnovatech.com.br/parcerias-de-dados

This is a distinct route from the self-service Data Market API. The provider's institutional page describes licensed feeds for data/analytics products, SKU × source × day granularity, EAN matching, versioned history advertised since January 2026, daily updates, API/CSV/Parquet delivery, and a sample after NDA. The page states that scope, history depth and fields are set contractually and that the source list and detailed coverage are shared under NDA.

**Assessment:** this institutional route is more aligned with Pulse as a commercial analytics product than assuming a self-service API trial grants all needed rights. It is still only a provider claim, not a recommendation or authorization. The page's generic coverage figures do not prove Lindt or any pilot EAN is present. An NDA, sample request, data license or commercial commitment has not been initiated.

If the owner later authorizes supplier contact, request a written, non-binding scoping response first and require:
- sample coverage by buyer-approved EAN × retailer/source × date, including Lindt if available and comparable chocolate SKUs;
- exact start/end dates, missing days, store/source granularity and historical versioning;
- field dictionary for observed price, regular/promo price, promotion mechanics, net weight, availability, source URL and collection timestamp;
- written permission to retain raw records, create derived indicators, cite provenance and display outputs in Pulse to its customers, with explicit limits on model training, redistribution, retention/deletion and derivative data;
- all fees, NDA scope, sample restrictions, contract duration, renewal, cancellation and service commitments.

Do not sign an NDA, submit business/contact details, provide EAN lists, activate a trial, or accept terms without explicit approval. If approved, evaluate the institutional sample and self-service API as separate offers; do not assume their licensing or coverage is interchangeable.

## Draft supplier inquiry (not sent)

**Subject:** Validação de cobertura e amostra autorizada — preços de chocolates por EAN no Brasil

Olá, equipe Data Market,

Estamos avaliando uma fonte de dados para um piloto de inteligência de mercado na categoria de chocolates no Brasil. Antes de criar conta, consumir cota de teste ou contratar qualquer plano, precisamos confirmar a cobertura e os direitos de uso para um conjunto pequeno de produtos.

Poderiam responder por escrito aos pontos abaixo?

1. Podemos enviar uma lista de 5–10 EANs aprovados por nós para verificar a cobertura por EAN × rede/loja × canal? Precisamos incluir produtos Lindt e ao menos quatro comparáveis de Lacta, Garoto e/ou Nestlé.
2. Para cada EAN coberto, vocês conseguem informar a primeira data histórica disponível, a frequência real das observações, a cobertura por loja e eventuais lacunas?
3. A amostra pode ser fornecida antes de ativarmos a conta ou consumirmos as 50 requisições do trial? Se sim, em quais condições e com que autorização de uso?
4. Quais campos estão disponíveis para preço regular/promocional, mecânica/condições de promoção, peso líquido, moeda, disponibilidade, URL de origem e timestamp de coleta?
5. Poderiam compartilhar a versão vigente dos termos/licença e confirmar se podemos reter observações brutas, produzir análises derivadas e exibir resultados/citações em um produto comercial de analytics, sem revender a API nem replicar a base?
6. Quais são o custo total, impostos, limites, overages, cancelamento e restrições após o trial?

Nosso critério é avaliar a qualidade da amostra e os direitos de uso antes de qualquer integração. Não precisamos de acesso amplo nesta etapa.

Obrigado(a),
Equipe do piloto de inteligência de mercado

**Status:** rascunho para revisão; não enviado. Substituir/validar a lista de EANs antes de qualquer envio.

