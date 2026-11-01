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

The historical series has no connected server source. Two inputs exist today:

1. Manual entry in the Hoje panel (per browser, with provenance fields).
2. Public evidence records that declare an explicit numeric block:

```js
{ id: 'exemplo', fonte: 'Órgão', url: 'https://...', fonte_primaria: 'tabela X', universo_observado: 'Brasil',
  serie_historica: [ { period: '2026-06', value: 101.2, metric: 'índice de volume', unit: 'índice (2022=100)', methodology: 'PMC' },
                     { period: '2026-07', value: 102.0, metric: 'índice de volume', unit: 'índice (2022=100)', methodology: 'PMC' } ] }
```

`loadFromEvidence(PULSE_EVIDENCE)` ingests only such blocks; free-text `periodo` strings such as
`"2026-07 vs 2025-07"` are never parsed into series. As of 2026-10-31 no public record declares a block,
so the panel reports zero derived observations. A server-side source (Supabase) would need a table with the
same required fields plus `industry_id`, read through the existing scoped client, and the panel would keep
the same states; this is not implemented.

## Not covered

- Statistical tests, seasonality adjustment or trend claims: the contract never says "tendência".
- Causal attribution of any kind.
- Automatic promotion of local evidence into the public base.
