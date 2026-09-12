# Shopplosion Pulse Release Notes

## Release gate

The production release path validates the exact commit provenance, Edge Function deployment manifest, Pulse artifact, orchestrator protocol, adversarial contracts, JavaScript syntax, product regression, semantic data integrity, Ask AI behavior, evidence contracts, accessibility, and browser smoke tests before deployment.

The production release is invoked as a reusable workflow by the existing `Pulse QA` workflow after QA succeeds on `main`. This avoids relying on an independently scheduled release trigger and keeps the release commit identical to the QA commit.

The release identity is published as `pulse-release.json` with the exact commit SHA and release workflow run ID. The deployment health check verifies the published root, application, Ask AI, Intelligence page, and release identity before the release is considered complete.

The reusable workflow registration is intentionally isolated so its invocation can be verified independently before restoring the complete production deployment stages.
