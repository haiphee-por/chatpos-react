ALTER TABLE kyc_document_versions
  ADD COLUMN IF NOT EXISTS "sourceIssuedAt" timestamptz;

UPDATE kyc_document_versions
SET "sourceIssuedAt" = "createdAt"
WHERE "sourceIssuedAt" IS NULL;

ALTER TABLE kyc_document_versions
  ALTER COLUMN "sourceIssuedAt" SET NOT NULL;
