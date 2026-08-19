ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "clientReference" text,
  ADD COLUMN IF NOT EXISTS "backofficePaymentReference" text,
  ADD COLUMN IF NOT EXISTS "gatewayReference" text,
  ADD COLUMN IF NOT EXISTS "lastPaymentOccurredAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastPaymentEventId" text,
  ADD COLUMN IF NOT EXISTS "paymentMetadataJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_store_client_reference
  ON "Transaction" ("storeId", "clientReference")
  WHERE "clientReference" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transaction_store_idempotency
  ON "Transaction" ("storeId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  "eventId" text NOT NULL,
  "bodyDigest" text NOT NULL,
  "transactionId" uuid REFERENCES "Transaction"(id),
  status text NOT NULL DEFAULT 'RECEIVED',
  "occurredAt" timestamptz,
  "payloadJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "receivedAt" timestamptz NOT NULL DEFAULT NOW(),
  "processedAt" timestamptz,
  "errorCode" text,
  UNIQUE (provider, "eventId")
);

CREATE TABLE IF NOT EXISTS commission_settlement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" text NOT NULL UNIQUE,
  "eventType" text NOT NULL,
  "transactionId" uuid REFERENCES "Transaction"(id),
  "sourceRef" text NOT NULL,
  "bodyDigest" text NOT NULL,
  "payloadJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  "originalEventId" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "sentAt" timestamptz,
  "lastErrorCode" text
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received
  ON payment_webhook_events (provider, "receivedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_events_status
  ON commission_settlement_events (status, "createdAt");
