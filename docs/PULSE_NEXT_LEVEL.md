# Pulse Next-Level Reconciliation

## Status (2026-10-31)
- Implemented and tested: historical series, category role, local evidence and executive synthesis contracts (`docs/NEXT_LEVEL_IMPLEMENTATION.md`), integrated into the Hoje canvas with explicit states.
- Reconciled separately: published-artifact identity, external scripts, duplicate listeners and invisible characters (`docs/PUBLISHED_ARTIFACT_RECONCILIATION.md`).
- Historical series: first real public source connected on 2026-10-31 (IBGE PMC, SIDRA table 8882, 13 seasonally adjusted months embedded in evidence item `ibge-pmc-super-agosto-2026`, refreshed by `scripts/fetch-ibge-pmc-series.py`). Still open: study extraction UX copy audit; server-side (Supabase) source for historical series.

## Scope
- Historical series (`serie_historica`) with explicit period comparability and no causal inference.
- Category role (`papel_ideal`) as an auditable heuristic, not a factual market claim.
- Local evidence (`PULSE_LOCAL_EVIDENCE`) with provenance and geography.
- Executive synthesis that separates evidence, interpretation, hypothesis and action.
- Study extraction audit and UX copy aligned with the actual parser capability.
- Removal of residual external JS dependencies and duplicate question-suggestion listeners.
- Byte-level integrity check for zero-width/invisible characters before merge.

## Safety rules
- Never invent historical values or local evidence.
- Preserve source provenance.
- Mark unavailable fields explicitly.
- Do not infer causality from temporal deltas.
- Do not claim upload extraction capabilities beyond what the parser actually supports.
