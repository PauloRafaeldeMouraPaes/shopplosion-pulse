# Shopplosion Pulse — Private Workspace Hardening

- Connected `Minha indústria` directly to `Ask AI privado` in the main navigation and primary CTAs.
- Reduced redundant privacy copy while keeping the RLS boundary explicit.
- Improved empty states for documents and private analyses with clear next actions.
- Added document status visibility for indexed versus stored-only files.
- Added migration `004_private_document_integrity.sql` to enforce parent-document/industry consistency for chunks.
- Kept private Storage access on short-lived signed URLs; browser access remains subject to Storage RLS.
- The real two-user A/B cross-tenant runtime test remains a release gate and is not claimed as proven without real fixtures.
