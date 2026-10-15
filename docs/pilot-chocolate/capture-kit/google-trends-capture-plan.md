# Google Trends capture execution plan — Chocolate Brazil

Status: **queries pre-registered; no CSV export captured yet**. This document is a repeatable manual procedure, not a Trends dataset.

## Query set A — category and need-state language

- [Brazil, past 5 years](https://trends.google.com/trends/explore?date=today%205-y&geo=BR&q=chocolate,barra%20de%20chocolate,chocolate%20amargo,chocolate%20ao%20leite,chocolate%20sem%20a%C3%A7%C3%BAcar)
- [Brazil, past 12 months](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=chocolate,barra%20de%20chocolate,chocolate%20amargo,chocolate%20ao%20leite,chocolate%20sem%20a%C3%A7%C3%BAcar)

Terms: `chocolate`, `barra de chocolate`, `chocolate amargo`, `chocolate ao leite`, `chocolate sem açúcar`.

## Query set B — brand context (diagnostic only)

- [Brazil, past 5 years](https://trends.google.com/trends/explore?date=today%205-y&geo=BR&q=Lindt,Lacta,Garoto,Nestl%C3%A9,Ferrero%20Rocher)
- [Brazil, past 12 months](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=Lindt,Lacta,Garoto,Nestl%C3%A9,Ferrero%20Rocher)

Terms: `Lindt`, `Lacta`, `Garoto`, `Nestlé`, `Ferrero Rocher`. Do not interpret this as category demand; brand queries are diagnostic context only.

## Fixed settings for all four exports

- Geography: Brazil (`BR`).
- Search type: Web Search.
- Query type: Search term (not Topic); verify this in the UI before export.
- Category: All categories; do not change it between exports.
- Compare only terms within the same export and settings. Separate five-year and twelve-month exports are separate normalized indices; do not concatenate or compare their index levels as absolute volume.
- Export the CSV manually from the official interface. Retain the original unchanged.
- For each export, fill `trends-export-manifest.template.csv`: query set, terms, settings, date range, export timestamp UTC, source URL, raw filename, SHA-256, comparison export ID and reviewer.
- Add rows to `trends-observations.template.csv` only from the actual CSV. Never transcribe an approximate graph value or invent a missing/zero value.
- If Google Trends shows insufficient data or an ambiguous query interpretation, record the limitation and do not force a numeric series.

## Acceptance checklist

- [ ] UI settings match this plan and are recorded.
- [ ] Four original CSVs saved unchanged in a controlled workspace.
- [ ] SHA-256 calculated for each original file.
- [ ] Query interpretation and any sampling/low-volume warnings recorded.
- [ ] Reviewer confirms no index-level comparison across separately normalized exports.
