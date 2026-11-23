-- Topic terms of each industry, read by the signal workers: relevance gate, evidence quotes and discovery feeds.
-- Until now the topic was fixed in the worker code for one category. A term matches anywhere in a word, without
-- accents or case. An industry with no terms receives no external signals (the gate is closed by default).
-- Only the service role writes this column: the table has row level security with a single SELECT policy.
ALTER TABLE public.industries ADD COLUMN IF NOT EXISTS signal_topic_terms text[] NOT NULL DEFAULT '{}'::text[];
COMMENT ON COLUMN public.industries.signal_topic_terms IS 'Topic terms of the industry for external signals, lower case without accents; matched anywhere in a word. Empty: the industry receives no external signals.';

-- The pilot industry keeps the topic its workers used until now.
UPDATE public.industries
   SET signal_topic_terms = ARRAY['chocolate','cacau','pascoa','bombom','bombon','confeit','achocolatad']
 WHERE slug = 'pulse-pilot-chocolate-public' AND signal_topic_terms = '{}'::text[];