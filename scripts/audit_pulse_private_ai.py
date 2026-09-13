#!/usr/bin/env python3
"""Deterministic audit for the private Ask AI server-side boundary."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ASK = ROOT / "ask.html"
FN = ROOT / "supabase" / "functions" / "pulse-ask-ai" / "index.ts"
CFG = ROOT / "supabase" / "config.toml"

errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

ask = ASK.read_text(encoding="utf-8") if ASK.exists() else ""
fn = FN.read_text(encoding="utf-8") if FN.exists() else ""
cfg = CFG.read_text(encoding="utf-8") if CFG.exists() else ""

require(ASK.exists(), "ask.html missing")
require(FN.exists(), "private Ask AI Edge Function missing")
require(CFG.exists(), "supabase/config.toml missing")

require("functions.invoke('pulse-ask-ai'" in ask or 'functions.invoke("pulse-ask-ai"' in ask,
        "ask.html does not invoke pulse-ask-ai")
require("ANTHROPIC_API_KEY" not in ask and "GEMINI_API_KEY" not in ask,
        "LLM provider secret appears in browser code")
require("SUPABASE_SECRET_KEYS" not in ask and "SERVICE_ROLE" not in ask.upper(),
        "Supabase secret/service key appears in browser code")
require("Authorization" in fn and "Bearer " in fn, "Edge Function does not require Authorization")
require("verify_jwt = true" in cfg, "pulse-ask-ai is not configured with verify_jwt=true")
require("global: { headers: { Authorization: authorization } }" in fn,
        "Edge Function does not propagate caller JWT to Supabase client")
require("from('document_chunks')" in fn, "Edge Function does not retrieve private chunks")
require(".eq('industry_id', profile.industry_id)" in fn,
        "Private chunk retrieval is not explicitly scoped to the authenticated industry")
require("String(chunk.industry_id) === String(profile.industry_id)" in fn,
        "Retrieved chunks lack defense-in-depth tenant filtering before LLM use")
require("select('id,filename,industry_id')" in fn,
        "Document lookup does not return industry_id for defense-in-depth validation")
require("String(documentMap[chunk.document_id].industry_id) === String(profile.industry_id)" in fn,
        "Evidence documents lack defense-in-depth tenant validation")
require("generativelanguage.googleapis.com/v1beta/models/" in fn, "Gemini API endpoint missing")
require("GEMINI_API_KEY" in fn, "Gemini secret is not server-side configured")
require("PULSE_LLM_MODEL" in fn, "LLM model is not configurable")
require("citations" in fn and "ref:" in fn, "Evidence citations are not returned")
require("service_role" not in fn.lower() and "supabase_secret_key" not in fn.lower(),
        "Edge Function contains a service-role/secret-key path")

# RLS is the authoritative tenant boundary. Natural-language heuristics such as
# "foreignIndustryMention" are explicitly forbidden because they caused false positives.
require("foreignIndustryMention" not in fn and "foreignIndustryInAnswer" not in fn and "industryNameMatches" not in fn,
        "Ask AI still contains heuristic industry-name scope guards")
require("tenant security authority" in fn or "Tenant scope is enforced by the authenticated Supabase session + RLS." in fn,
        "Ask AI does not document RLS as the tenant security authority")

# Guard against accidental direct browser provider calls.
require(not re.search(r"fetch\(['\"]https://(?:api\\.anthropic\\.com|generativelanguage\\.googleapis\\.com)", ask),
        "Browser code directly calls an LLM provider")

if errors:
    print("PRIVATE AI AUDIT: FAIL")
    for error in errors:
        print(f"FAIL: {error}")
    sys.exit(1)

print("PRIVATE AI AUDIT: PASS")
print("PASS: browser delegates generation to pulse-ask-ai")
print("PASS: provider secret remains server-side")
print("PASS: Edge Function requires JWT and propagates caller auth")
print("PASS: retrieval is explicitly scoped to the authenticated industry")
print("PASS: defense-in-depth tenant checks protect chunks and documents before LLM use")
print("PASS: Gemini generation exposes evidence citations")
print("PASS: RLS is the tenant security authority; fragile natural-language scope guards are absent")
