ALTER TABLE kyc_document_versions
  ADD COLUMN IF NOT EXISTS "backofficeDispatchStatus" text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "backofficeDispatchError" text,
  ADD COLUMN IF NOT EXISTS "backofficeDispatchedAt" timestamptz;

CREATE INDEX IF NOT EXISTS idx_kyc_document_versions_backoffice_dispatch
  ON kyc_document_versions ("backofficeDispatchStatus", "createdAt");
