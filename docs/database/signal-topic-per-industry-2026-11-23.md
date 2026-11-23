# Signal topic per industry (2026-11-23)

Migration `013_industry_signal_topic_terms.sql` (production version `20261123123859`).

## Why

The owner decided on 2026-11-20 that Pulse must scale to other categories. The three signal workers fixed the topic of one category in their code: the relevance gate and the evidence quote rule in `quality.mjs`, and the filter of discovery feeds in the source worker. A second industry would have received no signal of its own category.

## Change

1. Database: `public.industries.signal_topic_terms text[] NOT NULL DEFAULT '{}'`. The pilot industry (`pulse-pilot-chocolate-public`) receives the terms its workers already used: `chocolate, cacau, pascoa, bombom, bombon, confeit, achocolatad`.
2. Workers: the signal worker, the deterministic backstop and the source worker read the terms of each industry. A term matches anywhere in a word, without accents or case. An industry without terms receives no external signals: the gate is closed by default.
3. Nothing in the workers names a category (`scripts/validate-external-signal-quality.mjs` fails if one does).

Who can write the column: only the service role. `public.industries` has row level security with a single policy, `industries_member_select` (SELECT, own industry). A signed-in member reads the terms of its own industry and cannot change them.

## Behaviour for the pilot industry

Old and new rules compared on 666 texts of the repository (public evidence, capture kit, test fixtures), 1,419 sentences: 0 differences in the deterministic candidates and 0 in the relevance gate. In the quote rule, one real sentence changes: "ovos" alone no longer counts as topic (ambiguous for other categories); with "Páscoa" in the sentence or in the previous one it still passes. Two declared deltas: the count of mentions in the source text now uses all the terms (before: three of them), and discovery feeds no longer keep an article that only says "doces".

## Acceptance

Staging (`Pulse Staging`, migration `20261123014033`, synthetic fixtures, rolled back), 20 of 20:

- new rows start with no terms; the data step updates the pilot slug once and is a no-op when repeated; another industry stays empty; NULL is rejected;
- a member sees only its own industry, reads its own terms and cannot update its own or another industry's terms (0 rows); `private.current_industry_id()` and `public.auth_industry_context()` keep working;
- a member of another industry cannot see the pilot industry;
- `anon` sees no industry and updates 0 rows;
- the service role reads `id, signal_topic_terms` of the active industries (the query of the workers) and can set terms;
- the rollback statement drops the column and members still read their industry afterwards.

Security Advisor in staging after the migration: no new finding.

Production after the release: the pilot industry has the seven terms; the two test industries have none; 14 active signals and 0 events in the previous two days as the starting point for the check after the worker deploy.

## Rollback

First redeploy the three workers from the commit before this change (they do not select the column). Then:

```sql
ALTER TABLE public.industries DROP COLUMN IF EXISTS signal_topic_terms;
```

Dropping the column while the new workers are deployed makes them answer `industries_query_failed` and record nothing.

## Adding an industry of another category

Set its terms with the service role (lower case, no accents), for example `UPDATE public.industries SET signal_topic_terms = ARRAY['cafe','capsula'] WHERE slug = '...';`, and register its sources in `intelligence_sources`.
