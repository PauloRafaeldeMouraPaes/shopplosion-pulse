# Pulse — Runtime Multi-Tenant Isolation Test

## Purpose

The deterministic CI audit verifies that the required RLS, Storage, membership and routing protections exist. This test verifies the **real connected Supabase project** with two authenticated sessions.

## Required test accounts

Create two active test users belonging to different industries:

- User A → Industry A
- User B → Industry B

Do not use client production documents. Synthetic fixtures are preferred.

## Run locally

Node 18+ is required.

Set these environment variables in the local shell (never commit them):

```text
PULSE_SUPABASE_URL=https://<project>.supabase.co
PULSE_SUPABASE_ANON_KEY=<public-publishable-key>
PULSE_TEST_A_EMAIL=<industry-a-test-user>
PULSE_TEST_A_PASSWORD=<industry-a-password>
PULSE_TEST_B_EMAIL=<industry-b-test-user>
PULSE_TEST_B_PASSWORD=<industry-b-password>
```

Then run:

```bash
node scripts/verify_multitenant_runtime.mjs
```

Only the public/publishable Supabase key is used. A service/secret key must never be supplied.

## Acceptance gate

The test must confirm:

1. A and B authenticate successfully.
2. A and B belong to different industries.
3. A's document query contains only A records.
4. B's document query contains only B records.
5. A's analysis query contains only A records.
6. B's analysis query contains only B records.
7. A cannot insert an analysis using B's `industry_id`.
8. A cannot read a B document by ID.
9. B cannot download an A Storage object.

If a fixture does not exist, the corresponding fixture-dependent check is reported as `SKIP`, not `PASS`. The final production security claim therefore remains blocked until those checks run with real A/B fixtures.

## Security rule

Credentials belong only in the local shell/password manager. Never place passwords, access tokens, service/secret keys or customer documents in GitHub, HTML, JavaScript configuration or issue comments.
