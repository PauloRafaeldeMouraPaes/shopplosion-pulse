# Next-level contracts: implementation status (2026-10-31)

Where the contract lives: inline in `pulse-workspace-v3.js`, between the markers
`PULSE_NEXT_LEVEL_CONTRACT_START` and `PULSE_NEXT_LEVEL_CONTRACT_END`. The block is dependency-free
(no DOM access) so `scripts/test-pulse-next-level-contract.js` evaluates it under Node; the browser
integration is covered by `scripts/browser-tests/pulse-next-level.spec.js`. Public API: `window.PULSE_NEXT_LEVEL`;
registries: `window.serie_historica`, `window.papel_ideal`, `window.PULSE_LOCAL_EVIDENCE`.

## Data contracts

### serie_historica (historical observations)

| Field | Rule |
|---|---|
| `period` | `AAAA`, `AAAA-MM` or `AAAA-MM-DD`; the granularity is recorded and never mixed in a comparison |
| `value` | a number, or a plain decimal string (`.` or `,` separator); `0` is a value; `null`/`''`/whitespace-only/`undefined` are absences (`incomplete`); booleans, arrays, hex, exponents, NaN and any other text are `invalid` |
| `metric`, `geography`, `source`, `provenance` | required, non-empty |
| `unit`, `methodology` | optional; stored as `[A DEFINIR]` when absent and reported as a limitation |
| `url`, `limitations[]` | optional |

Outcomes of `addHistoricalObservation`: `added`, `duplicate` (same period/metric/geography/source/unit/methodology
and same value), `conflict` (same key, different value: nothing is overwritten), `rejected` with
`reason: incomplete` (+`missing[]`) or `reason: invalid` (+`invalid[]`). Methodology is part of the identity, so the
same period can hold one observation per methodology (for example with and without seasonal adjustment).

`historicalSummary(metric, geography, {source, unit})` compares the two most recent observations of the
largest group that shares metric, geography, unit, source, methodology and granularity; between groups of equal
size the one with the most recent period wins, and the result says so. Statuses: `insufficient` (fewer than two),
`not_comparable` (+`mixedDimensions`, when no group has two), `observed_change` (with `delta`, `deltaPct`,
`direction`, `consecutive`, `yearOverYear` when the same month of the previous year exists, `count`, `excluded`
and `groups`, `limitations[]`, `observation` text). Observations left out because they belong to another
unit/source/methodology/granularity are counted in `excluded` and named in `limitations`, so a competing series
is never silently discarded. Every result carries `causal: false` and `interpretation: null`: the contract
reports variation, never explanation.

### papel_ideal (category role)

`setCategoryRole(category, role, evidence[], options)` stores a record with `status: 'heuristic'`,
`provenance: 'heurística; não é fato de mercado'`, the evidence references (id, source, provenance),
`evidenceQuality` (sem evidência / sem proveniência / proveniência parcial / proveniência completa),
`confidence` (only when `options.confidence` comes with `options.confidenceBasis`; otherwise `não declarada`),
`limitations[]`, `competingHypotheses[]` and `reviewConditions[]`. One record per category.

### PULSE_LOCAL_EVIDENCE (local evidence)

Required: `claim`, `source`, `geography`, `date` (ISO), `provenance`. `validateLocalEvidence` answers
`valid`, `incomplete` (+`missing[]`) or `rejected` (+`invalid[]`). Deduplication by `id` or by normalised
content (claim, source, geography, date); the 32-bit fingerprint only names the default id. `localEvidenceAsEvidence(item)` projects a record into the
`PULSE_EVIDENCE` vocabulary (fato, fonte, periodo, natureza, universo_observado, fonte_primaria,
fato_verificado_na_fonte = `[A DEFINIR]`) so the Inspector and `PULSE_EVIDENCE_MODEL.assess` read it.
Local evidence is never merged into the public `PULSE_EVIDENCE` array.

### Executive synthesis

`executiveSummary(items)` separates `evidence` (type `observed`), `interpretations`, `hypotheses`,
`implications` and `actions`. An action is emitted only when its `basis` names the `id` of an observed item;
otherwise it is listed under `unsupportedActions` with a warning. Observed items without `id` therefore
cannot support actions. Without observed evidence the status is `insufficient` and no action is emitted.
`observed` remains as an alias of `evidence`.

## Integration (Hoje canvas)

Section `#pv4-next-level` on the canonical Hoje view (`intelligence.html` and `index.html` without hash),
after `#signals` and before the Opportunity Canvas. States rendered per block: `loading`, `empty`,
`insufficient`, `not_comparable`, `available`, `heuristic`, `source_error`; form feedback: `added`,
`duplicate`, `conflict`, `rejected`. Records persist per browser in `localStorage` key `pulse:next-level:v1`
and restore on load (`restore()` reports `empty`, `restored`, `source_error`, `storage_error`). When `persist()`
fails after a successful registration the form feedback says so (`data-persist="storage_error"`), the record
stays valid for the session only. `reset({storage})` also removes the stored key; plain `reset()` keeps it.

## Integration contract for real sources

Three inputs exist today; none of them is a live server source.

1. Manual entry in the Hoje panel (per browser, with provenance fields). Only these rows are persisted in
   `localStorage`.
2. Public evidence records that declare an explicit numeric block. As of 2026-10-31 one record does:
   `ibge-pmc-super-agosto-2026` (IBGE, Pesquisa Mensal de Comércio, SIDRA table 8882, Brasil, activity
   "hipermercados, supermercados, produtos alimentícios, bebidas e fumo"), with 13 seasonally adjusted
   index values from 2025-08 to 2026-08 (2022=100). Every row declares metric, unit, methodology,
   geography, source, provenance and url; `loadFromEvidence` tags them with `evidenceId`, they are
   rebuilt from the dataset on every load and never written to the local store, so a revised release
   replaces the values instead of conflicting with a stale copy. A local row left in the store that collides
   with a public row (same identity, different value) is not restored; the panel says so in an explicit
   `conflict` note instead of dropping it silently. Because methodology is part of an observation's identity and the Hoje form does not ask for it, a
   row typed in the form (methodology `[A DEFINIR]`) never collides with a public row; the conflict note covers
   stored rows that carry the same methodology, such as copies left by an older version of the store. The panel renders one block per metric and geography
   (grouped with the contract's own normalisation); the block of an evidence-derived series links back to
   its item in the Inspector, and its year-over-year line states that it is a Pulse calculation over that
   series (for the IBGE block, the seasonally adjusted index), not the source's published year-over-year
   rate. The status line separates rows from the public dataset from rows registered in the browser.
3. A server-side source (Supabase) would need a table with the same required fields plus `industry_id`,
   read through the existing scoped client; the panel would keep the same states. Not implemented.

Block shape (the real one is generated, see below):

```js
{ id: 'ibge-pmc-super-agosto-2026', fonte: 'IBGE: PMC, tabela 8882 do SIDRA (agosto de 2026)', url: 'https://sidra.ibge.gov.br/tabela/8882',
  fonte_primaria: 'IBGE, SIDRA, tabela 8882; API consultada em 2026-10-31T22:48:51Z: https://apisidra.ibge.gov.br/values/...',
  serie_historica: [ { period: '2025-08', value: 109.41, metric: 'PMC: índice de volume de vendas, ..., com ajuste sazonal',
                       unit: 'número-índice (2022=100)', methodology: 'Índice de base fixa com ajuste sazonal (2022=100), tabela 8882 ...',
                       geography: 'Brasil', source: 'IBGE: PMC, tabela 8882 do SIDRA (agosto de 2026)', provenance: 'API SIDRA, consulta de ...', url: 'https://sidra.ibge.gov.br/tabela/8882' },
                     /* ... one row per month up to 2026-08 ... */ ] }
```

Free-text `periodo` strings such as `"2026-07 vs 2025-07"` are never parsed into series.

### Refreshing the IBGE series (automatic since 2026-11-04)

Each monthly release gets its own evidence item (`ibge-pmc-super-<mes>-<ano>`); earlier items stay as the
record of what the Pulse said from that release's captures, and the seasonally adjusted values of past
months legitimately differ between releases (IBGE revises the series at each publication).

1. `scripts/check-ibge-pmc-freshness.py` (weekly GitHub Action, Mondays) compares the latest item of each
   SIDRA 8882 series with the API and opens or refreshes the issue "Série IBGE PMC desatualizada no Pulse"
   when a month is missing. Earlier items are not compared.
2. `python3 scripts/update-ibge-pmc-evidence.py` captures, through `scripts/fetch-ibge-pmc-series.py`, the last
   13 adjusted months (variable 7170) and the four published variations (11708 to 11711) for the new month,
   the same month one year earlier and the three previous months, writes both raw responses to `docs/data`
   with the capture date in the name (byte for byte, SHA-256 in the companion `.capture.json`), and writes the
   item from fixed templates whose every number comes from those responses: the four variations in `fato`
   and `comparacao`, the range of the 13 indices and the same-month comparison in `interpretacao`, the
   previous year's month-on-month variation in `hipotese`, file names, timestamps, hashes and URLs in
   `fonte_primaria`, and the series block in `serie_historica`. It appends the item to the three layers with
   `scripts/sync-public-evidence.js` and exits 3 when the month is already published. `--dry-run` prints
   without writing; `--from-captures` rebuilds an item from saved captures (how the regression test checks
   that August 2026 regenerates exactly as published: `scripts/test-update-ibge-pmc-evidence.py`, in CI).
3. The weekly scheduled run of the Pulse opens the pull request, waits for CI, merges it and runs the guarded
   `pulse-ask-ai` deploy so the server sees the new month; nothing in that chain edits numbers by hand.
4. `node scripts/test-pulse-data-integrity.js index.html` (three-layer parity) and
   `node scripts/test-pulse-next-level-contract.js` (structural acceptance; the latest release is the
   comparable group of the series) must pass.

`scripts/fetch-ibge-pmc-series.py` remains the capture tool for other tables, variables or activities; its
printed block can still be pasted by hand for a series the generator does not cover.

## Not covered

- Statistical tests, seasonality adjustment or trend claims: the contract never says "tendência".
- Causal attribution of any kind.
- Automatic promotion of local evidence into the public base.
