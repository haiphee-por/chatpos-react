ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Bangkok',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'THB';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS "storeId" uuid REFERENCES "Store"(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "actionTarget" text,
  ADD COLUMN IF NOT EXISTS "metadataJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT NOW();

UPDATE notifications n
SET "storeId" = c."storeId",
    category = CASE WHEN n.type ILIKE '%kyc%' THEN 'kyc' ELSE n.category END,
    "updatedAt" = NOW()
FROM merchant_kyc_cases c
WHERE n."caseId" = c.id
  AND n."storeId" IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_store_recipient_created
  ON notifications ("storeId", "recipientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_store_unread
  ON notifications ("storeId", "recipientId", "readAt")
  WHERE "readAt" IS NULL;

CREATE TABLE IF NOT EXISTS merchant_home_capabilities (
  "storeId" uuid PRIMARY KEY REFERENCES "Store"(id) ON DELETE CASCADE,
  "canViewBalance" boolean NOT NULL DEFAULT false,
  "canViewTransactions" boolean NOT NULL DEFAULT true,
  "canUseBenefits" boolean NOT NULL DEFAULT false,
  "canUseStopPay" boolean NOT NULL DEFAULT false,
  "canViewBilling" boolean NOT NULL DEFAULT false,
  "metadataJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE',
  eligible boolean NOT NULL DEFAULT false,
  "startsAt" timestamptz,
  "expiresAt" timestamptz,
  "metadataJson" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", code)
);

CREATE INDEX IF NOT EXISTS idx_merchant_benefits_store_status_expiry
  ON merchant_benefits ("storeId", status, "expiresAt");

CREATE TABLE IF NOT EXISTS merchant_stoppay_controls (
  "storeId" uuid PRIMARY KEY REFERENCES "Store"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE',
  reason text,
  "version" integer NOT NULL DEFAULT 1,
  "lastEventId" text,
  "updatedBy" text,
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT merchant_stoppay_status_check CHECK (status IN ('ACTIVE', 'PAUSE_REQUESTED', 'PAUSED', 'RESUME_REQUESTED', 'SUSPENDED', 'RECOVERY_REQUESTED'))
);

CREATE TABLE IF NOT EXISTS merchant_stoppay_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" uuid NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
  "eventId" text NOT NULL UNIQUE,
  "idempotencyKey" text NOT NULL,
  action text NOT NULL,
  "fromStatus" text NOT NULL,
  "toStatus" text NOT NULL,
  reason text,
  "actorId" text NOT NULL,
  "actorRole" text NOT NULL,
  "requestId" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE ("storeId", "idempotencyKey")
);

CREATE INDEX IF NOT EXISTS idx_merchant_stoppay_events_store_created
  ON merchant_stoppay_events ("storeId", "createdAt" DESC);

ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "transactionType" text NOT NULL DEFAULT 'payment',
  ADD COLUMN IF NOT EXISTS "refundOfId" uuid REFERENCES "Transaction"(id),
  ADD COLUMN IF NOT EXISTS "payoutReference" text,
  ADD COLUMN IF NOT EXISTS "occurredAt" timestamptz;

UPDATE "Transaction"
SET "occurredAt" = COALESCE("paidAt", "createdAt")
WHERE "occurredAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_store_type_status_occurred
  ON "Transaction" ("storeId", "transactionType", status, "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_store_occurred
  ON "Transaction" ("storeId", "occurredAt" DESC);
