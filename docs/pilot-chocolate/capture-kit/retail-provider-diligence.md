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

