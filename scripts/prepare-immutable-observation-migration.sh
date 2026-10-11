#!/usr/bin/env bash
set -euo pipefail

# Prepare the local workspace for the Chocolate pilot's immutable source history.
# This script deliberately does not connect to or modify a remote/production database.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: run this script from inside the cloned shopplosion-pulse repository." >&2
  exit 2
}
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: Supabase CLI is not installed or is not on PATH." >&2
  echo "Install the CLI using the official Supabase instructions, then rerun this script." >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is required for the local Supabase database workflow." >&2
  exit 2
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is installed but the daemon is not available to this user." >&2
  exit 2
fi

if [ ! -f supabase/config.toml ]; then
  echo "ERROR: supabase/config.toml was not found at the repository root." >&2
  exit 2
fi

echo "Supabase CLI: $(supabase --version)"
echo "Docker: available"
echo "Repository: $ROOT"
echo
echo "Creating migration through the Supabase CLI (no database changes will be applied)..."
before="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print 2>/dev/null | sort || true)"
supabase migration new immutable_source_observation_history
after="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print 2>/dev/null | sort || true)"

created="$(comm -13 <(printf '%s\n' "$before") <(printf '%s\n' "$after") | sed '/^$/d')"
count="$(printf '%s\n' "$created" | sed '/^$/d' | wc -l | tr -d ' ')"
if [ "$count" -ne 1 ]; then
  echo "ERROR: expected exactly one newly generated migration file; found $count." >&2
  echo "Review supabase/migrations manually before continuing." >&2
  exit 3
fi

migration_file="$created"
echo
echo "Generated migration: $migration_file"
echo "The file is intentionally empty. Do not deploy it yet."
echo
echo "Next steps:"
echo "  1. Review the current schema and tenant-aware composite key requirements."
echo "  2. Implement the version and observation tables in this generated file."
echo "  3. Start/use the local Supabase stack and apply migrations locally."
echo "  4. Run H01-H15, RLS checks, and Supabase advisors."
echo "  5. Review the SQL diff and worker transaction behavior before any deployment."
echo
echo "Safety: this script never runs db push, migration up, apply_migration, or production SQL."
