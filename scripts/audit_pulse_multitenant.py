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
app = read("app.html")
config = read("pulse-config.js")
redirects = read("_redirects")
core = read("supabase/migrations/001_multitenant_core.sql")
storage = read("supabase/migrations/002_storage_and_membership_hardening.sql")
architecture = read("docs/PULSE_MULTITENANT_ARCHITECTURE.md")

required_auth = [
    "signInWithPassword",
    "from('profiles')",
    "@supabase/supabase-js@2",
    "resetPasswordForEmail",
    "updateUser({password})",
    "PASSWORD_RECOVERY",
]
for token in required_auth:
    if token not in auth:
        errors.append(f"auth-missing:{token}")

if not re.search(r"location\.replace\('\./(?:index\.html|app\.html)'\)", auth):
    errors.append("auth-app-redirect-missing")

if "location.origin+location.pathname" not in auth:
    errors.append("password-recovery-redirect-not-derived-from-current-site")

required_app = [
    "auth.getUser()",
    "from('profiles')",
    "from('industries')",
    "from('documents')",
    "from('analyses')",
    "storage.from('pulse-documents')",
    "industry.id+'/'+crypto.randomUUID()",
    "auth.signOut()",
    "Minha indústria",
    "Universo Pulse",
    "workspaceNote",
    "id=\"role\"",
]
for token in required_app:
    if token not in app:
        errors.append(f"app-missing:{token}")

# The privileged key must not appear as a configured browser value. Documentation
# may mention the forbidden key name, so inspect assignments rather than comments.
if re.search(r"(?:service_role|serviceRole)\s*[:=]\s*['\"][^'\"]+['\"]", auth + "\n" + app + "\n" + config):
    errors.append("privileged-key-configured-in-browser")

# A real browser configuration is expected in production. Only a publishable
# Supabase key (new format) or legacy anon JWT is allowed here.
if not re.search(r"anonKey\s*:\s*['\"](?:sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)['\"]", config):
    errors.append("browser-publishable-key-missing-or-invalid")

if "/ /auth.html 200" not in redirects or "/app /app.html 200" not in redirects:
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
print("- Password recovery flow present")
print("- Authenticated tenant workspace present")
print("- Private workspace navigation and tenant identity present")
print("- Browser configuration contains no privileged key assignment")
print("- Browser configuration contains a valid publishable/anon key")
print("- Tenant tables and RLS present")
print("- Active-membership check present")
print("- Private Storage policies present")
print("- Netlify auth/app routing present")
