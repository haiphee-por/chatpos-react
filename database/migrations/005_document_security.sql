ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS "scanStatus" text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "scanReportJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "scannedAt" timestamptz;

ALTER TABLE kyc_document_versions
  ADD COLUMN IF NOT EXISTS "scanStatus" text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "scanReportJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "scannedAt" timestamptz;

CREATE INDEX IF NOT EXISTS idx_kyc_document_versions_scan
  ON kyc_document_versions ("scanStatus", "createdAt");
