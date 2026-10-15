# Google Trends query plan — Chocolate pilot

Status: **pre-registered plan; no observations collected**. This document fixes the first query sets before viewing/exporting results, reducing the risk of choosing terms because they show an interesting curve.

## Capture protocol

- Interface: https://trends.google.com/trends/explore/
- Official export guidance: Google Trends Help, “Export, embed, and cite Trends data” — https://support.google.com/trends/answer/4365538?hl=en. Export the chart's CSV from the interface; preserve the original file and cite Google Trends when reusing the data.
- Provenance fields to record with each export: query text/type, geography, time window, category, search type, export timestamp, Explore URL, raw filename and SHA-256.
- Treat the plotted values as normalized relative search interest, not absolute search counts or observed purchase behavior. Do not merge independently normalized exports into one numeric series.
- Geography: Brazil (BR); do not mix national and state-level series.
- Time windows: last 5 years for seasonal context and last 12 months for recent context. Export each window separately.
- Category: Food & Drink if the interface offers a consistent category for every item in the comparison; otherwise use the same broader setting for every item and record it.
- Search type: Web Search.
- Query type: use **Search term** for every item in a set. Do not mix Search term and Topic in one comparison. If a Topic is later tested, create a separately named set.
- Export each comparison from one Explore view so the relative index is comparable within that view. Do not compare index values across separate exports as though they share a common absolute scale.
- Save the untouched CSV, Explore URL, export timestamp (UTC), settings, and SHA-256. Keep each window separate.
- If a query is too low-volume, retain the zero/insufficient result as a limitation; do not substitute a new term after seeing results without recording a versioned rationale.

## Fixed query sets

Direct Explore links are provided as convenience entry points. Before export, confirm every UI setting below and record the actual URL/settings; the links themselves are not evidence that a CSV was exported.

### Registered direct links

- Set A, Brazil, past 5 years: https://trends.google.com/trends/explore?date=today%205-y&geo=BR&q=chocolate,barra%20de%20chocolate,chocolate%20amargo,chocolate%20ao%20leite,chocolate%20sem%20a%C3%A7%C3%BAcar
- Set A, Brazil, past 12 months: https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=chocolate,barra%20de%20chocolate,chocolate%20amargo,chocolate%20ao%20leite,chocolate%20sem%20a%C3%A7%C3%BAcar
- Set B, Brazil, past 5 years: https://trends.google.com/trends/explore?date=today%205-y&geo=BR&q=Lindt,Lacta,Garoto,Nestl%C3%A9,Ferrero%20Rocher
- Set B, Brazil, past 12 months: https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=Lindt,Lacta,Garoto,Nestl%C3%A9,Ferrero%20Rocher

The links do not guarantee that Google will retain the requested search-term interpretation or category selection; verify the interface before export.
### Set A — category language
Use these five Search terms together in one comparison:
1. chocolate
2. barra de chocolate
3. chocolate amargo
4. chocolate ao leite
5. chocolate sem açúcar

Interpret as relative search interest for the selected terms, not category size, people, purchase, or preference. Terms have different breadth and intent; do not sum their indices.

### Set B — brand search interest
Use these five Search terms together in one comparison:
1. Lindt
2. Lacta
3. Garoto
4. Nestlé
5. Ferrero Rocher

This is a brand-query benchmark only. It is vulnerable to differences in brand awareness, ambiguity, spelling, campaigns, and product portfolios. It is not market share or switching evidence. If the interface suggests a Topic instead of a Search term, do not silently accept it; record the exact selection or create a separate Topic comparison.

### Set C — category needs and usage occasions (exploratory extension)

These terms are candidate dimensions to test only after the core Set A capture is preserved. Record each exact term and the rationale before export; do not choose terms retrospectively because a curve looks compelling. Possible dimensions include:
- chocolate vegano
- chocolate sem açúcar
- chocolate sem lactose
- chocolate alto teor de cacau
- presente chocolate
- receita com chocolate

This extension is a separate, versioned set because terms differ in intent and volume. It is not a market-size measure and must not be summed with Set A. If low-volume terms return zero, retain that limitation.

## Review and false-positive controls

- Compare the same calendar periods across the five-year view; mark Easter, Valentine's Day, Mother's Day, Christmas, and other obvious seasonal peaks before interpreting changes.
- Do not label a single peak or a change in normalized index as an emerging shopper shift without checking seasonality, sampling/low-volume behavior, and independent evidence.
- A zero index is not proof of no demand.
- Do not infer sales, sell-out, preference, price elasticity, or brand switching from Trends alone.
- Record the reviewer decision for each candidate: accept, reject, or preliminary, with reason and source links.

## Baseline gate

This plan does not start the four-week baseline. The baseline remains `not_started` until the first real export is retained with settings, timestamp, hash, and QA approval. Subsequent captures must repeat the fixed query sets and settings; any changes require a versioned note rather than silently replacing the plan.
