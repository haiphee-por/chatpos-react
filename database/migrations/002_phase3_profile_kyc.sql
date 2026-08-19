ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "profileVersion" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "profileJson" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE merchant_kyc_cases
  ADD COLUMN IF NOT EXISTS "submissionSnapshotJson" jsonb,
  ADD COLUMN IF NOT EXISTS "submissionProfileVersion" integer;

ALTER TABLE "KycVerification"
  ADD COLUMN IF NOT EXISTS "submissionSnapshotJson" jsonb,
  ADD COLUMN IF NOT EXISTS "submissionProfileVersion" integer;

ALTER TABLE kyc_document_versions
  ADD COLUMN IF NOT EXISTS "sourceRequestId" text,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" text;

ALTER TABLE merchant_profile_versions
  ADD COLUMN IF NOT EXISTS "bodyDigest" text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_document_versions_source_request
  ON kyc_document_versions ("caseId", "sourceRequestId")
  WHERE "sourceRequestId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_document_versions_idempotency
  ON kyc_document_versions ("caseId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_messages_case_created
  ON kyc_chat_messages ("caseId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications ("recipientId", "createdAt" DESC);
