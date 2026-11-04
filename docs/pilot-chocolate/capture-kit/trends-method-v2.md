# Google Trends method v2: term construction, screening and comparability

Status: **registered method, 2026-11-04**. It governs every Google Trends set registered from this date. Sets A and B (version 1) stay exactly as captured on 2026-11-03 and accepted on 2026-11-04; their limitations are explained, not repaired, by this document. Tool: `scripts/trends-term-screen.js` (self-test in the regression workflow).

## 1. The problem this version fixes

A search term is only a chocolate signal when most of the searches behind it are about chocolate. Version 1 registered bare brand names and discovered two ways that fails:

- **Dual meaning.** "Garoto" is an ordinary Portuguese word. In the accepted Set B capture its median week is 62 on a 0-100 scale while the category term "chocolate" sits at 39, and its Easter week is only 1.41 times its median. The level of that series measures the word, not the brand; only its variation is usable.
- **Multi-category brand.** "Nestlé" covers milk, coffee, infant food and pet food. Its Easter lift (2.17) is close to the category's, but its 2026 maximum fell in the week of 16 August, outside any chocolate season.

A third limitation is mechanical: a comparison view is normalised so that the strongest term peaks at 100, so weaker terms in the same view are compressed to "<1". Three Set A terms ("chocolate amargo", "chocolate ao leite", "chocolate sem açúcar") are "<1" in 44% to 100% of weeks for that reason, not because nobody searches them.

The same failures apply to any brand whose name is a common word (Bis, Baton, Talento, Prestígio, Alpino, Sonho de Valsa, Ouro Branco, Diamante Negro) or whose owner sells well beyond chocolate (Nestlé, Arcor, Hershey's). The rule below is general; Garoto and Nestlé are only the first cases.

## 2. Term construction rules

- **R1. Bare name by default.** A brand is registered as its plain name when it passes the screen in section 3 (in version 1: Lindt, Lacta, Ferrero Rocher).
- **R2. Scoped union when flagged.** A brand flagged by the screen is registered as one Google Trends search term made of chocolate-qualified forms joined with `+` (Trends reads `+` as "or"): `chocolate <marca> + bombom <marca> + barra <marca> + ovo de páscoa <marca>`. The four qualifiers are fixed and identical for every scoped brand, so scoped brands stay comparable with each other. `<marca>` is written exactly as the brand writes it; when the pre-registration test (section 4, T4) shows that searchers commonly drop a diacritic, the unaccented spelling is added to each form. Trends matches the words of a form in any order, so "bombom garoto" also captures "caixa de bombom garoto".
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
- **T3. Agreement with the Topic.** Pearson correlation between the scoped union and the company Topic (separate view, same window) >= 0.70 over complete weeks. When Google offers no company Topic, T3 is recorded as not applicable.
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
- **Set B2 (proposed, pending section 4):** Lindt, Lacta, scoped Garoto, scoped Nestlé, Ferrero Rocher; Brazil, All categories (cat=0), Web Search, Search terms; last 5 years and last 12 months. Export ids `GT-CHOC-B2-5Y`, `GT-CHOC-B2-12M`.
- **Set A single-term exports (proposed):** `chocolate amargo`, `chocolate ao leite`, `chocolate sem açúcar`, each alone, last 5 years, same settings. Export ids `GT-CHOC-AS-AMARGO-5Y`, `GT-CHOC-AS-LEITE-5Y`, `GT-CHOC-AS-SEMACUCAR-5Y`. Shape and seasonality only.
- Registration of these slots, the test outcomes and the captures are recorded in `trends-export-status-2026-10-15.csv` and in section 7 of this document when they happen. Every new capture goes through the parser, the screen and human acceptance like version 1.

## 7. Test and capture log

(empty until the pre-registration tests of section 4 are run)
