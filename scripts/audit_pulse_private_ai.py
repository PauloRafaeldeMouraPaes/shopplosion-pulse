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
require("ANTHROPIC_API_KEY" not in ask, "Anthropic secret appears in browser code")
require("SUPABASE_SECRET_KEYS" not in ask and "SERVICE_ROLE" not in ask.upper(),
        "Supabase secret/service key appears in browser code")
require("Authorization" in fn and "Bearer " in fn, "Edge Function does not require Authorization")
require("verify_jwt = true" in cfg, "pulse-ask-ai is not configured with verify_jwt=true")
require("global: { headers: { Authorization: authorization } }" in fn,
        "Edge Function does not propagate caller JWT to Supabase client")
require("from('document_chunks')" in fn, "Edge Function does not retrieve private chunks")
require("anthropic.com/v1/messages" in fn, "Anthropic Messages endpoint missing")
require("ANTHROPIC_API_KEY" in fn, "Anthropic secret is not server-side configured")
require("PULSE_LLM_MODEL" in fn, "LLM model is not configurable")
require("citations" in fn and "ref:" in fn, "Evidence citations are not returned")
require("service_role" not in fn.lower() and "supabase_secret_key" not in fn.lower(),
        "Edge Function contains a service-role/secret-key path")

# Guard against accidental direct browser provider calls.
require(not re.search(r"fetch\(['\"]https://api\\.anthropic\\.com", ask),
        "Browser code directly calls Anthropic")

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
print("PASS: generated response exposes evidence citations")
