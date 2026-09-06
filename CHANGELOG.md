# Changelog

## 2026-09-06 — Ask AI privado com Gemini Free Tier
- Migrated private server-side generation from Anthropic to Google Gemini API.
- Added `GEMINI_API_KEY` as the server-only provider secret.
- Set `gemini-2.5-flash` as the default configurable generation model.
- Preserved JWT authentication, Supabase RLS retrieval and tenant isolation.
- Preserved evidence citations `[E1]`, `[E2]` and deterministic grounding rules.
- Removed the runtime dependency on Anthropic for Ask AI generation.
- Documented Free Tier limits and the new production secret/deploy flow.

## 2026-09-05 — Ask AI privado server-side
- Added private tenant retrieval workspace with deterministic evidence ranking.
- Added server-side `pulse-ask-ai` Edge Function with JWT + RLS context.
- Added server-side LLM generation with provider secret kept outside the browser.
- Added evidence citations from retrieved private chunks to generated answers.
- Added deterministic audit preventing provider secrets or direct provider calls in browser code.
- Documented production secret configuration and Edge Function deployment.

## 2026-09-04 — Multi-tenant industry workspace
- Added authenticated industry workspace after Supabase login.
- Added tenant-scoped document upload/list/access using private Storage and RLS.
- Added tenant-scoped analysis listing and explicit industry identity in the workspace.
- Hardened login/recovery redirects to the authenticated workspace.
- Extended deterministic multi-tenant audit to cover the new workspace and routing.
- Documented the remaining A-versus-B operational isolation acceptance test.

## 2026-08-27 — Evidence-to-Insight v3
- Added structured claims extracted from study sentences.
- Added claim polarity as a descriptive signal only.
- Added cross-study potential contradiction detection by shared topic.
- Added explicit evidence-to-claim context for Ask AI.
- Added browser regression coverage for contradictory evidence.
- Preserved local-only processing, provenance, deduplication and removable evidence.
