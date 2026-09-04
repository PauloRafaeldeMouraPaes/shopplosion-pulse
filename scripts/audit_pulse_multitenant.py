#!/usr/bin/env python3
"""Deterministic static guardrails for the Pulse multi-tenant foundation."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

def read(path):
    p = ROOT / path
    if not p.exists():
        errors.append(f"missing:{path}")
        return ""
    return p.read_text(encoding="utf-8")

auth = read("auth.html")
config = read("pulse-config.js")
redirects = read("_redirects")
core = read("supabase/migrations/001_multitenant_core.sql")
storage = read("supabase/migrations/002_storage_and_membership_hardening.sql")
architecture = read("docs/PULSE_MULTITENANT_ARCHITECTURE.md")

required_auth = [
    "signInWithPassword",
    "from('profiles')",
    "location.replace('./app')",
    "@supabase/supabase-js@2",
]
for token in required_auth:
    if token not in auth:
        errors.append(f"auth-missing:{token}")

# The privileged key must not appear as a configured browser value. Documentation
# may mention the forbidden key name, so inspect assignments rather than comments.
if re.search(r"(?:service_role|serviceRole)\s*[:=]\s*['\"][^'\"]+['\"]", auth + "\n" + config):
    errors.append("privileged-key-configured-in-browser")
if "anonKey:''" not in config:
    errors.append("config-template-not-empty-safe")
if "/ /auth.html 200" not in redirects or "/app /index.html 200" not in redirects:
    errors.append("netlify-entry-routing-missing")

for token in [
    "create table if not exists public.industries",
    "create table if not exists public.profiles",
    "create table if not exists public.documents",
    "create table if not exists public.analyses",
    "enable row level security",
    "current_industry_id()",
]:
    if token not in core:
        errors.append(f"core-missing:{token}")

for token in [
    "status = 'active'",
    "pulse-documents",
    "storage.objects",
    "split_part(name, '/', 1)",
    "create policy pulse_documents_object_select",
    "create policy pulse_documents_object_insert",
    "create policy pulse_documents_object_update",
    "create policy pulse_documents_object_delete",
]:
    if token not in storage:
        errors.append(f"storage-missing:{token}")

# Fail closed on obvious client-controlled tenant authorization patterns.
if re.search(r"industry_id\s*[:=]\s*[^,;}]+", auth):
    errors.append("client-industry-authorization-pattern")

if "O frontend nunca é a autoridade de isolamento" not in architecture:
    errors.append("architecture-security-rule-missing")

if errors:
    print("PULSE MULTITENANT AUDIT: FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("PULSE MULTITENANT AUDIT: PASS")
print("- Auth entrypoint present")
print("- Browser configuration contains no privileged key assignment")
print("- Tenant tables and RLS present")
print("- Active-membership check present")
print("- Private Storage policies present")
print("- Netlify auth/app routing present")
