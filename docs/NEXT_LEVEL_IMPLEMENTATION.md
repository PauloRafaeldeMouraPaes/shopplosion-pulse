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
| `value` | finite number; `0` is a value, `null`/`''`/`undefined`/NaN is an absence and is rejected |
| `metric`, `geography`, `source`, `provenance` | required, non-empty |
| `unit`, `methodology` | optional; stored as `[A DEFINIR]` when absent and reported as a limitation |
| `url`, `limitations[]` | optional |

Outcomes of `addHistoricalObservation`: `added`, `duplicate` (same period/metric/geography/source/unit and
same value), `conflict` (same key, different value: nothing is overwritten), `rejected` with
`reason: incomplete` (+`missing[]`) or `reason: invalid` (+`invalid[]`).

`historicalSummary(metric, geography, {source, unit})` compares the two most recent observations of the
largest group that shares metric, geography, unit, source, methodology and granularity. Statuses:
`insufficient` (fewer than two), `not_comparable` (+`mixedDimensions`), `observed_change` (with `delta`,
`deltaPct`, `direction`, `consecutive`, `yearOverYear` when the same month of the previous year exists,
`limitations[]`, `observation` text). Every result carries `causal: false` and `interpretation: null`:
the contract reports variation, never explanation.

### papel_ideal (category role)

`setCategoryRole(category, role, evidence[], options)` stores a record with `status: 'heuristic'`,
`provenance: 'heurística; não é fato de mercado'`, the evidence references (id, source, provenance),
`evidenceQuality` (sem evidência / sem proveniência / proveniência parcial / proveniência completa),
`confidence` (only when `options.confidence` comes with `options.confidenceBasis`; otherwise `não declarada`),
`limitations[]`, `competingHypotheses[]` and `reviewConditions[]`. One record per category.

### PULSE_LOCAL_EVIDENCE (local evidence)

Required: `claim`, `source`, `geography`, `date` (ISO), `provenance`. `validateLocalEvidence` answers
`valid`, `incomplete` (+`missing[]`) or `rejected` (+`invalid[]`). Deduplication by `id` or by content
fingerprint (claim, source, geography, date). `localEvidenceAsEvidence(item)` projects a record into the
`PULSE_EVIDENCE` vocabulary (fato, fonte, periodo, natureza, universo_observado, fonte_primaria,
fato_verificado_na_fonte = `[A DEFINIR]`) so the Inspector and `PULSE_EVIDENCE_MODEL.assess` read it.
Local evidence is never merged into the public `PULSE_EVIDENCE` array.

### Executive synthesis

`executiveSummary(items)` separates `evidence` (type `observed`), `interpretations`, `hypotheses`,
`implications` and `actions`. An action is emitted only when observed evidence exists and the action's
`basis` points to it; otherwise it is listed under `unsupportedActions`. Without observed evidence the
status is `insufficient` and no action is emitted. `observed` remains as an alias of `evidence`.

## Integration (Hoje canvas)

Section `#pv4-next-level` on the canonical Hoje view (`intelligence.html` and `index.html` without hash),
after `#signals` and before the Opportunity Canvas. States rendered per block: `loading`, `empty`,
`insufficient`, `not_comparable`, `available`, `heuristic`, `source_error`; form feedback: `added`,
`duplicate`, `conflict`, `rejected`. Records persist per browser in `localStorage` key `pulse:next-level:v1`
and restore on load (`restore()` reports `empty`, `restored`, `source_error`, `storage_error`).

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
   replaces the values instead of conflicting with a stale copy. The panel renders one block per metric
   and geography; the block of an evidence-derived series links back to its item in the Inspector.
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

### Refreshing the IBGE series (maintainer procedure)

1. `python3 scripts/fetch-ibge-pmc-series.py --out docs/data/ibge-pmc-8882-v7170-a90672-<AAAA-MM-DD>.json`
   queries the SIDRA API (table 8882, variable 7170, index type 56734, activity 90672, last 13 months),
   validates codes, periods and values, writes the raw response with its SHA-256 and prints the block.
   Values are rounded to two decimals in the block; the raw file keeps the API precision. The script never
   edits evidence files and is not run by CI.
2. Paste the block into the item in the three layers (`index.html` embedded JSON, `pulse-public-evidence.js`,
   `supabase/functions/pulse-ask-ai/public-evidence.ts`), update `fato`, `periodo`, `fonte_primaria` and
   `fato_verificado_na_fonte` from the same response, and add or update the `PULSE_SOURCES` entry.
3. `node scripts/test-pulse-data-integrity.js index.html` (three-layer parity) and
   `node scripts/test-pulse-next-level-contract.js` (structural acceptance of the embedded series) must pass.

The seasonally adjusted series is revised by IBGE at each release, so a refresh legitimately changes past
values; the raw capture files are the audit trail of what each version of the dataset was built from.

## Not covered

- Statistical tests, seasonality adjustment or trend claims: the contract never says "tendência".
- Causal attribution of any kind.
- Automatic promotion of local evidence into the public base.
