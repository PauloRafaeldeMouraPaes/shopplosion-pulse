#!/usr/bin/env python3
"""Deterministic audit for the private Ask AI server-side boundary."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ASK = ROOT / "ask.html"
FN = ROOT / "supabase" / "functions" / "pulse-ask-ai" / "index.ts"
CFG = ROOT / "supabase" / "config.toml"
DEPLOY = ROOT / ".github" / "workflows" / "pulse-supabase-ask-ai-deploy.yml"

errors = []

def require(condition, message):
    if not condition:
        errors.append(message)

ask = ASK.read_text(encoding="utf-8") if ASK.exists() else ""
fn = FN.read_text(encoding="utf-8") if FN.exists() else ""
cfg = CFG.read_text(encoding="utf-8") if CFG.exists() else ""
deploy = DEPLOY.read_text(encoding="utf-8") if DEPLOY.exists() else ""

require(ASK.exists(), "ask.html missing")
require(FN.exists(), "private Ask AI Edge Function missing")
require(CFG.exists(), "supabase/config.toml missing")
require(DEPLOY.exists(), "guarded Supabase Ask AI deployment workflow missing")

require("functions.invoke('pulse-ask-ai'" in ask or 'functions.invoke("pulse-ask-ai"' in ask,
        "ask.html does not invoke pulse-ask-ai")
require("ANTHROPIC_API_KEY" not in ask and "GEMINI_API_KEY" not in ask,
        "LLM provider secret appears in browser code")
require("SUPABASE_SECRET_KEYS" not in ask and "SERVICE_ROLE" not in ask.upper(),
        "Supabase secret/service key appears in browser code")
require("Authorization" in fn and "Bearer " in fn, "Edge Function does not require Authorization")
require("const publicMode = false" in fn, "Edge Function must not allow unauthenticated public-mode generation")
require("const publicMode = scope === 'universe' && !authorization" not in fn,
        "Unauthenticated public scope can bypass industry authentication")
require("verify_jwt = true" in cfg, "pulse-ask-ai is not configured with verify_jwt=true")
require("global: { headers: { Authorization: authorization } }" in fn,
        "Edge Function does not propagate caller JWT to Supabase client")
require("from('document_chunks')" in fn, "Edge Function does not retrieve private chunks")
require("generativelanguage.googleapis.com/v1beta/models/" in fn, "Gemini API endpoint missing")
require("GEMINI_API_KEY" in fn, "Gemini secret is not server-side configured")
require("workflow_dispatch:" in deploy, "Supabase Ask AI deployment must be manually triggered")
require("github.ref == 'refs/heads/main' && inputs.confirm_deploy == 'DEPLOY_PULSE_ASK_AI'" in deploy,
        "Supabase Ask AI deployment is not guarded by main + explicit confirmation")
require(not re.search(r"^[ \\t]*(push|pull_request):", deploy, re.M),
        "Supabase Ask AI deployment must not deploy automatically on push or pull_request")
require("secrets.SUPABASE_ACCESS_TOKEN" in deploy, "Supabase deployment token is not sourced from a secret")
require("supabase functions deploy pulse-ask-ai --project-ref" in deploy,
        "Deployment workflow must deploy only pulse-ask-ai")
require("invalid.invalid.invalid" in deploy and "SUPABASE ASK AI JWT GATEWAY CHECK: PASS" in deploy,
        "Deployment workflow must verify that invalid JWTs are blocked at the gateway")
require("api.supabase.com/v1/projects/" in deploy and "DEPLOYED_FUNCTION_JWT_VERIFICATION_NOT_ENABLED" in deploy,
        "Deployment workflow must verify live Supabase function metadata and verify_jwt")
require("PULSE_LLM_MODEL" in fn, "LLM model is not configurable")
require("citations" in fn and "ref:" in fn, "Evidence citations are not returned")
require("service_role" not in fn.lower() and "supabase_secret_key" not in fn.lower(),
        "Edge Function contains a service-role/secret-key path")

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
print("PASS: retrieval is performed from tenant-scoped document_chunks")
print("PASS: Gemini generation exposes evidence citations")
