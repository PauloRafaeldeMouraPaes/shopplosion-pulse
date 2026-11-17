-- 1. Signed-in users must be able to evaluate the tenant check used by RLS policies.
--    Since 20260907040351 private.current_industry_id() was executable only by its owner, so every policy that
--    calls it raised "permission denied" for authenticated users (documents, industries, document_chunks,
--    analyses, ask_ai_events, rag_eval_*, investigations, shopper_knowledge, knowledge_updates, saved_evidence).
--    The private schema is not exposed by the API; the function returns only the caller's own industry.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_industry_id() TO authenticated;

-- 2. Evaluate auth.uid() and the tenant check once per statement instead of once per row (Supabase lint 0003).
DROP POLICY IF EXISTS investigations_industry_insert ON public.investigations;
CREATE POLICY investigations_industry_insert ON public.investigations FOR INSERT
  WITH CHECK (industry_id = (SELECT private.current_industry_id()) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS shopper_knowledge_industry_insert ON public.shopper_knowledge;
CREATE POLICY shopper_knowledge_industry_insert ON public.shopper_knowledge FOR INSERT
  WITH CHECK (industry_id = (SELECT private.current_industry_id()) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS knowledge_updates_insert ON public.knowledge_updates;
CREATE POLICY knowledge_updates_insert ON public.knowledge_updates FOR INSERT
  WITH CHECK (industry_id = (SELECT private.current_industry_id()) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS saved_evidence_insert ON public.saved_evidence;
CREATE POLICY saved_evidence_insert ON public.saved_evidence FOR INSERT
  WITH CHECK (industry_id = (SELECT private.current_industry_id()) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS saved_evidence_delete ON public.saved_evidence;
CREATE POLICY saved_evidence_delete ON public.saved_evidence FOR DELETE
  USING (industry_id = (SELECT private.current_industry_id()) AND created_by = (SELECT auth.uid()));

-- 3. Covering indexes for foreign keys (Supabase lint 0001).
CREATE INDEX IF NOT EXISTS document_change_events_current_version_idx ON public.document_change_events(current_version_id);
CREATE INDEX IF NOT EXISTS document_change_events_previous_version_idx ON public.document_change_events(previous_version_id);
CREATE INDEX IF NOT EXISTS intelligence_signals_created_by_idx ON public.intelligence_signals(created_by);
CREATE INDEX IF NOT EXISTS intelligence_source_fetch_runs_industry_idx ON public.intelligence_source_fetch_runs(industry_id);
CREATE INDEX IF NOT EXISTS investigations_created_by_idx ON public.investigations(created_by);
CREATE INDEX IF NOT EXISTS knowledge_updates_created_by_idx ON public.knowledge_updates(created_by);
CREATE INDEX IF NOT EXISTS saved_evidence_created_by_idx ON public.saved_evidence(created_by);
CREATE INDEX IF NOT EXISTS shopper_knowledge_created_by_idx ON public.shopper_knowledge(created_by);