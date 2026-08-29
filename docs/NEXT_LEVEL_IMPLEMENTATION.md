# Next-Level Implementation Status

This branch is the staging point for the next Pulse reconciliation pass.

Pending implementation contracts:

- `serie_historica`: optional historical observations with period, value and source provenance.
- `papel_ideal`: transparent category-role heuristic; must be labeled as heuristic.
- `PULSE_LOCAL_EVIDENCE`: local evidence records with geography and source provenance.
- Executive synthesis: evidence → interpretation → hypothesis → implication → next action.
- Study extraction: parser capability must be reflected accurately in UI copy and tests.
- External JS: final `index.html` must contain no external project scripts.
- Question suggestions: exactly one active handler for suggestion clicks.
- Invisible characters: reject zero-width/BOM/control anomalies inside HTML tag syntax.

Validation gate:

1. JavaScript syntax check.
2. Single-file contract.
3. Data/provenance contract.
4. Regression tests.
5. Browser Smoke.
6. Netlify publication check.
