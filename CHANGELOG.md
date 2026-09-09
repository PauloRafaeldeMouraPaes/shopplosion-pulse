# Changelog

## 2026-09-09 — Release traceability
- Aligned the RAG evaluation Edge Function source with the deployment manifest.
- Versioned the exact deployed document index worker for production traceability.
- Preserved tenant-scoped retrieval and server-side authentication boundaries.

## 2026-09-06 — Ingestão privada de PDF v1
- Added browser-local PDF text extraction using PDF.js 4.10.38.
- Reused the existing tenant-scoped `document_chunks` ingestion path.
- Added `[Página N]` markers so PDF evidence retains page provenance.
- Preserved private Storage, Supabase RLS and server-side Gemini generation.
- Added deterministic browser regression coverage for the PDF hook and secret hygiene.
- Documented the OCR boundary: image-only scanned PDFs remain outside v1.

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
