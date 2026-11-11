# Chocolate pilot: autonomy rules, version 1

Decision of 2026-11-04 (Paulo): the Pulse is meant to run on its own; a person must not be asked to validate every step. The pilot kit was written with a human acceptance at each gate, so from this date those gates are rules, applied by `scripts/chocolate-pilot-autonomy.js` and checked in CI (`--check` in the regression workflow). What a person sees is one page, `AUTONOMY_STATUS.md`, and only its exception queue asks for anything.

The rules decide; they do not write. Facts, hypotheses, alternatives and corroboration are still written per row (today by the assistant, in the scheduled weekly run), and the rules only turn those fields into a decision. A rule can therefore be audited: the row says what was known, the rationale says which rule fired.

## 1. Google Trends exports

A captured slot in `trends-export-status-2026-10-15.csv` with `qa_status = pending_review` becomes `auto_accepted` when:

- `scripts/parse-google-trends-export.js --export-id <slot>` reports VALID (structure, registered settings, terms, window and the SHA-256 registered for the slot), and
- `scripts/trends-term-screen.js` runs on the file; terms it flags are copied into the notes as limitations, because a flag describes the term (section 3 of `trends-method-v2.md`), it does not reject the capture.

A parser rejection or a missing file puts the slot in the exception queue; nothing is accepted by hand.

## 2. Signal review rows

A row with `decision = pending_human_decision` in `public-source-review-*.csv` or `weekly-signal-review-*.csv` takes the first rule that matches:

| Rule | Condition | Decision |
|---|---|---|
| R1 | `hypothesis` starts with "Unexplained" | `follow_up_required`; owner `autonomy-agent`; due 14 days after the review week; the agent searches dated public sources, as done for the Lacta and chocolate amargo spikes |
| R2 | `hypothesis` starts with "Explained" or "Context" | `context_only` |
| R3 | `single_source_preliminary = true` | `preliminary_only` |
| R4 | corroborated and `confidence = high` | `consolidated` |
| R5 | corroborated and `confidence` medium or low | `preliminary_only` |

The writer of a row therefore has two obligations: start the hypothesis with "Unexplained" or "Explained" when the row is about an anomaly, and set `single_source_preliminary` honestly. The protocol's rule that a single source never consolidates a signal is R3.

Rows decided before 2026-11-04 (reviewer `unassigned`) keep their decision; the script ratifies them and notes where the rules alone would differ. Their open follow-ups were closed on 2026-11-04 with the reason in each row.

A `follow_up_required` row past its due date is an exception until it is explained (`context_only`) or re-decided.

## 3. Retail observations

A row with `review_status = preliminary` in `public-retail-snapshot-*.csv` becomes `accepted` when the same URL was captured again at least 7 days later with the same brand and net weight and a matching product name (token overlap of at least 60%, or one name contained in the other). The later row records both observation ids. A listing whose identity changed between captures is an exception: it is registered as a new listing, never silently replaced.

Files hashed by a review row are frozen: the rules never rewrite them, so the first retail snapshot keeps `preliminary` and the acceptance lives in the later capture.

Prices stay observations of their own day. No rule turns two snapshots into a trend.

## 3b. Transacted prices with EAN (NFC-e)

Since 2026-11-11 the pilot reads Economiza Alagoas (SEFAZ/AL), the state's free price-transparency service built on consumer electronic invoices, through `scripts/capture-economiza-alagoas.py`: once a week, seven pilot terms, the food category page of each, one request at a time with a 5 second pause, stopping on any HTTP error. Each card becomes a row with the GTIN, the invoice description, the two prices exactly as labelled on the page (valor unitário, última venda), how long ago the sale happened and the store (name, state registration, address). Only chocolate rows are kept; the decision is per GTIN, by the majority of its descriptions in the run, because each store writes the same barcode differently. Observations are written gzipped (`economiza-alagoas-<date>.csv.gz`) with a request log that records the SHA-256 of every raw page and of the observations.

What it is: transacted prices and which stores sold each EAN in the last seven days, in Maceió (the site's default view). What it is not: volume, share, Alagoas as a whole or Brazil. The official JSON API is not used: it needs a token requested by e-mail with a person's CPF, and the owner decided on 2026-11-11 not to request it. The pilot depends on no registration, contact or approval from the state; if the public page stops answering, the capture stops and the run reports it as an exception.

Baseline rule: the baseline is `collecting` while fewer than four distinct weeks have an NFC-e capture, and `started` from the fourth week on. Weeks are counted from the capture files, never from the date of the run.

## 4. Gates

`AUTONOMY_STATUS.md` computes every gate from the files: provenance gaps, Trends slot states, retail listings with and without EAN, reproducibility (Trends repeat exports and retail repeats), review decisions by type, and the baseline condition. The baseline stayed `not_started` while no source exposed an EAN, because the kit's own retail gate asks for coverage by EAN x store; since 2026-11-11 the NFC-e prices of section 3b cover that for Maceió, and the baseline follows the rule of section 3b.

## 5. What a person is asked

Only the exception queue: a rejected export, an unexplained spike without a dated explanation after 14 days, a listing that changed identity, a row the rules cannot decide. Everything else runs, is recorded, and can be audited later.

## 6. Where the rules run

- CI: `node scripts/chocolate-pilot-autonomy.js --check` fails the regression workflow when a pending row is older than 7 days, a decided row contradicts the rules, or the status page is stale.
- Weekly: the scheduled run captures Trends (when the personal browser is available), screens, writes the review rows, applies the rules, opens the pull request and merges it when every check passes; it reports only the exception queue.
