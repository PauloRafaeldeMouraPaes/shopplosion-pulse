# Google Trends method v2: term construction, screening and comparability

Status: **registered method, 2026-11-04; amendments v2.1 of the same day are marked in place**. It governs every Google Trends set registered from this date. Sets A and B (version 1) stay exactly as captured on 2026-11-03 and accepted on 2026-11-04; their limitations are explained, not repaired, by this document. Tool: `scripts/trends-term-screen.js` (self-test in the regression workflow).

## 1. The problem this version fixes

A search term is only a chocolate signal when most of the searches behind it are about chocolate. Version 1 registered bare brand names and discovered two ways that fails:

- **Dual meaning.** "Garoto" is an ordinary Portuguese word. In the accepted Set B capture its median week is 62 on a 0-100 scale while the category term "chocolate" sits at 39, and its Easter week is only 1.41 times its median. The level of that series measures the word, not the brand; only its variation is usable.
- **Multi-category brand.** "Nestlé" covers milk, coffee, infant food and pet food. Its Easter lift (2.17) is close to the category's, but its 2026 maximum fell in the week of 16 August, outside any chocolate season.

A third limitation is mechanical: a comparison view is normalised so that the strongest term peaks at 100, so weaker terms in the same view are compressed to "<1". Three Set A terms ("chocolate amargo", "chocolate ao leite", "chocolate sem açúcar") are "<1" in 44% to 100% of weeks for that reason, not because nobody searches them.

The same failures apply to any brand whose name is a common word (Bis, Baton, Talento, Prestígio, Alpino, Sonho de Valsa, Ouro Branco, Diamante Negro) or whose owner sells well beyond chocolate (Nestlé, Arcor, Hershey's). The rule below is general; Garoto and Nestlé are only the first cases.

## 2. Term construction rules

- **R1. Bare name by default.** A brand is registered as its plain name when it passes the screen in section 3 (in version 1: Lindt, Lacta, Ferrero Rocher).
- **R2. Scoped union when flagged.** A brand flagged by the screen is registered as one Google Trends search term made of chocolate-qualified forms joined with `+` (Trends reads `+` as "or"): `chocolate <marca> + bombom <marca> + barra <marca>`. The three qualifiers are fixed and identical for every scoped brand, so scoped brands stay comparable with each other. `<marca>` is written exactly as the brand writes it; when the pre-registration test (section 4, T4) shows that searchers commonly drop a diacritic, the unaccented spelling is added to each form (`chocolate nestlé + chocolate nestle + ...`). Trends matches the words of a form in any order, so "bombom garoto" also captures "caixa de bombom garoto". *Amendment v2.1 (2026-11-04, after the pre-registration tests):* the rule was first written with a fourth qualifier, `ovo de páscoa <marca>`; Google Trends rejects a search term longer than about 100 characters (HTTP 400 at 120 characters, accepted at 97), so a brand with two spellings cannot carry four qualifiers. The fourth form contributed at most 2 index points for Garoto in test view T_G and its Easter signal is already carried by the other forms, so it was dropped for every scoped brand, not only for Nestlé.
- **R3. Constructions are not level-comparable.** A scoped union sums several query forms; a bare name captures everything at once. In a view that mixes both, compare timing, shape and each term's own change over time; rank levels only among terms built the same way. When a level ranking across all brands is needed, register two views (bare brands; scoped brands), each with up to five items.
- **R4. Single-term exports for compressed terms.** A term that is "<1" in more than half of the weeks of a multi-term view is also exported alone (one term per view), which gives it its own 0-100 scale. Single-term exports support shape and seasonality analysis of that term only; their level means nothing outside the export.
- **R5. Topic cross-check.** Google's knowledge-graph Topic for the company (for example "Garoto (Empresa)") disambiguates by meaning rather than by words. Topics are never mixed with search terms in one view (version 1 rule kept); a Topic is exported in a separate view and used only to validate a scoped union (T3 below).
- **R6. Versioning.** A change to a registered set, including one qualifier, creates a new set id (B2, B3, ...) with the rationale recorded before export. The previous set stays as captured. Looking at a curve and then changing the term is not a rationale.

## 3. Screen: declared criteria

`scripts/trends-term-screen.js` applies three criteria to every term column of a weekly export, using the one regularity chocolate demand in Brazil reliably shows: a peak in the week before Easter Sunday and a smaller one before Christmas. Weeks are Google's, starting on Sunday; the Easter week is the one that starts seven days before Easter Sunday; the Christmas window is the week that holds 24 December and the week before it; the last week of a file is dropped when the export happened before it ended; "<1" counts as 0.5.

| Criterion | Definition | Pass |
|---|---|---|
| `easter_lift` | mean Easter-week value over the years in the file / median week | >= 2.0 |
| `peak_timing` | in every calendar year with >= 40 weeks in the file and a maximum >= 5, the year's maximum week falls in the Easter window (Easter week +/- 1) or the Christmas window | every such year |
| `low_volume` | share of weeks reported as "<1" | <= 50% |

A term that fails any criterion is **flagged**, never silently dropped: a brand goes to R2, a compressed category term goes to R4, and the flag is recorded with the set. The screen also lists **off-season spikes** (weeks outside the seasonal band, value >= 5, >= half the year's maximum and >= twice the median) for human review; they are not a criterion.

Calibration disclosure: the thresholds were fixed on 2026-11-04 with the version 1 captures already in hand. The category term "chocolate" has an Easter lift of 2.34 in the 5-year capture, so 2.0 sits just under the category's own seasonality; 5 and 50% are resolution floors. They apply unchanged to every later set; changing them is a method version.

Results on the accepted version 1 captures (5-year windows, exported 2026-11-03):

| Set | Term | easter_lift | peak_timing | low_volume | Verdict |
|---|---|---|---|---|---|
| A | chocolate | 2.34 | 5/5 | 0% | PASS |
| A | barra de chocolate | 7.40 | 5/5 | 0% | PASS |
| A | chocolate amargo | 1.20 | unresolved | 44% | FLAGGED (R4) |
| A | chocolate ao leite | 2.80 | unresolved | 90% | FLAGGED (R4) |
| A | chocolate sem açúcar | 1.00 | unresolved | 100% | FLAGGED (R4) |
| B | Lindt | 7.12 | 5/5 | 0% | PASS |
| B | Lacta | 9.44 | 5/5 | 0% | PASS (spike 2023-10-15 = 44 to review) |
| B | Garoto | 1.41 | 5/5 | 0% | FLAGGED (R2) |
| B | Nestlé | 2.17 | 4/5 (2026 max on 2026-08-16) | 0% | FLAGGED (R2) |
| B | Ferrero Rocher | 12.95 | 5/5 | 0% | PASS |

The screen reproduces the reviewer's judgement at acceptance (Garoto and Nestlé flagged, the other three brands clean) from the data alone.

## 4. Pre-registration test for a scoped union

Before a scoped set is registered, each scoped union is tested in the intended view and the outcome is recorded with the registration. The tests and thresholds are declared here, before any test view is opened:

- **T1. Volume.** In the intended 5-year view, the scoped union is "<1" in at most 10% of complete weeks.
- **T2. Screen.** The scoped union passes the three criteria of section 3 in the 5-year view.
- **T3. Agreement with the Topic.** Pearson correlation between the scoped union and the company Topic (separate view, same window) >= 0.70 over complete weeks. When Google offers no company Topic, T3 is recorded as not applicable. *Amendment v2.1 (2026-11-04, decided after seeing the Nestlé result):* a Topic that itself fails the screen of section 3 is not a chocolate reference, so T3 is then recorded with its value but does not decide registration; T1 and T2 decide.
- **T4. Spelling.** For a brand written with a diacritic, the unaccented spelling is tested alongside; it is added to the union when its median week is at least 20% of the accented spelling's.

A union that fails T1 or T2 is not registered in that form; the brand is then exported alone (R4) and the failure is recorded. Test views are kept as evidence (URL, UTC timestamp, SHA-256) labelled `test`; they are not baseline exports and never enter the baseline.

## 5. Analysis and comparability rules

- Inside one export: shape, timing and each term's own change over time are valid; level ranking only among same-construction terms (R3).
- Across exports: indices are never joined or compared. Compare scale-free statistics instead (Easter lift, peak week, year-on-year ratio of the same term inside one export).
- Easter alignment: Easter moves between 22 March and 25 April, so year-on-year comparisons of the Easter season use Easter-relative weeks (E-4 to E+1), not calendar weeks. Christmas uses calendar weeks.
- Partial last week: excluded whenever the export date is earlier than the end of that week (Google weeks run Sunday to Saturday). Exports for the baseline are made on Monday or later, so the previous week is complete.
- Sampling noise: Trends serves a sample, and the same view exported twice can differ. The reproducibility gate of the kit is met when a repeat export of the same view within seven days differs from the first by at most 2 index points at the median of the absolute weekly differences and at most 5 at their maximum, per term; a larger difference marks the view as unstable and it is not used for the baseline until it stabilises.
- Off-season spikes: before any spike becomes a signal, check for a campaign, a product launch, news or a recall in that week and corroborate with an independent source; a spike that stays unexplained is reported as unexplained.
- Nothing in Trends measures sales, share, preference, switching or price response (version 1 rule kept).

## 6. Consequences for the pilot

- Set B (version 1) stays the registered bare-name benchmark, accepted with the Garoto and Nestlé flags; it is not used to rank those two brands by level.
- **Set B2 (registered and captured 2026-11-04; accepted by Paulo the same day with the limitations in the status file):** Lindt, Lacta, `chocolate garoto + bombom garoto + barra garoto`, `chocolate nestlé + chocolate nestle + bombom nestlé + bombom nestle + barra nestlé + barra nestle`, Ferrero Rocher; Brazil, All categories (cat=0), Web Search, Search terms; last 5 years and last 12 months. Export ids `GT-CHOC-B2-5Y`, `GT-CHOC-B2-12M`.
- **Set A single-term exports (registered and captured 2026-11-04; accepted by Paulo the same day; `chocolate amargo` stays flagged until its 2026 spike is explained):** `chocolate amargo`, `chocolate ao leite`, `chocolate sem açúcar`, each alone, last 5 years, same settings. Export ids `GT-CHOC-AS-AMARGO-5Y`, `GT-CHOC-AS-LEITE-5Y`, `GT-CHOC-AS-SEMACUCAR-5Y`. Shape and seasonality only.
- The slots, hashes and notes are in `trends-export-status-2026-10-15.csv`; the test views are in `tests/` with `tests/trends-test-views-2026-11-04.csv`. Every new capture goes through the parser, the screen and human acceptance like version 1.

## 7. Test and capture log

All views below: Brazil, All categories, Web Search, Search terms unless stated; captured in Paulo's personal Chrome on 2026-11-04 between 04:33 and 04:38 UTC as the byte-for-byte response of the chart-download CSV endpoint; the week of 2026-11-01 was partial and is excluded from every statistic. Files and SHA-256 in `tests/trends-test-views-2026-11-04.csv`.

**Pre-registration tests (section 4)**

| Test | View | Result | Verdict |
|---|---|---|---|
| T1 volume | Garoto union (4 qualifiers) in T_G and in the candidate B2 view | 0% of weeks "<1" | PASS |
| T1 volume | Nestlé unions (accented, unaccented) in T_N and in the candidate B2 view | 0% of weeks "<1" | PASS |
| T2 screen | Garoto union | Easter lift 7.13 (T_G) and 6.32 (candidate B2); 5/5 years; bare "Garoto" in the same view: lift 1.45, FLAGGED | PASS |
| T2 screen | Nestlé unions | Easter lift 5.47 accented, 5.17 unaccented; 5/5 years; bare "Nestlé": 2026 maximum in August, FLAGGED; bare "nestle": lift 1.96, FLAGGED | PASS |
| T3 Topic | Garoto union vs Topic "Garoto (Empresa)" (`/m/06nhwc`) | r = 0.93 (bare "Garoto" vs Topic: 0.76) | PASS |
| T3 Topic | Nestlé union vs Topic "Nestlé (Empresa)" (`/m/01556g`) | r = 0.63 (4 qualifiers) and 0.57 (registered 3-qualifier union); the Topic itself fails the screen (lift 2.12, 2026 maximum in January) | below 0.70; recorded, amendment v2.1 applied |
| T4 spelling | "Nestlé" vs "nestle"; accented vs unaccented union | unaccented median 2.87x the accented; unions 2.33x | both spellings included |
| T4 spelling | "ovo de páscoa garoto" vs "ovo de pascoa garoto" | identical in 248 of 261 weeks | qualifier spelling irrelevant; brand token spelling matters |
| limit | 8-form union (120 characters) | HTTP 400 from the explore API; 97 characters accepted | three qualifiers (amendment v2.1) |

**Reproducibility (section 5), repeat export one day after the version 1 capture**

| Set | Term | median abs. diff. | max abs. diff. | Verdict |
|---|---|---|---|---|
| A | chocolate / barra de chocolate / amargo / ao leite / sem açúcar | 1 / 0 / 0 / 0 / 0 | 5 / 1 / 0 / 0 / 0 | PASS |
| B | Lindt / Lacta / Nestlé / Ferrero Rocher | 0 / 0 / 0 / 0 | 5 / 3 / 1 / 2 | PASS |
| B | Garoto (bare) | 1 | 12 (week of 2021-10-31: 65 vs 53; thirteen other weeks differ by 4 to 6) | UNSTABLE |

The bare "Garoto" column of Set B v1 is the only unstable series: a high-volume common word whose sampling noise is of the same size as the brand's own Easter signal. This adds to the version 1 flag; the column is kept for shape only.

**Captures registered on 2026-11-04 (screen on complete weeks)**

| Export | Term | easter_lift | peak_timing | low_volume | Verdict |
|---|---|---|---|---|---|
| GT-CHOC-B2-5Y | Lindt | 6.55 | 5/5 | 0% | PASS |
| GT-CHOC-B2-5Y | Lacta | 9.10 | 5/5 | 0% | PASS (spike 2023-10-15 = 64 to review) |
| GT-CHOC-B2-5Y | chocolate garoto + bombom garoto + barra garoto | 5.88 | 5/5 | 0% | PASS (spike 2022-10-16 = 18 to review) |
| GT-CHOC-B2-5Y | Nestlé union (two spellings, three qualifiers) | 4.87 | 5/5 | 0% | PASS |
| GT-CHOC-B2-5Y | Ferrero Rocher | 11.00 | 5/5 | 0% | PASS |
| GT-CHOC-B2-12M | all five | 5.22 to 11.11 | 1/1 | 0% | PASS |
| GT-CHOC-AS-AMARGO-5Y | chocolate amargo (alone) | 2.79 | 4/5: 2026 maximum on 2026-05-03 (100), 2026-04-12 at 59 | 0% | FLAGGED: unexplained 2026 spike, review before use |
| GT-CHOC-AS-LEITE-5Y | chocolate ao leite (alone) | 4.58 | 5/5 | 0% | PASS |
| GT-CHOC-AS-SEMACUCAR-5Y | chocolate sem açúcar (alone) | 2.39 | 5/5 | 0% | PASS |

Exported alone, "chocolate ao leite" and "chocolate sem açúcar" show the chocolate seasonality cleanly (0% low-volume weeks against 90% and 100% inside the Set A comparison), which confirms that their Set A flags were a compression artefact, not absence of searches.

**Leads for the spike review (not conclusions).** Google's "rising related queries" for Lacta over the five-year window include "lacta felipe neto", "felipe neto bis lacta" and "ações da lacta hoje", a candidate explanation for the week of 2023-10-15 to verify against dated sources. Nothing was found in the interface for the Nestlé 2026 spikes or for "chocolate amargo" in April and May 2026.

**Acceptance.** Paulo accepted Set B2 (both windows) and the three single-term exports on 2026-11-04 (São Paulo), after reviewing the five-year Set B2 chart, with the limitations recorded in `trends-export-status-2026-10-15.csv`. Set B2 is now the brand set for analysis; Set B v1 stays as the bare-name benchmark.
