# Public-source-first capture policy — Chocolate

## Operating rule

Do not make brand approval, retailer approval, supplier contact, a paid feed, or a bespoke permission request a universal gate for category discovery. Start with information already accessible to the public and relevant to the category.

Potential public-source families:
- Google Trends relative search interest.
- Dated public articles and news coverage.
- Public recipes and cooking content.
- Public reviews and product Q&A where visible without special access.
- Public product listings and visible prices, pack sizes, promotions and availability.
- Public industry and commodity indicators, labeled as context rather than shopper behavior.

## Capture requirements

For each observation, record:
- source URL and publisher/platform;
- source family and the specific fact observed;
- publication date and the time the observation was captured;
- exact query/settings or page context;
- short evidence excerpt or structured value needed to support the claim;
- attribution/citation details and any material reuse limitation;
- content fingerprint and deduplication key where useful.

Use manual collection or normal public interfaces for the initial run. Do not make a private API, paid provider, account creation or supplier response a prerequisite. Do not defeat technical access controls, ignore applicable restrictions, or collect unnecessary personal/sensitive information.

## Retail signals

Begin with visible, publicly accessible listings across a transparent multi-brand sample. Record the exact displayed price, currency, pack size, promotion conditions, availability wording, retailer, URL and capture time. Calculate price per 100 g only when the displayed price and net weight are clear. A missing listing or missing field is unknown, not zero and not proof of out-of-stock.

Public listings are snapshots unless actual historical observations are available. Do not invent a historical time series from current pages or search snippets. If historical retail coverage proves insufficient, report the limitation and continue the shopper-side category baseline while evaluating optional alternatives.

## Interpretation

- Separate shopper signals, retail offer signals, and industry/supply context.
- Corroborate across genuinely independent source families; syndicated copies are not independent.
- Mark a single-source candidate as preliminary.
- Do not infer purchases, sell-out, preference, elasticity or brand switching from search interest or visible shelf prices alone.
- The four-week baseline starts after the first real, reproducible, QA-accepted category capture. It does not wait for brand approval or a paid data supplier.
