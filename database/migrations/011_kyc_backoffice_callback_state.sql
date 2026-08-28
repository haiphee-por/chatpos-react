ALTER TABLE merchant_kyc_cases
  ADD COLUMN IF NOT EXISTS "backofficeCaseId" text,
  ADD COLUMN IF NOT EXISTS "lastBackofficeEventOccurredAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastBackofficeEventId" text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_kyc_cases_backoffice_case
  ON merchant_kyc_cases ("backofficeCaseId")
  WHERE "backofficeCaseId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_kyc_cases_backoffice_event
  ON merchant_kyc_cases ("lastBackofficeEventOccurredAt");